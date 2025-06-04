// /api/returns/process-returns/route.ts (ACTUALIZADO)
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
  roll_number: number | string;
  fabric_type: string;
  color: string;
  lot: number;
  oc: string;
  almacen: string;
  return_quantity: number;
  units: string;
  costo: number;
  return_reason?: string;
  sale_id?: string;
  original_sold_date?: string;
  sale_type?: string;
}

interface ReturnRequest {
  rolls: ReturnRoll[];
  return_reason: string;
  notes?: string;
}

// Función para detectar si es una venta manual
function isManualSale(rollNumber: number | string): boolean {
  return String(rollNumber).startsWith("MANUAL-");
}

// Función para buscar archivo de inventario correspondiente
// Función para buscar archivo de inventario correspondiente (MEJORADA)
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

    // PRIMERA BÚSQUEDA: Coincidencia exacta
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
          console.log(
            `✅ [FIND INVENTORY] Coincidencia exacta encontrada en: ${fileKey}`
          );
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

    // SEGUNDA BÚSQUEDA: Buscar archivo de la misma OC (para consolidar)
    const cleanOC = oc.replace(/[^a-zA-Z0-9]/g, "_");
    const relatedFiles = jsonFiles.filter(
      (file) => file.includes(cleanOC) && file.includes("inventario_")
    );

    console.log(
      `🔍 [FIND INVENTORY] Buscando archivos relacionados a OC ${oc}: encontrados ${relatedFiles.length}`
    );

    for (const fileKey of relatedFiles) {
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

        // Buscar cualquier item de la misma OC
        const foundItem = jsonData.find((item: any) => {
          return item.OC?.toLowerCase() === oc.toLowerCase();
        });

        if (foundItem) {
          console.log(
            `✅ [FIND INVENTORY] Archivo relacionado encontrado para consolidar: ${fileKey}`
          );
          return fileKey;
        }
      } catch (fileError) {
        console.error(
          `❌ [FIND INVENTORY] Error leyendo archivo relacionado ${fileKey}:`,
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

// Función para actualizar inventario agregando cantidad devuelta
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

    let itemFound = false;
    for (let i = 0; i < jsonData.length; i++) {
      const item = jsonData[i];
      const matchOC =
        item.OC?.toLowerCase().trim() === roll.oc.toLowerCase().trim();
      const matchTela =
        item.Tela?.toLowerCase().trim() ===
        roll.fabric_type.toLowerCase().trim();
      const matchColor =
        item.Color?.toLowerCase().trim() === roll.color.toLowerCase().trim();
      const matchUbicacion =
        item.Ubicacion?.toLowerCase().trim() ===
          roll.almacen.toLowerCase().trim() ||
        item.almacen?.toLowerCase().trim() ===
          roll.almacen.toLowerCase().trim();

      if (matchOC && matchTela && matchColor && matchUbicacion) {
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
      console.log(`🆕 [UPDATE INVENTORY] Creando nuevo item en inventario`);

      const newItem = {
        OC: roll.oc,
        Tela: roll.fabric_type,
        Color: roll.color,
        Costo: roll.costo,
        Cantidad: roll.return_quantity,
        Unidades: roll.units,
        Total: roll.costo * roll.return_quantity,
        Ubicacion: roll.almacen,
        Importacion: "DA",
        FacturaDragonAzteca: "",
        status: "completed",
        lastModified: new Date().toISOString(),
      };

      jsonData.push(newItem);
      console.log(`✅ [UPDATE INVENTORY] Nuevo item creado`);
    }

    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Body: JSON.stringify(jsonData, null, 2),
      ContentType: "application/json",
      Metadata: {
        "last-updated": new Date().toISOString(),
        operation: "return-roll",
        "roll-number": String(roll.roll_number),
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

// Función para crear un archivo de inventario si no existe
async function createInventoryFile(roll: ReturnRoll): Promise<string | null> {
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

    // Crear nombre de archivo basado en la OC
    const fileName = `inventario_${roll.oc.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_${Date.now()}.json`;
    const fileKey = `Inventario/${year}/${monthName}/${fileName}`;

    const newItem = {
      OC: roll.oc,
      Tela: roll.fabric_type,
      Color: roll.color,
      Costo: roll.costo,
      Cantidad: roll.return_quantity,
      Unidades: roll.units,
      Total: roll.costo * roll.return_quantity,
      Ubicacion: roll.almacen,
      Importacion: "DA",
      FacturaDragonAzteca: "",
      status: "completed",
      lastModified: new Date().toISOString(),
      created_from: "manual_sale_return",
    };

    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Body: JSON.stringify([newItem], null, 2),
      ContentType: "application/json",
      Metadata: {
        created: new Date().toISOString(),
        operation: "return-manual-sale",
        "roll-number": String(roll.roll_number),
      },
    });

    await s3Client.send(putCommand);
    console.log(
      `✅ [CREATE INVENTORY] Nuevo archivo de inventario creado: ${fileKey}`
    );
    return fileKey;
  } catch (error) {
    console.error(`❌ [CREATE INVENTORY] Error:`, error);
    return null;
  }
}

// Función para actualizar packing list agregando rollo devuelto
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
          // El rollo ya existe, actualizarlo (restaurar cantidad completa)
          entry.rolls[existingRollIndex] = {
            roll_number: roll.roll_number,
            almacen: roll.almacen,
            [roll.units.toLowerCase() === "kgs" ? "kg" : "mts"]:
              roll.return_quantity,
          };
          console.log(
            `🔄 [UPDATE PACKING LIST] Rollo ${roll.roll_number} restaurado`
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
            `➕ [UPDATE PACKING LIST] Rollo ${roll.roll_number} agregado de vuelta`
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

// Función para marcar rollos como devueltos en el historial de ventas
async function markRollsAsReturned(
  returnedRolls: ReturnRoll[]
): Promise<boolean> {
  try {
    console.log(
      `🔄 [MARK RETURNED] Marcando ${returnedRolls.length} rollos como devueltos`
    );

    // Obtener archivos de historial de ventas recientes
    const now = new Date();
    const monthsToSearch: string[] = [];
    for (let i = 0; i <= 6; i++) {
      // Buscar en los últimos 6 meses
      const searchDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = searchDate.getFullYear();
      const month = (searchDate.getMonth() + 1).toString().padStart(2, "0");
      monthsToSearch.push(`Inventario/Historial Venta/${year}/${month}/`);
    }

    for (const prefix of monthsToSearch) {
      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: prefix,
          MaxKeys: 100,
        });

        const listResponse = await s3Client.send(listCommand);
        if (!listResponse.Contents) continue;

        const salesFiles = listResponse.Contents.filter(
          (item) => item.Key && item.Key.endsWith(".json")
        ).map((item) => item.Key!);

        for (const fileKey of salesFiles) {
          try {
            const getCommand = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: fileKey,
            });

            const response = await s3Client.send(getCommand);
            const bodyString = await response.Body?.transformToString();
            if (!bodyString) continue;

            const salesData = JSON.parse(bodyString);
            const salesRecords = Array.isArray(salesData)
              ? salesData
              : [salesData];

            let fileModified = false;

            // Buscar y marcar rollos como devueltos
            for (const record of salesRecords) {
              if (record.rolls && Array.isArray(record.rolls)) {
                for (const roll of record.rolls) {
                  const returnedRoll = returnedRolls.find(
                    (r) =>
                      String(r.roll_number) === String(roll.roll_number) &&
                      r.oc === roll.oc &&
                      r.fabric_type === roll.fabric_type &&
                      r.color === roll.color
                  );

                  if (returnedRoll) {
                    roll.available_for_return = false;
                    roll.returned_date = new Date().toISOString();
                    roll.return_reason = returnedRoll.return_reason || "";
                    fileModified = true;
                    console.log(
                      `🔄 [MARK RETURNED] Rollo ${roll.roll_number} marcado como devuelto`
                    );
                  }
                }
              }
            }

            // Guardar archivo si fue modificado
            if (fileModified) {
              const putCommand = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileKey,
                Body: JSON.stringify(salesRecords, null, 2),
                ContentType: "application/json",
              });

              await s3Client.send(putCommand);
              console.log(`✅ [MARK RETURNED] Archivo actualizado: ${fileKey}`);
            }
          } catch (fileError) {
            console.error(`Error procesando archivo ${fileKey}:`, fileError);
            continue;
          }
        }
      } catch (prefixError) {
        console.error(`Error en prefix ${prefix}:`, prefixError);
        continue;
      }
    }

    return true;
  } catch (error) {
    console.error(`❌ [MARK RETURNED] Error:`, error);
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
      manualSales: returnData.rolls.filter((roll) =>
        isManualSale(roll.roll_number)
      ).length,
      rollSales: returnData.rolls.filter(
        (roll) => !isManualSale(roll.roll_number)
      ).length,
      status: "completed",
    };

    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");

    const recordKey = `Inventario/Devoluciones/${year}/${month}/${returnId}.json`;

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
    console.log("🔄 [PROCESS RETURNS] === PROCESANDO DEVOLUCIONES REALES ===");

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

    const manualSalesCount = returnData.rolls.filter((roll) =>
      isManualSale(roll.roll_number)
    ).length;
    const rollSalesCount = returnData.rolls.length - manualSalesCount;

    console.log("🔄 [PROCESS RETURNS] Iniciando devolución:", {
      rollCount: returnData.rolls.length,
      manualSales: manualSalesCount,
      rollSales: rollSalesCount,
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
      historyUpdates: 0,
    };

    // Procesar cada rollo
    for (const roll of returnData.rolls) {
      try {
        const isManual = isManualSale(roll.roll_number);
        console.log(
          `\n🔄 [PROCESS RETURNS] Procesando ${
            isManual ? "venta manual" : "rollo"
          } ${roll.roll_number}`
        );

        let inventoryUpdated = false;
        let packingListUpdated = false;

        if (isManual) {
          // PROCESO PARA VENTAS MANUALES - Solo inventario
          console.log(
            `🔧 [PROCESS RETURNS] Procesando venta manual: ${roll.roll_number}`
          );

          // 1. Buscar archivo de inventario
          let inventoryFile = await findInventoryFile(
            roll.oc,
            roll.fabric_type,
            roll.color,
            roll.almacen
          );

          if (inventoryFile) {
            // 2a. Si existe archivo de inventario, actualizarlo
            inventoryUpdated = await updateInventory(inventoryFile, roll);
            if (inventoryUpdated) results.inventoryUpdates++;
          } else {
            // 2b. Si no existe archivo de inventario, crear uno nuevo (ya incluye el item)
            console.log(
              `🆕 [PROCESS RETURNS] Creando nuevo archivo de inventario para venta manual`
            );
            const newInventoryFile = await createInventoryFile(roll);

            if (newInventoryFile) {
              inventoryUpdated = true; // Archivo creado exitosamente
              results.inventoryUpdates++;
              console.log(
                `✅ [PROCESS RETURNS] Archivo de inventario creado exitosamente: ${newInventoryFile}`
              );
            } else {
              console.log(
                `❌ [PROCESS RETURNS] Error creando archivo de inventario para venta manual`
              );
              inventoryUpdated = false;
            }
          }

          // Para ventas manuales, no intentamos actualizar packing list
          packingListUpdated = true; // Consideramos exitoso si el inventario se actualizó
        } else {
          // PROCESO NORMAL PARA ROLLOS REALES - Inventario + Packing List
          console.log(
            `📦 [PROCESS RETURNS] Procesando rollo real: ${roll.roll_number}`
          );

          // 1. Encontrar archivo de inventario
          const inventoryFile = await findInventoryFile(
            roll.oc,
            roll.fabric_type,
            roll.color,
            roll.almacen
          );

          // 2. Encontrar archivo de packing list
          const packingListFile = await findPackingListFile(
            roll.oc,
            roll.fabric_type,
            roll.color,
            roll.lot
          );

          // 3. Actualizar inventario (crear si no existe)
          if (inventoryFile) {
            inventoryUpdated = await updateInventory(inventoryFile, roll);
            if (inventoryUpdated) results.inventoryUpdates++;
          } else {
            console.log(
              `⚠️ [PROCESS RETURNS] Archivo de inventario no encontrado para rollo ${roll.roll_number}`
            );
          }

          // 4. Actualizar packing list (obligatorio para trazabilidad de rollos)
          if (packingListFile) {
            packingListUpdated = await updatePackingList(packingListFile, roll);
            if (packingListUpdated) results.packingListUpdates++;
          } else {
            console.log(
              `⚠️ [PROCESS RETURNS] Archivo de packing list no encontrado para rollo ${roll.roll_number}`
            );
          }
        }

        // 5. Consideramos exitoso si al menos se actualizó el inventario
        if (inventoryUpdated || packingListUpdated) {
          results.successful.push({
            roll_number: roll.roll_number,
            fabric_type: roll.fabric_type,
            color: roll.color,
            return_quantity: roll.return_quantity,
            units: roll.units,
            inventory_updated: inventoryUpdated,
            packing_list_updated: packingListUpdated,
            sale_type: isManual ? "manual" : "roll",
          });
          console.log(
            `✅ [PROCESS RETURNS] ${isManual ? "Venta manual" : "Rollo"} ${
              roll.roll_number
            } procesado exitosamente`
          );
        } else {
          results.failed.push({
            roll_number: roll.roll_number,
            error: isManual
              ? "No se pudo actualizar el inventario para la venta manual"
              : "No se pudo actualizar ni inventario ni packing list",
          });
        }
      } catch (rollError) {
        console.error(
          `❌ [PROCESS RETURNS] Error procesando ${roll.roll_number}:`,
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

    // 6. Marcar rollos como devueltos en el historial de ventas
    if (results.successful.length > 0) {
      try {
        const returnedRollsInfo = results.successful.map((s) => {
          const originalRoll = returnData.rolls.find(
            (r) => String(r.roll_number) === String(s.roll_number)
          );
          return {
            ...originalRoll!,
            return_reason: returnData.return_reason,
          };
        });

        await markRollsAsReturned(returnedRollsInfo);
        results.historyUpdates = 1;

        // 7. Crear registro de devolución
        await createReturnRecord(
          returnData,
          session.user.email || session.user.name || ""
        );
      } catch (historyError) {
        console.error(
          "❌ [PROCESS RETURNS] Error actualizando historial:",
          historyError
        );
      }
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
        historyUpdates: results.historyUpdates,
        manualSales: manualSalesCount,
        rollSales: rollSalesCount,
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
