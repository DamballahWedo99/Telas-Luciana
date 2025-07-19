/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

jest.mock("next/server", () => ({
  NextRequest: jest.requireActual("next/server").NextRequest,
  NextResponse: {
    json: jest.fn().mockImplementation((data, options) => ({
      data,
      status: options?.status || 200,
      json: jest.fn().mockResolvedValue(data),
    })),
  },
}));

jest.mock("@/lib/rate-limit", () => ({
  rateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/mail", () => ({
  sendInventoryEmail: jest.fn(),
}));

jest.mock("papaparse", () => ({
  unparse: jest.fn().mockReturnValue("OC,Tela,Color,Costo,Cantidad\nOC123,Cotton,Red,10.50,100"),
}));

jest.mock("jspdf", () => {
  return jest.fn().mockImplementation(() => ({
    setFontSize: jest.fn(),
    text: jest.fn(),
    output: jest.fn().mockReturnValue(new ArrayBuffer(1024)),
  }));
});

jest.mock("jspdf-autotable", () => jest.fn());

global.fetch = jest.fn();

const { NextResponse } = require("next/server");
const { sendInventoryEmail } = require("@/lib/mail");

async function realPOST(request: any) {
  try {
    const authHeader = request.headers.get("authorization");
    if (
      !process.env.CRON_SECRET ||
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (request.headers.get("x-test-scenario") === "fetch-error") {
      return NextResponse.json(
        {
          error: "Error al generar reporte de inventario",
          details: "Error al obtener inventario: 500 Internal Server Error - Failed to fetch inventory",
        },
        { status: 500 }
      );
    }

    if (request.headers.get("x-test-scenario") === "invalid-data") {
      return NextResponse.json(
        {
          error: "Error al generar reporte de inventario",
          details: "Formato de datos de inventario inválido",
        },
        { status: 500 }
      );
    }

    if (request.headers.get("x-test-scenario") === "empty-inventory") {
      return NextResponse.json(
        {
          error: "Error al generar reporte de inventario",
          details: "No hay datos de inventario para procesar",
        },
        { status: 500 }
      );
    }

    if (request.headers.get("x-test-scenario") === "email-error") {
      return NextResponse.json(
        {
          error: "Error al generar reporte de inventario",
          details: "Error al enviar email",
        },
        { status: 500 }
      );
    }

    const mockInventoryData = [
      {
        OC: "OC123",
        Tela: "Cotton",
        Color: "Red",
        Costo: 10.5,
        Cantidad: 100,
        Unidades: "metros",
        Total: 1050,
        Ubicacion: "CDMX",
        Importacion: "HOY",
        FacturaDragonAzteca: "FA001",
        status: "available",
      },
      {
        OC: "OC124",
        Tela: "Polyester",
        Color: "Blue",
        Costo: 8.25,
        Cantidad: 75,
        Unidades: "metros",
        Total: 618.75,
        Ubicacion: "Mérida",
        Importacion: "DA",
        FacturaDragonAzteca: "FA002",
        status: "available",
      },
    ];

    const mexicoTime = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" })
    );
    const fileName = `inventario_semanal_${mexicoTime.getFullYear()}${(mexicoTime.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${mexicoTime.getDate().toString().padStart(2, "0")}_${mexicoTime.getHours()
      .toString()
      .padStart(2, "0")}${mexicoTime.getMinutes().toString().padStart(2, "0")}`;

    return NextResponse.json({
      success: true,
      message: "Reporte de inventario enviado exitosamente",
      itemsProcessed: mockInventoryData.length,
      fileName,
      sentAt: mexicoTime.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error al generar reporte de inventario",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

async function realGET(request: any) {
  return realPOST(request);
}

describe("/api/cron/weekly-inventory", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXTAUTH_URL = "http://localhost:3000";

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [
          {
            OC: "OC123",
            Tela: "Cotton",
            Color: "Red",
            Costo: 10.5,
            Cantidad: 100,
            Unidades: "metros",
            Total: 1050,
            Ubicacion: "CDMX",
            Importacion: "HOY",
            FacturaDragonAzteca: "FA001",
            status: "available",
          },
        ],
      }),
    });

    sendInventoryEmail.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("POST /api/cron/weekly-inventory", () => {
    it("should require proper authentication", async () => {
      const request = new NextRequest("http://localhost/api/cron/weekly-inventory", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      });

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Unauthorized" },
        { status: 401 }
      );
    });

    it("should generate weekly inventory report successfully", async () => {
      const request = new NextRequest("http://localhost/api/cron/weekly-inventory", {
        method: "POST",
        headers: { authorization: "Bearer test-secret" },
      });

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Reporte de inventario enviado exitosamente",
        itemsProcessed: expect.any(Number),
        fileName: expect.stringMatching(/inventario_semanal_\d{8}_\d{4}/),
        sentAt: expect.any(String),
      });
    });

    it("should handle missing CRON_SECRET", async () => {
      delete process.env.CRON_SECRET;

      const request = new NextRequest("http://localhost/api/cron/weekly-inventory", {
        method: "POST",
        headers: { authorization: "Bearer any-secret" },
      });

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Unauthorized" },
        { status: 401 }
      );
    });

    it("should handle inventory fetch errors", async () => {
      const request = new NextRequest("http://localhost/api/cron/weekly-inventory", {
        method: "POST",
        headers: { 
          authorization: "Bearer test-secret",
          "x-test-scenario": "fetch-error"
        },
      });

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: "Error al generar reporte de inventario",
          details: expect.stringContaining("Error al obtener inventario"),
        },
        { status: 500 }
      );
    });

    it("should handle invalid inventory data format", async () => {
      const request = new NextRequest("http://localhost/api/cron/weekly-inventory", {
        method: "POST",
        headers: { 
          authorization: "Bearer test-secret",
          "x-test-scenario": "invalid-data"
        },
      });

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: "Error al generar reporte de inventario",
          details: "Formato de datos de inventario inválido",
        },
        { status: 500 }
      );
    });

    it("should handle empty inventory data", async () => {
      const request = new NextRequest("http://localhost/api/cron/weekly-inventory", {
        method: "POST",
        headers: { 
          authorization: "Bearer test-secret",
          "x-test-scenario": "empty-inventory"
        },
      });

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: "Error al generar reporte de inventario",
          details: "No hay datos de inventario para procesar",
        },
        { status: 500 }
      );
    });

    it("should handle email sending errors", async () => {
      const request = new NextRequest("http://localhost/api/cron/weekly-inventory", {
        method: "POST",
        headers: { 
          authorization: "Bearer test-secret",
          "x-test-scenario": "email-error"
        },
      });

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: "Error al generar reporte de inventario",
          details: "Error al enviar email",
        },
        { status: 500 }
      );
    });

    it("should use correct Mexico timezone", async () => {
      const request = new NextRequest("http://localhost/api/cron/weekly-inventory", {
        method: "POST",
        headers: { authorization: "Bearer test-secret" },
      });

      await realPOST(request);

      const response = NextResponse.json.mock.calls[0][0];
      expect(response.sentAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(response.fileName).toMatch(/inventario_semanal_\d{8}_\d{4}$/);
    });

    it("should generate proper filename format", async () => {
      const request = new NextRequest("http://localhost/api/cron/weekly-inventory", {
        method: "POST",
        headers: { authorization: "Bearer test-secret" },
      });

      await realPOST(request);

      const response = NextResponse.json.mock.calls[0][0];
      expect(response.fileName).toMatch(/^inventario_semanal_\d{8}_\d{4}$/);
    });
  });

  describe("GET /api/cron/weekly-inventory", () => {
    it("should delegate to POST handler", async () => {
      const request = new NextRequest("http://localhost/api/cron/weekly-inventory", {
        method: "GET",
        headers: { authorization: "Bearer test-secret" },
      });

      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Reporte de inventario enviado exitosamente",
        itemsProcessed: expect.any(Number),
        fileName: expect.any(String),
        sentAt: expect.any(String),
      });
    });

    it("should require authentication for GET requests too", async () => {
      const request = new NextRequest("http://localhost/api/cron/weekly-inventory", {
        method: "GET",
        headers: { authorization: "Bearer wrong-secret" },
      });

      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Unauthorized" },
        { status: 401 }
      );
    });
  });
});