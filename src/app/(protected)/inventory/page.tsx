import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Suspense } from "react";
import InventoryMovements from "@/components/inventory-movements";

async function getInventorySummary() {
  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  const movementGroups = await prisma.inventoryMovement.groupBy({
    by: ["ingredientId", "type"],
    _sum: { qty: true },
  });
  return ingredients.map((ingredient) => {
    const entries = movementGroups.filter((m) => m.ingredientId === ingredient.id);
    const qtyIn = entries
      .filter((m) => m.type === "IN")
      .reduce((acc, m) => acc + Number(m._sum.qty ?? 0), 0);
    const qtyOut = entries
      .filter((m) => m.type !== "IN")
      .reduce((acc, m) => acc + Number(m._sum.qty ?? 0), 0);
    const balance = qtyIn - qtyOut;
    const critical = balance < Number(ingredient.minStock);
    return { ingredient, balance, critical };
  });
}

export default async function InventoryPage() {
  const [summary, session] = await Promise.all([getInventorySummary(), getServerSession(authOptions)]);
  const csrf = session?.user?.id ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Estoque de ingredientes</h1>
          <p className="text-sm text-slate-500">
            Controle entradas, ajustes e consumos automáticos pela produção.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Nova entrada/ajuste</Button>
          </DialogTrigger>
          <DialogContent>
            <Suspense fallback={<p>Carregando...</p>}>
              <InventoryMovements csrf={csrf} />
            </Suspense>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Níveis de estoque</CardTitle>
          <CardDescription>Monitore ingredientes críticos e planeje compras.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="p-3">Ingrediente</th>
                  <th className="p-3">Saldo</th>
                  <th className="p-3">Mínimo</th>
                  <th className="p-3">Sugestão</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.map(({ ingredient, balance, critical }) => (
                  <tr key={ingredient.id} className="border-b border-slate-100">
                    <td className="p-3 font-medium">{ingredient.name}</td>
                    <td className="p-3">{balance.toFixed(2)} {ingredient.unit}</td>
                    <td className="p-3">{Number(ingredient.minStock).toFixed(2)}</td>
                    <td className="p-3 text-sm text-slate-500">
                      {critical
                        ? `Comprar ${(Number(ingredient.minStock) * 1.5 - balance).toFixed(2)} ${ingredient.unit}`
                        : "Estoque ok"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          critical ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                        }`}
                      >
                        {critical ? "Crítico" : "Saudável"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Suspense fallback={<p>Carregando movimentações...</p>}>
        <InventoryMovements showTable csrf={csrf} />
      </Suspense>
    </div>
  );
}
