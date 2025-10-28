import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { validateCsrf } from "@/lib/csrf";
import { recipeSchema } from "@/lib/zod-schemas";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const productId = request.nextUrl.searchParams.get("productId");
  if (productId) {
    const recipe = await prisma.recipe.findUnique({
      where: { productId },
      include: { items: true },
    });
    return NextResponse.json(recipe);
  }

  const recipes = await prisma.recipe.findMany({
    include: { items: { include: { ingredient: true } }, product: true },
  });
  return NextResponse.json(recipes);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("admin");
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  const json = await request.json();
  const parsed = recipeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const recipe = await prisma.recipe.upsert({
    where: { productId: parsed.data.productId },
    update: {
      yieldUnits: parsed.data.yieldUnits,
      notes: parsed.data.notes,
      items: {
        deleteMany: {},
        create: parsed.data.items.map((item) => ({
          ingredientId: item.ingredientId,
          qtyPerBatch: item.qtyPerBatch,
          unit: item.unit,
        })),
      },
    },
    create: {
      productId: parsed.data.productId,
      yieldUnits: parsed.data.yieldUnits,
      notes: parsed.data.notes,
      items: {
        create: parsed.data.items.map((item) => ({
          ingredientId: item.ingredientId,
          qtyPerBatch: item.qtyPerBatch,
          unit: item.unit,
        })),
      },
    },
    include: { items: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: auth.session.user.id,
      action: "upsert",
      entity: "Recipe",
      entityId: recipe.id,
      payloadJson: recipe,
    },
  });

  return NextResponse.json(recipe);
}
