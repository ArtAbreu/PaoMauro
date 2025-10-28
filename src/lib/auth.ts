import { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authenticator } from "otplib";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { createHash, randomBytes } from "crypto";
import { addMinutes } from "date-fns";
import { createTransport } from "nodemailer";
import { pino } from "pino";

authenticator.options = { window: 1 };

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  token: z.string().optional(),
});

const loginAttempts = new Map<string, { attempts: number; lastAttempt: number }>();
const LOCK_WINDOW = 15 * 60 * 1000;

const logger = pino({ name: "auth" });

async function verifyBackupCode(userId: string, token: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  const code = await prisma.totpBackupCode.findFirst({
    where: { userId, codeHash: hash, used: false },
  });
  if (!code) return false;
  await prisma.totpBackupCode.update({ where: { id: code.id }, data: { used: true } });
  return true;
}

async function verifyCredentials(credentials: Record<string, unknown> | undefined) {
  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) return null;
  const { email, password, token } = parsed.data;

  const attempt = loginAttempts.get(email);
  const now = Date.now();
  if (attempt && attempt.attempts >= 5 && now - attempt.lastAttempt < LOCK_WINDOW) {
    throw new Error("Conta temporariamente bloqueada. Tente novamente em alguns minutos.");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    registerAttempt(email);
    return null;
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    registerAttempt(email);
    return null;
  }

  if (user.totpSecret) {
    if (!token) {
      registerAttempt(email);
      throw new Error("Token de verificação obrigatório.");
    }
    const isTotpValid = authenticator.check(token, user.totpSecret);
    const isBackupValid = await verifyBackupCode(user.id, token);
    if (!isTotpValid && !isBackupValid) {
      registerAttempt(email);
      throw new Error("Token de verificação inválido.");
    }
  }

  loginAttempts.delete(email);
  return user;
}

function registerAttempt(email: string) {
  const current = loginAttempts.get(email);
  const now = Date.now();
  if (!current) {
    loginAttempts.set(email, { attempts: 1, lastAttempt: now });
  } else {
    const withinWindow = now - current.lastAttempt < LOCK_WINDOW;
    loginAttempts.set(email, {
      attempts: withinWindow ? current.attempts + 1 : 1,
      lastAttempt: now,
    });
  }
}

function createEmailTransport() {
  if (!process.env.AUTH_EMAIL_SERVER) {
    logger.warn("AUTH_EMAIL_SERVER não configurado. Emails de recuperação não serão enviados.");
    return null;
  }

  return createTransport(process.env.AUTH_EMAIL_SERVER);
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 60 * 60,
    updateAge: 15 * 60,
  },
  jwt: {
    maxAge: 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    EmailProvider({
      id: "recovery",
      name: "Recuperação de senha",
      server: process.env.AUTH_EMAIL_SERVER,
      from: process.env.AUTH_EMAIL_FROM,
      async sendVerificationRequest({ identifier, url }) {
        const transport = createEmailTransport();
        if (!transport) {
          logger.warn({ identifier }, "Não foi possível enviar email de recuperação");
          return;
        }
        await transport.sendMail({
          to: identifier,
          from: process.env.AUTH_EMAIL_FROM,
          subject: "Recuperação de acesso - pao do mauro",
          text: `Olá!\n\nRecebemos uma solicitação de acesso. Clique no link abaixo para entrar e redefinir sua senha:\n${url}\n\nSe não foi você, ignore este email.`,
        });
      },
      generateVerificationToken: () => randomBytes(20).toString("hex"),
      maxAge: 10 * 60,
    }),
    Credentials({
      name: "E-mail e senha",
      credentials: {
        email: {},
        password: {},
        token: {},
      },
      authorize: verifyCredentials,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session?.role) {
        token.role = session.role;
      }
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.name = user.name;
        token.email = user.email;
      }
      token.jti = randomBytes(8).toString("hex");
      token.exp = Math.floor(Date.now() / 1000) + 60 * 60;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.sub as string;
        session.user.role = token.role as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
    async signIn({ user }) {
      if (!user) return false;
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "login",
          entity: "User",
          entityId: user.id,
          payloadJson: {},
        },
      });
      return true;
    },
  },
  events: {
    async signOut({ token }) {
      if (!token?.sub) return;
      await prisma.auditLog.create({
        data: {
          userId: token.sub,
          action: "logout",
          entity: "User",
          entityId: token.sub,
          payloadJson: {},
        },
      });
    },
  },
  cookies: {
    sessionToken: {
      name: `__Secure-paodomauro.session-token`,
      options: {
        httpOnly: true,
        sameSite: "strict",
        secure: true,
        path: "/",
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
};

export async function createPasswordResetToken(userId: string) {
  const token = randomBytes(24).toString("hex");
  await prisma.verificationToken.create({
    data: {
      identifier: userId,
      token,
      expires: addMinutes(new Date(), 15),
    },
  });
  return token;
}
