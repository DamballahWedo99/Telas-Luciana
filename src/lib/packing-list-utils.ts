// lib/packing-list-utils.ts
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

interface PackingListEntry {
  packing_list_id: string;
  fabric_type: string;
  color: string;
  lot: number;
  rolls: {
    roll_number: number;
    almacen: string;
    kg?: number;
    mts?: number;
  }[];
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Obtiene el archivo de packing list más reciente del bucket S3
 */
export async function getLatestPackingListFile(): Promise<string | null> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: "telas-luciana",
      Prefix: "Catalogo_Rollos/packing_lists_con_unidades_",
      Delimiter: "/",
    });

    const response = await s3Client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      return null;
    }

    // Ordenar por fecha de modificación y obtener el más reciente
    const sortedFiles = response.Contents.filter((item) =>
      item.Key?.endsWith(".json")
    ).sort((a, b) => {
      const dateA = a.LastModified?.getTime() || 0;
      const dateB = b.LastModified?.getTime() || 0;
      return dateB - dateA;
    });

    return sortedFiles[0]?.Key || null;
  } catch (error) {
    console.error("Error al obtener el archivo más reciente:", error);
    return null;
  }
}

/**
 * Obtiene el contenido de un archivo de packing list
 */
export async function getPackingListContent(
  key: string
): Promise<PackingListEntry[]> {
  try {
    const command = new GetObjectCommand({
      Bucket: "telas-luciana",
      Key: key,
    });

    const response = await s3Client.send(command);
    const bodyString = await response.Body?.transformToString();

    if (!bodyString) {
      throw new Error("No se pudo leer el archivo");
    }

    return JSON.parse(bodyString);
  } catch (error) {
    console.error("Error al obtener contenido del packing list:", error);
    throw error;
  }
}

/**
 * Busca entradas de packing list por tela y color
 */
export async function searchPackingListByFabric(
  tela: string,
  color: string
): Promise<PackingListEntry[]> {
  try {
    const latestFile = await getLatestPackingListFile();

    if (!latestFile) {
      return [];
    }

    const content = await getPackingListContent(latestFile);

    // Filtrar por tela y color (case insensitive)
    return content.filter(
      (entry) =>
        entry.fabric_type.toLowerCase() === tela.toLowerCase() &&
        entry.color.toLowerCase() === color.toLowerCase()
    );
  } catch (error) {
    console.error("Error al buscar en packing list:", error);
    return [];
  }
}

/**
 * Calcula el total de kg o metros de una lista de rollos
 */
export function calculateTotalFromRolls(rolls: PackingListEntry["rolls"]): {
  total: number;
  unit: "kg" | "mts";
} {
  if (rolls.length === 0) {
    return { total: 0, unit: "kg" };
  }

  const hasKg = rolls[0].kg !== undefined;
  const unit = hasKg ? "kg" : "mts";

  const total = rolls.reduce((sum, roll) => {
    const value = hasKg ? roll.kg || 0 : roll.mts || 0;
    return sum + value;
  }, 0);

  return { total, unit };
}

/**
 * Agrupa las entradas de packing list por lote
 */
export function groupPackingListByLot(
  entries: PackingListEntry[]
): Map<number, PackingListEntry> {
  const grouped = new Map<number, PackingListEntry>();

  entries.forEach((entry) => {
    const existing = grouped.get(entry.lot);

    if (existing) {
      // Si ya existe una entrada para este lote, combinar los rollos
      existing.rolls = [...existing.rolls, ...entry.rolls];
    } else {
      grouped.set(entry.lot, { ...entry });
    }
  });

  return grouped;
}

/**
 * Valida si un rollo puede ser vendido basándose en el inventario actual
 */
export function validateRollSale(
  rolls: PackingListEntry["rolls"],
  currentInventory: number,
  unit: "KGS" | "MTS"
): {
  isValid: boolean;
  message?: string;
  totalToSell: number;
} {
  const { total, unit: rollUnit } = calculateTotalFromRolls(rolls);

  // Verificar que las unidades coincidan
  const inventoryUnit = unit.toLowerCase();
  if (rollUnit !== inventoryUnit.slice(0, -1)) {
    return {
      isValid: false,
      message: `Las unidades no coinciden. Inventario en ${unit}, rollos en ${rollUnit}`,
      totalToSell: 0,
    };
  }

  // Verificar que haya suficiente inventario
  if (total > currentInventory) {
    return {
      isValid: false,
      message: `No hay suficiente inventario. Disponible: ${currentInventory} ${unit}, Intentando vender: ${total} ${rollUnit}`,
      totalToSell: total,
    };
  }

  return {
    isValid: true,
    totalToSell: total,
  };
}

/**
 * Formatea la información de un rollo para mostrar
 */
export function formatRollInfo(roll: PackingListEntry["rolls"][0]): string {
  if (roll.kg !== undefined) {
    return `Rollo #${roll.roll_number} - ${roll.kg} kg - ${roll.almacen}`;
  } else {
    return `Rollo #${roll.roll_number} - ${roll.mts} mts - ${roll.almacen}`;
  }
}

/**
 * Genera un resumen de venta de rollos
 */
export function generateSaleSummary(
  rolls: PackingListEntry["rolls"],
  tela: string,
  color: string,
  lot: number
): string {
  const { total, unit } = calculateTotalFromRolls(rolls);
  const rollNumbers = rolls.map((r) => r.roll_number).join(", ");

  return (
    `Venta de ${tela} ${color} (Lote: ${lot})\n` +
    `Rollos: ${rollNumbers}\n` +
    `Total: ${total.toFixed(2)} ${unit}`
  );
}
