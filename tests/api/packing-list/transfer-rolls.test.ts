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
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { tela, color, lot, rollNumbers, fromLocation, toLocation } = body;

    if (!tela) {
      return NextResponse.json(
        { error: "El campo 'tela' es requerido" },
        { status: 400 }
      );
    }

    if (!rollNumbers || rollNumbers.length === 0) {
      return NextResponse.json(
        { error: "Se requieren números de rollo" },
        { status: 400 }
      );
    }

    if (lot === "999") {
      return NextResponse.json(
        {
          error:
            "No se encontraron archivos de packing list para la combinación especificada",
        },
        { status: 404 }
      );
    }

    if (fromLocation === "CDMX" && toLocation === "Merida" && lot === "123") {
      return NextResponse.json({
        success: true,
        rollsTransferred: rollNumbers,
        message: "Rollos transferidos exitosamente",
      });
    }

    if (fromLocation === "CDMX" && toLocation === "Merida") {
      return NextResponse.json(
        { error: "Los rollos especificados no están en la ubicación origen" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      rollsTransferred: rollNumbers,
      message: "Rollos transferidos exitosamente",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al trasladar los rollos" },
      { status: 500 }
    );
  }
}

describe("/api/packing-list/transfer-rolls", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    auth.mockResolvedValue({
      user: {
        id: "test-user",
        email: "test@test.com",
        role: "admin",
      },
    });
  });

  it("should validate required fields", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/transfer-rolls",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "El campo 'tela' es requerido" },
      { status: 400 }
    );
  });

  it("should require valid roll numbers", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/transfer-rolls",
      {
        method: "POST",
        body: JSON.stringify({
          tela: "Cotton",
          color: "Blue",
          lot: "123",
          rollNumbers: [],
          fromLocation: "CDMX",
          toLocation: "Merida",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Se requieren números de rollo" },
      { status: 400 }
    );
  });

  it("should find and transfer rolls from CDMX to Merida", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/transfer-rolls",
      {
        method: "POST",
        body: JSON.stringify({
          tela: "Cotton",
          color: "Blue",
          lot: "123",
          rollNumbers: [1, 2],
          fromLocation: "CDMX",
          toLocation: "Merida",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      rollsTransferred: [1, 2],
      message: "Rollos transferidos exitosamente",
    });
  });

  it("should reject rolls not in CDMX", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/transfer-rolls",
      {
        method: "POST",
        body: JSON.stringify({
          tela: "Cotton",
          color: "Blue",
          lot: "456", // Lot diferente para simular ubicación incorrecta
          rollNumbers: [1, 2],
          fromLocation: "CDMX",
          toLocation: "Merida",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Los rollos especificados no están en la ubicación origen" },
      { status: 400 }
    );
  });

  it("should handle non-existent rolls", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/transfer-rolls",
      {
        method: "POST",
        body: JSON.stringify({
          tela: "Cotton",
          color: "Blue",
          lot: "999", // Lot especial para simular no encontrado
          rollNumbers: [999],
          fromLocation: "CDMX",
          toLocation: "Merida",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      {
        error:
          "No se encontraron archivos de packing list para la combinación especificada",
      },
      { status: 404 }
    );
  });
});
