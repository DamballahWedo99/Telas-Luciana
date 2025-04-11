"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { sendPasswordResetEmail } from "@/lib/mail";
import { loginSchema, forgotPasswordSchema, createUserSchema } from "@/lib/zod";

export const loginAction = async (values: z.infer<typeof loginSchema>) => {
  try {
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    if (res?.error) {
      throw new AuthError(res.error);
    }

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: error.cause?.err?.message || "Error de autenticación" };
    }
    return { error: "Error del servidor" };
  }
};

export const forgotPasswordAction = async (
  values: z.infer<typeof forgotPasswordSchema>
) => {
  try {
    const { email } = values;

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { success: true };
    }

    const token = nanoid();
    const expires = new Date();
    expires.setHours(expires.getHours() + 2);

    await db.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expires,
      },
    });

    await sendPasswordResetEmail(email, token);

    return { success: true };
  } catch (error) {
    console.error("Error en forgot password:", error);
    return { error: "Error al procesar la solicitud" };
  }
};

export const createUserAction = async (
  values: z.infer<typeof createUserSchema>,
  createdById: string
) => {
  try {
    const validatedFields = createUserSchema.safeParse(values);

    if (!validatedFields.success) {
      return {
        error: "Datos inválidos",
      };
    }

    const { name, email, password, role } = validatedFields.data;

    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return {
        error: "El correo electrónico ya está registrado",
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        createdBy: createdById,
      },
    });

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  } catch (error) {
    console.error("Error al crear usuario:", error);
    return {
      error: "Error al crear el usuario",
    };
  }
};

export const toggleUserStatusAction = async (
  userId: string,
  isActive: boolean,
  currentUserId: string
) => {
  try {
    if (userId === currentUserId && !isActive) {
      return {
        error: "No puedes desactivar tu propia cuenta",
      };
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    return {
      success: true,
      user: updatedUser,
    };
  } catch (error) {
    console.error("Error al actualizar estado de usuario:", error);
    return {
      error: "Error al actualizar el estado del usuario",
    };
  }
};
