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

function isManualSale(rollNumber: number | string): boolean {
  return String(rollNumber).startsWith("MANUAL-");
}

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

    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: folderPrefix,
    });

    const listResponse = await s3Client.send(listCommand);
    const jsonFiles = (listResponse.Contents || [])
      .filter((item) => item.Key && item.Key.endsWith(".json"))
      .map((item) => item.Key!);

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

        const foundItem = jsonData.find((item: any) => {
          const matchOC = item.OC?.toLowerCase() === oc.toLowerCase();
          const matchTela = item.Tela?.toLowerCase() === tela.toLowerCase();
          const matchColor = item.Color?.toLowerCase() === color.toLowerCase();
          const matchUbicacion =
            item.Ubicacion?.toLowerCase() === ubicacion.toLowerCase();

          return matchOC && matchTela && matchColor && matchUbicacion;
        });

        if (foundItem) {
          return fileKey;
        }
      } catch (fileError) {
        continue;
      }
    }

    const cleanOC = oc.replace(/[^a-zA-Z0-9]/g, "_");
    const relatedFiles = jsonFiles.filter(
      (file) => file.includes(cleanOC) && file.includes("inventario_")
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

        const foundItem = jsonData.find((item: any) => {
          return item.OC?.toLowerCase() === oc.toLowerCase();
        });

        if (foundItem) {
          return fileKey;
        }
      } catch (fileError) {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error("Error buscando archivo inventario:", error);
    return null;
  }
}

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
          return fileKey;
        }
      } catch (fileError) {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error("Error buscando archivo packing list:", error);
    return null;
  }
}

async function updateInventory(
  fileKey: string,
  roll: ReturnRoll
): Promise<boolean> {
  try {
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

        itemFound = true;
        break;
      }
    }

    if (!itemFound) {
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
    return true;
  } catch (error) {
    console.error("Error actualizando inventario:", error);
    return false;
  }
}

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
    return fileKey;
  } catch (error) {
    console.error("Error creando archivo inventario:", error);
    return null;
  }
}

async function updatePackingList(
  fileKey: string,
  roll: ReturnRoll
): Promise<boolean> {
  try {
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });

    const response = await s3Client.send(getCommand);
    const bodyString = await response.Body?.transformToString();
    if (!bodyString) return false;

    const data = JSON.parse(bodyString);
    if (!Array.isArray(data)) return false;

    let entryFound = false;
    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      if (
        entry.fabric_type?.toLowerCase() === roll.fabric_type.toLowerCase() &&
        entry.color?.toLowerCase() === roll.color.toLowerCase() &&
        entry.lot === roll.lot
      ) {
        const existingRollIndex = entry.rolls?.findIndex(
          (r: any) => r.roll_number === roll.roll_number
        );

        if (existingRollIndex >= 0) {
          entry.rolls[existingRollIndex] = {
            roll_number: roll.roll_number,
            almacen: roll.almacen,
            [roll.units.toLowerCase() === "kgs" ? "kg" : "mts"]:
              roll.return_quantity,
          };
        } else {
          if (!entry.rolls) entry.rolls = [];
          entry.rolls.push({
            roll_number: roll.roll_number,
            almacen: roll.almacen,
            [roll.units.toLowerCase() === "kgs" ? "kg" : "mts"]:
              roll.return_quantity,
          });

          entry.rolls.sort((a: any, b: any) => a.roll_number - b.roll_number);
        }

        entryFound = true;
        break;
      }
    }

    if (!entryFound) return false;

    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(putCommand);
    return true;
  } catch (error) {
    console.error("Error actualizando packing list:", error);
    return false;
  }
}

async function markRollsAsReturned(
  returnedRolls: ReturnRoll[]
): Promise<boolean> {
  try {
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: "Inventario/Historial Venta/",
      MaxKeys: 1000,
    });

    const listResponse = await s3Client.send(listCommand);

    if (!listResponse.Contents) {
      return true;
    }

    const salesFiles = listResponse.Contents.filter(
      (item) =>
        item.Key &&
        item.Key.endsWith(".json") &&
        item.LastModified &&
        item.LastModified >= cutoffDate
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
        let fileModified = false;

        if (salesData.rolls && Array.isArray(salesData.rolls)) {
          for (const roll of salesData.rolls) {
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
            }
          }
        }

        if (fileModified) {
          const putCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileKey,
            Body: JSON.stringify(salesData, null, 2),
            ContentType: "application/json",
          });

          await s3Client.send(putCommand);
        }
      } catch (fileError) {
        continue;
      }
    }

    return true;
  } catch (error) {
    console.error("Error marcando rollos como devueltos:", error);
    return false;
  }
}

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
  } catch (error) {
    console.error("Error creando registro devolución:", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas solicitudes de devolución. Inténtalo más tarde.",
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
        { error: "No autorizado para procesar devoluciones" },
        { status: 403 }
      );
    }

    const returnData: ReturnRequest = await request.json();

    const manualSalesCount = returnData.rolls.filter((roll) =>
      isManualSale(roll.roll_number)
    ).length;
    const rollSalesCount = returnData.rolls.length - manualSalesCount;

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

    for (const roll of returnData.rolls) {
      try {
        const isManual = isManualSale(roll.roll_number);
        let inventoryUpdated = false;
        let packingListUpdated = false;

        if (isManual) {
          let inventoryFile = await findInventoryFile(
            roll.oc,
            roll.fabric_type,
            roll.color,
            roll.almacen
          );

          if (inventoryFile) {
            inventoryUpdated = await updateInventory(inventoryFile, roll);
            if (inventoryUpdated) results.inventoryUpdates++;
          } else {
            const newInventoryFile = await createInventoryFile(roll);
            if (newInventoryFile) {
              inventoryUpdated = true;
              results.inventoryUpdates++;
            }
          }

          packingListUpdated = true;
        } else {
          const inventoryFile = await findInventoryFile(
            roll.oc,
            roll.fabric_type,
            roll.color,
            roll.almacen
          );

          const packingListFile = await findPackingListFile(
            roll.oc,
            roll.fabric_type,
            roll.color,
            roll.lot
          );

          if (inventoryFile) {
            inventoryUpdated = await updateInventory(inventoryFile, roll);
            if (inventoryUpdated) results.inventoryUpdates++;
          }

          if (packingListFile) {
            packingListUpdated = await updatePackingList(packingListFile, roll);
            if (packingListUpdated) results.packingListUpdates++;
          }
        }

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
        } else {
          results.failed.push({
            roll_number: roll.roll_number,
            error: isManual
              ? "No se pudo actualizar el inventario para la venta manual"
              : "No se pudo actualizar ni inventario ni packing list",
          });
        }
      } catch (rollError) {
        results.failed.push({
          roll_number: roll.roll_number,
          error:
            rollError instanceof Error
              ? rollError.message
              : "Error desconocido",
        });
      }
    }

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

        await createReturnRecord(
          returnData,
          session.user.email || session.user.name || ""
        );
      } catch (historyError) {
        console.error("Error actualizando historial:", historyError);
      }
    }

    console.log(`[RETURNS] User ${session.user.email} processed return:`, {
      totalRequested: returnData.rolls.length,
      successful: results.successful.length,
      failed: results.failed.length,
      manualSales: manualSalesCount,
      rollSales: rollSalesCount,
    });

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

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error procesando devolución:", error);
    return NextResponse.json(
      {
        error: "Error al procesar la devolución",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

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
