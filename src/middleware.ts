import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { createSecureHeaders } from "@/lib/security-headers";
import { rateLimitApi, rateLimitLogin } from "@/lib/rate-limit";

const LOGIN_PATH = "/login";

function getClientId(request: NextRequest) {
  return (
    request.ip ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  createSecureHeaders(nonce).forEach((header) => {
    response.headers.set(header.key, header.value);
  });

  if (pathname.startsWith("/api")) {
    const clientId = `${getClientId(request)}:${pathname}`;
    if (!rateLimitApi(clientId)) {
      return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
    }
  }

  if (pathname === LOGIN_PATH && request.method === "POST") {
    if (!rateLimitLogin(getClientId(request))) {
      return NextResponse.json({ error: "Muitas tentativas" }, { status: 429 });
    }
  }

  const isProtectedRoute =
    pathname.startsWith("/api") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/production") ||
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/recipes") ||
    pathname.startsWith("/finance") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings") ||
    pathname === "/";

  if (isProtectedRoute) {
    const token = await getToken({ req: request });
    if (!token) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
      }
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      url.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|manifest\\.webmanifest|app-icon|favicon|service-worker).*)"],
};
