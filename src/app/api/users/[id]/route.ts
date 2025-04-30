import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const p = await Promise.resolve(params);
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

    // Nueva validación de permisos basada en roles
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

    try {
    } catch (error) {
      console.log(
        "No se pudo registrar el usuario eliminado en lista negra:",
        error
      );
    }

    await db.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: "Usuario eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    return NextResponse.json(
      { error: "Error al eliminar el usuario" },
      { status: 500 }
    );
  }
}
