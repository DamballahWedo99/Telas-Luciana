import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  _Object,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { withCache, invalidateCachePattern } from "@/lib/cache-middleware";
import { CACHE_TTL } from "@/lib/redis";

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

function isInternalCronRequest(req: NextRequest): boolean {
  const internalHeaders = [
    req.headers.get("x-internal-request"),
    req.headers.get("X-Internal-Request"),
    req.headers.get("X-INTERNAL-REQUEST"),
  ];

  const hasInternalHeader = internalHeaders.some((header) => header === "true");

  if (!hasInternalHeader) {
    return false;
  }

  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.replace("Bearer ", "");
  return token === cronSecret;
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

async function getInventoryData(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, {
    type: "api",
    message:
      "Demasiadas solicitudes al inventario. Por favor, inténtalo de nuevo más tarde.",
  });

  if (rateLimitResult) {
    return rateLimitResult;
  }

  const isInternalRequest = isInternalCronRequest(request);

  if (isInternalRequest) {
    console.log(
      "🔓 Acceso autorizado para solicitud interna de cron en /api/s3/inventario"
    );
  } else {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    console.log(
      "🔓 Acceso autorizado para usuario autenticado:",
      session.user.email
    );
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year") || new Date().getFullYear().toString();
  const month =
    searchParams.get("month") ||
    (new Date().getMonth() + 1).toString().padStart(2, "0");
  const debug = searchParams.get("debug") === "true";

  console.log(
    `📅 Obteniendo inventario para ${month}/${year} ${isInternalRequest ? "(solicitud interna)" : "(usuario)"}`
  );

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
    console.log(
      `✅ Inventario obtenido exitosamente: ${inventoryData.length} items`
    );

    return NextResponse.json({
      data: inventoryData,
      failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
      debug: {
        pendingItemsSkipped,
        totalProcessedItems: inventoryData.length,
        excludePendingActive: true,
        requestType: isInternalRequest ? "internal_cron" : "user_authenticated",
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
}

const getCachedInventory = withCache(getInventoryData, {
  keyPrefix: "api:s3:inventario",
  ttl: CACHE_TTL.INVENTORY,
  skipCache: (req) => {
    const url = new URL(req.url);
    return (
      url.searchParams.get("refresh") === "true" || isInternalCronRequest(req)
    );
  },
  onCacheHit: (key) => console.log(`📦 Cache HIT - Inventario: ${key}`),
  onCacheMiss: (key) => console.log(`💾 Cache MISS - Inventario: ${key}`),
});

export { getCachedInventory as GET };

export async function POST() {
  try {
    const session = await auth();

    if (
      !session ||
      !session.user ||
      (session.user.role !== "admin" && session.user.role !== "major_admin")
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await invalidateCachePattern("cache:api:s3:inventario*");

    return NextResponse.json({
      success: true,
      message: "Cache de inventario invalidado",
      cache: { invalidated: true },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
