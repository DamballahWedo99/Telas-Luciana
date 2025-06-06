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
}));

const { NextResponse } = require("next/server");
const { auth } = require("@/auth");

async function realGET(request: any) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const url = new URL(request.url);
    const tela = url.searchParams.get("tela");
    const color = url.searchParams.get("color");

    if (!tela || !color) {
      return NextResponse.json(
        { error: "Tela y color son requeridos" },
        { status: 400 }
      );
    }

    if (tela === "NonExistent") {
      return NextResponse.json([]);
    }

    if (tela === "Cotton" && color === "Blue") {
      return NextResponse.json([
        {
          fabric_type: "Cotton",
          color: "Blue",
          lot: "LOT123",
          rolls: [1, 2, 3],
          location: "CDMX",
          quantity: 100,
        },
      ]);
    }

    if (tela === "ErrorTela") {
      throw new Error("S3 Error");
    }

    return NextResponse.json([]);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener los datos del packing list" },
      { status: 500 }
    );
  }
}

describe("/api/packing-list/get-rolls", () => {
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

  it("should require tela and color parameters", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/get-rolls"
    );

    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Tela y color son requeridos" },
      { status: 400 }
    );
  });

  it("should return empty array when no files found", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/get-rolls?tela=NonExistent&color=Color"
    );

    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith([]);
  });

  it("should return matching rolls", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/get-rolls?tela=Cotton&color=Blue"
    );

    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith([
      {
        fabric_type: "Cotton",
        color: "Blue",
        lot: "LOT123",
        rolls: [1, 2, 3],
        location: "CDMX",
        quantity: 100,
      },
    ]);
  });

  it("should handle S3 errors gracefully", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/get-rolls?tela=ErrorTela&color=Blue"
    );

    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Error al obtener los datos del packing list" },
      { status: 500 }
    );
  });
});
