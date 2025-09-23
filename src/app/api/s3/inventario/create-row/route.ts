import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { newRowSchema, type NewRowFormValues } from "@/lib/zod";
import { invalidateAndWarmInventory } from "@/lib/cache-warming";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

interface S3InventoryItem {
  OC: string;
  Tela: string;
  Color: string;
  Costo: number;
  Cantidad: number;
  Unidades: string;
  CDMX: number | string;
  MID: number | string;
  CONPARTEX: number | string;
  Total: number;
  Importación: string;
}

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

    const rowNumbers = jsonFiles
      .map((file) => {
        const match = file.match(/inventario-row(\d+)\.json$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((num) => num > 0);

    const maxRow = rowNumbers.length > 0 ? Math.max(...rowNumbers) : 0;
    return maxRow + 1;
  } catch (error) {
    console.error("Error obteniendo siguiente número de row:", error);
    return 1;
  }
};

const convertToRequiredStructure = (
  validatedData: NewRowFormValues
): S3InventoryItem => {
  const { Ubicacion, Cantidad, Costo, Importacion, ...rest } = validatedData;

  const item: Omit<S3InventoryItem, "CDMX" | "MID" | "CONPARTEX" | "Importación"> & {
    CDMX?: number | string;
    MID?: number | string;
    CONPARTEX?: number | string;
    Importación?: string;
  } = {
    OC: rest.OC,
    Tela: rest.Tela,
    Color: rest.Color,
    Costo: Costo,
    Cantidad: Cantidad,
    Unidades: rest.Unidades,
    Total: Costo * Cantidad,
  };

  if (Ubicacion === "CDMX") {
    item.CDMX = Cantidad;
    item.MID = "Nan";
    item.CONPARTEX = "Nan";
  } else if (Ubicacion === "Mérida") {
    item.CDMX = "Nan";
    item.MID = Cantidad;
    item.CONPARTEX = "Nan";
  } else if (Ubicacion === "CEDIS CONPARTEX") {
    item.CDMX = "Nan";
    item.MID = "Nan";
    item.CONPARTEX = Cantidad;
  } else {
    item.CDMX = "Nan";
    item.MID = "Nan";
    item.CONPARTEX = "Nan";
  }

  if (Importacion && Importacion === "DA") {
    item["Importación"] = "DA";
  } else if (Importacion && Importacion === "HOY") {
    item["Importación"] = "HOY";
  } else {
    item["Importación"] = "Nan";
  }

  return item as S3InventoryItem;
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("🚀 [CREATE-ROW] === CREANDO NUEVA ROW ===");

    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas solicitudes. Inténtalo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const isAdmin =
      session.user.role === "admin" || session.user.role === "major_admin";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "No autorizado para crear inventario" },
        { status: 403 }
      );
    }

    const body = await request.json();
    console.log("📋 [CREATE-ROW] Datos recibidos:", body);

    let validatedData: NewRowFormValues;
    try {
      validatedData = newRowSchema.parse(body);
      console.log("✅ [CREATE-ROW] Datos validados:", validatedData);
    } catch (error: unknown) {
      console.log("❌ [CREATE-ROW] Error de validación:", error);
      const zodError = error as { errors?: unknown; message?: string };
      return NextResponse.json(
        {
          error: "Datos de validación incorrectos",
          details: zodError.errors || zodError.message,
        },
        { status: 400 }
      );
    }

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

    const nextRowNumber = await getNextRowNumber(folderPrefix);
    const fileName = `inventario-row${nextRowNumber
      .toString()
      .padStart(3, "0")}.json`;
    const fileKey = `${folderPrefix}${fileName}`;

    console.log(`📄 [CREATE-ROW] Creando archivo: ${fileKey}`);

    const inventoryItem = convertToRequiredStructure(validatedData);

    console.log("📊 [CREATE-ROW] Estructura final:", inventoryItem);

    const fileContent = [inventoryItem];

    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
      Body: JSON.stringify(fileContent, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(putCommand);

    console.log("🔥 [CREATE-ROW] Invalidando cache e iniciando warming...");
    await invalidateAndWarmInventory();

    const duration = Date.now() - startTime;
    console.log(`✅ [CREATE-ROW] Row creada exitosamente en ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: "Nueva row de inventario creada exitosamente",
      data: {
        fileName: fileName,
        fileKey: fileKey,
        rowNumber: nextRowNumber,
        item: inventoryItem,
      },
      cache: {
        invalidated: true,
        warming: "initiated",
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
