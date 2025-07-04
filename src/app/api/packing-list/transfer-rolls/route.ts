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
  lot: number;
  rolls: Roll[];
  [key: string]: unknown;
}

interface FileWithRolls {
  fileKey: string;
  data: PackingListEntry[];
}

interface TransferRequest {
  tela: string;
  color: string;
  lot: number;
  transferRolls: number[];
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
): Promise<PackingListEntry[] | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body?.transformToString();

    return bodyString ? JSON.parse(bodyString) : null;
  } catch (error) {
    console.error(`Error leyendo archivo ${fileKey}:`, error);
    return null;
  }
}

async function findRollInFiles(
  tela: string,
  color: string,
  lot: string,
  rollNumbers: number[],
  files: string[]
): Promise<FileWithRolls | null> {
  for (const fileKey of files) {
    const data = await readPackingListFile(fileKey);
    if (!data) continue;

    const foundEntry = data.find(
      (entry: PackingListEntry) =>
        entry.fabric_type?.toLowerCase() === tela.toLowerCase() &&
        entry.color?.toLowerCase() === color.toLowerCase() &&
        entry.lot === parseInt(lot)
    );

    if (foundEntry && foundEntry.rolls) {
      const availableRollNumbers = foundEntry.rolls.map(
        (roll: Roll) => roll.roll_number
      );
      const rollsFoundInThisFile = rollNumbers.filter((rollNum: number) =>
        availableRollNumbers.includes(rollNum)
      );

      if (rollsFoundInThisFile.length > 0) {
        return { fileKey, data };
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "auth",
      message: "Demasiados traslados de rollos. Espera antes de continuar.",
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
        { error: "No autorizado para trasladar rollos" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as TransferRequest;
    const { tela, color, lot, transferRolls } = body;

    if (!tela || typeof tela !== "string") {
      return NextResponse.json(
        { error: "El campo 'tela' es requerido" },
        { status: 400 }
      );
    }

    if (!color || typeof color !== "string") {
      return NextResponse.json(
        { error: "El campo 'color' es requerido" },
        { status: 400 }
      );
    }

    if (lot === null || lot === undefined) {
      return NextResponse.json(
        { error: "El campo 'lot' es requerido" },
        { status: 400 }
      );
    }

    if (
      !transferRolls ||
      !Array.isArray(transferRolls) ||
      transferRolls.length === 0
    ) {
      return NextResponse.json(
        { error: "Se requiere al menos un rollo para trasladar" },
        { status: 400 }
      );
    }

    const invalidRolls = transferRolls.filter(
      (roll) => typeof roll !== "number"
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
      transferRolls,
      allFiles
    );

    if (!fileWithRolls) {
      return NextResponse.json(
        {
          error: `No se encontraron los rollos especificados para ${tela} - ${color} - Lote: ${lot}`,
          searchCriteria: { tela, color, lot, transferRolls },
        },
        { status: 404 }
      );
    }

    const { fileKey, data: packingListData } = fileWithRolls;

    const entryToUpdate = packingListData.find(
      (entry) =>
        entry.fabric_type?.toLowerCase() === tela.toLowerCase() &&
        entry.color?.toLowerCase() === color.toLowerCase() &&
        entry.lot === parseInt(lot.toString())
    );

    if (!entryToUpdate) {
      return NextResponse.json(
        { error: "No se encontró la entrada correspondiente" },
        { status: 404 }
      );
    }

    const availableRollNumbers =
      entryToUpdate.rolls?.map((roll: Roll) => roll.roll_number) || [];

    const nonExistentRolls = transferRolls.filter(
      (rollNum) => !availableRollNumbers.includes(rollNum)
    );

    if (nonExistentRolls.length > 0) {
      return NextResponse.json(
        {
          error: `Rollos no encontrados: ${nonExistentRolls.join(", ")}`,
          nonExistentRolls,
          availableRolls: availableRollNumbers,
        },
        { status: 404 }
      );
    }

    const rollsToTransfer =
      entryToUpdate.rolls?.filter((roll: Roll) =>
        transferRolls.includes(roll.roll_number)
      ) || [];

    const nonCdmxRolls = rollsToTransfer.filter(
      (roll: Roll) => roll.almacen !== "CDMX"
    );

    if (nonCdmxRolls.length > 0) {
      return NextResponse.json(
        {
          error: `Rollos no están en CDMX: ${nonCdmxRolls
            .map((r: Roll) => `#${r.roll_number} (${r.almacen})`)
            .join(", ")}`,
          rollsNotInCDMX: nonCdmxRolls.map((r: Roll) => ({
            roll_number: r.roll_number,
            current_location: r.almacen,
          })),
        },
        { status: 400 }
      );
    }

    const updatedData = packingListData.map((entry: PackingListEntry) => {
      if (
        entry.fabric_type?.toLowerCase() === tela.toLowerCase() &&
        entry.color?.toLowerCase() === color.toLowerCase() &&
        entry.lot === parseInt(lot.toString())
      ) {
        entry.rolls =
          entry.rolls?.map((roll: Roll) => {
            if (
              transferRolls.includes(roll.roll_number) &&
              roll.almacen === "CDMX"
            ) {
              return {
                ...roll,
                almacen: "Mérida",
              };
            }
            return roll;
          }) || [];
      }
      return entry;
    });

    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
      Body: JSON.stringify(updatedData, null, 2),
      ContentType: "application/json",
      Metadata: {
        "last-updated": new Date().toISOString(),
        "updated-by": session.user.email || "",
        operation: "transfer-rolls",
      },
    });

    await s3Client.send(putCommand);

    const timestamp = Date.now();
    const fileName = fileKey.split("/").pop()?.replace(".json", "");
    const backupFileName = `${fileName}_transfer_backup_${timestamp}.json`;

    const backupCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: `Inventario/Catalogo_Rollos/backups/${backupFileName}`,
      Body: JSON.stringify(updatedData, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(backupCommand);

    await invalidateCachePattern("cache:api:s3:get-rolls*");

    console.log(`[TRANSFER] User ${session.user.email} transferred rolls:`, {
      tela,
      color,
      lot,
      rollsTransferred: transferRolls,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `${transferRolls.length} rollos trasladados de CDMX a Mérida`,
      updatedFile: fileKey,
      backupFile: `Inventario/Catalogo_Rollos/backups/${backupFileName}`,
      rollsTransferred: transferRolls,
      transferredCount: transferRolls.length,
      cache: { invalidated: true, pattern: "get-rolls" },
    });
  } catch (error) {
    console.error("Error trasladando rollos:", error);
    return NextResponse.json(
      {
        error: "Error al trasladar los rollos",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
