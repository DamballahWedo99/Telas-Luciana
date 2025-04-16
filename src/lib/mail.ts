import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT) || 587,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
  secure:
    process.env.EMAIL_SERVER_PORT === "465"
      ? true
      : process.env.EMAIL_SERVER_SECURE === "true",
  connectionTimeout: 60000,
  greetingTimeout: 60000,
  socketTimeout: 90000,
});

transporter
  .verify()
  .then(() => console.log("✅ Conexión SMTP verificada"))
  .catch((error) => console.error("❌ Error en la conexión SMTP:", error));

export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

    console.log(`Intentando enviar correo de restablecimiento a: ${to}`);
    console.log(`URL de restablecimiento: ${resetUrl}`);

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
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

    console.log(`✅ Correo enviado: ${info.messageId}`);
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
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
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
    console.log(`✅ Correo de nueva cuenta enviado a: ${to}`);
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
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: "administracion@telasytejidosluciana.com",
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

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
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

    return { success: true };
  } catch (error) {
    console.error(`❌ Error al enviar correos de contacto:`, error);
    return { error: `Error al enviar correo: ${(error as Error).message}` };
  }
}
