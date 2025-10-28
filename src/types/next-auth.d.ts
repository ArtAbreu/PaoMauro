import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "admin" | "user";
    };
  }

  interface User {
    id: string;
    role: "admin" | "user";
  }
}
