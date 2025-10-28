import type { Metadata } from "next";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "pao do mauro — Sistema de Organização Empresarial",
  description: "Gestão integrada para padarias artesanais: vendas, produção, estoque e financeiro.",
  manifest: "/manifest.webmanifest",
  themeColor: "#F97316",
  icons: {
    icon: "/app-icon.svg",
  },
  metadataBase: new URL("https://pao-do-mauro.onrender.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = headers().get("x-nonce") ?? undefined;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={`script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ""};`} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen bg-slate-50 antialiased dark:bg-slate-950">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
