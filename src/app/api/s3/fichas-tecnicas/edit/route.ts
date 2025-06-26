import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

export async function PUT(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas solicitudes de edición. Inténtalo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userRole = session.user.role || "seller";
    const isAdmin = userRole === "admin" || userRole === "major_admin";

    if (!isAdmin) {
      return NextResponse.json(
        { error: "No tienes permisos para editar fichas técnicas" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { key, newFileName, allowedRoles } = body;

    if (!key || !newFileName || !allowedRoles) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    }

    const sanitizedFileName = newFileName
      .replace(/\//g, "-")
      .replace(/\\/g, "-")
      .replace(/:/g, "-")
      .replace(/\*/g, "-")
      .replace(/\?/g, "-")
      .replace(/"/g, "-")
      .replace(/</g, "-")
      .replace(/>/g, "-")
      .replace(/\|/g, "-")
      .trim();

    let existingMetadata = {};
    let contentType = "application/pdf";
    try {
      const headResult = await s3Client.send(
        new HeadObjectCommand({
          Bucket: "telas-luciana",
          Key: key,
        })
      );

      existingMetadata = headResult.Metadata || {};
      contentType = headResult.ContentType || "application/pdf";
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[FICHAS-TECNICAS] File not found: ${key}`, error);
      return NextResponse.json(
        {
          error: "La ficha técnica no existe",
          duration: `${duration}ms`,
        },
        { status: 404 }
      );
    }

    const rolesString = allowedRoles.join("-");
    const newKey = `Inventario/Fichas Tecnicas/${sanitizedFileName}_roles_${rolesString}.pdf`;

    const updatedMetadata = {
      ...existingMetadata,
      allowedroles: rolesString,
      editedby: session.user.email || "",
      editdate: new Date().toISOString(),
    };

    if (key !== newKey) {
      try {
        await s3Client.send(
          new CopyObjectCommand({
            Bucket: "telas-luciana",
            CopySource: encodeURIComponent(`telas-luciana/${key}`),
            Key: newKey,
            Metadata: updatedMetadata,
            MetadataDirective: "REPLACE",
            ContentType: contentType,
          })
        );

        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: "telas-luciana",
            Key: key,
          })
        );

        const duration = Date.now() - startTime;

        console.log(
          `[FICHAS-TECNICAS] User ${session.user.email} edited ficha:`,
          {
            originalKey: key,
            newKey: newKey,
            originalFileName: newFileName,
            sanitizedFileName: sanitizedFileName,
            allowedRoles: allowedRoles,
            userRole: userRole,
            updatedMetadata: updatedMetadata,
            duration: `${duration}ms`,
          }
        );

        return NextResponse.json({
          message: "Ficha técnica editada exitosamente",
          newKey: newKey,
          duration: `${duration}ms`,
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[FICHAS-TECNICAS] Error editing file ${key}:`, error);
        return NextResponse.json(
          {
            error: "Error al editar la ficha técnica",
            duration: `${duration}ms`,
          },
          { status: 500 }
        );
      }
    } else {
      try {
        await s3Client.send(
          new CopyObjectCommand({
            Bucket: "telas-luciana",
            CopySource: encodeURIComponent(`telas-luciana/${key}`),
            Key: key,
            Metadata: updatedMetadata,
            MetadataDirective: "REPLACE",
            ContentType: contentType,
          })
        );

        const duration = Date.now() - startTime;

        console.log(
          `[FICHAS-TECNICAS] User ${session.user.email} updated metadata for:`,
          {
            key: key,
            originalFileName: newFileName,
            sanitizedFileName: sanitizedFileName,
            allowedRoles: allowedRoles,
            userRole: userRole,
            updatedMetadata: updatedMetadata,
            duration: `${duration}ms`,
          }
        );

        return NextResponse.json({
          message: "Permisos actualizados exitosamente",
          newKey: key,
          duration: `${duration}ms`,
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(
          `[FICHAS-TECNICAS] Error updating metadata for ${key}:`,
          error
        );
        return NextResponse.json(
          {
            error: "Error al actualizar los permisos de la ficha técnica",
            duration: `${duration}ms`,
          },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[FICHAS-TECNICAS] Error in edit endpoint:", error);
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        duration: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}
