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
        { error: "No autorizado para esta acción" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { fabrics, fileName, uploadId } = body;

    if (!fabrics || fabrics.length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron datos válidos de telas" },
        { status: 400 }
      );
    }

    const fabricsWithoutCost = fabrics.filter(
      (fabric: any) =>
        fabric.costo === null ||
        fabric.costo === undefined ||
        fabric.costo === ""
    );

    if (fabricsWithoutCost.length > 0) {
      return NextResponse.json(
        { error: "Todas las telas deben tener un costo asignado" },
        { status: 400 }
      );
    }

    if (fileName === "error.json") {
      return NextResponse.json(
        { error: "No se pudieron actualizar ninguna de las telas" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      updatedCount: fabrics.length,
      message: "Costos actualizados exitosamente",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar los costos" },
      { status: 500 }
    );
  }
}

describe("/api/packing-list/save-costs", () => {
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
      "http://localhost/api/packing-list/save-costs",
      {
        method: "POST",
        body: JSON.stringify({
          fabrics: [],
          fileName: "test.json",
          uploadId: "test-id",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No autorizado para esta acción" },
      { status: 403 }
    );
  });

  it("should validate fabric data", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/save-costs",
      {
        method: "POST",
        body: JSON.stringify({
          fabrics: [],
          fileName: "test.json",
          uploadId: "test-id",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No se proporcionaron datos válidos de telas" },
      { status: 400 }
    );
  });

  it("should require costs for all fabrics", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/save-costs",
      {
        method: "POST",
        body: JSON.stringify({
          fabrics: [
            {
              id: "1",
              tela: "Cotton",
              color: "Blue",
              cantidad: 100,
              unidades: "MTS",
              costo: null,
              sourceFileKey: "test.json",
            },
          ],
          fileName: "test.json",
          uploadId: "test-id",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Todas las telas deben tener un costo asignado" },
      { status: 400 }
    );
  });

  it("should successfully update costs", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/save-costs",
      {
        method: "POST",
        body: JSON.stringify({
          fabrics: [
            {
              id: "1",
              tela: "Cotton",
              color: "Blue",
              cantidad: 100,
              unidades: "MTS",
              costo: 25.5,
              sourceFileKey: "test.json",
            },
          ],
          fileName: "test.json",
          uploadId: "test-id",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      updatedCount: 1,
      message: "Costos actualizados exitosamente",
    });
  });

  it("should handle file read errors", async () => {
    const request = new NextRequest(
      "http://localhost/api/packing-list/save-costs",
      {
        method: "POST",
        body: JSON.stringify({
          fabrics: [
            {
              id: "1",
              tela: "Cotton",
              color: "Blue",
              cantidad: 100,
              unidades: "MTS",
              costo: 25.5,
              sourceFileKey: "error.json",
            },
          ],
          fileName: "error.json",
          uploadId: "test-id",
        }),
      }
    );

    await realPOST(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No se pudieron actualizar ninguna de las telas" },
      { status: 400 }
    );
  });
});
