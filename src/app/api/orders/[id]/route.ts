import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { salesOrderSchema } from "@/lib/zod-schemas";
import { requireAuth } from "@/lib/auth-helpers";
import { validateCsrf } from "@/lib/csrf";
import Decimal from "decimal.js";

interface Params {
  params: { id: string };
}

export async function GET(_: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const order = await prisma.salesOrder.findUnique({
    where: { id: params.id },
    include: { items: true, customer: true },
  });
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  const body = await request.json();
  const parsed = salesOrderSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.salesOrder.findUnique({ where: { id: params.id }, include: { items: true } });
      if (!existing) throw new Error("NOT_FOUND");

      const currentDiscount = new Decimal(existing.totalDiscount.toString());
      const totalNetDecimal = data.totalGross !== undefined
        ? new Decimal(data.totalGross).minus(data.totalDiscount ?? currentDiscount.toNumber())
        : new Decimal(existing.totalNet.toString());

      const order = await tx.salesOrder.update({
        where: { id: params.id },
        data: {
          customerId: data.customerId ?? existing.customerId,
          orderDate: data.orderDate ? new Date(data.orderDate) : existing.orderDate,
          dueDate: data.dueDate ? new Date(data.dueDate) : existing.dueDate,
          status: data.status ?? existing.status,
          paymentMethod: data.paymentMethod ?? existing.paymentMethod,
          totalGross: data.totalGross ?? existing.totalGross,
          totalDiscount: data.totalDiscount ?? existing.totalDiscount,
          totalNet: totalNetDecimal.toNumber(),
          items: data.items
            ? {
                deleteMany: {},
                create: data.items.map((item) => ({
                  productId: item.productId,
                  qty: item.qty,
                  unitPrice: item.unitPrice,
                  total: item.total,
                })),
              }
            : undefined,
        },
        include: { items: true },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.session.user.id,
          action: "update",
          entity: "SalesOrder",
          entityId: order.id,
          payloadJson: order,
        },
      });

      if (order.status === "PAID" && order.paymentMethod) {
        const hasEntry = await tx.cashbook.findFirst({ where: { orderId: order.id } });
        if (!hasEntry) {
          await tx.cashbook.create({
            data: {
              date: new Date(),
              type: "IN",
              description: `Pagamento pedido ${order.id}`,
              amount: order.totalNet,
              paymentMethod: order.paymentMethod,
              refTable: "SalesOrder",
              refId: order.id,
              orderId: order.id,
            },
          });
        }
      }

      return order;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if ((error as Error).message === "NOT_FOUND") {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth("admin");
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  try {
    const removed = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.delete({ where: { id: params.id } });
      await tx.auditLog.create({
        data: {
          userId: auth.session.user.id,
          action: "delete",
          entity: "SalesOrder",
          entityId: order.id,
          payloadJson: order,
        },
      });
      return order;
    });
    return NextResponse.json(removed);
  } catch (error) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
}
