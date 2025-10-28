import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const rawResults = await prisma.$queryRaw<
    { month: string; revenue: number; cogs: number; expenses: number; profit: number }[]
  >`
    with sales as (
      select
        to_char(date_trunc('month', order_date), 'YYYY-MM') as month,
        sum(total)::numeric(12,2) as revenue,
        sum(qty * (coalesce(cogs_ingredientes,0) + coalesce(overhead_unit,0)))::numeric(12,2) as cogs
      from v_fct_sales
      group by 1
    ),
    expenses as (
      select
        to_char(date_trunc('month', date), 'YYYY-MM') as month,
        sum(amount)::numeric(12,2) as expense
      from v_fct_expenses
      group by 1
    )
    select
      s.month,
      coalesce(s.revenue,0) as revenue,
      coalesce(s.cogs,0) as cogs,
      coalesce(e.expense,0) as expenses,
      coalesce(s.revenue,0) - coalesce(s.cogs,0) - coalesce(e.expense,0) as profit
    from sales s
    left join expenses e on e.month = s.month
    order by s.month;
  `;

  const parsed = rawResults.map((row) => ({
    month: row.month,
    revenue: Number(row.revenue),
    cogs: Number(row.cogs),
    expenses: Number(row.expenses),
    profit: Number(row.profit),
  }));

  return NextResponse.json(parsed);
}
