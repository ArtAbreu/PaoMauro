import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderForm } from "@/components/order-form";

export default async function NewOrderPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo pedido</CardTitle>
        <CardDescription>Cadastre um pedido e acompanhe a produção.</CardDescription>
      </CardHeader>
      <CardContent>
        <OrderForm customers={customers} products={products} csrf={session.user.id} />
      </CardContent>
    </Card>
  );
}
