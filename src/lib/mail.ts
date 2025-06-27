import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

if (process.env.NODE_ENV !== "production") {
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY no está configurada");
  } else {
    console.log("✅ Resend configurado correctamente");
  }
}

export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

    console.log(`Intentando enviar correo de restablecimiento a: ${to}`);
    console.log(`URL de restablecimiento: ${resetUrl}`);

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "administracion@telasytejidosluciana.com",
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
      return {
        error: `Error al enviar correo: ${error.message || "Error desconocido"}`,
      };
    }

    console.log(`✅ Correo enviado: ${data?.id}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Error al enviar correo a ${to}:`, error);
    return { error: `Error al enviar correo: ${(error as Error).message}` };
  }
}

export async function sendNewAccountEmail(
  to: string,
  name: string,
  password: string
): Promise<{ success?: boolean; error?: string }> {
  const loginUrl = `${process.env.NEXTAUTH_URL}/login`;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "administracion@telasytejidosluciana.com",
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
      return {
        error: `Error al enviar correo: ${error.message || "Error desconocido"}`,
      };
    }

    console.log(`✅ Correo de nueva cuenta enviado a: ${to} - ID: ${data?.id}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Error al enviar correo a ${to}:`, error);
    return { error: `Error al enviar correo: ${(error as Error).message}` };
  }
}

export async function sendContactEmail(
  name: string,
  email: string,
  subject: string,
  message: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { data: adminData, error: adminError } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "administracion@telasytejidosluciana.com",
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
        error: `Error al enviar correo: ${adminError.message || "Error desconocido"}`,
      };
    }

    const { data: userData, error: userError } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "administracion@telasytejidosluciana.com",
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
        error: `Error al enviar correo: ${userError.message || "Error desconocido"}`,
      };
    }

    console.log(
      `✅ Correos de contacto enviados - Admin: ${adminData?.id}, Usuario: ${userData?.id}`
    );
    return { success: true };
  } catch (error) {
    console.error(`❌ Error al enviar correos de contacto:`, error);
    return { error: `Error al enviar correo: ${(error as Error).message}` };
  }
}

export async function sendInventoryEmail(
  to: string,
  csvData: string,
  pdfBuffer: Buffer,
  fileName: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const currentDate = new Date().toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Mexico_City",
    });

    console.log(`📧 Enviando reporte de inventario a: ${to}`);

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "administracion@telasytejidosluciana.com",
      to: [to],
      subject: `Reporte de Inventario Semanal - ${currentDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">📊 Reporte de Inventario Semanal</h2>
          <p>Buenos días,</p>
          <p>Adjunto encontrará el reporte de inventario correspondiente al ${currentDate}.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #495057; margin-top: 0;">📋 Contenido del reporte:</h3>
            <ul style="color: #666;">
              <li><strong>Excel (CSV):</strong> Datos completos del inventario para análisis</li>
              <li><strong>PDF:</strong> Reporte visual formateado para impresión</li>
            </ul>
          </div>

          <div style="background-color: #e7f3ff; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff;">
            <p style="margin: 0; color: #004085;">
              <strong>📅 Frecuencia:</strong> Este reporte se genera automáticamente cada viernes a las 8:00 PM
            </p>
          </div>

          <p style="margin-top: 30px;">Si tiene alguna pregunta sobre este reporte, no dude en contactarnos.</p>
          
          <p>Saludos cordiales,<br>
          <strong>Sistema de Inventario - Telas y Tejidos Luciana</strong></p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666;">
            Este es un correo automático generado cada viernes. Para cambios en la configuración, contacte al administrador del sistema.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `${fileName}.csv`,
          content: Buffer.from(csvData, "utf8"),
          contentType: "text/csv",
        },
        {
          filename: `${fileName}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    if (error) {
      console.error(`❌ Error al enviar reporte de inventario a ${to}:`, error);
      return {
        error: `Error al enviar correo: ${error.message || "Error desconocido"}`,
      };
    }

    console.log(`✅ Reporte de inventario enviado exitosamente: ${data?.id}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Error al enviar reporte de inventario a ${to}:`, error);
    return { error: `Error al enviar correo: ${(error as Error).message}` };
  }
}
