import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
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

const BUCKET_NAME = "telas-luciana";

interface PendingFabric {
  id: string;
  tela: string;
  color: string;
  cantidad: number;
  unidades: string;
  oc?: string;
  costo: number | null;
  status: string;
  sourceFile?: string;
  sourceFileKey?: string;
}

interface PendingFile {
  fileName: string;
  uploadId: string;
  originalName: string;
  processedAt: string;
  fabrics: PendingFabric[];
  totalFabrics: number;
}

// Función para preprocesar el JSON con NaN valores
const fixInvalidJSON = (content: string): string => {
  return content.replace(/: *NaN/g, ": null");
};

// Función para verificar si un item necesita asignación de costos
const needsCostAssignment = (itemData: any): boolean => {
  // 1. Si ya tiene status "successful", no necesita procesamiento
  if (itemData.status === "successful") {
    return false;
  }

  // 2. Verificar si tiene costo asignado
  const hasCosto =
    itemData.Costo !== null &&
    itemData.Costo !== undefined &&
    itemData.Costo !== "" &&
    itemData.Costo !== 0;

  // 3. Si no tiene costo, necesita asignación
  if (!hasCosto) {
    return true;
  }

  // 4. Si tiene costo pero status es "pending", también necesita procesamiento
  if (itemData.status === "pending") {
    return true;
  }

  // 5. Por defecto, si no cumple las condiciones anteriores, no necesita procesamiento
  return false;
};

export async function GET(request: NextRequest) {
  try {
    // Aplicar rate limiting
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas consultas. Por favor, inténtalo de nuevo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Verificar autenticación
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verificar permisos de usuario
    const isAdmin =
      session.user.role === "admin" || session.user.role === "major_admin";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "No autorizado para esta acción" },
        { status: 403 }
      );
    }

    // Obtener la carpeta actual de inventario
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");

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

    const monthIndex = parseInt(month) - 1;
    const monthName =
      monthIndex >= 0 && monthIndex < 12 ? monthNames[monthIndex] : "Marzo";

    const folderPrefix = `Inventario/${year}/${monthName}/`;
    console.log(`Verificando pending en: ${folderPrefix}`);

    // Listar archivos en la carpeta actual de inventario
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: folderPrefix,
    });

    const listResponse = await s3Client.send(listCommand);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      return NextResponse.json({
        hasPendingFiles: false,
        pendingFiles: [],
        message: "No hay archivos de inventario para verificar",
      });
    }

    // Filtrar archivos JSON de inventario (incluir tanto inventario-row como inventario_)
    const inventoryJsonFiles = listResponse.Contents.filter(
      (item) =>
        item.Key &&
        item.Key.endsWith(".json") &&
        (item.Key.includes("inventario-row") ||
          item.Key.includes("inventario_"))
    ).map((item) => item.Key!);

    if (inventoryJsonFiles.length === 0) {
      return NextResponse.json({
        hasPendingFiles: false,
        pendingFiles: [],
        message: "No hay archivos de inventario JSON",
      });
    }

    console.log(
      `Archivos JSON de inventario encontrados: ${inventoryJsonFiles.length}`
    );

    // Agrupar archivos por packing list ID (extraído del contenido)
    const pendingFabricsByPackingList: { [key: string]: PendingFabric[] } = {};
    const packingListInfo: {
      [key: string]: {
        originalName: string;
        processedAt: string;
        uploadId: string;
      };
    } = {};
    let totalPendingItems = 0;
    let totalProcessed = 0;
    let totalErrors = 0;

    // Procesar cada archivo individual de inventario
    for (const fileKey of inventoryJsonFiles) {
      try {
        totalProcessed++;
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
        });

        const fileResponse = await s3Client.send(getCommand);

        if (fileResponse.Body) {
          let fileContent = await fileResponse.Body.transformToString();
          fileContent = fixInvalidJSON(fileContent);

          const itemData = JSON.parse(fileContent);

          // NUEVA LÓGICA: Verificar si necesita asignación de costos
          if (needsCostAssignment(itemData)) {
            const packingListId = itemData.OC || "SIN_OC";

            // Generar ID único para este item
            const itemId = `${fileKey
              .split("/")
              .pop()
              ?.replace(".json", "")}_${Date.now()}`;

            const pendingItem: PendingFabric = {
              id: itemId,
              tela: itemData.Tela || "",
              color: itemData.Color || "",
              cantidad: itemData.Cantidad || 0,
              unidades: itemData.Unidades || "MTS",
              oc: itemData.OC || "",
              costo: itemData.Costo || null,
              status: itemData.status || "pending", // Asignar "pending" si no tiene status
              sourceFile: fileKey.split("/").pop(),
              sourceFileKey: fileKey,
            };

            if (!pendingFabricsByPackingList[packingListId]) {
              pendingFabricsByPackingList[packingListId] = [];

              // Información del packing list
              packingListInfo[packingListId] = {
                originalName: `Packing List ${packingListId}`,
                processedAt:
                  fileResponse.LastModified?.toISOString() ||
                  new Date().toISOString(),
                uploadId:
                  itemData.upload_id || `pl_${packingListId}_${Date.now()}`,
              };
            }

            pendingFabricsByPackingList[packingListId].push(pendingItem);
            totalPendingItems++;

            console.log(
              `✅ Item pending encontrado: ${itemData.Tela} ${
                itemData.Color
              } (Status: ${itemData.status || "NO_STATUS"})`
            );
          }
        }
      } catch (fileError) {
        console.error(`Error procesando archivo ${fileKey}:`, fileError);
        totalErrors++;
        continue;
      }
    }

    // Convertir a formato esperado por el frontend
    const pendingFiles: PendingFile[] = Object.entries(
      pendingFabricsByPackingList
    ).map(([packingListId, fabrics]) => ({
      fileName: `pending_${packingListId}`,
      uploadId: packingListInfo[packingListId].uploadId,
      originalName: packingListInfo[packingListId].originalName,
      processedAt: packingListInfo[packingListId].processedAt,
      fabrics,
      totalFabrics: fabrics.length,
    }));

    console.log(`=== RESULTADO VERIFICACIÓN ===`);
    console.log(`Archivos procesados: ${totalProcessed}`);
    console.log(`Items pending encontrados: ${totalPendingItems}`);
    console.log(`Packing lists con items pending: ${pendingFiles.length}`);
    console.log(`Errores: ${totalErrors}`);
    console.log(`===============================`);

    return NextResponse.json({
      hasPendingFiles: pendingFiles.length > 0,
      pendingFiles,
      totalPendingFiles: pendingFiles.length,
      totalPendingItems,
      summary: {
        pendingFiles: pendingFiles.length,
        totalItems: totalPendingItems,
        filesChecked: inventoryJsonFiles.length,
        filesProcessed: totalProcessed,
        errors: totalErrors,
        folderChecked: folderPrefix,
      },
    });
  } catch (error) {
    console.error("Error verificando archivos pending:", error);
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
