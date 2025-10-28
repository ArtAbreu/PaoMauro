import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { productionBatchSchema } from "@/lib/zod-schemas";
import { requireAuth } from "@/lib/auth-helpers";
import { validateCsrf } from "@/lib/csrf";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const batches = await prisma.productionBatch.findMany({
    include: { product: true },
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json(batches);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  const json = await request.json();
  const parsed = productionBatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.productionBatch.create({
      data: {
        productId: data.productId,
        plannedUnits: data.plannedUnits,
        actualUnits: data.actualUnits ?? null,
        startedAt: data.startedAt ? new Date(data.startedAt) : new Date(),
        finishedAt: data.finishedAt ? new Date(data.finishedAt) : null,
        notes: data.notes,
      },
      include: { product: true },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.session.user.id,
        action: "create",
        entity: "ProductionBatch",
        entityId: created.id,
        payloadJson: created,
      },
    });

    return created;
  });

  return NextResponse.json(batch, { status: 201 });
}
