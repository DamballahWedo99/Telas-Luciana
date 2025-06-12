import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas solicitudes de subida. Inténtalo más tarde.",
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
        { error: "No tienes permisos para subir fichas técnicas" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const fileName = formData.get("fileName") as string;
    const allowedRolesStr = formData.get("allowedRoles") as string;

    if (!file || !fileName || !allowedRolesStr) {
      return NextResponse.json(
        { error: "Archivo, nombre y roles son requeridos" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Solo se permiten archivos PDF" },
        { status: 400 }
      );
    }

    const allowedRoles = JSON.parse(allowedRolesStr);
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
      return NextResponse.json(
        { error: "Debe especificar al menos un rol" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const rolesString = allowedRoles.join("-");
    const key = `Inventario/Fichas Tecnicas/${fileName}.pdf`;

    const command = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
      Metadata: {
        allowedRoles: rolesString,
        uploadedBy: session.user.email || "",
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    const duration = Date.now() - startTime;

    console.log(
      `[FICHAS-TECNICAS] User ${session.user.email} uploaded ficha:`,
      {
        key,
        fileName,
        allowedRoles,
        fileSize: buffer.length,
        duration: `${duration}ms`,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Ficha técnica subida exitosamente",
      key,
      fileName,
      allowedRoles,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error uploading ficha técnica:", error);

    return NextResponse.json(
      {
        error: "Error al subir la ficha técnica",
        details: error instanceof Error ? error.message : "Error desconocido",
        duration: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}
