import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

// Configurar cliente S3
const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Configuración del bucket y ruta
const BUCKET_NAME = "telas-luciana";
const PACKING_LIST_PATH = "Inventario/Packing_Lists.xlsx/";

export async function POST(request: NextRequest) {
  try {
    // Aplicar rate limiting
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas cargas de archivos. Por favor, inténtalo de nuevo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Verificar autenticación
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verificar permisos de usuario (solo admin puede subir packing lists)
    const isAdmin =
      session.user.role === "admin" || session.user.role === "major_admin";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "No autorizado para subir archivos Packing List" },
        { status: 403 }
      );
    }

    // Obtener el archivo del FormData
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No se encontró ningún archivo" },
        { status: 400 }
      );
    }

    // Validar tipo de archivo
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
    ];

    if (
      !allowedTypes.includes(file.type) &&
      !file.name.toLowerCase().endsWith(".xlsx") &&
      !file.name.toLowerCase().endsWith(".xls")
    ) {
      return NextResponse.json(
        {
          error:
            "Tipo de archivo no válido. Solo se permiten archivos Excel (.xlsx, .xls)",
        },
        { status: 400 }
      );
    }

    // Validar tamaño del archivo (máximo 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande. Tamaño máximo: 10MB" },
        { status: 400 }
      );
    }

    // Generar identificador único para el archivo
    const uploadId = crypto.randomUUID();
    const timestamp = new Date().getTime();

    // Construir nombre del archivo con formato específico
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");

    // Formato: packing_lists_con_unidades_YYYY_MM_DD.xlsx
    const fileName = `packing_lists_con_unidades_${year}_${month}_${day}.xlsx`;

    // Ruta completa en S3
    const s3Key = `${PACKING_LIST_PATH}${fileName}`;

    console.log("=== UPLOAD INFO ===");
    console.log("Archivo original:", file.name);
    console.log("Nombre en S3:", fileName);
    console.log("Tamaño:", file.size, "bytes");
    console.log("Tipo:", file.type);
    console.log("S3 Key:", s3Key);
    console.log("==================");

    try {
      // Convertir el archivo a ArrayBuffer para subirlo a S3
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Subir archivo a S3
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
        Metadata: {
          "upload-id": uploadId,
          "original-name": file.name,
          "uploaded-by": session.user.email || session.user.name || "",
          "upload-timestamp": timestamp.toString(),
          "file-size": file.size.toString(),
        },
      });

      console.log("Subiendo archivo Excel a S3...");
      await s3Client.send(uploadCommand);
      console.log("✅ Archivo Excel subido exitosamente");

      // Crear registro de estado para el seguimiento del procesamiento
      const statusData = {
        uploadId,
        fileName: s3Key,
        originalName: file.name,
        status: "uploaded", // uploaded, processing, completed, failed
        uploadedAt: new Date().toISOString(),
        uploadedBy: session.user.email || session.user.name || "",
        fileSize: file.size,
        processingStarted: null,
        processingCompleted: null,
        result: null,
        error: null,
      };

      // Guardar el estado en S3
      const statusKey = `${PACKING_LIST_PATH}status/${uploadId}.json`;
      const statusCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: statusKey,
        Body: JSON.stringify(statusData, null, 2),
        ContentType: "application/json",
      });

      await s3Client.send(statusCommand);
      console.log("✅ Status file guardado");

      // Responder con éxito
      return NextResponse.json({
        success: true,
        message: "Archivo Packing List subido correctamente",
        uploadId,
        fileName: s3Key,
        fileNameInS3: fileName, // Nombre limpio del archivo
        originalName: file.name,
        fileSize: file.size,
        fileUrl: `https://${BUCKET_NAME}.s3.us-west-2.amazonaws.com/${s3Key}`,
        nextSteps:
          "El archivo será procesado automáticamente por Lambda en unos minutos",
      });
    } catch (s3Error: any) {
      console.error("Error subiendo archivo a S3:", s3Error);
      return NextResponse.json(
        {
          error: "Error al subir el archivo al servidor",
          details:
            s3Error instanceof Error ? s3Error.message : "Error desconocido",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error en upload de Packing List:", error);
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

// Método GET para verificar el estado del endpoint
export async function GET() {
  return NextResponse.json({
    message: "Endpoint para subir archivos Packing List",
    methods: ["POST"],
    maxFileSize: "10MB",
    allowedTypes: [".xlsx", ".xls"],
  });
}
