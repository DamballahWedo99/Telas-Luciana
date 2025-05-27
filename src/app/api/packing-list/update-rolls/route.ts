import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function getAllPackingListFiles(): Promise<string[]> {
  try {
    let allFiles: any[] = [];
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

    const packingListFiles = allFiles
      .filter((item) => {
        const key = item.Key || "";
        const isJson = key.endsWith(".json");
        const hasPackingLists = key.includes("packing_lists_con_unidades");
        const isNotBackup = !key.includes("backup");
        const isNotRowFile = !key.includes("_row");
        const isMainFile = key.includes("Catalogo_Rollos/");

        return (
          isJson && hasPackingLists && isNotBackup && isNotRowFile && isMainFile
        );
      })
      .map((item) => item.Key!);

    return packingListFiles;
  } catch (error) {
    console.error("Error al buscar archivos de packing list:", error);
    return [];
  }
}

async function readPackingListFile(fileKey: string): Promise<any[] | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body?.transformToString();

    if (!bodyString) {
      return null;
    }

    return JSON.parse(bodyString);
  } catch (error) {
    console.error(`Error al leer archivo ${fileKey}:`, error);
    return null;
  }
}

async function findRollInFiles(
  tela: string,
  color: string,
  lot: string,
  rollNumbers: number[],
  files: string[]
): Promise<{ fileKey: string; data: any[] } | null> {
  for (const fileKey of files) {
    const data = await readPackingListFile(fileKey);
    if (!data) continue;

    const foundEntry = data.find(
      (entry: any) =>
        entry.fabric_type?.toLowerCase() === tela.toLowerCase() &&
        entry.color?.toLowerCase() === color.toLowerCase() &&
        entry.lot === lot
    );

    if (foundEntry && foundEntry.rolls) {
      const availableRollNumbers = foundEntry.rolls.map(
        (roll: any) => roll.roll_number
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
    const body = await request.json();
    const { tela, color, lot, soldRolls } = body;

    if (!tela || !color || !lot || !soldRolls || soldRolls.length === 0) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
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
      lot,
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

    const { fileKey, data: packingListData } = fileWithRolls;

    const updatedData = packingListData.map((entry: any) => {
      if (
        entry.fabric_type?.toLowerCase() === tela.toLowerCase() &&
        entry.color?.toLowerCase() === color.toLowerCase() &&
        entry.lot === lot
      ) {
        entry.rolls =
          entry.rolls?.filter(
            (roll: any) => !soldRolls.includes(roll.roll_number)
          ) || [];
      }
      return entry;
    });

    const updatedEntry = updatedData.find(
      (entry) =>
        entry.fabric_type?.toLowerCase() === tela.toLowerCase() &&
        entry.color?.toLowerCase() === color.toLowerCase() &&
        entry.lot === lot
    );

    if (updatedEntry) {
      const remainingRollNumbers =
        updatedEntry.rolls?.map((r: any) => r.roll_number) || [];
      const soldRollsStillPresent = soldRolls.filter((rollNum: number) =>
        remainingRollNumbers.includes(rollNum)
      );

      if (soldRollsStillPresent.length > 0) {
        return NextResponse.json(
          {
            error: `Error al eliminar rollos: ${soldRollsStillPresent.join(
              ", "
            )}`,
          },
          { status: 500 }
        );
      }
    }

    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
      Body: JSON.stringify(updatedData, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(putCommand);

    const timestamp = Date.now();
    const fileName = fileKey.split("/").pop()?.replace(".json", "");
    const backupFileName = `${fileName}_backup_${timestamp}.json`;

    const backupCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: `Inventario/Catalogo_Rollos/backups/${backupFileName}`,
      Body: JSON.stringify(updatedData, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(backupCommand);

    return NextResponse.json({
      success: true,
      message: `Packing list actualizado correctamente`,
      updatedFile: fileKey,
      backupFile: `Inventario/Catalogo_Rollos/backups/${backupFileName}`,
      rollsRemoved: soldRolls,
      remainingRolls: updatedEntry?.rolls?.length || 0,
    });
  } catch (error) {
    console.error("Error al actualizar packing list:", error);
    return NextResponse.json(
      { error: "Error al actualizar el packing list" },
      { status: 500 }
    );
  }
}
