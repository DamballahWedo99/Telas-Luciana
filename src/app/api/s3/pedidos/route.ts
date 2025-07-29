import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  _Object,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { 
  invalidateCacheForOrderYear,
  getCachedHistoricalData, 
  setCachedHistoricalData,
  getCachedCurrentYearData,
  setCachedCurrentYearData
} from "@/lib/cache-middleware";

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

interface NewOrderStructure {
  orden_de_compra: string;
  items: PedidoData[];
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

// ===== YEAR-BASED DATA LOADING FUNCTIONS =====

async function loadHistoricalDataFromS3(): Promise<PedidoData[]> {
  const currentYear = new Date().getFullYear();
  console.log(`📁 Cargando datos históricos consolidados (2015-${currentYear-1}) desde S3 usando estructura de carpetas...`);
  
  // Solo carpetas de años históricos (no incluir archivos base ni año actual)
  const historicalYearFolders: string[] = [];
  for (let year = 2015; year < currentYear; year++) {
    historicalYearFolders.push(`Pedidos/json/${year}/`);
  }
  
  const allHistoricalData: PedidoData[] = [];
  
  for (const folderPrefix of historicalYearFolders) {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: "telas-luciana",
        Prefix: folderPrefix,
      });
      
      const listResponse = await s3Client.send(listCommand);
      const jsonFiles = (listResponse.Contents || [])
        .filter((item: _Object) => item.Key && item.Key.endsWith(".json"))
        .map((item: _Object) => item.Key!);
      
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
            
            const jsonData: unknown = JSON.parse(fileContent);
            let fileData: PedidoData[] = [];
            
            if (Array.isArray(jsonData)) {
              fileData = jsonData as PedidoData[];
            } else {
              const data = jsonData as Record<string, unknown>;
              
              // Verificar si es la nueva estructura con items array
              if (data.orden_de_compra && Array.isArray(data.items)) {
                const newStructure = data as unknown as NewOrderStructure;
                fileData = newStructure.items.map((item: PedidoData) => ({
                  ...item,
                  orden_de_compra: newStructure.orden_de_compra
                }));
              } else {
                fileData = [data as PedidoData];
              }
            }
            
            // Como ya están en carpetas de años históricos, incluir todos
            allHistoricalData.push(...fileData);
          }
        } catch (error) {
          console.error(`❌ Error procesando archivo ${fileKey}:`, error);
        }
      }
    } catch {
      console.log(`📁 Carpeta ${folderPrefix} no existe o está vacía`);
    }
  }
  
  console.log(`📁 Cargados ${allHistoricalData.length} pedidos históricos desde carpetas de años`);
  return allHistoricalData;
}

async function loadCurrentYearDataFromS3(): Promise<PedidoData[]> {
  const currentYear = new Date().getFullYear();
  console.log(`📁 Cargando datos del año actual (${currentYear}) desde S3 usando estructura de carpetas...`);
  
  const currentYearFolders = [
    "Pedidos/json/",  // Archivos base (probablemente del año actual)
    `Pedidos/json/${currentYear}/`,  // Carpeta del año actual específico
  ];
  
  const currentYearData: PedidoData[] = [];
  
  for (const folderPrefix of currentYearFolders) {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: "telas-luciana",
        Prefix: folderPrefix,
        Delimiter: folderPrefix === "Pedidos/json/" ? "/" : undefined // Solo archivos directos en la raíz
      });
      
      const listResponse = await s3Client.send(listCommand);
      const jsonFiles = (listResponse.Contents || [])
        .filter((item: _Object) => {
          if (!item.Key || !item.Key.endsWith(".json")) return false;
          
          // Si estamos en la carpeta base, excluir archivos que están en subcarpetas de años
          if (folderPrefix === "Pedidos/json/") {
            // Solo incluir archivos que NO están en subcarpetas de años (no contienen /año/)
            const pathParts = item.Key.split('/');
            return pathParts.length === 3; // Pedidos/json/archivo.json (no subcarpetas)
          }
          
          return true;
        })
        .map((item: _Object) => item.Key!);
      
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
            
            const jsonData: unknown = JSON.parse(fileContent);
            let fileData: PedidoData[] = [];
            
            if (Array.isArray(jsonData)) {
              fileData = jsonData as PedidoData[];
            } else {
              const data = jsonData as Record<string, unknown>;
              
              // Verificar si es la nueva estructura con items array
              if (data.orden_de_compra && Array.isArray(data.items)) {
                const newStructure = data as unknown as NewOrderStructure;
                fileData = newStructure.items.map((item: PedidoData) => ({
                  ...item,
                  orden_de_compra: newStructure.orden_de_compra
                }));
              } else {
                fileData = [data as PedidoData];
              }
            }
            
            // Si está en carpeta del año actual, incluir todos
            if (folderPrefix === `Pedidos/json/${currentYear}/`) {
              currentYearData.push(...fileData);
            } else {
              // Si está en carpeta base, verificar fecha para asegurar que es del año actual
              const thisYearData = fileData.filter(item => {
                if (!item.fecha_pedido) {
                  // Incluir archivos sin fecha de la carpeta base (asumimos que son actuales)
                  return true;
                }
                
                try {
                  const itemYear = new Date(item.fecha_pedido).getFullYear();
                  return itemYear === currentYear;
                } catch {
                  // Incluir archivos con fecha inválida de la carpeta base
                  return true;
                }
              });
              
              currentYearData.push(...thisYearData);
            }
          }
        } catch (error) {
          console.error(`❌ Error procesando archivo ${fileKey}:`, error);
        }
      }
    } catch {
      console.log(`📁 Carpeta ${folderPrefix} no existe o está vacía`);
    }
  }
  
  console.log(`📁 Cargados ${currentYearData.length} pedidos del año actual desde carpetas`);
  return currentYearData;
}


async function loadAllYearsOptimized(): Promise<PedidoData[]> {
  const currentYear = new Date().getFullYear();
  const allData: PedidoData[] = [];
  
  console.log(`🚀 Iniciando carga optimizada consolidada (${currentYear} actual)`);
  
  // 1. Cargar datos históricos consolidados (2015 hasta año anterior)
  const cachedHistoricalData = await getCachedHistoricalData();
  
  if (cachedHistoricalData) {
    // Desde cache consolidado ⚡
    allData.push(...(cachedHistoricalData as PedidoData[]));
    console.log(`🧊 Datos históricos servidos desde cache consolidado`);
  } else {
    // Desde S3 y luego cachear consolidado 📁
    const historicalData = await loadHistoricalDataFromS3();
    allData.push(...historicalData);
    
    // Congelar en cache consolidado para futuras requests
    await setCachedHistoricalData(historicalData);
  }
  
  // 2. Cargar año actual (puede estar en cache o no)
  const currentYearCached = await getCachedCurrentYearData();
  
  if (currentYearCached) {
    // Desde cache actual ⚡
    allData.push(...(currentYearCached as PedidoData[]));
  } else {
    // Desde S3 y luego cachear 📁
    const currentYearData = await loadCurrentYearDataFromS3();
    allData.push(...currentYearData);
    
    // Cachear año actual con TTL más corto
    await setCachedCurrentYearData(currentYearData);
  }
  
  console.log(`🎯 Cache optimizado completado: ${allData.length} pedidos cargados`);
  
  return allData;
}

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

  console.log("🚀 Obteniendo datos de pedidos con cache optimizado por años");

  try {
    // Usar función optimizada con cache por años
    const pedidosData = await loadAllYearsOptimized();

    if (pedidosData.length > 0) {
      console.log(
        `✅ Pedidos obtenidos exitosamente: ${pedidosData.length} items (cache optimizado por años)`
      );

      return NextResponse.json({
        data: pedidosData,
        debug: {
          totalProcessedItems: pedidosData.length,
          requestType: isInternalRequest ? "internal_cron" : "user_authenticated",
          optimizedCache: true,
          currentYear: new Date().getFullYear(),
        },
      });
    } else {
      return NextResponse.json(
        {
          error: "No se encontraron datos de pedidos",
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("❌ Error en carga optimizada de pedidos:", error);
    return NextResponse.json(
      {
        error: "Error interno del servidor al cargar pedidos",
      },
      { status: 500 }
    );
  }
}

// La función getPedidosData ahora maneja su propio cache optimizado por años
// No necesitamos el middleware withCache tradicional
const getCachedPedidos = getPedidosData;

import { PutObjectCommand } from "@aws-sdk/client-s3";

async function updatePedidoData(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, {
    type: "api",
    message: "Demasiadas solicitudes de actualización. Por favor, inténtalo de nuevo más tarde.",
  });

  if (rateLimitResult) {
    return rateLimitResult;
  }

  const session = await auth();

  if (!session || !session.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const userRole = session.user.role;
  if (!userRole || (userRole !== "admin" && userRole !== "major_admin")) {
    return NextResponse.json(
      { error: "No tienes permisos para editar pedidos" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { updatedOrder, updatedOrders } = body;

    // Manejar tanto formato individual como batch
    const ordersToUpdate = updatedOrders || (updatedOrder ? [updatedOrder] : []);
    
    if (!ordersToUpdate.length || !ordersToUpdate[0]?.orden_de_compra) {
      return NextResponse.json(
        { error: "Datos de pedido inválidos" },
        { status: 400 }
      );
    }

    const orderName = ordersToUpdate[0].orden_de_compra;

    console.log(`🔄 Actualizando pedido: ${orderName} (${ordersToUpdate.length} telas)`);

    // Intentar buscar directamente por nombre de archivo primero
    console.log(`🔍 Buscando archivo directo para ${orderName}...`);
    // Generar rutas dinámicamente priorizando el año actual
    const currentYear = new Date().getFullYear();
    const possibleFilePaths: string[] = [
      // Primero intentar la ruta sin año (más común para archivos nuevos)
      `Pedidos/json/orden_${orderName}.json`,
      // Luego el año actual (más probable para órdenes recientes)
      `Pedidos/json/${currentYear}/orden_${orderName}.json`,
    ];

    // Agregar años anteriores en orden descendente (más recientes primero)
    for (let year = currentYear - 1; year >= 2015; year--) {
      possibleFilePaths.push(`Pedidos/json/${year}/orden_${orderName}.json`);
    }

    console.log(`🔍 Buscando orden ${orderName} en ${possibleFilePaths.length} ubicaciones posibles, priorizando año actual ${currentYear}`);

    let filesUpdated = 0;
    const updatedFiles: string[] = [];
    let foundDirectMatch = false;

    // Intentar encontrar el archivo directamente por nombre (se detiene al encontrar el primero)
    for (const filePath of possibleFilePaths) {
      try {
        console.log(`🔍 Intentando: ${filePath}`);
        const getCommand = new GetObjectCommand({
          Bucket: "telas-luciana",
          Key: filePath,
        });

        const fileResponse = await s3Client.send(getCommand);
        
        if (fileResponse.Body) {
          let fileContent = await fileResponse.Body.transformToString();
          fileContent = fixInvalidJSON(fileContent);

          const jsonData: unknown = JSON.parse(fileContent);
          let fileData: PedidoData[] = [];
          let isNewStructure = false;
          let originalStructure: NewOrderStructure | null = null;

          // Normalizar datos a array y detectar estructura
          if (Array.isArray(jsonData)) {
            fileData = jsonData as PedidoData[];
          } else {
            const data = jsonData as Record<string, unknown>;
            
            // Verificar si es la nueva estructura con items array
            if (data.orden_de_compra && Array.isArray(data.items)) {
              isNewStructure = true;
              originalStructure = data as unknown as NewOrderStructure;
              fileData = originalStructure.items.map((item: PedidoData) => ({
                ...item,
                orden_de_compra: originalStructure!.orden_de_compra
              }));
            } else {
              fileData = [data as PedidoData];
            }
          }

          // Verificar si este archivo contiene alguna de las telas a actualizar
          const hasTargetOrder = fileData.some(item => 
            ordersToUpdate.some((orderToUpdate: PedidoData) =>
              item.orden_de_compra === orderToUpdate.orden_de_compra &&
              item["pedido_cliente.tipo_tela"] === orderToUpdate["pedido_cliente.tipo_tela"] &&
              item["pedido_cliente.color"] === orderToUpdate["pedido_cliente.color"]
            )
          );

          if (hasTargetOrder) {
            // Actualizar todas las telas que coincidan
            const updatedFileData = fileData.map(item => {
              const matchingUpdate = ordersToUpdate.find((orderToUpdate: PedidoData) =>
                item.orden_de_compra === orderToUpdate.orden_de_compra &&
                item["pedido_cliente.tipo_tela"] === orderToUpdate["pedido_cliente.tipo_tela"] &&
                item["pedido_cliente.color"] === orderToUpdate["pedido_cliente.color"]
              );
              
              if (matchingUpdate) {
                return { ...item, ...matchingUpdate };
              }
              return item;
            });

            // Guardar el archivo actualizado respetando la estructura original
            let finalData: NewOrderStructure | PedidoData | PedidoData[];
            
            if (isNewStructure && originalStructure) {
              // Restaurar la nueva estructura con items array
              finalData = {
                orden_de_compra: originalStructure.orden_de_compra,
                items: updatedFileData.map(item => {
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const { orden_de_compra: _, ...itemWithoutOrderId } = item;
                  return itemWithoutOrderId;
                })
              };
            } else {
              // Mantener estructura anterior
              finalData = updatedFileData.length === 1 ? updatedFileData[0] : updatedFileData;
            }
            
            const putCommand = new PutObjectCommand({
              Bucket: "telas-luciana",
              Key: filePath,
              Body: JSON.stringify(finalData, null, 2),
              ContentType: "application/json",
            });

            await s3Client.send(putCommand);
            
            filesUpdated++;
            updatedFiles.push(filePath);
            foundDirectMatch = true;
            console.log(`✅ Archivo actualizado directamente: ${filePath}`);
            break; // Encontramos el archivo, no necesitamos seguir buscando
          }
        }
      } catch (error) {
        // Silenciar completamente los errores NoSuchKey durante búsqueda directa (es esperado)
        if (error instanceof Error && !error.message.includes('NoSuchKey') && !error.message.includes('The specified key does not exist')) {
          console.error(`❌ Error procesando archivo ${filePath}:`, error);
        }
        // Continuar con la siguiente ruta posible
        continue;
      }
    }

    // Si no encontramos el archivo por búsqueda directa, hacer búsqueda exhaustiva como fallback
    if (!foundDirectMatch) {
      console.log(`⚠️ No se encontró archivo directo para ${orderName}, realizando búsqueda exhaustiva...`);
      
      // Obtener lista de archivos JSON en S3
      const folderPrefix = "Pedidos/json/";
      const listCommand = new ListObjectsV2Command({
        Bucket: "telas-luciana",
        Prefix: folderPrefix,
      });

      const listResponse = await s3Client.send(listCommand);
      const jsonFiles = (listResponse.Contents || [])
        .filter((item: _Object) => item.Key && item.Key.endsWith(".json"))
        .map((item: _Object) => item.Key!);

      // Buscar en todos los archivos como fallback
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

            const jsonData: unknown = JSON.parse(fileContent);
            let fileData: PedidoData[] = [];
            let isNewStructure = false;
            let originalStructure: NewOrderStructure | null = null;

            // Normalizar datos a array y detectar estructura
            if (Array.isArray(jsonData)) {
              fileData = jsonData as PedidoData[];
            } else {
              const data = jsonData as Record<string, unknown>;
              
              // Verificar si es la nueva estructura con items array
              if (data.orden_de_compra && Array.isArray(data.items)) {
                isNewStructure = true;
                originalStructure = data as unknown as NewOrderStructure;
                fileData = originalStructure.items.map((item: PedidoData) => ({
                  ...item,
                  orden_de_compra: originalStructure!.orden_de_compra
                }));
              } else {
                fileData = [data as PedidoData];
              }
            }

            // Verificar si este archivo contiene alguna de las telas a actualizar
            const hasTargetOrder = fileData.some(item => 
              ordersToUpdate.some((orderToUpdate: PedidoData) =>
                item.orden_de_compra === orderToUpdate.orden_de_compra &&
                item["pedido_cliente.tipo_tela"] === orderToUpdate["pedido_cliente.tipo_tela"] &&
                item["pedido_cliente.color"] === orderToUpdate["pedido_cliente.color"]
              )
            );

            if (hasTargetOrder) {
              // Actualizar todas las telas que coincidan
              const updatedFileData = fileData.map(item => {
                const matchingUpdate = ordersToUpdate.find((orderToUpdate: PedidoData) =>
                  item.orden_de_compra === orderToUpdate.orden_de_compra &&
                  item["pedido_cliente.tipo_tela"] === orderToUpdate["pedido_cliente.tipo_tela"] &&
                  item["pedido_cliente.color"] === orderToUpdate["pedido_cliente.color"]
                );
                
                if (matchingUpdate) {
                  return { ...item, ...matchingUpdate };
                }
                return item;
              });

              // Guardar el archivo actualizado respetando la estructura original
              let finalData: NewOrderStructure | PedidoData | PedidoData[];
              
              if (isNewStructure && originalStructure) {
                // Restaurar la nueva estructura con items array
                finalData = {
                  orden_de_compra: originalStructure.orden_de_compra,
                  items: updatedFileData.map(item => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { orden_de_compra: _, ...itemWithoutOrderId } = item;
                    return itemWithoutOrderId;
                  })
                };
              } else {
                // Mantener estructura anterior
                finalData = updatedFileData.length === 1 ? updatedFileData[0] : updatedFileData;
              }
              
              const putCommand = new PutObjectCommand({
                Bucket: "telas-luciana",
                Key: fileKey,
                Body: JSON.stringify(finalData, null, 2),
                ContentType: "application/json",
              });

              await s3Client.send(putCommand);
              
              filesUpdated++;
              updatedFiles.push(fileKey);
              console.log(`✅ Archivo actualizado (fallback): ${fileKey}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error procesando archivo ${fileKey}:`, error);
          continue;
        }
      }
    }

    if (filesUpdated === 0) {
      return NextResponse.json(
        { error: "No se encontró el pedido especificado para actualizar" },
        { status: 404 }
      );
    }

    console.log(`✅ Pedido actualizado en ${filesUpdated} archivo(s): ${orderName} (${ordersToUpdate.length} telas)`);

    // Invalidar cache inteligentemente según el año del pedido
    try {
      const invalidatedCount = await invalidateCacheForOrderYear(ordersToUpdate[0]);
      console.log(`🎯 Cache invalidado inteligentemente: ${invalidatedCount} entradas eliminadas`);
    } catch (error) {
      console.error("Error invalidando cache:", error);
    }


    return NextResponse.json({
      success: true,
      message: "Pedido actualizado exitosamente",
      updatedOrders: ordersToUpdate,
      updatedCount: ordersToUpdate.length,
      filesUpdated,
      updatedFiles,
    });
  } catch (error) {
    console.error("❌ Error actualizando pedido:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export { getCachedPedidos as GET, updatePedidoData as PUT };
