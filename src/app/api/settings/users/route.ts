import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { validateCsrf } from "@/lib/csrf";
import { passwordSchema } from "@/lib/zod-schemas";
import bcrypt from "bcryptjs";

export async function GET() {
  const auth = await requireAuth("admin");
  if (!auth.session) return auth.response;

  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(users.map(({ passwordHash, ...user }) => user));
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("admin");
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  const json = await request.json();
  const passwordValidation = passwordSchema.safeParse(json.password ?? "");
  if (!passwordValidation.success) {
    return NextResponse.json({ error: passwordValidation.error.flatten() }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(json.password, 12);
  const user = await prisma.user.create({
    data: {
      name: json.name,
      email: json.email,
      role: json.role === "admin" ? "admin" : "user",
      passwordHash,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: auth.session.user.id,
      action: "create",
      entity: "User",
      entityId: user.id,
      payloadJson: { id: user.id, email: user.email, role: user.role },
    },
  });

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role }, { status: 201 });
}
