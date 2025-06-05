import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
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

interface SoldRoll {
  roll_number: number;
  fabric_type: string;
  color: string;
  lot: number;
  oc: string;
  almacen: string;
  sold_quantity: number;
  units: string;
  sold_date: string;
  sold_by?: string;
  costo?: number;
  available_for_return: boolean;
  sale_id?: string;
}

async function getSoldRollsFiles(daysBack: number = 30): Promise<string[]> {
  try {
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const monthsToSearch: string[] = [];
    for (let i = 0; i <= 3; i++) {
      const searchDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = searchDate.getFullYear();
      const month = (searchDate.getMonth() + 1).toString().padStart(2, "0");
      monthsToSearch.push(`Inventario/Historial Venta/${year}/${month}/`);
    }

    const allFiles: string[] = [];

    for (const prefix of monthsToSearch) {
      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: prefix,
          MaxKeys: 1000,
        });

        const listResponse = await s3Client.send(listCommand);

        if (listResponse.Contents) {
          const monthFiles = listResponse.Contents.filter(
            (item) =>
              item.Key &&
              item.Key.endsWith(".json") &&
              item.LastModified &&
              item.LastModified >= cutoffDate
          )
            .map((item) => item.Key!)
            .sort((a, b) => b.localeCompare(a));

          allFiles.push(...monthFiles);
        }
      } catch (monthError) {
        console.error(`Error buscando en ${prefix}:`, monthError);
        continue;
      }
    }

    return allFiles;
  } catch (error) {
    console.error("Error buscando archivos de rollos vendidos:", error);
    return [];
  }
}

async function readSoldRollsFile(fileKey: string): Promise<SoldRoll[]> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body?.transformToString();

    if (!bodyString) {
      return [];
    }

    const data = JSON.parse(bodyString);
    const salesRecords = Array.isArray(data) ? data : [data];

    const allRolls: SoldRoll[] = [];

    for (const record of salesRecords) {
      if (record.rolls && Array.isArray(record.rolls)) {
        allRolls.push(...record.rolls);
      }
    }

    return allRolls;
  } catch (error) {
    console.error(`Error leyendo archivo ${fileKey}:`, error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas consultas. Por favor, inténtalo de nuevo más tarde.",
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
        { error: "No autorizado para esta acción" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const oc = searchParams.get("oc");
    const tela = searchParams.get("tela");
    const color = searchParams.get("color");
    const limit = parseInt(searchParams.get("limit") || "100");
    const days = parseInt(searchParams.get("days") || "30");
    const onlyReturnable = searchParams.get("only_returnable") === "true";

    if (limit > 1000) {
      return NextResponse.json(
        { error: "Límite máximo de 1000 registros" },
        { status: 400 }
      );
    }

    if (days > 365) {
      return NextResponse.json(
        { error: "Período máximo de 365 días" },
        { status: 400 }
      );
    }

    const salesFiles = await getSoldRollsFiles(days);

    if (salesFiles.length === 0) {
      return NextResponse.json({
        success: true,
        rolls: [],
        groupedByOC: {},
        summary: {
          totalRolls: 0,
          availableForReturn: 0,
          totalValue: 0,
          orderCounts: 0,
        },
        message:
          "No se encontraron registros de ventas en el período especificado",
      });
    }

    const allSoldRolls: SoldRoll[] = [];

    for (const fileKey of salesFiles) {
      try {
        const rollsFromFile = await readSoldRollsFile(fileKey);
        allSoldRolls.push(...rollsFromFile);
      } catch (fileError) {
        console.error(`Error leyendo ${fileKey}:`, fileError);
        continue;
      }
    }

    let filteredRolls = allSoldRolls;

    if (oc) {
      filteredRolls = filteredRolls.filter((roll) =>
        roll.oc.toLowerCase().includes(oc.toLowerCase())
      );
    }

    if (tela) {
      filteredRolls = filteredRolls.filter((roll) =>
        roll.fabric_type.toLowerCase().includes(tela.toLowerCase())
      );
    }

    if (color) {
      filteredRolls = filteredRolls.filter((roll) =>
        roll.color.toLowerCase().includes(color.toLowerCase())
      );
    }

    if (onlyReturnable) {
      filteredRolls = filteredRolls.filter((roll) => roll.available_for_return);
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    filteredRolls = filteredRolls.filter((roll) => {
      const soldDate = new Date(roll.sold_date);
      return soldDate >= cutoffDate;
    });

    filteredRolls = filteredRolls
      .sort(
        (a, b) =>
          new Date(b.sold_date).getTime() - new Date(a.sold_date).getTime()
      )
      .slice(0, limit);

    const groupedByOC = filteredRolls.reduce((acc, roll) => {
      if (!acc[roll.oc]) {
        acc[roll.oc] = [];
      }
      acc[roll.oc].push(roll);
      return acc;
    }, {} as Record<string, SoldRoll[]>);

    const summary = {
      totalRolls: filteredRolls.length,
      availableForReturn: filteredRolls.filter((r) => r.available_for_return)
        .length,
      totalValue: filteredRolls.reduce(
        (sum, roll) => sum + (roll.costo || 0) * roll.sold_quantity,
        0
      ),
      orderCounts: Object.keys(groupedByOC).length,
      totalInSystem: allSoldRolls.length,
      filesProcessed: salesFiles.length,
    };

    console.log(
      `[GET-SOLD-ROLLS] User ${session.user.email} queried sold rolls:`,
      {
        filters: { oc, tela, color, limit, days, onlyReturnable },
        resultsCount: filteredRolls.length,
      }
    );

    return NextResponse.json({
      success: true,
      rolls: filteredRolls,
      groupedByOC,
      summary,
      filters: { oc, tela, color, limit, days, onlyReturnable },
      source: "S3 Historial Venta",
      filesProcessed: salesFiles.slice(0, 5),
    });
  } catch (error) {
    console.error("Error obteniendo rollos vendidos:", error);
    return NextResponse.json(
      {
        error: "Error al obtener rollos vendidos",
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
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}
