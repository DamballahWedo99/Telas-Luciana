import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes de fichas técnicas. Inténtalo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userRole = session.user.role || "seller";

    const command = new ListObjectsV2Command({
      Bucket: "telas-luciana",
      Prefix: "Inventario/Fichas Tecnicas/",
    });

    const response = await s3Client.send(command);

    if (!response.Contents) {
      return NextResponse.json({ fichas: [] });
    }

    const fichas = await Promise.all(
      response.Contents.filter(
        (obj) => obj.Key && obj.Key.endsWith(".pdf")
      ).map(async (obj) => {
        let allowedRoles = ["major_admin"];

        try {
          if (obj.Key?.includes("_roles_")) {
            const rolesMatch = obj.Key.match(/_roles_([^_]+)/);
            if (rolesMatch) {
              allowedRoles = rolesMatch[1].split("-");
            }
          } else {
            try {
              const headCommand = new HeadObjectCommand({
                Bucket: "telas-luciana",
                Key: obj.Key!,
              });
              const headResponse = await s3Client.send(headCommand);

              if (headResponse.Metadata?.allowedroles) {
                allowedRoles = headResponse.Metadata.allowedroles.split("-");
              }
            } catch {
              console.log(
                `No metadata found for ${obj.Key}, using default roles`
              );
            }
          }
        } catch (error) {
          console.error("Error parsing roles:", error);
        }

        return {
          key: obj.Key!,
          name: obj
            .Key!.replace("Inventario/Fichas Tecnicas/", "")
            .replace(".pdf", "")
            .replace(/_roles_[^.]*/, ""),
          size: obj.Size || 0,
          lastModified: obj.LastModified?.toISOString() || "",
          allowedRoles,
        };
      })
    );

    const filteredFichas = fichas.filter((ficha) => {
      if (userRole === "major_admin") return true;
      if (userRole === "admin")
        return (
          ficha.allowedRoles.includes("admin") ||
          ficha.allowedRoles.includes("major_admin")
        );
      if (userRole === "seller") return ficha.allowedRoles.includes("seller");
      return false;
    });

    const duration = Date.now() - startTime;

    console.log(`[FICHAS-TECNICAS] User ${session.user.email} listed fichas:`, {
      totalFichas: fichas.length,
      filteredFichas: filteredFichas.length,
      userRole,
      duration: `${duration}ms`,
    });

    return NextResponse.json({
      fichas: filteredFichas,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error listing fichas técnicas:", error);

    return NextResponse.json(
      {
        error: "Error al cargar las fichas técnicas",
        duration: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}
