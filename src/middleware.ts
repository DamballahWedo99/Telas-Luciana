import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
const nextAuthUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL;

// Agregar debugging
const DEBUG = true; // Cambiar a false cuando esté funcionando

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

// Función para detectar si es una solicitud de recurso estático
function isStaticResource(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname.startsWith("/api/auth")
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
  "/api/auth/session",
  "/api/auth/csrf",
  "/api/auth/providers",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/contact",
];

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

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const baseUrl = getBaseUrl(req);

  try {
    // Ignorar recursos estáticos
    if (isStaticResource(pathname)) {
      return NextResponse.next();
    }

    // Permitir rutas públicas
    if (isPublicRoute(pathname) || isPublicApiRoute(pathname)) {
      return NextResponse.next();
    }

    // Logging para debugging
    if (DEBUG && pathname === "/dashboard") {
      console.log("🔍 [Middleware] Dashboard request:", {
        pathname,
        method: req.method,
        cookies: req.cookies.getAll().map((c) => ({
          name: c.name,
          hasValue: !!c.value,
          valueLength: c.value?.length,
        })),
        headers: {
          referer: req.headers.get("referer"),
          cookie: req.headers.get("cookie")?.substring(0, 100) + "...",
        },
      });
    }

    if (!secret) {
      console.error("❌ [Middleware] Missing NEXTAUTH_SECRET");
      if (process.env.NODE_ENV === "production") {
        // En producción, permitir el paso pero loggear el error
        return NextResponse.next();
      }
      throw new Error("Missing NEXTAUTH_SECRET environment variable.");
    }

    // Intentar obtener el token con múltiples estrategias
    let token = null;
    const cookieNames = [
      "__Secure-next-auth.session-token",
      "next-auth.session-token",
      "__Host-next-auth.session-token",
      "authjs.session-token",
    ];

    // Intentar con cada nombre de cookie
    for (const cookieName of cookieNames) {
      if (req.cookies.has(cookieName)) {
        try {
          token = await getToken({
            req,
            secret,
            cookieName,
            secureCookie:
              cookieName.startsWith("__Secure") ||
              cookieName.startsWith("__Host"),
          });

          if (token) {
            if (DEBUG) {
              console.log(
                "✅ [Middleware] Token found with cookie:",
                cookieName
              );
            }
            break;
          }
        } catch (error) {
          if (DEBUG) {
            console.log("⚠️ [Middleware] Error with cookie", cookieName, error);
          }
        }
      }
    }

    // Si no encontramos token con nombres específicos, intentar con la configuración por defecto
    if (!token) {
      try {
        token = await getToken({
          req,
          secret,
        });
      } catch (error) {
        console.error("❌ [Middleware] Default getToken failed:", error);
      }
    }

    if (DEBUG && pathname === "/dashboard") {
      console.log("🔐 [Middleware] Token result:", {
        hasToken: !!token,
        tokenData: token
          ? {
              id: token.id,
              role: token.role,
              email: token.email,
            }
          : null,
      });
    }

    // Si no hay token
    if (!token) {
      // Para el dashboard, verificar si hay indicios de un login reciente
      if (pathname === "/dashboard") {
        // Verificar si hay alguna cookie de sesión
        const hasAnySessionCookie = cookieNames.some((name) =>
          req.cookies.has(name)
        );

        if (hasAnySessionCookie) {
          if (DEBUG) {
            console.log(
              "🔄 [Middleware] Session cookie exists but no token yet, allowing through"
            );
          }
          // Permitir el paso para dar tiempo a que la sesión se establezca
          return NextResponse.next();
        }

        // Verificar el referer para detectar si venimos del login
        const referer = req.headers.get("referer");
        if (
          referer &&
          (referer.includes("/login") || referer.includes("/api/auth"))
        ) {
          if (DEBUG) {
            console.log("🔄 [Middleware] Coming from login, allowing through");
          }
          return NextResponse.next();
        }
      }

      // Para APIs, retornar 401
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Authentication required" },
          { status: 401 }
        );
      }

      // Para otras rutas, redirigir a login
      const redirectUrl = new URL("/login", baseUrl);
      const cleanCallbackUrl = cleanUrl(`${baseUrl}${pathname}`);
      redirectUrl.searchParams.set("callbackUrl", cleanCallbackUrl);
      return NextResponse.redirect(redirectUrl);
    }

    // Si hay token, permitir el acceso
    if (DEBUG && pathname === "/dashboard") {
      console.log("✅ [Middleware] Access granted to dashboard");
    }

    return NextResponse.next();
  } catch (error) {
    console.error("❌ [Middleware] General error:", error);

    // En caso de error, ser permisivo para evitar bloqueos
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
