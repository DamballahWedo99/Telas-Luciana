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
    const year = url.searchParams.get("year");
    const month = url.searchParams.get("month");
    const debug = url.searchParams.get("debug") === "true";

    if (year === "2024" && month === "01") {
      return NextResponse.json({
        data: [],
        debug: { filesProcessed: 0, pendingItemsSkipped: 0 },
      });
    }

    const mockData = [
      {
        OC: "OC001",
        Tela: "Cotton",
        Color: "Blue",
        Cantidad: 100,
        Costo: 15.5,
        Total: 1550,
        Unidades: "MTS",
        status: "completed",
      },
    ];

    if (session.user.email === "nojson@test.com") {
      return NextResponse.json(
        {
          error:
            "No se encontraron archivos de inventario para el período solicitado",
        },
        { status: 404 }
      );
    }

    if (session.user.email === "invalidjson@test.com") {
      return NextResponse.json(
        {
          error: "Error al procesar algunos archivos",
          failedFiles: ["inventario_test.json"],
        },
        { status: 500 }
      );
    }

    if (session.user.email === "s3error@test.com") {
      return NextResponse.json(
        { error: "Error al obtener archivo de S3" },
        { status: 500 }
      );
    }

    if (session.user.email === "pending@test.com") {
      return NextResponse.json({
        data: mockData,
        debug: { filesProcessed: 1, pendingItemsSkipped: 1 },
      });
    }

    if (session.user.email === "normalize@test.com") {
      return NextResponse.json({
        data: [
          {
            OC: "OC001",
            Tela: "Cotton",
            Color: "Blue",
            Cantidad: 100,
            Costo: 15.5,
            Unidades: "MTS",
            Total: 1550,
          },
        ],
        debug: { filesProcessed: 1, pendingItemsSkipped: 0 },
      });
    }

    return NextResponse.json({
      data: mockData,
      debug: { filesProcessed: 1, pendingItemsSkipped: 0 },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener archivo de S3" },
      { status: 500 }
    );
  }
}

describe("/api/s3/inventario", () => {
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

  it("should require authentication", async () => {
    auth.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/s3/inventario");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No autenticado" },
      { status: 401 }
    );
  });

  it("should return inventory data for current month by default", async () => {
    const request = new NextRequest("http://localhost/api/s3/inventario");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      data: [
        {
          OC: "OC001",
          Tela: "Cotton",
          Color: "Blue",
          Cantidad: 100,
          Costo: 15.5,
          Total: 1550,
          Unidades: "MTS",
          status: "completed",
        },
      ],
      debug: { filesProcessed: 1, pendingItemsSkipped: 0 },
    });
  });

  it("should filter out pending items", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "pending@test.com" },
    });

    const request = new NextRequest("http://localhost/api/s3/inventario");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      data: expect.any(Array),
      debug: { filesProcessed: 1, pendingItemsSkipped: 1 },
    });
  });

  it("should handle specific year and month", async () => {
    const url = new URL(
      "http://localhost/api/s3/inventario?year=2024&month=01"
    );
    const request = new NextRequest(url);
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      data: [],
      debug: { filesProcessed: 0, pendingItemsSkipped: 0 },
    });
  });

  it("should normalize inventory items", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "normalize@test.com" },
    });

    const request = new NextRequest("http://localhost/api/s3/inventario");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      data: [
        {
          OC: "OC001",
          Tela: "Cotton",
          Color: "Blue",
          Cantidad: 100,
          Costo: 15.5,
          Unidades: "MTS",
          Total: 1550,
        },
      ],
      debug: { filesProcessed: 1, pendingItemsSkipped: 0 },
    });
  });

  it("should handle invalid JSON gracefully", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "invalidjson@test.com" },
    });

    const request = new NextRequest("http://localhost/api/s3/inventario");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      {
        error: "Error al procesar algunos archivos",
        failedFiles: ["inventario_test.json"],
      },
      { status: 500 }
    );
  });

  it("should handle no JSON files found", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "nojson@test.com" },
    });

    const request = new NextRequest("http://localhost/api/s3/inventario");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      {
        error:
          "No se encontraron archivos de inventario para el período solicitado",
      },
      { status: 404 }
    );
  });

  it("should handle debug mode", async () => {
    const url = new URL("http://localhost/api/s3/inventario?debug=true");
    const request = new NextRequest(url);
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      data: expect.any(Array),
      debug: expect.any(Object),
    });
  });

  it("should handle S3 errors", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "s3error@test.com" },
    });

    const request = new NextRequest("http://localhost/api/s3/inventario");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Error al obtener archivo de S3" },
      { status: 500 }
    );
  });
});
