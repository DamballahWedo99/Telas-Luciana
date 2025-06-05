import { sendContactEmail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

interface ContactRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  const rateLimitResult = await rateLimit(request, {
    type: "contact",
    message:
      "Demasiados mensajes enviados. Por favor, inténtalo de nuevo más tarde.",
  });

  if (rateLimitResult) {
    return rateLimitResult;
  }

  const { name, email, subject, message }: ContactRequest =
    await request.json();

  if (!name || !email || !subject || !message) {
    return new Response(
      JSON.stringify({ message: "Todos los campos son obligatorios" }),
      { status: 400 }
    );
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ message: "Email inválido" }), {
      status: 400,
    });
  }

  if (message.length > 2000) {
    return new Response(
      JSON.stringify({ message: "Mensaje demasiado largo" }),
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
    console.error("Error enviando correo de contacto:", error);
    return new Response(
      JSON.stringify({ message: "Error al enviar el correo" }),
      { status: 500 }
    );
  }
}
