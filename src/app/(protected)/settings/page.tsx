import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SettingsPanel from "@/components/settings-panel";

export default async function SettingsPage() {
  const [session, overhead, users] = await Promise.all([
    getServerSession(authOptions),
    prisma.overheadConfig.findFirst({ orderBy: { periodEnd: "desc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-slate-500">
          Ajuste sobrecarga de custos, gerencie usuários e configure integrações.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Painel administrativo</CardTitle>
          <CardDescription>Somente administradores podem alterar essas informações.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsPanel
            csrf={session?.user?.id ?? ""}
            overhead={overhead}
            users={users.map(({ passwordHash, ...user }) => user)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
