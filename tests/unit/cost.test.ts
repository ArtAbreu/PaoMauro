import { describe, expect, it, beforeEach, vi } from "vitest";
import Decimal from "decimal.js";

vi.mock("@/lib/db", () => {
  return {
    prisma: {
      inventoryMovement: {
        findMany: vi.fn(),
      },
      recipe: {
        findUnique: vi.fn(),
      },
      overheadConfig: {
        findFirst: vi.fn(),
      },
    },
  };
});

const prisma = require("@/lib/db").prisma;
const { getAverageCost, calculateRecipeCost, suggestPrice } = require("@/lib/cost");

describe("cost helpers", () => {
  beforeEach(() => {
    prisma.inventoryMovement.findMany.mockReset();
    prisma.recipe.findUnique.mockReset();
    prisma.overheadConfig.findFirst.mockReset();
  });

  it("computes weighted average cost", async () => {
    prisma.inventoryMovement.findMany.mockResolvedValue([
      { unitCost: 4, qty: 10 },
      { unitCost: 6, qty: 5 },
    ]);
    const cost = await getAverageCost("ingredient-1");
    expect(cost.toNumber()).toBeCloseTo(4.67, 2);
  });

  it("returns zero when no movements", async () => {
    prisma.inventoryMovement.findMany.mockResolvedValue([]);
    const cost = await getAverageCost("ingredient-1");
    expect(cost.toNumber()).toBe(0);
  });

  it("calculates recipe cost per unit including overhead", async () => {
    prisma.recipe.findUnique.mockResolvedValue({
      yieldUnits: 100,
      items: [
        { ingredientId: "ing-1", qtyPerBatch: { toNumber: () => 10 } },
      ],
    });
    prisma.inventoryMovement.findMany.mockResolvedValue([{ unitCost: 2, qty: 10 }]);
    prisma.overheadConfig.findFirst.mockResolvedValue({
      gasCost: 100,
      energyCost: 50,
      waterCost: 25,
      packagingCost: 25,
      otherCost: 0,
      unitsProduced: 100,
    });

    const { ingredientCost, overheadUnit } = await calculateRecipeCost("product-1");
    expect(ingredientCost.toNumber()).toBeCloseTo(0.2, 2);
    expect(overheadUnit.toNumber()).toBeCloseTo(2, 2);
  });

  it("suggests price based on margin", () => {
    const cost = new Decimal(100);
    const price = suggestPrice(cost, 40);
    expect(price.toNumber()).toBeCloseTo(140, 2);
  });
});
