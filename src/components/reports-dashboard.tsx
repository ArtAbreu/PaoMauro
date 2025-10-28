"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface MonthlySales {
  month: string;
  total: number;
  discount: number;
}

interface MonthlyProfit {
  month: string;
  revenue: number;
  cogs: number;
  expenses: number;
  profit: number;
}

interface OrderItem {
  id: string;
  orderDate: string;
  status: string;
  paymentMethod: string | null;
  totalNet: number;
  items: { product: { name: string }; qty: number; total: number }[];
  customer?: { name: string } | null;
}

export default function ReportsDashboard() {
  const [sales, setSales] = useState<MonthlySales[]>([]);
  const [profit, setProfit] = useState<MonthlyProfit[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const maxSales = useMemo(() => Math.max(1, ...sales.map((item) => item.total)), [sales]);

  useEffect(() => {
    fetch("/api/reports/sales/monthly")
      .then((res) => res.json())
      .then((data) => setSales(data.sort((a: MonthlySales, b: MonthlySales) => a.month.localeCompare(b.month))))
      .catch(console.error);
    fetch("/api/reports/profit/monthly")
      .then((res) => res.json())
      .then((data) => setProfit(data.sort((a: MonthlyProfit, b: MonthlyProfit) => a.month.localeCompare(b.month))))
      .catch(console.error);
    fetch("/api/orders").then((res) => res.json()).then(setOrders).catch(console.error);
  }, []);

  const productTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items) {
        map.set(item.product.name, (map.get(item.product.name) ?? 0) + Number(item.total));
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [orders]);

  const paymentTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of orders) {
      const method = order.paymentMethod ?? "N/A";
      map.set(method, (map.get(method) ?? 0) + Number(order.totalNet));
    }
    return Array.from(map.entries());
  }, [orders]);

  const recurringCustomers = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of orders) {
      const name = order.customer?.name ?? "Consumidor";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries()).filter(([, count]) => count > 1);
  }, [orders]);

  const exportCsv = () => {
    const header = ["pedido", "data", "cliente", "produto", "quantidade", "total", "pagamento"];
    const rows = orders.flatMap((order) =>
      order.items.map((item) => [
        order.id,
        order.orderDate,
        order.customer?.name ?? "Consumidor",
        item.product.name,
        Number(item.qty),
        Number(item.total),
        order.paymentMethod ?? "-",
      ])
    );
    const csv = [header, ...rows]
      .map((columns) => columns.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "relatorio-vendas.csv";
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Resumo analítico</h2>
        <Button onClick={exportCsv}>Exportar CSV</Button>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold">Vendas mensais</h3>
          <div className="mt-4 space-y-2">
            {sales.map((item) => (
              <div key={item.month} className="flex items-center gap-3">
                <div className="w-24 text-sm text-slate-500">{item.month}</div>
                <div className="h-3 flex-1 rounded-full bg-slate-200">
                  <div
                    className="h-3 rounded-full bg-orange-500"
                    style={{ width: `${Math.min((item.total / maxSales) * 100, 100)}%` }}
                  />
                </div>
                <div className="w-24 text-right text-sm font-medium">R$ {item.total.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold">Lucro mensal</h3>
          <div className="mt-4 space-y-2">
            {profit.map((item) => (
              <div key={item.month} className="flex items-center justify-between text-sm">
                <span>{item.month}</span>
                <span className="font-semibold text-emerald-600">R$ {item.profit.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold">Top produtos</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {productTotals.map(([name, total]) => (
              <li key={name} className="flex items-center justify-between">
                <span>{name}</span>
                <span className="font-semibold">R$ {total.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold">Métodos de pagamento</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {paymentTotals.map(([method, total]) => (
              <li key={method} className="flex items-center justify-between">
                <span>{method}</span>
                <span className="font-semibold">R$ {total.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold">Clientes recorrentes</h3>
        {recurringCustomers.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Ainda não há clientes recorrentes suficientes.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {recurringCustomers.map(([name, count]) => (
              <li key={name} className="flex items-center justify-between">
                <span>{name}</span>
                <span>{count} pedidos</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
