"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { salesOrderSchema } from "@/lib/zod-schemas";

interface Props {
  orderId: string;
  currentStatus: string;
  paymentMethod?: string;
  csrf: string;
}

export function OrderStatusForm({ orderId, currentStatus, paymentMethod, csrf }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [payment, setPayment] = useState(paymentMethod ?? "");
  const [isSaving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ status, paymentMethod: payment || null }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? "Falha ao atualizar");
      }
      toast({ title: "Pedido atualizado" });
      router.refresh();
    } catch (error) {
      toast({ title: "Erro", description: (error as Error).message, variant: "destructive" } as any);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div className="space-y-2">
        <Label>Status</Label>
        <select
          className="w-full rounded-lg border border-slate-300 p-2"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {salesOrderSchema.shape.status.options.map((option) => (
            <option key={option} value={option}>
              {option.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Pagamento</Label>
        <select
          className="w-full rounded-lg border border-slate-300 p-2"
          value={payment}
          onChange={(event) => setPayment(event.target.value)}
        >
          <option value="">Pendente</option>
          <option value="PIX">PIX</option>
          <option value="CASH">Dinheiro</option>
          <option value="CARD">Cartão</option>
        </select>
      </div>
      <Button type="submit" disabled={isSaving} className="w-full">
        {isSaving ? "Atualizando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
