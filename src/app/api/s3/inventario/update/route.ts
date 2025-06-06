import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
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
  Importacion?: string;
  FacturaDragonAzteca?: string;
  status: string;
  lastModified: string;
  [key: string]: any;
}

interface TransferPayload {
  transferType: "consolidate" | "create";
  oldItem: any;
  existingMeridaItem?: any;
  newItem?: any;
  quantityToTransfer: number;
  newMeridaQuantity?: number;
}

const isLambdaSafeItem = (item: any): boolean => {
  return !!(
    item.OC &&
    String(item.OC).trim() !== "" &&
    item.Tela &&
    String(item.Tela).trim() !== "" &&
    item.Color &&
    String(item.Color).trim() !== "" &&
    typeof item.Cantidad === "number" &&
    !isNaN(item.Cantidad) &&
    item.Cantidad > 0 &&
    typeof item.Costo === "number" &&
    !isNaN(item.Costo) &&
    item.Costo >= 0 &&
    typeof item.Total === "number" &&
    !isNaN(item.Total) &&
    item.Total >= 0
  );
};

const safeNormalize = (value: any, defaultValue: string = ""): string => {
  if (
    value === null ||
    value === undefined ||
    value === "undefined" ||
    value === "null"
  ) {
    return defaultValue;
  }

  const str = String(value).trim();
  if (str === "" || str === "undefined" || str === "null") {
    return defaultValue;
  }

  if (str.length >= 2 && str.startsWith('"') && str.endsWith('"')) {
    return str.slice(1, -1);
  }

  return str;
};

const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (
    value === null ||
    value === undefined ||
    value === "undefined" ||
    value === "null"
  ) {
    return defaultValue;
  }

  const num = parseFloat(String(value));
  return isNaN(num) ? defaultValue : num;
};

const normalizeItem = (rawItem: any): InventoryItem | null => {
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
      Total: 0,
      Unidades: safeNormalize(rawItem.Unidades, "KGS"),
      status: safeNormalize(rawItem.status, "needs_pricing"),
      lastModified: new Date().toISOString(),
    };

    const ubicacion = safeNormalize(rawItem.Ubicacion);
    if (ubicacion) {
      item.Ubicacion = ubicacion;
    }

    const importacion = safeNormalize(rawItem.Importacion);
    if (importacion) {
      item.Importacion = importacion;
    }

    const factura = safeNormalize(rawItem.FacturaDragonAzteca);
    if (factura) {
      item.FacturaDragonAzteca = factura;
    }

    item.Total = item.Costo * item.Cantidad;

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
  targetItem: any
): Promise<{
  found: boolean;
  itemIndex?: number;
  normalizedData?: InventoryItem[];
  originalData?: any[];
}> => {
  try {
    const getCommand = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
    });

    const fileResponse = await s3Client.send(getCommand);
    if (!fileResponse.Body) {
      return { found: false };
    }

    const content = await fileResponse.Body.transformToString();
    if (!content.trim()) {
      return { found: false };
    }

    let rawData;
    try {
      rawData = JSON.parse(content);
    } catch (parseError) {
      console.error(`JSON inválido en ${fileKey}:`, parseError);
      return { found: false };
    }

    if (!Array.isArray(rawData)) {
      rawData = [rawData];
    }

    const normalizedData = rawData
      .map((item) => normalizeItem(item))
      .filter((item) => item !== null) as InventoryItem[];

    const targetOC = safeNormalize(targetItem.OC).toLowerCase().trim();
    const targetTela = safeNormalize(targetItem.Tela).toLowerCase().trim();
    const targetColor = safeNormalize(targetItem.Color).toLowerCase().trim();
    const targetUbicacion = safeNormalize(targetItem.Ubicacion)
      .toLowerCase()
      .trim();

    for (let i = 0; i < normalizedData.length; i++) {
      const item = normalizedData[i];

      const itemOC = item.OC.toLowerCase().trim();
      const itemTela = item.Tela.toLowerCase().trim();
      const itemColor = item.Color.toLowerCase().trim();
      const itemUbicacion = (item.Ubicacion || "").toLowerCase().trim();

      const matchOC = itemOC === targetOC;
      const matchTela = itemTela === targetTela;
      const matchColor = itemColor === targetColor;

      let matchUbicacion = true;
      if (targetUbicacion && itemUbicacion) {
        matchUbicacion = itemUbicacion === targetUbicacion;
      }

      if (matchOC && matchTela && matchColor && matchUbicacion) {
        return {
          found: true,
          itemIndex: i,
          normalizedData,
          originalData: rawData,
        };
      }
    }

    return { found: false };
  } catch (error) {
    console.error(`Error buscando en ${fileKey}:`, error);
    return { found: false };
  }
};

const findConsolidableItem = async (
  fileKey: string,
  targetItem: any
): Promise<{
  found: boolean;
  itemIndex?: number;
  normalizedData?: InventoryItem[];
  originalData?: any[];
}> => {
  try {
    const getCommand = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
    });

    const fileResponse = await s3Client.send(getCommand);
    if (!fileResponse.Body) {
      return { found: false };
    }

    const content = await fileResponse.Body.transformToString();
    if (!content.trim()) {
      return { found: false };
    }

    let rawData;
    try {
      rawData = JSON.parse(content);
    } catch (parseError) {
      console.error(`JSON inválido en ${fileKey}:`, parseError);
      return { found: false };
    }

    if (!Array.isArray(rawData)) {
      rawData = [rawData];
    }

    const normalizedData = rawData
      .map((item) => normalizeItem(item))
      .filter((item) => item !== null) as InventoryItem[];

    const targetOC = safeNormalize(targetItem.OC).toLowerCase();
    const targetTela = safeNormalize(targetItem.Tela).toLowerCase();
    const targetColor = safeNormalize(targetItem.Color).toLowerCase();
    const targetUbicacion = safeNormalize(targetItem.Ubicacion).toLowerCase();
    const targetCosto = safeNumber(targetItem.Costo);
    const targetUnidades = safeNormalize(targetItem.Unidades).toLowerCase();

    for (let i = 0; i < normalizedData.length; i++) {
      const item = normalizedData[i];

      const itemOC = item.OC.toLowerCase();
      const itemTela = item.Tela.toLowerCase();
      const itemColor = item.Color.toLowerCase();
      const itemUbicacion = (item.Ubicacion || "").toLowerCase();
      const itemCosto = item.Costo;
      const itemUnidades = item.Unidades.toLowerCase();

      if (
        itemOC === targetOC &&
        itemTela === targetTela &&
        itemColor === targetColor &&
        itemUbicacion === targetUbicacion &&
        Math.abs(itemCosto - targetCosto) < 0.01 &&
        itemUnidades === targetUnidades
      ) {
        return {
          found: true,
          itemIndex: i,
          normalizedData,
          originalData: rawData,
        };
      }
    }

    return { found: false };
  } catch (error) {
    console.error(`Error buscando consolidable en ${fileKey}:`, error);
    return { found: false };
  }
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

    const content = JSON.stringify(safeItems, null, 2);

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
  const {
    transferType,
    oldItem,
    existingMeridaItem,
    newItem,
    quantityToTransfer,
    newMeridaQuantity,
  } = transferPayload;

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
      const newQuantity = currentItem.Cantidad - quantityToTransfer;

      if (newQuantity <= 0) {
        modifiedData.splice(result.itemIndex, 1);
      } else {
        modifiedData[result.itemIndex] = {
          ...currentItem,
          Cantidad: newQuantity,
          Total: currentItem.Costo * newQuantity,
          lastModified: new Date().toISOString(),
        };
      }

      await saveFileSafely(fileKey, modifiedData);
      break;
    }
  }

  if (!sourceItemFound) {
    throw new Error("Item de origen no encontrado para traslado");
  }

  if (transferType === "consolidate" && existingMeridaItem) {
    let destinationItemFound = false;

    for (const fileKey of jsonFiles) {
      const result = await findConsolidableItem(fileKey, existingMeridaItem);
      if (
        result.found &&
        result.normalizedData &&
        result.itemIndex !== undefined
      ) {
        destinationItemFound = true;

        const modifiedData = [...result.normalizedData];
        const existingItem = modifiedData[result.itemIndex];

        modifiedData[result.itemIndex] = {
          ...existingItem,
          Cantidad: newMeridaQuantity!,
          Total: existingItem.Costo * newMeridaQuantity!,
          lastModified: new Date().toISOString(),
        };

        await saveFileSafely(fileKey, modifiedData);

        return {
          success: true,
          message: `Traslado consolidado: ${quantityToTransfer} ${oldItem.Unidades} agregados al item existente en Mérida`,
          operation: "consolidate",
          consolidatedItemFile: fileKey,
          sourceItemFile: sourceFileKey,
        };
      }
    }

    if (!destinationItemFound) {
      throw new Error(
        "Item existente en Mérida no encontrado para consolidación"
      );
    }
  } else if (transferType === "create" && newItem) {
    const normalizedNewItem = normalizeItem(newItem);
    if (!normalizedNewItem || !isLambdaSafeItem(normalizedNewItem)) {
      throw new Error("El nuevo item no es válido o seguro para Lambda");
    }

    normalizedNewItem.status = "completed";

    const targetFileKey = sourceFileKey;

    try {
      const getCommand = new GetObjectCommand({
        Bucket: "telas-luciana",
        Key: targetFileKey,
      });

      const fileResponse = await s3Client.send(getCommand);
      if (!fileResponse.Body) {
        throw new Error(`No se pudo leer el archivo ${targetFileKey}`);
      }

      const content = await fileResponse.Body.transformToString();
      let rawData = JSON.parse(content);

      if (!Array.isArray(rawData)) {
        rawData = [rawData];
      }

      const normalizedData = rawData
        .map((item: any) => normalizeItem(item))
        .filter(
          (item: InventoryItem | null) => item !== null
        ) as InventoryItem[];

      const modifiedData = [...normalizedData, normalizedNewItem];

      await saveFileSafely(targetFileKey, modifiedData);

      return {
        success: true,
        message: `Nuevo item creado en Mérida: ${quantityToTransfer} ${oldItem.Unidades}`,
        operation: "create",
        consolidatedItemFile: targetFileKey,
        sourceItemFile: sourceFileKey,
      };
    } catch (error) {
      console.error("Error creando nuevo item:", error);
      throw new Error(
        `No se pudo crear el nuevo item en ${targetFileKey}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  throw new Error("Tipo de traslado no reconocido");
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
        .filter((item) => item.Key && item.Key.endsWith(".json"))
        .filter((item) => !item.Key!.includes("_backup_"))
        .map((item) => item.Key!)
        .sort();

      const result = await processTransferWithConsolidation(
        jsonFiles,
        transferPayload
      );

      const duration = Date.now() - startTime;

      console.log(`[UPDATE] User ${session.user.email} processed transfer:`, {
        operation: result.operation,
        success: result.success,
      });

      return NextResponse.json({
        ...result,
        duration: `${duration}ms`,
      });
    }

    const { oldItem, newItem, isEdit, quantityChange } = body;

    if (!oldItem) {
      return NextResponse.json(
        { error: "oldItem es requerido" },
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
      .filter((item) => item.Key && item.Key.endsWith(".json"))
      .filter((item) => !item.Key!.includes("_backup_"))
      .map((item) => item.Key!)
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

    let modifiedData = [...targetData];

    if (isEdit && newItem) {
      const normalizedNewItem = normalizeItem(newItem);
      if (!normalizedNewItem) {
        return NextResponse.json(
          { error: "newItem tiene datos inválidos" },
          { status: 400 }
        );
      }

      normalizedNewItem.status = "completed";
      modifiedData[targetItemIndex] = normalizedNewItem;
    } else if (quantityChange !== undefined) {
      const currentItem = modifiedData[targetItemIndex];
      const newQuantity = currentItem.Cantidad - quantityChange;

      if (newQuantity <= 0) {
        modifiedData.splice(targetItemIndex, 1);
      } else {
        modifiedData[targetItemIndex] = {
          ...currentItem,
          Cantidad: newQuantity,
          Total: currentItem.Costo * newQuantity,
          lastModified: new Date().toISOString(),
        };
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

    const duration = Date.now() - startTime;

    console.log(`[UPDATE] User ${session.user.email} updated inventory:`, {
      operation: isEdit ? "edit" : "quantity_change",
      fileUpdated: targetFileKey,
      itemsInFile: modifiedData.length,
    });

    return NextResponse.json({
      success: true,
      message: "Inventario actualizado de manera segura",
      operation: isEdit ? "edit" : "quantity_change",
      fileUpdated: targetFileKey,
      itemsInFile: modifiedData.length,
      lambdaSafe: true,
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
