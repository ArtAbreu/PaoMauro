"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { salesOrderSchema } from "@/lib/zod-schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
import { queueOrder } from "@/lib/offline-db";

interface Customer {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  unitPrice: any;
}

interface OrderFormProps {
  customers: Customer[];
  products: Product[];
  csrf: string;
}

const defaultValues: z.infer<typeof salesOrderSchema> = {
  customerId: "",
  orderDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  status: "OPEN",
  paymentMethod: undefined,
  items: [],
  totalGross: 0,
  totalDiscount: 0,
  totalNet: 0,
};

export function OrderForm({ customers, products, csrf }: OrderFormProps) {
  const router = useRouter();
  const [isSubmitting, setSubmitting] = useState(false);
  const form = useForm<z.infer<typeof salesOrderSchema>>({
    resolver: zodResolver(salesOrderSchema),
    defaultValues,
  });
  const items = useFieldArray({ control: form.control, name: "items" });

  const addItem = () => {
    const product = products[0];
    if (!product) return;
    items.append({ productId: product.id, qty: 1, unitPrice: Number(product.unitPrice), total: Number(product.unitPrice) });
    recalcTotals();
  };

  const recalcTotals = () => {
    const values = form.getValues();
    const gross = values.items.reduce((acc, item) => acc + Number(item.total || 0), 0);
    const net = gross - Number(values.totalDiscount || 0);
    form.setValue("totalGross", gross);
    form.setValue("totalNet", net);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const body = {
        ...values,
        items: values.items.map((item) => ({
          ...item,
          qty: Number(item.qty),
          unitPrice: Number(item.unitPrice),
          total: Number(item.total),
        })),
        totalGross: Number(values.totalGross),
        totalDiscount: Number(values.totalDiscount),
        totalNet: Number(values.totalNet),
      };
      const payload = { body, csrf };

      const submitOnline = async () => {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrf,
          },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error ?? "Falha ao criar pedido");
        }
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueOrder(payload);
        navigator.serviceWorker?.controller?.postMessage({ type: "SYNC_PENDING" });
        toast({
          title: "Pedido salvo offline",
          description: "Assim que a conexão voltar enviaremos automaticamente.",
        });
      } else {
        await submitOnline();
        toast({ title: "Pedido criado", description: "O pipeline foi atualizado." });
      }

      router.push("/orders");
      router.refresh();
    } catch (error) {
      toast({ title: "Erro", description: (error as Error).message, variant: "destructive" } as any);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Cliente</Label>
          <select className="w-full rounded-lg border border-slate-300 p-2" {...form.register("customerId")}>
            <option value="">Selecione</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Data do pedido</Label>
          <Input type="date" {...form.register("orderDate")} />
        </div>
        <div className="space-y-2">
          <Label>Entrega prevista</Label>
          <Input type="date" {...form.register("dueDate")} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <select className="w-full rounded-lg border border-slate-300 p-2" {...form.register("status")}>
            {salesOrderSchema.shape.status.options.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Itens</h3>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            Adicionar item
          </Button>
        </div>
        <div className="space-y-3">
          {items.fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-5">
              <div className="md:col-span-2">
                <Label className="text-xs">Produto</Label>
                <select
                  className="w-full rounded-lg border border-slate-300 p-2"
                  {...form.register(`items.${index}.productId` as const, { onChange: recalcTotals })}
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Qtd.</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  {...form.register(`items.${index}.qty` as const, {
                    valueAsNumber: true,
                    onChange: (event) => {
                      const qty = Number(event.target.value);
                      const price = form.getValues(`items.${index}.unitPrice` as const);
                      form.setValue(`items.${index}.total` as const, qty * Number(price));
                      recalcTotals();
                    },
                  })}
                />
              </div>
              <div>
                <Label className="text-xs">Preço unit.</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register(`items.${index}.unitPrice` as const, {
                    valueAsNumber: true,
                    onChange: (event) => {
                      const value = Number(event.target.value);
                      const qty = form.getValues(`items.${index}.qty` as const);
                      form.setValue(`items.${index}.total` as const, value * Number(qty));
                      recalcTotals();
                    },
                  })}
                />
              </div>
              <div>
                <Label className="text-xs">Total</Label>
                <Input
                  type="number"
                  step="0.01"
                  readOnly
                  {...form.register(`items.${index}.total` as const, { valueAsNumber: true })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                className="self-end text-red-500"
                onClick={() => {
                  items.remove(index);
                  recalcTotals();
                }}
              >
                Remover
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Desconto</Label>
          <Input
            type="number"
            step="0.01"
            {...form.register("totalDiscount", {
              valueAsNumber: true,
              onChange: recalcTotals,
            })}
          />
        </div>
        <div className="space-y-2">
          <Label>Total bruto</Label>
          <Input type="number" step="0.01" readOnly {...form.register("totalGross", { valueAsNumber: true })} />
        </div>
        <div className="space-y-2">
          <Label>Total líquido</Label>
          <Input type="number" step="0.01" readOnly {...form.register("totalNet", { valueAsNumber: true })} />
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting || items.fields.length === 0}>
        {isSubmitting ? "Salvando..." : "Salvar pedido"}
      </Button>
    </form>
  );
}
