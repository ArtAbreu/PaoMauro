import { prisma } from "@/lib/db";
import { calculateRecipeCost, suggestPrice } from "@/lib/cost";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ProductManager from "@/components/product-manager";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function getProducts() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
  const enriched = await Promise.all(
    products.map(async (product) => {
      const { ingredientCost, overheadUnit } = await calculateRecipeCost(product.id);
      const totalCost = ingredientCost.plus(overheadUnit);
      const suggested = suggestPrice(totalCost, 40).toNumber();
      return {
        ...product,
        ingredientCost: ingredientCost.toNumber(),
        overheadUnit: overheadUnit.toNumber(),
        suggested,
      };
    })
  );
  return enriched;
}

export default async function ProductsPage() {
  const [session, products, ingredients] = await Promise.all([
    getServerSession(authOptions),
    getProducts(),
    prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Produtos</h1>
        <p className="text-sm text-slate-500">
          Cadastre itens e visualize custos para manter margens saudáveis.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Catálogo</CardTitle>
          <CardDescription>Margem sugerida de 40% sobre custo completo.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductManager products={products} ingredients={ingredients} csrf={session?.user?.id ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
