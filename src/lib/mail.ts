import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom =
  process.env.EMAIL_FROM || "administracion@telasytejidosluciana.com";
const nextAuthUrl = process.env.NEXTAUTH_URL;

if (!resendApiKey) {
  console.error("❌ RESEND_API_KEY no está configurada");
}

if (!nextAuthUrl) {
  console.error("❌ NEXTAUTH_URL no está configurada");
}

export const resend = new Resend(resendApiKey);

function validateResendConfig(): { isValid: boolean; error?: string } {
  if (!resendApiKey) {
    return { isValid: false, error: "RESEND_API_KEY no configurada" };
  }

  if (!resendApiKey.startsWith("re_")) {
    return { isValid: false, error: "RESEND_API_KEY tiene formato inválido" };
  }

  if (!nextAuthUrl) {
    return { isValid: false, error: "NEXTAUTH_URL no configurada" };
  }

  return { isValid: true };
}

if (process.env.NODE_ENV !== "production") {
  const validation = validateResendConfig();
  if (validation.isValid) {
    console.log("✅ Resend configurado correctamente");
  } else {
    console.error(`❌ ${validation.error}`);
  }
}

function getErrorMessage(error: unknown): string {
  let errorMessage = "Error desconocido al enviar correo";

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: string }).message;
    if (message.includes("API key is invalid")) {
      errorMessage = "Clave API de Resend inválida";
    } else if (message.includes("Invalid from field")) {
      errorMessage = "Dirección de correo remitente inválida";
    } else if (message.includes("not allowed")) {
      errorMessage = "Dominio no verificado en Resend";
    } else if (message.includes("rate limit")) {
      errorMessage = "Límite de envío excedido";
    } else {
      errorMessage = message;
    }
  }

  return errorMessage;
}

export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const validation = validateResendConfig();
    if (!validation.isValid) {
      return { error: `Error de configuración: ${validation.error}` };
    }

    const resetUrl = `${nextAuthUrl}/reset-password?token=${token}`;

    console.log(`Intentando enviar correo de restablecimiento a: ${to}`);
    console.log(`URL de restablecimiento: ${resetUrl}`);

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [to],
      subject: "Restablecimiento de contraseña",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Restablecimiento de contraseña</h2>
          <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
          <p style="margin: 20px 0;">
            <a 
              href="${resetUrl}" 
              style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;"
            >
              Restablecer contraseña
            </a>
          </p>
          <p>Este enlace expirará en 2 horas.</p>
          <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            Este es un correo automático, por favor no respondas a este mensaje.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(`❌ Error al enviar correo a ${to}:`, error);
      const errorMessage = getErrorMessage(error);
      return { error: `Error al enviar correo: ${errorMessage}` };
    }

    console.log(`✅ Correo enviado: ${data?.id}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Error crítico al enviar correo a ${to}:`, error);

    let errorMessage = "Error inesperado";
    if (error instanceof Error) {
      if (error.message.includes("fetch")) {
        errorMessage = "Error de conexión con Resend";
      } else if (error.message.includes("timeout")) {
        errorMessage = "Timeout al conectar con Resend";
      } else {
        errorMessage = error.message;
      }
    }

    return { error: `Error al enviar correo: ${errorMessage}` };
  }
}

export async function sendNewAccountEmail(
  to: string,
  name: string,
  password: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const validation = validateResendConfig();
    if (!validation.isValid) {
      return { error: `Error de configuración: ${validation.error}` };
    }

    const loginUrl = `${nextAuthUrl}/login`;

    console.log(`Intentando enviar correo de nueva cuenta a: ${to}`);

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [to],
      subject: "Tu cuenta ha sido creada",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Bienvenido/a, ${name}</h2>
          <p>Tu cuenta ha sido creada exitosamente en el sistema.</p>
          <p>Tus credenciales de acceso son:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p><strong>Correo electrónico:</strong> ${to}</p>
            <p><strong>Contraseña temporal:</strong> ${password}</p>
          </div>
          <p>Por seguridad, te recomendamos cambiar tu contraseña después de iniciar sesión por primera vez.</p>
          <p style="margin: 20px 0;">
            <a 
              href="${loginUrl}" 
              style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;"
            >
              Iniciar sesión
            </a>
          </p>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            Este es un correo automático, por favor no respondas a este mensaje.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(`❌ Error al enviar correo a ${to}:`, error);
      const errorMessage = getErrorMessage(error);
      return { error: `Error al enviar correo: ${errorMessage}` };
    }

    console.log(`✅ Correo de nueva cuenta enviado a: ${to} - ID: ${data?.id}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Error crítico al enviar correo a ${to}:`, error);

    let errorMessage = "Error inesperado";
    if (error instanceof Error) {
      if (error.message.includes("fetch")) {
        errorMessage = "Error de conexión con Resend";
      } else if (error.message.includes("timeout")) {
        errorMessage = "Timeout al conectar con Resend";
      } else {
        errorMessage = error.message;
      }
    }

    return { error: `Error al enviar correo: ${errorMessage}` };
  }
}

export async function sendContactEmail(
  name: string,
  email: string,
  subject: string,
  message: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const validation = validateResendConfig();
    if (!validation.isValid) {
      return { error: `Error de configuración: ${validation.error}` };
    }

    const { data: adminData, error: adminError } = await resend.emails.send({
      from: emailFrom,
      to: ["administracion@telasytejidosluciana.com"],
      replyTo: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Nuevo mensaje de contacto</h2>
          <p><strong>Nombre:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Asunto:</strong> ${subject}</p>
          <div style="margin-top: 20px;">
            <p><strong>Mensaje:</strong></p>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
        </div>
      `,
    });

    if (adminError) {
      console.error(`❌ Error al enviar correo al administrador:`, adminError);
      return {
        error: `Error al enviar correo: ${(adminError as { message?: string }).message || "Error desconocido"}`,
      };
    }

    const { data: userData, error: userError } = await resend.emails.send({
      from: emailFrom,
      to: [email],
      subject: `Confirmación: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Gracias por contactarnos</h2>
          <p>Hemos recibido su mensaje y nos pondremos en contacto con usted lo antes posible.</p>
          <div style="margin-top: 20px; background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
            <p><strong>Detalles de su mensaje:</strong></p>
            <p><strong>Nombre:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Asunto:</strong> ${subject}</p>
            <p><strong>Mensaje:</strong></p>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
        </div>
      `,
    });

    if (userError) {
      console.error(`❌ Error al enviar confirmación al usuario:`, userError);
      return {
        error: `Error al enviar correo: ${(userError as { message?: string }).message || "Error desconocido"}`,
      };
    }

    console.log(
      `✅ Correos de contacto enviados - Admin: ${adminData?.id}, Usuario: ${userData?.id}`
    );
    return { success: true };
  } catch (error) {
    console.error(`❌ Error crítico al enviar correos de contacto:`, error);
    return { error: `Error al enviar correo: ${(error as Error).message}` };
  }
}
