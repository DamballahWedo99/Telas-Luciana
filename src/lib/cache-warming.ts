import { invalidateCachePattern } from "./cache-middleware";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

export class CacheWarming {
  private static getInternalHeaders() {
    return {
      "x-internal-request": "true",
      authorization: `Bearer ${process.env.CRON_SECRET}`,
      "user-agent": "System-Cache-Warming/1.0",
    };
  }

  private static async getExistingInventoryFolders(): Promise<string[]> {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: "telas-luciana",
        Prefix: "Inventario/",
        Delimiter: "/",
      });

      const response = await s3Client.send(listCommand);
      const folders: string[] = [];

      const yearPrefixes = response.CommonPrefixes || [];

      for (const yearPrefix of yearPrefixes) {
        if (!yearPrefix.Prefix) continue;

        const yearListCommand = new ListObjectsV2Command({
          Bucket: "telas-luciana",
          Prefix: yearPrefix.Prefix,
          Delimiter: "/",
        });

        const yearResponse = await s3Client.send(yearListCommand);
        const monthPrefixes = yearResponse.CommonPrefixes || [];

        for (const monthPrefix of monthPrefixes) {
          if (!monthPrefix.Prefix) continue;

          const pathParts = monthPrefix.Prefix.split("/");
          const year = pathParts[1];
          const monthName = pathParts[2];

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

          const monthIndex = monthNames.indexOf(monthName);
          if (monthIndex !== -1) {
            const monthNumber = (monthIndex + 1).toString().padStart(2, "0");
            folders.push(`year=${year}&month=${monthNumber}`);
          }
        }
      }

      return folders;
    } catch (error) {
      console.error("❌ Error obteniendo carpetas de S3:", error);
      return [];
    }
  }

  static async refreshInventoryCache() {
    try {
      console.log("🔄 Iniciando refresh de cache de inventario...");

      await invalidateCachePattern("cache:api:s3:inventario:*");
      console.log("🗑️ Cache invalidado");

      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

      const existingFolders = await this.getExistingInventoryFolders();
      console.log(`📁 Carpetas encontradas en S3: ${existingFolders.length}`);

      const urlsToWarm = [
        `${baseUrl}/api/s3/inventario`,
        ...existingFolders.map(
          (folder) => `${baseUrl}/api/s3/inventario?${folder}`
        ),
      ];

      const limitedUrls = urlsToWarm.slice(0, 11);

      console.log(`🔥 URLs a pre-calentar: ${limitedUrls.length}`);
      limitedUrls.forEach((url) => console.log(`   - ${url}`));

      const warmPromises = limitedUrls.map(async (url) => {
        try {
          console.log(`🔥 Pre-calentando: ${url}`);
          const response = await fetch(url, {
            headers: this.getInternalHeaders(),
          });

          if (response.ok) {
            console.log(`✅ Cache calentado: ${url} (${response.status})`);
          } else {
            console.log(`⚠️ Respuesta no exitosa: ${url} (${response.status})`);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
          console.error(`❌ Error calentando ${url}:`, errorMessage);
        }
      });

      await Promise.allSettled(warmPromises);

      console.log("🔥 Cache warming completado");
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("❌ Error en cache warming:", errorMessage);
      return false;
    }
  }

  static async refreshUsersCache() {
    try {
      console.log("🔄 Refrescando cache de usuarios...");

      await invalidateCachePattern("cache:api:users:*");

      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const response = await fetch(`${baseUrl}/api/users`, {
        headers: this.getInternalHeaders(),
      });

      console.log(`✅ Cache de usuarios refrescado (${response.status})`);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("❌ Error refrescando cache usuarios:", errorMessage);
      return false;
    }
  }

  static async refreshClientesCache() {
    try {
      console.log("🔄 Iniciando refresh de cache de clientes...");

      await invalidateCachePattern("cache:api:s3:clientes:*");
      console.log("🗑️ Cache de clientes invalidado");

      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

      const urlsToWarm = [`${baseUrl}/api/s3/clientes`];

      const warmPromises = urlsToWarm.map(async (url) => {
        try {
          console.log(`🔥 Pre-calentando clientes: ${url}`);
          const response = await fetch(url, {
            headers: this.getInternalHeaders(),
          });
          console.log(
            `✅ Cache de clientes calentado: ${url} (${response.status})`
          );

          if (response.status === 401) {
            console.error(
              "❌ Error 401: Verificar configuración de headers internos en middleware"
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
          console.error(`❌ Error calentando clientes ${url}:`, errorMessage);
        }
      });

      await Promise.allSettled(warmPromises);

      console.log("🔥 Cache warming de clientes completado");
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("❌ Error en cache warming de clientes:", errorMessage);
      return false;
    }
  }

  static async refreshFichasTecnicasCache() {
    try {
      console.log("🔄 Iniciando refresh de cache de fichas técnicas...");

      await invalidateCachePattern("cache:api:s3:fichas-tecnicas:*");
      console.log("🗑️ Cache de fichas técnicas invalidado");

      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

      const urlsToWarm = [`${baseUrl}/api/s3/fichas-tecnicas`];

      const warmPromises = urlsToWarm.map(async (url) => {
        try {
          console.log(`🔥 Pre-calentando fichas técnicas: ${url}`);
          const response = await fetch(url, {
            headers: this.getInternalHeaders(),
          });
          console.log(
            `✅ Cache de fichas técnicas calentado: ${url} (${response.status})`
          );

          if (response.status === 401) {
            console.error(
              "❌ Error 401: Verificar configuración de headers internos en middleware"
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";
          console.error(
            `❌ Error calentando fichas técnicas ${url}:`,
            errorMessage
          );
        }
      });

      await Promise.allSettled(warmPromises);

      console.log("🔥 Cache warming de fichas técnicas completado");
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      console.error(
        "❌ Error en cache warming de fichas técnicas:",
        errorMessage
      );
      return false;
    }
  }
}

export async function invalidateAndWarmInventory() {
  setImmediate(() => {
    CacheWarming.refreshInventoryCache();
  });
}

export async function invalidateAndWarmUsers() {
  setImmediate(() => {
    CacheWarming.refreshUsersCache();
  });
}

export async function invalidateAndWarmClientes() {
  setImmediate(() => {
    CacheWarming.refreshClientesCache();
  });
}

export async function invalidateAndWarmFichasTecnicas() {
  setImmediate(() => {
    CacheWarming.refreshFichasTecnicasCache();
  });
}
