"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { queueCashClosing } from "@/lib/offline-db";

interface CashbookEntry {
  id: string;
  date: string;
  type: "IN" | "OUT";
  description: string;
  amount: any;
  paymentMethod: string;
}

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: any;
  paymentMethod: string;
}

interface Props {
  csrf: string;
  initialCashbook: CashbookEntry[];
  initialExpenses: Expense[];
}

export default function FinanceDashboard({ csrf, initialCashbook, initialExpenses }: Props) {
  const [cashbook, setCashbook] = useState(initialCashbook);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "Insumos",
    description: "",
    amount: "0",
    paymentMethod: "PIX",
  });
  const [closingDate, setClosingDate] = useState(new Date().toISOString().slice(0, 10));
  const totals = useMemo(() => {
    const base: Record<string, { in: number; out: number }> = {};
    for (const entry of cashbook) {
      const method = entry.paymentMethod ?? "OUTROS";
      if (!base[method]) base[method] = { in: 0, out: 0 };
      const amount = Number(entry.amount);
      if (entry.type === "IN") base[method].in += amount;
      else base[method].out += amount;
    }
    return base;
  }, [cashbook]);

  const submitExpense = async () => {
    const payload = {
      ...form,
      amount: Number(form.amount),
    };
    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      toast({ title: "Erro", description: error.error ?? "Falha ao registrar despesa", variant: "destructive" } as any);
      return;
    }
    const expense = await response.json();
    setExpenses((prev) => [expense, ...prev]);
    toast({ title: "Despesa registrada" });
  };

  const closeDay = async () => {
    const payload = { body: { date: closingDate }, csrf };
    const send = async () => {
      const response = await fetch("/api/finance/cash-close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify(payload.body),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? "Falha ao fechar caixa");
      }
      return response.json();
    };

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueCashClosing(payload);
        navigator.serviceWorker?.controller?.postMessage({ type: "SYNC_PENDING" });
        toast({ title: "Fechamento offline", description: "Será sincronizado quando a conexão retornar." });
        return;
      }
      const result = await send();
      toast({ title: "Caixa fechado", description: `Resumo gerado para ${closingDate}.` });
      setCashbook((prev) => [
        ...prev,
        ...result.totals.map((total: any) => ({
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          type: total.type,
          description: `Fechamento ${total.paymentMethod}`,
          amount: Number(total._sum?.amount ?? 0),
          paymentMethod: total.paymentMethod,
        })),
      ]);
    } catch (error) {
      toast({ title: "Erro", description: (error as Error).message, variant: "destructive" } as any);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(totals).map(([method, value]) => (
          <div key={method} className="rounded-lg border border-slate-200 p-4 shadow-sm">
            <p className="text-sm text-slate-500">{method}</p>
            <p className="text-lg font-semibold">Entradas: R$ {value.in.toFixed(2)}</p>
            <p className="text-sm">Saídas: R$ {value.out.toFixed(2)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-semibold">Registrar despesa</h3>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Método de pagamento</Label>
              <select className="w-full rounded-md border border-slate-300 p-2" value={form.paymentMethod} onChange={(event) => setForm((prev) => ({ ...prev, paymentMethod: event.target.value }))}>
                <option value="PIX">PIX</option>
                <option value="CASH">Dinheiro</option>
                <option value="CARD">Cartão</option>
                <option value="BOLETO">Boleto</option>
              </select>
            </div>
            <Button onClick={submitExpense}>Salvar despesa</Button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">Fechamento diário</h3>
          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={closingDate} onChange={(event) => setClosingDate(event.target.value)} />
          </div>
          <Button onClick={closeDay}>Fechar caixa</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold">Lançamentos recentes</h3>
          <div className="space-y-2">
            {cashbook.slice(0, 10).map((entry) => (
              <div key={entry.id} className="rounded border border-slate-200 p-3">
                <p className="text-xs text-slate-500">
                  {format(new Date(entry.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
                <p className="font-medium">{entry.description}</p>
                <p className="text-sm">{entry.type === "IN" ? "+" : "-"} R$ {Number(entry.amount).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-semibold">Despesas</h3>
          <div className="space-y-2">
            {expenses.slice(0, 10).map((expense) => (
              <div key={expense.id} className="rounded border border-slate-200 p-3">
                <p className="text-xs text-slate-500">{format(new Date(expense.date), "dd/MM/yyyy", { locale: ptBR })}</p>
                <p className="font-medium">{expense.category}</p>
                <p className="text-sm">R$ {Number(expense.amount).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
