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

export const createUserSchema = z.object({
  name: z
    .string()
    .min(1, { message: "El nombre es obligatorio" })
    .max(30, { message: "El nombre no puede tener más de 30 caracteres" })
    .regex(/^[^<>]+$/, {
      message: "El nombre no puede contener los caracteres < o >",
    }),
  email: z
    .string()
    .email({ message: "Por favor, ingrese un correo electrónico válido" })
    .regex(/^[^\s<>]+$/, {
      message: "El correo no puede contener espacios ni caracteres < o >",
    }),
  password: z
    .string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres" })
    .max(30, { message: "La contraseña no puede tener más de 30 caracteres" })
    .regex(/[A-Z]/, { message: "Debe contener al menos una letra mayúscula" })
    .regex(/\d/, { message: "Debe contener al menos un número" })
    .regex(/^[^\s<>]+$/, {
      message: "La contraseña no puede contener espacios ni caracteres < o >",
    }),
  role: z.enum(["major_admin", "admin", "seller"], {
    message: "Rol no válido",
  }),
});

export const newRowSchema = z.object({
  OC: z
    .string()
    .min(1, { message: "El campo OC es obligatorio" })
    .max(50, { message: "El OC no puede tener más de 50 caracteres" })
    .regex(/^[^<>]+$/, {
      message: "El OC no puede contener los caracteres < o >",
    }),
  Tela: z
    .string()
    .min(1, { message: "El campo Tela es obligatorio" })
    .max(50, { message: "La Tela no puede tener más de 50 caracteres" })
    .regex(/^[^<>]+$/, {
      message: "La Tela no puede contener los caracteres < o >",
    }),
  Color: z
    .string()
    .min(1, { message: "El campo Color es obligatorio" })
    .max(30, { message: "El Color no puede tener más de 30 caracteres" })
    .regex(/^[^<>]+$/, {
      message: "El Color no puede contener los caracteres < o >",
    }),
  Ubicacion: z.enum(["CDMX", "Mérida"], {
    message: "Debe seleccionar una ubicación válida",
  }),
  Cantidad: z
    .number({ message: "La cantidad debe ser un número" })
    .min(0.01, { message: "La cantidad debe ser mayor a 0" })
    .max(999999.99, { message: "La cantidad no puede ser mayor a 999,999.99" }),
  Costo: z
    .number({ message: "El costo debe ser un número" })
    .min(0, { message: "El costo debe ser mayor o igual a 0" })
    .max(999999.99, { message: "El costo no puede ser mayor a 999,999.99" }),
  Unidades: z.enum(["KGS", "MTS"], {
    message: "Debe seleccionar una unidad válida",
  }),
  Importacion: z.enum(["DA", "HOY"], {
    message: "Debe seleccionar una importación válida",
  }),
  FacturaDragonAzteca: z
    .string()
    .max(50, { message: "La factura no puede tener más de 50 caracteres" })
    .regex(/^[^<>]*$/, {
      message: "La factura no puede contener los caracteres < o >",
    })
    .optional()
    .or(z.literal("")),
});

export type NewRowFormValues = z.infer<typeof newRowSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
export type CreateUserFormValues = z.infer<typeof createUserSchema>;
