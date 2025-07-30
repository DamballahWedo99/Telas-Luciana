import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, _Object } from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

interface TelaLogistic {
  tipo_tela: string;
}

interface LogisticsData {
  orden_de_compra: string;
  tela: TelaLogistic[];
  contenedor: string;
  etd: string; // Estimated Time of Departure
  eta: string; // Estimated Time of Arrival
  importador: string;
  notas: string;
  fecha_registro?: string; // Cuando se registró la información
  fecha_actualizacion?: string; // Cuando se actualizó por última vez
  original_orden_de_compra?: string; // Para manejar cambios de nombre en actualizaciones
}

async function createLogisticsData(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, {
    type: "api",
    message: "Demasiadas solicitudes de logística. Por favor, inténtalo de nuevo más tarde.",
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
      { error: "No tienes permisos para gestionar información logística" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const logisticsData: LogisticsData = body;

    // Validar datos requeridos
    if (!logisticsData.orden_de_compra?.trim()) {
      return NextResponse.json(
        { error: "La orden de compra es obligatoria" },
        { status: 400 }
      );
    }

    // Solo validar telas si se envían (no es obligatorio)
    if (Array.isArray(logisticsData.tela) && logisticsData.tela.length > 0) {
      const incompleteTelas = logisticsData.tela.filter(
        tela => !tela.tipo_tela?.trim()
      );

      if (incompleteTelas.length > 0) {
        return NextResponse.json(
          { error: "Las telas agregadas deben tener tipo especificado" },
          { status: 400 }
        );
      }
    }

    // Agregar fecha de registro
    const dataToSave: LogisticsData = {
      ...logisticsData,
      fecha_registro: new Date().toISOString(),
    };

    console.log(`🚛 Creando información logística para orden: ${logisticsData.orden_de_compra}`);

    // Verificar si ya existe información logística para esta orden
    let existingData: LogisticsData[] = [];
    const consolidatedPath = `logistica/orden_${logisticsData.orden_de_compra}.json`;
    
    try {
      const getCommand = new GetObjectCommand({
        Bucket: "telas-luciana",
        Key: consolidatedPath,
      });
      
      const existingResponse = await s3Client.send(getCommand);
      if (existingResponse.Body) {
        const existingContent = await existingResponse.Body.transformToString();
        const parsed = JSON.parse(existingContent);
        existingData = Array.isArray(parsed) ? parsed : [parsed];
        console.log(`📋 Encontrada información logística existente para ${logisticsData.orden_de_compra}`);
      }
    } catch {
      // El archivo no existe, es la primera vez que se registra información para esta orden
      console.log(`📋 Primera información logística para orden: ${logisticsData.orden_de_compra}`);
    }

    // Agregar nueva información al historial
    const updatedData = [...existingData, dataToSave];

    // Guardar solo archivo consolidado por orden
    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: consolidatedPath,
      Body: JSON.stringify(updatedData, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(putCommand);

    console.log(`✅ Información logística guardada exitosamente:`);
    console.log(`   - Archivo: ${consolidatedPath}`);
    console.log(`   - Orden: ${logisticsData.orden_de_compra}`);
    console.log(`   - Contenedor: ${logisticsData.contenedor || 'No especificado'}`);
    console.log(`   - Telas: ${logisticsData.tela?.length || 0}`);

    return NextResponse.json({
      success: true,
      message: "Información logística guardada exitosamente",
      data: {
        orden_de_compra: logisticsData.orden_de_compra,
        contenedor: logisticsData.contenedor || null,
        telas_count: logisticsData.tela?.length || 0,
        archivo_guardado: consolidatedPath,
      },
    });
  } catch (error) {
    console.error("❌ Error guardando información logística:", error);
    return NextResponse.json(
      { 
        error: "Error interno del servidor al guardar información logística",
        details: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}

async function getLogisticsData(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, {
    type: "api",
    message: "Demasiadas solicitudes de consulta logística. Por favor, inténtalo de nuevo más tarde.",
  });

  if (rateLimitResult) {
    return rateLimitResult;
  }

  const session = await auth();

  if (!session || !session.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const ordenDeCompra = searchParams.get('orden_de_compra');

    // Si no se especifica una orden de compra, devolver todas las órdenes disponibles
    if (!ordenDeCompra) {
      console.log(`🔍 Consultando todas las órdenes logísticas disponibles`);
      
      const listCommand = new ListObjectsV2Command({
        Bucket: "telas-luciana",
        Prefix: "logistica/orden_",
      });

      const listResponse = await s3Client.send(listCommand);
      const logisticsFiles = (listResponse.Contents || [])
        .filter((item: _Object) => item.Key && item.Key.endsWith(".json"))
        .map((item: _Object) => item.Key!);

      const allLogisticsData: LogisticsData[] = [];

      for (const fileKey of logisticsFiles) {
        try {
          const getCommand = new GetObjectCommand({
            Bucket: "telas-luciana",
            Key: fileKey,
          });

          const fileResponse = await s3Client.send(getCommand);
          
          if (fileResponse.Body) {
            const content = await fileResponse.Body.transformToString();
            const logisticsData = JSON.parse(content);
            
            // Si es un array, tomar el último elemento (más reciente)
            const latestData = Array.isArray(logisticsData) 
              ? logisticsData[logisticsData.length - 1]
              : logisticsData;
            
            allLogisticsData.push(latestData);
          }
        } catch {
          // Continuar con el siguiente archivo si hay error
          continue;
        }
      }

      console.log(`✅ Encontradas ${allLogisticsData.length} órdenes logísticas`);

      return NextResponse.json({
        success: true,
        data: allLogisticsData,
        count: allLogisticsData.length,
      });
    }

    // Consulta específica por orden de compra
    console.log(`🔍 Consultando información logística para orden: ${ordenDeCompra}`);

    const getCommand = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: `logistica/orden_${ordenDeCompra}.json`,
    });

    try {
      const response = await s3Client.send(getCommand);
      
      if (response.Body) {
        const content = await response.Body.transformToString();
        const logisticsData = JSON.parse(content);

        console.log(`✅ Información logística encontrada para orden: ${ordenDeCompra}`);

        return NextResponse.json({
          success: true,
          data: logisticsData,
        });
      }
    } catch (getError) {
      if (getError instanceof Error && getError.name === 'NoSuchKey') {
        return NextResponse.json(
          { error: "No se encontró información logística para esta orden de compra" },
          { status: 404 }
        );
      }
      throw getError;
    }

    return NextResponse.json(
      { error: "No se pudo obtener la información logística" },
      { status: 500 }
    );
  } catch (error) {
    console.error("❌ Error consultando información logística:", error);
    return NextResponse.json(
      { 
        error: "Error interno del servidor al consultar información logística",
        details: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}

async function deleteLogisticsData(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, {
    type: "api",
    message: "Demasiadas solicitudes de eliminación logística. Por favor, inténtalo de nuevo más tarde.",
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
      { error: "No tienes permisos para eliminar información logística" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const ordenDeCompra = searchParams.get('orden_de_compra');

    if (!ordenDeCompra?.trim()) {
      return NextResponse.json(
        { error: "La orden de compra es obligatoria para eliminar" },
        { status: 400 }
      );
    }

    console.log(`🗑️ Eliminando información logística para orden: ${ordenDeCompra}`);

    const filePath = `logistica/orden_${ordenDeCompra}.json`;

    // Verificar si el archivo existe antes de eliminar
    try {
      await s3Client.send(new GetObjectCommand({
        Bucket: "telas-luciana",
        Key: filePath,
      }));
    } catch (error) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return NextResponse.json(
          { error: "No se encontró información logística para esta orden de compra" },
          { status: 404 }
        );
      }
      throw error;
    }

    // Eliminar el archivo
    const deleteCommand = new DeleteObjectCommand({
      Bucket: "telas-luciana",
      Key: filePath,
    });

    await s3Client.send(deleteCommand);

    console.log(`✅ Información logística eliminada exitosamente:`);
    console.log(`   - Archivo eliminado: ${filePath}`);
    console.log(`   - Orden: ${ordenDeCompra}`);

    return NextResponse.json({
      success: true,
      message: "Información logística eliminada exitosamente",
      data: {
        orden_de_compra: ordenDeCompra,
        archivo_eliminado: filePath,
      },
    });
  } catch (error) {
    console.error("❌ Error eliminando información logística:", error);
    return NextResponse.json(
      { 
        error: "Error interno del servidor al eliminar información logística",
        details: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}

async function updateLogisticsData(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, {
    type: "api",
    message: "Demasiadas solicitudes de actualización logística. Por favor, inténtalo de nuevo más tarde.",
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
      { error: "No tienes permisos para actualizar información logística" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const logisticsData: LogisticsData = body;

    // Validar datos requeridos
    if (!logisticsData.orden_de_compra?.trim()) {
      return NextResponse.json(
        { error: "La orden de compra es obligatoria" },
        { status: 400 }
      );
    }

    // Solo validar telas si se envían (no es obligatorio)
    if (Array.isArray(logisticsData.tela) && logisticsData.tela.length > 0) {
      const incompleteTelas = logisticsData.tela.filter(
        tela => !tela.tipo_tela?.trim()
      );

      if (incompleteTelas.length > 0) {
        return NextResponse.json(
          { error: "Las telas agregadas deben tener tipo especificado" },
          { status: 400 }
        );
      }
    }

    const originalOrderName = logisticsData.original_orden_de_compra || logisticsData.orden_de_compra;
    const isOrderNameChanged = logisticsData.original_orden_de_compra && 
                               logisticsData.original_orden_de_compra !== logisticsData.orden_de_compra;

    console.log(`✏️ Actualizando información logística para orden: ${logisticsData.orden_de_compra}`);
    if (isOrderNameChanged) {
      console.log(`📝 Detectado cambio de nombre: "${originalOrderName}" → "${logisticsData.orden_de_compra}"`);
    }

    const originalFilePath = `logistica/orden_${originalOrderName}.json`;
    const newFilePath = `logistica/orden_${logisticsData.orden_de_compra}.json`;

    // Verificar si existe información logística existente (usando el nombre original)
    let existingData: LogisticsData[] = [];
    
    try {
      const getCommand = new GetObjectCommand({
        Bucket: "telas-luciana",
        Key: originalFilePath,
      });
      
      const existingResponse = await s3Client.send(getCommand);
      if (existingResponse.Body) {
        const existingContent = await existingResponse.Body.transformToString();
        const parsed = JSON.parse(existingContent);
        existingData = Array.isArray(parsed) ? parsed : [parsed];
        console.log(`📋 Encontrada información logística existente para ${originalOrderName}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        // Si no existe el archivo, crear uno nuevo (caso de primera actualización)
        console.log(`📋 No se encontró archivo existente, creando nuevo para ${logisticsData.orden_de_compra}`);
        existingData = [];
      } else {
        throw error;
      }
    }

    // Modificar directamente la información más reciente
    const dataToSave: LogisticsData = {
      ...logisticsData,
      fecha_registro: existingData.length > 0 
        ? existingData[existingData.length - 1]?.fecha_registro || new Date().toISOString()
        : new Date().toISOString(),
      fecha_actualizacion: new Date().toISOString(),
    };

    // Remover el campo auxiliar antes de guardar
    delete dataToSave.original_orden_de_compra;

    // Si hay datos existentes, reemplazar el último elemento; si no, crear nuevo array
    const updatedData = existingData.length > 0 
      ? [...existingData.slice(0, -1), dataToSave]
      : [dataToSave];

    // Guardar archivo actualizado (usar el nuevo nombre si cambió)
    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: newFilePath,
      Body: JSON.stringify(updatedData, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(putCommand);

    // Si el nombre cambió, eliminar el archivo original
    if (isOrderNameChanged && originalFilePath !== newFilePath) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: "telas-luciana",
          Key: originalFilePath,
        });
        await s3Client.send(deleteCommand);
        console.log(`🗑️ Archivo original eliminado: ${originalFilePath}`);
      } catch (deleteError) {
        console.warn(`⚠️ No se pudo eliminar el archivo original: ${originalFilePath}`, deleteError);
        // No fallar la operación por no poder eliminar el archivo anterior
      }
    }

    console.log(`✅ Información logística actualizada exitosamente:`);
    console.log(`   - Archivo: ${newFilePath}`);
    console.log(`   - Orden: ${logisticsData.orden_de_compra}`);
    console.log(`   - Contenedor: ${logisticsData.contenedor || 'No especificado'}`);
    console.log(`   - Telas: ${logisticsData.tela?.length || 0}`);
    if (isOrderNameChanged) {
      console.log(`   - Nombre anterior: ${originalOrderName}`);
    }

    return NextResponse.json({
      success: true,
      message: "Información logística actualizada exitosamente",
      data: {
        orden_de_compra: logisticsData.orden_de_compra,
        contenedor: logisticsData.contenedor || null,
        telas_count: logisticsData.tela?.length || 0,
        archivo_guardado: newFilePath,
        nombre_cambiado: isOrderNameChanged,
      },
    });
  } catch (error) {
    console.error("❌ Error actualizando información logística:", error);
    return NextResponse.json(
      { 
        error: "Error interno del servidor al actualizar información logística",
        details: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}

export { createLogisticsData as POST, getLogisticsData as GET, deleteLogisticsData as DELETE, updateLogisticsData as PUT };