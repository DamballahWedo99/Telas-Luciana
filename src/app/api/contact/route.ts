import { sendContactEmail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

interface ContactRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
  website?: string; // Honeypot field
  _timestamp?: number; // Form render time
  _submitted?: number; // Submission time
  _interacted?: boolean; // User interaction flag
}

// Anti-bot validation utility (Single Responsibility Principle)
function validateBotDetection(data: ContactRequest): {
  isBot: boolean;
  reason?: string;
} {
  // Layer 1: Honeypot validation
  if (data.website && data.website.trim() !== "") {
    return { isBot: true, reason: "Honeypot field filled" };
  }

  // Layer 2: Time-based validation
  if (data._timestamp && data._submitted) {
    const submissionDuration = (data._submitted - data._timestamp) / 1000; // seconds

    // Minimum time: 3 seconds (humanly impossible to fill form faster)
    if (submissionDuration < 3) {
      return { isBot: true, reason: "Submission too fast" };
    }

    // Maximum time: 30 minutes (session timeout protection)
    if (submissionDuration > 1800) {
      return { isBot: true, reason: "Session expired" };
    }
  }

  // Layer 3: Interaction validation
  if (data._interacted === false) {
    return { isBot: true, reason: "No user interaction detected" };
  }

  return { isBot: false };
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

  const requestData: ContactRequest = await request.json();
  const { name, email, subject, message } = requestData;

  // Bot detection validation
  const botCheck = validateBotDetection(requestData);
  if (botCheck.isBot) {
    console.warn(`Bot detected: ${botCheck.reason}`, {
      ip:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
      timestamp: new Date().toISOString(),
    });

    // Return generic error to avoid revealing detection mechanism
    return new Response(
      JSON.stringify({
        message:
          "No se pudo enviar el mensaje. Por favor, inténtalo de nuevo.",
      }),
      { status: 400 }
    );
  }

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
