import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ReactNode } from "react";
import { Menu } from "@lucide/react";
import { ProtectedNav } from "@/components/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/orders", label: "Pedidos" },
  { href: "/production", label: "Produção" },
  { href: "/inventory", label: "Estoque" },
  { href: "/products", label: "Produtos" },
  { href: "/recipes", label: "Receitas" },
  { href: "/finance", label: "Financeiro" },
  { href: "/reports", label: "Relatórios" },
  { href: "/settings", label: "Configurações" },
];

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Menu className="h-5 w-5 text-brand" />
            <Link href="/" className="font-semibold text-lg lowercase tracking-wide text-brand">
              pao do mauro
            </Link>
          </div>
          <ProtectedNav userName={session.user.name ?? session.user.email} userRole={session.user.role as "admin" | "user"} navItems={navItems} />
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-1 flex-col gap-6 px-4 py-8">{children}</main>
    </div>
  );
}
