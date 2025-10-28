import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { validateCsrf } from "@/lib/csrf";
import { ingredientSchema } from "@/lib/zod-schemas";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(ingredients);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("admin");
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  const json = await request.json();
  const parsed = ingredientSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ingredient = await prisma.ingredient.create({ data: parsed.data });

  await prisma.auditLog.create({
    data: {
      userId: auth.session.user.id,
      action: "create",
      entity: "Ingredient",
      entityId: ingredient.id,
      payloadJson: ingredient,
    },
  });

  return NextResponse.json(ingredient, { status: 201 });
}
