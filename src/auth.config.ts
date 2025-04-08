import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "./lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email({ message: "Ingrese un correo electrónico válido" }),
  password: z
    .string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
});

export default {
  providers: [
    Credentials({
      authorize: async (credentials) => {
        const { email, password } = credentials as {
          email: string;
          password: string;
        };

        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) {
          throw new Error(
            JSON.stringify({
              code: "INVALID_CREDENTIALS",
              message: "Credenciales no válidas",
            })
          );
        }

        const user = await db.user.findUnique({
          where: { email: email },
        });

        if (!user || !user.password || !user.isActive) {
          throw new Error(
            JSON.stringify({
              code: "INVALID_CREDENTIALS",
              message: "Credenciales no válidas o usuario inactivo",
            })
          );
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
          throw new Error(
            JSON.stringify({
              code: "INVALID_CREDENTIALS",
              message: "Credenciales no válidas",
            })
          );
        }

        await db.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        return user;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
