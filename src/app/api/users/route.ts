import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { withCache, invalidateCachePattern, USER_CACHE_TTL } from "@/lib/cache-middleware";

interface UserFilters {
  role?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

async function getUsersData(request: NextRequest) {
  const session = await auth();

  if (
    !session ||
    !session.user ||
    (session.user.role !== "admin" && session.user.role !== "major_admin")
  ) {
    return NextResponse.json(
      { error: "No tienes permisos para ver esta información" },
      { status: 403 }
    );
  }

  const rateLimitResult = await rateLimit(request, {
    type: "api",
    message:
      "Demasiadas solicitudes a la API de usuarios. Por favor, inténtalo de nuevo más tarde.",
  });

  if (rateLimitResult) {
    return rateLimitResult;
  }

  const { searchParams } = new URL(request.url);
  const filters: UserFilters = {};

  if (searchParams.get("role")) {
    filters.role = searchParams.get("role")!;
  }
  if (searchParams.get("isActive")) {
    filters.isActive = searchParams.get("isActive") === "true";
  }

  const users = await db.user.findMany({
    where: filters,
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

  return NextResponse.json({
    users: users,
    meta: {
      fromCache: false,
      latency: "0ms",
      timestamp: new Date().toISOString(),
      count: users.length,
    },
  });
}

const getCachedUsers = withCache(getUsersData, {
  keyPrefix: "api:users",
  ttl: USER_CACHE_TTL.COMBINED_DATA,
  skipCache: (req) => {
    const url = new URL(req.url);
    return url.searchParams.get("refresh") === "true" || 
           url.searchParams.get("includeActivity") === "true";
  },
  skipCacheForLastLogin: true,
  onCacheHit: (key) => console.log(`📦 Cache HIT - Usuarios: ${key}`),
  onCacheMiss: (key) => console.log(`💾 Cache MISS - Usuarios: ${key}`),
});

export { getCachedUsers as GET };

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (
      !session ||
      !session.user ||
      (session.user.role !== "admin" && session.user.role !== "major_admin")
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();

    const result = await db.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: body.password,
        role: body.role || "seller",
      },
    });

    await Promise.all([
      invalidateCachePattern("cache:api:users*"),
      invalidateCachePattern("cache:dashboard:*"),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
      },
      cache: { invalidated: true },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (
      !session ||
      !session.user ||
      (session.user.role !== "admin" && session.user.role !== "major_admin")
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    const result = await db.user.update({
      where: { id },
      data: updateData,
    });

    await invalidateCachePattern("cache:api:users*");

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
      },
      cache: { invalidated: true },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
