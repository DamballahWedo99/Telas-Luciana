import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    // Aplicar rate limiting para API general
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes de verificación. Por favor, inténtalo de nuevo más tarde.",
    });

    // Si se alcanzó el límite de tasa, devolver la respuesta de error
    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { exists: false, message: "No hay sesión activa" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { exists: false, message: "Usuario no encontrado" },
        { status: 200 }
      );
    }

    return NextResponse.json({ exists: true });
  } catch (error) {
    console.error("Error verificando usuario:", error);
    return NextResponse.json(
      { error: "Error al verificar usuario" },
      { status: 500 }
    );
  }
}
