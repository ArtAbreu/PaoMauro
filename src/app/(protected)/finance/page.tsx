import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import FinanceDashboard from "@/components/finance-dashboard";

export default async function FinancePage() {
  const [session, cashbook, expenses] = await Promise.all([
    getServerSession(authOptions),
    prisma.cashbook.findMany({ orderBy: { date: "desc" }, take: 30 }),
    prisma.expense.findMany({ orderBy: { date: "desc" }, take: 30 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Financeiro</h1>
        <p className="text-sm text-slate-500">
          Controle o caixa diário, registre despesas e acompanhe a saúde financeira.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Fluxo de caixa</CardTitle>
          <CardDescription>Resumo por método de pagamento e lançamentos recentes.</CardDescription>
        </CardHeader>
        <CardContent>
          <FinanceDashboard
            csrf={session?.user?.id ?? ""}
            initialCashbook={cashbook}
            initialExpenses={expenses}
          />
        </CardContent>
      </Card>
    </div>
  );
}
