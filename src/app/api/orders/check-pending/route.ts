import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { cacheRedis as redis } from "@/lib/redis";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = "telas-luciana";
const ORDERS_JSON_PATH = "Pedidos/json/";

interface OrderItem {
  n: number;
  orden_de_compra: string;
  proveedor: string | null;
  referencia: string | null;
  nombre: string | null;
  composicion: string | null;
  ancho: number | null;
  rendimiento: number | null;
  peso: number | null;
  oz: number | null;
  estampado: string | null;
  color: string | null;
  metros_orden: number | null;
  kgs_orden: number | null;
  precio_inicial_mxn: number | null;
  precio_inicial_usd: number | null;
  kgs_rollo: number | null;
  numero_rollos: number | null;
  precio_final_usd: number | null;
  precio_final_mxn: number | null;
  transportista: string | null;
  factura_transportista: string | null;
  total_transportista_usd: number | null;
  agente_aduanal: string | null;
  m_factura: string | null;
  total_factura: number | null;
  tipo_de_cambio: number | null;
  venta: number | null;
  alias: string | null;
  costo_sin_impuestos: number | null;
  impuestos: number | null;
  costo_tela: number | null;
  status: string;
}

interface PendingOrder {
  orden_de_compra: string;
  proveedor: string | null;
  total_items: number;
  items: OrderItem[];
  fecha_creacion?: string;
  missing_fields: string[];
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const isAdmin = session.user.role === "admin" || session.user.role === "major_admin";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "No autorizado para ver órdenes pendientes" },
        { status: 403 }
      );
    }

    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";
    const cacheKey = "orders:pending";

    if (!forceRefresh && redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached && typeof cached === 'string') {
          console.log("✅ Órdenes pendientes desde cache");
          return NextResponse.json(JSON.parse(cached));
        }
      } catch (error) {
        console.error("Error obteniendo desde cache:", error);
      }
    }

    console.log("🔍 Buscando órdenes pendientes en S3...");

    // Buscar desde el año actual hacia atrás
    const currentYear = new Date().getFullYear();
    const yearsToCheck = [currentYear, currentYear - 1, currentYear - 2]; // Revisar últimos 3 años
    
    const jsonFiles: Array<{ Key?: string; LastModified?: Date }> = [];
    
    for (const year of yearsToCheck) {
      const yearPrefix = `${ORDERS_JSON_PATH}${year}/`;
      console.log(`🔍 Revisando año ${year} en path: ${yearPrefix}`);
      
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: yearPrefix,
      });

      try {
        const listResponse = await s3Client.send(listCommand);
        
        if (listResponse.Contents && listResponse.Contents.length > 0) {
          const yearJsonFiles = listResponse.Contents.filter(
            (obj) => obj.Key && obj.Key.endsWith(".json") && !obj.Key.includes("status/")
          );
          jsonFiles.push(...yearJsonFiles);
          console.log(`✅ Encontrados ${yearJsonFiles.length} archivos JSON en ${year}`);
        } else {
          console.log(`ℹ️ No se encontraron archivos en ${year}`);
        }
      } catch (error) {
        console.error(`❌ Error buscando en año ${year}:`, error);
      }
    }

    if (jsonFiles.length === 0) {
      const emptyResponse = { pendingOrders: [], totalOrders: 0 };
      if (redis) {
        try {
          await redis.set(cacheKey, JSON.stringify(emptyResponse), { ex: 300 });
        } catch (error) {
          console.error("Error guardando en cache:", error);
        }
      }
      return NextResponse.json(emptyResponse);
    }

    const pendingOrders: PendingOrder[] = [];
    // Solo incluir campos que están realmente en el modal EditOrderModal
    const criticalFields = [
      "proveedor",
      "incoterm", 
      "transportista",
      "agente_aduanal",
      "fecha_pedido",
      "sale_origen", 
      "pago_credito",
      "llega_a_mexico",
      "llega_almacen_proveedor",
      "pedimento",
      "factura_proveedor",
      "reporte_inspeccion",
      "pedimento_tránsito",
      "tipo_de_cambio",
      "venta"
    ];

    for (const file of jsonFiles) {
      if (!file.Key) continue;

      try {
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: file.Key,
        });

        const response = await s3Client.send(getCommand);
        const bodyString = await response.Body?.transformToString();
        
        if (!bodyString) continue;

        const orderData = JSON.parse(bodyString);
        
        // Manejo para estructura de archivos: { orden_de_compra, status, items: [...] }
        if (orderData && typeof orderData === 'object' && !Array.isArray(orderData)) {
          const { orden_de_compra, status: orderStatus, items } = orderData;
          
          
          // Verificar si la orden tiene status pending (únicamente basado en order-level status)
          let isPending = false;
          const missingFields = new Set<string>();
          
          // 1. Verificar status de la orden - SOLO criterio para determinar pending
          if (orderStatus === "pending") {
            isPending = true;
          }
          
          // 2. Detectar campos críticos faltantes para propósitos de display (NO afecta el status pending)
          if (Array.isArray(items) && items.length > 0) {
            items.forEach((item: Record<string, string | number | null | undefined>) => {
              criticalFields.forEach(field => {
                if (item[field] === null || item[field] === undefined) {
                  missingFields.add(field);
                  // REMOVIDO: isPending = true; - Ya no afecta el status pending
                }
              });
            });
            
          }
          
          if (isPending) {
            
            pendingOrders.push({
              orden_de_compra: orden_de_compra || "SIN_OC",
              proveedor: Array.isArray(items) && items.length > 0 ? items[0]?.proveedor || null : null,
              total_items: Array.isArray(items) ? items.length : 0,
              items: Array.isArray(items) ? items : [],
              fecha_creacion: file.LastModified?.toISOString(),
              missing_fields: Array.from(missingFields)
            });
          }
        }
        // Manejo legacy para array de items (si existe)
        else if (Array.isArray(orderData)) {
          
          // SOLO filtrar por status "pending", NO por campos faltantes
          const pendingItems = orderData.filter((item: OrderItem) => item.status === "pending");

          if (pendingItems.length > 0) {
            const groupedByOC = pendingItems.reduce((acc: Record<string, OrderItem[]>, item: OrderItem) => {
              const oc = item.orden_de_compra || "SIN_OC";
              if (!acc[oc]) acc[oc] = [];
              acc[oc].push(item);
              return acc;
            }, {});

            for (const [oc, items] of Object.entries(groupedByOC)) {
              // Detectar campos faltantes para display (NO para determinar pending status)
              const missingFields = new Set<string>();
              (items as OrderItem[]).forEach((item: OrderItem) => {
                criticalFields.forEach(field => {
                  if (item[field as keyof OrderItem] === null || item[field as keyof OrderItem] === undefined) {
                    missingFields.add(field);
                  }
                });
              });

              const itemsArray = items as OrderItem[];
              
              pendingOrders.push({
                orden_de_compra: oc,
                proveedor: itemsArray[0]?.proveedor || null,
                total_items: itemsArray.length,
                items: itemsArray,
                fecha_creacion: file.LastModified?.toISOString(),
                missing_fields: Array.from(missingFields)
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error procesando archivo ${file.Key}:`, error);
      }
    }

    pendingOrders.sort((a, b) => {
      if (a.fecha_creacion && b.fecha_creacion) {
        return new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime();
      }
      return 0;
    });

    const response = {
      pendingOrders,
      totalOrders: pendingOrders.length,
      totalItems: pendingOrders.reduce((sum, order) => sum + order.total_items, 0)
    };

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(response), { ex: 300 });
      } catch (error) {
        console.error("Error guardando en cache:", error);
      }
    }

    console.log(`✅ Encontradas ${pendingOrders.length} órdenes pendientes`);
    console.log(`📊 Total archivos JSON procesados: ${jsonFiles.length}`);
    
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error obteniendo órdenes pendientes:", error);
    return NextResponse.json(
      { 
        error: "Error al obtener órdenes pendientes",
        details: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}