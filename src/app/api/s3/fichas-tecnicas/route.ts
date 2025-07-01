import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { withCache } from "@/lib/cache-middleware";
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { CACHE_TTL } from "@/lib/redis";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

function isInternalRequest(request: NextRequest): boolean {
  const internalHeaders = [
    request.headers.get("x-internal-request"),
    request.headers.get("X-Internal-Request"),
    request.headers.get("X-INTERNAL-REQUEST"),
  ];

  const hasInternalHeader = internalHeaders.some((header) => header === "true");

  if (!hasInternalHeader) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const internalSecret = process.env.CRON_SECRET;

  if (!internalSecret || !authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.replace("Bearer ", "");
  return token === internalSecret;
}

async function getFichasTecnicasData(request: NextRequest) {
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

    const isInternal = isInternalRequest(request);

    if (!isInternal) {
      const session = await auth();
      if (!session || !session.user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
      }
    }

    const session = await auth();
    const userRole = session?.user?.role || "seller";

    const command = new ListObjectsV2Command({
      Bucket: "telas-luciana",
      Prefix: "Inventario/Fichas Tecnicas/",
    });

    const response = await s3Client.send(command);

    if (!response.Contents) {
      return NextResponse.json({ fichas: [] });
    }

    const pdfFiles = response.Contents.filter(
      (obj) => obj.Key && obj.Key.endsWith(".pdf")
    );

    const fichas = await Promise.all(
      pdfFiles.map(async (obj) => {
        let allowedRoles = ["major_admin"];

        try {
          const headCommand = new HeadObjectCommand({
            Bucket: "telas-luciana",
            Key: obj.Key!,
          });

          const headResponse = await s3Client.send(headCommand);

          if (headResponse.Metadata?.allowedroles) {
            allowedRoles = headResponse.Metadata.allowedroles
              .split("-")
              .filter((role) => role.trim() !== "");
          } else {
            if (obj.Key && obj.Key.includes("_roles_")) {
              const rolesMatch = obj.Key.match(/_roles_([^._]+)/);
              if (rolesMatch && rolesMatch[1]) {
                allowedRoles = rolesMatch[1]
                  .split("-")
                  .filter((role) => role.trim() !== "");
              }
            } else {
              allowedRoles = ["major_admin", "admin", "seller"];
            }
          }
        } catch {
          if (obj.Key && obj.Key.includes("_roles_")) {
            const rolesMatch = obj.Key.match(/_roles_([^._]+)/);
            if (rolesMatch && rolesMatch[1]) {
              allowedRoles = rolesMatch[1]
                .split("-")
                .filter((role) => role.trim() !== "");
            }
          }
        }

        if (allowedRoles.length === 0) {
          allowedRoles = ["major_admin"];
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

    const finalFichas = isInternal
      ? fichas
      : fichas.filter((ficha) => {
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

          return canAccess;
        });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      fichas: finalFichas,
      duration: `${duration}ms`,
      debug: {
        totalFichas: fichas.length,
        filteredFichas: finalFichas.length,
        userRole,
        isInternal,
      },
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

const getCachedFichasTecnicas = withCache(getFichasTecnicasData, {
  keyPrefix: "api:s3:fichas-tecnicas",
  ttl: CACHE_TTL.FICHAS_TECNICAS,
  skipCache: (req) => {
    const url = new URL(req.url);
    return url.searchParams.get("refresh") === "true";
  },
  onCacheHit: (key) => console.log(`📦 Cache HIT - Fichas Técnicas: ${key}`),
  onCacheMiss: (key) => console.log(`💾 Cache MISS - Fichas Técnicas: ${key}`),
});

export { getCachedFichasTecnicas as GET };
