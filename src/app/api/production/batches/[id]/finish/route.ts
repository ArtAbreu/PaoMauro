import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { validateCsrf } from "@/lib/csrf";
import Decimal from "decimal.js";
import { getAverageCost } from "@/lib/cost";

interface Params {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  const body = await request.json();
  const actualUnits = Number(body.actualUnits ?? 0);
  if (!Number.isFinite(actualUnits) || actualUnits <= 0) {
    return NextResponse.json({ error: "Informe a quantidade produzida" }, { status: 400 });
  }

  const finishedAt = body.finishedAt ? new Date(body.finishedAt) : new Date();
  const notes = typeof body.notes === "string" ? body.notes : undefined;

  try {
    const batch = await prisma.$transaction(async (tx) => {
      const existing = await tx.productionBatch.findUnique({
        where: { id: params.id },
        include: {
          product: {
            include: {
              recipe: {
                include: { items: true },
              },
            },
          },
        },
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }
      if (!existing.product.recipe) {
        throw new Error("NO_RECIPE");
      }
      const recipe = existing.product.recipe;
      const ratio = new Decimal(actualUnits).div(recipe.yieldUnits || 1);

      const updated = await tx.productionBatch.update({
        where: { id: params.id },
        data: {
          actualUnits,
          finishedAt,
          notes: notes ?? existing.notes,
        },
      });

      await Promise.all(
        recipe.items.map(async (item) => {
          const qtyConsumed = new Decimal(item.qtyPerBatch.toString()).times(ratio);
          const averageCost = await getAverageCost(item.ingredientId);
          await tx.inventoryMovement.create({
            data: {
              ingredientId: item.ingredientId,
              type: "OUT",
              qty: qtyConsumed.toDecimalPlaces(3).toNumber(),
              unitCost: averageCost.toNumber(),
              reason: `Baixa lote ${updated.id}`,
            },
          });
        })
      );

      await tx.auditLog.create({
        data: {
          userId: auth.session!.user.id,
          action: "finish",
          entity: "ProductionBatch",
          entityId: updated.id,
          payloadJson: { batch: updated, actualUnits },
        },
      });

      return updated;
    });

    return NextResponse.json(batch);
  } catch (error) {
    if ((error as Error).message === "NOT_FOUND") {
      return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });
    }
    if ((error as Error).message === "NO_RECIPE") {
      return NextResponse.json({ error: "Produto sem receita configurada" }, { status: 400 });
    }
    throw error;
  }
}
