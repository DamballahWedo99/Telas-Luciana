import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = "telas-luciana";

interface SoldRollData {
  roll_number: number;
  fabric_type: string;
  color: string;
  lot: number;
  oc: string;
  almacen: string;
  sold_quantity: number;
  units: string;
  costo: number;
  sold_date: string;
  sold_by: string;
  customer_info?: string;
  sale_notes?: string;
  available_for_return: boolean;
}

interface SalesRequest {
  rolls: SoldRollData[];
  sale_notes?: string;
  customer_info?: string;
}

function generateSalesFileName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const timestamp = now.getTime();

  return `sale_${year}${month}${day}_${timestamp}.json`;
}

async function findCurrentMonthSalesFile(): Promise<string | null> {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const prefix = `Inventario/Historial Venta/${year}/${month}/`;

    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: 100,
    });

    const listResponse = await s3Client.send(listCommand);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      return null;
    }

    const salesFiles = listResponse.Contents.filter(
      (item) => item.Key && item.Key.endsWith(".json")
    ).sort((a, b) => {
      const timeA = a.LastModified?.getTime() || 0;
      const timeB = b.LastModified?.getTime() || 0;
      return timeB - timeA;
    });

    return salesFiles.length > 0 ? salesFiles[0].Key! : null;
  } catch (error) {
    console.error("Error buscando archivo de ventas del mes:", error);
    return null;
  }
}

async function saveSoldRollsToHistory(
  salesData: SalesRequest,
  soldBy: string
): Promise<string> {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");

    const rollsWithMetadata = salesData.rolls.map((roll) => ({
      ...roll,
      sold_by: soldBy,
      sold_date: now.toISOString(),
      available_for_return: true,
      sale_id: `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }));

    const saleRecord = {
      sale_id: `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: now.toISOString(),
      sold_by: soldBy,
      customer_info: salesData.customer_info || "",
      sale_notes: salesData.sale_notes || "",
      total_rolls: rollsWithMetadata.length,
      total_quantity: rollsWithMetadata.reduce(
        (sum, roll) => sum + roll.sold_quantity,
        0
      ),
      rolls: rollsWithMetadata,
      status: "completed",
    };

    let existingFile = await findCurrentMonthSalesFile();
    let existingData: any[] = [];

    if (existingFile) {
      try {
        console.log(
          `📖 [SAVE-SOLD-ROLLS] Leyendo archivo existente: ${existingFile}`
        );

        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: existingFile,
        });

        const response = await s3Client.send(getCommand);
        const bodyString = await response.Body?.transformToString();

        if (bodyString) {
          const parsed = JSON.parse(bodyString);
          existingData = Array.isArray(parsed) ? parsed : [parsed];
        }
      } catch (readError) {
        console.error(
          "Error leyendo archivo existente, creando uno nuevo:",
          readError
        );
        existingFile = null;
      }
    }

    existingData.push(saleRecord);

    const fileName =
      existingFile ||
      `Inventario/Historial Venta/${year}/${month}/${generateSalesFileName()}`;

    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: JSON.stringify(existingData, null, 2),
      ContentType: "application/json",
      Metadata: {
        "sale-count": existingData.length.toString(),
        "last-updated": now.toISOString(),
        "sold-by": soldBy,
      },
    });

    await s3Client.send(putCommand);

    console.log(`✅ [SAVE-SOLD-ROLLS] Venta guardada en: ${fileName}`);
    console.log(
      `📊 [SAVE-SOLD-ROLLS] Total rollos vendidos: ${rollsWithMetadata.length}`
    );

    return fileName;
  } catch (error) {
    console.error("❌ [SAVE-SOLD-ROLLS] Error:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("🛒 [SAVE-SOLD-ROLLS] === GUARDANDO ROLLOS VENDIDOS ===");

    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas solicitudes de venta. Inténtalo más tarde.",
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
        { error: "No autorizado para realizar ventas" },
        { status: 403 }
      );
    }

    const salesData: SalesRequest = await request.json();

    if (
      !salesData.rolls ||
      !Array.isArray(salesData.rolls) ||
      salesData.rolls.length === 0
    ) {
      return NextResponse.json(
        { error: "Se requiere al menos un rollo para vender" },
        { status: 400 }
      );
    }

    for (const roll of salesData.rolls) {
      if (!roll.roll_number || !roll.fabric_type || !roll.color || !roll.oc) {
        return NextResponse.json(
          { error: "Datos incompletos en uno o más rollos" },
          { status: 400 }
        );
      }

      if (roll.sold_quantity <= 0) {
        return NextResponse.json(
          {
            error: `Cantidad vendida debe ser mayor a 0 para rollo ${roll.roll_number}`,
          },
          { status: 400 }
        );
      }
    }

    console.log(
      `📋 [SAVE-SOLD-ROLLS] Procesando venta de ${salesData.rolls.length} rollos`
    );

    const salesFile = await saveSoldRollsToHistory(
      salesData,
      session.user.email || session.user.name || "unknown"
    );

    const summary = {
      totalRolls: salesData.rolls.length,
      totalQuantity: salesData.rolls.reduce(
        (sum, roll) => sum + roll.sold_quantity,
        0
      ),
      totalValue: salesData.rolls.reduce(
        (sum, roll) => sum + roll.costo * roll.sold_quantity,
        0
      ),
      salesFile,
      orders: [...new Set(salesData.rolls.map((roll) => roll.oc))],
    };

    console.log("🎉 [SAVE-SOLD-ROLLS] Venta completada:", summary);

    return NextResponse.json({
      success: true,
      message: "Rollos vendidos guardados exitosamente en el historial",
      summary,
      salesFile,
    });
  } catch (error) {
    console.error("❌ [SAVE-SOLD-ROLLS] Error general:", error);
    return NextResponse.json(
      {
        error: "Error al guardar rollos vendidos",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}
