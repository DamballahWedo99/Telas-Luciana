import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { auth } from "@/auth";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = "telas-luciana";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const isAdmin =
      session.user.role === "admin" || session.user.role === "major_admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    console.log("=== DEBUGGING PENDING FILES ===");

    // Verificar carpeta de inventario actual
    const now = new Date();
    const year = now.getFullYear().toString();
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
    const monthIndex = now.getMonth();
    const monthName = monthNames[monthIndex];
    const inventoryFolder = `Inventario/${year}/${monthName}/`;

    console.log(`Verificando carpeta: ${inventoryFolder}`);

    // Verificar carpeta de Packing Lists
    const packingListFolder = "Inventario/Packing_Lists.xlsx/";
    console.log(`Verificando carpeta: ${packingListFolder}`);

    const results: any = {
      timestamp: new Date().toISOString(),
      folders: {},
      analysis: {},
    };

    // 1. Listar archivos en carpeta de inventario
    try {
      const inventoryCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: inventoryFolder,
      });

      const inventoryResponse = await s3Client.send(inventoryCommand);
      results.folders.inventory = {
        folder: inventoryFolder,
        totalFiles: inventoryResponse.Contents?.length || 0,
        files:
          inventoryResponse.Contents?.map((item) => ({
            key: item.Key,
            size: item.Size,
            lastModified: item.LastModified?.toISOString(),
          })) || [],
      };

      console.log(
        `Archivos en inventario: ${inventoryResponse.Contents?.length || 0}`
      );
    } catch (error: any) {
      results.folders.inventory = { error: error.message };
      console.error("Error listando inventario:", error.message);
    }

    // 2. Listar archivos en carpeta de Packing Lists
    try {
      const packingCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: packingListFolder,
      });

      const packingResponse = await s3Client.send(packingCommand);
      results.folders.packingLists = {
        folder: packingListFolder,
        totalFiles: packingResponse.Contents?.length || 0,
        files:
          packingResponse.Contents?.map((item) => ({
            key: item.Key,
            size: item.Size,
            lastModified: item.LastModified?.toISOString(),
          })) || [],
      };

      console.log(
        `Archivos en Packing Lists: ${packingResponse.Contents?.length || 0}`
      );
    } catch (error: any) {
      results.folders.packingLists = { error: error.message };
      console.error("Error listando Packing Lists:", error.message);
    }

    // 3. Verificar contenido de archivos de inventario recientes
    const inventoryFiles = results.folders.inventory?.files || [];
    const jsonFiles = inventoryFiles.filter(
      (file: any) =>
        file.key.endsWith(".json") && file.key.includes("inventario-row")
    );

    results.analysis.jsonFiles = {
      count: jsonFiles.length,
      files: [],
    };

    console.log(`Archivos JSON de inventario encontrados: ${jsonFiles.length}`);

    // Examinar hasta 5 archivos JSON más recientes
    const recentJsonFiles = jsonFiles
      .sort(
        (a: any, b: any) =>
          new Date(b.lastModified).getTime() -
          new Date(a.lastModified).getTime()
      )
      .slice(0, 5);

    for (const file of recentJsonFiles) {
      try {
        console.log(`Examinando archivo: ${file.key}`);

        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: file.key,
        });

        const fileResponse = await s3Client.send(getCommand);
        if (fileResponse.Body) {
          let content = await fileResponse.Body.transformToString();

          // Fix NaN values
          content = content.replace(/: *NaN/g, ": null");

          const jsonData = JSON.parse(content);

          results.analysis.jsonFiles.files.push({
            key: file.key,
            lastModified: file.lastModified,
            status: jsonData.status || "NO_STATUS",
            data: {
              OC: jsonData.OC,
              Tela: jsonData.Tela,
              Color: jsonData.Color,
              Cantidad: jsonData.Cantidad,
              Unidades: jsonData.Unidades,
              Costo: jsonData.Costo,
              status: jsonData.status,
              upload_id: jsonData.upload_id,
              processed_at: jsonData.processed_at,
            },
          });

          console.log(
            `Archivo ${file.key}: status = ${jsonData.status || "NO_STATUS"}`
          );
        }
      } catch (fileError: any) {
        console.error(`Error procesando ${file.key}:`, fileError.message);
        results.analysis.jsonFiles.files.push({
          key: file.key,
          error: fileError.message,
        });
      }
    }

    // 4. Buscar archivos con status pending específicamente
    const pendingFiles = results.analysis.jsonFiles.files.filter(
      (file: any) => file.status === "pending"
    );

    results.analysis.pendingFiles = {
      count: pendingFiles.length,
      files: pendingFiles,
    };

    // 5. Verificar si Lambda se ejecutó
    const excelFiles =
      results.folders.packingLists?.files?.filter(
        (file: any) => file.key.endsWith(".xlsx") || file.key.endsWith(".xls")
      ) || [];

    results.analysis.lambdaExecution = {
      excelFilesFound: excelFiles.length,
      latestExcelFile:
        excelFiles.length > 0 ? excelFiles[excelFiles.length - 1] : null,
      inventoryFilesCreated: jsonFiles.length,
      pendingFilesFound: pendingFiles.length,
    };

    // Diagnóstico
    let diagnosis = "";
    let recommendation = "";

    if (excelFiles.length === 0) {
      diagnosis =
        "No se encontraron archivos Excel en la carpeta de Packing Lists";
      recommendation = "Verificar que el archivo se subió correctamente";
    } else if (jsonFiles.length === 0) {
      diagnosis =
        "Archivo Excel encontrado pero Lambda no generó archivos de inventario";
      recommendation =
        "Verificar que Lambda esté configurado y ejecutándose correctamente";
    } else if (pendingFiles.length === 0) {
      diagnosis =
        "Archivos de inventario encontrados pero ninguno tiene status 'pending'";
      recommendation =
        "Verificar la lógica del Lambda para asignar status 'pending'";
    } else {
      diagnosis = `Todo parece correcto: ${pendingFiles.length} archivos con status pending encontrados`;
      recommendation = "La API check-pending debería detectar estos archivos";
    }

    results.diagnosis = diagnosis;
    results.recommendation = recommendation;

    console.log("=== DIAGNOSIS ===");
    console.log(diagnosis);
    console.log(recommendation);
    console.log("================");

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error en debug:", error);
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
