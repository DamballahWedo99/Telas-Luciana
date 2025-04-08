import nodemailer from "nodemailer";

interface ContactRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export async function POST(request: Request): Promise<Response> {
  const { name, email, subject, message }: ContactRequest =
    await request.json();

  if (!name || !email || !subject || !message) {
    return new Response(
      JSON.stringify({ message: "Todos los campos son obligatorios" }),
      { status: 400 }
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Pinnacle Contact" <${process.env.SMTP_USER}>`,
      to: "administracion@telasytejidosluciana.com",
      replyTo: email,
      subject: subject,
      text: `Mensaje de: ${name} (${email})\n\n${message}`,
    });

    return new Response(
      JSON.stringify({ message: "Correo enviado exitosamente" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al enviar el correo:", error);
    return new Response(
      JSON.stringify({ message: "Error al enviar el correo" }),
      { status: 500 }
    );
  }
}
