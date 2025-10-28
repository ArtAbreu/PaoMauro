import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inventoryMovementSchema } from "@/lib/zod-schemas";
import { requireAuth } from "@/lib/auth-helpers";
import { validateCsrf } from "@/lib/csrf";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const movements = await prisma.inventoryMovement.findMany({
    include: { ingredient: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(movements);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  const body = await request.json();
  const parsed = inventoryMovementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.type === "IN" && (data.unitCost === undefined || data.unitCost <= 0)) {
    return NextResponse.json({ error: "Informe o custo unitário" }, { status: 400 });
  }

  const movement = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryMovement.create({
      data: {
        ingredientId: data.ingredientId,
        type: data.type,
        qty: data.qty,
        unitCost: data.unitCost ?? null,
        reason: data.reason,
      },
      include: { ingredient: true },
    });

    if (data.type === "IN" && data.unitCost) {
      await tx.ingredient.update({
        where: { id: data.ingredientId },
        data: { unitCost: data.unitCost },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: auth.session.user.id,
        action: "inventory_movement",
        entity: "InventoryMovement",
        entityId: created.id,
        payloadJson: created,
      },
    });

    return created;
  });

  return NextResponse.json(movement, { status: 201 });
}
