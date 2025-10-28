export function createSecureHeaders(nonce?: string) {
  const policies = ["default-src 'self'"];
  if (nonce) {
    policies.push(`script-src 'self' 'nonce-${nonce}'`);
  } else {
    policies.push("script-src 'self'");
  }
  policies.push("style-src 'self' 'unsafe-inline'");
  policies.push("img-src 'self' data:");
  policies.push("font-src 'self' data:");
  policies.push("connect-src 'self' https://pao-do-mauro.onrender.com");
  policies.push("frame-ancestors 'none'");
  policies.push("base-uri 'self'");
  policies.push("form-action 'self'");

  const headers = [
    {
      key: "Content-Security-Policy",
      value: policies.join("; "),
    },
    {
      key: "Referrer-Policy",
      value: "no-referrer",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];

  if (process.env.NODE_ENV === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
