import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
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

// Función para preprocesar el JSON con NaN valores
const fixInvalidJSON = (content: string): string => {
  // Reemplazar NaN con null, que sí es válido en JSON
  return content.replace(/: *NaN/g, ": null");
};

// Función para extraer valor numérico del texto
const extractNumericValue = (value: any): number => {
  if (value === null || value === undefined) return 0;

  // Si ya es un número
  if (typeof value === "number" && !isNaN(value)) return value;

  // Si es string, intentar convertir
  if (typeof value === "string") {
    // Limpiar el string: eliminar símbolos de moneda, espacios y cambiar comas por puntos
    const cleanValue = value
      .replace(/\$/g, "")
      .replace(/,/g, ".")
      .replace(/\s/g, "");

    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

// Función para normalizar los datos de inventario
const normalizeInventoryItem = (item: any) => {
  // Hacer una copia profunda para evitar modificar el original
  const normalizedItem: any = JSON.parse(JSON.stringify(item));

  // Registro mínimo si se necesita depuración
  const isDebug = process.env.DEBUG === "true";
  if (isDebug) {
    console.log("Procesando item:", item.Tela, item.Color || "");
  }

  // Determinar el campo de costo (puede variar en capitalización)
  const costoKeys = ["Costo", "costo", "COSTO"];
  let costoKey = costoKeys.find((k) => k in normalizedItem) || "Costo";

  // Extraer y normalizar el costo
  const rawCosto = normalizedItem[costoKey];
  const costoValue = extractNumericValue(rawCosto);

  // Asignar valor normalizado
  normalizedItem.Costo = costoValue;

  // Determinar campo de cantidad
  const cantidadKeys = ["Cantidad", "cantidad", "CANTIDAD"];
  let cantidadKey = cantidadKeys.find((k) => k in normalizedItem) || "Cantidad";

  // Extraer y normalizar la cantidad
  const rawCantidad = normalizedItem[cantidadKey];
  const cantidadValue = extractNumericValue(rawCantidad);
  normalizedItem.Cantidad = cantidadValue;

  // Calcular el total
  normalizedItem.Total = costoValue * cantidadValue;

  // Normalizar la importación (CORREGIDO)
  // Usar el valor de Importación (con tilde) si existe
  if (
    normalizedItem.Importación !== undefined &&
    normalizedItem.Importación !== null
  ) {
    normalizedItem.Importacion = normalizedItem.Importación;
  } else {
    // Si no hay valor, establecer el predeterminado
    normalizedItem.Importacion = "DA"; // Valor predeterminado
  }

  // Normalizar unidades
  if (!normalizedItem.Unidades) {
    normalizedItem.Unidades = "MTS"; // Valor predeterminado
  }

  // Normalizar ubicación
  if (!normalizedItem.Ubicacion) {
    normalizedItem.Ubicacion = "";
  }

  // Normalizar OC
  if (!normalizedItem.OC) {
    normalizedItem.OC = "";
  }

  // Normalizar Tela
  if (!normalizedItem.Tela) {
    normalizedItem.Tela = "";
  }

  // Normalizar Color
  if (!normalizedItem.Color) {
    normalizedItem.Color = "";
  }

  // Importante: Asegurar que el campo 'Costo' exista explícitamente en el objeto final
  Object.defineProperty(normalizedItem, "Costo", {
    value: costoValue,
    writable: true,
    enumerable: true, // Esto es crucial para que aparezca en serialización
    configurable: true,
  });

  return normalizedItem;
};

export async function GET(request: NextRequest) {
  try {
    // Aplicar rate limiting para API general
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes al inventario. Por favor, inténtalo de nuevo más tarde.",
    });

    // Si se alcanzó el límite de tasa, devolver la respuesta de error
    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year =
      searchParams.get("year") || new Date().getFullYear().toString();
    const month =
      searchParams.get("month") ||
      (new Date().getMonth() + 1).toString().padStart(2, "0");
    const debug = searchParams.get("debug") === "true"; // Parámetro para activar depuración extendida

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

    const monthIndex = parseInt(month) - 1;
    const monthName =
      monthIndex >= 0 && monthIndex < 12 ? monthNames[monthIndex] : "Marzo"; // Fallback a Marzo como tenías originalmente

    const folderPrefix = `Inventario/${year}/${monthName}/`;
    console.log(`Cargando inventario: ${folderPrefix}`);

    // Listar todos los archivos en la carpeta
    const listCommand = new ListObjectsV2Command({
      Bucket: "telas-luciana",
      Prefix: folderPrefix,
    });

    const listResponse = await s3Client.send(listCommand);

    // Filtrar solo archivos JSON
    const jsonFiles = (listResponse.Contents || [])
      .filter((item) => item.Key && item.Key.endsWith(".json"))
      .map((item) => item.Key!);

    console.log(`Archivos encontrados: ${jsonFiles.length}`);

    if (jsonFiles.length === 0) {
      return NextResponse.json(
        {
          error: "No se encontraron archivos de inventario JSON en la carpeta",
        },
        { status: 404 }
      );
    }

    // Limitar número de archivos para pruebas si debug está activado
    const filesToProcess = debug ? jsonFiles.slice(0, 5) : jsonFiles;

    // Cargar y combinar datos de todos los archivos JSON
    const inventoryData = [];
    const failedFiles = [];

    for (const fileKey of filesToProcess) {
      try {
        const getCommand = new GetObjectCommand({
          Bucket: "telas-luciana",
          Key: fileKey,
        });

        const fileResponse = await s3Client.send(getCommand);

        if (fileResponse.Body) {
          let fileContent = await fileResponse.Body.transformToString();

          // Preprocesamos el contenido para arreglar valores NaN
          fileContent = fixInvalidJSON(fileContent);

          try {
            const jsonData = JSON.parse(fileContent);

            // Si el archivo contiene un array, extendemos el inventario con esos elementos
            if (Array.isArray(jsonData)) {
              // Normalizar cada elemento del array
              jsonData.forEach((item) => {
                const normalizedItem = normalizeInventoryItem(item);
                inventoryData.push(normalizedItem);
              });
            }
            // Si es un objeto individual, lo añadimos como un elemento
            else {
              const normalizedItem = normalizeInventoryItem(jsonData);
              inventoryData.push(normalizedItem);
            }
          } catch (e) {
            console.error(`Error al parsear JSON de ${fileKey}`);
            failedFiles.push(fileKey);
          }
        }
      } catch (e) {
        console.error(`Error al obtener archivo ${fileKey}`);
        failedFiles.push(fileKey);
      }
    }

    console.log(
      `Inventario procesado: ${
        filesToProcess.length - failedFiles.length
      } exitosos, ${failedFiles.length} fallidos, ${
        inventoryData.length
      } productos`
    );

    // Si tenemos datos, devolvemos el listado completo
    if (inventoryData.length > 0) {
      return NextResponse.json({
        data: inventoryData,
        failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
      });
    } else if (failedFiles.length > 0) {
      return NextResponse.json(
        {
          error: "No se pudo procesar ningún archivo correctamente",
          failedFiles,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "No se pudo leer el archivo del bucket S3" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Error al obtener archivo de S3:", error);
    return NextResponse.json(
      { error: "Error al obtener archivo de S3" },
      { status: 500 }
    );
  }
}
