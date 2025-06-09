import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "./lib/rate-limit";

const secret = process.env.NEXTAUTH_SECRET;
if (!secret) {
  throw new Error("Missing NEXTAUTH_SECRET environment variable.");
}

// Rutas públicas (sin autenticación)
const publicRoutes = ["/", "/login", "/forgot-password", "/reset-password"];

// APIs públicas (sin autenticación)
const publicApiRoutes = [
  "/api/auth",
  "/api/auth/callback",
  "/api/auth/signin",
  "/api/auth/signout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/contact",
];

// Rutas que requieren rol admin o major_admin
const adminRoutes = ["/dashboard/admin", "/dashboard/settings"];

// APIs que requieren rol admin o major_admin
const adminApiRoutes = [
  "/api/s3/inventario/create-row",
  "/api/s3/inventario/update",
];

// APIs que requieren autenticación pero pueden acceder usuarios normales
const protectedApiRoutes = [
  "/api/packing-list",
  "/api/returns",
  "/api/sales",
  "/api/users", // Mover aquí para que admins puedan acceder
  "/api/s3/inventario", // Mover aquí para acceso general
];

// Configuración de rate limiting por ruta - MÁS PERMISIVO
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
  // ❌ REMOVIDO: Rate limiting de APIs críticas para desarrollo
  // "/api/users": { type: "api" },
  // "/api/s3/inventario": { type: "api" },
  // "/api/packing-list": { type: "api" },
};

// Control de acceso granular por rol - SIMPLIFICADO
const roleBasedAccess: Record<string, string[]> = {
  // Solo admins pueden acceder a estas rutas
  admin_only: [
    "/api/s3/inventario/create-row",
    "/api/s3/inventario/update",
    "/dashboard/admin",
    "/dashboard/settings",
  ],
  // Usuarios normales y admins pueden acceder
  authenticated: [
    "/api/packing-list",
    "/api/returns",
    "/api/sales",
    "/api/users", // Ahora accesible para verificar usuarios
    "/api/s3/inventario", // Lectura de inventario
    "/api/users/verify", // Verificación de usuarios
    "/dashboard", // Ruta principal del dashboard
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
  // Admin y major_admin tienen acceso completo
  if (userRole === "admin" || userRole === "major_admin") {
    return true;
  }

  // Verificar rutas que requieren admin específicamente
  const adminOnlyRoutes = roleBasedAccess["admin_only"];
  if (adminOnlyRoutes.some((route) => pathname.startsWith(route))) {
    return false;
  }

  // Usuarios autenticados pueden acceder a rutas básicas
  const authenticatedRoutes = roleBasedAccess["authenticated"];
  if (authenticatedRoutes.some((route) => pathname.startsWith(route))) {
    return true;
  }

  // ✅ CAMBIADO: Por defecto permitir acceso a dashboard principal
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return true;
  }

  // Por defecto, denegar acceso a rutas no definidas
  return false;
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Aplicar rate limiting donde sea necesario (REDUCIDO)
  const rateLimitConfigItem = needsRateLimit(pathname);
  if (rateLimitConfigItem) {
    const rateLimitResponse = await rateLimit(req, {
      type: rateLimitConfigItem.type,
      message: rateLimitConfigItem.message,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  // 2. Rutas públicas - permitir acceso
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // 3. APIs públicas - permitir acceso
  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  // 4. Verificar autenticación para todas las demás rutas
  const token = await getToken({ req, secret });

  if (!token) {
    // Si no hay token y es una ruta de login, permitir
    if (pathname.startsWith("/login")) {
      return NextResponse.next();
    }

    // Si es una API, devolver 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Authentication required",
        },
        { status: 401 }
      );
    }

    // Para rutas web, redirigir a login
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(redirectUrl);
  }

  // 5. Usuario autenticado - verificar permisos por rol
  const userRole = token.role as string;

  // Verificar rutas admin específicas
  if (
    isAdminRoute(pathname) &&
    userRole !== "admin" &&
    userRole !== "major_admin"
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Verificar APIs admin específicas
  if (
    isAdminApiRoute(pathname) &&
    userRole !== "admin" &&
    userRole !== "major_admin"
  ) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: "Admin access required",
      },
      { status: 403 }
    );
  }

  // Verificar APIs protegidas y control granular de acceso
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

  // ❌ REMOVIDO: Redirección automática problemática del dashboard
  // if (pathname === "/dashboard") {
  //   const defaultRoute = userRole === "admin" || userRole === "major_admin"
  //     ? "/dashboard/users"
  //     : "/dashboard/ventas";
  //   return NextResponse.redirect(new URL(defaultRoute, req.url));
  // }

  // 6. Verificar acceso a rutas web protegidas
  if (
    pathname.startsWith("/dashboard/") &&
    !hasRoleAccess(pathname, userRole)
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)",
    "/(api)(.*)",
  ],
};
