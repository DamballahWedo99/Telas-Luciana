import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  _Object,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { withCache, invalidateCachePattern } from "@/lib/cache-middleware";
import { CACHE_TTL } from "@/lib/redis";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

interface RawProveedorItem {
  Empresa?: string;
  "Nombre de contacto"?: string;
  Teléfono?: string;
  Correo?: string;
  Producto?: string;
  [key: string]: unknown;
}

interface NormalizedProveedorItem {
  Empresa: string;
  "Nombre de contacto": string;
  Teléfono: string;
  Correo: string;
  Producto: string;
  fileKey?: string;
}

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

const fixInvalidJSON = (content: string): string => {
  return content.replace(/: *NaN/g, ": null");
};

const normalizeProveedorItem = (
  item: RawProveedorItem,
  fileKey?: string
): NormalizedProveedorItem => {
  const normalizedItem = {
    Empresa: item.Empresa || "",
    "Nombre de contacto": item["Nombre de contacto"] || "",
    Teléfono: item.Teléfono || "",
    Correo: item.Correo || "",
    Producto: item.Producto || "",
    ...(fileKey && { fileKey }),
  };

  return normalizedItem;
};

async function getProveedoresData(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, {
    type: "api",
    message:
      "Demasiadas solicitudes al directorio de proveedores. Por favor, inténtalo de nuevo más tarde.",
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

    const userRole = session.user.role;
    if (!userRole || !["admin", "major_admin", "seller"].includes(userRole)) {
      return NextResponse.json(
        { error: "No tienes permisos para ver el directorio de proveedores" },
        { status: 403 }
      );
    }
  }

  const { searchParams } = new URL(request.url);
  const debug = searchParams.get("debug") === "true";

  const folderPrefix = "Provedores/json/";

  const listCommand = new ListObjectsV2Command({
    Bucket: "telas-luciana",
    Prefix: folderPrefix,
  });

  const listResponse = await s3Client.send(listCommand);

  const jsonFiles = (listResponse.Contents || [])
    .filter((item: _Object) => item.Key && item.Key.endsWith(".json"))
    .map((item: _Object) => item.Key!);

  if (jsonFiles.length === 0) {
    return NextResponse.json(
      {
        error:
          "No se encontraron archivos de proveedores JSON en la carpeta Provedores/json/",
      },
      { status: 404 }
    );
  }

  const filesToProcess = debug ? jsonFiles.slice(0, 5) : jsonFiles;

  const proveedoresData: NormalizedProveedorItem[] = [];
  const failedFiles: string[] = [];

  for (const fileKey of filesToProcess) {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: "telas-luciana",
        Key: fileKey,
      });

      const fileResponse = await s3Client.send(getCommand);

      if (fileResponse.Body) {
        let fileContent = await fileResponse.Body.transformToString();

        fileContent = fixInvalidJSON(fileContent);

        try {
          const jsonData: unknown = JSON.parse(fileContent);

          if (Array.isArray(jsonData)) {
            jsonData.forEach((item: unknown) => {
              const typedItem = item as RawProveedorItem;
              const normalizedItem = normalizeProveedorItem(typedItem, fileKey);

              if (
                normalizedItem.Empresa ||
                normalizedItem["Nombre de contacto"] ||
                normalizedItem.Correo
              ) {
                proveedoresData.push(normalizedItem);
              }
            });
          } else {
            const typedData = jsonData as RawProveedorItem;
            const normalizedItem = normalizeProveedorItem(typedData, fileKey);

            if (
              normalizedItem.Empresa ||
              normalizedItem["Nombre de contacto"] ||
              normalizedItem.Correo
            ) {
              proveedoresData.push(normalizedItem);
            }
          }
        } catch {
          console.error(`Error al parsear JSON de ${fileKey}`);
          failedFiles.push(fileKey);
        }
      }
    } catch {
      console.error(`Error al obtener archivo ${fileKey}`);
      failedFiles.push(fileKey);
    }
  }

  if (proveedoresData.length > 0) {
    return NextResponse.json({
      data: proveedoresData,
      failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
      debug: {
        totalProcessedItems: proveedoresData.length,
        filesProcessed: filesToProcess.length,
        searchedIn: folderPrefix,
        isInternal,
      },
    });
  } else if (failedFiles.length > 0) {
    return NextResponse.json(
      {
        error: "No se pudo procesar ningún archivo correctamente",
        failedFiles,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: "No se pudo leer el archivo del bucket S3" },
    { status: 500 }
  );
}

const getCachedProveedores = withCache(getProveedoresData, {
  keyPrefix: "api:s3:proveedores",
  ttl: CACHE_TTL.CLIENTES, // Using same TTL as clientes
  skipCache: (req) => {
    const url = new URL(req.url);
    return url.searchParams.get("refresh") === "true";
  },
  onCacheHit: (key) => console.log(`📦 Cache HIT - Proveedores: ${key}`),
  onCacheMiss: (key) => console.log(`💾 Cache MISS - Proveedores: ${key}`),
});

export { getCachedProveedores as GET };

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes para crear proveedores. Por favor, inténtalo de nuevo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!userRole || !["admin", "major_admin", "seller"].includes(userRole)) {
      return NextResponse.json(
        { error: "No tienes permisos para crear proveedores" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      Empresa,
      "Nombre de contacto": nombreContacto,
      Teléfono,
      Correo,
      Producto,
    } = body;

    if (!Empresa || !Correo) {
      return NextResponse.json(
        {
          error: "Faltan campos requeridos: Empresa y Correo son obligatorios",
        },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(Correo)) {
      return NextResponse.json(
        {
          error: "El formato del correo no es válido",
        },
        { status: 400 }
      );
    }

    const newProveedor: NormalizedProveedorItem = {
      Empresa: Empresa.trim(),
      "Nombre de contacto": nombreContacto?.trim() || "",
      Teléfono: Teléfono?.trim() || "",
      Correo: Correo.trim(),
      Producto: Producto?.trim() || "",
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const empresaSlug = Empresa
      .replace(/\s+/g, "_")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    const fileName = `proveedor_${empresaSlug}_${timestamp}.json`;
    const fileKey = `Provedores/json/${fileName}`;

    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
      Body: JSON.stringify(newProveedor, null, 2),
      ContentType: "application/json",
      Metadata: {
        created_by: session.user.email || "unknown",
        created_at: new Date().toISOString(),
      },
    });

    await s3Client.send(putCommand);

    // Invalidar cache de proveedores después de crear
    try {
      const invalidatedCount = await invalidateCachePattern("cache:api:s3:proveedores*");
      console.log(`🗑️ Cache de proveedores invalidado después de crear: ${invalidatedCount} entradas eliminadas`);
    } catch (error) {
      console.error("Error invalidando cache de proveedores:", error);
    }

    return NextResponse.json({
      message: "Proveedor creado exitosamente",
      data: {
        proveedor: newProveedor,
        fileKey,
        fileName,
        fullPath: `s3://telas-luciana/${fileKey}`,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error al crear proveedor en S3:", error);
    return NextResponse.json(
      { error: "Error al crear proveedor en S3", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes para actualizar proveedores. Por favor, inténtalo de nuevo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!userRole || !["admin", "major_admin", "seller"].includes(userRole)) {
      return NextResponse.json(
        { error: "No tienes permisos para actualizar proveedores" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      Empresa,
      "Nombre de contacto": nombreContacto,
      Teléfono,
      Correo,
      Producto,
      fileKey,
    } = body;

    if (!Empresa || !Correo || !fileKey) {
      return NextResponse.json(
        {
          error:
            "Faltan campos requeridos: Empresa, Correo y fileKey son obligatorios",
        },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(Correo)) {
      return NextResponse.json(
        {
          error: "El formato del correo no es válido",
        },
        { status: 400 }
      );
    }

    const updatedProveedor: NormalizedProveedorItem = {
      Empresa: Empresa.trim(),
      "Nombre de contacto": nombreContacto?.trim() || "",
      Teléfono: Teléfono?.trim() || "",
      Correo: Correo.trim(),
      Producto: Producto?.trim() || "",
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const empresaSlug = Empresa
      .replace(/\s+/g, "_")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    const fileName = `proveedor_${empresaSlug}_${timestamp}.json`;
    const newFileKey = `Provedores/json/${fileName}`;

    // Delete old file
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: "telas-luciana",
          Key: fileKey,
        })
      );
    } catch (error) {
      console.error("Error al eliminar archivo anterior:", error);
    }

    // Create new file
    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: newFileKey,
      Body: JSON.stringify(updatedProveedor, null, 2),
      ContentType: "application/json",
      Metadata: {
        updated_by: session.user.email || "unknown",
        updated_at: new Date().toISOString(),
      },
    });

    await s3Client.send(putCommand);

    // Invalidar cache de proveedores después de actualizar
    try {
      const invalidatedCount = await invalidateCachePattern("cache:api:s3:proveedores*");
      console.log(`🗑️ Cache de proveedores invalidado después de actualizar: ${invalidatedCount} entradas eliminadas`);
    } catch (error) {
      console.error("Error invalidando cache de proveedores:", error);
    }

    return NextResponse.json({
      message: "Proveedor actualizado exitosamente",
      data: {
        proveedor: updatedProveedor,
        fileKey: newFileKey,
        fileName,
        fullPath: `s3://telas-luciana/${newFileKey}`,
        previousFileKey: fileKey,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error al actualizar proveedor en S3:", error);
    return NextResponse.json(
      { error: "Error al actualizar proveedor en S3", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes para eliminar proveedores. Por favor, inténtalo de nuevo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (!userRole || (userRole !== "admin" && userRole !== "major_admin")) {
      return NextResponse.json(
        { error: "No tienes permisos para eliminar proveedores" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { fileKey } = body;

    if (!fileKey) {
      return NextResponse.json(
        { error: "fileKey es requerido para eliminar el proveedor" },
        { status: 400 }
      );
    }

    const deleteCommand = new DeleteObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
    });

    await s3Client.send(deleteCommand);

    // Invalidar cache de proveedores después de eliminar
    try {
      const invalidatedCount = await invalidateCachePattern("cache:api:s3:proveedores*");
      console.log(`🗑️ Cache de proveedores invalidado después de eliminar: ${invalidatedCount} entradas eliminadas`);
    } catch (error) {
      console.error("Error invalidando cache de proveedores:", error);
    }

    return NextResponse.json({
      message: "Proveedor eliminado exitosamente",
      data: {
        fileKey,
        deletedBy: session.user.email || "unknown",
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error al eliminar proveedor de S3:", error);
    return NextResponse.json(
      { error: "Error al eliminar proveedor de S3", details: errorMessage },
      { status: 500 }
    );
  }
}