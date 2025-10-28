import { prisma } from "@/lib/db";
import RecipeManager from "@/components/recipe-manager";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function RecipesPage() {
  const [session, recipes, ingredients] = await Promise.all([
    getServerSession(authOptions),
    prisma.recipe.findMany({
      include: {
        items: true,
        product: true,
      },
      orderBy: { product: { name: "asc" } },
    }),
    prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
  ]);

  const mapped = recipes.map((recipe) => ({
    productId: recipe.productId,
    productName: recipe.product.name,
    yieldUnits: recipe.yieldUnits,
    notes: recipe.notes ?? undefined,
    items: recipe.items.map((item) => ({
      ingredientId: item.ingredientId,
      qtyPerBatch: Number(item.qtyPerBatch),
      unit: item.unit,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Receitas</h1>
        <p className="text-sm text-slate-500">Mantenha a ficha técnica dos produtos sempre atualizada.</p>
      </div>
      <RecipeManager recipes={mapped} ingredients={ingredients} csrf={session?.user?.id ?? ""} />
    </div>
  );
}
