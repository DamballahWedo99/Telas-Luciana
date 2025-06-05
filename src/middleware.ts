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
  "/api/contact", // Contacto puede ser público
];

// Rutas que requieren rol admin o major_admin
const adminRoutes = ["/dashboard/users", "/dashboard/settings"];

// APIs que requieren rol admin o major_admin
const adminApiRoutes = [
  "/api/users", // Gestión de usuarios
  "/api/s3/inventario", // Inventario crítico
];

// APIs que requieren autenticación pero pueden acceder usuarios normales
const protectedApiRoutes = ["/api/packing-list", "/api/returns", "/api/sales"];

// Configuración de rate limiting por ruta
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
  // APIs críticas que necesitan rate limiting
  "/api/users": {
    type: "api",
    message: "Demasiadas solicitudes a la API de usuarios.",
  },
  "/api/s3/inventario": {
    type: "api",
    message: "Demasiadas solicitudes al inventario.",
  },
  "/api/packing-list": {
    type: "api",
    message: "Demasiadas solicitudes a packing list.",
  },
  "/api/sales": {
    type: "api",
    message: "Demasiadas solicitudes a ventas.",
  },
  "/api/returns": {
    type: "api",
    message: "Demasiadas solicitudes a devoluciones.",
  },
};

// Control de acceso granular por rol
const roleBasedAccess: Record<string, string[]> = {
  // Solo admins pueden acceder a estas rutas
  admin_only: [
    "/api/users",
    "/api/s3/inventario/create-row",
    "/api/s3/inventario/update",
    "/dashboard/users",
    "/dashboard/settings",
  ],
  // Usuarios normales pueden acceder
  user: [
    "/api/packing-list",
    "/api/returns",
    "/api/sales",
    "/dashboard/ventas",
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

  // Usuarios normales pueden acceder a rutas de usuario
  const userRoutes = roleBasedAccess["user"];
  if (userRoutes.some((route) => pathname.startsWith(route))) {
    return true;
  }

  // Por defecto, denegar acceso a rutas no definidas
  return false;
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Aplicar rate limiting donde sea necesario
  const rateLimitConfig = needsRateLimit(pathname);
  if (rateLimitConfig) {
    const rateLimitResponse = await rateLimit(req, {
      type: rateLimitConfig.type,
      message: rateLimitConfig.message,
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

  // 6. Redirección del dashboard según rol
  if (pathname === "/dashboard") {
    const defaultRoute =
      userRole === "admin" || userRole === "major_admin"
        ? "/dashboard/users"
        : "/dashboard/ventas";
    return NextResponse.redirect(new URL(defaultRoute, req.url));
  }

  // 7. Verificar acceso a rutas web protegidas
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
