import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

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
    return data.data;
  } catch (error) {
    console.error("Error al obtener inventario:", error);
    throw error;
  }
}
