import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.session) return auth.response;

  const date = request.nextUrl.searchParams.get("date");
  const where = date
    ? {
        date: {
          gte: new Date(`${date}T00:00:00`),
          lte: new Date(`${date}T23:59:59`),
        },
      }
    : {};

  const entries = await prisma.cashbook.findMany({
    where,
    orderBy: { date: "desc" },
  });
  return NextResponse.json(entries);
}
