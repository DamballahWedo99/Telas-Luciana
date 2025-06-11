import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function DELETE(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas solicitudes de eliminación. Inténtalo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (userRole !== "admin" && userRole !== "major_admin") {
      return NextResponse.json(
        { error: "No tienes permisos para eliminar fichas técnicas" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "Key del archivo requerido" },
        { status: 400 }
      );
    }

    if (!key.startsWith("Inventario/Fichas Tecnicas/")) {
      return NextResponse.json(
        { error: "Key inválido para fichas técnicas" },
        { status: 400 }
      );
    }

    const command = new DeleteObjectCommand({
      Bucket: "telas-luciana",
      Key: key,
    });

    await s3Client.send(command);

    const duration = Date.now() - startTime;

    console.log(`[FICHAS-TECNICAS] User ${session.user.email} deleted ficha:`, {
      key,
      userRole,
      duration: `${duration}ms`,
    });

    return NextResponse.json({
      success: true,
      message: "Ficha técnica eliminada exitosamente",
      key,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error deleting ficha técnica:", error);

    return NextResponse.json(
      {
        error: "Error al eliminar la ficha técnica",
        details: error instanceof Error ? error.message : "Error desconocido",
        duration: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}
