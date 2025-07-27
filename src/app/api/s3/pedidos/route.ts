import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  _Object,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { withCache } from "@/lib/cache-middleware";
import { CACHE_TTL } from "@/lib/redis";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

interface PedidoData {
  num_archivo?: number;
  proveedor?: string;
  contacto?: string;
  email?: string;
  teléfono?: number;
  celular?: number;
  origen?: string;
  incoterm?: string;
  transportista?: string;
  agente_aduanal?: string;
  pedimento?: string;
  fecha_pedido?: string;
  sale_origen?: string;
  pago_credito?: string | null;
  llega_a_Lazaro?: string | null;
  llega_a_Manzanillo?: string;
  llega_almacen_proveedor?: string;
  factura_proveedor?: string;
  orden_de_compra?: string;
  reporte_inspeccion?: string | null;
  pedimento_tránsito?: string | null;
  "pedido_cliente.tipo_tela"?: string;
  "pedido_cliente.color"?: string;
  "pedido_cliente.total_m_pedidos"?: number;
  "pedido_cliente.unidad"?: string;
  precio_m_fob_usd?: number;
  total_x_color_fob_usd?: number;
  m_factura?: number;
  total_factura?: number;
  fraccion?: string;
  "supplier_percent_diff or upon negotiation"?: number;
  Year?: number;
  total_gastos?: number;
  tipo_de_cambio?: number;
  venta?: number;
  [key: string]: string | number | null | undefined;
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

async function getPedidosData(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, {
    type: "api",
    message:
      "Demasiadas solicitudes a pedidos. Por favor, inténtalo de nuevo más tarde.",
  });

  if (rateLimitResult) {
    return rateLimitResult;
  }

  const isInternalRequest = isInternalCronRequest(request);

  if (isInternalRequest) {
    console.log(
      "🔓 Acceso autorizado para solicitud interna de cron en /api/s3/pedidos"
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

  console.log("📋 Obteniendo datos de pedidos desde S3");

  const folderPrefix = "Pedidos/json/";

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
        error: "No se encontraron archivos de pedidos JSON en la carpeta",
      },
      { status: 404 }
    );
  }

  const pedidosData: PedidoData[] = [];
  const failedFiles: string[] = [];

  for (const fileKey of jsonFiles) {
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
              const typedItem = item as PedidoData;
              pedidosData.push(typedItem);
            });
          } else {
            const typedData = jsonData as PedidoData;
            pedidosData.push(typedData);
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

  if (pedidosData.length > 0) {
    console.log(
      `✅ Pedidos obtenidos exitosamente: ${pedidosData.length} items`
    );

    return NextResponse.json({
      data: pedidosData,
      failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
      debug: {
        totalProcessedItems: pedidosData.length,
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

const getCachedPedidos = withCache(getPedidosData, {
  keyPrefix: "api:s3:pedidos",
  ttl: CACHE_TTL.ORDERS,
  skipCache: (req) => {
    const url = new URL(req.url);
    return (
      url.searchParams.get("refresh") === "true" || isInternalCronRequest(req)
    );
  },
  onCacheHit: (key) => console.log(`📦 Cache HIT - Pedidos: ${key}`),
  onCacheMiss: (key) => console.log(`💾 Cache MISS - Pedidos: ${key}`),
});

export { getCachedPedidos as GET };
