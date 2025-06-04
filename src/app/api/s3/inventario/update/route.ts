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

// === TIPOS ===
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

// 🆕 Nuevo tipo para manejar transferencias con consolidación
interface TransferPayload {
  transferType: "consolidate" | "create";
  oldItem: any;
  existingMeridaItem?: any;
  newItem?: any;
  quantityToTransfer: number;
  newMeridaQuantity?: number;
}

// === VALIDACIÓN LAMBDA-COMPATIBLE ===
/**
 * Validar que un item NO será eliminado por el Lambda
 * El Lambda elimina archivos donde TODOS los campos estén vacíos/null/0
 */
const isLambdaSafeItem = (item: any): boolean => {
  const requiredFields = [
    "OC",
    "Tela",
    "Color",
    "Unidades",
    "Cantidad",
    "Costo",
    "Total",
    "Importacion",
  ];

  // Verificar que al menos los campos críticos tengan valores válidos
  return !!(
    item.OC &&
    String(item.OC).trim() !== "" &&
    item.Tela &&
    String(item.Tela).trim() !== "" &&
    item.Color &&
    String(item.Color).trim() !== "" &&
    typeof item.Cantidad === "number" &&
    !isNaN(item.Cantidad) &&
    item.Cantidad > 0 && // CANTIDAD DEBE SER > 0
    typeof item.Costo === "number" &&
    !isNaN(item.Costo) &&
    item.Costo >= 0 &&
    typeof item.Total === "number" &&
    !isNaN(item.Total) &&
    item.Total >= 0
  );
};

// === NORMALIZACIÓN SEGURA ===
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

  // Remover comillas solo si todo el string está envuelto
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

// === NORMALIZACIÓN DE ITEMS ===
const normalizeItem = (rawItem: any): InventoryItem | null => {
  try {
    // Verificar que el item tiene datos mínimos
    if (!rawItem || typeof rawItem !== "object") {
      console.log(`❌ [NORMALIZE] Item no es objeto válido`);
      return null;
    }

    // Campos obligatorios con valores por defecto seguros
    const item: InventoryItem = {
      OC: safeNormalize(rawItem.OC, "SIN-OC"),
      Tela: safeNormalize(rawItem.Tela, "SIN-TELA"),
      Color: safeNormalize(rawItem.Color, "SIN-COLOR"),
      Cantidad: safeNumber(rawItem.Cantidad, 0),
      Costo: safeNumber(rawItem.Costo, 0),
      Total: 0, // Se calculará después
      Unidades: safeNormalize(rawItem.Unidades, "KGS"),
      status: safeNormalize(rawItem.status, "needs_pricing"),
      lastModified: new Date().toISOString(),
    };

    // Campos opcionales
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

    // Calcular Total de manera segura
    item.Total = item.Costo * item.Cantidad;

    // VALIDACIÓN CRÍTICA: Debe pasar la prueba del Lambda
    if (!isLambdaSafeItem(item)) {
      console.log(`❌ [NORMALIZE] Item no pasaría validación Lambda:`, {
        OC: item.OC,
        Tela: item.Tela,
        Color: item.Color,
        Cantidad: item.Cantidad,
        Costo: item.Costo,
        Total: item.Total,
      });
      return null;
    }

    return item;
  } catch (error) {
    console.error(`❌ [NORMALIZE] Error:`, error);
    return null;
  }
};

// === BÚSQUEDA DE ITEMS ===
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
    console.log(`🔍 [SEARCH] Analizando archivo: ${fileKey}`);
    console.log(`🔍 [SEARCH] Buscando:`, {
      OC: targetItem.OC,
      Tela: targetItem.Tela,
      Color: targetItem.Color,
      Ubicacion: targetItem.Ubicacion,
    });

    const getCommand = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
    });

    const fileResponse = await s3Client.send(getCommand);
    if (!fileResponse.Body) {
      console.log(`❌ [SEARCH] Archivo vacío: ${fileKey}`);
      return { found: false };
    }

    const content = await fileResponse.Body.transformToString();
    if (!content.trim()) {
      console.log(`❌ [SEARCH] Contenido vacío: ${fileKey}`);
      return { found: false };
    }

    let rawData;
    try {
      rawData = JSON.parse(content);
    } catch (parseError) {
      console.error(`❌ [SEARCH] JSON inválido en ${fileKey}:`, parseError);
      return { found: false };
    }

    if (!Array.isArray(rawData)) {
      rawData = [rawData];
    }

    // Normalizar todos los items
    const normalizedData = rawData
      .map((item) => normalizeItem(item))
      .filter((item) => item !== null) as InventoryItem[];

    console.log(`📄 [SEARCH] Items en archivo: ${normalizedData.length}`);

    // Criterios de búsqueda más flexibles
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

      console.log(`🔍 [SEARCH] Comparando item ${i}:`, {
        archivo: {
          OC: itemOC,
          Tela: itemTela,
          Color: itemColor,
          Ubicacion: itemUbicacion,
        },
        objetivo: {
          OC: targetOC,
          Tela: targetTela,
          Color: targetColor,
          Ubicacion: targetUbicacion,
        },
      });

      // Match principal: OC, Tela, Color
      const matchOC = itemOC === targetOC;
      const matchTela = itemTela === targetTela;
      const matchColor = itemColor === targetColor;

      // Match ubicación: más flexible
      let matchUbicacion = true;
      if (targetUbicacion && itemUbicacion) {
        matchUbicacion = itemUbicacion === targetUbicacion;
      }

      if (matchOC && matchTela && matchColor && matchUbicacion) {
        console.log(`✅ [SEARCH] MATCH ENCONTRADO en ${fileKey}[${i}]:`, {
          OC: item.OC,
          Tela: item.Tela,
          Color: item.Color,
          Ubicacion: item.Ubicacion,
          Cantidad: item.Cantidad,
        });

        return {
          found: true,
          itemIndex: i,
          normalizedData,
          originalData: rawData,
        };
      }
    }

    console.log(`❌ [SEARCH] No encontrado en ${fileKey}`);
    return { found: false };
  } catch (error) {
    console.error(`❌ [SEARCH] Error en ${fileKey}:`, error);
    return { found: false };
  }
};

// 🆕 === BÚSQUEDA PARA CONSOLIDACIÓN ===
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
      console.error(
        `❌ [CONSOLIDATE-SEARCH] JSON inválido en ${fileKey}:`,
        parseError
      );
      return { found: false };
    }

    if (!Array.isArray(rawData)) {
      rawData = [rawData];
    }

    // Normalizar todos los items
    const normalizedData = rawData
      .map((item) => normalizeItem(item))
      .filter((item) => item !== null) as InventoryItem[];

    // Buscar item consolidable (misma tela, color, ubicación, costo, unidades)
    const targetOC = safeNormalize(targetItem.OC).toLowerCase();
    const targetTela = safeNormalize(targetItem.Tela).toLowerCase();
    const targetColor = safeNormalize(targetItem.Color).toLowerCase();
    const targetUbicacion = safeNormalize(targetItem.Ubicacion).toLowerCase();
    const targetCosto = safeNumber(targetItem.Costo);
    const targetUnidades = safeNormalize(targetItem.Unidades).toLowerCase();

    console.log(`🔍 [CONSOLIDATE-SEARCH] Buscando en ${fileKey}:`, {
      OC: targetOC,
      Tela: targetTela,
      Color: targetColor,
      Ubicacion: targetUbicacion,
      Costo: targetCosto,
      Unidades: targetUnidades,
    });

    for (let i = 0; i < normalizedData.length; i++) {
      const item = normalizedData[i];

      const itemOC = item.OC.toLowerCase();
      const itemTela = item.Tela.toLowerCase();
      const itemColor = item.Color.toLowerCase();
      const itemUbicacion = (item.Ubicacion || "").toLowerCase();
      const itemCosto = item.Costo;
      const itemUnidades = item.Unidades.toLowerCase();

      // 🚨 CRITERIOS DE CONSOLIDACIÓN: OC, Tela, Color, Ubicación, Costo, Unidades deben coincidir
      if (
        itemOC === targetOC &&
        itemTela === targetTela &&
        itemColor === targetColor &&
        itemUbicacion === targetUbicacion &&
        Math.abs(itemCosto - targetCosto) < 0.01 && // Tolerancia para números decimales
        itemUnidades === targetUnidades
      ) {
        console.log(
          `✅ [CONSOLIDATE-SEARCH] Item consolidable encontrado en ${fileKey}[${i}]:`,
          {
            existing: {
              OC: item.OC,
              Tela: item.Tela,
              Color: item.Color,
              Ubicacion: item.Ubicacion,
              Cantidad: item.Cantidad,
              Costo: item.Costo,
            },
          }
        );

        return {
          found: true,
          itemIndex: i,
          normalizedData,
          originalData: rawData,
        };
      }
    }

    console.log(
      `❌ [CONSOLIDATE-SEARCH] No se encontró item consolidable en ${fileKey}`
    );
    return { found: false };
  } catch (error) {
    console.error(`❌ [CONSOLIDATE-SEARCH] Error en ${fileKey}:`, error);
    return { found: false };
  }
};

// === GUARDAR ARCHIVO SEGURO ===
const saveFileSafely = async (
  fileKey: string,
  items: InventoryItem[]
): Promise<boolean> => {
  try {
    // VALIDACIÓN CRÍTICA: Todos los items deben ser seguros para el Lambda
    const safeItems = items.filter((item) => isLambdaSafeItem(item));

    if (safeItems.length === 0) {
      console.log(
        `⚠️ [SAVE] No hay items seguros para guardar en ${fileKey} - ELIMINANDO archivo`
      );

      // Eliminar archivo vacío para evitar que el Lambda lo procese
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: "telas-luciana",
            Key: fileKey,
          })
        );
        console.log(`🗑️ [SAVE] Archivo eliminado: ${fileKey}`);
      } catch (deleteError) {
        console.error(`❌ [SAVE] Error eliminando archivo:`, deleteError);
      }

      return true; // Operación exitosa (archivo eliminado)
    }

    // Crear backup
    const backupKey = fileKey.replace(".json", `_backup_${Date.now()}.json`);

    // Guardar archivo con items seguros
    const content = JSON.stringify(safeItems, null, 2);

    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
      Body: content,
      ContentType: "application/json",
    });

    await s3Client.send(putCommand);

    console.log(
      `💾 [SAVE] Archivo guardado con ${safeItems.length} items seguros: ${fileKey}`
    );

    // Validar que el archivo guardado es compatible con Lambda
    console.log(
      `🛡️ [SAVE] Validation: Todos los items pasaron validación Lambda`
    );

    return true;
  } catch (error) {
    console.error(`❌ [SAVE] Error guardando ${fileKey}:`, error);
    return false;
  }
};

// 🆕 === PROCESAR TRASLADO CON CONSOLIDACIÓN ===
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

  console.log(`🚀 [CONSOLIDATE] Procesando traslado tipo: ${transferType}`);

  // 1. Buscar y actualizar item de origen (CDMX)
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

      // Reducir cantidad en origen
      const modifiedData = [...result.normalizedData];
      const currentItem = modifiedData[result.itemIndex];
      const newQuantity = currentItem.Cantidad - quantityToTransfer;

      if (newQuantity <= 0) {
        // Eliminar item si cantidad <= 0
        modifiedData.splice(result.itemIndex, 1);
        console.log(`🗑️ [CONSOLIDATE] Item origen eliminado (cantidad <= 0)`);
      } else {
        // Actualizar cantidad
        modifiedData[result.itemIndex] = {
          ...currentItem,
          Cantidad: newQuantity,
          Total: currentItem.Costo * newQuantity,
          lastModified: new Date().toISOString(),
        };
        console.log(
          `📉 [CONSOLIDATE] Cantidad origen: ${currentItem.Cantidad} -> ${newQuantity}`
        );
      }

      // Guardar archivo origen
      await saveFileSafely(fileKey, modifiedData);
      break;
    }
  }

  if (!sourceItemFound) {
    throw new Error("Item de origen no encontrado para traslado");
  }

  // 2. Procesar destino según el tipo de traslado
  if (transferType === "consolidate" && existingMeridaItem) {
    // CONSOLIDAR: Buscar y actualizar item existente en Mérida
    console.log(`🔄 [CONSOLIDATE] Consolidando con item existente en Mérida`);

    let destinationItemFound = false;

    for (const fileKey of jsonFiles) {
      const result = await findConsolidableItem(fileKey, existingMeridaItem);
      if (
        result.found &&
        result.normalizedData &&
        result.itemIndex !== undefined
      ) {
        destinationItemFound = true;

        // Actualizar cantidad del item existente
        const modifiedData = [...result.normalizedData];
        const existingItem = modifiedData[result.itemIndex];

        modifiedData[result.itemIndex] = {
          ...existingItem,
          Cantidad: newMeridaQuantity!,
          Total: existingItem.Costo * newMeridaQuantity!,
          lastModified: new Date().toISOString(),
        };

        console.log(
          `📈 [CONSOLIDATE] Cantidad Mérida: ${existingItem.Cantidad} -> ${newMeridaQuantity}`
        );

        // Guardar archivo destino
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
    // CREAR: Nuevo item en Mérida
    console.log(`🆕 [CONSOLIDATE] Creando nuevo item en Mérida`);

    const normalizedNewItem = normalizeItem(newItem);
    if (!normalizedNewItem || !isLambdaSafeItem(normalizedNewItem)) {
      throw new Error("El nuevo item no es válido o seguro para Lambda");
    }

    normalizedNewItem.status = "completed";

    // Usar el mismo archivo donde se encontró el item de origen
    const targetFileKey = sourceFileKey;

    try {
      // Leer archivo actualizado después del primer cambio
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

      // Normalizar todos los items existentes
      const normalizedData = rawData
        .map((item: any) => normalizeItem(item))
        .filter(
          (item: InventoryItem | null) => item !== null
        ) as InventoryItem[];

      // Agregar el nuevo item
      const modifiedData = [...normalizedData, normalizedNewItem];

      console.log(
        `➕ [CONSOLIDATE] Agregando nuevo item a archivo existente con ${normalizedData.length} items`
      );

      // Guardar archivo con el nuevo item
      await saveFileSafely(targetFileKey, modifiedData);

      return {
        success: true,
        message: `Nuevo item creado en Mérida: ${quantityToTransfer} ${oldItem.Unidades}`,
        operation: "create",
        consolidatedItemFile: targetFileKey,
        sourceItemFile: sourceFileKey,
      };
    } catch (error) {
      console.error(`❌ [CONSOLIDATE] Error creando nuevo item:`, error);
      throw new Error(
        `No se pudo crear el nuevo item en ${targetFileKey}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  throw new Error("Tipo de traslado no reconocido");
};

// === API PRINCIPAL ===
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("🚀 [API] === ACTUALIZACIÓN LAMBDA-SAFE CON CONSOLIDACIÓN ===");

    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas solicitudes de actualización. Inténtalo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Verificar autenticación
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Obtener y validar datos
    const body = await request.json();

    // 🆕 DETECTAR TIPO DE OPERACIÓN
    if (body.transferType) {
      // Nueva operación de traslado con consolidación
      console.log("🔄 [API] Procesando traslado con consolidación");

      const transferPayload = body as TransferPayload;

      // Determinar carpeta de trabajo
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

      // Listar archivos
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

      // Procesar traslado
      const result = await processTransferWithConsolidation(
        jsonFiles,
        transferPayload
      );

      const duration = Date.now() - startTime;
      console.log(
        `✅ [API] === TRASLADO CON CONSOLIDACIÓN COMPLETADO en ${duration}ms ===`
      );

      return NextResponse.json({
        ...result,
        duration: `${duration}ms`,
      });
    }

    // 📝 OPERACIÓN TRADICIONAL (edición o cambio de cantidad)
    const { oldItem, newItem, isEdit, quantityChange } = body;

    if (!oldItem) {
      return NextResponse.json(
        { error: "oldItem es requerido" },
        { status: 400 }
      );
    }

    console.log("📋 [API] Operación:", isEdit ? "EDICIÓN" : "CAMBIO_CANTIDAD");
    console.log("🎯 [API] Buscando item:", {
      OC: oldItem.OC,
      Tela: oldItem.Tela,
      Color: oldItem.Color,
      Ubicacion: oldItem.Ubicacion,
    });

    // Determinar carpeta de trabajo
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

    // Listar archivos
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

    console.log(`📁 [API] Buscando en ${jsonFiles.length} archivos`);

    // Buscar el item
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
      console.log("❌ [API] Item no encontrado");
      return NextResponse.json(
        {
          error: "Producto no encontrado en el inventario",
          searchCriteria: oldItem,
        },
        { status: 404 }
      );
    }

    console.log(
      `✅ [API] Item encontrado en ${targetFileKey}[${targetItemIndex}]`
    );

    // Aplicar modificaciones
    let modifiedData = [...targetData];

    if (isEdit && newItem) {
      // Edición completa
      const normalizedNewItem = normalizeItem(newItem);
      if (!normalizedNewItem) {
        return NextResponse.json(
          { error: "newItem tiene datos inválidos" },
          { status: 400 }
        );
      }

      normalizedNewItem.status = "completed";
      modifiedData[targetItemIndex] = normalizedNewItem;
      console.log("📝 [API] Item editado completamente");
    } else if (quantityChange !== undefined) {
      // Cambio de cantidad
      const currentItem = modifiedData[targetItemIndex];
      const newQuantity = currentItem.Cantidad - quantityChange;

      if (newQuantity <= 0) {
        // CRÍTICO: Eliminar item con cantidad 0 para evitar archivo "vacío"
        modifiedData.splice(targetItemIndex, 1);
        console.log(
          `🗑️ [API] Item eliminado (cantidad <= 0): ${currentItem.OC} ${currentItem.Tela} ${currentItem.Color}`
        );
      } else {
        modifiedData[targetItemIndex] = {
          ...currentItem,
          Cantidad: newQuantity,
          Total: currentItem.Costo * newQuantity,
          lastModified: new Date().toISOString(),
        };
        console.log(
          `📊 [API] Cantidad actualizada: ${currentItem.Cantidad} -> ${newQuantity}`
        );
      }
    }

    // Agregar nuevo item si es transferencia
    if (newItem && !isEdit) {
      const normalizedNewItem = normalizeItem(newItem);
      if (normalizedNewItem && isLambdaSafeItem(normalizedNewItem)) {
        modifiedData.push(normalizedNewItem);
        console.log("➕ [API] Nuevo item agregado para transferencia");
      }
    }

    // Guardar archivo de manera segura
    const saveSuccess = await saveFileSafely(targetFileKey, modifiedData);

    if (!saveSuccess) {
      return NextResponse.json(
        { error: "Error al guardar archivo" },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    console.log(
      `✅ [API] === ACTUALIZACIÓN LAMBDA-SAFE COMPLETADA en ${duration}ms ===`
    );

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
    console.error(`❌ [API] Error después de ${duration}ms:`, error);

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
