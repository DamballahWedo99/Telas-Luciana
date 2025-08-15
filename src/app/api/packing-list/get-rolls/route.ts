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

interface RawRollData {
  rollo_id: string;
  OC: string;
  tela: string;
  color: string;
  lote: string;
  unidad: string;
  cantidad: number;
  fecha_ingreso: string;
  status: string;
  almacen?: string;
}

interface Roll {
  roll_number: number;
  almacen: string;
  meters?: number;
  weight?: number;
  OC?: string;
  unidad?: string;
  fecha_ingreso?: string;
  status?: string;
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

    return allFiles
      .filter((item) => {
        const key = item.Key || "";
        return (
          key.endsWith(".json") &&
          !key.includes("backup") &&
          !key.includes("_row")
        );
      })
      .map((item) => item.Key!);
  } catch (error) {
    console.error("Error buscando archivos packing list:", error);
    return [];
  }
}

async function readPackingListFile(fileKey: string): Promise<RawRollData[]> {
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

function determineRollLocation(rawRoll: RawRollData): string {
  if (rawRoll.almacen) {
    return rawRoll.almacen;
  }

  const oc = (rawRoll.OC || "").toLowerCase();

  if (
    oc.includes("ttl-04-25") ||
    oc.includes("ttl-02-2025") ||
    oc.includes("dr-05-25")
  ) {
    return "CDMX";
  } else if (oc.includes("dsma-03-23") || oc.includes("dsma-04-23")) {
    return "MID";
  }

  return "CDMX";
}

function transformRawDataToPackingList(
  rawData: RawRollData[]
): PackingListEntry[] {
  if (!Array.isArray(rawData)) {
    console.error("❌ transformRawDataToPackingList: rawData no es un array");
    return [];
  }

  const grouped = new Map<string, PackingListEntry>();

  rawData.forEach((rawRoll) => {
    if (
      !rawRoll ||
      typeof rawRoll !== "object" ||
      !rawRoll.tela ||
      !rawRoll.color ||
      !rawRoll.lote ||
      !rawRoll.rollo_id
    ) {
      console.warn("⚠️ Rollo inválido omitido:", rawRoll);
      return;
    }

    const key = `${rawRoll.tela}-${rawRoll.color}-${rawRoll.lote}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        fabric_type: rawRoll.tela,
        color: rawRoll.color,
        lot: rawRoll.lote,
        rolls: [],
      });
    }

    const entry = grouped.get(key)!;
    const rollNumber = parseInt(rawRoll.rollo_id);

    if (isNaN(rollNumber) || rollNumber <= 0) {
      console.warn(
        `⚠️ Roll number inválido omitido: ${rawRoll.rollo_id} para ${key}`
      );
      return;
    }

    const existingRollIndex = entry.rolls.findIndex(
      (r) => r.roll_number === rollNumber
    );

    const almacen = determineRollLocation(rawRoll);

    const rollData: Roll = {
      roll_number: rollNumber,
      weight:
        typeof rawRoll.cantidad === "number"
          ? rawRoll.cantidad
          : parseFloat(rawRoll.cantidad) || 0,
      almacen: almacen,
      OC: rawRoll.OC || "",
      unidad: rawRoll.unidad || "",
      fecha_ingreso: rawRoll.fecha_ingreso || "",
      status: rawRoll.status || "",
    };

    if (existingRollIndex >= 0) {
      entry.rolls[existingRollIndex] = rollData;
    } else {
      entry.rolls.push(rollData);
    }
  });

  Array.from(grouped.values()).forEach((entry) => {
    entry.rolls.sort((a, b) => a.roll_number - b.roll_number);
  });

  const result = Array.from(grouped.values());

  const locationSummary = result.reduce(
    (acc, entry) => {
      entry.rolls.forEach((roll) => {
        acc[roll.almacen] = (acc[roll.almacen] || 0) + 1;
      });
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`📊 Resumen de ubicaciones asignadas:`, locationSummary);

  return Array.isArray(result) ? result : [];
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
    const oc = searchParams.get("oc");

    if (!tela || !color) {
      return NextResponse.json(
        { error: "Tela y color son requeridos" },
        { status: 400 }
      );
    }

    console.log(`🔍 Buscando tela: "${tela}", color: "${color}", OC: "${oc || 'todas'}"`);

    const allFiles = await getAllPackingListFiles();
    console.log(`📁 Archivos encontrados: ${allFiles.length}`);

    if (allFiles.length === 0) {
      console.log("❌ No se encontraron archivos");
      return NextResponse.json([]);
    }

    let allRawData: RawRollData[] = [];

    for (const fileKey of allFiles) {
      console.log(`📖 Leyendo archivo: ${fileKey}`);
      const fileData = await readPackingListFile(fileKey);
      allRawData = allRawData.concat(fileData);
    }

    console.log(`📊 Total de rollos RAW: ${allRawData.length}`);

    if (!Array.isArray(allRawData)) {
      console.error("❌ Los datos RAW no son un array válido");
      return NextResponse.json([]);
    }

    const transformedData = transformRawDataToPackingList(allRawData);
    console.log(`🔄 Datos transformados: ${transformedData.length} grupos`);

    if (!Array.isArray(transformedData)) {
      console.error("❌ Los datos transformados no son un array válido");
      return NextResponse.json([]);
    }

    const filteredData = transformedData.filter((entry: PackingListEntry) => {
      const matchesFabric =
        entry.fabric_type?.toLowerCase() === tela.toLowerCase();
      const matchesColor = entry.color?.toLowerCase() === color.toLowerCase();
      
      if (!matchesFabric || !matchesColor) {
        return false;
      }
      
      if (oc) {
        const filteredRolls = entry.rolls.filter((roll: Roll) => 
          roll.OC && typeof roll.OC === 'string' && roll.OC.toLowerCase() === oc.toLowerCase()
        );
        
        if (filteredRolls.length > 0) {
          entry.rolls = filteredRolls;
          return true;
        }
        return false;
      }
      
      return true;
    });

    console.log(
      `✅ Datos filtrados: ${filteredData.length} grupos que coinciden`
    );

    const finalResult = Array.isArray(filteredData) ? filteredData : [];
    return NextResponse.json(finalResult);
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
