"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "@lucide/react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
}

interface ProtectedNavProps {
  userName: string;
  userRole: "admin" | "user";
  navItems: NavItem[];
}

export function ProtectedNav({ userName, userRole, navItems }: ProtectedNavProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col text-sm">
          <span className="font-semibold">{userName}</span>
          <span className="text-xs text-slate-500">{userRole === "admin" ? "Administrador" : "Usuário"}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
      <nav className="flex flex-wrap gap-2 text-sm font-medium">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-4 py-2 transition hover:bg-brand/10",
                isActive ? "bg-brand text-white hover:bg-brand" : "text-slate-600 dark:text-slate-300"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
