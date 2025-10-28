import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { expenseSchema } from "@/lib/zod-schemas";
import { requireAuth } from "@/lib/auth-helpers";
import { validateCsrf } from "@/lib/csrf";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const expenses = await prisma.expense.findMany({
    orderBy: { date: "desc" },
    take: 100,
  });
  return NextResponse.json(expenses);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  const body = await request.json();
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        date: new Date(data.date),
        category: data.category,
        description: data.description,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
      },
    });

    await tx.cashbook.create({
      data: {
        date: new Date(data.date),
        type: "OUT",
        description: data.description,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        refTable: "Expense",
        refId: created.id,
        expenseId: created.id,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: auth.session.user.id,
        action: "create",
        entity: "Expense",
        entityId: created.id,
        payloadJson: created,
      },
    });

    return created;
  });

  return NextResponse.json(expense, { status: 201 });
}
