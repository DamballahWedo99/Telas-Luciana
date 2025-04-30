import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Aplicar rate limiting para autenticación
  const rateLimitResult = await rateLimit(request, {
    type: "auth",
    message:
      "Demasiados intentos de recuperación de contraseña. Por favor, inténtalo de nuevo más tarde.",
  });

  // Si se alcanzó el límite de tasa, devolver la respuesta de error
  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const { email } = await request.json();
    console.log("Solicitud de recuperación para:", { email });

    if (!email) {
      return NextResponse.json(
        { error: "El correo electrónico es obligatorio" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      console.log("Usuario no encontrado o inactivo, simulando éxito");
      return NextResponse.json(
        {
          success: true,
          message: "Si el correo existe, recibirás instrucciones",
        },
        { status: 200 }
      );
    }

    const resetToken = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    await db.user.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiry: expiresAt,
      },
    });

    await sendPasswordResetEmail(email, resetToken);

    return NextResponse.json(
      {
        success: true,
        message: "Si el correo existe, recibirás instrucciones",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error en forgot-password:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
