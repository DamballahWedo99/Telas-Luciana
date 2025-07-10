import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

const s3Client = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Demasiadas consultas de archivos. Espera un momento.",
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
        { error: "No autorizado para listar archivos" },
        { status: 403 }
      );
    }

    console.log("🔍 Listando archivos en Inventario/Catalogo_Rollos/");

    const command = new ListObjectsV2Command({
      Bucket: "telas-luciana",
      Prefix: "Inventario/Catalogo_Rollos/",
      Delimiter: "/",
    });

    const response = await s3Client.send(command);
    console.log(
      `📁 Objetos encontrados en S3: ${response.Contents?.length || 0}`
    );

    const files = response.Contents?.filter((item) => {
      const key = item.Key || "";
      const isJson = key.endsWith(".json");
      const isNotBackup = !key.includes("backup");
      const isNotRow = !key.includes("_row");

      console.log(
        `📄 Archivo: ${key}, JSON: ${isJson}, NoBackup: ${isNotBackup}, NoRow: ${isNotRow}`
      );

      return isJson && isNotBackup && isNotRow;
    }).map((item) => ({
      key: item.Key,
      lastModified: item.LastModified,
      size: item.Size,
    }));

    return NextResponse.json({ files: files || [] });
  } catch (error) {
    console.error("Error listando archivos:", error);
    return NextResponse.json(
      { error: "Error al listar archivos del packing list" },
      { status: 500 }
    );
  }
}
