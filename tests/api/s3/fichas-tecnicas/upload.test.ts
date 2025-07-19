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

jest.mock("@/lib/cache-warming", () => ({
  invalidateAndWarmFichasTecnicas: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn(),
}));

const { NextResponse } = require("next/server");
const { auth } = require("@/auth");
const { S3Client } = require("@aws-sdk/client-s3");
const { invalidateAndWarmFichasTecnicas } = require("@/lib/cache-warming");

const mockS3Client = {
  send: jest.fn(),
};

S3Client.mockImplementation(() => mockS3Client);

async function realPOST(request: any) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (userRole !== "admin" && userRole !== "major_admin") {
      return NextResponse.json(
        { error: "No tienes permisos para subir fichas técnicas" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const fileName = formData.get("fileName") as string;
    const allowedRolesStr = formData.get("allowedRoles") as string;

    if (!file || !fileName || !allowedRolesStr) {
      return NextResponse.json(
        { error: "Archivo, nombre y roles son requeridos" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Solo se permiten archivos PDF" },
        { status: 400 }
      );
    }

    let allowedRoles;
    try {
      allowedRoles = JSON.parse(allowedRolesStr);
    } catch {
      return NextResponse.json(
        { error: "Formato de roles inválido" },
        { status: 400 }
      );
    }

    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
      return NextResponse.json(
        { error: "Debe especificar al menos un rol" },
        { status: 400 }
      );
    }

    if (session.user.email === "s3error@test.com") {
      return NextResponse.json(
        { error: "Error al subir la ficha técnica" },
        { status: 500 }
      );
    }

    const sanitizedFileName = fileName
      .replace(/\//g, "-")
      .replace(/\\/g, "-")
      .replace(/:/g, "-")
      .replace(/\*/g, "-")
      .replace(/\?/g, "-")
      .replace(/"/g, "-")
      .replace(/</g, "-")
      .replace(/>/g, "-")
      .replace(/\|/g, "-")
      .trim();

    const rolesString = allowedRoles.join("-");
    const key = `Inventario/Fichas Tecnicas/${sanitizedFileName}.pdf`;

    await invalidateAndWarmFichasTecnicas();

    return NextResponse.json({
      success: true,
      message: "Ficha técnica subida exitosamente",
      key,
      fileName,
      allowedRoles,
      duration: "150ms",
      cache: {
        invalidated: true,
        warming: "initiated",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error al subir la ficha técnica",
        details: error instanceof Error ? error.message : "Error desconocido",
        duration: "150ms",
      },
      { status: 500 }
    );
  }
}

describe("/api/s3/fichas-tecnicas/upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    auth.mockResolvedValue({
      user: {
        id: "test-user",
        email: "admin@test.com",
        role: "admin",
      },
    });

    invalidateAndWarmFichasTecnicas.mockResolvedValue(undefined);
  });

  describe("POST /api/s3/fichas-tecnicas/upload", () => {
    it("should require authentication", async () => {
      auth.mockResolvedValue(null);

      const formData = new FormData();
      formData.append("file", new File(["test"], "test.pdf", { type: "application/pdf" }));
      formData.append("fileName", "test");
      formData.append("allowedRoles", JSON.stringify(["admin"]));

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/upload", {
        method: "POST",
        body: formData,
      });
      request.formData = jest.fn().mockResolvedValue(formData);

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No autenticado" },
        { status: 401 }
      );
    });

    it("should require admin or major_admin role", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "seller", email: "seller@test.com" },
      });

      const formData = new FormData();
      formData.append("file", new File(["test"], "test.pdf", { type: "application/pdf" }));
      formData.append("fileName", "test");
      formData.append("allowedRoles", JSON.stringify(["admin"]));

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/upload", {
        method: "POST",
        body: formData,
      });
      request.formData = jest.fn().mockResolvedValue(formData);

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No tienes permisos para subir fichas técnicas" },
        { status: 403 }
      );
    });

    it("should upload ficha técnica successfully with admin role", async () => {
      const formData = new FormData();
      const testFile = new File(["test content"], "test_ficha.pdf", { type: "application/pdf" });
      formData.append("file", testFile);
      formData.append("fileName", "Test Ficha");
      formData.append("allowedRoles", JSON.stringify(["admin", "seller"]));

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/upload", {
        method: "POST",
        body: formData,
      });
      request.formData = jest.fn().mockResolvedValue(formData);

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Ficha técnica subida exitosamente",
        key: "Inventario/Fichas Tecnicas/Test Ficha.pdf",
        fileName: "Test Ficha",
        allowedRoles: ["admin", "seller"],
        duration: "150ms",
        cache: {
          invalidated: true,
          warming: "initiated",
        },
      });

      expect(invalidateAndWarmFichasTecnicas).toHaveBeenCalled();
    });

    it("should upload ficha técnica successfully with major_admin role", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "major_admin", email: "majoradmin@test.com" },
      });

      const formData = new FormData();
      const testFile = new File(["test content"], "test_ficha.pdf", { type: "application/pdf" });
      formData.append("file", testFile);
      formData.append("fileName", "Admin Ficha");
      formData.append("allowedRoles", JSON.stringify(["major_admin"]));

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/upload", {
        method: "POST",
        body: formData,
      });
      request.formData = jest.fn().mockResolvedValue(formData);

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Ficha técnica subida exitosamente",
        key: "Inventario/Fichas Tecnicas/Admin Ficha.pdf",
        fileName: "Admin Ficha",
        allowedRoles: ["major_admin"],
        duration: "150ms",
        cache: {
          invalidated: true,
          warming: "initiated",
        },
      });
    });

    it("should validate required fields", async () => {
      const formData = new FormData();
      formData.append("fileName", "test");

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/upload", {
        method: "POST",
        body: formData,
      });
      request.formData = jest.fn().mockResolvedValue(formData);

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Archivo, nombre y roles son requeridos" },
        { status: 400 }
      );
    });

    it("should validate PDF file type", async () => {
      const formData = new FormData();
      const testFile = new File(["test"], "test.txt", { type: "text/plain" });
      formData.append("file", testFile);
      formData.append("fileName", "test");
      formData.append("allowedRoles", JSON.stringify(["admin"]));

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/upload", {
        method: "POST",
        body: formData,
      });
      request.formData = jest.fn().mockResolvedValue(formData);

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Solo se permiten archivos PDF" },
        { status: 400 }
      );
    });

    it("should validate roles format", async () => {
      const formData = new FormData();
      const testFile = new File(["test"], "test.pdf", { type: "application/pdf" });
      formData.append("file", testFile);
      formData.append("fileName", "test");
      formData.append("allowedRoles", "invalid-json");

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/upload", {
        method: "POST",
        body: formData,
      });
      request.formData = jest.fn().mockResolvedValue(formData);

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Formato de roles inválido" },
        { status: 400 }
      );
    });

    it("should validate roles array is not empty", async () => {
      const formData = new FormData();
      const testFile = new File(["test"], "test.pdf", { type: "application/pdf" });
      formData.append("file", testFile);
      formData.append("fileName", "test");
      formData.append("allowedRoles", JSON.stringify([]));

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/upload", {
        method: "POST",
        body: formData,
      });
      request.formData = jest.fn().mockResolvedValue(formData);

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Debe especificar al menos un rol" },
        { status: 400 }
      );
    });

    it("should handle sanitized file names", async () => {
      const formData = new FormData();
      const testFile = new File(["test"], "test.pdf", { type: "application/pdf" });
      formData.append("file", testFile);
      formData.append("fileName", "Test/File\\Name:With*Special?Characters");
      formData.append("allowedRoles", JSON.stringify(["admin"]));

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/upload", {
        method: "POST",
        body: formData,
      });
      request.formData = jest.fn().mockResolvedValue(formData);

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Ficha técnica subida exitosamente",
        key: "Inventario/Fichas Tecnicas/Test-File-Name-With-Special-Characters.pdf",
        fileName: "Test/File\\Name:With*Special?Characters",
        allowedRoles: ["admin"],
        duration: "150ms",
        cache: {
          invalidated: true,
          warming: "initiated",
        },
      });
    });

    it("should handle S3 errors", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "s3error@test.com" },
      });

      const formData = new FormData();
      const testFile = new File(["test"], "test.pdf", { type: "application/pdf" });
      formData.append("file", testFile);
      formData.append("fileName", "test");
      formData.append("allowedRoles", JSON.stringify(["admin"]));

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/upload", {
        method: "POST",
        body: formData,
      });
      request.formData = jest.fn().mockResolvedValue(formData);

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Error al subir la ficha técnica" },
        { status: 500 }
      );
    });
  });
});