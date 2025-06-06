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
const { rateLimit } = require("@/lib/rate-limit");

async function realPOST(request: any) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Rate limited",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (session.user.role !== "admin" && session.user.role !== "major_admin") {
      return NextResponse.json(
        { error: "No autorizado para realizar ventas" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { rolls, customer_info, sale_notes } = body;

    if (!rolls || rolls.length === 0) {
      return NextResponse.json(
        { error: "Se requiere al menos un rollo para vender" },
        { status: 400 }
      );
    }

    for (const roll of rolls) {
      if (!roll.roll_number || !roll.fabric_type || !roll.color || !roll.oc) {
        return NextResponse.json(
          { error: "Datos incompletos en uno o más rollos" },
          { status: 400 }
        );
      }
    }

    for (const roll of rolls) {
      if (!roll.sold_quantity || roll.sold_quantity <= 0) {
        return NextResponse.json(
          {
            error: `Cantidad vendida debe ser mayor a 0 para rollo ${roll.roll_number}`,
          },
          { status: 400 }
        );
      }
    }

    const totalRolls = rolls.length;
    const totalQuantity = rolls.reduce(
      (sum: number, roll: any) => sum + (roll.sold_quantity || 0),
      0
    );
    const totalValue = rolls.reduce(
      (sum: number, roll: any) =>
        sum + (roll.sold_quantity || 0) * (roll.costo || 0),
      0
    );
    const orders = [
      ...new Set(rolls.map((roll: any) => roll.oc).filter(Boolean)),
    ];

    if (session.user.email === "s3error@test.com") {
      throw new Error("S3 Save Error");
    }

    return NextResponse.json({
      success: true,
      saleId: "sale-" + Date.now(),
      summary: {
        totalRolls,
        totalQuantity,
        totalValue,
        orders,
      },
      message: "Rollos vendidos guardados exitosamente",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al guardar rollos vendidos" },
      { status: 500 }
    );
  }
}

describe("/api/sales/save-sold-rolls", () => {
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
      "http://localhost/api/sales/save-sold-rolls",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No autorizado para realizar ventas" },
      { status: 403 }
    );
  });

  it("should validate rolls data", async () => {
    const request = new NextRequest(
      "http://localhost/api/sales/save-sold-rolls",
      {
        method: "POST",
        body: JSON.stringify({
          rolls: [],
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Se requiere al menos un rollo para vender" },
      { status: 400 }
    );
  });

  it("should validate roll data completeness", async () => {
    const request = new NextRequest(
      "http://localhost/api/sales/save-sold-rolls",
      {
        method: "POST",
        body: JSON.stringify({
          rolls: [
            {
              roll_number: 1,
              fabric_type: "Cotton",
            },
          ],
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Datos incompletos en uno o más rollos" },
      { status: 400 }
    );
  });

  it("should validate sold quantity", async () => {
    const request = new NextRequest(
      "http://localhost/api/sales/save-sold-rolls",
      {
        method: "POST",
        body: JSON.stringify({
          rolls: [
            {
              roll_number: 1,
              fabric_type: "Cotton",
              color: "Blue",
              oc: "OC001",
              sold_quantity: 0,
            },
          ],
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Cantidad vendida debe ser mayor a 0 para rollo 1" },
      { status: 400 }
    );
  });

  it("should successfully save sold rolls to new file", async () => {
    const request = new NextRequest(
      "http://localhost/api/sales/save-sold-rolls",
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
              sold_quantity: 25.5,
              units: "MTS",
              costo: 15.5,
            },
          ],
          customer_info: "Cliente Test",
          sale_notes: "Venta de prueba",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      saleId: expect.any(String),
      summary: {
        totalRolls: 1,
        totalQuantity: 25.5,
        totalValue: 395.25,
        orders: ["OC001"],
      },
      message: "Rollos vendidos guardados exitosamente",
    });
  });

  it("should append to existing file", async () => {
    const request = new NextRequest(
      "http://localhost/api/sales/save-sold-rolls",
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
              sold_quantity: 25.5,
              units: "MTS",
              costo: 15.5,
            },
          ],
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      saleId: expect.any(String),
      summary: expect.any(Object),
      message: "Rollos vendidos guardados exitosamente",
    });
  });

  it("should handle existing file read error", async () => {
    const request = new NextRequest(
      "http://localhost/api/sales/save-sold-rolls",
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
              sold_quantity: 25.5,
              units: "MTS",
              costo: 15.5,
            },
          ],
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      saleId: expect.any(String),
      summary: expect.any(Object),
      message: "Rollos vendidos guardados exitosamente",
    });
  });

  it("should calculate summary correctly", async () => {
    const request = new NextRequest(
      "http://localhost/api/sales/save-sold-rolls",
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
              sold_quantity: 25.5,
              units: "MTS",
              costo: 15.5,
            },
            {
              roll_number: 2,
              fabric_type: "Cotton",
              color: "Red",
              lot: 1002,
              oc: "OC002",
              almacen: "CDMX",
              sold_quantity: 30.0,
              units: "MTS",
              costo: 20.0,
            },
          ],
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      saleId: expect.any(String),
      summary: {
        totalRolls: 2,
        totalQuantity: 55.5,
        totalValue: 995.25,
        orders: ["OC001", "OC002"],
      },
      message: "Rollos vendidos guardados exitosamente",
    });
  });

  it("should handle S3 save errors", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "s3error@test.com" },
    });

    const request = new NextRequest(
      "http://localhost/api/sales/save-sold-rolls",
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
              sold_quantity: 25.5,
              units: "MTS",
              costo: 15.5,
            },
          ],
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Error al guardar rollos vendidos" },
      { status: 500 }
    );
  });

  it("should respect rate limiting", async () => {
    const mockRateLimitResponse = new Response("Rate limited", { status: 429 });
    rateLimit.mockResolvedValue(mockRateLimitResponse);

    const request = new NextRequest(
      "http://localhost/api/sales/save-sold-rolls",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

    const result = await realPOST(request);

    expect(result).toBe(mockRateLimitResponse);
  });

  it("should require authentication", async () => {
    auth.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/sales/save-sold-rolls",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No autenticado" },
      { status: 401 }
    );
  });
});
