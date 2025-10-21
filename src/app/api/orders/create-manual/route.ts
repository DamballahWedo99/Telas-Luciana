import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = "telas-luciana";

interface OrderItem {
  // ONLY REQUIRED FIELD
  orden_de_compra: string;

  // All other fields are optional
  Year?: number;
  proveedor?: string;
  contacto?: string;
  origen?: string;
  incoterm?: string;
  transportista?: string;
  agente_aduanal?: string;
  fecha_pedido?: string | null;
  sale_origen?: string | null;
  pago_credito?: string | null;
  llega_a_México?: string | null;
  llega_almacen_proveedor?: string | null;
  pedimento?: string | null;
  factura_proveedor?: string | null;
  reporte_inspeccion?: string | null;
  pedimento_tránsito?: string | null;
  tipo_de_cambio?: string;
  total_gastos?: string;
  "pedido_cliente.tipo_tela"?: string;
  "pedido_cliente.color"?: string;
  "pedido_cliente.total_m_pedidos"?: number;
  "pedido_cliente.unidad"?: string;
  precio_m_fob_usd?: number;
  venta?: string;
  m_factura?: number;
  total_factura?: number;
  total_x_color_fob_usd?: number;
}

interface CreateOrderPayload {
  orden_de_compra: string;
  items: OrderItem[];
}

/**
 * POST /api/orders/create-manual
 * Creates a new purchase order manually with multiple fabric items
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Parse request body
    const payload: CreateOrderPayload = await req.json();
    const { orden_de_compra, items } = payload;

    // Validate payload
    if (!orden_de_compra || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Datos inválidos: se requiere orden_de_compra y al menos un item" },
        { status: 400 }
      );
    }

    // Validate that all items have the same orden_de_compra
    const invalidItems = items.filter(item => item.orden_de_compra !== orden_de_compra);
    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: "Todos los items deben tener la misma orden_de_compra" },
        { status: 400 }
      );
    }

    // Extract year from items for folder organization
    const year = items[0]?.Year || new Date().getFullYear();

    // Create the order structure for S3
    const orderData = {
      orden_de_compra,
      items,
      created_at: new Date().toISOString(),
      created_by: session.user.email,
      status: "pending", // New orders start as pending
    };

    // Upload to S3 with year-based folder organization
    const fileName = `${orden_de_compra}.json`;
    const s3Key = `Pedidos/json/${year}/${fileName}`;

    console.log(`📤 Uploading new order to S3: ${s3Key}`);

    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: JSON.stringify(orderData, null, 2),
      ContentType: "application/json",
      Metadata: {
        "orden-de-compra": orden_de_compra,
        "created-by": session.user.email || "",
        "created-at": new Date().toISOString(),
        "year": year.toString(),
        "items-count": items.length.toString(),
      },
    });

    await s3Client.send(uploadCommand);

    console.log(`✅ Successfully created order: ${orden_de_compra} with ${items.length} items`);

    // Invalidate cache for the order year
    try {
      const { invalidateCacheForOrderYear } = await import("@/lib/cache-middleware");
      const sampleOrder = { fecha_pedido: items[0]?.fecha_pedido || undefined };
      await invalidateCacheForOrderYear(sampleOrder);
      console.log(`🔄 Cache invalidated for year ${year}`);
    } catch (cacheError) {
      console.error("⚠️ Cache invalidation failed (non-critical):", cacheError);
    }

    return NextResponse.json({
      success: true,
      message: `Orden ${orden_de_compra} creada exitosamente`,
      data: {
        orden_de_compra,
        items_count: items.length,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("❌ Error creating manual order:", error);

    return NextResponse.json(
      {
        error: "Error al crear la orden",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
