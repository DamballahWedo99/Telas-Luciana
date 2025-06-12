import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import authConfig from "./auth.config";
import { db } from "./lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  ...authConfig,
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,

  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        domain:
          process.env.NODE_ENV === "production"
            ? ".telasytejidosluciana.com"
            : undefined,
      },
    },
    callbackUrl: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.callback-url"
          : "next-auth.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        domain:
          process.env.NODE_ENV === "production"
            ? ".telasytejidosluciana.com"
            : undefined,
      },
    },
    csrfToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Host-next-auth.csrf-token"
          : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        domain:
          process.env.NODE_ENV === "production"
            ? ".telasytejidosluciana.com"
            : undefined,
      },
    },
  },

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

    async redirect({ url, baseUrl }) {
      if (process.env.NODE_ENV === "production") {
        const productionBaseUrl = "https://telasytejidosluciana.com";

        if (url.startsWith("/")) {
          return `${productionBaseUrl}${url}`;
        }

        if (url.startsWith(productionBaseUrl)) {
          return url;
        }

        return `${productionBaseUrl}/dashboard`;
      }

      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
});
