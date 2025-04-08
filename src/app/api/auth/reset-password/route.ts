import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: "El token es requerido" }),
  password: z
    .string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = resetPasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.format() },
        { status: 400 }
      );
    }

    const { token, password } = result.data;

    const user = await db.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "El enlace es inválido o ha expirado" },
        { status: 400 }
      );
    }

    const passwordHistory = user.passwordHistory || [];

    const allPasswords = user.password
      ? [...passwordHistory, user.password]
      : passwordHistory;

    const isPasswordUsed = await Promise.all(
      allPasswords.map((oldPassword) =>
        bcrypt.compare(password, oldPassword as string)
      )
    ).then((results) => results.some((match) => match));

    if (isPasswordUsed) {
      return NextResponse.json(
        { error: "No puedes reutilizar una contraseña anterior" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newPasswordHistory = [
      ...passwordHistory.slice(-4),
      user.password,
    ].filter(Boolean);

    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        passwordHistory: newPasswordHistory as string[],
        lastLogin: new Date(),
      },
    });

    return NextResponse.json(
      { success: true, message: "Contraseña actualizada correctamente" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error en reset-password:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token no proporcionado" },
        { status: 400 }
      );
    }

    const passwordReset = await db.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
        isActive: true,
      },
    });

    return NextResponse.json(
      { valid: Boolean(passwordReset) },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al verificar token:", error);
    return NextResponse.json(
      { valid: false, error: "Error al verificar token" },
      { status: 500 }
    );
  }
}
