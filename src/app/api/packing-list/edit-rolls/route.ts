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
import type { PackingListRoll } from "../../../../../types/types";

const s3Client = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

interface EditRollsRequest {
  oc: string;
  updatedRolls: PackingListRoll[];
}

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

async function findFileContainingOC(oc: string, files: _Object[]): Promise<string | null> {
  for (const file of files) {
    if (!file.Key) continue;

    try {
      const rolls = await readPackingListFile(file.Key);
      
      // Check if this file contains the OC
      const hasOC = rolls.some(roll => 
        roll.OC && roll.OC.trim().toLowerCase() === oc.toLowerCase()
      );

      if (hasOC) {
        return file.Key;
      }
    } catch (error) {
      console.error(`❌ Error procesando ${file.Key}:`, error);
      continue;
    }
  }

  return null;
}

function validateRollData(roll: PackingListRoll): { valid: boolean; error?: string } {
  // Check required fields
  if (!roll.rollo_id || !roll.OC || !roll.tela || !roll.color || !roll.lote) {
    return { valid: false, error: `Campos requeridos faltantes en rollo ${roll.rollo_id}` };
  }

  // Validate unidad
  if (roll.unidad !== "KG" && roll.unidad !== "MTS") {
    return { valid: false, error: `Unidad inválida para rollo ${roll.rollo_id}: debe ser KG o MTS` };
  }

  // Validate cantidad
  if (typeof roll.cantidad !== "number" || roll.cantidad <= 0) {
    return { valid: false, error: `Cantidad inválida para rollo ${roll.rollo_id}: debe ser un número mayor a 0` };
  }

  // Validate status
  const validStatuses = ["pending", "active", "sold", "returned"];
  if (roll.status && !validStatuses.includes(roll.status)) {
    return { valid: false, error: `Status inválido para rollo ${roll.rollo_id}: debe ser uno de ${validStatuses.join(", ")}` };
  }

  return { valid: true };
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "auth",
      message: "Demasiadas actualizaciones de rollos. Espera antes de continuar.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Only admins can edit packing lists
    if (session.user.role !== "admin" && session.user.role !== "major_admin") {
      return NextResponse.json(
        { error: "No autorizado para editar packing lists" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as EditRollsRequest;
    const { oc, updatedRolls } = body;

    if (!oc || !updatedRolls || !Array.isArray(updatedRolls)) {
      return NextResponse.json(
        { error: "OC y rollos actualizados son requeridos" },
        { status: 400 }
      );
    }

    if (updatedRolls.length === 0) {
      return NextResponse.json(
        { error: "Debe proporcionar al menos un rollo para actualizar" },
        { status: 400 }
      );
    }

    // Validate all roll data
    for (const roll of updatedRolls) {
      const validation = validateRollData(roll);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }

      // Ensure all rolls belong to the same OC
      if (roll.OC.trim().toLowerCase() !== oc.toLowerCase()) {
        return NextResponse.json(
          { error: `Rollo ${roll.rollo_id} no pertenece a la OC ${oc}` },
          { status: 400 }
        );
      }
    }

    console.log(`🔄 [EDIT-ROLLS] Editando ${updatedRolls.length} rollos para OC: "${oc}"`);

    const allFiles = await getAllPackingListFiles();

    if (allFiles.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron archivos de packing list" },
        { status: 404 }
      );
    }

    const fileKey = await findFileContainingOC(oc, allFiles);

    if (!fileKey) {
      return NextResponse.json(
        { error: `No se encontró archivo que contenga la OC: ${oc}` },
        { status: 404 }
      );
    }

    console.log(`📄 [EDIT-ROLLS] Archivo encontrado: ${fileKey}`);

    // Read the current file
    const currentRolls = await readPackingListFile(fileKey);

    if (currentRolls.length === 0) {
      return NextResponse.json(
        { error: "No se pudo leer el archivo de rollos" },
        { status: 500 }
      );
    }

    // Create a backup of the original file
    const timestamp = Date.now();
    const fileName = fileKey.split("/").pop()?.replace(".json", "");
    const backupFileName = `${fileName}_backup_edit_${timestamp}.json`;

    const backupCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: `Inventario/Catalogo_Rollos/backups/${backupFileName}`,
      Body: JSON.stringify(currentRolls, null, 2),
      ContentType: "application/json",
      Metadata: {
        "backup-reason": "pre-edit-backup",
        "backup-date": new Date().toISOString(),
        "backed-up-by": session.user.email || "",
      },
    });

    await s3Client.send(backupCommand);
    console.log(`💾 [EDIT-ROLLS] Backup creado: ${backupFileName}`);

    // Update the rolls in the file
    const updatedRollsMap = new Map(
      updatedRolls.map(roll => [roll.rollo_id, roll])
    );

    const finalRolls = currentRolls.map(roll => {
      if (roll.OC && roll.OC.trim().toLowerCase() === oc.toLowerCase()) {
        const updatedRoll = updatedRollsMap.get(roll.rollo_id);
        if (updatedRoll) {
          console.log(`✏️ [EDIT-ROLLS] Actualizando rollo ${roll.rollo_id}`);
          return {
            ...roll,
            ...updatedRoll,
            // Preserve the original fecha_ingreso if not provided in update
            fecha_ingreso: updatedRoll.fecha_ingreso || roll.fecha_ingreso,
          };
        }
      }
      return roll;
    });

    // Verify that all updated rolls were applied
    const appliedRolls = finalRolls.filter(roll => 
      roll.OC && 
      roll.OC.trim().toLowerCase() === oc.toLowerCase() &&
      updatedRollsMap.has(roll.rollo_id)
    );

    if (appliedRolls.length !== updatedRolls.length) {
      console.warn(`⚠️ [EDIT-ROLLS] Solo se aplicaron ${appliedRolls.length} de ${updatedRolls.length} actualizaciones`);
    }

    // Save the updated file
    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
      Body: JSON.stringify(finalRolls, null, 2),
      ContentType: "application/json",
      Metadata: {
        "last-updated": new Date().toISOString(),
        "updated-by": session.user.email || "",
        "operation": "edit-rolls",
        "oc-edited": oc,
        "rolls-updated": updatedRolls.length.toString(),
      },
    });

    await s3Client.send(putCommand);

    // Invalidate related caches
    await Promise.all([
      invalidateCachePattern("cache:api:s3:get-rolls*"),
      invalidateCachePattern("cache:api:packing-list:available-orders*"),
      invalidateCachePattern("cache:api:packing-list:order-rolls*"),
    ]);

    console.log(`✅ [EDIT-ROLLS] Usuario ${session.user.email} editó rollos de OC ${oc}:`, {
      rollsUpdated: updatedRolls.length,
      backupCreated: backupFileName,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Packing list actualizado correctamente`,
      data: {
        oc: oc,
        updatedFile: fileKey,
        backupFile: `Inventario/Catalogo_Rollos/backups/${backupFileName}`,
        rollsUpdated: appliedRolls.length,
        totalRollsInOC: finalRolls.filter(roll => 
          roll.OC && roll.OC.trim().toLowerCase() === oc.toLowerCase()
        ).length,
      },
      cache: { 
        invalidated: true, 
        patterns: ["get-rolls", "available-orders", "order-rolls"] 
      },
    });
  } catch (error) {
    console.error("❌ [EDIT-ROLLS] Error editando packing list:", error);
    return NextResponse.json(
      { 
        error: "Error interno del servidor al editar packing list",
        details: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}