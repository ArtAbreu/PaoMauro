import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { validateCsrf } from "@/lib/csrf";
import bcrypt from "bcryptjs";

interface Params {
  params: { id: string };
}

export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireAuth("admin");
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.role) {
    data.role = body.role === "admin" ? "admin" : "user";
  }
  if (body.password) {
    data.passwordHash = await bcrypt.hash(body.password, 12);
    data.mustReset = false;
  }
  if (body.mustReset !== undefined) {
    data.mustReset = Boolean(body.mustReset);
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
  });

  await prisma.auditLog.create({
    data: {
      userId: auth.session.user.id,
      action: "update",
      entity: "User",
      entityId: user.id,
      payloadJson: { id: user.id, role: user.role },
    },
  });

  return NextResponse.json({ id: user.id, email: user.email, role: user.role });
}
