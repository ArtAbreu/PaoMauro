import Decimal from "decimal.js";
import { prisma } from "./db";

export async function getAverageCost(ingredientId: string) {
  const movements = await prisma.inventoryMovement.findMany({
    where: { ingredientId, type: "IN" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  if (!movements.length) return new Decimal(0);
  const { totalQty, totalValue } = movements.reduce(
    (acc, movement) => {
      const unitCost = new Decimal(movement.unitCost ?? 0);
      const qty = new Decimal(movement.qty);
      return {
        totalQty: acc.totalQty.plus(qty),
        totalValue: acc.totalValue.plus(unitCost.times(qty)),
      };
    },
    { totalQty: new Decimal(0), totalValue: new Decimal(0) }
  );
  if (totalQty.equals(0)) return new Decimal(0);
  return totalValue.div(totalQty).toDecimalPlaces(4);
}

export async function calculateRecipeCost(productId: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { productId },
    include: { items: true },
  });
  if (!recipe) return { ingredientCost: new Decimal(0), overheadUnit: new Decimal(0) };
  const ingredientCost = await recipe.items.reduce(async (promise, item) => {
    const acc = await promise;
    const average = await getAverageCost(item.ingredientId);
    return acc.plus(average.times(item.qtyPerBatch.toNumber()));
  }, Promise.resolve(new Decimal(0)));

  const overhead = await prisma.overheadConfig.findFirst({
    orderBy: { periodEnd: "desc" },
  });
  const overheadUnit = overhead
    ? new Decimal(overhead.gasCost)
        .plus(overhead.energyCost)
        .plus(overhead.waterCost)
        .plus(overhead.packagingCost)
        .plus(overhead.otherCost)
        .div(overhead.unitsProduced || 1)
    : new Decimal(0);

  const perUnit = ingredientCost.div(recipe.yieldUnits || 1);
  return { ingredientCost: perUnit, overheadUnit };
}

export function suggestPrice(cost: Decimal, marginPercent: number) {
  const margin = new Decimal(marginPercent).div(100);
  return cost.times(margin.plus(1)).toDecimalPlaces(2);
}
