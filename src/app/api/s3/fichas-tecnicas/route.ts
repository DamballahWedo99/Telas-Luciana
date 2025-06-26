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
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
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
          const headCommand = new HeadObjectCommand({
            Bucket: "telas-luciana",
            Key: obj.Key!,
          });

          const headResponse = await s3Client.send(headCommand);

          console.log(`[FICHAS-DEBUG] File: ${obj.Key}`, {
            metadata: headResponse.Metadata,
            allowedroles: headResponse.Metadata?.allowedroles,
          });

          if (headResponse.Metadata?.allowedroles) {
            allowedRoles = headResponse.Metadata.allowedroles
              .split("-")
              .filter((role) => role.trim() !== "");
            console.log(
              `[FICHAS-DEBUG] Roles from metadata: ${allowedRoles.join(", ")}`
            );
          } else {
            if (obj.Key && obj.Key.includes("_roles_")) {
              const rolesMatch = obj.Key.match(/_roles_([^._]+)/);
              if (rolesMatch && rolesMatch[1]) {
                allowedRoles = rolesMatch[1]
                  .split("-")
                  .filter((role) => role.trim() !== "");
                console.log(
                  `[FICHAS-DEBUG] Roles from filename: ${allowedRoles.join(", ")}`
                );
              }
            } else {
              console.log(
                `[FICHAS-DEBUG] No metadata and no roles in filename for ${obj.Key}, using default: major_admin`
              );
            }
          }
        } catch (error) {
          console.error(
            `[FICHAS-DEBUG] Error getting metadata for ${obj.Key}:`,
            error
          );

          if (obj.Key && obj.Key.includes("_roles_")) {
            const rolesMatch = obj.Key.match(/_roles_([^._]+)/);
            if (rolesMatch && rolesMatch[1]) {
              allowedRoles = rolesMatch[1]
                .split("-")
                .filter((role) => role.trim() !== "");
              console.log(
                `[FICHAS-DEBUG] Fallback roles from filename: ${allowedRoles.join(", ")}`
              );
            }
          }
        }

        if (allowedRoles.length === 0) {
          allowedRoles = ["major_admin"];
          console.log(
            `[FICHAS-DEBUG] Empty roles detected for ${obj.Key}, defaulting to major_admin`
          );
        }

        const cleanName = obj
          .Key!.replace("Inventario/Fichas Tecnicas/", "")
          .replace(".pdf", "")
          .replace(/_roles_[^.]*/, "");

        return {
          key: obj.Key!,
          name: cleanName,
          size: obj.Size || 0,
          lastModified: obj.LastModified?.toISOString() || "",
          allowedRoles,
        };
      })
    );

    const filteredFichas = fichas.filter((ficha) => {
      let canAccess = false;

      if (userRole === "major_admin") {
        canAccess = true;
      } else if (userRole === "admin") {
        canAccess =
          ficha.allowedRoles.includes("admin") ||
          ficha.allowedRoles.includes("major_admin");
      } else if (userRole === "seller") {
        canAccess = ficha.allowedRoles.includes("seller");
      }

      console.log(`[FICHAS-DEBUG] Access check for ${ficha.name}:`, {
        userRole,
        allowedRoles: ficha.allowedRoles,
        canAccess,
      });

      return canAccess;
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
