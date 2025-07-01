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

const s3Client = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

interface Roll {
  roll_number: number;
  meters?: number;
  weight?: number;
  [key: string]: unknown;
}

interface PackingListEntry {
  fabric_type: string;
  color: string;
  lot: string;
  rolls: Roll[];
  [key: string]: unknown;
}

async function getAllPackingListFiles(): Promise<string[]> {
  try {
    let allFiles: _Object[] = [];
    let continuationToken: string | undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: "telas-luciana",
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });

      const listResponse = await s3Client.send(listCommand);

      if (listResponse.Contents) {
        allFiles = allFiles.concat(listResponse.Contents);
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    return allFiles
      .filter((item) => {
        const key = item.Key || "";
        return (
          key.endsWith(".json") &&
          key.includes("packing_lists_con_unidades") &&
          !key.includes("backup") &&
          !key.includes("_row") &&
          key.includes("Catalogo_Rollos/")
        );
      })
      .map((item) => item.Key!);
  } catch (error) {
    console.error("Error buscando archivos packing list:", error);
    return [];
  }
}

async function readPackingListFile(
  fileKey: string
): Promise<PackingListEntry[]> {
  try {
    const command = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body?.transformToString();

    return bodyString ? JSON.parse(bodyString) : [];
  } catch (error) {
    console.error(`Error leyendo archivo ${fileKey}:`, error);
    return [];
  }
}

async function getRollsData(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const tela = searchParams.get("tela");
    const color = searchParams.get("color");

    if (!tela || !color) {
      return NextResponse.json(
        { error: "Tela y color son requeridos" },
        { status: 400 }
      );
    }

    const allFiles = await getAllPackingListFiles();

    if (allFiles.length === 0) {
      return NextResponse.json([]);
    }

    let allData: PackingListEntry[] = [];

    for (const fileKey of allFiles) {
      const fileData = await readPackingListFile(fileKey);
      allData = allData.concat(fileData);
    }

    const filteredData = allData.filter((entry: PackingListEntry) => {
      const matchesFabric =
        entry.fabric_type?.toLowerCase() === tela.toLowerCase();
      const matchesColor = entry.color?.toLowerCase() === color.toLowerCase();
      return matchesFabric && matchesColor;
    });

    const consolidatedData = filteredData.reduce(
      (acc: PackingListEntry[], current: PackingListEntry) => {
        const existingIndex = acc.findIndex(
          (item) =>
            item.fabric_type === current.fabric_type &&
            item.color === current.color &&
            item.lot === current.lot
        );

        if (existingIndex >= 0) {
          const existingEntry = acc[existingIndex];
          const rollsMap = new Map();

          (existingEntry.rolls || []).forEach((roll: Roll) => {
            rollsMap.set(roll.roll_number, roll);
          });

          (current.rolls || []).forEach((roll: Roll) => {
            rollsMap.set(roll.roll_number, roll);
          });

          acc[existingIndex].rolls = Array.from(rollsMap.values()).sort(
            (a, b) => a.roll_number - b.roll_number
          );
        } else {
          const rollsMap = new Map();
          (current.rolls || []).forEach((roll: Roll) => {
            rollsMap.set(roll.roll_number, roll);
          });

          acc.push({
            ...current,
            rolls: Array.from(rollsMap.values()).sort(
              (a, b) => a.roll_number - b.roll_number
            ),
          });
        }

        return acc;
      },
      []
    );

    return NextResponse.json(consolidatedData);
  } catch (error) {
    console.error("Error obteniendo packing list:", error);
    return NextResponse.json([]);
  }
}

const getCachedRolls = withCache(getRollsData, {
  keyPrefix: "api:s3:get-rolls",
  ttl: CACHE_TTL.ROLLS_DATA,
  skipCache: (req) => {
    const url = new URL(req.url);
    return url.searchParams.get("refresh") === "true";
  },
  onCacheHit: (key) => console.log(`📦 Cache HIT - Get Rolls: ${key}`),
  onCacheMiss: (key) => console.log(`💾 Cache MISS - Get Rolls: ${key}`),
});

export { getCachedRolls as GET };

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

    await invalidateCachePattern("cache:api:s3:get-rolls*");

    return NextResponse.json({
      success: true,
      message: "Cache de rollos invalidado",
      cache: { invalidated: true },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
