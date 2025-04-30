import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const secret = process.env.NEXTAUTH_SECRET;
if (!secret) {
  throw new Error("Missing NEXTAUTH_SECRET environment variable.");
}

const publicRoutes = ["/", "/login", "/forgot-password", "/reset-password"];

const publicApiRoutes = [
  "/api/auth",
  "/api/auth/callback",
  "/api/auth/signin",
  "/api/auth/signout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

const adminRoutes = ["/dashboard/users", "/dashboard/settings"];

// Lista de rutas que tienen su propio rate limiting
const rateLimitedRoutes = [
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/contact",
];

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Las rutas con rate-limiting implementado internamente se pasan directamente
  if (rateLimitedRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const normalizedPath =
    pathname.endsWith("/") && pathname !== "/"
      ? pathname.slice(0, -1)
      : pathname;

  if (
    publicRoutes.some(
      (route) =>
        normalizedPath === route || normalizedPath.startsWith(`${route}/`)
    )
  ) {
    return NextResponse.next();
  }

  if (publicApiRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret });
  if (!token) {
    if (normalizedPath.startsWith("/login")) {
      return NextResponse.next();
    }

    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (
    adminRoutes.some((route) => pathname.startsWith(route)) &&
    token.role !== "admin" &&
    token.role !== "major_admin"
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname === "/dashboard") {
    const defaultRoute =
      token.role === "admin" || token.role === "major_admin"
        ? "/dashboard/users"
        : "/dashboard/ventas";
    return NextResponse.redirect(new URL(defaultRoute, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)",
    "/(api)(.*)",
  ],
};
