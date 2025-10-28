import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireAuth(role?: "admin" | "user") {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null as const, response: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  if (role && session.user.role !== role) {
    return { session: null as const, response: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
  }
  return { session } as const;
}
