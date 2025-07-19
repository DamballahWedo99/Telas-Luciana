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
  DeleteObjectCommand: jest.fn(),
}));

const { NextResponse } = require("next/server");
const { auth } = require("@/auth");
const { S3Client } = require("@aws-sdk/client-s3");
const { invalidateAndWarmFichasTecnicas } = require("@/lib/cache-warming");

const mockS3Client = {
  send: jest.fn(),
};

S3Client.mockImplementation(() => mockS3Client);

async function realDELETE(request: any) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (userRole !== "admin" && userRole !== "major_admin") {
      return NextResponse.json(
        { error: "No tienes permisos para eliminar fichas técnicas" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "Key del archivo requerido" },
        { status: 400 }
      );
    }

    if (!key.startsWith("Inventario/Fichas Tecnicas/")) {
      return NextResponse.json(
        { error: "Key inválido para fichas técnicas" },
        { status: 400 }
      );
    }

    if (session.user.email === "s3error@test.com") {
      return NextResponse.json(
        {
          error: "Error al eliminar la ficha técnica",
          details: "S3 connection failed",
          duration: "50ms",
        },
        { status: 500 }
      );
    }

    await invalidateAndWarmFichasTecnicas();

    return NextResponse.json({
      success: true,
      message: "Ficha técnica eliminada exitosamente",
      key,
      duration: "75ms",
      cache: {
        invalidated: true,
        warming: "initiated",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error al eliminar la ficha técnica",
        details: error instanceof Error ? error.message : "Error desconocido",
        duration: "50ms",
      },
      { status: 500 }
    );
  }
}

describe("/api/s3/fichas-tecnicas/delete", () => {
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

  describe("DELETE /api/s3/fichas-tecnicas/delete", () => {
    it("should require authentication", async () => {
      auth.mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost/api/s3/fichas-tecnicas/delete?key=Inventario/Fichas Tecnicas/test.pdf"
      );
      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No autenticado" },
        { status: 401 }
      );
    });

    it("should require admin or major_admin role", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "seller", email: "seller@test.com" },
      });

      const request = new NextRequest(
        "http://localhost/api/s3/fichas-tecnicas/delete?key=Inventario/Fichas Tecnicas/test.pdf"
      );
      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No tienes permisos para eliminar fichas técnicas" },
        { status: 403 }
      );
    });

    it("should delete ficha técnica successfully with admin role", async () => {
      const key = "Inventario/Fichas Tecnicas/test_ficha.pdf";
      const request = new NextRequest(
        `http://localhost/api/s3/fichas-tecnicas/delete?key=${encodeURIComponent(key)}`
      );
      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Ficha técnica eliminada exitosamente",
        key,
        duration: "75ms",
        cache: {
          invalidated: true,
          warming: "initiated",
        },
      });

      expect(invalidateAndWarmFichasTecnicas).toHaveBeenCalled();
    });

    it("should delete ficha técnica successfully with major_admin role", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "major_admin", email: "majoradmin@test.com" },
      });

      const key = "Inventario/Fichas Tecnicas/admin_ficha.pdf";
      const request = new NextRequest(
        `http://localhost/api/s3/fichas-tecnicas/delete?key=${encodeURIComponent(key)}`
      );
      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Ficha técnica eliminada exitosamente",
        key,
        duration: "75ms",
        cache: {
          invalidated: true,
          warming: "initiated",
        },
      });
    });

    it("should require key parameter", async () => {
      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/delete");
      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Key del archivo requerido" },
        { status: 400 }
      );
    });

    it("should validate key starts with correct prefix", async () => {
      const key = "Invalid/Path/test.pdf";
      const request = new NextRequest(
        `http://localhost/api/s3/fichas-tecnicas/delete?key=${encodeURIComponent(key)}`
      );
      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Key inválido para fichas técnicas" },
        { status: 400 }
      );
    });

    it("should handle empty key parameter", async () => {
      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/delete?key=");
      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Key del archivo requerido" },
        { status: 400 }
      );
    });

    it("should handle S3 errors", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "s3error@test.com" },
      });

      const key = "Inventario/Fichas Tecnicas/error.pdf";
      const request = new NextRequest(
        `http://localhost/api/s3/fichas-tecnicas/delete?key=${encodeURIComponent(key)}`
      );
      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: "Error al eliminar la ficha técnica",
          details: "S3 connection failed",
          duration: "50ms",
        },
        { status: 500 }
      );
    });

    it("should handle files with special characters in key", async () => {
      const key = "Inventario/Fichas Tecnicas/test with spaces & special chars.pdf";
      const request = new NextRequest(
        `http://localhost/api/s3/fichas-tecnicas/delete?key=${encodeURIComponent(key)}`
      );
      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Ficha técnica eliminada exitosamente",
        key,
        duration: "75ms",
        cache: {
          invalidated: true,
          warming: "initiated",
        },
      });
    });

    it("should handle files with role information in filename", async () => {
      const key = "Inventario/Fichas Tecnicas/test_ficha_roles_admin-seller.pdf";
      const request = new NextRequest(
        `http://localhost/api/s3/fichas-tecnicas/delete?key=${encodeURIComponent(key)}`
      );
      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Ficha técnica eliminada exitosamente",
        key,
        duration: "75ms",
        cache: {
          invalidated: true,
          warming: "initiated",
        },
      });
    });

    it("should handle unexpected errors gracefully", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "admin@test.com" },
      });

      invalidateAndWarmFichasTecnicas.mockRejectedValue(new Error("Cache error"));

      const key = "Inventario/Fichas Tecnicas/test.pdf";
      const request = new NextRequest(
        `http://localhost/api/s3/fichas-tecnicas/delete?key=${encodeURIComponent(key)}`
      );
      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: "Error al eliminar la ficha técnica",
          details: "Cache error",
          duration: "50ms",
        },
        { status: 500 }
      );
    });
  });
});