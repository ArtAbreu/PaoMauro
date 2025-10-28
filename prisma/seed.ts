import { PrismaClient, Role, SalesOrderStatus, SalesPaymentMethod, InventoryMovementType, CashbookType, PaymentMethod } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌾 Iniciando seed do sistema pao do mauro...");
  const password = randomUUID().replace(/-/g, "").slice(0, 12);
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@paodomauro.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@paodomauro.com",
      passwordHash,
      role: Role.admin,
      mustReset: true,
    },
  });

  console.log(`🔐 Senha inicial do admin (${admin.email}): ${password}`);

  const customers = await prisma.$transaction([
    prisma.customer.create({
      data: {
        name: "Padaria São João",
        phone: "+55 11 91234-5678",
        address: "Rua do Pão, 123 - Centro",
      },
    }),
    prisma.customer.create({
      data: {
        name: "Café Dona Maria",
        phone: "+55 11 99876-5432",
        address: "Av. Principal, 987 - Bairro Alto",
      },
    }),
    prisma.customer.create({
      data: {
        name: "Mercado do Zé",
        phone: "+55 11 90000-1111",
        address: "Rua das Flores, 45",
      },
    }),
  ]);

  const products = await prisma.$transaction([
    prisma.product.upsert({
      where: { name: "Pão Tradicional" },
      update: {},
      create: {
        name: "Pão Tradicional",
        category: "Padaria",
        unitPrice: 7.5,
      },
    }),
    prisma.product.upsert({
      where: { name: "Pão Integral" },
      update: {},
      create: {
        name: "Pão Integral",
        category: "Padaria",
        unitPrice: 9.5,
      },
    }),
    prisma.product.upsert({
      where: { name: "Pão de Queijo" },
      update: {},
      create: {
        name: "Pão de Queijo",
        category: "Salgados",
        unitPrice: 12.0,
      },
    }),
  ]);

  const [tradicional, integral, queijo] = products;

  const ingredients = await prisma.$transaction([
    prisma.ingredient.upsert({
      where: { name: "Farinha de Trigo" },
      update: { unitCost: 4.2 },
      create: {
        name: "Farinha de Trigo",
        unit: "kg",
        unitCost: 4.2,
        minStock: 10,
      },
    }),
    prisma.ingredient.upsert({
      where: { name: "Fermento Biológico" },
      update: { unitCost: 18.0 },
      create: {
        name: "Fermento Biológico",
        unit: "kg",
        unitCost: 18.0,
        minStock: 2,
      },
    }),
    prisma.ingredient.upsert({
      where: { name: "Queijo Meia Cura" },
      update: { unitCost: 32.0 },
      create: {
        name: "Queijo Meia Cura",
        unit: "kg",
        unitCost: 32.0,
        minStock: 3,
      },
    }),
    prisma.ingredient.upsert({
      where: { name: "Leite" },
      update: { unitCost: 3.6 },
      create: {
        name: "Leite",
        unit: "L",
        unitCost: 3.6,
        minStock: 20,
      },
    }),
    prisma.ingredient.upsert({
      where: { name: "Ovos" },
      update: { unitCost: 0.8 },
      create: {
        name: "Ovos",
        unit: "un",
        unitCost: 0.8,
        minStock: 60,
      },
    }),
  ]);

  const farinha = ingredients[0];
  const fermento = ingredients[1];
  const queijoIng = ingredients[2];
  const leite = ingredients[3];
  const ovos = ingredients[4];

  await prisma.recipe.upsert({
    where: { productId: tradicional.id },
    update: {},
    create: {
      productId: tradicional.id,
      yieldUnits: 200,
      notes: "Receita base do pão tradicional.",
      items: {
        create: [
          { ingredientId: farinha.id, qtyPerBatch: 15, unit: "kg" },
          { ingredientId: fermento.id, qtyPerBatch: 0.8, unit: "kg" },
          { ingredientId: leite.id, qtyPerBatch: 5, unit: "L" },
        ],
      },
    },
  });

  await prisma.recipe.upsert({
    where: { productId: integral.id },
    update: {},
    create: {
      productId: integral.id,
      yieldUnits: 180,
      notes: "Receita com farinha integral e mix de grãos.",
      items: {
        create: [
          { ingredientId: farinha.id, qtyPerBatch: 12, unit: "kg" },
          { ingredientId: fermento.id, qtyPerBatch: 0.7, unit: "kg" },
          { ingredientId: leite.id, qtyPerBatch: 4, unit: "L" },
        ],
      },
    },
  });

  await prisma.recipe.upsert({
    where: { productId: queijo.id },
    update: {},
    create: {
      productId: queijo.id,
      yieldUnits: 300,
      notes: "Receita tradicional de pão de queijo mineiro.",
      items: {
        create: [
          { ingredientId: queijoIng.id, qtyPerBatch: 12, unit: "kg" },
          { ingredientId: leite.id, qtyPerBatch: 6, unit: "L" },
          { ingredientId: ovos.id, qtyPerBatch: 200, unit: "un" },
        ],
      },
    },
  });

  const today = new Date();
  const batches = [] as Promise<any>[];
  for (let i = 1; i <= 5; i += 1) {
    const start = new Date(today);
    start.setDate(start.getDate() - i);
    batches.push(
      prisma.productionBatch.create({
        data: {
          productId: tradicional.id,
          plannedUnits: 200,
          actualUnits: 190 + (i % 3) * 5,
          startedAt: start,
          finishedAt: new Date(start.getTime() + 4 * 60 * 60 * 1000),
          notes: "Lote automático para demonstração",
        },
      })
    );
  }
  await Promise.all(batches);

  await prisma.overheadConfig.create({
    data: {
      periodStart: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      periodEnd: new Date(today.getFullYear(), today.getMonth(), 0),
      gasCost: 800,
      energyCost: 950,
      waterCost: 320,
      packagingCost: 450,
      otherCost: 200,
      unitsProduced: 4000,
    },
  });

  const order = await prisma.salesOrder.create({
    data: {
      customerId: customers[0].id,
      orderDate: today,
      dueDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
      status: SalesOrderStatus.PAID,
      paymentMethod: SalesPaymentMethod.PIX,
      totalGross: 1500,
      totalDiscount: 150,
      totalNet: 1350,
      items: {
        create: [
          {
            productId: tradicional.id,
            qty: 100,
            unitPrice: 7.5,
            total: 750,
          },
          {
            productId: queijo.id,
            qty: 50,
            unitPrice: 12,
            total: 600,
          },
        ],
      },
    },
  });

  await prisma.cashbook.create({
    data: {
      date: today,
      type: CashbookType.IN,
      description: `Recebimento do pedido ${order.id}`,
      amount: order.totalNet,
      paymentMethod: PaymentMethod.PIX,
      refTable: "SalesOrder",
      refId: order.id,
      orderId: order.id,
    },
  });

  await prisma.expense.create({
    data: {
      date: today,
      category: "Matéria-prima",
      description: "Compra de farinha de trigo",
      amount: 420,
      paymentMethod: PaymentMethod.BOLETO,
      cashbook: {
        create: {
          date: today,
          type: CashbookType.OUT,
          description: "Pagamento de fornecedores",
          amount: 420,
          paymentMethod: PaymentMethod.BOLETO,
          refTable: "Expense",
        },
      },
    },
  });

  await prisma.inventoryMovement.createMany({
    data: [
      {
        ingredientId: farinha.id,
        type: InventoryMovementType.IN,
        qty: 50,
        unitCost: 4.2,
        reason: "Compra inicial",
      },
      {
        ingredientId: leite.id,
        type: InventoryMovementType.IN,
        qty: 100,
        unitCost: 3.6,
        reason: "Estoque inicial",
      },
      {
        ingredientId: fermento.id,
        type: InventoryMovementType.IN,
        qty: 10,
        unitCost: 18,
        reason: "Estoque inicial",
      },
      {
        ingredientId: farinha.id,
        type: InventoryMovementType.OUT,
        qty: 5,
        unitCost: 4.2,
        reason: "Consumo produção",
      },
    ],
  });

  console.log("✅ Seed concluído com sucesso!");
}

main()
  .catch((err) => {
    console.error("❌ Erro ao executar seed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
