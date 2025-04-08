import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .email({ message: "Por favor, ingrese un correo electrónico válido" })
    .regex(/^[^\s<>]+$/, {
      message: "El correo no puede contener espacios ni caracteres < o >",
    }),
  password: z
    .string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres" })
    .regex(/[a-z]/, { message: "Debe contener al menos una letra minúscula" })
    .regex(/[A-Z]/, { message: "Debe contener al menos una letra mayúscula" })
    .regex(/\d/, { message: "Debe contener al menos un número" })
    .regex(/^[^\s<>]+$/, {
      message: "La contraseña no puede contener espacios ni caracteres < o >",
    }),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({
      required_error: "El correo electrónico es obligatorio",
      invalid_type_error: "Debe ingresar un correo electrónico",
    })
    .trim()
    .min(1, { message: "El correo electrónico es obligatorio" })
    .email({ message: "Por favor, ingrese un correo electrónico válido" }),
});

export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, { message: "La contraseña debe tener al menos 8 caracteres" })
      .regex(/[a-z]/, { message: "Debe contener al menos una letra minúscula" })
      .regex(/[A-Z]/, { message: "Debe contener al menos una letra mayúscula" })
      .regex(/\d/, { message: "Debe contener al menos un número" })
      .regex(/^[^\s<>]+$/, {
        message: "La contraseña no puede contener espacios ni caracteres < o >",
      }),
    confirmPassword: z.string().regex(/^[^\s<>]+$/, {
      message:
        "La confirmación de la contraseña no puede contener espacios ni caracteres < o >",
    }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
