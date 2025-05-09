import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function getFileFromS3(
  bucket: string,
  key: string
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (response.Body) {
      return await response.Body.transformToString();
    }

    throw new Error("No se pudo leer el archivo del bucket S3");
  } catch (error) {
    console.error("Error al obtener archivo de S3:", error);
    throw error;
  }
}

// Nueva función para listar objetos en un prefijo de S3
export async function listFilesFromS3(
  bucket: string,
  prefix: string
): Promise<string[]> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);

    if (response.Contents) {
      return response.Contents.map((item) => item.Key || "").filter((key) =>
        key.endsWith(".json")
      );
    }

    return [];
  } catch (error) {
    console.error("Error al listar archivos de S3:", error);
    throw error;
  }
}

// Función actualizada para manejar archivos JSON
export async function getInventarioCsv(
  year?: string,
  month?: string
): Promise<string> {
  try {
    let url = "/api/s3/inventario";
    const params = new URLSearchParams();

    if (year) {
      params.append("year", year);
    }

    if (month) {
      params.append("month", month);
    }

    // Indicar que ahora queremos cargar desde JSON
    params.append("format", "json");

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Error al obtener inventario");
    }

    const data = await response.json();

    // Convertimos el JSON a CSV para mantener la compatibilidad con el código existente
    const csvHeader =
      "OC,Tela,Color,Costo,Cantidad,Unidades,Total,Ubicacion,Importacion,FacturaDragonAzteca\n";
    const csvRows = data.data
      .map((item: any) => {
        return `${item.OC || ""},${item.Tela || ""},${item.Color || ""},${
          item.Costo || 0
        },${item.Cantidad || 0},${item.Unidades || ""},${item.Total || 0},${
          item.Ubicacion || ""
        },${item.Importacion || ""},${item.FacturaDragonAzteca || ""}`;
      })
      .join("\n");

    return csvHeader + csvRows;
  } catch (error) {
    console.error("Error al obtener inventario:", error);
    throw error;
  }
}
