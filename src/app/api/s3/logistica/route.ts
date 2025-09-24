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
  año: number; // NEW: Mandatory year field (2020-2030)
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

// Validation helper functions
function validateYear(year: unknown): number | null {
  const currentYear = new Date().getFullYear();
  const minYear = 2020;
  const maxYear = Math.max(2030, currentYear + 2); // Allow up to 2 years in the future

  if (typeof year !== 'number' || !Number.isInteger(year)) {
    return null;
  }

  if (year < minYear || year > maxYear) {
    return null;
  }

  return year;
}


function validateLogisticsData(data: LogisticsData): { isValid: boolean; error?: string } {
  // Validate orden_de_compra
  if (!data.orden_de_compra?.trim()) {
    return {
      isValid: false,
      error: "La orden de compra es obligatoria"
    };
  }

  // Validate año
  const validatedYear = validateYear(data.año);
  if (validatedYear === null) {
    const currentYear = new Date().getFullYear();
    const maxYear = Math.max(2030, currentYear + 2);
    return {
      isValid: false,
      error: `El año debe ser un número entero entre 2020 y ${maxYear}`
    };
  }

  // Update the year with validated value
  data.año = validatedYear;

  // Validate telas if provided
  if (Array.isArray(data.tela) && data.tela.length > 0) {
    const incompleteTelas = data.tela.filter(
      tela => !tela.tipo_tela?.trim()
    );

    if (incompleteTelas.length > 0) {
      return {
        isValid: false,
        error: "Las telas agregadas deben tener tipo especificado"
      };
    }
  }

  // Validate date consistency if ETA/ETD are provided
  if (data.eta) {
    try {
      const etaDate = new Date(data.eta);
      if (!isNaN(etaDate.getTime())) {
        const etaYear = etaDate.getFullYear();
        if (Math.abs(etaYear - data.año) > 1) {
          console.warn(`⚠️ Year mismatch: año=${data.año}, ETA year=${etaYear} for order ${data.orden_de_compra}`);
        }
      }
    } catch {
      // Invalid date format, but not a blocking error
      console.warn(`⚠️ Invalid ETA date format: ${data.eta} for order ${data.orden_de_compra}`);
    }
  }

  return { isValid: true };
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

    // Validate logistics data
    const validation = validateLogisticsData(logisticsData);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Agregar fecha de registro
    const dataToSave: LogisticsData = {
      ...logisticsData,
      fecha_registro: new Date().toISOString(),
    };

    console.log(`🚛 Creando información logística para orden: ${logisticsData.orden_de_compra} (año: ${logisticsData.año})`);

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


      }
    } catch {
      // El archivo no existe, es la primera vez que se registra información para esta orden
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
    console.log(`   - Año: ${logisticsData.año}`);
    console.log(`   - Contenedor: ${logisticsData.contenedor || 'No especificado'}`);
    console.log(`   - Telas: ${logisticsData.tela?.length || 0}`);

    return NextResponse.json({
      success: true,
      message: "Información logística guardada exitosamente",
      data: {
        orden_de_compra: logisticsData.orden_de_compra,
        año: logisticsData.año,
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
    const año = searchParams.get('año');

    // Parse and validate year filter if provided
    let yearFilter: number | null = null;
    if (año) {
      yearFilter = validateYear(parseInt(año, 10));
      if (yearFilter === null) {
        return NextResponse.json(
          { error: `Año inválido: ${año}. Debe ser un número entre 2020 y 2030` },
          { status: 400 }
        );
      }
    }

    // Si no se especifica una orden de compra, devolver todas las órdenes disponibles
    if (!ordenDeCompra) {

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
            let processedData: LogisticsData;
            if (Array.isArray(logisticsData)) {
              processedData = logisticsData[logisticsData.length - 1];
            } else {
              processedData = logisticsData;
            }

            // Apply year filter if specified - only include records that have año field
            if (yearFilter === null || (typeof processedData.año === 'number' && processedData.año === yearFilter)) {
              allLogisticsData.push(processedData);
            }
          }
        } catch {
          // Continuar con el siguiente archivo si hay error
          continue;
        }
      }


      return NextResponse.json({
        success: true,
        data: allLogisticsData,
        count: allLogisticsData.length,
        filters: {
          año: yearFilter
        }
      });
    }

    // Consulta específica por orden de compra

    const getCommand = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: `logistica/orden_${ordenDeCompra}.json`,
    });

    try {
      const response = await s3Client.send(getCommand);

      if (response.Body) {
        const content = await response.Body.transformToString();
        const logisticsData = JSON.parse(content);

        // Process data and filter by year if specified
        let processedData;
        if (Array.isArray(logisticsData)) {
          // Filter by year if specified - only include records that have año field
          const filteredArray = yearFilter
            ? logisticsData.filter(item => typeof item.año === 'number' && item.año === yearFilter)
            : logisticsData;

          if (filteredArray.length === 0 && yearFilter) {
            return NextResponse.json(
              { error: `No se encontró información logística para la orden ${ordenDeCompra} en el año ${yearFilter}` },
              { status: 404 }
            );
          }

          processedData = filteredArray;
        } else {
          // Filter by year if specified - only include if record has año field
          if (yearFilter && (typeof logisticsData.año !== 'number' || logisticsData.año !== yearFilter)) {
            return NextResponse.json(
              { error: `No se encontró información logística para la orden ${ordenDeCompra} en el año ${yearFilter}` },
              { status: 404 }
            );
          }

          processedData = logisticsData;
        }


        return NextResponse.json({
          success: true,
          data: processedData,
          filters: {
            año: yearFilter
          }
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

    // Validate logistics data
    const validation = validateLogisticsData(logisticsData);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const originalOrderName = logisticsData.original_orden_de_compra || logisticsData.orden_de_compra;
    const isOrderNameChanged = logisticsData.original_orden_de_compra &&
                               logisticsData.original_orden_de_compra !== logisticsData.orden_de_compra;


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


      }
    } catch (error) {
      if (error instanceof Error && error.name === 'NoSuchKey') {
        // Si no existe el archivo, crear uno nuevo (caso de primera actualización)
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
      } catch (deleteError) {
        console.warn(`⚠️ No se pudo eliminar el archivo original: ${originalFilePath}`, deleteError);
        // No fallar la operación por no poder eliminar el archivo anterior
      }
    }


    return NextResponse.json({
      success: true,
      message: "Información logística actualizada exitosamente",
      data: {
        orden_de_compra: logisticsData.orden_de_compra,
        año: logisticsData.año,
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