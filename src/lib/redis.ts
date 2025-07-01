import { Redis } from "@upstash/redis";

export const rateLimitRedis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const cacheRedis = new Redis({
  url: process.env.UPSTASH_REDIS_CACHE_URL!,
  token: process.env.UPSTASH_REDIS_CACHE_TOKEN!,
});

export const generateCacheKey = (
  prefix: string,
  params: Record<string, unknown>
) => {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${params[key]}`)
    .join(":");
  return `cache:${prefix}:${sortedParams}`;
};

export const CACHE_TTL = {
  INVENTORY: 604800,
  USER_DATA: 604800,
  CLIENTES: 604800,
  FICHAS_TECNICAS: 604800,
  SOLD_ROLLS: 604800,
  ROLLS_DATA: 604800,
} as const;

export default cacheRedis;
