import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

interface InventoryItem {
  OC?: string;
  Tela?: string;
  Color?: string;
  Unidades?: string;
  Cantidad?: number | string;
  Costo?: number | string;
  Total?: number | string;
  Importación?: string;
  Importacion?: string;
  almacen?: string;
  status?: string;
  Ubicacion?: string;
  FacturaDragonAzteca?: string;
}

interface ProcessedFabric {
  id: string;
  tela: string;
  color: string;
  cantidad: number;
  unidades: string;
  oc: string;
  costo: null;
}

interface PendingFileInfo {
  fileName: string;
  uploadId: string;
  originalName: string;
  processedAt: string;
  fabrics: ProcessedFabric[];
  totalFabrics: number;
}

function sanitizeJSONContent(content: string): string {
  return content
    .replace(/:\s*NaN\s*([,}])/g, ": null$1")
    .replace(/:\s*undefined\s*([,}])/g, ": null$1")
    .replace(/:\s*Infinity\s*([,}])/g, ": null$1")
    .replace(/:\s*-Infinity\s*([,}])/g, ": null$1");
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas consultas de archivos pending. Espera un momento.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (session.user.role !== "admin" && session.user.role !== "major_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const currentMonth = monthNames[now.getMonth()];
    const prefix = `Inventario/${currentYear}/${currentMonth}/`;

    const listCommand = new ListObjectsV2Command({
      Bucket: "telas-luciana",
      Prefix: prefix,
    });

    const listResponse = await s3Client.send(listCommand);
    const jsonFiles = (listResponse.Contents || [])
      .filter((item) => item.Key && item.Key.endsWith(".json"))
      .map((item) => item.Key!)
      .filter((key) => !key.includes("_backup_"));

    const pendingFiles: PendingFileInfo[] = [];

    for (const fileKey of jsonFiles) {
      try {
        const getCommand = new GetObjectCommand({
          Bucket: "telas-luciana",
          Key: fileKey,
        });

        const getResponse = await s3Client.send(getCommand);
        const fileContent = await getResponse.Body?.transformToString();

        if (!fileContent) continue;

        const sanitizedContent = sanitizeJSONContent(fileContent);
        const jsonData = JSON.parse(sanitizedContent);
        let dataToProcess: InventoryItem[] = [];

        if (Array.isArray(jsonData)) {
          dataToProcess = jsonData;
        } else if (jsonData && jsonData.data && Array.isArray(jsonData.data)) {
          dataToProcess = jsonData.data;
        } else if (
          jsonData &&
          typeof jsonData === "object" &&
          jsonData.Tela &&
          jsonData.Color
        ) {
          dataToProcess = [jsonData];
        } else {
          continue;
        }

        const pendingItems = dataToProcess.filter(
          (item: InventoryItem) => item.status === "pending"
        );

        if (pendingItems.length > 0) {
          const fabrics = pendingItems
            .map((item: InventoryItem, index: number) => ({
              id: `${fileKey}-${index}`,
              tela: item.Tela || "",
              color: item.Color || "",
              cantidad: parseFloat(String(item.Cantidad)) || 0,
              unidades: item.Unidades || "",
              oc: item.OC || "",
              costo: null,
            }))
            .filter((fabric: ProcessedFabric) => fabric.tela && fabric.color);

          if (fabrics.length > 0) {
            pendingFiles.push({
              fileName: fileKey,
              uploadId: fileKey.replace(/[^a-zA-Z0-9]/g, ""),
              originalName: fileKey.split("/").pop() || fileKey,
              processedAt:
                getResponse.LastModified?.toISOString() ||
                new Date().toISOString(),
              fabrics: fabrics,
              totalFabrics: fabrics.length,
            });
          }
        }
      } catch (parseError) {
        console.warn(`Error procesando archivo ${fileKey}:`, parseError);
        continue;
      }
    }

    const hasPendingFiles = pendingFiles.length > 0;
    const totalPendingFiles = pendingFiles.length;
    const totalPendingFabrics = pendingFiles.reduce(
      (sum, file) => sum + file.totalFabrics,
      0
    );

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      hasPendingFiles,
      totalPendingFiles,
      totalPendingFabrics,
      pendingFiles,
      message: hasPendingFiles
        ? `Se encontraron ${totalPendingFiles} archivos con ${totalPendingFabrics} telas pendientes`
        : "No hay archivos pending",
      duration: `${duration}ms`,
      debug: {
        searchPath: prefix,
        totalJsonFiles: jsonFiles.length,
        processedFiles: jsonFiles.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error verificando archivos pending:", error);

    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido",
        hasPendingFiles: false,
        pendingFiles: [],
        duration: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}
