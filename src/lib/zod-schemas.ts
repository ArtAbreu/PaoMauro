import { z } from "zod";

export const emailSchema = z.string().email("Informe um e-mail válido");

export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula")
  .regex(/[a-z]/, "Inclua ao menos uma letra minúscula")
  .regex(/[0-9]/, "Inclua ao menos um número");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8),
  token: z.string().optional(),
});

export const orderItemSchema = z.object({
  productId: z.string().uuid(),
  qty: z.coerce.number().min(0.1),
  unitPrice: z.coerce.number().min(0),
  total: z.coerce.number().min(0),
});

export const salesOrderSchema = z.object({
  customerId: z.string().uuid(),
  orderDate: z.string(),
  dueDate: z.string().optional(),
  status: z.enum(["OPEN", "CONFIRMED", "IN_PRODUCTION", "READY", "DELIVERED", "PAID", "CANCELLED"]),
  paymentMethod: z.enum(["PIX", "CASH", "CARD"]).optional(),
  items: z.array(orderItemSchema).min(1),
  totalGross: z.coerce.number().min(0),
  totalDiscount: z.coerce.number().min(0),
  totalNet: z.coerce.number().min(0),
});

export const productionBatchSchema = z.object({
  productId: z.string().uuid(),
  plannedUnits: z.coerce.number().int().min(1),
  actualUnits: z.coerce.number().int().min(0).optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  notes: z.string().optional(),
});

export const inventoryMovementSchema = z.object({
  ingredientId: z.string().uuid(),
  type: z.enum(["IN", "OUT", "ADJ"]),
  qty: z.coerce.number().positive(),
  unitCost: z.coerce.number().min(0).optional(),
  reason: z.string().min(3),
});

export const expenseSchema = z.object({
  date: z.string(),
  category: z.string().min(2),
  description: z.string().min(3),
  amount: z.coerce.number().min(0),
  paymentMethod: z.enum(["PIX", "CASH", "CARD", "BOLETO"]),
});

export const productSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  unitPrice: z.coerce.number().min(0),
  active: z.boolean().default(true),
});

export const ingredientSchema = z.object({
  name: z.string().min(2),
  unit: z.string().min(1),
  unitCost: z.coerce.number().min(0),
  minStock: z.coerce.number().min(0),
});

export const recipeSchema = z.object({
  productId: z.string().uuid(),
  yieldUnits: z.coerce.number().int().min(1),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        qtyPerBatch: z.coerce.number().min(0.001),
        unit: z.string().min(1),
      })
    )
    .min(1),
});

export const overheadSchema = z.object({
  gasCost: z.coerce.number().min(0),
  energyCost: z.coerce.number().min(0),
  waterCost: z.coerce.number().min(0),
  packagingCost: z.coerce.number().min(0),
  otherCost: z.coerce.number().min(0).default(0),
  unitsProduced: z.coerce.number().int().min(1),
});
