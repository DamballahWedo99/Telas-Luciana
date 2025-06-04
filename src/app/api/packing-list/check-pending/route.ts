// app/api/packing-list/check-pending/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Interfaces para tipar los datos
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

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("🔍 [CHECK-PENDING] === VERIFICANDO ARCHIVOS PENDING ===");

    // Verificar autenticación
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Solo admins pueden verificar archivos pending
    if (session.user.role !== "admin" && session.user.role !== "major_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // 🔧 FIX: SOLO LEER, NO CREAR ARCHIVOS
    // Buscar archivos con status "pending" en el bucket
    const now = new Date();
    const currentYear = now.getFullYear().toString();

    // 🔧 FIX: Generar mes con primera letra mayúscula para coincidir con Lambda
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

    console.log(`📁 [CHECK-PENDING] Buscando en carpeta: ${prefix}`);

    const listCommand = new ListObjectsV2Command({
      Bucket: "telas-luciana",
      Prefix: prefix,
    });

    const listResponse = await s3Client.send(listCommand);
    const jsonFiles = (listResponse.Contents || [])
      .filter((item) => item.Key && item.Key.endsWith(".json"))
      .map((item) => item.Key!)
      .filter((key) => !key.includes("_backup_"));

    console.log(
      `📄 [CHECK-PENDING] Encontrados ${jsonFiles.length} archivos JSON`
    );

    const pendingFiles: PendingFileInfo[] = [];

    // 🔧 FIX: SOLO LEER archivos existentes, NO crear nuevos
    for (const fileKey of jsonFiles) {
      try {
        console.log(`🔍 [CHECK-PENDING] Procesando archivo: ${fileKey}`);

        const getCommand = new GetObjectCommand({
          Bucket: "telas-luciana",
          Key: fileKey,
        });

        const getResponse = await s3Client.send(getCommand);
        const fileContent = await getResponse.Body?.transformToString();

        if (!fileContent) {
          console.log(`⚠️ [CHECK-PENDING] Archivo vacío: ${fileKey}`);
          continue;
        }

        const jsonData = JSON.parse(fileContent);
        console.log(`📦 [CHECK-PENDING] Estructura de datos en ${fileKey}:`, {
          isArray: Array.isArray(jsonData),
          hasData: !!jsonData.data,
          dataIsArray: Array.isArray(jsonData.data),
          keysInRoot: Object.keys(jsonData),
          totalItems: Array.isArray(jsonData)
            ? jsonData.length
            : Array.isArray(jsonData.data)
            ? jsonData.data.length
            : 0,
        });

        // 🔧 FIX: Manejar diferentes formatos de JSON
        let dataToProcess: InventoryItem[] = [];

        // CASO 1: Array directo
        if (Array.isArray(jsonData)) {
          console.log(
            `📦 [CHECK-PENDING] Array directo encontrado en ${fileKey}`
          );
          dataToProcess = jsonData;
        }
        // CASO 2: Objeto con propiedad 'data' que contiene array
        else if (jsonData && jsonData.data && Array.isArray(jsonData.data)) {
          console.log(
            `📦 [CHECK-PENDING] Datos anidados encontrados en ${fileKey}, extrayendo array de data...`
          );
          dataToProcess = jsonData.data;
        }
        // CASO 3: Objeto individual (cada fila es un archivo separado)
        else if (
          jsonData &&
          typeof jsonData === "object" &&
          jsonData.Tela &&
          jsonData.Color
        ) {
          console.log(
            `📦 [CHECK-PENDING] Objeto individual encontrado en ${fileKey}`
          );
          dataToProcess = [jsonData]; // Convertir objeto individual a array
        }
        // CASO 4: Formato no reconocido
        else {
          console.log(
            `⚠️ [CHECK-PENDING] Formato no reconocido en ${fileKey}:`,
            typeof jsonData
          );
          continue; // Saltar este archivo
        }

        console.log(
          `🔍 [CHECK-PENDING] Procesando ${dataToProcess.length} items en ${fileKey}`
        );

        // Verificar si tiene items con status "pending"
        const pendingItems = dataToProcess.filter((item: InventoryItem) => {
          const hasPendingStatus = item.status === "pending";
          if (hasPendingStatus) {
            console.log(
              `✅ [CHECK-PENDING] Item pending encontrado: ${item.Tela} ${item.Color} (Cantidad: ${item.Cantidad})`
            );
          }
          return hasPendingStatus;
        });

        console.log(
          `📊 [CHECK-PENDING] Items pending en ${fileKey}: ${pendingItems.length} de ${dataToProcess.length} totales`
        );

        if (pendingItems.length > 0) {
          // Procesar items pending SOLO para mostrar, NO para crear archivos
          const fabrics = pendingItems
            .map((item: InventoryItem, index: number) => ({
              id: `${fileKey}-${index}`,
              tela: item.Tela || "",
              color: item.Color || "",
              cantidad: parseFloat(String(item.Cantidad)) || 0,
              unidades: item.Unidades || "",
              oc: item.OC || "",
              costo: null, // Será asignado por el usuario
            }))
            .filter((fabric: ProcessedFabric) => fabric.tela && fabric.color); // Solo telas válidas

          console.log(
            `✅ [CHECK-PENDING] Telas válidas procesadas: ${fabrics.length}`
          );

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

            console.log(
              `📋 [CHECK-PENDING] Archivo agregado a pending: ${fileKey} con ${fabrics.length} telas`
            );
          }
        }
      } catch (parseError) {
        console.warn(
          `⚠️ [CHECK-PENDING] Error procesando archivo ${fileKey}:`,
          parseError
        );
        // Continuar con el siguiente archivo, no fallar toda la operación
      }
    }

    const hasPendingFiles = pendingFiles.length > 0;
    const totalPendingFiles = pendingFiles.length;
    const totalPendingFabrics = pendingFiles.reduce(
      (sum, file) => sum + file.totalFabrics,
      0
    );

    const duration = Date.now() - startTime;

    console.log(`✅ [CHECK-PENDING] Completado en ${duration}ms`);
    console.log(
      `📊 [CHECK-PENDING] Resultado: ${totalPendingFiles} archivos, ${totalPendingFabrics} telas pending`
    );

    // 🚨 IMPORTANTE: SOLO RETORNAR DATOS, NO CREAR ARCHIVOS
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
      // 🔧 DEBUG: Agregar info de debugging
      debug: {
        searchPath: prefix,
        totalJsonFiles: jsonFiles.length,
        processedFiles: jsonFiles.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [CHECK-PENDING] Error después de ${duration}ms:`, error);

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
