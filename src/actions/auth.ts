"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { nanoid } from "nanoid";
import { sendPasswordResetEmail, sendNewAccountEmail } from "@/lib/mail";
import { loginSchema, forgotPasswordSchema, createUserSchema } from "@/lib/zod";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Inicializar Redis cliente
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// Configurar limitador específico para login
const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 intentos por 15 minutos
  analytics: true,
  prefix: "ratelimit:login",
});

// Función para verificar si el usuario excedió el límite de intentos
async function checkLoginRateLimit(
  email: string
): Promise<{ limited: boolean; remaining: number }> {
  try {
    console.log("Verificando rate limit para:", email);

    // Intentar consumir un token de la tasa
    const { success, limit, remaining } = await loginLimiter.limit(email);

    console.log(
      `Rate limit status: success=${success}, remaining=${remaining}, limit=${limit}`
    );

    return {
      limited: !success,
      remaining: remaining,
    };
  } catch (error) {
    console.error("Error verificando rate limit:", error);
    return { limited: false, remaining: 5 }; // En caso de error, permitir el intento
  }
}

export const loginAction = async (values: z.infer<typeof loginSchema>) => {
  try {
    // Verificar si el usuario ha excedido los intentos de inicio de sesión usando Redis
    const { limited, remaining } = await checkLoginRateLimit(values.email);

    if (limited) {
      return {
        error:
          "Demasiados intentos fallidos. Por favor, inténtalo de nuevo en 15 minutos o usa la opción de recuperar contraseña.",
      };
    }

    console.log(`Intentos restantes para ${values.email}: ${remaining}`);

    // Intentar iniciar sesión
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    if (res?.error) {
      console.log(`Error de autenticación para ${values.email}: ${res.error}`);
      return { error: res.error || "Error de autenticación" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error capturado en loginAction:", error);

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

    const emailResult = await sendNewAccountEmail(email, name, password);

    if (emailResult.error) {
      console.error(
        "Error al enviar correo al nuevo usuario:",
        emailResult.error
      );
    }

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
