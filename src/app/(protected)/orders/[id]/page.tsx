import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { OrderStatusForm } from "@/components/order-status-form";

interface Params {
  params: { id: string };
}

export default async function OrderDetailPage({ params }: Params) {
  const session = await getServerSession(authOptions);
  const order = await prisma.salesOrder.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: { product: true },
      },
      customer: true,
    },
  });
  if (!order || !session?.user) {
    notFound();
  }

  const whatsappLink = new URL("https://wa.me/");
  whatsappLink.searchParams.set(
    "text",
    `Olá ${order.customer?.name ?? "cliente"}! Seu pedido #${order.id.slice(0, 8)} está em ${order.status.replace(/_/g, " ")}. Total: R$ ${Number(order.totalNet).toFixed(2)}.`
  );

  return (
    <div className="grid gap-6 md:grid-cols-[2fr,1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Pedido #{order.id.slice(0, 8)}</CardTitle>
          <CardDescription>
            {order.customer?.name ?? "Consumidor"} • {format(order.orderDate, "dd/MM/yyyy", { locale: ptBR })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold">Itens</h3>
            <ul className="space-y-2 text-sm">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between">
                  <span>
                    {item.product.name} — {Number(item.qty).toFixed(2)} un
                  </span>
                  <span>R$ {Number(item.total).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1 text-sm">
            <p>Total bruto: R$ {Number(order.totalGross).toFixed(2)}</p>
            <p>Desconto: R$ {Number(order.totalDiscount).toFixed(2)}</p>
            <p className="text-lg font-semibold">Total líquido: R$ {Number(order.totalNet).toFixed(2)}</p>
          </div>
          <a href={whatsappLink.toString()} target="_blank" className="text-sm text-brand">
            Enviar atualização via WhatsApp
          </a>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Status & ações</CardTitle>
          <CardDescription>Atualize o status e forma de pagamento.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrderStatusForm
            orderId={order.id}
            currentStatus={order.status}
            paymentMethod={order.paymentMethod ?? undefined}
            csrf={session.user.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
