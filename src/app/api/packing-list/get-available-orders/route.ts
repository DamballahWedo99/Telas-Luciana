import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  _Object,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { withCache, invalidateCachePattern } from "@/lib/cache-middleware";
import { CACHE_TTL } from "@/lib/redis";
import type { AvailableOrder, PackingListRoll } from "../../../../../types/types";

const s3Client = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

async function getAllPackingListFiles(): Promise<_Object[]> {
  try {
    let allFiles: _Object[] = [];
    let continuationToken: string | undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: "telas-luciana",
        Prefix: "Inventario/Catalogo_Rollos/",
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });

      const listResponse = await s3Client.send(listCommand);

      if (listResponse.Contents) {
        allFiles = allFiles.concat(listResponse.Contents);
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    return allFiles.filter((item) => {
      const key = item.Key || "";
      return (
        key.endsWith(".json") &&
        !key.includes("backup") &&
        !key.includes("_row") &&
        key.includes("detalle_")
      );
    });
  } catch (error) {
    console.error("❌ Error buscando archivos packing list:", error);
    return [];
  }
}

async function readPackingListFile(fileKey: string): Promise<PackingListRoll[]> {
  try {
    const command = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body?.transformToString();

    if (!bodyString) return [];
    
    const data = JSON.parse(bodyString);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`❌ Error leyendo archivo ${fileKey}:`, error);
    return [];
  }
}


async function getAvailableOrdersData(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas consultas de órdenes. Espera un momento.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Only admins can access packing list editing
    if (session.user.role !== "admin" && session.user.role !== "major_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    console.log("🔍 [GET-AVAILABLE-ORDERS] Obteniendo órdenes disponibles...");

    const allFiles = await getAllPackingListFiles();
    console.log(`📁 [GET-AVAILABLE-ORDERS] Archivos encontrados: ${allFiles.length}`);
    allFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.Key} (${file.Size} bytes)`);
    });

    if (allFiles.length === 0) {
      console.log("❌ [GET-AVAILABLE-ORDERS] No se encontraron archivos");
      return NextResponse.json([]);
    }

    const availableOrders: AvailableOrder[] = [];
    const processedOCs = new Set<string>();

    // Process files in parallel for better performance
    const fileProcessPromises = allFiles.map(async (file) => {
      if (!file.Key) return null;

      try {
        console.log(`🔍 [GET-AVAILABLE-ORDERS] Procesando archivo: ${file.Key}`);
        const rolls = await readPackingListFile(file.Key);
        console.log(`📊 [GET-AVAILABLE-ORDERS] Rollos encontrados en ${file.Key}: ${rolls.length}`);
        
        if (rolls.length === 0) {
          console.log(`❌ [GET-AVAILABLE-ORDERS] Archivo vacío: ${file.Key}`);
          return null;
        }

        // Get unique OCs from this file
        const ocsInFile = new Set<string>();
        rolls.forEach((roll) => {
          if (roll.OC && roll.OC.trim()) {
            ocsInFile.add(roll.OC.trim());
          }
        });
        console.log(`🏷️ [GET-AVAILABLE-ORDERS] OCs únicas en ${file.Key}: ${Array.from(ocsInFile).join(', ')}`);

        return Array.from(ocsInFile).map((oc) => {
          const ocRolls = rolls.filter((roll) => roll.OC === oc);
          return {
            oc,
            fileName: file.Key!.split('/').pop() || file.Key!,
            rollCount: ocRolls.length,
            lastModified: file.LastModified?.toISOString() || new Date().toISOString(),
          };
        });
      } catch (error) {
        console.error(`❌ [GET-AVAILABLE-ORDERS] Error procesando ${file.Key}:`, error);
        return null;
      }
    });

    const fileResults = await Promise.all(fileProcessPromises);

    // Flatten results and remove duplicates
    fileResults.forEach((result) => {
      if (result) {
        result.forEach((order) => {
          if (!processedOCs.has(order.oc)) {
            processedOCs.add(order.oc);
            availableOrders.push(order);
          }
        });
      }
    });

    // Sort by OC name
    availableOrders.sort((a, b) => a.oc.localeCompare(b.oc));

    console.log(`✅ [GET-AVAILABLE-ORDERS] Órdenes encontradas: ${availableOrders.length}`);
    
    return NextResponse.json(availableOrders);
  } catch (error) {
    console.error("❌ [GET-AVAILABLE-ORDERS] Error general:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// Cache the response for better performance
const getCachedAvailableOrders = withCache(getAvailableOrdersData, {
  keyPrefix: "api:packing-list:available-orders",
  ttl: CACHE_TTL.ROLLS_DATA, // 7 days
  skipCache: (req) => {
    const url = new URL(req.url);
    return url.searchParams.get("refresh") === "true";
  },
  onCacheHit: (key) => console.log(`📦 Cache HIT - Available Orders: ${key}`),
  onCacheMiss: (key) => console.log(`💾 Cache MISS - Available Orders: ${key}`),
});

export { getCachedAvailableOrders as GET };

// POST method to invalidate cache (admin only)
export async function POST() {
  try {
    const session = await auth();

    if (
      !session ||
      !session.user ||
      (session.user.role !== "admin" && session.user.role !== "major_admin")
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await invalidateCachePattern("cache:api:packing-list:available-orders*");

    return NextResponse.json({
      success: true,
      message: "Cache de órdenes disponibles invalidado",
      cache: { invalidated: true },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}