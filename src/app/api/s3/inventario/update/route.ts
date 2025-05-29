// app/api/inventario/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface InventoryItem {
  OC: string;
  Tela: string;
  Color: string;
  Costo: number;
  Cantidad: number;
  Unidades: string;
  Total: number;
  Ubicacion: string;
  Importacion: string;
  FacturaDragonAzteca?: string;
}

interface InventoryUpdateRequest {
  oldItem: {
    OC: string;
    Tela: string;
    Color: string;
    Ubicacion: string;
    Cantidad: number;
  };
  newItem?: {
    OC: string;
    Tela: string;
    Color: string;
    Ubicacion: string;
    Cantidad: number;
    Costo: number;
    Unidades: string;
    Total: number;
    Importacion: string;
    FacturaDragonAzteca?: string;
  };
  quantityChange: number;
}

// Función para normalizar strings para comparación
function normalizeString(str: string): string {
  return str.toString().trim().toLowerCase();
}

// Función mejorada para comparar items con tolerancia
function itemsMatch(
  item: InventoryItem,
  searchItem: InventoryUpdateRequest["oldItem"]
): boolean {
  const ocMatch =
    normalizeString(item.OC || "") === normalizeString(searchItem.OC || "");
  const telaMatch =
    normalizeString(item.Tela || "") === normalizeString(searchItem.Tela || "");
  const colorMatch =
    normalizeString(item.Color || "") ===
    normalizeString(searchItem.Color || "");

  // MANEJO ESPECIAL PARA UBICACIÓN: "undefined" se trata como "CDMX"
  let itemUbicacion = item.Ubicacion || "";

  // Verificar múltiples formas de "undefined"
  if (
    itemUbicacion === "undefined" ||
    itemUbicacion === '"undefined"' ||
    itemUbicacion.toLowerCase() === "undefined" ||
    !itemUbicacion ||
    itemUbicacion.trim() === ""
  ) {
    itemUbicacion = "CDMX";
  }

  const searchUbicacion = searchItem.Ubicacion || "";
  const ubicacionMatch =
    normalizeString(itemUbicacion) === normalizeString(searchUbicacion);

  // LOG DETALLADO DE COMPARACIÓN (solo si hay al menos 3 matches para evitar spam)
  const matches = [ocMatch, telaMatch, colorMatch, ubicacionMatch].filter(
    Boolean
  ).length;
  if (matches >= 3) {
    console.log(`🔍 COMPARANDO ITEM (${matches}/4 matches):`, {
      item: {
        OC: `"${item.OC}"`,
        Tela: `"${item.Tela}"`,
        Color: `"${item.Color}"`,
        Ubicacion: `"${
          item.Ubicacion
        }" (treated as: "${itemUbicacion}", normalized: "${normalizeString(
          itemUbicacion
        )}")`,
      },
      search: {
        OC: `"${searchItem.OC}"`,
        Tela: `"${searchItem.Tela}"`,
        Color: `"${searchItem.Color}"`,
        Ubicacion: `"${searchItem.Ubicacion}" (normalized: "${normalizeString(
          searchUbicacion
        )}")`,
      },
      matches: { ocMatch, telaMatch, colorMatch, ubicacionMatch },
      totalMatches: matches,
      DEBUG: {
        originalUbicacion: item.Ubicacion,
        processedUbicacion: itemUbicacion,
        searchUbicacion: searchUbicacion,
        normalizedItem: normalizeString(itemUbicacion),
        normalizedSearch: normalizeString(searchUbicacion),
      },
    });
  }

  return ocMatch && telaMatch && colorMatch && ubicacionMatch;
}

async function findInventoryFiles(year?: string, month?: string) {
  const currentYear = year || new Date().getFullYear().toString();
  const currentMonth =
    month || (new Date().getMonth() + 1).toString().padStart(2, "0");

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

  const monthIndex = parseInt(currentMonth) - 1;
  const monthName =
    monthIndex >= 0 && monthIndex < 12 ? monthNames[monthIndex] : "Mayo";

  const folderPrefix = `Inventario/${currentYear}/${monthName}/`;

  const listCommand = new ListObjectsV2Command({
    Bucket: "telas-luciana",
    Prefix: folderPrefix,
  });

  const listResponse = await s3Client.send(listCommand);

  return (listResponse.Contents || [])
    .filter((item) => item.Key && item.Key.endsWith(".json"))
    .map((item) => item.Key!);
}

async function updateInventoryFile(
  fileKey: string,
  updateData: InventoryUpdateRequest
) {
  try {
    // Leer archivo actual
    const getCommand = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
    });

    const response = await s3Client.send(getCommand);
    let fileContent = await response.Body?.transformToString();

    if (!fileContent) {
      throw new Error("No se pudo leer el archivo");
    }

    // Arreglar valores NaN si existen
    fileContent = fileContent.replace(/: *NaN/g, ": null");
    let inventoryData: InventoryItem[] = JSON.parse(fileContent);

    // Asegurar que es un array
    if (!Array.isArray(inventoryData)) {
      inventoryData = [inventoryData];
    }

    let itemFound = false;
    let itemUpdated = false;

    console.log(`\n=== BUSCANDO EN ARCHIVO: ${fileKey} ===`);
    console.log("Buscando item:", {
      OC: updateData.oldItem.OC,
      Tela: updateData.oldItem.Tela,
      Color: updateData.oldItem.Color,
      Ubicacion: updateData.oldItem.Ubicacion,
      Cantidad: updateData.oldItem.Cantidad,
    });

    // LOG: Mostrar algunos items del archivo para comparar
    if (inventoryData.length > 0) {
      console.log(
        `📄 ARCHIVO ${fileKey} - Primeros 3 items:`,
        inventoryData.slice(0, 3).map((item) => ({
          OC: `"${item.OC}"`,
          Tela: `"${item.Tela}"`,
          Color: `"${item.Color}"`,
          Ubicacion: `"${item.Ubicacion}"`,
          Cantidad: item.Cantidad,
        }))
      );
    }

    // Buscar y actualizar el item existente
    inventoryData = inventoryData
      .map((item: InventoryItem) => {
        if (itemsMatch(item, updateData.oldItem)) {
          console.log(`✅ ITEM ENCONTRADO en ${fileKey}:`, {
            OC: item.OC,
            Tela: item.Tela,
            Color: item.Color,
            Ubicacion: item.Ubicacion,
            CantidadActual: item.Cantidad,
            CantidadACambiar: updateData.quantityChange,
          });

          itemFound = true;
          const newQuantity = item.Cantidad - updateData.quantityChange;

          // Si la cantidad llega a 0 o menos, remover el item
          if (newQuantity <= 0) {
            console.log(`🗑️ ELIMINANDO ITEM (cantidad <= 0): ${newQuantity}`);
            return null; // Marcar para eliminación
          }

          itemUpdated = true;
          const updatedItem = {
            ...item,
            Cantidad: newQuantity,
            Total: item.Costo * newQuantity,
          };

          console.log(`📝 ITEM ACTUALIZADO:`, {
            CantidadAnterior: item.Cantidad,
            CantidadNueva: updatedItem.Cantidad,
            TotalNuevo: updatedItem.Total,
          });

          return updatedItem;
        }
        return item;
      })
      .filter(
        (item: InventoryItem | null): item is InventoryItem => item !== null
      );

    // Solo procesar si encontramos el item
    if (!itemFound) {
      // Log de algunos items del archivo para debug
      if (inventoryData.length > 0) {
        console.log(
          `❌ Item NO encontrado en ${fileKey}. Algunos ejemplos del archivo:`
        );

        // Buscar items similares para debug
        const similarItems = inventoryData
          .filter(
            (item) =>
              normalizeString(item.Tela || "") ===
                normalizeString(updateData.oldItem.Tela || "") ||
              normalizeString(item.Color || "") ===
                normalizeString(updateData.oldItem.Color || "")
          )
          .slice(0, 3);

        if (similarItems.length > 0) {
          console.log(
            `🔍 Items similares encontrados (mismo Tela o Color):`,
            similarItems.map((item) => ({
              OC: `"${item.OC}"`,
              Tela: `"${item.Tela}"`,
              Color: `"${item.Color}"`,
              Ubicacion: `"${item.Ubicacion}"`,
              Cantidad: item.Cantidad,
            }))
          );
        } else {
          console.log(
            `📋 Primeros 3 items del archivo:`,
            inventoryData.slice(0, 3).map((item) => ({
              OC: `"${item.OC}"`,
              Tela: `"${item.Tela}"`,
              Color: `"${item.Color}"`,
              Ubicacion: `"${item.Ubicacion}"`,
              Cantidad: item.Cantidad,
            }))
          );
        }
      }
      return { success: false, itemFound: false };
    }

    // Si hay un nuevo item (traslado a Mérida), agregarlo
    let newItemAdded = false;
    if (updateData.newItem) {
      console.log(`➕ AGREGANDO NUEVO ITEM:`, updateData.newItem);

      // Verificar si ya existe un item igual en Mérida
      const existingMeridaIndex = inventoryData.findIndex(
        (item: InventoryItem) => itemsMatch(item, updateData.newItem!)
      );

      if (existingMeridaIndex >= 0) {
        // Actualizar item existente en Mérida
        console.log(`🔄 ACTUALIZANDO ITEM EXISTENTE EN MÉRIDA`);
        inventoryData[existingMeridaIndex] = {
          ...inventoryData[existingMeridaIndex],
          Cantidad:
            inventoryData[existingMeridaIndex].Cantidad +
            updateData.newItem.Cantidad,
          Total:
            inventoryData[existingMeridaIndex].Costo *
            (inventoryData[existingMeridaIndex].Cantidad +
              updateData.newItem.Cantidad),
        };
      } else {
        // Agregar nuevo item
        console.log(`✨ CREANDO NUEVO ITEM EN MÉRIDA`);
        inventoryData.push(updateData.newItem);
        newItemAdded = true;
      }
    }

    // Guardar archivo actualizado
    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
      Body: JSON.stringify(inventoryData, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(putCommand);

    console.log(`💾 ARCHIVO GUARDADO: ${fileKey}`);
    console.log(
      `📊 RESUMEN: itemFound=${itemFound}, itemUpdated=${itemUpdated}, newItemAdded=${newItemAdded}, totalItems=${inventoryData.length}`
    );

    return {
      success: true,
      fileKey,
      itemFound,
      itemUpdated,
      newItemAdded,
      updatedCount: inventoryData.length,
    };
  } catch (error) {
    console.error(`❌ ERROR en archivo ${fileKey}:`, error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const updateData: InventoryUpdateRequest = await request.json();

    console.log("\n🚀 INICIANDO ACTUALIZACIÓN DE INVENTARIO");
    console.log("Datos recibidos:", JSON.stringify(updateData, null, 2));

    if (!updateData.oldItem || updateData.quantityChange <= 0) {
      return NextResponse.json(
        { error: "Datos de actualización inválidos" },
        { status: 400 }
      );
    }

    // Buscar archivos de inventario del mes actual
    const inventoryFiles = await findInventoryFiles();
    console.log(`📁 ARCHIVOS ENCONTRADOS: ${inventoryFiles.length}`);

    if (inventoryFiles.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron archivos de inventario" },
        { status: 404 }
      );
    }

    let updateResults = [];
    let itemFound = false;

    // Intentar actualizar en cada archivo hasta encontrar el item
    for (const fileKey of inventoryFiles) {
      try {
        const result = await updateInventoryFile(fileKey, updateData);

        if (result.success && result.itemFound) {
          console.log(`🎯 ITEM ENCONTRADO Y ACTUALIZADO EN: ${fileKey}`);
          updateResults.push(result);
          itemFound = true;
          break; // Item encontrado y actualizado, no necesitamos revisar más archivos
        }
      } catch (error) {
        console.error(`⚠️ Error en archivo ${fileKey}:`, error);
        // Continuar con el siguiente archivo
      }
    }

    if (!itemFound) {
      console.log("❌ ITEM NO ENCONTRADO EN NINGÚN ARCHIVO");
      console.log("Archivos revisados:", inventoryFiles.length);
      return NextResponse.json(
        {
          error: "Item no encontrado en ningún archivo de inventario",
          searchedFiles: inventoryFiles.length,
          searchCriteria: updateData.oldItem,
        },
        { status: 404 }
      );
    }

    console.log("✅ ACTUALIZACIÓN COMPLETADA EXITOSAMENTE");

    return NextResponse.json({
      success: true,
      message: "Inventario actualizado correctamente",
      results: updateResults,
      filesProcessed: inventoryFiles.length,
    });
  } catch (error) {
    console.error("❌ ERROR GENERAL:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
