import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "./db";
import { createWebSession, validateWebSession } from "@/services/account/sessions";

const isProd = process.env.NODE_ENV === "production";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as NextAuthOptions["adapter"],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  cookies: isProd
    ? {
        sessionToken: {
          name: "__Secure-next-auth.session-token",
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: true,
          },
        },
      }
    : undefined,
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user?.passwordHash) return null;
        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sid = undefined;
        token.sv = undefined;
      }
      if (token.id && !token.sid) {
        // Register existing valid NextAuth JWTs during the additive rollout.
        try {
          const record = await createWebSession(token.id, !user);
          token.sid = record.id;
          token.sv = record.version;
        } catch {
          token.id = undefined;
          token.sid = undefined;
          token.sv = undefined;
        }
      } else if (token.id && token.sid && !await validateWebSession(token.id, token.sid, token.sv ?? -1)) {
        token.id = undefined;
        token.sid = undefined;
        token.sv = undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.sessionId = token.sid ?? null;
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      if ("token" in message && message.token?.id && message.token.sid) {
        await db.webSession.updateMany({ where: { id: message.token.sid, userId: message.token.id, revokedAt: null }, data: { revokedAt: new Date() } });
        await db.supportAccessGrant.updateMany({ where: { userId: message.token.id, webSessionId: message.token.sid, revokedAt: null }, data: { revokedAt: new Date() } });
      }
    },
  },
};
