import { NextResponse } from "next/server";

export function validateCsrf(request: Request, token: string) {
  const header = request.headers.get("x-csrf-token");
  if (!header || header !== token) {
    return NextResponse.json({ error: "Falha de CSRF" }, { status: 419 });
  }
  return null;
}
