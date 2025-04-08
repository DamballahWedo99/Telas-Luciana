import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import authConfig from "./auth.config";
import { db } from "./lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  ...authConfig,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user.role as string) ?? "seller";
        token.name = (user.name as string) ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token) return session;

      session.user.id = token.id as string;
      session.user.role = (token.role as string) ?? "seller";
      session.user.name = (token.name as string) ?? session.user.name ?? null;

      return session;
    },
  },
});
