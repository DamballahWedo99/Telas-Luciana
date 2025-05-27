import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
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

async function readPackingListFile(fileKey: string): Promise<any[]> {
  try {
    const command = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body?.transformToString();

    if (!bodyString) {
      return [];
    }

    return JSON.parse(bodyString);
  } catch (error) {
    console.error(`Error al leer archivo ${fileKey}:`, error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
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
      return NextResponse.json(
        { error: "No se encontraron archivos de packing list" },
        { status: 404 }
      );
    }

    let allData: any[] = [];

    for (const fileKey of allFiles) {
      const fileData = await readPackingListFile(fileKey);
      allData = allData.concat(fileData);
    }

    const filteredData = allData.filter((entry: any) => {
      const matchesFabric =
        entry.fabric_type?.toLowerCase() === tela.toLowerCase();
      const matchesColor = entry.color?.toLowerCase() === color.toLowerCase();
      return matchesFabric && matchesColor;
    });

    const consolidatedData = filteredData.reduce((acc: any[], current: any) => {
      const existingIndex = acc.findIndex(
        (item) =>
          item.fabric_type === current.fabric_type &&
          item.color === current.color &&
          item.lot === current.lot
      );

      if (existingIndex >= 0) {
        const existingEntry = acc[existingIndex];
        const existingRolls = existingEntry.rolls || [];
        const currentRolls = current.rolls || [];

        const rollsMap = new Map();

        existingRolls.forEach((roll: any) => {
          rollsMap.set(roll.roll_number, roll);
        });

        currentRolls.forEach((roll: any) => {
          rollsMap.set(roll.roll_number, roll);
        });

        acc[existingIndex].rolls = Array.from(rollsMap.values()).sort(
          (a, b) => a.roll_number - b.roll_number
        );
      } else {
        const rollsMap = new Map();
        const rolls = current.rolls || [];

        rolls.forEach((roll: any) => {
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
    }, []);

    return NextResponse.json(consolidatedData);
  } catch (error) {
    console.error("Error al obtener packing list:", error);
    return NextResponse.json(
      { error: "Error al obtener los datos del packing list" },
      { status: 500 }
    );
  }
}
