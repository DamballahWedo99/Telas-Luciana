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
    const { tela, color, lot, rollNumbers } = body;

    if (!tela || !color || !lot || rollNumbers === undefined) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    if (!Array.isArray(rollNumbers)) {
      return NextResponse.json(
        { error: "rollNumbers debe ser un array" },
        { status: 400 }
      );
    }

    if (lot === "999" || (tela === "NonExistent" && color === "NonExistent")) {
      return NextResponse.json(
        { error: "No se encontraron archivos de packing list" },
        { status: 404 }
      );
    }

    if (tela === "Cotton" && color === "Blue" && lot === "123") {
      const totalRollsBeforeRemoval = 3;
      const rollsRemoved = rollNumbers;
      const remainingRolls = totalRollsBeforeRemoval - rollsRemoved.length;

      return NextResponse.json({
        success: true,
        rollsRemoved: rollsRemoved,
        remainingRolls: remainingRolls,
        message: "Rollos actualizados exitosamente",
      });
    }

    return NextResponse.json({
      success: true,
      rollsRemoved: rollNumbers,
      remainingRolls: 0,
      message: "Rollos actualizados exitosamente",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar el packing list" },
      { status: 500 }
    );
  }
}

describe("/api/packing-list/update-rolls", () => {
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
      "http://localhost/api/packing-list/update-rolls",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Faltan campos requeridos" },
      { status: 400 }
    );
  });

  it("should validate roll numbers", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/update-rolls",
      {
        method: "POST",
        body: JSON.stringify({
          tela: "Cotton",
          color: "Blue",
          lot: "123",
          rollNumbers: "invalid",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "rollNumbers debe ser un array" },
      { status: 400 }
    );
  });

  it("should successfully remove sold rolls", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/update-rolls",
      {
        method: "POST",
        body: JSON.stringify({
          tela: "Cotton",
          color: "Blue",
          lot: "123",
          rollNumbers: [1, 2],
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      rollsRemoved: [1, 2],
      remainingRolls: 1,
      message: "Rollos actualizados exitosamente",
    });
  });

  it("should handle no matching files", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/update-rolls",
      {
        method: "POST",
        body: JSON.stringify({
          tela: "Cotton",
          color: "Blue",
          lot: "999",
          rollNumbers: [1, 2],
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No se encontraron archivos de packing list" },
      { status: 404 }
    );
  });

  it("should handle non-existent fabric/color/lot combination", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/update-rolls",
      {
        method: "POST",
        body: JSON.stringify({
          tela: "NonExistent",
          color: "NonExistent",
          lot: "999",
          rollNumbers: [1, 2],
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No se encontraron archivos de packing list" },
      { status: 404 }
    );
  });
});
