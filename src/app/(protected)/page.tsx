import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, eachDayOfInterval, format, startOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

async function getDashboardData() {
  const today = startOfDay(new Date());
  const yesterday = subDays(today, 1);

  const [ordersToday, productionToday, cashToday, cashYesterday, ingredients] = await Promise.all([
    prisma.salesOrder.count({
      where: {
        orderDate: {
          gte: today,
        },
      },
    }),
    prisma.productionBatch.count({
      where: {
        startedAt: { gte: today },
      },
    }),
    prisma.cashbook.aggregate({
      _sum: { amount: true },
      where: { date: { gte: today, lt: addDays(today, 1) } },
    }),
    prisma.cashbook.aggregate({
      _sum: { amount: true },
      where: { date: { gte: yesterday, lt: today } },
    }),
    prisma.ingredient.findMany({ take: 5, orderBy: { createdAt: "asc" } }),
  ]);

  const stock = await Promise.all(
    ingredients.map(async (ingredient) => {
      const movements = await prisma.inventoryMovement.findMany({
        where: { ingredientId: ingredient.id },
      });
      const balance = movements.reduce((acc, movement) => {
        return acc + (movement.type === "IN" ? Number(movement.qty) : -Number(movement.qty));
      }, 0);
      return {
        id: ingredient.id,
        name: ingredient.name,
        minStock: Number(ingredient.minStock),
        balance,
      };
    })
  );

  const critical = stock.filter((item) => item.balance < item.minStock);

  const startWeek = subDays(today, 6);
  const orders = await prisma.salesOrder.findMany({
    where: { orderDate: { gte: startWeek } },
    orderBy: { orderDate: "asc" },
  });

  const perDay = new Map<string, number>();
  for (const order of orders) {
    const key = format(order.orderDate, "yyyy-MM-dd");
    perDay.set(key, (perDay.get(key) ?? 0) + Number(order.totalNet));
  }

  const series = eachDayOfInterval({ start: startWeek, end: today }).map((date) => {
    const key = format(date, "yyyy-MM-dd");
    return { date, total: perDay.get(key) ?? 0 };
  });

  return {
    ordersToday,
    productionToday,
    cashToday: Number(cashToday._sum.amount ?? 0),
    cashYesterday: Number(cashYesterday._sum.amount ?? 0),
    critical,
    series,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Pedidos do dia" value={data.ordersToday} description="Total de pedidos registrados hoje" />
        <StatCard title="Lotes em produção" value={data.productionToday} description="Lotes iniciados hoje" />
        <StatCard title="Caixa de hoje" value={`R$ ${data.cashToday.toFixed(2)}`} description="Entradas - saídas" />
        <StatCard title="Caixa de ontem" value={`R$ ${data.cashYesterday.toFixed(2)}`} description="Comparativo do dia anterior" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Vendas nos últimos 7 dias</CardTitle>
            <CardDescription>Valores líquidos por dia</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              {data.series.map((point) => (
                <div key={point.date.toISOString()} className="flex-1">
                  <div
                    className="rounded-t-lg bg-brand"
                    style={{ height: `${Math.min(100, point.total / 10)}px` }}
                    aria-hidden
                  />
                  <div className="mt-2 text-center text-xs text-slate-500">
                    {format(point.date, "dd/MM", { locale: ptBR })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Estoque crítico</CardTitle>
            <CardDescription>Ingredientes abaixo do mínimo</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {data.critical.length === 0 && <li className="text-slate-500">Tudo em ordem 👌</li>}
              {data.critical.map((item) => (
                <li key={item.id} className="flex items-center justify-between">
                  <span>{item.name}</span>
                  <span className="text-red-600">{item.balance.toFixed(2)} / {item.minStock.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, description }: { title: string; value: string | number; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
