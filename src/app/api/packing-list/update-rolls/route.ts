import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  _Object,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { invalidateCachePattern } from "@/lib/cache-middleware";

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
  [key: string]: unknown;
}

interface PackingListEntry {
  fabric_type: string;
  color: string;
  lot: string;
  rolls: Roll[];
  [key: string]: unknown;
}

interface FileWithRolls {
  fileKey: string;
  data: PackingListEntry[];
  rawData: RawRollData[];
}

interface UpdateRollsRequest {
  tela: string;
  color: string;
  lot: number;
  soldRolls: number[];
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
  return Array.isArray(result) ? result : [];
}

async function findRollInFiles(
  tela: string,
  color: string,
  lot: string,
  rollNumbers: number[],
  files: string[]
): Promise<FileWithRolls | null> {
  for (const fileKey of files) {
    const rawData = await readPackingListFile(fileKey);
    if (!rawData || rawData.length === 0) continue;

    const transformedData = transformRawDataToPackingList(rawData);

    const foundEntry = transformedData.find(
      (entry: PackingListEntry) =>
        entry.fabric_type?.toLowerCase() === tela.toLowerCase() &&
        entry.color?.toLowerCase() === color.toLowerCase() &&
        entry.lot === lot
    );

    if (foundEntry && foundEntry.rolls) {
      const availableRollNumbers = foundEntry.rolls.map(
        (roll: Roll) => roll.roll_number
      );
      const rollsFoundInThisFile = rollNumbers.filter((rollNum: number) =>
        availableRollNumbers.includes(rollNum)
      );

      if (rollsFoundInThisFile.length > 0) {
        return { fileKey, data: transformedData, rawData };
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "auth",
      message:
        "Demasiadas actualizaciones de rollos. Espera antes de continuar.",
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
        { error: "No autorizado para actualizar rollos" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as UpdateRollsRequest;
    const { tela, color, lot, soldRolls } = body;

    if (!tela || !color || !lot || !soldRolls || soldRolls.length === 0) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    const invalidRolls = soldRolls.filter(
      (roll: number) => typeof roll !== "number"
    );
    if (invalidRolls.length > 0) {
      return NextResponse.json(
        { error: "Todos los números de rollo deben ser válidos" },
        { status: 400 }
      );
    }

    const allFiles = await getAllPackingListFiles();

    if (allFiles.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron archivos de packing list" },
        { status: 404 }
      );
    }

    const fileWithRolls = await findRollInFiles(
      tela,
      color,
      lot.toString(),
      soldRolls,
      allFiles
    );

    if (!fileWithRolls) {
      return NextResponse.json(
        {
          error: `No se encontraron los rollos especificados para ${tela} - ${color} - Lote: ${lot}`,
        },
        { status: 404 }
      );
    }

    const { fileKey, rawData } = fileWithRolls;

    const updatedRawData = rawData.filter((rawRoll: RawRollData) => {
      if (
        rawRoll.tela?.toLowerCase() === tela.toLowerCase() &&
        rawRoll.color?.toLowerCase() === color.toLowerCase() &&
        rawRoll.lote === lot.toString()
      ) {
        const rollNumber = parseInt(rawRoll.rollo_id);
        return !soldRolls.includes(rollNumber);
      }
      return true;
    });

    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
      Body: JSON.stringify(updatedRawData, null, 2),
      ContentType: "application/json",
      Metadata: {
        "last-updated": new Date().toISOString(),
        "updated-by": session.user.email || "",
        operation: "update-rolls-sold",
      },
    });

    await s3Client.send(putCommand);

    const timestamp = Date.now();
    const fileName = fileKey.split("/").pop()?.replace(".json", "");
    const backupFileName = `${fileName}_backup_${timestamp}.json`;

    const backupCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: `Inventario/Catalogo_Rollos/backups/${backupFileName}`,
      Body: JSON.stringify(updatedRawData, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(backupCommand);

    await invalidateCachePattern("cache:api:s3:get-rolls*");

    console.log(`[SOLD] User ${session.user.email} marked rolls as sold:`, {
      tela,
      color,
      lot,
      soldRolls,
      timestamp: new Date().toISOString(),
    });

    const remainingRolls = updatedRawData.filter(
      (rawRoll: RawRollData) =>
        rawRoll.tela?.toLowerCase() === tela.toLowerCase() &&
        rawRoll.color?.toLowerCase() === color.toLowerCase() &&
        rawRoll.lote === lot.toString()
    ).length;

    return NextResponse.json({
      success: true,
      message: `Packing list actualizado correctamente`,
      updatedFile: fileKey,
      backupFile: `Inventario/Catalogo_Rollos/backups/${backupFileName}`,
      rollsRemoved: soldRolls,
      remainingRolls: remainingRolls,
      cache: { invalidated: true, pattern: "get-rolls" },
    });
  } catch (error) {
    console.error("Error actualizando packing list:", error);
    return NextResponse.json(
      { error: "Error al actualizar el packing list" },
      { status: 500 }
    );
  }
}
