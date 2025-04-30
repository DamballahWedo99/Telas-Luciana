import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
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

    // Aplicar rate limiting para API general
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes a la API de usuarios. Por favor, inténtalo de nuevo más tarde.",
    });

    // Si se alcanzó el límite de tasa, devolver la respuesta de error
    if (rateLimitResult) {
      return rateLimitResult;
    }

    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return NextResponse.json(
      { error: "Error al obtener los usuarios" },
      { status: 500 }
    );
  }
}
