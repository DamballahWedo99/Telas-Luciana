import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
const nextAuthUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL;

function getBaseUrl(req: NextRequest): string {
  if (
    process.env.NODE_ENV === "production" ||
    req.nextUrl.hostname === "telasytejidosluciana.com"
  ) {
    return "https://telasytejidosluciana.com";
  }

  return `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

function cleanUrl(url: string): string {
  if (url.includes("localhost:3000")) {
    return url
      .replace("localhost:3000", "telasytejidosluciana.com")
      .replace("http://", "https://");
  }
  return url;
}

const publicRoutes = [
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/catalogo",
  "/politica-de-privacidad",
];

const publicApiRoutes = [
  "/api/auth",
  "/api/auth/callback",
  "/api/auth/signin",
  "/api/auth/signout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/contact",
];

const adminRoutes = ["/dashboard/admin", "/dashboard/settings"];

const adminApiRoutes = [
  "/api/s3/inventario/create-row",
  "/api/s3/inventario/update",
  "/api/s3/fichas-tecnicas/upload",
  "/api/s3/fichas-tecnicas/delete",
];

const protectedApiRoutes = [
  "/api/packing-list",
  "/api/returns",
  "/api/sales",
  "/api/users",
  "/api/s3/inventario",
  "/api/s3/fichas-tecnicas",
  "/api/s3/fichas-tecnicas/download",
];

const rateLimitConfig: Record<
  string,
  { type: "auth" | "api" | "contact"; message?: string }
> = {
  "/api/auth/forgot-password": {
    type: "auth",
    message:
      "Demasiados intentos de recuperación. Espera antes de intentar nuevamente.",
  },
  "/api/auth/reset-password": {
    type: "auth",
    message:
      "Demasiados intentos de reset. Espera antes de intentar nuevamente.",
  },
  "/api/contact": {
    type: "contact",
    message: "Demasiados mensajes de contacto. Espera antes de enviar otro.",
  },
  "/api/s3/fichas-tecnicas/upload": {
    type: "api",
    message:
      "Demasiadas solicitudes de subida. Espera antes de intentar nuevamente.",
  },
  "/api/s3/fichas-tecnicas/delete": {
    type: "api",
    message:
      "Demasiadas solicitudes de eliminación. Espera antes de intentar nuevamente.",
  },
};

const roleBasedAccess: Record<string, string[]> = {
  admin_only: [
    "/api/s3/inventario/create-row",
    "/api/s3/inventario/update",
    "/api/s3/fichas-tecnicas/upload",
    "/api/s3/fichas-tecnicas/delete",
    "/dashboard/admin",
    "/dashboard/settings",
  ],
  authenticated: [
    "/api/packing-list",
    "/api/returns",
    "/api/sales",
    "/api/users",
    "/api/s3/inventario",
    "/api/s3/fichas-tecnicas",
    "/api/s3/fichas-tecnicas/download",
    "/api/users/verify",
    "/dashboard",
  ],
};

function isPublicRoute(pathname: string): boolean {
  const normalizedPath =
    pathname.endsWith("/") && pathname !== "/"
      ? pathname.slice(0, -1)
      : pathname;
  return publicRoutes.some(
    (route) =>
      normalizedPath === route || normalizedPath.startsWith(`${route}/`)
  );
}

function isPublicApiRoute(pathname: string): boolean {
  return publicApiRoutes.some((route) => pathname.startsWith(route));
}

async function safeRateLimit(
  req: NextRequest,
  config: { type: "auth" | "api" | "contact"; message?: string }
): Promise<NextResponse | null> {
  try {
    const { rateLimit } = await import("./lib/rate-limit");
    return await rateLimit(req, config);
  } catch (error) {
    console.error("Rate limiting failed:", error);
    return null;
  }
}

function needsRateLimit(
  pathname: string
): { type: "auth" | "api" | "contact"; message?: string } | null {
  for (const [route, config] of Object.entries(rateLimitConfig)) {
    if (pathname.startsWith(route)) {
      return config;
    }
  }
  return null;
}

function isAdminRoute(pathname: string): boolean {
  return adminRoutes.some((route) => pathname.startsWith(route));
}

function isAdminApiRoute(pathname: string): boolean {
  return adminApiRoutes.some((route) => pathname.startsWith(route));
}

function isProtectedApiRoute(pathname: string): boolean {
  return protectedApiRoutes.some((route) => pathname.startsWith(route));
}

function hasRoleAccess(pathname: string, userRole: string): boolean {
  if (userRole === "admin" || userRole === "major_admin") {
    return true;
  }

  const adminOnlyRoutes = roleBasedAccess["admin_only"];
  if (adminOnlyRoutes.some((route) => pathname.startsWith(route))) {
    return false;
  }

  const authenticatedRoutes = roleBasedAccess["authenticated"];
  if (authenticatedRoutes.some((route) => pathname.startsWith(route))) {
    return true;
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return true;
  }

  return false;
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const baseUrl = getBaseUrl(req);

  try {
    const rateLimitConfigItem = needsRateLimit(pathname);
    if (rateLimitConfigItem) {
      try {
        const rateLimitResponse = await safeRateLimit(req, rateLimitConfigItem);
        if (rateLimitResponse) {
          return rateLimitResponse;
        }
      } catch (error) {
        console.error("Rate limit error:", error);
      }
    }

    if (isPublicRoute(pathname)) {
      return NextResponse.next();
    }

    if (isPublicApiRoute(pathname)) {
      return NextResponse.next();
    }

    if (!secret) {
      console.error("Missing NEXTAUTH_SECRET/AUTH_SECRET environment variable");
      if (process.env.NODE_ENV === "production") {
        return NextResponse.next();
      }
      throw new Error("Missing NEXTAUTH_SECRET environment variable.");
    }

    let token;
    try {
      token = await getToken({
        req,
        secret,
        secureCookie:
          nextAuthUrl?.startsWith("https://") ||
          process.env.NODE_ENV === "production",
        cookieName:
          process.env.NODE_ENV === "production"
            ? "__Secure-next-auth.session-token"
            : "next-auth.session-token",
      });
    } catch (error) {
      console.error("getToken failed:", error);
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Authentication error", message: "Token validation failed" },
          { status: 401 }
        );
      }
      const redirectUrl = new URL("/login", baseUrl);
      const cleanCallbackUrl = cleanUrl(`${baseUrl}${pathname}`);
      redirectUrl.searchParams.set("callbackUrl", cleanCallbackUrl);
      return NextResponse.redirect(redirectUrl);
    }

    if (!token) {
      if (pathname.startsWith("/login")) {
        return NextResponse.next();
      }

      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Authentication required" },
          { status: 401 }
        );
      }

      const redirectUrl = new URL("/login", baseUrl);
      const cleanCallbackUrl = cleanUrl(`${baseUrl}${pathname}`);
      redirectUrl.searchParams.set("callbackUrl", cleanCallbackUrl);
      return NextResponse.redirect(redirectUrl);
    }

    const userRole = token.role as string;

    if (
      isAdminRoute(pathname) &&
      userRole !== "admin" &&
      userRole !== "major_admin"
    ) {
      return NextResponse.redirect(new URL("/dashboard", baseUrl));
    }

    if (
      isAdminApiRoute(pathname) &&
      userRole !== "admin" &&
      userRole !== "major_admin"
    ) {
      return NextResponse.json(
        { error: "Forbidden", message: "Admin access required" },
        { status: 403 }
      );
    }

    if (isProtectedApiRoute(pathname) || pathname.startsWith("/api/")) {
      if (!hasRoleAccess(pathname, userRole)) {
        return NextResponse.json(
          {
            error: "Forbidden",
            message: "Insufficient permissions for this resource",
          },
          { status: 403 }
        );
      }
    }

    if (
      pathname.startsWith("/dashboard/") &&
      !hasRoleAccess(pathname, userRole)
    ) {
      return NextResponse.redirect(new URL("/dashboard", baseUrl));
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Middleware error:", error);

    if (isPublicRoute(pathname) || isPublicApiRoute(pathname)) {
      return NextResponse.next();
    }

    if (!pathname.startsWith("/api/")) {
      // CAMBIO: Usar baseUrl correcto
      const redirectUrl = new URL("/login", baseUrl);
      const cleanCallbackUrl = cleanUrl(`${baseUrl}${pathname}`);
      redirectUrl.searchParams.set("callbackUrl", cleanCallbackUrl);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Middleware configuration error",
      },
      { status: 500 }
    );
  }
}

export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)",
    "/(api)(.*)",
  ],
};
