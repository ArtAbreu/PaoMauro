"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

interface Ingredient {
  id: string;
  name: string;
  unit: string;
}

interface RecipeItem {
  ingredientId: string;
  qtyPerBatch: number;
  unit: string;
}

interface Recipe {
  productId: string;
  productName: string;
  yieldUnits: number;
  notes?: string;
  items: RecipeItem[];
}

interface Props {
  recipes: Recipe[];
  ingredients: Ingredient[];
  csrf: string;
}

export default function RecipeManager({ recipes, ingredients, csrf }: Props) {
  const [editing, setEditing] = useState<Recipe | null>(recipes[0] ?? null);
  const [form, setForm] = useState(() =>
    editing
      ? {
          yieldUnits: editing.yieldUnits.toString(),
          notes: editing.notes ?? "",
          items: editing.items.map((item) => ({
            ingredientId: item.ingredientId,
            qtyPerBatch: item.qtyPerBatch.toString(),
            unit: item.unit,
          })),
        }
      : { yieldUnits: "100", notes: "", items: [] }
  );

  const selectRecipe = (recipe: Recipe) => {
    setEditing(recipe);
    setForm({
      yieldUnits: recipe.yieldUnits.toString(),
      notes: recipe.notes ?? "",
      items: recipe.items.map((item) => ({
        ingredientId: item.ingredientId,
        qtyPerBatch: item.qtyPerBatch.toString(),
        unit: item.unit,
      })),
    });
  };

  const updateItem = (index: number, key: "ingredientId" | "qtyPerBatch" | "unit", value: string) => {
    setForm((prev) => {
      const clone = [...prev.items];
      clone[index] = { ...clone[index], [key]: value };
      return { ...prev, items: clone };
    });
  };

  const addItem = () => {
    if (ingredients.length === 0) return;
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ingredientId: ingredients[0].id,
          qtyPerBatch: "1",
          unit: ingredients[0].unit,
        },
      ],
    }));
  };

  const saveRecipe = async () => {
    if (!editing) return;
    const payload = {
      productId: editing.productId,
      yieldUnits: Number(form.yieldUnits),
      notes: form.notes,
      items: form.items.map((item) => ({
        ingredientId: item.ingredientId,
        qtyPerBatch: Number(item.qtyPerBatch),
        unit: item.unit,
      })),
    };
    const response = await fetch("/api/recipes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      toast({ title: "Erro", description: error.error ?? "Falha ao salvar receita", variant: "destructive" } as any);
      return;
    }
    toast({ title: "Receita atualizada" });
  };

  return (
    <div className="grid gap-6 md:grid-cols-[240px,1fr]">
      <aside className="space-y-2">
        <h3 className="text-sm font-semibold">Produtos</h3>
        <ul className="space-y-2 text-sm">
          {recipes.map((recipe) => (
            <li key={recipe.productId}>
              <button
                type="button"
                onClick={() => selectRecipe(recipe)}
                className={`w-full rounded px-3 py-2 text-left transition ${
                  editing?.productId === recipe.productId
                    ? "bg-orange-100 text-orange-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {recipe.productName}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {editing ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{editing.productName}</h2>
            <p className="text-sm text-slate-500">Defina o rendimento e os ingredientes por batelada.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Rendimento (unidades)</Label>
              <Input
                type="number"
                value={form.yieldUnits}
                min="1"
                onChange={(event) => setForm((prev) => ({ ...prev, yieldUnits: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Ingredientes</h3>
              <Button variant="outline" size="sm" onClick={addItem}>
                Adicionar item
              </Button>
            </div>
            {form.items.length === 0 && <p className="text-sm text-slate-500">Nenhum ingrediente cadastrado.</p>}
            <div className="space-y-2">
              {form.items.map((item, index) => (
                <div key={`${item.ingredientId}-${index}`} className="grid gap-2 md:grid-cols-3">
                  <select
                    className="rounded border border-slate-300 p-2"
                    value={item.ingredientId}
                    onChange={(event) => updateItem(index, "ingredientId", event.target.value)}
                  >
                    {ingredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    step="0.001"
                    value={item.qtyPerBatch}
                    onChange={(event) => updateItem(index, "qtyPerBatch", event.target.value)}
                  />
                  <Input
                    value={item.unit}
                    onChange={(event) => updateItem(index, "unit", event.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
          <Button onClick={saveRecipe}>Salvar receita</Button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Selecione um produto para editar sua receita.</p>
      )}
    </div>
  );
}
