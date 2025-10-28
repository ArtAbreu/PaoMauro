import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { validateCsrf } from "@/lib/csrf";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  const body = await request.json();
  const date = body.date ? new Date(body.date) : new Date();
  const notes = typeof body.notes === "string" ? body.notes : "Fechamento diário";

  const summary = await prisma.$transaction(async (tx) => {
    const totals = await tx.cashbook.groupBy({
      by: ["paymentMethod", "type"],
      where: {
        date: {
          gte: new Date(date.toISOString().slice(0, 10) + "T00:00:00"),
          lte: new Date(date.toISOString().slice(0, 10) + "T23:59:59"),
        },
      },
      _sum: { amount: true },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.session!.user.id,
        action: "cash-close",
        entity: "Cashbook",
        entityId: date.toISOString(),
        payloadJson: { date, totals, notes },
      },
    });

    return totals;
  });

  return NextResponse.json({ date, notes, totals: summary });
}
