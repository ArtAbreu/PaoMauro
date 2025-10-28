import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WhatsAppOrderParams {
  customerName: string;
  orderId: string;
  dueDate?: Date;
  total: number;
  url?: string;
}

export function buildWhatsAppLink({ customerName, orderId, dueDate, total, url }: WhatsAppOrderParams) {
  const formattedDate = dueDate ? format(dueDate, "dd 'de' MMMM", { locale: ptBR }) : "";
  const message = [
    `Olá ${customerName}! Aqui é da padaria pao do mauro 🍞`,
    `Seu pedido #${orderId} está pronto!`,
    formattedDate ? `Data prevista: ${formattedDate}.` : undefined,
    `Total: R$ ${total.toFixed(2).replace('.', ',')}.`,
    url ? `Acompanhe detalhes: ${url}` : undefined,
    "Obrigado pela preferência!",
  ]
    .filter(Boolean)
    .join("%0A");

  return `https://wa.me/?text=${message}`;
}
