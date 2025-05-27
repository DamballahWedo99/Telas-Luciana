import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

// Definir las credenciales de AWS
const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = "telas-luciana";

// Interfaces
interface PendingFabric {
  id: string;
  tela: string;
  color: string;
  cantidad: number;
  unidades: string;
  oc?: string;
  costo: number | null;
  status: string;
  sourceFile?: string;
  sourceFileKey?: string;
}

// Función para preprocesar el JSON con NaN valores
const fixInvalidJSON = (content: string): string => {
  return content.replace(/: *NaN/g, ": null");
};

export async function POST(request: NextRequest) {
  try {
    // Aplicar rate limiting
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message:
        "Demasiadas solicitudes. Por favor, inténtalo de nuevo más tarde.",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Verificar autenticación
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verificar permiso de usuario
    const isAdmin =
      session.user.role === "admin" || session.user.role === "major_admin";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "No autorizado para esta acción" },
        { status: 403 }
      );
    }

    // Obtener datos del cuerpo de la solicitud
    const { fabrics, fileName, uploadId } = (await request.json()) as {
      fabrics: PendingFabric[];
      fileName: string;
      uploadId: string;
    };

    if (!fabrics || !Array.isArray(fabrics) || fabrics.length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron datos válidos de telas" },
        { status: 400 }
      );
    }

    // Verificar que todas las telas tienen costos asignados
    const missingCosts = fabrics.some((fabric) => fabric.costo === null);
    if (missingCosts) {
      return NextResponse.json(
        { error: "Todas las telas deben tener un costo asignado" },
        { status: 400 }
      );
    }

    console.log(`=== PROCESANDO ${fabrics.length} TELAS ===`);
    console.log(`Upload ID: ${uploadId}`);

    // Procesar cada tela individualmente
    const updatedItems: any[] = [];
    const errors: string[] = [];
    let updatedCount = 0;

    for (const fabric of fabrics) {
      try {
        // Usar sourceFileKey si está disponible
        let fileKey = fabric.sourceFileKey;

        if (!fileKey) {
          console.warn(
            `No sourceFileKey para ${fabric.tela} ${fabric.color}, saltando...`
          );
          errors.push(
            `No se encontró la ruta del archivo para: ${fabric.tela} ${fabric.color}`
          );
          continue;
        }

        console.log(`Procesando: ${fabric.tela} ${fabric.color} en ${fileKey}`);

        // Obtener el archivo actual
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
        });

        const fileResponse = await s3Client.send(getCommand);

        if (!fileResponse.Body) {
          errors.push(
            `No se pudo leer el archivo para: ${fabric.tela} ${fabric.color}`
          );
          continue;
        }

        // Leer y parsear el contenido actual
        let fileContent = await fileResponse.Body.transformToString();
        fileContent = fixInvalidJSON(fileContent);
        const itemData = JSON.parse(fileContent);

        console.log(
          `Item actual - Status: ${itemData.status || "NO_STATUS"}, Costo: ${
            itemData.Costo
          }`
        );

        // Verificar que este item puede ser actualizado
        const canUpdate =
          itemData.status !== "successful" ||
          itemData.Costo === null ||
          itemData.Costo === undefined ||
          itemData.Costo === "";

        if (!canUpdate && itemData.status === "successful") {
          console.warn(`Item ya procesado: ${fabric.tela} ${fabric.color}`);
          errors.push(
            `La tela ${fabric.tela} ${fabric.color} ya está procesada`
          );
          continue;
        }

        // Actualizar el item con el costo y cambiar status a successful
        const updatedItem = {
          ...itemData,
          Costo: fabric.costo,
          Total: (fabric.costo || 0) * (itemData.Cantidad || 0),
          status: "successful",
          updatedAt: new Date().toISOString(),
          updatedBy: session.user.email || session.user.name || "",
          processedFromUploadId: uploadId,
        };

        console.log(
          `Actualizando a - Status: successful, Costo: ${fabric.costo}, Total: ${updatedItem.Total}`
        );

        // Guardar el archivo actualizado
        await s3Client.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileKey,
            Body: JSON.stringify(updatedItem, null, 2),
            ContentType: "application/json",
            Metadata: {
              "last-updated": new Date().toISOString(),
              "updated-by": session.user.email || "",
              "upload-id": uploadId,
              status: "successful",
            },
          })
        );

        // Convertir a formato de inventario para el frontend
        const inventoryItem = {
          OC: updatedItem.OC || "",
          Tela: updatedItem.Tela || "",
          Color: updatedItem.Color || "",
          Costo: updatedItem.Costo || 0,
          Cantidad: updatedItem.Cantidad || 0,
          Unidades: updatedItem.Unidades || "MTS",
          Total: updatedItem.Total || 0,
          Ubicacion: updatedItem.Ubicacion || updatedItem.almacen || "",
          Importacion: updatedItem.Importacion || "HOY",
          FacturaDragonAzteca: updatedItem.FacturaDragonAzteca || "",
        };

        updatedItems.push(inventoryItem);
        updatedCount++;

        console.log(
          `✅ Actualizado exitosamente: ${fabric.tela} ${fabric.color}`
        );
      } catch (fileError) {
        console.error(
          `Error procesando tela ${fabric.tela} ${fabric.color}:`,
          fileError
        );
        errors.push(
          `Error procesando ${fabric.tela} ${fabric.color}: ${
            fileError instanceof Error ? fileError.message : "Error desconocido"
          }`
        );
        continue;
      }
    }

    if (updatedCount === 0) {
      return NextResponse.json(
        {
          error: "No se pudieron actualizar ninguna de las telas",
          details: errors,
        },
        { status: 400 }
      );
    }

    // Responder al cliente
    const response = {
      success: true,
      message: `${updatedCount} telas actualizadas correctamente`,
      inventoryItems: updatedItems,
      updatedCount,
      totalRequested: fabrics.length,
      uploadId,
    };

    // Agregar información de errores si los hubo
    if (errors.length > 0) {
      response.message += ` (${errors.length} errores)`;
      (response as any).errors = errors;
    }

    console.log(`=== RESULTADO FINAL ===`);
    console.log(`Total solicitado: ${fabrics.length}`);
    console.log(`Exitosos: ${updatedCount}`);
    console.log(`Errores: ${errors.length}`);
    console.log(`======================`);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error al guardar los costos:", error);
    return NextResponse.json(
      {
        error: "Error al procesar la solicitud",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
