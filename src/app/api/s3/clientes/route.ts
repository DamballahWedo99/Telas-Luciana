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

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

interface RawClienteItem {
  empresa?: string;
  contacto?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  vendedor?: string;
  ubicacion?: string;
  comentarios?: string;
  [key: string]: unknown;
}

interface NormalizedClienteItem {
  empresa: string;
  contacto: string;
  direccion: string;
  telefono: string;
  email: string;
  vendedor: string;
  ubicacion: string;
  comentarios: string;
  fileKey?: string;
}

const fixInvalidJSON = (content: string): string => {
  return content.replace(/: *NaN/g, ": null");
};

const normalizeClienteItem = (
  item: RawClienteItem,
  fileKey?: string
): NormalizedClienteItem => {
  const normalizedItem = {
    empresa: item.empresa || "",
    contacto: item.contacto || "",
    direccion: item.direccion || "",
    telefono: item.telefono || "",
    email: item.email || "",
    vendedor: item.vendedor || "",
    ubicacion: item.ubicacion || "",
    comentarios: item.comentarios || "",
    ...(fileKey && { fileKey }),
  };

  return normalizedItem;
};

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes al directorio de clientes. Por favor, inténtalo de nuevo más tarde.",
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
        { error: "No tienes permisos para ver el directorio de clientes" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const debug = searchParams.get("debug") === "true";

    const folderPrefix = "Directorio/Main/";

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
            "No se encontraron archivos de clientes JSON en la carpeta Directorio/Main/",
        },
        { status: 404 }
      );
    }

    const filesToProcess = debug ? jsonFiles.slice(0, 5) : jsonFiles;

    const clientesData: NormalizedClienteItem[] = [];
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
                const typedItem = item as RawClienteItem;
                const normalizedItem = normalizeClienteItem(typedItem, fileKey);

                if (
                  normalizedItem.empresa ||
                  normalizedItem.contacto ||
                  normalizedItem.email
                ) {
                  clientesData.push(normalizedItem);
                }
              });
            } else {
              const typedData = jsonData as RawClienteItem;
              const normalizedItem = normalizeClienteItem(typedData, fileKey);

              if (
                normalizedItem.empresa ||
                normalizedItem.contacto ||
                normalizedItem.email
              ) {
                clientesData.push(normalizedItem);
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

    if (clientesData.length > 0) {
      return NextResponse.json({
        data: clientesData,
        failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
        debug: {
          totalProcessedItems: clientesData.length,
          filesProcessed: filesToProcess.length,
          searchedIn: folderPrefix,
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
  } catch (error) {
    console.error("Error al obtener archivo de S3:", error);
    return NextResponse.json(
      { error: "Error al obtener archivo de S3" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes para crear clientes. Por favor, inténtalo de nuevo más tarde.",
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
        { error: "No tienes permisos para crear clientes" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      empresa,
      contacto,
      direccion,
      telefono,
      email,
      ubicacion,
      comentarios,
    } = body;

    let { vendedor } = body;

    if (!empresa || !email) {
      return NextResponse.json(
        {
          error: "Faltan campos requeridos: empresa y email son obligatorios",
        },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error: "El formato del email no es válido",
        },
        { status: 400 }
      );
    }

    if (userRole === "seller" && !vendedor) {
      const userName = session.user.name;
      vendedor = userName || "TTL";
    }

    if (["admin", "major_admin"].includes(userRole) && !vendedor) {
      vendedor = "TTL";
    }

    const newCliente: NormalizedClienteItem = {
      empresa: empresa.trim(),
      contacto: contacto?.trim() || "",
      direccion: direccion?.trim() || "",
      telefono: telefono?.trim() || "",
      email: email.trim(),
      vendedor: vendedor?.trim() || "",
      ubicacion: ubicacion?.trim() || "",
      comentarios: comentarios?.trim() || "",
    };

    let vendedorSubfolder = "";
    if (vendedor && vendedor.trim()) {
      vendedorSubfolder = `${vendedor.trim()}/`;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const empresaSlug = empresa
      .replace(/\s+/g, "_")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    const fileName = `cliente_${empresaSlug}_${timestamp}.json`;
    const fileKey = `Directorio/Main/${vendedorSubfolder}${fileName}`;

    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
      Body: JSON.stringify(newCliente, null, 2),
      ContentType: "application/json",
      Metadata: {
        vendedor: vendedor?.trim() || "sin_vendedor",
        created_by: session.user.email || "unknown",
        created_at: new Date().toISOString(),
      },
    });

    await s3Client.send(putCommand);

    return NextResponse.json({
      message: "Cliente creado exitosamente",
      data: {
        cliente: newCliente,
        fileKey,
        fileName,
        vendedorSubfolder: vendedorSubfolder || "Main",
        fullPath: `s3://telas-luciana/${fileKey}`,
      },
    });
  } catch (error) {
    console.error("Error al crear cliente en S3:", error);
    return NextResponse.json(
      { error: "Error al crear cliente en S3" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes para actualizar clientes. Por favor, inténtalo de nuevo más tarde.",
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
        { error: "No tienes permisos para actualizar clientes" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      empresa,
      contacto,
      direccion,
      telefono,
      email,
      vendedor,
      ubicacion,
      comentarios,
      fileKey,
    } = body;

    if (!empresa || !email || !fileKey) {
      return NextResponse.json(
        {
          error:
            "Faltan campos requeridos: empresa, email y fileKey son obligatorios",
        },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error: "El formato del email no es válido",
        },
        { status: 400 }
      );
    }

    const updatedCliente: NormalizedClienteItem = {
      empresa: empresa.trim(),
      contacto: contacto?.trim() || "",
      direccion: direccion?.trim() || "",
      telefono: telefono?.trim() || "",
      email: email.trim(),
      vendedor: vendedor?.trim() || "",
      ubicacion: ubicacion?.trim() || "",
      comentarios: comentarios?.trim() || "",
    };

    let newVendedorSubfolder = "";
    if (vendedor && vendedor.trim()) {
      newVendedorSubfolder = `${vendedor.trim()}/`;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const empresaSlug = empresa
      .replace(/\s+/g, "_")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    const fileName = `cliente_${empresaSlug}_${timestamp}.json`;
    const newFileKey = `Directorio/Main/${newVendedorSubfolder}${fileName}`;

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

    const putCommand = new PutObjectCommand({
      Bucket: "telas-luciana",
      Key: newFileKey,
      Body: JSON.stringify(updatedCliente, null, 2),
      ContentType: "application/json",
      Metadata: {
        vendedor: vendedor?.trim() || "sin_vendedor",
        updated_by: session.user.email || "unknown",
        updated_at: new Date().toISOString(),
      },
    });

    await s3Client.send(putCommand);

    return NextResponse.json({
      message: "Cliente actualizado exitosamente",
      data: {
        cliente: updatedCliente,
        fileKey: newFileKey,
        fileName,
        vendedorSubfolder: newVendedorSubfolder || "Main",
        fullPath: `s3://telas-luciana/${newFileKey}`,
        previousFileKey: fileKey,
      },
    });
  } catch (error) {
    console.error("Error al actualizar cliente en S3:", error);
    return NextResponse.json(
      { error: "Error al actualizar cliente en S3" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes para eliminar clientes. Por favor, inténtalo de nuevo más tarde.",
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
        { error: "No tienes permisos para eliminar clientes" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { fileKey } = body;

    if (!fileKey) {
      return NextResponse.json(
        { error: "fileKey es requerido para eliminar el cliente" },
        { status: 400 }
      );
    }

    const deleteCommand = new DeleteObjectCommand({
      Bucket: "telas-luciana",
      Key: fileKey,
    });

    await s3Client.send(deleteCommand);

    return NextResponse.json({
      message: "Cliente eliminado exitosamente",
      data: {
        fileKey,
        deletedBy: session.user.email || "unknown",
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error al eliminar cliente de S3:", error);
    return NextResponse.json(
      { error: "Error al eliminar cliente de S3" },
      { status: 500 }
    );
  }
}
