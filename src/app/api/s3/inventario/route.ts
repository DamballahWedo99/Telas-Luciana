import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year =
      searchParams.get("year") || new Date().getFullYear().toString();
    const month = searchParams.get("month");

    let filePath = "Inventario";

    if (year) {
      filePath += `/${year}`;

      if (month) {
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

        const monthIndex = parseInt(month) - 1;
        const monthName = monthNames[monthIndex];

        filePath += `/${monthName}/${monthName}-inventario.csv`;
      } else {
        filePath += "/Marzo/Marzo-inventario.csv";
      }
    } else {
      filePath += "/2025/Marzo/Marzo-inventario.csv";
    }

    console.log(`Intentando cargar archivo desde: ${filePath}`);

    const command = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: filePath,
    });

    const response = await s3Client.send(command);

    if (response.Body) {
      const csvContent = await response.Body.transformToString();
      return NextResponse.json({ data: csvContent });
    }

    return NextResponse.json(
      { error: "No se pudo leer el archivo del bucket S3" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Error al obtener archivo de S3:", error);
    return NextResponse.json(
      { error: "Error al obtener archivo de S3" },
      { status: 500 }
    );
  }
}
