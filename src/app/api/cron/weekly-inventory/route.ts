import { NextRequest, NextResponse } from "next/server";
import { sendInventoryEmail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface InventoryItem {
  OC: string;
  Tela: string;
  Color: string;
  Costo: number;
  Cantidad: number;
  Unidades: string;
  Total: number;
  Ubicacion: string;
  Importacion: string;
  FacturaDragonAzteca: string;
}

interface RawInventoryItem {
  OC?: string | null;
  Tela?: string | null;
  Color?: string | null;
  Ubicacion?: string | null;
  Cantidad?: number | string | null;
  Costo?: number | string | null;
  Unidades?: string | null;
  Importacion?: string | null;
  FacturaDragonAzteca?: string | null;
  status?: string | null;
  almacen?: string | null;
  CDMX?: number | string | null;
  MID?: number | string | null;
  "Factura Dragón Azteca"?: string | null;
  "Factura Dragon Azteca"?: string | null;
  Importación?: string | null;
}

function processInventoryData(data: unknown[]): InventoryItem[] {
  const parseNumericValue = (
    value: string | number | null | undefined
  ): number => {
    if (typeof value === "number") return value;
    if (value === null || value === undefined) return 0;
    const stringValue = String(value).trim();
    if (stringValue === "" || stringValue.toLowerCase() === "nan") return 0;
    const cleanValue = stringValue.replace(/[^\d.-]/g, "");
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  const normalizeImportacion = (value: unknown): "DA" | "HOY" | "-" | "" => {
    if (value === null || value === undefined) return "-";
    const normalized = String(value).toLowerCase().trim();
    if (normalized === "hoy") return "HOY";
    if (normalized === "da") return "DA";
    if (normalized === "nan" || normalized === "") return "-";
    return "";
  };

  const filteredData = data.filter((item: unknown) => {
    const typedItem = item as RawInventoryItem;
    return typedItem.status !== "pending";
  });

  const processedItems: InventoryItem[] = [];

  filteredData.forEach((item: unknown) => {
    const typedItem = item as RawInventoryItem;
    const costo = parseNumericValue(typedItem.Costo);
    const cantidad = parseNumericValue(typedItem.Cantidad);

    let ubicacion = "";
    let cantidadFinal = cantidad;

    if (typedItem.almacen) {
      ubicacion = typedItem.almacen === "CDMX" ? "CDMX" : "Mérida";
    } else if (typedItem.CDMX !== undefined && typedItem.MID !== undefined) {
      const cantidadCDMX = parseNumericValue(typedItem.CDMX);
      const cantidadMID = parseNumericValue(typedItem.MID);

      if (cantidadCDMX > 0 && cantidadMID > 0) {
        const cdmxItem = {
          OC: String(typedItem.OC || ""),
          Tela: String(typedItem.Tela || ""),
          Color: String(typedItem.Color || ""),
          Costo: costo,
          Cantidad: cantidadCDMX,
          Unidades: String(typedItem.Unidades || ""),
          Total: costo * cantidadCDMX,
          Ubicacion: "CDMX",
          Importacion: normalizeImportacion(
            typedItem.Importacion || typedItem["Importación"] || ""
          ),
          FacturaDragonAzteca: String(
            typedItem["Factura Dragón Azteca"] ||
              typedItem["Factura Dragon Azteca"] ||
              typedItem.FacturaDragonAzteca ||
              ""
          ),
        };
        processedItems.push(cdmxItem);

        const meridaItem = {
          OC: String(typedItem.OC || ""),
          Tela: String(typedItem.Tela || ""),
          Color: String(typedItem.Color || ""),
          Costo: costo,
          Cantidad: cantidadMID,
          Unidades: String(typedItem.Unidades || ""),
          Total: costo * cantidadMID,
          Ubicacion: "Mérida",
          Importacion: normalizeImportacion(
            typedItem.Importacion || typedItem["Importación"] || ""
          ),
          FacturaDragonAzteca: String(
            typedItem["Factura Dragón Azteca"] ||
              typedItem["Factura Dragon Azteca"] ||
              typedItem.FacturaDragonAzteca ||
              ""
          ),
        };
        processedItems.push(meridaItem);
        return;
      } else if (cantidadCDMX > 0) {
        ubicacion = "CDMX";
        cantidadFinal = cantidadCDMX;
      } else if (cantidadMID > 0) {
        ubicacion = "Mérida";
        cantidadFinal = cantidadMID;
      } else {
        ubicacion = String(typedItem.Ubicacion || "");
      }
    } else {
      ubicacion = String(typedItem.Ubicacion || "");
    }

    const finalItem = {
      OC: String(typedItem.OC || ""),
      Tela: String(typedItem.Tela || ""),
      Color: String(typedItem.Color || ""),
      Costo: costo,
      Cantidad: cantidadFinal,
      Unidades: String(typedItem.Unidades || ""),
      Total: costo * cantidadFinal,
      Ubicacion: ubicacion,
      Importacion: normalizeImportacion(
        typedItem.Importacion || typedItem["Importación"] || ""
      ),
      FacturaDragonAzteca: String(
        typedItem["Factura Dragón Azteca"] ||
          typedItem["Factura Dragon Azteca"] ||
          typedItem.FacturaDragonAzteca ||
          ""
      ),
    };

    processedItems.push(finalItem);
  });

  return processedItems.filter((item) => item.Cantidad > 0);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function generateFileName(): string {
  const now = new Date();
  const mexicoTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Mexico_City" })
  );

  const dateStr = `${mexicoTime.getFullYear()}${(mexicoTime.getMonth() + 1)
    .toString()
    .padStart(2, "0")}${mexicoTime.getDate().toString().padStart(2, "0")}`;
  const timeStr = `${mexicoTime.getHours().toString().padStart(2, "0")}${mexicoTime
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  return `inventario_semanal_${dateStr}_${timeStr}`;
}

async function generatePDF(inventory: InventoryItem[]): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  doc.setFontSize(18);
  doc.text("Inventario Completo - Reporte Semanal", 14, 22);

  const mexicoTime = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" })
  );
  const dateStr = mexicoTime.toLocaleDateString("es-MX");
  const timeStr = mexicoTime.toLocaleTimeString("es-MX");

  doc.setFontSize(11);
  doc.text(`Fecha: ${dateStr} ${timeStr} (Hora CDMX)`, 14, 30);

  const columns = [
    { header: "OC", dataKey: "OC" },
    { header: "Tela", dataKey: "Tela" },
    { header: "Color", dataKey: "Color" },
    { header: "Costo", dataKey: "Costo" },
    { header: "Cantidad", dataKey: "Cantidad" },
    { header: "Unidades", dataKey: "Unidades" },
    { header: "Total", dataKey: "Total" },
    { header: "Ubicación", dataKey: "Ubicacion" },
    { header: "Importación", dataKey: "Importacion" },
  ];

  const rows = inventory.map((item) => [
    item.OC,
    item.Tela,
    item.Color,
    `$${formatNumber(item.Costo)}`,
    formatNumber(item.Cantidad),
    item.Unidades,
    `$${formatNumber(item.Total)}`,
    item.Ubicacion || "-",
    item.Importacion,
  ]);

  const totalCantidad = inventory.reduce(
    (total, item) => total + item.Cantidad,
    0
  );
  const totalCosto = inventory.reduce((total, item) => total + item.Total, 0);

  rows.push([
    "TOTAL",
    "",
    "",
    "",
    formatNumber(totalCantidad),
    "",
    `$${formatNumber(totalCosto)}`,
    "",
    "",
  ]);

  autoTable(doc, {
    startY: 40,
    head: [columns.map((col) => col.header)],
    body: rows,
    theme: "striped",
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.row.index === rows.length - 1) {
        doc.setFillColor(240, 240, 240);
        doc.setFont("helvetica", "bold");
      }
    },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY || 100;
  doc.setFontSize(10);
  doc.text(`Total de productos: ${inventory.length}`, 14, finalY + 20);
  doc.text("Reporte generado automáticamente cada viernes", 14, finalY + 30);

  return Buffer.from(doc.output("arraybuffer"));
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, {
    type: "cron",
    message:
      "Demasiadas solicitudes de reporte de inventario. Espera antes de intentar nuevamente.",
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🕐 Iniciando generación de reporte de inventario semanal...");

    const now = new Date();
    const mexicoTime = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Mexico_City" })
    );
    const currentYear = mexicoTime.getFullYear().toString();
    const currentMonth = (mexicoTime.getMonth() + 1)
      .toString()
      .padStart(2, "0");

    console.log(`📅 Obteniendo inventario para ${currentMonth}/${currentYear}`);

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const inventoryResponse = await fetch(
      `${baseUrl}/api/s3/inventario?year=${currentYear}&month=${currentMonth}`
    );

    if (!inventoryResponse.ok) {
      throw new Error(
        `Error al obtener inventario: ${inventoryResponse.status} ${inventoryResponse.statusText}`
      );
    }

    const inventoryData = await inventoryResponse.json();

    if (!inventoryData.data || !Array.isArray(inventoryData.data)) {
      throw new Error("Formato de datos de inventario inválido");
    }

    const processedInventory = processInventoryData(inventoryData.data);
    console.log(
      `📊 Procesados ${processedInventory.length} items de inventario`
    );

    if (processedInventory.length === 0) {
      throw new Error("No hay datos de inventario para procesar");
    }

    const fileName = generateFileName();

    console.log("📄 Generando archivo CSV...");
    const csvData = Papa.unparse(processedInventory);

    console.log("📑 Generando archivo PDF...");
    const pdfBuffer = await generatePDF(processedInventory);

    console.log("📧 Enviando correo con archivos adjuntos...");
    const emailResult = await sendInventoryEmail(
      "fer.flores@telasytejidosluciana.com",
      csvData,
      pdfBuffer,
      fileName
    );

    if (emailResult.error) {
      throw new Error(emailResult.error);
    }

    console.log("✅ Reporte de inventario semanal enviado exitosamente");

    return NextResponse.json({
      success: true,
      message: "Reporte de inventario enviado exitosamente",
      itemsProcessed: processedInventory.length,
      fileName,
      sentAt: mexicoTime.toISOString(),
    });
  } catch (error) {
    console.error("❌ Error en reporte de inventario semanal:", error);

    return NextResponse.json(
      {
        error: "Error al generar reporte de inventario",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
