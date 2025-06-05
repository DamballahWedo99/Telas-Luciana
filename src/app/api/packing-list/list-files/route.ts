import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
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

    const command = new ListObjectsV2Command({
      Bucket: "telas-luciana",
      Prefix: "Catalogo_Rollos/",
      Delimiter: "/",
    });

    const response = await s3Client.send(command);

    const files = response.Contents?.filter(
      (item) =>
        item.Key?.endsWith(".json") &&
        item.Key.includes("packing_lists_con_unidades")
    ).map((item) => ({
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
