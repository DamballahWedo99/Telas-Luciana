import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function parseNumericValue(value: string | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const valueStr = String(value);

  if (
    valueStr.trim() === "" ||
    valueStr.toLowerCase() === "n/a" ||
    valueStr.toLowerCase() === "null"
  ) {
    return 0;
  }

  try {
    let cleanedValue = valueStr
      .replace(/\s+/g, "")
      .replace(/[$€£¥]/g, "")
      .replace(/[^\d.,\-]/g, "");

    if (cleanedValue.indexOf(".") > -1 && cleanedValue.indexOf(",") > -1) {
      if (cleanedValue.lastIndexOf(".") > cleanedValue.lastIndexOf(",")) {
        cleanedValue = cleanedValue.replace(/,/g, "");
      } else {
        cleanedValue = cleanedValue.replace(/\./g, "").replace(",", ".");
      }
    } else if (
      cleanedValue.indexOf(",") > -1 &&
      cleanedValue.indexOf(".") === -1
    ) {
      cleanedValue = cleanedValue.replace(",", ".");
    }

    const result = parseFloat(cleanedValue);
    return isNaN(result) ? 0 : result;
  } catch (error) {
    console.error(`Error parsing numeric value "${value}":`, error);
    return 0;
  }
}

export function formatNumber(num: number): string {
  return num.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function mapCsvFields(fields: string[]): Record<string, string> {
  const fieldMap: Record<string, string> = {};
  const normalizedFields = fields.map((f) => f.toLowerCase().trim());

  const fieldMappings: Record<string, string[]> = {
    OC: [
      "oc",
      "orden",
      "orden de compra",
      "orden_compra",
      "orden compra",
      "no. orden",
      "no orden",
    ],
    Tela: ["tela", "tipo de tela", "tipo_tela", "tipo tela", "material"],
    Color: ["color", "colores", "colorido", "color tela"],
    Costo: [
      "costo",
      "precio",
      "valor",
      "costo unitario",
      "precio unitario",
      "costo_unitario",
      "precio_unitario",
    ],
    Cantidad: [
      "cantidad",
      "cant",
      "cant.",
      "cantidad total",
      "total unidades",
      "unidades totales",
    ],
    Unidades: ["unidades", "unidad", "tipo unidad", "medida", "um", "u.m."],
    Importacion: [
      "importacion",
      "importación",
      "tipo importacion",
      "tipo importación",
      "origen",
    ],
    FacturaDragonAzteca: [
      "factura dragón azteca",
      "factura dragon azteca",
      "factura_dragon_azteca",
      "no. factura da",
      "factura da",
    ],
  };

  for (const [standardField, possibleNames] of Object.entries(fieldMappings)) {
    const matchIndex = normalizedFields.findIndex((field) =>
      possibleNames.includes(field)
    );

    if (matchIndex !== -1) {
      fieldMap[standardField] = fields[matchIndex];
    }
  }

  return fieldMap;
}

/**
 */
export function normalizeCsvData(
  data: any[],
  fieldMap: Record<string, string>
): any[] {
  return data.map((row) => {
    const normalizedRow: any = {};

    for (const [standardField, csvField] of Object.entries(fieldMap)) {
      normalizedRow[standardField] = row[csvField];
    }

    return normalizedRow;
  });
}
