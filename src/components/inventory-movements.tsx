"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { inventoryMovementSchema } from "@/lib/zod-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

interface Props {
  showTable?: boolean;
  csrf: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function InventoryMovements({ showTable, csrf }: Props) {
  const { data: ingredients } = useSWR("/api/ingredients", fetcher);
  const { data: movements, mutate } = useSWR(showTable ? "/api/inventory/movements" : null, fetcher);
  const [isSubmitting, setSubmitting] = useState(false);
  const form = useForm({
    resolver: zodResolver(inventoryMovementSchema),
    defaultValues: {
      ingredientId: "",
      type: "IN" as "IN" | "OUT" | "ADJ",
      qty: 0,
      unitCost: 0,
      reason: "",
    },
  });

  const firstIngredient = ingredients?.[0]?.id;

  useEffect(() => {
    const current = form.getValues("ingredientId");
    if (!current && firstIngredient) {
      form.setValue("ingredientId", firstIngredient);
    }
  }, [firstIngredient, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/inventory/movements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ ...values, qty: Number(values.qty), unitCost: Number(values.unitCost) }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? "Falha ao registrar");
      }
      toast({ title: "Movimentação registrada" });
      if (mutate) {
        await mutate();
      }
      form.reset();
    } catch (error) {
      toast({ title: "Erro", description: (error as Error).message, variant: "destructive" } as any);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="space-y-6">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ingredientId">Ingrediente</Label>
            <select id="ingredientId" className="w-full rounded-md border border-slate-300 p-2" {...form.register("ingredientId")}>
              <option value="">Selecione...</option>
              {ingredients?.map((ingredient: any) => (
                <option key={ingredient.id} value={ingredient.id}>
                  {ingredient.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <select id="type" className="w-full rounded-md border border-slate-300 p-2" {...form.register("type")}>
              <option value="IN">Entrada</option>
              <option value="OUT">Saída</option>
              <option value="ADJ">Ajuste</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qty">Quantidade</Label>
            <Input id="qty" type="number" step="0.001" {...form.register("qty", { valueAsNumber: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unitCost">Custo unitário</Label>
            <Input
              id="unitCost"
              type="number"
              step="0.0001"
              disabled={form.watch("type") !== "IN"}
              {...form.register("unitCost", { valueAsNumber: true })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason">Motivo</Label>
          <Input id="reason" {...form.register("reason") } />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Registrando..." : "Salvar"}
        </Button>
      </form>

      {showTable && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Ingrediente</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-right">Quantidade</th>
                <th className="p-2 text-right">Custo unitário</th>
                <th className="p-2 text-left">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {movements?.map((movement: any) => (
                <tr key={movement.id} className="border-b border-slate-100">
                  <td className="p-2">{new Date(movement.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="p-2">{movement.ingredient.name}</td>
                  <td className="p-2">{movement.type}</td>
                  <td className="p-2 text-right">{Number(movement.qty).toFixed(3)}</td>
                  <td className="p-2 text-right">
                    {movement.unitCost ? `R$ ${Number(movement.unitCost).toFixed(2)}` : "-"}
                  </td>
                  <td className="p-2">{movement.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
