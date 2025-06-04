import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = "telas-luciana";

interface ReturnRoll {
  roll_number: number;
  fabric_type: string;
  color: string;
  lot: number;
  oc: string;
  almacen: string;
  return_quantity: number;
  units: string;
  costo: number;
  return_reason?: string;
}

interface ReturnRequest {
  rolls: ReturnRoll[];
  return_reason: string;
  notes?: string;
}

// Función para buscar archivo de inventario correspondiente
async function findInventoryFile(
  oc: string,
  tela: string,
  color: string,
  ubicacion: string
): Promise<string | null> {
  try {
    const now = new Date();
    const year = now.getFullYear().toString();
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const monthName = monthNames[now.getMonth()];
    const folderPrefix = `Inventario/${year}/${monthName}/`;

    console.log(`🔍 [FIND INVENTORY] Buscando en: ${folderPrefix}`);

    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: folderPrefix,
    });

    const listResponse = await s3Client.send(listCommand);
    const jsonFiles = (listResponse.Contents || [])
      .filter((item) => item.Key && item.Key.endsWith(".json"))
      .map((item) => item.Key!);

    console.log(`📁 [FIND INVENTORY] ${jsonFiles.length} archivos encontrados`);

    // Buscar el archivo que contiene el producto específico
    for (const fileKey of jsonFiles) {
      try {
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
        });

        const fileResponse = await s3Client.send(getCommand);
        if (!fileResponse.Body) continue;

        let fileContent = await fileResponse.Body.transformToString();
        fileContent = fileContent.replace(/: *NaN/g, ": null");

        let jsonData = JSON.parse(fileContent);
        if (!Array.isArray(jsonData)) {
          jsonData = [jsonData];
        }

        // Buscar coincidencia exacta
        const foundItem = jsonData.find((item: any) => {
          const matchOC = item.OC?.toLowerCase() === oc.toLowerCase();
          const matchTela = item.Tela?.toLowerCase() === tela.toLowerCase();
          const matchColor = item.Color?.toLowerCase() === color.toLowerCase();
          const matchUbicacion =
            item.Ubicacion?.toLowerCase() === ubicacion.toLowerCase();

          return matchOC && matchTela && matchColor && matchUbicacion;
        });

        if (foundItem) {
          console.log(`✅ [FIND INVENTORY] Encontrado en: ${fileKey}`);
          return fileKey;
        }
      } catch (fileError) {
        console.error(
          `❌ [FIND INVENTORY] Error leyendo ${fileKey}:`,
          fileError
        );
        continue;
      }
    }

    console.log(
      `❌ [FIND INVENTORY] No encontrado para: ${oc} - ${tela} - ${color} - ${ubicacion}`
    );
    return null;
  } catch (error) {
    console.error("❌ [FIND INVENTORY] Error general:", error);
    return null;
  }
}

// Función para encontrar el archivo de packing list correspondiente
async function findPackingListFile(
  oc: string,
  tela: string,
  color: string,
  lot: number
): Promise<string | null> {
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: "Inventario/Catalogo_Rollos/",
      MaxKeys: 1000,
    });

    const listResponse = await s3Client.send(listCommand);
    if (!listResponse.Contents) return null;

    const packingListFiles = listResponse.Contents.filter((item) => {
      const key = item.Key || "";
      return (
        key.endsWith(".json") &&
        key.includes("packing_lists_con_unidades") &&
        !key.includes("backup") &&
        !key.includes("_row")
      );
    }).map((item) => item.Key!);

    console.log(
      `🔍 [FIND PACKING LIST] Buscando en ${packingListFiles.length} archivos`
    );

    for (const fileKey of packingListFiles) {
      try {
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
        });

        const response = await s3Client.send(getCommand);
        const bodyString = await response.Body?.transformToString();
        if (!bodyString) continue;

        const data = JSON.parse(bodyString);
        if (!Array.isArray(data)) continue;

        const foundEntry = data.find(
          (entry: any) =>
            entry.fabric_type?.toLowerCase() === tela.toLowerCase() &&
            entry.color?.toLowerCase() === color.toLowerCase() &&
            entry.lot === lot
        );

        if (foundEntry) {
          console.log(`✅ [FIND PACKING LIST] Encontrado en: ${fileKey}`);
          return fileKey;
        }
      } catch (fileError) {
        console.error(
          `❌ [FIND PACKING LIST] Error leyendo ${fileKey}:`,
          fileError
        );
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error("❌ [FIND PACKING LIST] Error general:", error);
    return null;
  }
}

// Función para actualizar inventario
async function updateInventory(
  fileKey: string,
  roll: ReturnRoll
): Promise<boolean> {
  try {
    console.log(`📝 [UPDATE INVENTORY] Actualizando: ${fileKey}`);

    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });

    const fileResponse = await s3Client.send(getCommand);
    if (!fileResponse.Body) return false;

    let fileContent = await fileResponse.Body.transformToString();
    fileContent = fileContent.replace(/: *NaN/g, ": null");

    let jsonData = JSON.parse(fileContent);
    if (!Array.isArray(jsonData)) {
      jsonData = [jsonData];
    }

    // Encontrar y actualizar el item
    let itemFound = false;
    for (let i = 0; i < jsonData.length; i++) {
      const item = jsonData[i];
      if (
        item.OC?.toLowerCase() === roll.oc.toLowerCase() &&
        item.Tela?.toLowerCase() === roll.fabric_type.toLowerCase() &&
        item.Color?.toLowerCase() === roll.color.toLowerCase() &&
        item.Ubicacion?.toLowerCase() === roll.almacen.toLowerCase()
      ) {
        // Sumar la cantidad devuelta
        const currentQuantity = parseFloat(item.Cantidad) || 0;
        const newQuantity = currentQuantity + roll.return_quantity;

        jsonData[i].Cantidad = newQuantity;
        jsonData[i].Total = (parseFloat(item.Costo) || 0) * newQuantity;

        console.log(
          `📊 [UPDATE INVENTORY] Cantidad: ${currentQuantity} + ${roll.return_quantity} = ${newQuantity}`
        );
        itemFound = true;
        break;
      }
    }

    if (!itemFound) {
      console.log(`❌ [UPDATE INVENTORY] Item no encontrado en el archivo`);
      return false;
    }

    // Guardar archivo actualizado
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Body: JSON.stringify(jsonData, null, 2),
      ContentType: "application/json",
      Metadata: {
        "last-updated": new Date().toISOString(),
        operation: "return-roll",
        "roll-number": roll.roll_number.toString(),
      },
    });

    await s3Client.send(putCommand);
    console.log(`✅ [UPDATE INVENTORY] Inventario actualizado exitosamente`);
    return true;
  } catch (error) {
    console.error(`❌ [UPDATE INVENTORY] Error:`, error);
    return false;
  }
}

// Función para actualizar packing list
async function updatePackingList(
  fileKey: string,
  roll: ReturnRoll
): Promise<boolean> {
  try {
    console.log(`📝 [UPDATE PACKING LIST] Actualizando: ${fileKey}`);

    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });

    const response = await s3Client.send(getCommand);
    const bodyString = await response.Body?.transformToString();
    if (!bodyString) return false;

    const data = JSON.parse(bodyString);
    if (!Array.isArray(data)) return false;

    // Encontrar la entrada correspondiente
    let entryFound = false;
    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      if (
        entry.fabric_type?.toLowerCase() === roll.fabric_type.toLowerCase() &&
        entry.color?.toLowerCase() === roll.color.toLowerCase() &&
        entry.lot === roll.lot
      ) {
        // Verificar si el rollo ya existe
        const existingRollIndex = entry.rolls?.findIndex(
          (r: any) => r.roll_number === roll.roll_number
        );

        if (existingRollIndex >= 0) {
          // El rollo ya existe, actualizarlo
          entry.rolls[existingRollIndex] = {
            roll_number: roll.roll_number,
            almacen: roll.almacen,
            [roll.units.toLowerCase() === "kgs" ? "kg" : "mts"]:
              roll.return_quantity,
          };
          console.log(
            `🔄 [UPDATE PACKING LIST] Rollo ${roll.roll_number} actualizado`
          );
        } else {
          // Agregar el rollo devuelto
          if (!entry.rolls) entry.rolls = [];
          entry.rolls.push({
            roll_number: roll.roll_number,
            almacen: roll.almacen,
            [roll.units.toLowerCase() === "kgs" ? "kg" : "mts"]:
              roll.return_quantity,
          });

          // Ordenar rollos por número
          entry.rolls.sort((a: any, b: any) => a.roll_number - b.roll_number);
          console.log(
            `➕ [UPDATE PACKING LIST] Rollo ${roll.roll_number} agregado`
          );
        }

        entryFound = true;
        break;
      }
    }

    if (!entryFound) {
      console.log(`❌ [UPDATE PACKING LIST] Entrada no encontrada`);
      return false;
    }

    // Guardar archivo actualizado
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(putCommand);
    console.log(
      `✅ [UPDATE PACKING LIST] Packing list actualizado exitosamente`
    );
    return true;
  } catch (error) {
    console.error(`❌ [UPDATE PACKING LIST] Error:`, error);
    return false;
  }
}

// Función para crear registro de devolución
async function createReturnRecord(
  returnData: ReturnRequest,
  processedBy: string
): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const returnId = `return_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const record = {
      returnId,
      timestamp,
      processedBy,
      returnReason: returnData.return_reason,
      notes: returnData.notes || "",
      rolls: returnData.rolls,
      totalRolls: returnData.rolls.length,
      totalQuantity: returnData.rolls.reduce(
        (sum, roll) => sum + roll.return_quantity,
        0
      ),
      status: "completed",
    };

    const recordKey = `Inventario/Devoluciones/${new Date().getFullYear()}/${returnId}.json`;

    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: recordKey,
      Body: JSON.stringify(record, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(putCommand);
    console.log(`📋 [RETURN RECORD] Registro creado: ${recordKey}`);
  } catch (error) {
    console.error(`❌ [RETURN RECORD] Error:`, error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas solicitudes de devolución. Inténtalo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Verificar autenticación
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verificar permisos de admin
    const isAdmin =
      session.user.role === "admin" || session.user.role === "major_admin";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "No autorizado para procesar devoluciones" },
        { status: 403 }
      );
    }

    const returnData: ReturnRequest = await request.json();

    console.log("🔄 [PROCESS RETURNS] Iniciando devolución:", {
      rollCount: returnData.rolls.length,
      reason: returnData.return_reason,
    });

    // Validar datos
    if (
      !returnData.rolls ||
      !Array.isArray(returnData.rolls) ||
      returnData.rolls.length === 0
    ) {
      return NextResponse.json(
        { error: "Se requiere al menos un rollo para devolver" },
        { status: 400 }
      );
    }

    if (!returnData.return_reason) {
      return NextResponse.json(
        { error: "Se requiere especificar la razón de la devolución" },
        { status: 400 }
      );
    }

    const results = {
      successful: [] as any[],
      failed: [] as any[],
      inventoryUpdates: 0,
      packingListUpdates: 0,
    };

    // Procesar cada rollo
    for (const roll of returnData.rolls) {
      try {
        console.log(
          `\n🔄 [PROCESS RETURNS] Procesando rollo ${roll.roll_number}`
        );

        // 1. Encontrar archivo de inventario
        const inventoryFile = await findInventoryFile(
          roll.oc,
          roll.fabric_type,
          roll.color,
          roll.almacen
        );

        if (!inventoryFile) {
          results.failed.push({
            roll_number: roll.roll_number,
            error: "Archivo de inventario no encontrado",
          });
          continue;
        }

        // 2. Encontrar archivo de packing list
        const packingListFile = await findPackingListFile(
          roll.oc,
          roll.fabric_type,
          roll.color,
          roll.lot
        );

        if (!packingListFile) {
          results.failed.push({
            roll_number: roll.roll_number,
            error: "Archivo de packing list no encontrado",
          });
          continue;
        }

        // 3. Actualizar inventario
        const inventoryUpdated = await updateInventory(inventoryFile, roll);
        if (inventoryUpdated) {
          results.inventoryUpdates++;
        }

        // 4. Actualizar packing list
        const packingListUpdated = await updatePackingList(
          packingListFile,
          roll
        );
        if (packingListUpdated) {
          results.packingListUpdates++;
        }

        if (inventoryUpdated && packingListUpdated) {
          results.successful.push({
            roll_number: roll.roll_number,
            fabric_type: roll.fabric_type,
            color: roll.color,
            return_quantity: roll.return_quantity,
            units: roll.units,
          });
          console.log(
            `✅ [PROCESS RETURNS] Rollo ${roll.roll_number} procesado exitosamente`
          );
        } else {
          results.failed.push({
            roll_number: roll.roll_number,
            error: `Fallo en actualización - Inventario: ${inventoryUpdated}, Packing List: ${packingListUpdated}`,
          });
        }
      } catch (rollError) {
        console.error(
          `❌ [PROCESS RETURNS] Error procesando rollo ${roll.roll_number}:`,
          rollError
        );
        results.failed.push({
          roll_number: roll.roll_number,
          error:
            rollError instanceof Error
              ? rollError.message
              : "Error desconocido",
        });
      }
    }

    // 5. Crear registro de devolución
    if (results.successful.length > 0) {
      await createReturnRecord(
        returnData,
        session.user.email || session.user.name || ""
      );
    }

    const response = {
      success: results.successful.length > 0,
      message: `Devolución procesada: ${results.successful.length} exitosos, ${results.failed.length} fallidos`,
      results,
      summary: {
        totalRequested: returnData.rolls.length,
        successful: results.successful.length,
        failed: results.failed.length,
        inventoryUpdates: results.inventoryUpdates,
        packingListUpdates: results.packingListUpdates,
      },
    };

    console.log(
      "🎉 [PROCESS RETURNS] Devolución completada:",
      response.summary
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ [PROCESS RETURNS] Error general:", error);
    return NextResponse.json(
      {
        error: "Error al procesar la devolución",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

// Método OPTIONS para CORS
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}
