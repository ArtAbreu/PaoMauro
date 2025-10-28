"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

interface Product {
  id: string;
  name: string;
}

interface Batch {
  id: string;
  product: Product;
  plannedUnits: number;
  actualUnits: number | null;
  finishedAt: Date | null;
}

interface Props {
  products: Product[];
  batches: Batch[];
  csrf: string;
}

export function ProductionPlanner({ products, batches, csrf }: Props) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [plannedUnits, setPlannedUnits] = useState(200);
  const [isLoading, setLoading] = useState(false);

  async function createBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/production/batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ productId, plannedUnits }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? "Erro ao iniciar lote");
      }
      toast({ title: "Lote criado", description: "Acompanhe a produção na lista ao lado." });
      router.refresh();
    } catch (error) {
      toast({ title: "Erro", description: (error as Error).message, variant: "destructive" } as any);
    } finally {
      setLoading(false);
    }
  }

  async function finishBatch(batchId: string, actualUnits: number) {
    setLoading(true);
    try {
      const response = await fetch(`/api/production/batches/${batchId}/finish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ actualUnits }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? "Erro ao finalizar lote");
      }
      toast({ title: "Lote finalizado", description: "Baixa de insumos realizada." });
      router.refresh();
    } catch (error) {
      toast({ title: "Erro", description: (error as Error).message, variant: "destructive" } as any);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createBatch} className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-2">
          <Label>Produto</Label>
          <select
            className="w-full rounded-lg border border-slate-300 p-2"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Quantidade planejada</Label>
          <Input
            type="number"
            min="1"
            value={plannedUnits}
            onChange={(event) => setPlannedUnits(Number(event.target.value))}
          />
        </div>
        <Button type="submit" disabled={isLoading || !productId} className="md:col-span-3">
          {isLoading ? "Processando..." : "Iniciar lote"}
        </Button>
      </form>
      <div className="space-y-3">
        <h3 className="font-semibold">Lotes em andamento</h3>
        {batches.filter((batch) => !batch.finishedAt).length === 0 && (
          <p className="text-sm text-slate-500">Nenhum lote aberto.</p>
        )}
        {batches
          .filter((batch) => !batch.finishedAt)
          .map((batch) => (
            <FinishBatchRow key={batch.id} batch={batch} onFinish={finishBatch} disabled={isLoading} />
          ))}
      </div>
    </div>
  );
}

function FinishBatchRow({
  batch,
  onFinish,
  disabled,
}: {
  batch: Batch;
  onFinish: (id: string, actual: number) => void;
  disabled: boolean;
}) {
  const [actualUnits, setActualUnits] = useState(batch.plannedUnits);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm">
      <div className="flex-1">
        <p className="font-semibold">{batch.product.name}</p>
        <p className="text-xs text-slate-500">Planejado: {batch.plannedUnits}</p>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs">Produzido</Label>
        <Input
          type="number"
          min="0"
          value={actualUnits}
          onChange={(event) => setActualUnits(Number(event.target.value))}
          className="w-24"
        />
      </div>
      <Button onClick={() => onFinish(batch.id, actualUnits)} disabled={disabled}>
        Finalizar
      </Button>
    </div>
  );
}
