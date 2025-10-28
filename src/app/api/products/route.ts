import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { validateCsrf } from "@/lib/csrf";
import { productSchema } from "@/lib/zod-schemas";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("admin");
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  const json = await request.json();
  const parsed = productSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: parsed.data,
  });

  await prisma.auditLog.create({
    data: {
      userId: auth.session.user.id,
      action: "create",
      entity: "Product",
      entityId: product.id,
      payloadJson: product,
    },
  });

  return NextResponse.json(product, { status: 201 });
}
