import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  _Object,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { invalidateAndWarmInventory } from "@/lib/cache-warming";
import { invalidateCachePattern } from "@/lib/cache-middleware";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

interface InventoryItem {
  OC: string;
  Tela: string;
  Color: string;
  Ubicacion?: string;
  Cantidad: number;
  Costo: number;
  Total: number;
  Unidades: string;
  CDMX?: number;
  MID?: number;
  CONPARTEX?: number;
  Importacion?: string;
  FacturaDragonAzteca?: string;
  status?: string;
  lastModified?: string;
  [key: string]: unknown;
}

interface RawInventoryItem {
  OC?: unknown;
  Tela?: unknown;
  Color?: unknown;
  Ubicacion?: unknown;
  Cantidad?: unknown;
  Costo?: unknown;
  Total?: unknown;
  Unidades?: unknown;
  CDMX?: unknown;
  MID?: unknown;
  CONPARTEX?: unknown;
  Importacion?: unknown;
  FacturaDragonAzteca?: unknown;
  status?: unknown;
  lastModified?: unknown;
  [key: string]: unknown;
}

interface TransferPayload {
  transferType: "transfer";
  oldItem: RawInventoryItem;
  quantityToTransfer: number;
  sourceLocation: "CDMX" | "MID" | "CONPARTEX";
  destinationLocation: "CDMX" | "MID" | "CONPARTEX";
}

interface UpdateRequest {
  oldItem: RawInventoryItem;
  newItem?: RawInventoryItem;
  isEdit?: boolean;
  quantityChange?: number;
  location?: "CDMX" | "MID" | "CONPARTEX";
}

interface FileSearchResult {
  found: boolean;
  itemIndex?: number;
  normalizedData?: InventoryItem[];
  originalData?: unknown[];
}

const isLambdaSafeItem = (item: InventoryItem): boolean => {
  return !!(
    item.OC &&
    String(item.OC).trim() !== "" &&
    item.Tela &&
    String(item.Tela).trim() !== "" &&
    item.Color &&
    String(item.Color).trim() !== "" &&
    typeof item.Cantidad === "number" &&
    !isNaN(item.Cantidad) &&
    item.Cantidad >= 0 &&
    typeof item.Costo === "number" &&
    !isNaN(item.Costo) &&
    item.Costo >= 0 &&
    typeof item.Total === "number" &&
    !isNaN(item.Total) &&
    item.Total >= 0
  );
};

const safeNormalize = (value: unknown, defaultValue: string = ""): string => {
  if (
    value === null ||
    value === undefined ||
    value === "undefined" ||
    value === "null" ||
    Number.isNaN(value)
  ) {
    return defaultValue;
  }

  const str = String(value).trim();
  if (str === "" || str === "undefined" || str === "null" || str === "NaN") {
    return defaultValue;
  }

  if (str.length >= 2 && str.startsWith('"') && str.endsWith('"')) {
    return str.slice(1, -1);
  }

  return str;
};

const safeNumber = (value: unknown, defaultValue: number = 0): number => {
  if (
    value === null ||
    value === undefined ||
    value === "undefined" ||
    value === "null" ||
    Number.isNaN(value)
  ) {
    return defaultValue;
  }

  const num = parseFloat(String(value));
  return isNaN(num) ? defaultValue : num;
};

const normalizeItem = (rawItem: RawInventoryItem): InventoryItem | null => {
  try {
    if (!rawItem || typeof rawItem !== "object") {
      return null;
    }

    const item: InventoryItem = {
      OC: safeNormalize(rawItem.OC, "SIN-OC"),
      Tela: safeNormalize(rawItem.Tela, "SIN-TELA"),
      Color: safeNormalize(rawItem.Color, "SIN-COLOR"),
      Cantidad: safeNumber(rawItem.Cantidad, 0),
      Costo: safeNumber(rawItem.Costo, 0),
      Total: safeNumber(rawItem.Total, 0),
      Unidades: safeNormalize(rawItem.Unidades, "KGS"),
    };

    if (rawItem.CDMX !== undefined) {
      if (
        rawItem.CDMX === null ||
        rawItem.CDMX === "NaN" ||
        Number.isNaN(rawItem.CDMX)
      ) {
        item.CDMX = undefined;
      } else {
        item.CDMX = safeNumber(rawItem.CDMX, 0);
      }
    }
    if (rawItem.MID !== undefined) {
      if (
        rawItem.MID === null ||
        rawItem.MID === "NaN" ||
        Number.isNaN(rawItem.MID)
      ) {
        item.MID = undefined;
      } else {
        item.MID = safeNumber(rawItem.MID, 0);
      }
    }
    if (rawItem.CONPARTEX !== undefined) {
      if (
        rawItem.CONPARTEX === null ||
        rawItem.CONPARTEX === "NaN" ||
        Number.isNaN(rawItem.CONPARTEX)
      ) {
        item.CONPARTEX = undefined;
      } else {
        item.CONPARTEX = safeNumber(rawItem.CONPARTEX, 0);
      }
    }

    Object.keys(rawItem).forEach((key) => {
      if (
        ![
          "OC",
          "Tela",
          "Color",
          "Cantidad",
          "Costo",
          "Total",
          "Unidades",
          "CDMX",
          "MID",
          "CONPARTEX",
        ].includes(key)
      ) {
        item[key] = rawItem[key];
      }
    });

    if (!item.Total || item.Total === 0) {
      item.Total = item.Costo * item.Cantidad;
    }

    if (!isLambdaSafeItem(item)) {
      return null;
    }

    return item;
  } catch (error) {
    console.error("Error normalizing item:", error);
    return null;
  }
};

const findItemInFile = async (
  fileKey: string,
  targetItem: RawInventoryItem
): Promise<FileSearchResult> => {
  try {
    const getCommand = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
    });

    const fileResponse = await s3Client.send(getCommand);
    if (!fileResponse.Body) {
      return { found: false };
    }

    let content = await fileResponse.Body.transformToString();
    if (!content.trim()) {
      return { found: false };
    }

    content = content
      .replace(/:\s*NaN/g, ": null")
      .replace(/:\s*undefined/g, ": null")
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]");

    let rawData: unknown;
    try {
      rawData = JSON.parse(content);
    } catch (parseError) {
      console.error(`JSON inválido en ${fileKey}:`, parseError);
      return { found: false };
    }

    let dataArray: unknown[];
    if (!Array.isArray(rawData)) {
      dataArray = [rawData];
    } else {
      dataArray = rawData;
    }

    const normalizedData = dataArray
      .map((item) => normalizeItem(item as RawInventoryItem))
      .filter((item) => item !== null) as InventoryItem[];

    const targetOC = safeNormalize(targetItem.OC).trim();
    const targetTela = safeNormalize(targetItem.Tela).trim();
    const targetColor = safeNormalize(targetItem.Color).trim();

    for (let i = 0; i < normalizedData.length; i++) {
      const item = normalizedData[i];

      const matchOC = item.OC === targetOC;
      const matchTela = item.Tela === targetTela;
      const matchColor = item.Color === targetColor;

      if (matchOC && matchTela && matchColor) {
        return {
          found: true,
          itemIndex: i,
          normalizedData,
          originalData: dataArray,
        };
      }
    }

    return { found: false };
  } catch (error) {
    console.error(`Error buscando en ${fileKey}:`, error);
    return { found: false };
  }
};

const reorderItemFields = (item: InventoryItem): InventoryItem => {
  const orderedItem: Record<string, unknown> = {};

  if (item.OC !== undefined) orderedItem.OC = item.OC;
  if (item.Tela !== undefined) orderedItem.Tela = item.Tela;
  if (item.Color !== undefined) orderedItem.Color = item.Color;
  if (item.Costo !== undefined) orderedItem.Costo = item.Costo;
  if (item.Cantidad !== undefined) orderedItem.Cantidad = item.Cantidad;
  if (item.Unidades !== undefined) orderedItem.Unidades = item.Unidades;
  if (item.CDMX !== undefined) orderedItem.CDMX = item.CDMX;
  if (item.MID !== undefined) orderedItem.MID = item.MID;
  if (item.CONPARTEX !== undefined) orderedItem.CONPARTEX = item.CONPARTEX;
  if (item.Total !== undefined) orderedItem.Total = item.Total;

  Object.keys(item).forEach((key) => {
    if (
      !orderedItem.hasOwnProperty(key) &&
      !["lastModified", "status", "Ubicacion"].includes(key)
    ) {
      orderedItem[key] = item[key];
    }
  });

  return orderedItem as InventoryItem;
};

const saveFileSafely = async (
  fileKey: string,
  items: InventoryItem[]
): Promise<boolean> => {
  try {
    const safeItems = items.filter((item) => isLambdaSafeItem(item));

    if (safeItems.length === 0) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: "telas-luciana",
            Key: fileKey,
          })
        );
      } catch (deleteError) {
        console.error("Error eliminando archivo:", deleteError);
      }

      return true;
    }

    const itemsForSave = safeItems.map((item) => {
      let saveItem = { ...item };

      if (saveItem.CDMX === undefined) {
        saveItem.CDMX = NaN;
      }
      if (saveItem.MID === undefined) {
        saveItem.MID = NaN;
      }
      if (saveItem.CONPARTEX === undefined) {
        saveItem.CONPARTEX = NaN;
      }

      delete saveItem.lastModified;
      delete saveItem.status;
      delete saveItem.Ubicacion;

      saveItem = reorderItemFields(saveItem);

      return saveItem;
    });

    let content: string;
    if (itemsForSave.length === 1) {
      content = JSON.stringify(itemsForSave[0], null, 2);
    } else {
      content = JSON.stringify(itemsForSave, null, 2);
    }

    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
      Body: content,
      ContentType: "application/json",
    });

    await s3Client.send(putCommand);

    return true;
  } catch (error) {
    console.error(`Error guardando ${fileKey}:`, error);
    return false;
  }
};

const invalidateInventoryRelatedCaches = async (): Promise<void> => {
  try {
    console.log(
      "🔥 [UPDATE] Invalidando todos los caches relacionados con inventario..."
    );

    await invalidateAndWarmInventory();

    await invalidateCachePattern("cache:api:s3:sold-rolls:*");
    console.log("🗑️ Cache de sold-rolls invalidado");

    await invalidateCachePattern("cache:api:s3:rolls-data:*");
    console.log("🗑️ Cache de rolls-data invalidado");

    console.log(
      "✅ Invalidación completa de caches relacionados con inventario finalizada"
    );
  } catch (error) {
    console.error("❌ Error invalidando caches relacionados:", error);
  }
};

const processTransferWithConsolidation = async (
  jsonFiles: string[],
  transferPayload: TransferPayload
): Promise<{
  success: boolean;
  message: string;
  operation: string;
  consolidatedItemFile?: string;
  sourceItemFile?: string;
}> => {
  const { oldItem, quantityToTransfer, sourceLocation, destinationLocation } =
    transferPayload;

  let sourceItemFound = false;
  let sourceFileKey = "";

  for (const fileKey of jsonFiles) {
    const result = await findItemInFile(fileKey, oldItem);
    if (
      result.found &&
      result.normalizedData &&
      result.itemIndex !== undefined
    ) {
      sourceItemFound = true;
      sourceFileKey = fileKey;

      const modifiedData = [...result.normalizedData];
      const currentItem = modifiedData[result.itemIndex];

      const currentLocationQuantity =
        sourceLocation === "CDMX"
          ? currentItem.CDMX || 0
          : sourceLocation === "MID"
          ? currentItem.MID || 0
          : currentItem.CONPARTEX || 0;

      if (currentLocationQuantity < quantityToTransfer) {
        throw new Error(
          `No hay suficiente inventario en ${sourceLocation}. Disponible: ${currentLocationQuantity}, Solicitado: ${quantityToTransfer}`
        );
      }

      if (sourceLocation === "CDMX" && destinationLocation === "MID") {
        currentItem.CDMX = currentLocationQuantity - quantityToTransfer;
        const currentMID = currentItem.MID || 0;
        currentItem.MID = currentMID + quantityToTransfer;
      } else if (sourceLocation === "MID" && destinationLocation === "CDMX") {
        currentItem.MID = currentLocationQuantity - quantityToTransfer;
        const currentCDMX = currentItem.CDMX || 0;
        currentItem.CDMX = currentCDMX + quantityToTransfer;
      } else if (sourceLocation === "CDMX" && destinationLocation === "CONPARTEX") {
        currentItem.CDMX = currentLocationQuantity - quantityToTransfer;
        const currentCONPARTEX = currentItem.CONPARTEX || 0;
        currentItem.CONPARTEX = currentCONPARTEX + quantityToTransfer;
      } else if (sourceLocation === "CONPARTEX" && destinationLocation === "CDMX") {
        currentItem.CONPARTEX = currentLocationQuantity - quantityToTransfer;
        const currentCDMX = currentItem.CDMX || 0;
        currentItem.CDMX = currentCDMX + quantityToTransfer;
      } else if (sourceLocation === "MID" && destinationLocation === "CONPARTEX") {
        currentItem.MID = currentLocationQuantity - quantityToTransfer;
        const currentCONPARTEX = currentItem.CONPARTEX || 0;
        currentItem.CONPARTEX = currentCONPARTEX + quantityToTransfer;
      } else if (sourceLocation === "CONPARTEX" && destinationLocation === "MID") {
        currentItem.CONPARTEX = currentLocationQuantity - quantityToTransfer;
        const currentMID = currentItem.MID || 0;
        currentItem.MID = currentMID + quantityToTransfer;
      }

      modifiedData[result.itemIndex] = currentItem;
      await saveFileSafely(fileKey, modifiedData);
      break;
    }
  }

  if (!sourceItemFound) {
    throw new Error("Item de origen no encontrado para traslado");
  }

  return {
    success: true,
    message: `Traslado completado: ${quantityToTransfer} ${safeNormalize(
      oldItem.Unidades
    )} transferidos de ${sourceLocation} a ${destinationLocation}`,
    operation: "transfer",
    consolidatedItemFile: sourceFileKey,
    sourceItemFile: sourceFileKey,
  };
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas solicitudes de actualización. Inténtalo más tarde.",
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
        { error: "No autorizado para actualizar inventario" },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (body.transferType) {
      const transferPayload = body as TransferPayload;

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
        Bucket: "telas-luciana",
        Prefix: folderPrefix,
      });

      const listResponse = await s3Client.send(listCommand);
      const jsonFiles = (listResponse.Contents || [])
        .filter((item: _Object) => item.Key && item.Key.endsWith(".json"))
        .filter((item: _Object) => !item.Key!.includes("_backup_"))
        .map((item: _Object) => item.Key!)
        .sort();

      const result = await processTransferWithConsolidation(
        jsonFiles,
        transferPayload
      );

      await invalidateInventoryRelatedCaches();

      const duration = Date.now() - startTime;

      console.log(`[UPDATE] User ${session.user.email} processed transfer:`, {
        operation: result.operation,
        success: result.success,
      });

      return NextResponse.json({
        ...result,
        cache: {
          invalidated: true,
          warming: "initiated",
          invalidatedCaches: ["inventario", "sold-rolls", "rolls-data"],
        },
        duration: `${duration}ms`,
      });
    }

    const updateRequest = body as UpdateRequest;
    const { oldItem, newItem, isEdit, quantityChange, location } =
      updateRequest;

    if (!oldItem) {
      return NextResponse.json(
        { error: "oldItem es requerido" },
        { status: 400 }
      );
    }

    if ((quantityChange && !isEdit) || isEdit) {
      if (!location) {
        const operationType = isEdit ? "ediciones" : "ventas";
        return NextResponse.json(
          { error: `location es requerida para ${operationType} (CDMX o MID)` },
          { status: 400 }
        );
      }
    }

    if (location && !['CDMX', 'MID', 'CONPARTEX'].includes(location)) {
      return NextResponse.json(
        { error: "location debe ser 'CDMX', 'MID' o 'CONPARTEX'" },
        { status: 400 }
      );
    }

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
      Bucket: "telas-luciana",
      Prefix: folderPrefix,
    });

    const listResponse = await s3Client.send(listCommand);
    const jsonFiles = (listResponse.Contents || [])
      .filter((item: _Object) => item.Key && item.Key.endsWith(".json"))
      .filter((item: _Object) => !item.Key!.includes("_backup_"))
      .map((item: _Object) => item.Key!)
      .sort();

    let itemFound = false;
    let targetFileKey = "";
    let targetItemIndex = -1;
    let targetData: InventoryItem[] = [];

    for (const fileKey of jsonFiles) {
      const result = await findItemInFile(fileKey, oldItem);
      if (
        result.found &&
        result.normalizedData &&
        result.itemIndex !== undefined
      ) {
        itemFound = true;
        targetFileKey = fileKey;
        targetItemIndex = result.itemIndex;
        targetData = result.normalizedData;
        break;
      }
    }

    if (!itemFound) {
      return NextResponse.json(
        {
          error: "Producto no encontrado en el inventario",
          searchCriteria: oldItem,
        },
        { status: 404 }
      );
    }

    const modifiedData = [...targetData];
    const currentItem = { ...modifiedData[targetItemIndex] };

    if (isEdit && newItem) {
      const editedItem = { ...currentItem };

      if (newItem.Cantidad !== undefined) {
        const newQuantity = safeNumber(newItem.Cantidad, 0);

        if (location === "CDMX") {
          editedItem.CDMX = newQuantity;
        } else if (location === "MID") {
          editedItem.MID = newQuantity;
        } else if (location === "CONPARTEX") {
          editedItem.CONPARTEX = newQuantity;
        }

        const cdmxAmount = editedItem.CDMX || 0;
        const midAmount = editedItem.MID || 0;
        const conpartexAmount = editedItem.CONPARTEX || 0;
        editedItem.Cantidad = cdmxAmount + midAmount + conpartexAmount;
      }

      if (newItem.Costo !== undefined) {
        editedItem.Costo = safeNumber(newItem.Costo, 0);
      }
      if (newItem.Tela !== undefined) {
        editedItem.Tela = safeNormalize(newItem.Tela);
      }
      if (newItem.Color !== undefined) {
        editedItem.Color = safeNormalize(newItem.Color);
      }
      if (newItem.Unidades !== undefined) {
        editedItem.Unidades = safeNormalize(newItem.Unidades);
      }

      editedItem.Total = editedItem.Costo * editedItem.Cantidad;

      modifiedData[targetItemIndex] = editedItem;
    } else if (quantityChange !== undefined && location) {
      let currentLocationQuantity = 0;

      if (location === "CDMX") {
        currentLocationQuantity = currentItem.CDMX || 0;
      } else if (location === "MID") {
        currentLocationQuantity = currentItem.MID || 0;
      } else if (location === "CONPARTEX") {
        currentLocationQuantity = currentItem.CONPARTEX || 0;
      }

      if (currentLocationQuantity < quantityChange) {
        return NextResponse.json(
          {
            error: `No hay suficiente inventario en ${location}. Disponible: ${currentLocationQuantity}, Solicitado: ${quantityChange}`,
            available: currentLocationQuantity,
            requested: quantityChange,
            location: location,
          },
          { status: 400 }
        );
      }

      if (location === "CDMX") {
        currentItem.CDMX = currentLocationQuantity - quantityChange;
      } else if (location === "MID") {
        currentItem.MID = currentLocationQuantity - quantityChange;
      } else if (location === "CONPARTEX") {
        currentItem.CONPARTEX = currentLocationQuantity - quantityChange;
      }

      const cdmxAmount = currentItem.CDMX || 0;
      const midAmount = currentItem.MID || 0;
      const conpartexAmount = currentItem.CONPARTEX || 0;
      const newTotalQuantity = cdmxAmount + midAmount + conpartexAmount;

      if (newTotalQuantity <= 0) {
        modifiedData.splice(targetItemIndex, 1);
      } else {
        currentItem.Cantidad = newTotalQuantity;
        currentItem.Total = currentItem.Costo * newTotalQuantity;
        modifiedData[targetItemIndex] = currentItem;
      }
    }

    if (newItem && !isEdit) {
      const normalizedNewItem = normalizeItem(newItem);
      if (normalizedNewItem && isLambdaSafeItem(normalizedNewItem)) {
        modifiedData.push(normalizedNewItem);
      }
    }

    const saveSuccess = await saveFileSafely(targetFileKey, modifiedData);

    if (!saveSuccess) {
      return NextResponse.json(
        { error: "Error al guardar archivo" },
        { status: 500 }
      );
    }

    await invalidateInventoryRelatedCaches();

    const duration = Date.now() - startTime;

    let operationMessage = "Inventario actualizado correctamente";
    let operationType = "update";

    if (isEdit) {
      operationMessage = `Producto editado en ${location}: nueva cantidad en ${location}`;
      operationType = "edit";
    } else if (quantityChange && location) {
      operationMessage = `Venta procesada en ${location}: ${quantityChange} unidades`;
      operationType = "sale";
    }

    return NextResponse.json({
      success: true,
      message: operationMessage,
      operation: operationType,
      location: location,
      fileUpdated: targetFileKey,
      itemsInFile: modifiedData.length,
      lambdaSafe: true,
      cache: {
        invalidated: true,
        warming: "initiated",
        invalidatedCaches: ["inventario", "sold-rolls", "rolls-data"],
      },
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error actualizando inventario:", error);

    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido",
        duration: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}
