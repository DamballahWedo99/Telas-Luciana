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

interface InventoryItem {
  OC: string;
  Tela: string;
  Color: string;
  Costo: number;
  Cantidad: number;
  Unidades: string;
  Total: number;
  Ubicacion?: string;
  Importacion?: string;
  FacturaDragonAzteca?: string;
  status?: string;
  lastModified?: string;
  almacen?: string;
  created_from?: string;
  CDMX?: number;
  MID?: number;
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
  Importacion?: unknown;
  FacturaDragonAzteca?: unknown;
  status?: unknown;
  lastModified?: unknown;
  [key: string]: unknown;
}

interface PackingListEntry {
  fabric_type: string;
  color: string;
  lot: number;
  rolls: PackingListRoll[];
}

interface PackingListRoll {
  roll_number: number | string;
  almacen: string;
  kg?: number;
  mts?: number;
}

interface SalesRecord {
  rolls?: SoldRoll[];
  [key: string]: unknown;
}

interface SoldRoll {
  roll_number: number | string;
  oc: string;
  fabric_type: string;
  color: string;
  available_for_return?: boolean;
  returned_date?: string;
  return_reason?: string;
}

interface ProcessResult {
  roll_number: number | string;
  fabric_type?: string;
  color?: string;
  return_quantity?: number;
  units?: string;
  inventory_updated?: boolean;
  packing_list_updated?: boolean;
  sale_type?: string;
  error?: string;
}

interface Results {
  successful: ProcessResult[];
  failed: ProcessResult[];
  inventoryUpdates: number;
  packingListUpdates: number;
  historyUpdates: number;
}

interface FileSearchResult {
  found: boolean;
  itemIndex?: number;
  normalizedData?: InventoryItem[];
  originalData?: unknown[];
}

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

    // Campos especiales que deben preservarse incluso si son null
    const fieldsToPreserve = [
      "Importacion",
      "FacturaDragonAzteca",
      "created_from",
    ];

    // Procesar todos los demás campos
    Object.keys(rawItem).forEach((key) => {
      const skipFields = [
        "OC",
        "Tela",
        "Color",
        "Cantidad",
        "Costo",
        "Total",
        "Unidades",
        "CDMX",
        "MID",
      ];

      if (!skipFields.includes(key)) {
        if (fieldsToPreserve.includes(key)) {
          // Preservar estos campos incluso si son null
          item[key] = rawItem[key];
        } else if (rawItem[key] !== undefined && rawItem[key] !== null) {
          // Para otros campos, mantener la lógica original
          item[key] = rawItem[key];
        }
      }
    });

    if (!item.Total || item.Total === 0) {
      item.Total = item.Costo * item.Cantidad;
    }

    return item;
  } catch (error) {
    console.error("Error normalizing item:", error);
    return null;
  }
};

const findItemInFile = async (
  fileKey: string,
  targetOC: string,
  targetTela: string,
  targetColor: string
): Promise<FileSearchResult> => {
  try {
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
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

    const normalizedTargetOC = safeNormalize(targetOC).trim();
    const normalizedTargetTela = safeNormalize(targetTela).trim();
    const normalizedTargetColor = safeNormalize(targetColor).trim();

    for (let i = 0; i < normalizedData.length; i++) {
      const item = normalizedData[i];

      const matchOC = item.OC === normalizedTargetOC;
      const matchTela = item.Tela === normalizedTargetTela;
      const matchColor = item.Color === normalizedTargetColor;

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

  // Campos principales en orden específico
  if (item.OC !== undefined) orderedItem.OC = item.OC;
  if (item.Tela !== undefined) orderedItem.Tela = item.Tela;
  if (item.Color !== undefined) orderedItem.Color = item.Color;
  if (item.Costo !== undefined) orderedItem.Costo = item.Costo;
  if (item.Cantidad !== undefined) orderedItem.Cantidad = item.Cantidad;
  if (item.Unidades !== undefined) orderedItem.Unidades = item.Unidades;
  if (item.CDMX !== undefined) orderedItem.CDMX = item.CDMX;
  if (item.MID !== undefined) orderedItem.MID = item.MID;
  if (item.Total !== undefined) orderedItem.Total = item.Total;

  // Campos especiales que deben preservarse incluso si son null
  const fieldsToPreserve = [
    "Importacion",
    "FacturaDragonAzteca",
    "created_from",
  ];

  // Agregar campos especiales que deben preservarse
  fieldsToPreserve.forEach((field) => {
    if (item.hasOwnProperty(field)) {
      orderedItem[field] = item[field];
    }
  });

  // Agregar el resto de campos (excluyendo los ya procesados y los campos temporales)
  const processedFields = [
    "OC",
    "Tela",
    "Color",
    "Costo",
    "Cantidad",
    "Unidades",
    "CDMX",
    "MID",
    "Total",
    ...fieldsToPreserve,
  ];

  const excludedFields = ["lastModified", "status", "Ubicacion", "almacen"];

  Object.keys(item).forEach((key) => {
    if (
      !processedFields.includes(key) &&
      !excludedFields.includes(key) &&
      item[key] !== undefined &&
      item[key] !== "" // Mantener la exclusión de strings vacíos pero permitir null
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
    if (items.length === 0) {
      return true;
    }

    const itemsForSave = items.map((item) => {
      let saveItem = { ...item };

      if (saveItem.CDMX === undefined) {
        saveItem.CDMX = NaN;
      }
      if (saveItem.MID === undefined) {
        saveItem.MID = NaN;
      }

      delete saveItem.lastModified;
      delete saveItem.status;
      delete saveItem.Ubicacion;
      delete saveItem.almacen;

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
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Body: content,
      ContentType: "application/json",
      Metadata: {
        "last-updated": new Date().toISOString(),
        operation: "return-roll",
      },
    });

    await s3Client.send(putCommand);

    return true;
  } catch (error) {
    console.error(`Error guardando ${fileKey}:`, error);
    return false;
  }
};

function isManualSale(rollNumber: number | string): boolean {
  return String(rollNumber).startsWith("MANUAL-");
}

async function findInventoryFile(
  oc: string,
  tela: string,
  color: string
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
      .filter((item) => !item.Key!.includes("_backup_"))
      .map((item) => item.Key!)
      .sort();

    for (const fileKey of jsonFiles) {
      const result = await findItemInFile(fileKey, oc, tela, color);
      if (result.found) {
        return fileKey;
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

        const data: PackingListEntry[] = JSON.parse(bodyString);
        if (!Array.isArray(data)) continue;

        const foundEntry = data.find(
          (entry: PackingListEntry) =>
            entry.fabric_type?.toLowerCase() === tela.toLowerCase() &&
            entry.color?.toLowerCase() === color.toLowerCase() &&
            entry.lot === lot
        );

        if (foundEntry) {
          return fileKey;
        }
      } catch {
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
  rolls: ReturnRoll[]
): Promise<boolean> {
  try {
    const firstRoll = rolls[0];
    const result = await findItemInFile(
      fileKey,
      firstRoll.oc,
      firstRoll.fabric_type,
      firstRoll.color
    );

    if (
      !result.found ||
      !result.normalizedData ||
      result.itemIndex === undefined
    ) {
      return false;
    }

    const modifiedData = [...result.normalizedData];
    const currentItem = { ...modifiedData[result.itemIndex] };

    for (const roll of rolls) {
      const ubicacion = roll.almacen.toUpperCase();

      if (ubicacion === "CDMX") {
        const currentCDMX = currentItem.CDMX || 0;
        currentItem.CDMX = currentCDMX + roll.return_quantity;
      } else if (
        ubicacion === "MID" ||
        ubicacion === "MÉRIDA" ||
        ubicacion === "MERIDA"
      ) {
        const currentMID = currentItem.MID || 0;
        currentItem.MID = currentMID + roll.return_quantity;
      }
    }

    const updatedCDMX = currentItem.CDMX || 0;
    const updatedMID = currentItem.MID || 0;
    currentItem.Cantidad = updatedCDMX + updatedMID;

    currentItem.Total = currentItem.Costo * currentItem.Cantidad;

    modifiedData[result.itemIndex] = currentItem;
    return await saveFileSafely(fileKey, modifiedData);
  } catch (error) {
    console.error("Error actualizando inventario:", error);
    return false;
  }
}

async function createInventoryFile(
  rolls: ReturnRoll[]
): Promise<string | null> {
  try {
    const firstRoll = rolls[0];
    const year = new Date().getFullYear().toString();
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
    const monthName = monthNames[new Date().getMonth()];

    const fileName = `inventario_${firstRoll.oc.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_${Date.now()}.json`;
    const fileKey = `Inventario/${year}/${monthName}/${fileName}`;

    let totalCDMX = 0;
    let totalMID = 0;
    let totalQuantity = 0;

    for (const roll of rolls) {
      const ubicacion = roll.almacen.toUpperCase();

      if (ubicacion === "CDMX") {
        totalCDMX += roll.return_quantity;
      } else if (
        ubicacion === "MID" ||
        ubicacion === "MÉRIDA" ||
        ubicacion === "MERIDA"
      ) {
        totalMID += roll.return_quantity;
      }
      totalQuantity += roll.return_quantity;
    }

    const newItem: InventoryItem = {
      OC: firstRoll.oc,
      Tela: firstRoll.fabric_type,
      Color: firstRoll.color,
      Costo: firstRoll.costo,
      Cantidad: totalQuantity,
      Unidades: firstRoll.units,
      Total: firstRoll.costo * totalQuantity,
    };

    if (totalCDMX > 0) {
      newItem.CDMX = totalCDMX;
    } else {
      newItem.CDMX = NaN;
    }

    if (totalMID > 0) {
      newItem.MID = totalMID;
    } else {
      newItem.MID = NaN;
    }

    return (await saveFileSafely(fileKey, [newItem])) ? fileKey : null;
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

    const data: PackingListEntry[] = JSON.parse(bodyString);
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
          (r: PackingListRoll) => r.roll_number === roll.roll_number
        );

        if (existingRollIndex >= 0) {
          const updatedRoll: PackingListRoll = {
            roll_number: roll.roll_number,
            almacen: roll.almacen,
          };

          if (roll.units.toLowerCase() === "kgs") {
            updatedRoll.kg = roll.return_quantity;
          } else {
            updatedRoll.mts = roll.return_quantity;
          }

          entry.rolls[existingRollIndex] = updatedRoll;
        } else {
          if (!entry.rolls) entry.rolls = [];

          const newRoll: PackingListRoll = {
            roll_number: roll.roll_number,
            almacen: roll.almacen,
          };

          if (roll.units.toLowerCase() === "kgs") {
            newRoll.kg = roll.return_quantity;
          } else {
            newRoll.mts = roll.return_quantity;
          }

          entry.rolls.push(newRoll);

          entry.rolls.sort(
            (a: PackingListRoll, b: PackingListRoll) =>
              Number(a.roll_number) - Number(b.roll_number)
          );
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
      (item: _Object) =>
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

        const salesData: SalesRecord = JSON.parse(bodyString);
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
      } catch {
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

    const results: Results = {
      successful: [],
      failed: [],
      inventoryUpdates: 0,
      packingListUpdates: 0,
      historyUpdates: 0,
    };

    const rollsByItem = new Map<string, ReturnRoll[]>();

    for (const roll of returnData.rolls) {
      const itemKey = `${roll.oc}|${roll.fabric_type}|${roll.color}`;
      if (!rollsByItem.has(itemKey)) {
        rollsByItem.set(itemKey, []);
      }
      rollsByItem.get(itemKey)!.push(roll);
    }

    for (const [, itemRolls] of rollsByItem) {
      try {
        const firstRoll = itemRolls[0];
        const isManual = isManualSale(firstRoll.roll_number);
        let inventoryUpdated = false;
        let packingListUpdated = false;

        if (isManual) {
          const inventoryFile = await findInventoryFile(
            firstRoll.oc,
            firstRoll.fabric_type,
            firstRoll.color
          );

          if (inventoryFile) {
            inventoryUpdated = await updateInventory(inventoryFile, itemRolls);
            if (inventoryUpdated) results.inventoryUpdates++;
          } else {
            const newInventoryFile = await createInventoryFile(itemRolls);
            if (newInventoryFile) {
              inventoryUpdated = true;
              results.inventoryUpdates++;
            }
          }

          packingListUpdated = true;
        } else {
          const inventoryFile = await findInventoryFile(
            firstRoll.oc,
            firstRoll.fabric_type,
            firstRoll.color
          );

          if (inventoryFile) {
            inventoryUpdated = await updateInventory(inventoryFile, itemRolls);
            if (inventoryUpdated) results.inventoryUpdates++;
          }

          for (const roll of itemRolls) {
            const packingListFile = await findPackingListFile(
              roll.oc,
              roll.fabric_type,
              roll.color,
              roll.lot
            );

            if (packingListFile) {
              const plUpdated = await updatePackingList(packingListFile, roll);
              if (plUpdated) {
                packingListUpdated = true;
                results.packingListUpdates++;
              }
            }
          }
        }

        if (inventoryUpdated || packingListUpdated) {
          for (const roll of itemRolls) {
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
          }
        } else {
          for (const roll of itemRolls) {
            results.failed.push({
              roll_number: roll.roll_number,
              error: isManual
                ? "No se pudo actualizar el inventario para la venta manual"
                : "No se pudo actualizar ni inventario ni packing list",
            });
          }
        }
      } catch (rollError) {
        for (const roll of itemRolls) {
          results.failed.push({
            roll_number: roll.roll_number,
            error:
              rollError instanceof Error
                ? rollError.message
                : "Error desconocido",
          });
        }
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

        await Promise.all([
          invalidateCachePattern("cache:api:s3:sold-rolls*"),
          invalidateCachePattern("cache:api:s3:inventario*"),
        ]);

        console.log("🗑️ Cache invalidado después de procesar devolución");
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
      cache: {
        invalidated: results.successful.length > 0,
        patterns: ["sold-rolls", "inventario"],
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
