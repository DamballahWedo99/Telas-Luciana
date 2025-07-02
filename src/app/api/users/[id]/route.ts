import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { invalidateCachePattern } from "@/lib/cache-middleware";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes a la API de usuarios. Por favor, inténtalo de nuevo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const p = await params;
    const userId = p.id;

    if (!userId) {
      return NextResponse.json(
        { error: "ID de usuario no proporcionado" },
        { status: 400 }
      );
    }

    const session = await auth();

    if (
      !session ||
      !session.user ||
      (session.user.role !== "admin" && session.user.role !== "major_admin")
    ) {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propia cuenta" },
        { status: 400 }
      );
    }

    const userToDelete = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!userToDelete) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (session.user.role === "admin" && userToDelete.role !== "seller") {
      return NextResponse.json(
        { error: "Los administradores solo pueden eliminar vendedores" },
        { status: 403 }
      );
    }

    if (userToDelete.role === "major_admin") {
      const majorAdminCount = await db.user.count({
        where: { role: "major_admin" },
      });

      if (majorAdminCount <= 1) {
        return NextResponse.json(
          { error: "No se puede eliminar el último administrador principal" },
          { status: 400 }
        );
      }
    }

    await db.user.delete({
      where: { id: userId },
    });

    await invalidateCachePattern("cache:api:users*");

    console.log(
      `[USER-DELETE] User ${session.user.email} deleted user ${userToDelete.email}`
    );

    return NextResponse.json({
      success: true,
      message: "Usuario eliminado correctamente",
      cache: {
        invalidated: true,
        warming: "initiated",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error eliminando usuario:", error);
    return NextResponse.json(
      { error: "Error al eliminar el usuario", details: errorMessage },
      { status: 500 }
    );
  }
}
