"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Product {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  active: boolean;
  ingredientCost: number;
  overheadUnit: number;
  suggested: number;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
}

interface Props {
  products: Product[];
  ingredients: Ingredient[];
  csrf: string;
}

export default function ProductManager({ products: initialProducts, ingredients, csrf }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [form, setForm] = useState({ name: "", category: "", unitPrice: "" });
  const [productEditing, setProductEditing] = useState<Product | null>(null);
  const [isRecipeOpen, setRecipeOpen] = useState(false);
  const [recipeEditing, setRecipeEditing] = useState<Product | null>(null);
  const [recipeItems, setRecipeItems] = useState<{ ingredientId: string; qtyPerBatch: string; unit: string }[]>([]);
  const [yieldUnits, setYieldUnits] = useState("100");
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    if (!form.name || !form.category || !form.unitPrice) {
      toast({ title: "Preencha todos os campos", variant: "destructive" } as any);
      return;
    }
    const payload = {
      name: form.name,
      category: form.category,
      unitPrice: Number(form.unitPrice),
      active: true,
    };
    const response = await fetch("/api/products" + (productEditing ? `/${productEditing.id}` : ""), {
      method: productEditing ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      toast({ title: "Erro", description: error.error ?? "Falha ao salvar", variant: "destructive" } as any);
      return;
    }
    const product = await response.json();
    toast({ title: "Produto salvo" });
    setProducts((prev) => {
      const filtered = prev.filter((item) => item.id !== product.id);
      const enriched = {
        ...product,
        ingredientCost: productEditing?.ingredientCost ?? 0,
        overheadUnit: productEditing?.overheadUnit ?? 0,
        suggested: productEditing?.suggested ?? Number(product.unitPrice) * 1.4,
      };
      return [...filtered, enriched];
    });
    setForm({ name: "", category: "", unitPrice: "" });
    setProductEditing(null);
  };

  const openRecipeModal = (product: Product) => {
    setRecipeEditing(product);
    setRecipeItems([]);
    setRecipeOpen(true);
  };

  useEffect(() => {
    if (!isRecipeOpen || !recipeEditing) return;
    const fetchRecipe = async () => {
      const response = await fetch(`/api/recipes?productId=${recipeEditing.id}`);
      if (!response.ok) return;
      const recipe = await response.json();
      if (!recipe) return;
      setYieldUnits(String(recipe.yieldUnits ?? 100));
      setNotes(recipe.notes ?? "");
      setRecipeItems(
        recipe.items?.map((item: any) => ({
          ingredientId: item.ingredientId,
          qtyPerBatch: String(item.qtyPerBatch),
          unit: item.unit,
        })) ?? []
      );
    };
    fetchRecipe().catch(console.error);
  }, [isRecipeOpen, recipeEditing]);

  useEffect(() => {
    if (!isRecipeOpen) {
      setRecipeEditing(null);
      setRecipeItems([]);
    }
  }, [isRecipeOpen]);

  const startEdit = (product: Product) => {
    setProductEditing(product);
    setForm({ name: product.name, category: product.category, unitPrice: String(product.unitPrice) });
  };

  const addRecipeItem = () => {
    if (ingredients.length === 0) return;
    setRecipeItems((items) => [...items, { ingredientId: ingredients[0].id, qtyPerBatch: "1", unit: ingredients[0].unit }]);
  };

  const saveRecipe = async () => {
    if (!recipeEditing) return;
    const payload = {
      productId: recipeEditing.id,
      yieldUnits: Number(yieldUnits),
      notes,
      items: recipeItems.map((item) => ({
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
    setRecipeOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Input value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Preço</Label>
          <Input
            type="number"
            step="0.01"
            value={form.unitPrice}
            onChange={(event) => setForm((prev) => ({ ...prev, unitPrice: event.target.value }))}
          />
        </div>
        <div className="flex items-end">
          <Button className="w-full" onClick={handleSubmit}>
            {productEditing ? "Atualizar" : "Cadastrar"}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="p-2 text-left">Produto</th>
              <th className="p-2 text-left">Categoria</th>
              <th className="p-2 text-right">Preço atual</th>
              <th className="p-2 text-right">Custo ing.</th>
              <th className="p-2 text-right">Overhead</th>
              <th className="p-2 text-right">Preço sugerido</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {products
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((product) => (
                <tr key={product.id} className="border-b border-slate-100">
                  <td className="p-2 font-medium">{product.name}</td>
                  <td className="p-2">{product.category}</td>
                  <td className="p-2 text-right">R$ {Number(product.unitPrice).toFixed(2)}</td>
                  <td className="p-2 text-right">R$ {product.ingredientCost.toFixed(2)}</td>
                  <td className="p-2 text-right">R$ {product.overheadUnit.toFixed(2)}</td>
                  <td className="p-2 text-right">R$ {product.suggested.toFixed(2)}</td>
                  <td className="p-2 text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => startEdit(product)}>
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openRecipeModal(product)}>
                      Receita
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Dialog open={isRecipeOpen} onOpenChange={setRecipeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receita de {recipeEditing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Rendimento (unidades)</Label>
              <Input value={yieldUnits} onChange={(event) => setYieldUnits(event.target.value)} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ingredientes</Label>
                <Button type="button" size="sm" variant="outline" onClick={addRecipeItem}>
                  Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {recipeItems.map((item, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-3">
                    <select
                      className="rounded-md border border-slate-300 p-2"
                      value={item.ingredientId}
                      onChange={(event) =>
                        setRecipeItems((items) => {
                          const clone = [...items];
                          clone[index] = { ...clone[index], ingredientId: event.target.value };
                          return clone;
                        })
                      }
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
                      onChange={(event) =>
                        setRecipeItems((items) => {
                          const clone = [...items];
                          clone[index] = { ...clone[index], qtyPerBatch: event.target.value };
                          return clone;
                        })
                      }
                    />
                    <Input
                      value={item.unit}
                      onChange={(event) =>
                        setRecipeItems((items) => {
                          const clone = [...items];
                          clone[index] = { ...clone[index], unit: event.target.value };
                          return clone;
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveRecipe}>Salvar receita</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
