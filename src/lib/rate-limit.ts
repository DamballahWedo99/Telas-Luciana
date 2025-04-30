import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { NextRequest, NextResponse } from "next/server";

// Inicializa el cliente Redis con variables de entorno
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// Tipos de limitadores según el propósito
type RateLimiterType = "auth" | "api" | "contact";

// Crea un mapa de limitadores pre-configurados
const limiters: Record<RateLimiterType, Ratelimit> = {
  // Limitador para autenticación (más estricto): 5 solicitudes por minuto
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    analytics: true,
    prefix: "ratelimit:auth",
  }),

  // Limitador para APIs generales: 20 solicitudes por minuto
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    analytics: true,
    prefix: "ratelimit:api",
  }),

  // Limitador para contacto: 3 solicitudes por minuto
  contact: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 m"),
    analytics: true,
    prefix: "ratelimit:contact",
  }),
};

// Función para obtener la IP del cliente
function getClientIp(request: NextRequest): string {
  // Intenta obtener la IP del encabezado X-Forwarded-For
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // X-Forwarded-For puede contener múltiples IPs, tomamos la primera
    return forwardedFor.split(",")[0].trim();
  }

  // Intenta obtener la IP del encabezado True-Client-IP (Cloudflare)
  const trueClientIp = request.headers.get("true-client-ip");
  if (trueClientIp) {
    return trueClientIp;
  }

  // Intenta obtener la IP del encabezado CF-Connecting-IP (Cloudflare)
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Si no hay encabezados de proxy, usa una IP predeterminada
  return "127.0.0.1";
}

// Opciones de configuración para el rate limiter
interface RateLimitOptions {
  type: RateLimiterType;
  // Mensaje de error personalizado (opcional)
  message?: string;
  // Código de estado HTTP personalizado (opcional)
  statusCode?: number;
  // Identificador personalizado (opcional, por defecto es la IP)
  identifierFn?: (req: NextRequest) => string;
}

/**
 * Middleware para limitar la tasa de solicitudes para rutas específicas
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  // Configuración predeterminada
  const {
    type,
    message = "Demasiadas solicitudes. Por favor, inténtalo de nuevo más tarde.",
    statusCode = 429,
    identifierFn = getClientIp,
  } = options;

  // Obtiene el limitador según el tipo
  const limiter = limiters[type];

  // Genera un identificador único para el solicitante (por defecto: dirección IP)
  const identifier = identifierFn(req);

  try {
    // Intenta consumir un token de velocidad
    const { success, limit, reset, remaining } = await limiter.limit(
      identifier
    );

    // Si la solicitud excede el límite, devuelve un error 429
    if (!success) {
      const response = NextResponse.json(
        { error: message },
        { status: statusCode }
      );

      // Agrega encabezados de RateLimit según el estándar RFC 6585
      response.headers.set("X-RateLimit-Limit", limit.toString());
      response.headers.set("X-RateLimit-Remaining", remaining.toString());
      response.headers.set("X-RateLimit-Reset", reset.toString());
      response.headers.set(
        "Retry-After",
        Math.floor((reset - Date.now()) / 1000).toString()
      );

      return response;
    }

    // Si no se ha excedido el límite, devuelve null para permitir que la solicitud continúe
    return null;
  } catch (error) {
    // Si hay un error con el rate limiter, registramos el error pero permitimos la solicitud
    console.error("Error al aplicar rate limit:", error);
    return null;
  }
}
