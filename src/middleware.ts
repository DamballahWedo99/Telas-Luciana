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
  if (process.env.NODE_ENV === "production" && url.includes("localhost:3000")) {
    return url
      .replace("localhost:3000", "telasytejidosluciana.com")
      .replace("http://", "https://");
  }
  return url;
}

function isDirectBrowserAccess(req: NextRequest): boolean {
  const referer = req.headers.get("referer");
  const acceptHeader = req.headers.get("accept") || "";

  if (!referer && acceptHeader.includes("text/html")) {
    return true;
  }

  if (referer && process.env.NODE_ENV === "production") {
    const refererUrl = new URL(referer);
    if (
      !refererUrl.hostname.includes("telasytejidosluciana.com") &&
      !refererUrl.hostname.includes("localhost")
    ) {
      return true;
    }
  }

  return false;
}

function isLegitimateApiRequest(req: NextRequest): boolean {
  const acceptHeader = req.headers.get("accept") || "";
  const contentType = req.headers.get("content-type") || "";
  const xRequestedWith = req.headers.get("x-requested-with");

  return (
    acceptHeader.includes("application/json") ||
    contentType.includes("application/json") ||
    xRequestedWith === "XMLHttpRequest" ||
    req.method !== "GET"
  );
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

const cronApiRoutes = ["/api/cron/weekly-inventory", "/api/cron/scheduler"];

const adminRoutes = ["/dashboard/admin", "/dashboard/settings"];

const adminApiRoutes = [
  "/api/s3/inventario/create-row",
  "/api/s3/inventario/update",
  "/api/s3/fichas-tecnicas/upload",
  "/api/s3/fichas-tecnicas/delete",
  "/api/s3/fichas-tecnicas/edit",
];

const protectedApiRoutes = [
  "/api/packing-list",
  "/api/returns",
  "/api/sales",
  "/api/users",
  "/api/s3/fichas-tecnicas",
  "/api/s3/fichas-tecnicas/download",
  "/api/s3/clientes",
];

const mixedAccessApiRoutes = ["/api/s3/inventario"];

const rateLimitConfig: Record<
  string,
  { type: "auth" | "api" | "contact" | "cron"; message?: string }
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
  "/api/s3/fichas-tecnicas/edit": {
    type: "api",
    message:
      "Demasiadas solicitudes de edición. Espera antes de intentar nuevamente.",
  },
  "/api/cron/weekly-inventory": {
    type: "cron",
    message:
      "Demasiadas solicitudes de reporte. Espera antes de intentar nuevamente.",
  },
  "/api/cron/scheduler": {
    type: "cron",
    message:
      "Demasiadas solicitudes de scheduler. Espera antes de intentar nuevamente.",
  },
};

const roleBasedAccess: Record<string, string[]> = {
  admin_only: [
    "/api/s3/inventario/create-row",
    "/api/s3/inventario/update",
    "/api/s3/fichas-tecnicas/upload",
    "/api/s3/fichas-tecnicas/delete",
    "/api/s3/fichas-tecnicas/edit",
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
    "/api/s3/clientes",
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

function isCronApiRoute(pathname: string): boolean {
  return cronApiRoutes.some((route) => pathname.startsWith(route));
}

function isMixedAccessApiRoute(pathname: string): boolean {
  return mixedAccessApiRoutes.some((route) => pathname.startsWith(route));
}

function validateCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.replace("Bearer ", "");
  return token === cronSecret;
}

function isInternalCronRequest(req: NextRequest): boolean {
  const internalHeaders = [
    req.headers.get("x-internal-request"),
    req.headers.get("X-Internal-Request"),
    req.headers.get("X-INTERNAL-REQUEST"),
  ];

  const hasInternalHeader = internalHeaders.some((header) => header === "true");

  if (!hasInternalHeader) {
    console.log("❌ No se encontró header interno válido:", {
      headers: internalHeaders,
      allHeaders: Object.fromEntries(req.headers.entries()),
    });
    return false;
  }

  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("❌ Falló validación de auth para cron interno:", {
      hasCronSecret: !!cronSecret,
      hasAuthHeader: !!authHeader,
      authPrefix: authHeader?.startsWith("Bearer "),
    });
    return false;
  }

  const token = authHeader.replace("Bearer ", "");
  const isValid = token === cronSecret;

  console.log("🔍 Validación de cron interno:", {
    isValid,
    hasInternalHeader,
    tokenMatch: isValid,
  });

  return isValid;
}

async function safeRateLimit(
  req: NextRequest,
  config: { type: "auth" | "api" | "contact" | "cron"; message?: string }
): Promise<NextResponse | null> {
  try {
    const { rateLimit } = await import("./lib/rate-limit");
    return await rateLimit(req, {
      type: config.type,
      message: config.message,
    });
  } catch (error) {
    console.error("Rate limiting failed:", error);
    return null;
  }
}

function needsRateLimit(
  pathname: string
): { type: "auth" | "api" | "contact" | "cron"; message?: string } | null {
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
    if (isInternalCronRequest(req)) {
      console.log("✅ Solicitud interna de cron autorizada para:", pathname);
      return NextResponse.next();
    }

    if (
      pathname.startsWith("/api/") &&
      !isPublicApiRoute(pathname) &&
      !isCronApiRoute(pathname)
    ) {
      if (isDirectBrowserAccess(req) && !isLegitimateApiRequest(req)) {
        return NextResponse.json(
          {
            error: "Forbidden",
            message:
              "Direct API access not allowed. Use the application interface.",
          },
          { status: 403 }
        );
      }
    }

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

    if (isCronApiRoute(pathname)) {
      if (!validateCronAuth(req)) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Invalid CRON authentication" },
          { status: 401 }
        );
      }
      return NextResponse.next();
    }

    if (isMixedAccessApiRoute(pathname)) {
      console.log(
        "🔄 Ruta de acceso mixto, procediendo con auth de usuario:",
        pathname
      );
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

      console.error("getToken error details:", {
        pathname,
        secret: secret ? "present" : "missing",
        env: process.env.NODE_ENV,
        nextAuthUrl: nextAuthUrl,
        secureCookie:
          nextAuthUrl?.startsWith("https://") ||
          process.env.NODE_ENV === "production",
        cookies: req.cookies.getAll().map((c) => ({
          name: c.name,
          value: c.value.substring(0, 20) + "...",
        })),
      });

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

      const redirectResponse = NextResponse.redirect(redirectUrl);

      return redirectResponse;
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

    console.error("Middleware error details:", {
      pathname,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (isPublicRoute(pathname) || isPublicApiRoute(pathname)) {
      return NextResponse.next();
    }

    if (!pathname.startsWith("/api/")) {
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
