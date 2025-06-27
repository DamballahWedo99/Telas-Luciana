import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { NextRequest, NextResponse } from "next/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

type RateLimiterType = "auth" | "api" | "contact" | "cron";

const limiters: Record<RateLimiterType, Ratelimit> = {
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    analytics: true,
    prefix: "ratelimit:auth",
  }),

  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    analytics: true,
    prefix: "ratelimit:api",
  }),

  contact: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 m"),
    analytics: true,
    prefix: "ratelimit:contact",
  }),

  cron: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    analytics: true,
    prefix: "ratelimit:cron",
  }),
};

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const trueClientIp = request.headers.get("true-client-ip");
  if (trueClientIp) {
    return trueClientIp;
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return "127.0.0.1";
}

interface RateLimitOptions {
  type: RateLimiterType;
  message?: string;
  statusCode?: number;
  identifierFn?: (req: NextRequest) => string;
}

export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  const {
    type,
    message = "Demasiadas solicitudes. Por favor, inténtalo de nuevo más tarde.",
    statusCode = 429,
    identifierFn = getClientIp,
  } = options;

  const limiter = limiters[type];
  const identifier = identifierFn(req);

  try {
    const { success, limit, reset, remaining } =
      await limiter.limit(identifier);

    if (!success) {
      const response = NextResponse.json(
        { error: message },
        { status: statusCode }
      );

      response.headers.set("X-RateLimit-Limit", limit.toString());
      response.headers.set("X-RateLimit-Remaining", remaining.toString());
      response.headers.set("X-RateLimit-Reset", reset.toString());
      response.headers.set(
        "Retry-After",
        Math.floor((reset - Date.now()) / 1000).toString()
      );

      return response;
    }

    return null;
  } catch (error) {
    console.error("Error al aplicar rate limit:", error);
    return null;
  }
}
