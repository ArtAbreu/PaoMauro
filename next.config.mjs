import { createSecureHeaders } from "./src/lib/security-headers";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["https://pao-do-mauro.onrender.com", "http://localhost:3000"],
    },
  },
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: createSecureHeaders(),
      },
    ];
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
