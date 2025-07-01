import { cacheRedis, generateCacheKey, CACHE_TTL } from "./redis";
import { db } from "./db";

interface UserFilters {
  role?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

export class InventoryCache {
  static async getUsers(filters: UserFilters = {}) {
    const cacheKey = generateCacheKey("users", filters);

    try {
      const cached = await cacheRedis.get(cacheKey);

      if (cached) {
        console.log("📦 Cache HIT - Users data served from Redis");
        return {
          data: cached,
          fromCache: true,
          latency: "sub-millisecond",
        };
      }

      console.log("💾 Cache MISS - Fetching users from database");
      const startTime = Date.now();

      const users = await db.user.findMany({
        where: {
          ...filters,
          isActive: filters.isActive !== undefined ? filters.isActive : true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const dbLatency = Date.now() - startTime;

      await cacheRedis.setex(
        cacheKey,
        CACHE_TTL.USER_DATA,
        JSON.stringify(users)
      );

      return {
        data: users,
        fromCache: false,
        latency: `${dbLatency}ms`,
      };
    } catch (error) {
      console.error("Redis error, falling back to database:", error);
      return {
        data: await db.user.findMany({ where: filters }),
        fromCache: false,
        latency: "error",
      };
    }
  }

  static async getDashboardMetrics() {
    const cacheKey = "cache:dashboard:metrics:main";

    try {
      const cached = await cacheRedis.get(cacheKey);

      if (cached) {
        console.log("📊 Dashboard metrics served from cache");
        return cached;
      }

      const [totalUsers, activeUsers, usersByRole, recentUsers] =
        await Promise.all([
          db.user.count(),
          db.user.count({ where: { isActive: true } }),
          db.user.groupBy({
            by: ["role"],
            _count: { role: true },
          }),
          db.user.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
            },
          }),
        ]);

      const metrics = {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        usersByRole: usersByRole.reduce(
          (acc, item) => {
            acc[item.role] = item._count.role;
            return acc;
          },
          {} as Record<string, number>
        ),
        recentUsers,
        lastUpdated: new Date().toISOString(),
      };

      await cacheRedis.setex(
        cacheKey,
        CACHE_TTL.USER_DATA,
        JSON.stringify(metrics)
      );

      return metrics;
    } catch (error) {
      console.error("Cache error in dashboard metrics:", error);
      throw error;
    }
  }

  static async searchUsers(searchTerm: string, role?: string) {
    const cacheKey = generateCacheKey("search:users", {
      term: searchTerm,
      role: role || "all",
    });

    try {
      const cached = await cacheRedis.get(cacheKey);

      if (cached) {
        return { data: cached, fromCache: true };
      }

      const users = await db.user.findMany({
        where: {
          AND: [
            searchTerm
              ? {
                  OR: [
                    { name: { contains: searchTerm, mode: "insensitive" } },
                    { email: { contains: searchTerm, mode: "insensitive" } },
                  ],
                }
              : {},
            role ? { role } : {},
            { isActive: true },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          lastLogin: true,
          createdAt: true,
        },
      });

      await cacheRedis.setex(
        cacheKey,
        CACHE_TTL.USER_DATA,
        JSON.stringify(users)
      );

      return { data: users, fromCache: false };
    } catch (error) {
      console.error("Search cache error:", error);
      throw error;
    }
  }

  static async getUserById(id: string) {
    const cacheKey = generateCacheKey("user:detail", { id });

    try {
      const cached = await cacheRedis.get(cacheKey);

      if (cached) {
        return { data: cached, fromCache: true };
      }

      const user = await db.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (user) {
        await cacheRedis.setex(
          cacheKey,
          CACHE_TTL.USER_DATA,
          JSON.stringify(user)
        );
      }

      return { data: user, fromCache: false };
    } catch (error) {
      console.error("User detail cache error:", error);
      throw error;
    }
  }

  static async invalidateUserCache(userId?: string) {
    try {
      const patterns = userId
        ? [`cache:user:*:id:${userId}*`, `cache:users:*`]
        : ["cache:users:*", "cache:search:users:*", "cache:dashboard:*"];

      for (const pattern of patterns) {
        const keys = await cacheRedis.keys(pattern);
        if (keys.length > 0) {
          await cacheRedis.del(...keys);
          console.log(
            `🗑️ Invalidated ${keys.length} cache entries for pattern: ${pattern}`
          );
        }
      }
    } catch (error) {
      console.error("Error invalidating user cache:", error);
    }
  }

  static async invalidateSearchCache() {
    try {
      const keys = await cacheRedis.keys("cache:search:*");
      if (keys.length > 0) {
        await cacheRedis.del(...keys);
        console.log(`🗑️ Invalidated ${keys.length} search cache entries`);
      }
    } catch (error) {
      console.error("Error invalidating search cache:", error);
    }
  }

  static async getCacheStats() {
    try {
      const [userKeys, dashboardKeys, searchKeys] = await Promise.all([
        cacheRedis.keys("cache:users:*"),
        cacheRedis.keys("cache:dashboard:*"),
        cacheRedis.keys("cache:search:*"),
      ]);

      return {
        users: userKeys.length,
        dashboard: dashboardKeys.length,
        search: searchKeys.length,
        total: userKeys.length + dashboardKeys.length + searchKeys.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error getting cache stats:", error);
      return null;
    }
  }

  static async invalidateAllCache() {
    try {
      const keys = await cacheRedis.keys("cache:*");
      if (keys.length > 0) {
        await cacheRedis.del(...keys);
        console.log(`🗑️ Invalidated ALL cache (${keys.length} entries)`);
      }
    } catch (error) {
      console.error("Error invalidating all cache:", error);
    }
  }
}
