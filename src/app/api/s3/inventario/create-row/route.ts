import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
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

// === TIPOS ===
interface NewInventoryItem {
  OC: string;
  Tela: string;
  Color: string;
  Ubicacion: string;
  Cantidad: number;
  Costo: number;
  Unidades: "KGS" | "MTS";
  Importacion?: string;
  FacturaDragonAzteca?: string;
}

// === VALIDACIÓN ===
const validateNewItem = (item: any): NewInventoryItem | null => {
  try {
    // Validar campos requeridos
    if (!item.OC || !item.Tela || !item.Color || !item.Ubicacion) {
      return null;
    }

    const cantidad = parseFloat(item.Cantidad);
    const costo = parseFloat(item.Costo);

    if (isNaN(cantidad) || isNaN(costo) || cantidad <= 0 || costo < 0) {
      return null;
    }

    return {
      OC: String(item.OC).trim(),
      Tela: String(item.Tela).trim(),
      Color: String(item.Color).trim(),
      Ubicacion: String(item.Ubicacion).trim(),
      Cantidad: cantidad,
      Costo: costo,
      Unidades: item.Unidades === "MTS" ? "MTS" : "KGS",
      Importacion: item.Importacion ? String(item.Importacion).trim() : "DA",
      FacturaDragonAzteca: item.FacturaDragonAzteca
        ? String(item.FacturaDragonAzteca).trim()
        : undefined,
    };
  } catch (error) {
    return null;
  }
};

// === ENCONTRAR SIGUIENTE NÚMERO DE ROW ===
const getNextRowNumber = async (folderPrefix: string): Promise<number> => {
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: "telas-luciana",
      Prefix: folderPrefix,
    });

    const listResponse = await s3Client.send(listCommand);
    const jsonFiles = (listResponse.Contents || [])
      .filter((item) => item.Key && item.Key.endsWith(".json"))
      .filter((item) => !item.Key!.includes("_backup_"))
      .map((item) => item.Key!)
      .filter((key) => key.includes("inventario-row"));

    // Extraer números de row existentes
    const rowNumbers = jsonFiles
      .map((file) => {
        const match = file.match(/inventario-row(\d+)\.json$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((num) => num > 0);

    // Encontrar el siguiente número disponible
    const maxRow = rowNumbers.length > 0 ? Math.max(...rowNumbers) : 0;
    return maxRow + 1;
  } catch (error) {
    console.error("Error obteniendo siguiente número de row:", error);
    return 1;
  }
};

// === API PRINCIPAL ===
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("🚀 [CREATE-ROW] === CREANDO NUEVA ROW ===");

    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas solicitudes. Inténtalo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Verificar autenticación
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Obtener datos de la solicitud
    const body = await request.json();
    console.log("📋 [CREATE-ROW] Datos recibidos:", body);

    // Validar item
    const validatedItem = validateNewItem(body);
    if (!validatedItem) {
      return NextResponse.json(
        { error: "Datos del item inválidos" },
        { status: 400 }
      );
    }

    // Determinar carpeta de trabajo
    const now = new Date();
    const year = now.getFullYear().toString();
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
    const monthName = monthNames[now.getMonth()];
    const folderPrefix = `Inventario/${year}/${monthName}/`;

    console.log(`📁 [CREATE-ROW] Carpeta: ${folderPrefix}`);

    // Obtener siguiente número de row
    const nextRowNumber = await getNextRowNumber(folderPrefix);
    const fileName = `inventario-row${nextRowNumber
      .toString()
      .padStart(3, "0")}.json`;
    const fileKey = `${folderPrefix}${fileName}`;

    console.log(`📄 [CREATE-ROW] Creando archivo: ${fileKey}`);

    // Crear estructura correcta del item
    const inventoryItem = {
      OC: validatedItem.OC,
      Tela: validatedItem.Tela,
      Color: validatedItem.Color,
      Ubicacion: validatedItem.Ubicacion,
      Cantidad: validatedItem.Cantidad,
      Costo: validatedItem.Costo,
      Total: validatedItem.Cantidad * validatedItem.Costo,
      Unidades: validatedItem.Unidades,
      Importacion: validatedItem.Importacion,
      FacturaDragonAzteca: validatedItem.FacturaDragonAzteca,
      status: "success", // ✅ STATUS SUCCESS COMO SOLICITADO
      createdAt: new Date().toISOString(),
      createdBy: session.user.email,
      lastModified: new Date().toISOString(),
    };

    // Crear array con un solo item (estructura correcta)
    const fileContent = [inventoryItem];

    // Guardar archivo en S3
    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
      Body: JSON.stringify(fileContent, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(putCommand);

    const duration = Date.now() - startTime;
    console.log(`✅ [CREATE-ROW] Row creada exitosamente en ${duration}ms`);
    console.log(`📊 [CREATE-ROW] Detalles:`, {
      archivo: fileKey,
      rowNumber: nextRowNumber,
      item: {
        OC: inventoryItem.OC,
        Tela: inventoryItem.Tela,
        Color: inventoryItem.Color,
        Ubicacion: inventoryItem.Ubicacion,
        Cantidad: inventoryItem.Cantidad,
        Total: inventoryItem.Total,
        status: inventoryItem.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Nueva row de inventario creada exitosamente",
      data: {
        fileName: fileName,
        fileKey: fileKey,
        rowNumber: nextRowNumber,
        item: inventoryItem,
        status: "success",
      },
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [CREATE-ROW] Error después de ${duration}ms:`, error);

    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido",
        duration: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}
