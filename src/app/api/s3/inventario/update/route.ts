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
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Función para limpiar y normalizar valores
const normalizeValue = (value: any): string => {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  // Remover comillas dobles del inicio y final si existen
  return str.replace(/^"(.*)"$/, "$1");
};

// Función para comparar items de manera flexible
const itemsMatch = (item1: any, item2: any): boolean => {
  const normalize = (val: any) => normalizeValue(val).toLowerCase();

  const oc1 = normalize(item1.OC);
  const oc2 = normalize(item2.OC);
  const tela1 = normalize(item1.Tela);
  const tela2 = normalize(item2.Tela);
  const color1 = normalize(item1.Color);
  const color2 = normalize(item2.Color);

  // Comparación principal por OC, Tela y Color
  const mainMatch = oc1 === oc2 && tela1 === tela2 && color1 === color2;

  if (!mainMatch) return false;

  // Si hay ubicación, también debe coincidir
  const ubicacion1 = normalize(item1.Ubicacion);
  const ubicacion2 = normalize(item2.Ubicacion);

  // Si ambos tienen ubicación definida y no es "undefined", deben coincidir
  if (
    ubicacion1 !== "" &&
    ubicacion1 !== "undefined" &&
    ubicacion2 !== "" &&
    ubicacion2 !== "undefined"
  ) {
    return ubicacion1 === ubicacion2;
  }

  return true;
};

export async function POST(request: NextRequest) {
  try {
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

    const { oldItem, newItem, isEdit, quantityChange } = await request.json();

    console.log("🔍 [UPDATE API] Datos recibidos:", {
      oldItem,
      newItem,
      isEdit,
      quantityChange,
    });

    // Obtener fecha actual para la carpeta
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

    console.log("📁 [UPDATE API] Buscando en carpeta:", folderPrefix);

    // Listar archivos en la carpeta
    const listCommand = new ListObjectsV2Command({
      Bucket: "telas-luciana",
      Prefix: folderPrefix,
    });

    const listResponse = await s3Client.send(listCommand);
    const jsonFiles = (listResponse.Contents || [])
      .filter((item) => item.Key && item.Key.endsWith(".json"))
      .map((item) => item.Key!);

    console.log(
      `📊 [UPDATE API] ${jsonFiles.length} archivos JSON encontrados`
    );

    let itemFound = false;
    let fileModified = false;

    // Buscar el item en todos los archivos
    for (const fileKey of jsonFiles) {
      try {
        console.log(`🔍 [UPDATE API] Revisando archivo: ${fileKey}`);

        const getCommand = new GetObjectCommand({
          Bucket: "telas-luciana",
          Key: fileKey,
        });

        const fileResponse = await s3Client.send(getCommand);
        if (!fileResponse.Body) continue;

        let fileContent = await fileResponse.Body.transformToString();

        // Limpiar NaN values
        fileContent = fileContent.replace(/: *NaN/g, ": null");

        let jsonData;
        try {
          jsonData = JSON.parse(fileContent);
        } catch (parseError) {
          console.error(
            `❌ [UPDATE API] Error parsing ${fileKey}:`,
            parseError
          );
          continue;
        }

        // Asegurar que es un array
        if (!Array.isArray(jsonData)) {
          jsonData = [jsonData];
        }

        // Buscar el item en este archivo
        let itemIndex = -1;
        for (let i = 0; i < jsonData.length; i++) {
          if (itemsMatch(jsonData[i], oldItem)) {
            itemIndex = i;
            break;
          }
        }

        if (itemIndex >= 0) {
          console.log(
            `✅ [UPDATE API] Item encontrado en ${fileKey} en índice ${itemIndex}`
          );
          itemFound = true;

          // Actualizar el item según el tipo de operación
          if (isEdit) {
            // Reemplazar completamente el item con los nuevos datos
            jsonData[itemIndex] = {
              ...newItem,
              Total: newItem.Costo * newItem.Cantidad,
            };
            console.log("📝 [UPDATE API] Item editado completamente");
          } else if (quantityChange) {
            // Solo actualizar la cantidad (venta o adición)
            const currentQuantity =
              parseFloat(normalizeValue(jsonData[itemIndex].Cantidad)) || 0;
            const newQuantity = currentQuantity - quantityChange;
            jsonData[itemIndex].Cantidad = newQuantity;

            const costo =
              parseFloat(normalizeValue(jsonData[itemIndex].Costo)) || 0;
            jsonData[itemIndex].Total = costo * newQuantity;

            console.log(
              `📊 [UPDATE API] Cantidad actualizada: ${currentQuantity} -> ${newQuantity}`
            );
          }

          // Guardar el archivo modificado
          const updatedContent = JSON.stringify(jsonData, null, 2);
          const putCommand = new PutObjectCommand({
            Bucket: "telas-luciana",
            Key: fileKey,
            Body: updatedContent,
            ContentType: "application/json",
          });

          await s3Client.send(putCommand);
          fileModified = true;
          console.log(
            `💾 [UPDATE API] Archivo ${fileKey} actualizado exitosamente`
          );

          // Si hay newItem (transferencia), agregarlo a otro archivo o crear entrada
          if (newItem && !isEdit) {
            // Buscar si ya existe una entrada con los datos del newItem
            let newItemExists = false;
            for (let i = 0; i < jsonData.length; i++) {
              if (itemsMatch(jsonData[i], newItem)) {
                // Sumar a la cantidad existente
                const existingQuantity =
                  parseFloat(normalizeValue(jsonData[i].Cantidad)) || 0;
                const addedQuantity =
                  parseFloat(normalizeValue(newItem.Cantidad)) || 0;
                jsonData[i].Cantidad = existingQuantity + addedQuantity;
                jsonData[i].Total = jsonData[i].Costo * jsonData[i].Cantidad;
                newItemExists = true;
                console.log(
                  `📈 [UPDATE API] Cantidad sumada a item existente: ${existingQuantity} + ${addedQuantity} = ${jsonData[i].Cantidad}`
                );
                break;
              }
            }

            if (!newItemExists) {
              // Agregar como nuevo item
              jsonData.push({
                ...newItem,
                Total: newItem.Costo * newItem.Cantidad,
              });
              console.log("➕ [UPDATE API] Nuevo item agregado");
            }

            // Guardar nuevamente
            const finalContent = JSON.stringify(jsonData, null, 2);
            const finalPutCommand = new PutObjectCommand({
              Bucket: "telas-luciana",
              Key: fileKey,
              Body: finalContent,
              ContentType: "application/json",
            });

            await s3Client.send(finalPutCommand);
            console.log(`💾 [UPDATE API] Archivo final guardado`);
          }

          break; // Salir del loop ya que encontramos y actualizamos el item
        }
      } catch (fileError) {
        console.error(
          `❌ [UPDATE API] Error procesando ${fileKey}:`,
          fileError
        );
        continue;
      }
    }

    if (!itemFound) {
      console.error("❌ [UPDATE API] Item no encontrado en ningún archivo");
      console.error("🔍 [UPDATE API] Buscando:", oldItem);

      return NextResponse.json(
        {
          error: "Producto no encontrado en el inventario",
          searchCriteria: oldItem,
          filesSearched: jsonFiles.length,
        },
        { status: 404 }
      );
    }

    if (!fileModified) {
      return NextResponse.json(
        { error: "No se pudo modificar el archivo" },
        { status: 500 }
      );
    }

    console.log("✅ [UPDATE API] Actualización completada exitosamente");
    return NextResponse.json({
      success: true,
      message: "Inventario actualizado correctamente",
      operation: isEdit ? "edit" : "quantity_change",
    });
  } catch (error) {
    console.error("❌ [UPDATE API] Error general:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
