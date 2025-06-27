import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import cron from "node-cron";

let isSchedulerRunning = false;

export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, {
    type: "cron",
    message:
      "Demasiadas solicitudes de scheduler. Espera antes de intentar nuevamente.",
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    if (isSchedulerRunning) {
      return NextResponse.json({
        message: "Scheduler ya está ejecutándose",
        status: "running",
      });
    }

    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🕐 Iniciando scheduler de inventario semanal...");

    const task = cron.schedule(
      "0 20 * * 5",
      async () => {
        try {
          console.log(
            "⏰ Ejecutando tarea programada: Reporte de inventario semanal"
          );
          console.log(
            `📅 Fecha/Hora: ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })} (CDMX)`
          );

          const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
          const response = await fetch(`${baseUrl}/api/cron/weekly-inventory`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.CRON_SECRET || "default-secret"}`,
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              `Error en API de inventario: ${errorData.error || response.statusText}`
            );
          }

          const result = await response.json();
          console.log("✅ Reporte de inventario semanal completado:", result);
        } catch (error) {
          console.error("❌ Error en tarea programada de inventario:", error);
        }
      },
      {
        timezone: "America/Mexico_City",
      }
    );

    task.start();
    isSchedulerRunning = true;

    console.log("✅ Scheduler configurado exitosamente");
    console.log("📅 Se ejecutará cada viernes a las 8:00 PM (hora CDMX)");

    return NextResponse.json({
      success: true,
      message: "Scheduler de inventario semanal iniciado",
      schedule: "Cada viernes a las 8:00 PM (CDMX)",
      nextRun: "Próximo viernes a las 8:00 PM",
    });
  } catch (error) {
    console.error("❌ Error al iniciar scheduler:", error);

    return NextResponse.json(
      {
        error: "Error al iniciar scheduler",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    isRunning: isSchedulerRunning,
    schedule: "Cada viernes a las 8:00 PM (CDMX)",
    message: isSchedulerRunning
      ? "Scheduler está activo"
      : "Scheduler no está ejecutándose. Use POST para iniciarlo.",
  });
}
