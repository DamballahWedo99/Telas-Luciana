import { NextRequest, NextResponse } from "next/server";
import { cacheRedis, generateCacheKey } from "./redis";

function normalizeQueryString(search: string): string {
  if (!search || search === "?") {
    return "";
  }

  const searchParams = new URLSearchParams(search);
  const sortedParams: string[] = [];

  const sortedKeys = Array.from(searchParams.keys()).sort();

  for (const key of sortedKeys) {
    const values = searchParams.getAll(key);
    for (const value of values.sort()) {
      sortedParams.push(`${key}=${value}`);
    }
  }

  return sortedParams.length > 0 ? `?${sortedParams.join("&")}` : "";
}

export function withCache(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: {
    ttl?: number;
    keyPrefix: string;
    skipCache?: (req: NextRequest) => boolean;
    onCacheHit?: (key: string) => void;
    onCacheMiss?: (key: string) => void;
  }
) {
  return async (req: NextRequest) => {
    const {
      ttl = 300,
      keyPrefix,
      skipCache,
      onCacheHit,
      onCacheMiss,
    } = options;

    if (req.method !== "GET") {
      return handler(req);
    }

    if (skipCache && skipCache(req)) {
      return handler(req);
    }

    const url = new URL(req.url);

    const normalizedSearch = normalizeQueryString(url.search);

    const cacheKey = generateCacheKey(keyPrefix, {
      pathname: url.pathname,
      search: normalizedSearch,
    });

    try {
      const cached = await cacheRedis.get(cacheKey);

      if (cached) {
        onCacheHit?.(cacheKey);

        return new NextResponse(
          JSON.stringify({
            ...cached,
            _cache: {
              hit: true,
              key: cacheKey,
              timestamp: new Date().toISOString(),
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Cache": "HIT",
              "X-Cache-Key": cacheKey,
            },
          }
        );
      }

      onCacheMiss?.(cacheKey);
      const response = await handler(req);

      if (response.status === 200) {
        const responseData = await response.json();

        await cacheRedis.setex(cacheKey, ttl, JSON.stringify(responseData));

        return new NextResponse(
          JSON.stringify({
            ...responseData,
            _cache: {
              hit: false,
              key: cacheKey,
              timestamp: new Date().toISOString(),
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Cache": "MISS",
              "X-Cache-Key": cacheKey,
            },
          }
        );
      }

      return response;
    } catch (error) {
      console.error("Cache middleware error:", error);
      return handler(req);
    }
  };
}

export async function invalidateCachePattern(pattern: string) {
  try {
    const keys = await cacheRedis.keys(pattern);

    if (keys.length > 0) {
      await cacheRedis.del(...keys);
      console.log(
        `🗑️ Invalidated ${keys.length} cache entries matching: ${pattern}`
      );
      return keys.length;
    }

    return 0;
  } catch (error) {
    console.error("Error invalidating cache pattern:", error);
    return 0;
  }
}

export async function setCacheEntry(
  key: string,
  value: Record<string, unknown> | unknown[],
  ttl: number = 300
) {
  try {
    await cacheRedis.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Error setting cache entry:", error);
    return false;
  }
}

export async function getCacheEntry(key: string) {
  try {
    const cached = await cacheRedis.get(key);
    return cached || null;
  } catch (error) {
    console.error("Error getting cache entry:", error);
    return null;
  }
}

export async function deleteCacheEntry(key: string) {
  try {
    await cacheRedis.del(key);
    return true;
  } catch (error) {
    console.error("Error deleting cache entry:", error);
    return false;
  }
}
