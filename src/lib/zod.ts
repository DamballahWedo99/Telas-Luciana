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

export const createClienteSchema = z.object({
  empresa: z
    .string()
    .max(100, {
      message: "El nombre de la empresa no puede tener más de 100 caracteres",
    })
    .regex(/^[^<>]*$/, {
      message: "El nombre de la empresa no puede contener los caracteres < o >",
    })
    .optional()
    .or(z.literal("")),
  contacto: z
    .string()
    .min(1, { message: "El nombre de la persona es obligatorio" })
    .max(50, { message: "El contacto no puede tener más de 50 caracteres" })
    .regex(/^[^<>]+$/, {
      message: "El contacto no puede contener los caracteres < o >",
    }),
  direccion: z
    .string()
    .max(200, { message: "La dirección no puede tener más de 200 caracteres" })
    .regex(/^[^<>]*$/, {
      message: "La dirección no puede contener los caracteres < o >",
    })
    .optional()
    .or(z.literal("")),
  telefono: z
    .string()
    .min(1, { message: "El teléfono es obligatorio" })
    .max(20, { message: "El teléfono no puede tener más de 20 caracteres" })
    .regex(/^[0-9\s\-\+\(\)]+$/, {
      message:
        "El teléfono solo puede contener números, espacios, guiones, + y paréntesis",
    }),
  email: z
    .string()
    .email({ message: "Por favor, ingrese un correo electrónico válido" })
    .regex(/^[^\s<>]*$/, {
      message: "El correo no puede contener espacios ni caracteres < o >",
    })
    .optional()
    .or(z.literal("")),
  vendedor: z
    .string()
    .max(50, { message: "El vendedor no puede tener más de 50 caracteres" })
    .regex(/^[^<>]*$/, {
      message: "El vendedor no puede contener los caracteres < o >",
    })
    .optional()
    .or(z.literal("")),
  ubicacion: z
    .string()
    .max(50, { message: "La ubicación no puede tener más de 50 caracteres" })
    .regex(/^[^<>]*$/, {
      message: "La ubicación no puede contener los caracteres < o >",
    })
    .optional()
    .or(z.literal("")),
  comentarios: z
    .string()
    .max(500, {
      message: "Los comentarios no pueden tener más de 500 caracteres",
    })
    .regex(/^[^<>]*$/, {
      message: "Los comentarios no pueden contener los caracteres < o >",
    })
    .optional()
    .or(z.literal("")),
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
  Importacion: z.enum(["DA", "HOY", ""]).optional(),
});

export const editOrderSchema = z.object({
  proveedor: z
    .string()
    .min(1, { message: "El proveedor es obligatorio" })
    .max(50, { message: "El proveedor no puede tener más de 50 caracteres" })
    .regex(/^[^<>'";&|`$(){}[\]\\]*$/, { message: "El proveedor contiene caracteres no permitidos" }),
  incoterm: z
    .string()
    .min(1, { message: "El incoterm es obligatorio" })
    .max(20, { message: "El incoterm no puede tener más de 20 caracteres" })
    .regex(/^[^<>'";&|`$(){}[\]\\]*$/, { message: "El incoterm contiene caracteres no permitidos" }),
  transportista: z
    .string()
    .min(1, { message: "El transportista es obligatorio" })
    .max(50, { message: "El transportista no puede tener más de 50 caracteres" })
    .regex(/^[^<>'";&|`$(){}[\]\\]*$/, { message: "El transportista contiene caracteres no permitidos" }),
  agente_aduanal: z
    .string()
    .max(50, { message: "El agente aduanal no puede tener más de 50 caracteres" })
    .regex(/^[^<>'";&|`$(){}[\]\\]*$/, { message: "El agente aduanal contiene caracteres no permitidos" })
    .optional()
    .or(z.literal("")),
  fecha_pedido: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}|)$/, { message: "Formato de fecha inválido" })
    .refine((val) => {
      if (!val) return true; // Permitir vacío
      const year = parseInt(val.split('-')[0]);
      const currentYear = new Date().getFullYear();
      return year <= currentYear;
    }, { message: "No se permiten fechas futuras" })
    .optional()
    .or(z.literal("")),
  sale_origen: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}|)$/, { message: "Formato de fecha inválido" })
    .refine((val) => {
      if (!val) return true;
      const year = parseInt(val.split('-')[0]);
      const currentYear = new Date().getFullYear();
      return year <= currentYear;
    }, { message: "No se permiten fechas futuras" })
    .optional()
    .or(z.literal("")),
  pago_credito: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}|)$/, { message: "Formato de fecha inválido" })
    .refine((val) => {
      if (!val) return true;
      const year = parseInt(val.split('-')[0]);
      const currentYear = new Date().getFullYear();
      return year <= currentYear;
    }, { message: "No se permiten fechas futuras" })
    .optional()
    .or(z.literal("")),
  llega_a_mexico: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}|)$/, { message: "Formato de fecha inválido" })
    .refine((val) => {
      if (!val) return true;
      const year = parseInt(val.split('-')[0]);
      const currentYear = new Date().getFullYear();
      return year <= currentYear;
    }, { message: "No se permiten fechas futuras" })
    .optional()
    .or(z.literal("")),
  llega_almacen_proveedor: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}|)$/, { message: "Formato de fecha inválido" })
    .refine((val) => {
      if (!val) return true;
      const year = parseInt(val.split('-')[0]);
      const currentYear = new Date().getFullYear();
      return year <= currentYear;
    }, { message: "No se permiten fechas futuras" })
    .optional()
    .or(z.literal("")),
  pedimento: z
    .string()
    .max(30, { message: "El pedimento no puede tener más de 30 caracteres" })
    .regex(/^[^<>'";&|`$(){}[\]\\]*$/, { message: "El pedimento contiene caracteres no permitidos" })
    .optional()
    .or(z.literal("")),
  factura_proveedor: z
    .string()
    .max(30, { message: "La factura del proveedor no puede tener más de 30 caracteres" })
    .regex(/^[^<>'";&|`$(){}[\]\\]*$/, { message: "La factura del proveedor contiene caracteres no permitidos" })
    .optional()
    .or(z.literal("")),
  reporte_inspeccion: z
    .string()
    .max(50, { message: "El reporte de inspección no puede tener más de 50 caracteres" })
    .regex(/^[^<>'";&|`$(){}[\]\\]*$/, { message: "El reporte de inspección contiene caracteres no permitidos" })
    .optional()
    .or(z.literal("")),
  pedimento_tránsito: z
    .string()
    .max(30, { message: "El pedimento de tránsito no puede tener más de 30 caracteres" })
    .regex(/^[^<>'";&|`$(){}[\]\\]*$/, { message: "El pedimento de tránsito contiene caracteres no permitidos" })
    .optional()
    .or(z.literal("")),
  precio_m_fob_usd: z
    .number({ message: "El precio FOB debe ser un número" })
    .min(0, { message: "El precio FOB debe ser mayor o igual a 0" })
    .max(999999.99, { message: "El precio FOB no puede ser mayor a 999,999.99" }),
  tipo_de_cambio: z
    .number({ message: "El tipo de cambio debe ser un número" })
    .min(0.0001, { message: "El tipo de cambio debe ser mayor a 0" })
    .max(99.9999, { message: "El tipo de cambio no puede ser mayor a 99.9999" }),
});

export const editTelaSchema = z.object({
  venta: z
    .number({ message: "El precio de venta debe ser un número" })
    .min(0.01, { message: "El precio de venta debe ser mayor a 0" })
    .max(999999.99, { message: "El precio de venta no puede ser mayor a 999,999.99" }),
  m_factura: z
    .number({ message: "Los metros factura deben ser un número" })
    .min(0.01, { message: "Los metros factura deben ser mayor a 0" })
    .max(999999.99, { message: "Los metros factura no pueden ser mayor a 999,999.99" }),
  total_factura: z
    .number({ message: "El total factura debe ser un número" })
    .min(0.01, { message: "El total factura debe ser mayor a 0" })
    .max(999999.99, { message: "El total factura no puede ser mayor a 999,999.99" }),
});

export const createProveedorSchema = z.object({
  Empresa: z
    .string()
    .min(1, { message: "El nombre de la empresa es obligatorio" })
    .max(200, {
      message: "El nombre de la empresa no puede tener más de 200 caracteres",
    })
    .regex(/^[^<>]+$/, {
      message: "El nombre de la empresa no puede contener los caracteres < o >",
    }),
  "Nombre de contacto": z
    .string()
    .max(100, { message: "El nombre de contacto no puede tener más de 100 caracteres" })
    .regex(/^[^<>]*$/, {
      message: "El nombre de contacto no puede contener los caracteres < o >",
    })
    .optional()
    .or(z.literal("")),
  Teléfono: z
    .string()
    .max(50, { message: "El teléfono no puede tener más de 50 caracteres" })
    .regex(/^[0-9\s\-\+\(\)]*$/, {
      message:
        "El teléfono solo puede contener números, espacios, guiones, + y paréntesis",
    })
    .optional()
    .or(z.literal("")),
  Correo: z
    .string()
    .min(1, { message: "El correo electrónico es obligatorio" })
    .email({ message: "Por favor, ingrese un correo electrónico válido" })
    .regex(/^[^\s<>]+$/, {
      message: "El correo no puede contener espacios ni caracteres < o >",
    }),
  Producto: z
    .string()
    .max(100, { message: "El producto no puede tener más de 100 caracteres" })
    .regex(/^[^<>]*$/, {
      message: "El producto no puede contener los caracteres < o >",
    })
    .optional()
    .or(z.literal("")),
});

export type NewRowFormValues = z.infer<typeof newRowSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
export type CreateUserFormValues = z.infer<typeof createUserSchema>;
export type CreateClienteFormValues = z.infer<typeof createClienteSchema>;
export type CreateProveedorFormValues = z.infer<typeof createProveedorSchema>;
export type EditOrderFormValues = z.infer<typeof editOrderSchema>;
export type EditTelaFormValues = z.infer<typeof editTelaSchema>;
