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

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  analytics: true,
  prefix: "ratelimit:login",
});

async function checkLoginRateLimit(
  email: string
): Promise<{ limited: boolean; remaining: number }> {
  try {
    console.log("Verificando rate limit para:", email);

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
    return { limited: false, remaining: 5 };
  }
}

export const loginAction = async (values: z.infer<typeof loginSchema>) => {
  try {
    const { limited, remaining } = await checkLoginRateLimit(values.email);

    if (limited) {
      return {
        error:
          "Demasiados intentos fallidos. Por favor, inténtalo de nuevo en 15 minutos o usa la opción de recuperar contraseña.",
      };
    }

    console.log(`Intentos restantes para ${values.email}: ${remaining}`);

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
  let createdUser = null;

  try {
    const validatedFields = createUserSchema.safeParse(values);

    if (!validatedFields.success) {
      return {
        error: "Datos inválidos",
      };
    }

    const { name, email, password, role } = validatedFields.data;

    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY no está configurada en producción");
      return {
        error:
          "Error: RESEND_API_KEY no configurada. Contacta al administrador.",
      };
    }

    if (!process.env.EMAIL_FROM && !process.env.NEXTAUTH_URL) {
      console.error(
        "❌ Variables de entorno EMAIL_FROM o NEXTAUTH_URL faltantes"
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return {
        error: "El correo electrónico ya está registrado",
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(`Creando usuario en BD: ${email}`);
    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        createdBy: createdById,
      },
    });

    createdUser = user;
    console.log(`✅ Usuario creado en BD exitosamente: ${user.id}`);

    try {
      console.log(`Intentando enviar email de bienvenida a: ${email}`);
      const emailResult = await sendNewAccountEmail(email, name, password);

      if (emailResult.error) {
        console.error(
          "⚠️ Error al enviar correo de bienvenida:",
          emailResult.error
        );
        console.error(
          "⚠️ El usuario fue creado pero no se pudo enviar el email"
        );

        let userFriendlyError =
          "Usuario creado exitosamente, pero hubo un problema enviando el email de bienvenida: ";

        if (
          emailResult.error.includes("API key is invalid") ||
          emailResult.error.includes("Clave API de Resend inválida")
        ) {
          userFriendlyError += "API Key de Resend inválida";
        } else if (
          emailResult.error.includes("Invalid from field") ||
          emailResult.error.includes("Dirección de correo remitente inválida")
        ) {
          userFriendlyError +=
            "Dirección de correo no configurada correctamente";
        } else if (
          emailResult.error.includes("not allowed") ||
          emailResult.error.includes("Dominio no verificado")
        ) {
          userFriendlyError += "Dominio de correo no verificado en Resend";
        } else if (
          emailResult.error.includes("rate limit") ||
          emailResult.error.includes("Límite de envío excedido")
        ) {
          userFriendlyError += "Límite de envío de correos excedido";
        } else if (
          emailResult.error.includes("conexión") ||
          emailResult.error.includes("timeout")
        ) {
          userFriendlyError += "Problema de conexión con el servicio de correo";
        } else {
          userFriendlyError += emailResult.error;
        }

        return {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          emailSent: false,
          warning: userFriendlyError,
        };
      } else {
        console.log(`✅ Email de bienvenida enviado exitosamente a: ${email}`);
      }
    } catch (emailError) {
      console.error("❌ Error crítico al enviar email:", emailError);
      console.error(
        "⚠️ El usuario fue creado pero falló el envío del email completamente"
      );

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        emailSent: false,
        warning:
          "Usuario creado exitosamente, pero falló completamente el envío del email de bienvenida. Verifica la configuración de Resend.",
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      emailSent: true,
    };
  } catch (error) {
    console.error("❌ Error crítico al crear usuario:", error);

    if (createdUser) {
      try {
        console.log(`Limpiando usuario creado por error: ${createdUser.id}`);
        await db.user.delete({
          where: { id: createdUser.id },
        });
        console.log(`✅ Usuario ${createdUser.id} eliminado por rollback`);
      } catch (deleteError) {
        console.error("❌ Error al hacer rollback del usuario:", deleteError);
      }
    }

    if (error instanceof Error) {
      if (error.message.includes("Unique constraint")) {
        return { error: "El correo electrónico ya está registrado" };
      }
      if (error.message.includes("RESEND")) {
        return {
          error:
            "Error crítico en el servicio de email. Usuario no creado: " +
            error.message,
        };
      }
      if (error.message.includes("Database")) {
        return { error: "Error de base de datos: " + error.message };
      }
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        return { error: "Error de conexión de red: " + error.message };
      }
    }

    return {
      error:
        "Error desconocido al crear el usuario: " +
        (error instanceof Error ? error.message : String(error)),
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
