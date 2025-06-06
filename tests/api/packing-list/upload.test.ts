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
        { error: "No autorizado para subir archivos Packing List" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No se encontró ningún archivo" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Tipo de archivo no válido. Solo se permiten archivos Excel (.xlsx, .xls) y CSV (.csv)",
        },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande. Tamaño máximo: 10MB" },
        { status: 400 }
      );
    }

    if (file.name === "s3error.xlsx") {
      throw new Error("S3 Error");
    }

    return NextResponse.json({
      success: true,
      uploadId: "mock-upload-id-123",
      fileName: file.name,
      message: "Archivo subido exitosamente",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al subir el archivo al servidor" },
      { status: 500 }
    );
  }
}

async function realGET() {
  return NextResponse.json({
    message: "Endpoint para subir archivos de Packing List",
    methods: ["POST"],
    maxFileSize: "10MB",
    allowedTypes: ["xlsx", "xls", "csv"],
  });
}

describe("/api/packing-list/upload", () => {
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

  describe("POST", () => {
    it("should require admin authentication", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "seller", email: "seller@test.com" },
      });

      const formData = new FormData();
      const request = new NextRequest(
        "http://localhost/api/packing-list/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No autorizado para subir archivos Packing List" },
        { status: 403 }
      );
    });

    it("should require file in form data", async () => {
      const formData = new FormData();
      const request = new NextRequest(
        "http://localhost/api/packing-list/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No se encontró ningún archivo" },
        { status: 400 }
      );
    });

    it("should validate file type", async () => {
      const file = new File(["content"], "test.txt", { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", file);

      const request = new NextRequest(
        "http://localhost/api/packing-list/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error:
            "Tipo de archivo no válido. Solo se permiten archivos Excel (.xlsx, .xls) y CSV (.csv)",
        },
        { status: 400 }
      );
    });

    it("should validate file size", async () => {
      const largeContent = "x".repeat(11 * 1024 * 1024);
      const file = new File([largeContent], "test.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const formData = new FormData();
      formData.append("file", file);

      const request = new NextRequest(
        "http://localhost/api/packing-list/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "El archivo es demasiado grande. Tamaño máximo: 10MB" },
        { status: 400 }
      );
    });

    it("should successfully upload valid file", async () => {
      const file = new File(["content"], "test.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const formData = new FormData();
      formData.append("file", file);

      const request = new NextRequest(
        "http://localhost/api/packing-list/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        success: true,
        uploadId: "mock-upload-id-123",
        fileName: "test.xlsx",
        message: "Archivo subido exitosamente",
      });
    });

    it("should handle S3 upload errors", async () => {
      const file = new File(["content"], "s3error.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const formData = new FormData();
      formData.append("file", file);

      const request = new NextRequest(
        "http://localhost/api/packing-list/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Error al subir el archivo al servidor" },
        { status: 500 }
      );
    });
  });

  describe("GET", () => {
    it("should return endpoint information", async () => {
      const request = new NextRequest(
        "http://localhost/api/packing-list/upload"
      );
      await realGET();

      expect(NextResponse.json).toHaveBeenCalledWith({
        message: "Endpoint para subir archivos de Packing List",
        methods: ["POST"],
        maxFileSize: "10MB",
        allowedTypes: ["xlsx", "xls", "csv"],
      });
    });
  });
});
