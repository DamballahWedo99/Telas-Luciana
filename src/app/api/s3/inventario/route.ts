import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const command = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: "Inventario/Marzo/Marzo-inventario.csv",
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
