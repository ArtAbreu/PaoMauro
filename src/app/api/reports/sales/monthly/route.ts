import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const rawResults = await prisma.$queryRaw<
    { month: string; total: number; discount: number }[]
  >`
    select
      to_char(date_trunc('month', order_date), 'YYYY-MM') as month,
      sum(total_net)::numeric(12,2) as total,
      sum(total_discount)::numeric(12,2) as discount
    from sales_order
    where status in ('READY','DELIVERED','PAID')
      and order_date >= date_trunc('month', current_date) - interval '5 months'
    group by 1
    order by 1
  `;

  const parsed = rawResults.map((row) => ({
    month: row.month,
    total: Number(row.total),
    discount: Number(row.discount),
  }));

  return NextResponse.json(parsed);
}
