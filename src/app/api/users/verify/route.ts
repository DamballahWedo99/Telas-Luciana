import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
  try {
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
