"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { sendPasswordResetEmail } from "@/lib/mail";

const loginSchema = z.object({
  email: z.string().email({ message: "Ingrese un correo electrónico válido" }),
  password: z
    .string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
});

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Ingrese un correo electrónico válido" }),
});

const createUserSchema = z.object({
  name: z.string().min(2, { message: "El nombre es obligatorio" }),
  email: z.string().email({ message: "Ingrese un correo electrónico válido" }),
  password: z
    .string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
  role: z.enum(["admin", "seller"], { message: "Rol no válido" }),
});

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
  adminId: string
) => {
  try {
    const { name, email, password, role } = values;

    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: "El usuario ya existe" };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await db.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role,
        createdBy: adminId,
      },
    });

    return {
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    };
  } catch (error) {
    console.error("Error al crear usuario:", error);
    return { error: "Error al crear el usuario" };
  }
};
