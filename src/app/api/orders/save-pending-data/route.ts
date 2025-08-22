import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
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
const ORDERS_PATH = "Pedidos/json/";

interface OrderItem {
  n?: number;
  orden_de_compra?: string;
  proveedor?: string | null;
  referencia?: string | null;
  nombre?: string | null;
  composicion?: string | null;
  ancho?: number | null;
  rendimiento?: number | null;
  peso?: number | null;
  oz?: number | null;
  estampado?: string | null;
  color?: string | null;
  metros_orden?: number | null;
  kgs_orden?: number | null;
  precio_inicial_mxn?: number | null;
  precio_inicial_usd?: number | null;
  kgs_rollo?: number | null;
  numero_rollos?: number | null;
  precio_final_usd?: number | null;
  precio_final_mxn?: number | null;
  transportista?: string | null;
  factura_transportista?: string | null;
  total_transportista_usd?: number | null;
  agente_aduanal?: string | null;
  m_factura?: string | null;
  total_factura?: number | null;
  tipo_de_cambio?: number | null;
  venta?: number | null;
  alias?: string | null;
  costo_sin_impuestos?: number | null;
  impuestos?: number | null;
  costo_tela?: number | null;
  status?: string;
  "pedido_cliente.tipo_tela"?: string;
  "pedido_cliente.color"?: string;
  "pedido_cliente.total_m_pedidos"?: number;
  "pedido_cliente.unidad"?: string;
  precio_m_fob_usd?: number;
  total_x_color_fob_usd?: number;
  fraccion?: string;
  llega_a_mexico?: string | null;
  "llega_a_México"?: string | null;
  total_gastos?: number | null;
  [key: string]: string | number | null | undefined;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const isAdmin = session.user.role === "admin" || session.user.role === "major_admin";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "No autorizado para guardar órdenes" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { orders, orden_de_compra } = body;
    
    console.log('📝 [save-pending-data] Datos recibidos:');
    console.log('📋 Orden de compra:', orden_de_compra);
    console.log('📊 Cantidad de orders:', orders?.length);
    if (orders?.[0]) {
      console.log('🔍 Primer order llega_a_mexico:', orders[0].llega_a_mexico);
      console.log('🔍 Primer order campos importantes:', {
        fecha_pedido: orders[0].fecha_pedido,
        sale_origen: orders[0].sale_origen,
        pago_credito: orders[0].pago_credito,
        llega_a_mexico: orders[0].llega_a_mexico,
        llega_almacen_proveedor: orders[0].llega_almacen_proveedor,
        m_factura: orders[0].m_factura,
        precio_m_fob_usd: orders[0].precio_m_fob_usd,
        venta: orders[0].venta,
        total_gastos: orders[0].total_gastos
      });
    }

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron órdenes para guardar" },
        { status: 400 }
      );
    }

    if (!orden_de_compra) {
      return NextResponse.json(
        { error: "No se proporcionó orden de compra" },
        { status: 400 }
      );
    }

    console.log(`📝 Guardando datos (sin completar) para ${orders.length} items en orden ${orden_de_compra}`);

    // Buscar el archivo JSON existente para esta orden con múltiples patrones de nombre
    const baseFileName = orden_de_compra;
    const possibleFileNames = [
      `${baseFileName}.json`,
      // Convertir espacios a underscores
      `${baseFileName.replace(/\s/g, '_')}.json`,
      // Convertir underscores a espacios
      `${baseFileName.replace(/_/g, ' ')}.json`,
      // Convertir guiones a espacios
      `${baseFileName.replace(/-/g, ' ')}.json`,
      // Mantener original con extensión
      baseFileName.endsWith('.json') ? baseFileName : `${baseFileName}.json`
    ];
    
    console.log(`🔍 Buscando archivo para orden: ${orden_de_compra}`);
    console.log(`📋 Patrones de nombres a buscar:`, possibleFileNames);
    
    // Buscar el archivo en la estructura de años (actual y años anteriores)
    const currentYear = new Date().getFullYear();
    const yearsToCheck = [currentYear, currentYear - 1, currentYear - 2];
    
    let fileKey: string | null = null;
    let response: { Body?: { transformToString: () => Promise<string> } } | null = null;
    
    // Buscar el archivo en los diferentes años y con diferentes nombres
    for (const year of yearsToCheck) {
      console.log(`🔍 Revisando año ${year}...`);
      
      for (const fileName of possibleFileNames) {
        const yearFileKey = `${ORDERS_PATH}${year}/${fileName}`;
        console.log(`🔍 Buscando archivo en: ${yearFileKey}`);
        
        try {
          const getCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: yearFileKey,
          });

          response = await s3Client.send(getCommand);
          fileKey = yearFileKey;
          console.log(`✅ Archivo encontrado en: ${yearFileKey}`);
          break;
        } catch (error: unknown) {
          if (error && typeof error === 'object' && 'name' in error && error.name === 'NoSuchKey') {
            console.log(`❌ Archivo no encontrado: ${yearFileKey}`);
            continue;
          }
          throw error;
        }
      }
      
      if (fileKey && response) {
        break; // Archivo encontrado, salir del bucle de años
      }
    }

    // Si no se encuentra con los patrones básicos, hacer búsqueda más amplia
    if (!fileKey || !response) {
      console.log(`🔍 No se encontró con patrones básicos, realizando búsqueda amplia...`);
      
      for (const year of yearsToCheck) {
        const listCommand = new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: `${ORDERS_PATH}${year}/`,
        });

        try {
          const listResponse = await s3Client.send(listCommand);
          
          if (listResponse.Contents) {
            // Buscar archivos que contengan partes del nombre de la orden
            const baseNameLower = baseFileName.toLowerCase();
            const searchTerms = [
              baseNameLower,
              baseNameLower.replace(/[_\s-]/g, '_'),
              baseNameLower.replace(/[_\s-]/g, ' '),
              baseNameLower.replace(/[_\s-]/g, '-'),
              // También buscar por partes significativas del nombre
              ...baseNameLower.split(/[_\s-]+/).filter((part: string) => part.length > 3)
            ];
            
            console.log(`🔍 Términos de búsqueda amplia: ${searchTerms.join(', ')}`);
            
            for (const file of listResponse.Contents) {
              if (!file.Key?.endsWith('.json')) continue;
              
              const fileName = file.Key.toLowerCase();
              const fileNameOnly = fileName.split('/').pop()?.replace('.json', '') || '';
              
              const matchesAnyTerm = searchTerms.some(term => {
                // Coincidencia exacta
                if (fileName.includes(term) || fileNameOnly === term) return true;
                
                // Coincidencia con normalización de caracteres especiales
                const normalizedTerm = term.replace(/[_\s-]/g, '');
                const normalizedFileName = fileNameOnly.replace(/[_\s-]/g, '');
                if (normalizedFileName === normalizedTerm) return true;
                
                // Coincidencia parcial para términos largos (más de 5 caracteres)
                if (term.length > 5 && (fileName.includes(term) || fileNameOnly.includes(term))) return true;
                
                return false;
              });
              
              if (matchesAnyTerm) {
                console.log(`🎯 Archivo coincidente encontrado: ${file.Key}`);
                
                try {
                  const getCommand = new GetObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: file.Key,
                  });

                  response = await s3Client.send(getCommand);
                  fileKey = file.Key;
                  console.log(`✅ Archivo verificado y cargado: ${fileKey}`);
                  break;
                } catch (error) {
                  console.log(`❌ Error verificando archivo ${file.Key}:`, error);
                  continue;
                }
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error listando archivos en año ${year}:`, error);
          continue;
        }
        
        if (fileKey && response) {
          break; // Archivo encontrado, salir del bucle de años
        }
      }
    }

    if (!fileKey || !response) {
      const allFileNames = possibleFileNames.join(', ');
      console.error(`❌ ARCHIVO NO ENCONTRADO para orden: "${orden_de_compra}"`);
      console.error(`📋 Años verificados: ${yearsToCheck.join(', ')}`);
      console.error(`📝 Patrones de nombres buscados: ${allFileNames}`);
      
      throw new Error(`No se encontró el archivo para la orden "${orden_de_compra}" en ningún año. Se buscaron los siguientes nombres: ${allFileNames}`);
    }

    try {
      const bodyString = await response.Body?.transformToString();
      
      if (!bodyString) {
        throw new Error("No se pudo leer el archivo existente");
      }

      const existingData = JSON.parse(bodyString);
      let updatedData: Record<string, unknown> | OrderItem[];

      // Manejar estructura nueva: {orden_de_compra, status, items}
      if (existingData && typeof existingData === 'object' && !Array.isArray(existingData) && existingData.items) {
        console.log(`📝 Actualizando estructura nueva (objeto con items) - SOLO DATOS`);
        
        // Actualizar los items dentro del objeto
        const updatedItems = existingData.items.map((existingItem: Record<string, unknown>) => {
          // Buscar si este item fue actualizado
          const updatedItem = orders.find((order: Record<string, unknown>) => {
            // Comparar por múltiples campos para identificar el item correcto
            return (
              existingItem["pedido_cliente.tipo_tela"] === order["pedido_cliente.tipo_tela"] &&
              existingItem["pedido_cliente.color"] === order["pedido_cliente.color"]
            );
          });

          if (updatedItem) {
            console.log(`✅ Actualizando datos para item: ${existingItem["pedido_cliente.tipo_tela"]} - ${existingItem["pedido_cliente.color"]}`);
            // Actualizar el item con los nuevos datos pero MANTENER el status original
            const updatedItemData = {
              ...existingItem,
              // Sección Proveedor (solo campos que están en el modal)
              proveedor: updatedItem.proveedor || existingItem.proveedor,
              incoterm: updatedItem.incoterm || existingItem.incoterm,
              
              // Sección Logística y Transporte (solo campos que están en el modal)
              transportista: updatedItem.transportista || existingItem.transportista,
              agente_aduanal: updatedItem.agente_aduanal || existingItem.agente_aduanal,
              
              // Sección Cronograma y Fechas (solo campos que están en el modal)
              fecha_pedido: updatedItem.fecha_pedido || existingItem.fecha_pedido,
              sale_origen: updatedItem.sale_origen || existingItem.sale_origen,
              pago_credito: updatedItem.pago_credito || existingItem.pago_credito,
              llega_a_mexico: updatedItem.llega_a_mexico || existingItem.llega_a_mexico,
              "llega_a_México": updatedItem.llega_a_mexico || existingItem["llega_a_México"],
              llega_almacen_proveedor: updatedItem.llega_almacen_proveedor || existingItem.llega_almacen_proveedor,
              
              // Sección Documentación (solo campos que están en el modal)
              pedimento: updatedItem.pedimento || existingItem.pedimento,
              factura_proveedor: updatedItem.factura_proveedor || existingItem.factura_proveedor,
              reporte_inspeccion: updatedItem.reporte_inspeccion || existingItem.reporte_inspeccion,
              "pedimento_tránsito": updatedItem["pedimento_tránsito"] || existingItem["pedimento_tránsito"],
              
              // Sección Financiera (solo campos que están en el modal)
              tipo_de_cambio: updatedItem.tipo_de_cambio || existingItem.tipo_de_cambio,
              total_gastos: updatedItem.total_gastos || existingItem.total_gastos,
              venta: updatedItem.venta || existingItem.venta,
              
              // Campos de telas (se actualizan por separado en el modal)
              precio_m_fob_usd: updatedItem.precio_m_fob_usd || existingItem.precio_m_fob_usd,
              m_factura: updatedItem.m_factura || existingItem.m_factura,
              
              // NO cambiar el status - mantener el status original
            };

            // Calcular total_factura automáticamente si tenemos precio_m_fob_usd y m_factura
            const finalPrecio = updatedItemData.precio_m_fob_usd || 0;
            const finalMetros = updatedItemData.m_factura || 0;
            if (finalPrecio > 0 && finalMetros > 0) {
              (updatedItemData as unknown as { total_factura: number }).total_factura = Number(finalPrecio) * Number(finalMetros);
              console.log(`💰 [nueva estructura] Calculando total_factura: ${finalPrecio} × ${finalMetros} = ${(updatedItemData as unknown as { total_factura: number }).total_factura}`);
            }

            return updatedItemData;
          }

          return existingItem;
        });

        // Mantener la estructura del objeto pero NO cambiar el status
        updatedData = {
          ...existingData,
          items: updatedItems
          // NO cambiar el status del objeto principal
        };
        
      } 
      // Manejar estructura legacy: array de items
      else if (Array.isArray(existingData)) {
        console.log(`📝 Actualizando estructura legacy (array de items) - SOLO DATOS`);
        
        updatedData = existingData.map((existingItem: OrderItem) => {
          // Buscar si este item fue actualizado
          const updatedItem = orders.find((order: OrderItem) => {
            // Comparar por múltiples campos para identificar el item correcto
            return (
              existingItem.orden_de_compra === order.orden_de_compra &&
              existingItem.nombre === order["pedido_cliente.tipo_tela"] &&
              existingItem.color === order["pedido_cliente.color"]
            );
          });

          if (updatedItem) {
            // Actualizar el item con los nuevos datos pero MANTENER el status original
            const updatedLegacyItem = {
              ...existingItem,
              // Sección Proveedor (solo campos que están en el modal)
              proveedor: updatedItem.proveedor || existingItem.proveedor,
              incoterm: updatedItem.incoterm || existingItem.incoterm,
              
              // Sección Logística y Transporte (solo campos que están en el modal)
              transportista: updatedItem.transportista || existingItem.transportista,
              agente_aduanal: updatedItem.agente_aduanal || existingItem.agente_aduanal,
              
              // Sección Cronograma y Fechas (solo campos que están en el modal)
              fecha_pedido: updatedItem.fecha_pedido || existingItem.fecha_pedido,
              sale_origen: updatedItem.sale_origen || existingItem.sale_origen,
              pago_credito: updatedItem.pago_credito || existingItem.pago_credito,
              llega_a_mexico: updatedItem.llega_a_mexico || existingItem.llega_a_mexico,
              "llega_a_México": updatedItem.llega_a_mexico || existingItem["llega_a_México"],
              llega_almacen_proveedor: updatedItem.llega_almacen_proveedor || existingItem.llega_almacen_proveedor,
              
              // Sección Documentación (solo campos que están en el modal)
              pedimento: updatedItem.pedimento || existingItem.pedimento,
              factura_proveedor: updatedItem.factura_proveedor || existingItem.factura_proveedor,
              reporte_inspeccion: updatedItem.reporte_inspeccion || existingItem.reporte_inspeccion,
              "pedimento_tránsito": updatedItem["pedimento_tránsito"] || existingItem["pedimento_tránsito"],
              
              // Sección Financiera (solo campos que están en el modal)
              tipo_de_cambio: updatedItem.tipo_de_cambio || existingItem.tipo_de_cambio,
              total_gastos: updatedItem.total_gastos || existingItem.total_gastos,
              venta: updatedItem.venta || existingItem.venta,
              
              // Campos de telas (se actualizan por separado en el modal)
              precio_m_fob_usd: updatedItem.precio_m_fob_usd || existingItem.precio_m_fob_usd,
              m_factura: updatedItem.m_factura || existingItem.m_factura,
              
              // NO cambiar el status - mantener el status original
            };

            // Calcular total_factura automáticamente si tenemos precio_m_fob_usd y m_factura
            const finalPrecio = updatedLegacyItem.precio_m_fob_usd || 0;
            const finalMetros = updatedLegacyItem.m_factura || 0;
            if (finalPrecio > 0 && finalMetros > 0) {
              updatedLegacyItem.total_factura = Number(finalPrecio) * Number(finalMetros);
              console.log(`💰 [legacy estructura] Calculando total_factura: ${finalPrecio} × ${finalMetros} = ${updatedLegacyItem.total_factura}`);
            }

            return updatedLegacyItem;
          }

          return existingItem;
        });
      } else {
        throw new Error("Formato de archivo no reconocido");
      }

      // Guardar el archivo actualizado en S3
      const putCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: JSON.stringify(updatedData, null, 2),
        ContentType: "application/json",
      });

      await s3Client.send(putCommand);

      // Limpiar cache para reflejar los cambios
      if (redis) {
        try {
          // Invalidar cache de órdenes pendientes
          await redis.del("orders:pending");
          
          // Invalidar cache inteligentemente basado en el año de la orden
          const { invalidateCacheForOrderYear } = await import("@/lib/cache-middleware");
          
          // Usar el primer order para determinar el año (todos deberían ser del mismo pedido)
          const sampleOrder = orders[0] || {};
          const invalidatedCount = await invalidateCacheForOrderYear(sampleOrder);
          
          console.log(`🎯 Cache invalidado inteligentemente: ${invalidatedCount} entradas eliminadas`);
        } catch (error) {
          console.error("Error limpiando cache:", error);
        }
      }

      console.log(`✅ Datos de orden ${orden_de_compra} guardados exitosamente (sin completar)`);

      return NextResponse.json({
        success: true,
        message: `Datos de orden ${orden_de_compra} guardados exitosamente`,
        updatedItems: orders.length,
        statusChanged: false,
      });

    } catch (error) {
      console.error(`Error procesando archivo ${fileKey}:`, error);
      return NextResponse.json(
        { 
          error: "Error al actualizar los datos de la orden",
          details: error instanceof Error ? error.message : "Error desconocido"
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("Error guardando datos de órdenes pendientes:", error);
    return NextResponse.json(
      { 
        error: "Error al guardar datos de órdenes pendientes",
        details: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}