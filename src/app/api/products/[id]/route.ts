import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { validateCsrf } from "@/lib/csrf";
import { productSchema } from "@/lib/zod-schemas";

interface Params {
  params: { id: string };
}

export async function GET(_: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireAuth("admin");
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  const json = await request.json();
  const parsed = productSchema.partial().safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const product = await prisma.product.update({ where: { id: params.id }, data: parsed.data });
    await prisma.auditLog.create({
      data: {
        userId: auth.session.user.id,
        action: "update",
        entity: "Product",
        entityId: product.id,
        payloadJson: product,
      },
    });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requireAuth("admin");
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  try {
    const removed = await prisma.product.delete({ where: { id: params.id } });
    await prisma.auditLog.create({
      data: {
        userId: auth.session.user.id,
        action: "delete",
        entity: "Product",
        entityId: removed.id,
        payloadJson: removed,
      },
    });
    return NextResponse.json(removed);
  } catch {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }
}
