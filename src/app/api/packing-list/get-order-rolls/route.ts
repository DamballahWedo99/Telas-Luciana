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
import type { PackingListRoll, PackingListEditData } from "../../../../../types/types";

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

async function getOrderRollsData(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas consultas de rollos. Espera un momento.",
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

    const searchParams = request.nextUrl.searchParams;
    const oc = searchParams.get("oc");

    if (!oc) {
      return NextResponse.json(
        { error: "Parámetro 'oc' es requerido" },
        { status: 400 }
      );
    }

    console.log(`🔍 [GET-ORDER-ROLLS] Obteniendo rollos para OC: "${oc}"`);

    const allFiles = await getAllPackingListFiles();
    console.log(`📁 [GET-ORDER-ROLLS] Archivos encontrados: ${allFiles.length}`);

    if (allFiles.length === 0) {
      console.log("❌ [GET-ORDER-ROLLS] No se encontraron archivos");
      return NextResponse.json(null);
    }

    let foundData: PackingListEditData | null = null;

    // Search through all files to find the one containing the OC
    for (const file of allFiles) {
      if (!file.Key) continue;

      try {
        const rolls = await readPackingListFile(file.Key);
        
        // Filter rolls for the specific OC
        const ocRolls = rolls.filter((roll) => 
          roll.OC && roll.OC.trim().toLowerCase() === oc.toLowerCase()
        );

        if (ocRolls.length > 0) {
          foundData = {
            oc: oc,
            fileName: file.Key.split('/').pop() || file.Key,
            lastModified: file.LastModified?.toISOString() || new Date().toISOString(),
            rolls: ocRolls.sort((a, b) => {
              // Sort by rollo_id numerically
              const aNum = parseInt(a.rollo_id);
              const bNum = parseInt(b.rollo_id);
              if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum;
              }
              return a.rollo_id.localeCompare(b.rollo_id);
            })
          };
          
          console.log(`✅ [GET-ORDER-ROLLS] Encontrados ${ocRolls.length} rollos para OC ${oc} en archivo ${file.Key}`);
          break;
        }
      } catch (error) {
        console.error(`❌ [GET-ORDER-ROLLS] Error procesando ${file.Key}:`, error);
        continue;
      }
    }

    if (!foundData) {
      console.log(`❌ [GET-ORDER-ROLLS] No se encontraron rollos para OC: ${oc}`);
      return NextResponse.json(null);
    }

    return NextResponse.json(foundData);
  } catch (error) {
    console.error("❌ [GET-ORDER-ROLLS] Error general:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// Cache the response
const getCachedOrderRolls = withCache(getOrderRollsData, {
  keyPrefix: "api:packing-list:order-rolls",
  ttl: CACHE_TTL.ROLLS_DATA, // 7 days
  skipCache: (req) => {
    const url = new URL(req.url);
    return url.searchParams.get("refresh") === "true";
  },
  onCacheHit: (key) => console.log(`📦 Cache HIT - Order Rolls: ${key}`),
  onCacheMiss: (key) => console.log(`💾 Cache MISS - Order Rolls: ${key}`),
});

export { getCachedOrderRolls as GET };

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

    await invalidateCachePattern("cache:api:packing-list:order-rolls*");

    return NextResponse.json({
      success: true,
      message: "Cache de rollos de orden invalidado",
      cache: { invalidated: true },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}