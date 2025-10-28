import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { validateCsrf } from "@/lib/csrf";
import { overheadSchema } from "@/lib/zod-schemas";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const overhead = await prisma.overheadConfig.findFirst({ orderBy: { periodEnd: "desc" } });
  return NextResponse.json(overhead);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("admin");
  if (!auth.session) return auth.response;

  const csrf = validateCsrf(request, auth.session.user.id);
  if (csrf) return csrf;

  const json = await request.json();
  const parsed = overheadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  const record = await prisma.overheadConfig.create({
    data: {
      periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
      periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      ...parsed.data,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: auth.session.user.id,
      action: "create",
      entity: "OverheadConfig",
      entityId: record.id,
      payloadJson: record,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
