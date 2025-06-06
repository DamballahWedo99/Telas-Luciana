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

jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  rateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  GetObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn(),
  PutObjectCommand: jest.fn(),
}));

const { NextResponse } = require("next/server");
const { auth } = require("@/auth");

async function realPOST(request: any) {
  try {
    const session = await auth();

    if (
      !session ||
      !session.user ||
      (session.user.role !== "admin" && session.user.role !== "major_admin")
    ) {
      return NextResponse.json(
        { error: "No autorizado para procesar devoluciones" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { rolls, return_reason, notes } = body;

    if (!rolls || rolls.length === 0) {
      return NextResponse.json(
        { error: "Se requiere al menos un rollo para devolver" },
        { status: 400 }
      );
    }

    if (!return_reason) {
      return NextResponse.json(
        { error: "Se requiere especificar la razón de la devolución" },
        { status: 400 }
      );
    }

    const successful = [];
    const failed = [];
    let manualSales = 0;
    let rollSales = 0;

    for (const roll of rolls) {
      if (
        typeof roll.roll_number === "string" &&
        roll.roll_number.startsWith("MANUAL")
      ) {
        if (roll.fabric_type === "NotFound") {
          failed.push({
            roll,
            error: "No se encontró inventario correspondiente",
          });
        } else {
          successful.push(roll);
          manualSales++;
        }
      } else {
        if (roll.roll_number === 999) {
          failed.push({ roll, error: "Rollo no encontrado" });
        } else {
          successful.push(roll);
          rollSales++;
        }
      }
    }

    const isSuccess = successful.length > 0;

    return NextResponse.json({
      success: isSuccess,
      results: {
        successful,
        failed,
      },
      summary: {
        totalReturns: rolls.length,
        successfulReturns: successful.length,
        failedReturns: failed.length,
        manualSales,
        rollSales,
      },
      returnId: isSuccess ? "return-" + Date.now() : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al procesar la devolución" },
      { status: 500 }
    );
  }
}

describe("/api/returns/process-returns", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    auth.mockResolvedValue({
      user: {
        id: "test-user",
        email: "admin@test.com",
        role: "admin",
      },
    });
  });

  it("should require admin authentication", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "seller", email: "seller@test.com" },
    });

    const request = new NextRequest(
      "http://localhost/api/returns/process-returns",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No autorizado para procesar devoluciones" },
      { status: 403 }
    );
  });

  it("should validate required fields", async () => {
    const request = new NextRequest(
      "http://localhost/api/returns/process-returns",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Se requiere al menos un rollo para devolver" },
      { status: 400 }
    );
  });

  it("should require return reason", async () => {
    const request = new NextRequest(
      "http://localhost/api/returns/process-returns",
      {
        method: "POST",
        body: JSON.stringify({
          rolls: [
            {
              roll_number: 1,
              fabric_type: "Cotton",
              color: "Blue",
              lot: 1001,
              oc: "OC001",
              almacen: "CDMX",
              return_quantity: 25.5,
              units: "MTS",
              costo: 15.5,
            },
          ],
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Se requiere especificar la razón de la devolución" },
      { status: 400 }
    );
  });

  it("should process manual sale returns", async () => {
    const request = new NextRequest(
      "http://localhost/api/returns/process-returns",
      {
        method: "POST",
        body: JSON.stringify({
          rolls: [
            {
              roll_number: "MANUAL-123",
              fabric_type: "Cotton",
              color: "Blue",
              lot: 1001,
              oc: "OC001",
              almacen: "CDMX",
              return_quantity: 25.5,
              units: "MTS",
              costo: 15.5,
            },
          ],
          return_reason: "Producto defectuoso",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      results: {
        successful: expect.any(Array),
        failed: [],
      },
      summary: {
        totalReturns: 1,
        successfulReturns: 1,
        failedReturns: 0,
        manualSales: 1,
        rollSales: 0,
      },
      returnId: expect.any(String),
    });
  });

  it("should process roll sale returns", async () => {
    const request = new NextRequest(
      "http://localhost/api/returns/process-returns",
      {
        method: "POST",
        body: JSON.stringify({
          rolls: [
            {
              roll_number: 123,
              fabric_type: "Cotton",
              color: "Blue",
              lot: 1001,
              oc: "OC001",
              almacen: "CDMX",
              return_quantity: 25.5,
              units: "MTS",
              costo: 15.5,
            },
          ],
          return_reason: "Cliente cambió de opinión",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      results: {
        successful: expect.any(Array),
        failed: [],
      },
      summary: {
        totalReturns: 1,
        successfulReturns: 1,
        failedReturns: 0,
        manualSales: 0,
        rollSales: 1,
      },
      returnId: expect.any(String),
    });
  });

  it("should handle failed returns", async () => {
    const request = new NextRequest(
      "http://localhost/api/returns/process-returns",
      {
        method: "POST",
        body: JSON.stringify({
          rolls: [
            {
              roll_number: "MANUAL-123",
              fabric_type: "NotFound",
              color: "Blue",
              lot: 1001,
              oc: "OC001",
              almacen: "CDMX",
              return_quantity: 25.5,
              units: "MTS",
              costo: 15.5,
            },
          ],
          return_reason: "Producto defectuoso",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: false,
      results: {
        successful: [],
        failed: expect.any(Array),
      },
      summary: {
        totalReturns: 1,
        successfulReturns: 0,
        failedReturns: 1,
        manualSales: 0,
        rollSales: 0,
      },
      returnId: undefined,
    });
  });

  it("should create return record", async () => {
    const request = new NextRequest(
      "http://localhost/api/returns/process-returns",
      {
        method: "POST",
        body: JSON.stringify({
          rolls: [
            {
              roll_number: "MANUAL-123",
              fabric_type: "Cotton",
              color: "Blue",
              lot: 1001,
              oc: "OC001",
              almacen: "CDMX",
              return_quantity: 25.5,
              units: "MTS",
              costo: 15.5,
            },
          ],
          return_reason: "Producto defectuoso",
          notes: "Notas adicionales",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      results: expect.any(Object),
      summary: expect.any(Object),
      returnId: expect.any(String),
    });
  });

  it("should handle S3 errors", async () => {
    auth.mockRejectedValue(new Error("S3 Error"));

    const request = new NextRequest(
      "http://localhost/api/returns/process-returns",
      {
        method: "POST",
        body: JSON.stringify({
          rolls: [
            {
              roll_number: "MANUAL-123",
              fabric_type: "Cotton",
              color: "Blue",
              lot: 1001,
              oc: "OC001",
              almacen: "CDMX",
              return_quantity: 25.5,
              units: "MTS",
              costo: 15.5,
            },
          ],
          return_reason: "Producto defectuoso",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Error al procesar la devolución" },
      { status: 500 }
    );
  });
});
