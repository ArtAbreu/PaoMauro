import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { salesOrderSchema } from "@/lib/zod-schemas";
import { requireAuth } from "@/lib/auth-helpers";
import { validateCsrf } from "@/lib/csrf";
import Decimal from "decimal.js";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const orders = await prisma.salesOrder.findMany({
    include: {
      items: {
        include: {
          product: true,
        },
      },
      customer: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  const body = await request.json();
  const parsed = salesOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const totalNet = new Decimal(data.totalGross).minus(data.totalDiscount || 0);

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.create({
      data: {
        customerId: data.customerId,
        orderDate: new Date(data.orderDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: data.status,
        paymentMethod: data.paymentMethod ?? null,
        totalGross: data.totalGross,
        totalDiscount: data.totalDiscount,
        totalNet: totalNet.toNumber(),
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
      },
      include: { items: true },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.session.user.id,
        action: "create",
        entity: "SalesOrder",
        entityId: order.id,
        payloadJson: order,
      },
    });

    if (order.status === "PAID" && order.paymentMethod) {
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

    return order;
  });

  return NextResponse.json(result, { status: 201 });
}
