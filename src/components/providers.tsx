"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { PropsWithChildren, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { flushCashClosings, flushOrders } from "@/lib/offline-db";
import { toast } from "@/components/ui/use-toast";

export function Providers({ children }: PropsWithChildren) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .catch((error) => console.error("SW registration failed", error));
    }

    const syncPending = async () => {
      try {
        await flushOrders(async (payload) => {
          await fetch("/api/orders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": (payload as any)["csrf"],
            },
            body: JSON.stringify((payload as any)["body"] ?? {}),
          });
        });
        await flushCashClosings(async (payload) => {
          await fetch("/api/finance/cash-close", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": (payload as any)["csrf"],
            },
            body: JSON.stringify((payload as any)["body"] ?? {}),
          });
        });
        toast({ title: "Sincronização concluída", description: "Dados offline enviados com sucesso." });
      } catch (error) {
        console.error(error);
      }
    };

    const handler = () => {
      if (navigator.onLine) {
        syncPending();
      }
    };

    window.addEventListener("online", handler);

    navigator.serviceWorker?.addEventListener("message", (event) => {
      if (event.data?.type === "REQUEST_SYNC") {
        syncPending();
      }
    });

    if (navigator.onLine) {
      syncPending();
    }

    return () => {
      window.removeEventListener("online", handler);
    };
  }, []);

  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <Toaster />
      </ThemeProvider>
    </SessionProvider>
  );
}
