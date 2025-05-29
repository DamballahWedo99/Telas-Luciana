// app/api/packing-list/transfer-rolls/route.ts
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
  console.log(`🔍 BUSCANDO ROLLOS EN ARCHIVOS:`, {
    tela,
    color,
    lot,
    rollNumbers,
    totalFiles: files.length,
  });

  for (const fileKey of files) {
    const data = await readPackingListFile(fileKey);
    if (!data) continue;

    const foundEntry = data.find(
      (entry: any) =>
        entry.fabric_type?.toLowerCase() === tela.toLowerCase() &&
        entry.color?.toLowerCase() === color.toLowerCase() &&
        entry.lot === parseInt(lot)
    );

    if (foundEntry && foundEntry.rolls) {
      const availableRollNumbers = foundEntry.rolls.map(
        (roll: any) => roll.roll_number
      );
      const rollsFoundInThisFile = rollNumbers.filter((rollNum: number) =>
        availableRollNumbers.includes(rollNum)
      );

      console.log(`📁 ARCHIVO: ${fileKey}`, {
        foundEntry: !!foundEntry,
        availableRolls: availableRollNumbers,
        searchingFor: rollNumbers,
        found: rollsFoundInThisFile,
      });

      if (rollsFoundInThisFile.length > 0) {
        console.log(`✅ ROLLOS ENCONTRADOS EN: ${fileKey}`);
        return { fileKey, data };
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log(
      "🚀 TRANSFER ROLLS - Datos recibidos:",
      JSON.stringify(body, null, 2)
    );

    const { tela, color, lot, transferRolls } = body;

    // Validaciones mejoradas
    if (!tela || typeof tela !== "string") {
      console.log("❌ VALIDACIÓN FALLIDA: tela inválida");
      return NextResponse.json(
        {
          error: "El campo 'tela' es requerido y debe ser una cadena de texto",
        },
        { status: 400 }
      );
    }

    if (!color || typeof color !== "string") {
      console.log("❌ VALIDACIÓN FALLIDA: color inválido");
      return NextResponse.json(
        {
          error: "El campo 'color' es requerido y debe ser una cadena de texto",
        },
        { status: 400 }
      );
    }

    if (lot === null || lot === undefined) {
      console.log("❌ VALIDACIÓN FALLIDA: lot inválido");
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
      console.log("❌ VALIDACIÓN FALLIDA: transferRolls inválido");
      return NextResponse.json(
        { error: "El campo 'transferRolls' debe ser un array no vacío" },
        { status: 400 }
      );
    }

    // Validar que todos los elementos de transferRolls sean números
    const invalidRolls = transferRolls.filter(
      (roll) => typeof roll !== "number"
    );
    if (invalidRolls.length > 0) {
      console.log(
        "❌ VALIDACIÓN FALLIDA: algunos rollos no son números:",
        invalidRolls
      );
      return NextResponse.json(
        { error: "Todos los elementos de 'transferRolls' deben ser números" },
        { status: 400 }
      );
    }

    console.log("✅ VALIDACIONES PASADAS");

    const allFiles = await getAllPackingListFiles();
    console.log(`📁 ARCHIVOS DE PACKING LIST ENCONTRADOS: ${allFiles.length}`);

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
      console.log("❌ NO SE ENCONTRARON ROLLOS");
      return NextResponse.json(
        {
          error: `No se encontraron los rollos especificados para ${tela} - ${color} - Lote: ${lot}`,
          searchCriteria: { tela, color, lot, transferRolls },
        },
        { status: 404 }
      );
    }

    const { fileKey, data: packingListData } = fileWithRolls;
    console.log(`📦 PROCESANDO ARCHIVO: ${fileKey}`);

    // Verificar que todos los rollos a trasladar están en CDMX
    const entryToUpdate = packingListData.find(
      (entry) =>
        entry.fabric_type?.toLowerCase() === tela.toLowerCase() &&
        entry.color?.toLowerCase() === color.toLowerCase() &&
        entry.lot === parseInt(lot.toString())
    );

    if (!entryToUpdate) {
      console.log("❌ NO SE ENCONTRÓ LA ENTRADA EN LOS DATOS");
      return NextResponse.json(
        {
          error: "No se encontró la entrada correspondiente en el packing list",
        },
        { status: 404 }
      );
    }

    // Verificar qué rollos existen y cuáles no
    const availableRollNumbers =
      entryToUpdate.rolls?.map((roll: any) => roll.roll_number) || [];
    const existingRolls = transferRolls.filter((rollNum) =>
      availableRollNumbers.includes(rollNum)
    );
    const nonExistentRolls = transferRolls.filter(
      (rollNum) => !availableRollNumbers.includes(rollNum)
    );

    console.log("🔍 ANÁLISIS DE ROLLOS:", {
      requested: transferRolls,
      available: availableRollNumbers,
      existing: existingRolls,
      nonExistent: nonExistentRolls,
    });

    // Si hay rollos que no existen, reportar error específico
    if (nonExistentRolls.length > 0) {
      console.log("❌ ROLLOS NO ENCONTRADOS:", nonExistentRolls);
      return NextResponse.json(
        {
          error: `Los siguientes rollos no existen en el packing list: ${nonExistentRolls.join(
            ", "
          )}`,
          nonExistentRolls,
          availableRolls: availableRollNumbers,
          tela,
          color,
          lot,
        },
        { status: 404 }
      );
    }

    const rollsToTransfer =
      entryToUpdate.rolls?.filter((roll: any) =>
        transferRolls.includes(roll.roll_number)
      ) || [];

    console.log(
      "🔄 ROLLOS A TRASLADAR:",
      rollsToTransfer.map((r: any) => ({
        roll_number: r.roll_number,
        almacen: r.almacen,
      }))
    );

    const cdmxRolls = rollsToTransfer.filter(
      (roll: any) => roll.almacen === "CDMX"
    );

    const nonCdmxRolls = rollsToTransfer.filter(
      (roll: any) => roll.almacen !== "CDMX"
    );

    console.log(`📊 VALIDACIÓN DE UBICACIÓN:`, {
      rollsToTransfer: rollsToTransfer.length,
      cdmxRolls: cdmxRolls.length,
      nonCdmxRolls: nonCdmxRolls.length,
      transferRollsRequested: transferRolls.length,
    });

    if (nonCdmxRolls.length > 0) {
      console.log("❌ ALGUNOS ROLLOS NO ESTÁN EN CDMX:", nonCdmxRolls);
      return NextResponse.json(
        {
          error: `Los siguientes rollos no están en CDMX y no se pueden trasladar: ${nonCdmxRolls
            .map((r: any) => `#${r.roll_number} (${r.almacen})`)
            .join(", ")}`,
          rollsNotInCDMX: nonCdmxRolls.map((r: any) => ({
            roll_number: r.roll_number,
            current_location: r.almacen,
          })),
          rollsInCDMX: cdmxRolls.map((r: any) => r.roll_number),
        },
        { status: 400 }
      );
    }

    // Actualizar los datos cambiando la ubicación de los rollos
    const updatedData = packingListData.map((entry: any) => {
      if (
        entry.fabric_type?.toLowerCase() === tela.toLowerCase() &&
        entry.color?.toLowerCase() === color.toLowerCase() &&
        entry.lot === parseInt(lot.toString())
      ) {
        entry.rolls =
          entry.rolls?.map((roll: any) => {
            if (
              transferRolls.includes(roll.roll_number) &&
              roll.almacen === "CDMX"
            ) {
              console.log(
                `🔄 TRASLADANDO ROLLO ${roll.roll_number} de CDMX a Mérida`
              );
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

    // Verificar que los rollos se trasladaron correctamente
    const updatedEntry = updatedData.find(
      (entry) =>
        entry.fabric_type?.toLowerCase() === tela.toLowerCase() &&
        entry.color?.toLowerCase() === color.toLowerCase() &&
        entry.lot === parseInt(lot.toString())
    );

    if (updatedEntry) {
      const transferredRolls =
        updatedEntry.rolls?.filter(
          (roll: any) =>
            transferRolls.includes(roll.roll_number) &&
            roll.almacen === "Mérida"
        ) || [];

      console.log(`✅ VERIFICACIÓN POST-TRASLADO:`, {
        expectedTransfers: transferRolls.length,
        actualTransfers: transferredRolls.length,
      });

      if (transferredRolls.length !== transferRolls.length) {
        return NextResponse.json(
          { error: "Error al trasladar algunos rollos" },
          { status: 500 }
        );
      }
    }

    // Guardar el archivo actualizado
    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
      Body: JSON.stringify(updatedData, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(putCommand);
    console.log("💾 ARCHIVO PRINCIPAL GUARDADO");

    // Crear backup
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
    console.log("💾 BACKUP GUARDADO");

    console.log("🎉 TRANSFER ROLLS COMPLETADO EXITOSAMENTE");

    return NextResponse.json({
      success: true,
      message: `Rollos trasladados correctamente de CDMX a Mérida`,
      updatedFile: fileKey,
      backupFile: `Inventario/Catalogo_Rollos/backups/${backupFileName}`,
      rollsTransferred: transferRolls,
      transferredCount: transferRolls.length,
    });
  } catch (error) {
    console.error("❌ ERROR AL TRASLADAR ROLLOS:", error);
    return NextResponse.json(
      {
        error: "Error al trasladar los rollos",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
