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
    skipCacheForLastLogin?: boolean;
  }
) {
  return async (req: NextRequest) => {
    const {
      ttl = 300,
      keyPrefix,
      skipCache,
      onCacheHit,
      onCacheMiss,
      skipCacheForLastLogin = false,
    } = options;

    if (req.method !== "GET") {
      return handler(req);
    }

    if (skipCache && skipCache(req)) {
      return handler(req);
    }

    if (skipCacheForLastLogin) {
      const url = new URL(req.url);
      if (url.searchParams.get("includeActivity") === "true") {
        return handler(req);
      }
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

        // Handle arrays properly - don't use spread operator on arrays
        const responseData = Array.isArray(cached) 
          ? cached  // Keep arrays as arrays
          : {       // Only spread objects
              ...cached,
            };

        // Add cache metadata without breaking array structure
        const finalResponse = Array.isArray(responseData)
          ? {
              data: responseData,
              _cache: {
                hit: true,
                key: cacheKey,
                timestamp: new Date().toISOString(),
              },
            }
          : {
              ...responseData,
              _cache: {
                hit: true,
                key: cacheKey,
                timestamp: new Date().toISOString(),
              },
            };

        return new NextResponse(
          JSON.stringify(finalResponse),
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

        // Solo guardar en caché si hay datos (no es un array vacío o un objeto vacío)
        const hasData = Array.isArray(responseData) 
          ? responseData.length > 0 
          : Object.keys(responseData).length > 0;
        
        if (hasData) {
          await cacheRedis.setex(cacheKey, ttl, JSON.stringify(responseData));
        }

        // Handle arrays properly for cache MISS as well
        const finalResponse = Array.isArray(responseData)
          ? {
              data: responseData,
              _cache: {
                hit: false,
                key: cacheKey,
                timestamp: new Date().toISOString(),
              },
            }
          : {
              ...responseData,
              _cache: {
                hit: false,
                key: cacheKey,
                timestamp: new Date().toISOString(),
              },
            };

        return new NextResponse(
          JSON.stringify(finalResponse),
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

// ===== YEAR-BASED CACHE FUNCTIONS =====

export const YEAR_CACHE_TTL = {
  CURRENT_YEAR: 24 * 60 * 60,        // 1 día (datos año actual)
  HISTORICAL_YEAR: 30 * 24 * 60 * 60, // 30 días (datos históricos)
  COMBINED_CACHE: 7 * 24 * 60 * 60     // 7 días (vista combinada)
};

export function getYearCacheKeys() {
  const currentYear = new Date().getFullYear();
  
  return {
    currentYear: `api:s3:pedidos:current:${currentYear}`,
    historicalConsolidated: `api:s3:pedidos:frozen:2015-${currentYear-1}`, // Un solo cache para todos los históricos
    combined: "api:s3:pedidos:combined"
  };
}

export async function getCachedHistoricalData(): Promise<unknown[] | null> {
  try {
    const cacheKeys = getYearCacheKeys();
    const cached = await cacheRedis.get(cacheKeys.historicalConsolidated);
    
    if (cached) {
      const currentYear = new Date().getFullYear();
      return typeof cached === 'string' ? JSON.parse(cached) : cached;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting cached historical data:", error);
    return null;
  }
}

export async function setCachedHistoricalData(data: unknown[]): Promise<boolean> {
  try {
    const cacheKeys = getYearCacheKeys();
    const currentYear = new Date().getFullYear();
    
    await cacheRedis.setex(cacheKeys.historicalConsolidated, YEAR_CACHE_TTL.HISTORICAL_YEAR, JSON.stringify(data));
    
    return true;
  } catch (error) {
    console.error("Error setting cached historical data:", error);
    return false;
  }
}

export async function getCachedCurrentYearData(): Promise<unknown[] | null> {
  try {
    const cacheKeys = getYearCacheKeys();
    const cached = await cacheRedis.get(cacheKeys.currentYear);
    
    if (cached) {
      const currentYear = new Date().getFullYear();
      return typeof cached === 'string' ? JSON.parse(cached) : cached;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting cached current year data:", error);
    return null;
  }
}

export async function setCachedCurrentYearData(data: unknown[]): Promise<boolean> {
  try {
    const cacheKeys = getYearCacheKeys();
    const currentYear = new Date().getFullYear();
    
    await cacheRedis.setex(cacheKeys.currentYear, YEAR_CACHE_TTL.CURRENT_YEAR, JSON.stringify(data));
    
    return true;
  } catch (error) {
    console.error("Error setting cached current year data:", error);
    return false;
  }
}

export async function invalidateCurrentYearOnly(): Promise<number> {
  try {
    const currentYear = new Date().getFullYear();
    const cacheKeys = getYearCacheKeys();
    
    let totalInvalidated = 0;
    
    // Invalidar solo año actual
    totalInvalidated += await invalidateCachePattern(`${cacheKeys.currentYear}*`);
    
    // Invalidar cache combinado (para que se regenere con datos actualizados)
    totalInvalidated += await invalidateCachePattern(`${cacheKeys.combined}*`);
    
    
    // Los datos históricos consolidados permanecen intactos
    
    return totalInvalidated;
  } catch (error) {
    console.error("Error invalidating current year cache:", error);
    return 0;
  }
}

export async function invalidateCacheForOrderYear(orderData: { fecha_pedido?: string }): Promise<number> {
  try {
    const currentYear = new Date().getFullYear();
    const cacheKeys = getYearCacheKeys();
    
    let totalInvalidated = 0;
    
    // Determinar el año del pedido
    let orderYear = currentYear; // Por defecto asumir año actual
    
    if (orderData.fecha_pedido) {
      try {
        orderYear = new Date(orderData.fecha_pedido).getFullYear();
      } catch {
      }
    }
    
    if (orderYear === currentYear) {
      // Es del año actual - invalidar solo año actual
      totalInvalidated += await invalidateCachePattern(`${cacheKeys.currentYear}*`);
    } else {
      // Es histórico - invalidar cache histórico consolidado
      totalInvalidated += await invalidateCachePattern(`${cacheKeys.historicalConsolidated}*`);
    }
    
    // Siempre invalidar cache combinado
    totalInvalidated += await invalidateCachePattern(`${cacheKeys.combined}*`);
    
    
    return totalInvalidated;
  } catch (error) {
    console.error("Error invalidating cache for order year:", error);
    return 0;
  }
}

export async function freezeHistoricalData(): Promise<void> {
  try {
    const currentYear = new Date().getFullYear();
    
    // Verificar si ya existe el cache consolidado histórico
    const cachedData = await getCachedHistoricalData();
    
    if (!cachedData) {
    } else {
    }
  } catch (error) {
    console.error("Error in freeze historical data process:", error);
  }
}

// ===== USER ACTIVITY CACHE FUNCTIONS =====

export const USER_CACHE_TTL = {
  STATIC_DATA: 60 * 60,        // 1 hora (datos estáticos del perfil)
  ACTIVITY_DATA: 5 * 60,       // 5 minutos (lastLogin y actividad)
  COMBINED_DATA: 5 * 60        // 5 minutos (vista combinada)
};

export async function invalidateUserActivityCache(userId?: string): Promise<number> {
  try {
    let totalInvalidated = 0;
    
    if (userId) {
      const userPatterns = [
        `cache:api:users:*:*userId=${userId}*`,
        `cache:api:users:activity:${userId}*`,
        `cache:dashboard:users:*`
      ];
      
      for (const pattern of userPatterns) {
        totalInvalidated += await invalidateCachePattern(pattern);
      }
      
    } else {
      const patterns = [
        "cache:api:users:activity:*",
        "cache:api:users:*",
        "cache:dashboard:users:*"
      ];
      
      for (const pattern of patterns) {
        totalInvalidated += await invalidateCachePattern(pattern);
      }
      
    }
    
    return totalInvalidated;
  } catch (error) {
    console.error("Error invalidating user activity cache:", error);
    return 0;
  }
}

export async function setUserActivityCache(
  userId: string, 
  activityData: { lastLogin: Date | null }, 
  ttl: number = USER_CACHE_TTL.ACTIVITY_DATA
): Promise<boolean> {
  try {
    const cacheKey = `cache:api:users:activity:${userId}`;
    await cacheRedis.setex(cacheKey, ttl, JSON.stringify(activityData));
    return true;
  } catch (error) {
    console.error("Error setting user activity cache:", error);
    return false;
  }
}

export async function getUserActivityCache(userId: string): Promise<{ lastLogin: Date | null } | null> {
  try {
    const cacheKey = `cache:api:users:activity:${userId}`;
    const cached = await cacheRedis.get(cacheKey);
    
    if (cached) {
      return typeof cached === 'string' ? JSON.parse(cached) : cached;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting user activity cache:", error);
    return null;
  }
}
