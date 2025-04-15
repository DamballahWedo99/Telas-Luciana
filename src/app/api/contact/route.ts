import { sendContactEmail } from "@/lib/mail";

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
    const result = await sendContactEmail(name, email, subject, message);

    if (result.success) {
      return new Response(
        JSON.stringify({ message: "Correo enviado exitosamente" }),
        { status: 200 }
      );
    } else {
      return new Response(
        JSON.stringify({
          message: result.error || "Error al enviar el correo",
        }),
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error al enviar el correo:", error);
    return new Response(
      JSON.stringify({ message: "Error al enviar el correo" }),
      { status: 500 }
    );
  }
}
