import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function OrdersPage() {
  const orders = await prisma.salesOrder.findMany({
    include: {
      customer: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos</h1>
          <p className="text-sm text-slate-500">Gerencie pedidos da padaria e acompanhe o pipeline.</p>
        </div>
        <Button asChild>
          <Link href="/orders/new">Novo pedido</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lista de pedidos</CardTitle>
          <CardDescription>Atualize o status conforme o fluxo de produção e entrega.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="p-3">#</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Total</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="p-3 font-mono text-xs">{order.id.slice(0, 8)}</td>
                    <td className="p-3">{order.customer?.name ?? "Consumidor"}</td>
                    <td className="p-3">{format(order.orderDate, "dd/MM/yyyy", { locale: ptBR })}</td>
                    <td className="p-3 capitalize">{order.status.toLowerCase().replace(/_/g, " ")}</td>
                    <td className="p-3 font-semibold">R$ {Number(order.totalNet).toFixed(2)}</td>
                    <td className="p-3 text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/orders/${order.id}`}>Detalhes</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
