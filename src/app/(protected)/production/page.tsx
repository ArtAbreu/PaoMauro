import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionPlanner } from "@/components/production-planner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function ProductionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const [products, batches] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.productionBatch.findMany({ include: { product: true }, orderBy: { startedAt: "desc" }, take: 10 }),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Planejamento de produção</CardTitle>
          <CardDescription>Inicie lotes e acompanhe a finalização para baixa automática de insumos.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductionPlanner products={products} batches={batches} csrf={session.user.id} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Lotes recentes</CardTitle>
          <CardDescription>Resumo dos últimos lotes registrados.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {batches.map((batch) => (
              <li key={batch.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{batch.product.name}</span>
                  <span>{format(batch.startedAt, "dd/MM HH:mm", { locale: ptBR })}</span>
                </div>
                <p className="text-xs text-slate-500">Planejado: {batch.plannedUnits} • Produzido: {batch.actualUnits ?? "—"}</p>
                <p className="text-xs text-slate-500">Status: {batch.finishedAt ? "Finalizado" : "Em andamento"}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
