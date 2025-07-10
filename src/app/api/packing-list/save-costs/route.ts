import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { invalidateAndWarmInventory } from "@/lib/cache-warming";
import { invalidateCachePattern } from "@/lib/cache-middleware";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
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

interface InventoryItem {
  OC: string;
  Tela: string;
  Color: string;
  Costo: number;
  Cantidad: number;
  Unidades: string;
  Total: number;
  Ubicacion: string;
  Importacion: string;
  FacturaDragonAzteca: string;
}

interface ProcessResponse {
  success: boolean;
  message: string;
  inventoryItems: InventoryItem[];
  updatedCount: number;
  totalRequested: number;
  uploadId: string;
  errors?: string[];
}

const fixInvalidJSON = (content: string): string => {
  return content.replace(/: *NaN/g, ": null");
};

const invalidateInventoryRelatedCaches = async (): Promise<void> => {
  try {
    console.log(
      "🔥 [SAVE-COSTS] Invalidando todos los caches relacionados con inventario..."
    );

    await invalidateAndWarmInventory();

    await invalidateCachePattern("cache:api:s3:sold-rolls:*");
    console.log("🗑️ Cache de sold-rolls invalidado");

    await invalidateCachePattern("cache:api:s3:rolls-data:*");
    console.log("🗑️ Cache de rolls-data invalidado");

    console.log(
      "✅ Invalidación completa de caches relacionados con inventario finalizada"
    );
  } catch (error) {
    console.error("❌ Error invalidando caches relacionados:", error);
  }
};

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes. Por favor, inténtalo de nuevo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const isAdmin =
      session.user.role === "admin" || session.user.role === "major_admin";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "No autorizado para esta acción" },
        { status: 403 }
      );
    }

    const { fabrics, uploadId } = (await request.json()) as {
      fabrics: PendingFabric[];
      fileName: string;
      uploadId: string;
    };

    if (!fabrics || !Array.isArray(fabrics) || fabrics.length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron datos válidos de telas" },
        { status: 400 }
      );
    }

    const missingCosts = fabrics.some((fabric) => fabric.costo === null);
    if (missingCosts) {
      return NextResponse.json(
        { error: "Todas las telas deben tener un costo asignado" },
        { status: 400 }
      );
    }

    const updatedItems: InventoryItem[] = [];
    const errors: string[] = [];
    let updatedCount = 0;

    for (const fabric of fabrics) {
      try {
        const fileKey = fabric.sourceFileKey;

        if (!fileKey) {
          errors.push(
            `No se encontró la ruta del archivo para: ${fabric.tela} ${fabric.color}`
          );
          continue;
        }

        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
        });

        const fileResponse = await s3Client.send(getCommand);

        if (!fileResponse.Body) {
          errors.push(
            `No se pudo leer el archivo para: ${fabric.tela} ${fabric.color}`
          );
          continue;
        }

        let fileContent = await fileResponse.Body.transformToString();
        fileContent = fixInvalidJSON(fileContent);
        const itemData = JSON.parse(fileContent);

        const canUpdate =
          itemData.status !== "successful" ||
          itemData.Costo === null ||
          itemData.Costo === undefined ||
          itemData.Costo === "";

        if (!canUpdate && itemData.status === "successful") {
          errors.push(
            `La tela ${fabric.tela} ${fabric.color} ya está procesada`
          );
          continue;
        }

        const updatedItem = {
          ...itemData,
          Costo: fabric.costo,
          Total: (fabric.costo || 0) * (itemData.Cantidad || 0),
          status: "successful",
          updatedAt: new Date().toISOString(),
          updatedBy: session.user.email || session.user.name || "",
          processedFromUploadId: uploadId,
        };

        await s3Client.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileKey,
            Body: JSON.stringify(updatedItem, null, 2),
            ContentType: "application/json",
            Metadata: {
              "last-updated": new Date().toISOString(),
              "updated-by": session.user.email || "",
              "upload-id": uploadId,
              status: "successful",
            },
          })
        );

        const inventoryItem: InventoryItem = {
          OC: updatedItem.OC || "",
          Tela: updatedItem.Tela || "",
          Color: updatedItem.Color || "",
          Costo: updatedItem.Costo || 0,
          Cantidad: updatedItem.Cantidad || 0,
          Unidades: updatedItem.Unidades || "MTS",
          Total: updatedItem.Total || 0,
          Ubicacion: updatedItem.Ubicacion || updatedItem.almacen || "",
          Importacion: (() => {
            const value = updatedItem.Importacion;
            if (value === null || value === undefined) return "-";

            const normalized = value.toString().toLowerCase().trim();
            if (normalized === "hoy") return "HOY";
            if (normalized === "da") return "DA";
            if (normalized === "nan" || normalized === "") return "-";

            return "";
          })(),
          FacturaDragonAzteca: updatedItem.FacturaDragonAzteca || "",
        };

        updatedItems.push(inventoryItem);
        updatedCount++;
      } catch (fileError) {
        errors.push(
          `Error procesando ${fabric.tela} ${fabric.color}: ${
            fileError instanceof Error ? fileError.message : "Error desconocido"
          }`
        );
        continue;
      }
    }

    if (updatedCount === 0) {
      return NextResponse.json(
        {
          error: "No se pudieron actualizar ninguna de las telas",
          details: errors,
        },
        { status: 400 }
      );
    }

    await invalidateInventoryRelatedCaches();

    console.log(
      `[COSTS] User ${session.user.email} updated costs for ${updatedCount} items`
    );

    const response: ProcessResponse = {
      success: true,
      message: `${updatedCount} telas actualizadas correctamente`,
      inventoryItems: updatedItems,
      updatedCount,
      totalRequested: fabrics.length,
      uploadId,
    };

    if (errors.length > 0) {
      response.message += ` (${errors.length} errores)`;
      response.errors = errors;
    }

    return NextResponse.json({
      ...response,
      cache: {
        invalidated: true,
        warming: "initiated",
        invalidatedCaches: ["inventario", "sold-rolls", "rolls-data"],
      },
    });
  } catch (error) {
    console.error("Error guardando costos:", error);
    return NextResponse.json(
      {
        error: "Error al procesar la solicitud",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
