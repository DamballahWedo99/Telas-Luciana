import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  _Object,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

interface RawInventoryItem {
  OC?: string;
  Tela?: string;
  Color?: string;
  Ubicacion?: string;
  Cantidad?: unknown;
  Costo?: unknown;
  Total?: unknown;
  Unidades?: string;
  Importacion?: string;
  FacturaDragonAzteca?: string;
  status?: string;
  costo?: unknown;
  COSTO?: unknown;
  cantidad?: unknown;
  CANTIDAD?: unknown;
  [key: string]: unknown;
}

interface NormalizedInventoryItem {
  OC: string;
  Tela: string;
  Color: string;
  Ubicacion: string;
  Cantidad: number;
  Costo: number;
  Total: number;
  Unidades: string;
  Importacion?: string;
  FacturaDragonAzteca?: string;
  status?: string;
  [key: string]: unknown;
}

const fixInvalidJSON = (content: string): string => {
  return content.replace(/: *NaN/g, ": null");
};

const extractNumericValue = (value: unknown): number => {
  if (value === null || value === undefined) return 0;

  if (typeof value === "number" && !isNaN(value)) return value;

  if (typeof value === "string") {
    const cleanValue = value
      .replace(/\$/g, "")
      .replace(/,/g, ".")
      .replace(/\s/g, "");

    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

const normalizeInventoryItem = (
  item: RawInventoryItem
): NormalizedInventoryItem => {
  const normalizedItem: Record<string, unknown> = JSON.parse(
    JSON.stringify(item)
  );

  const costoKeys = ["Costo", "costo", "COSTO"];
  const costoKey = costoKeys.find((k) => k in normalizedItem) || "Costo";

  const rawCosto = normalizedItem[costoKey];
  const costoValue = extractNumericValue(rawCosto);

  normalizedItem.Costo = costoValue;

  const cantidadKeys = ["Cantidad", "cantidad", "CANTIDAD"];
  const cantidadKey =
    cantidadKeys.find((k) => k in normalizedItem) || "Cantidad";

  const rawCantidad = normalizedItem[cantidadKey];
  const cantidadValue = extractNumericValue(rawCantidad);
  normalizedItem.Cantidad = cantidadValue;

  normalizedItem.Total = costoValue * cantidadValue;

  if (!normalizedItem.Unidades) {
    normalizedItem.Unidades = "MTS";
  }

  if (!normalizedItem.Ubicacion) {
    normalizedItem.Ubicacion = "";
  }

  if (!normalizedItem.OC) {
    normalizedItem.OC = "";
  }

  if (!normalizedItem.Tela) {
    normalizedItem.Tela = "";
  }

  if (!normalizedItem.Color) {
    normalizedItem.Color = "";
  }

  Object.defineProperty(normalizedItem, "Costo", {
    value: costoValue,
    writable: true,
    enumerable: true,
    configurable: true,
  });

  return normalizedItem as NormalizedInventoryItem;
};

const isPendingItem = (item: RawInventoryItem): boolean => {
  return item.status === "pending";
};

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes al inventario. Por favor, inténtalo de nuevo más tarde.",
    });

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
    const debug = searchParams.get("debug") === "true";

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
      monthIndex >= 0 && monthIndex < 12 ? monthNames[monthIndex] : "Marzo";

    const folderPrefix = `Inventario/${year}/${monthName}/`;

    const listCommand = new ListObjectsV2Command({
      Bucket: "telas-luciana",
      Prefix: folderPrefix,
    });

    const listResponse = await s3Client.send(listCommand);

    const jsonFiles = (listResponse.Contents || [])
      .filter((item: _Object) => item.Key && item.Key.endsWith(".json"))
      .map((item: _Object) => item.Key!);

    if (jsonFiles.length === 0) {
      return NextResponse.json(
        {
          error: "No se encontraron archivos de inventario JSON en la carpeta",
        },
        { status: 404 }
      );
    }

    const filesToProcess = debug ? jsonFiles.slice(0, 5) : jsonFiles;

    const inventoryData: NormalizedInventoryItem[] = [];
    const failedFiles: string[] = [];
    let pendingItemsSkipped = 0;

    for (const fileKey of filesToProcess) {
      try {
        const getCommand = new GetObjectCommand({
          Bucket: "telas-luciana",
          Key: fileKey,
        });

        const fileResponse = await s3Client.send(getCommand);

        if (fileResponse.Body) {
          let fileContent = await fileResponse.Body.transformToString();

          fileContent = fixInvalidJSON(fileContent);

          try {
            const jsonData: unknown = JSON.parse(fileContent);

            if (Array.isArray(jsonData)) {
              jsonData.forEach((item: unknown) => {
                const typedItem = item as RawInventoryItem;
                if (isPendingItem(typedItem)) {
                  pendingItemsSkipped++;
                  return;
                }

                const normalizedItem = normalizeInventoryItem(typedItem);
                inventoryData.push(normalizedItem);
              });
            } else {
              const typedData = jsonData as RawInventoryItem;
              if (isPendingItem(typedData)) {
                pendingItemsSkipped++;
              } else {
                const normalizedItem = normalizeInventoryItem(typedData);
                inventoryData.push(normalizedItem);
              }
            }
          } catch {
            console.error(`Error al parsear JSON de ${fileKey}`);
            failedFiles.push(fileKey);
          }
        }
      } catch {
        console.error(`Error al obtener archivo ${fileKey}`);
        failedFiles.push(fileKey);
      }
    }

    if (inventoryData.length > 0) {
      return NextResponse.json({
        data: inventoryData,
        failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
        debug: {
          pendingItemsSkipped,
          totalProcessedItems: inventoryData.length,
          excludePendingActive: true,
        },
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
