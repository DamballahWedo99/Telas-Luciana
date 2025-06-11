import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas solicitudes de descarga. Inténtalo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "Key del archivo requerido" },
        { status: 400 }
      );
    }

    const userRole = session.user.role || "seller";
    let allowedRoles = ["major_admin"];

    try {
      const headCommand = new HeadObjectCommand({
        Bucket: "telas-luciana",
        Key: key,
      });

      const headResponse = await s3Client.send(headCommand);

      if (headResponse.Metadata?.allowedRoles) {
        allowedRoles = headResponse.Metadata.allowedRoles.split("-");
      } else {
        allowedRoles = ["major_admin", "admin", "seller"];
      }
    } catch (headError) {
      if (key.includes("_roles_")) {
        const rolesMatch = key.match(/_roles_([^_]+)/);
        if (rolesMatch) {
          allowedRoles = rolesMatch[1].split("-");
        }
      } else {
        allowedRoles = ["major_admin", "admin", "seller"];
      }
    }

    const hasPermission =
      userRole === "major_admin" || allowedRoles.includes(userRole);

    if (!hasPermission) {
      return NextResponse.json(
        { error: "No tienes permisos para descargar esta ficha técnica" },
        { status: 403 }
      );
    }

    const command = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    const bytes = await response.Body.transformToByteArray();
    const duration = Date.now() - startTime;

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${key.split("/").pop()}"`,
        "X-Download-Duration": `${duration}ms`,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error downloading ficha técnica:", error);

    return NextResponse.json(
      {
        error: "Error al descargar la ficha técnica",
        duration: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}
