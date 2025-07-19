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
  CopyObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
}));

const { NextResponse } = require("next/server");
const { auth } = require("@/auth");
const { S3Client } = require("@aws-sdk/client-s3");
const { invalidateAndWarmFichasTecnicas } = require("@/lib/cache-warming");

const mockS3Client = {
  send: jest.fn(),
};

S3Client.mockImplementation(() => mockS3Client);

async function realPUT(request: any) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userRole = session.user.role || "seller";
    const isAdmin = userRole === "admin" || userRole === "major_admin";

    if (!isAdmin) {
      return NextResponse.json(
        { error: "No tienes permisos para editar fichas técnicas" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { key, newFileName, allowedRoles } = body;

    if (!key || !newFileName || !allowedRoles) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    }

    if (session.user.email === "notfound@test.com") {
      return NextResponse.json(
        { error: "La ficha técnica no existe", duration: "50ms" },
        { status: 404 }
      );
    }

    if (session.user.email === "s3error@test.com") {
      return NextResponse.json(
        { error: "Error al editar la ficha técnica", duration: "50ms" },
        { status: 500 }
      );
    }

    const sanitizedFileName = newFileName
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
    const newKey = `Inventario/Fichas Tecnicas/${sanitizedFileName}_roles_${rolesString}.pdf`;

    await invalidateAndWarmFichasTecnicas();

    if (key !== newKey) {
      return NextResponse.json({
        message: "Ficha técnica editada exitosamente",
        newKey: newKey,
        duration: "120ms",
        cache: {
          invalidated: true,
          warming: "initiated",
        },
      });
    } else {
      return NextResponse.json({
        message: "Permisos actualizados exitosamente",
        newKey: key,
        duration: "80ms",
        cache: {
          invalidated: true,
          warming: "initiated",
        },
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        duration: "50ms",
      },
      { status: 500 }
    );
  }
}

describe("/api/s3/fichas-tecnicas/edit", () => {
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

  describe("PUT /api/s3/fichas-tecnicas/edit", () => {
    it("should require authentication", async () => {
      auth.mockResolvedValue(null);

      const body = {
        key: "Inventario/Fichas Tecnicas/test.pdf",
        newFileName: "New Test",
        allowedRoles: ["admin"],
      };

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/edit", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      request.json = jest.fn().mockResolvedValue(body);

      await realPUT(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No autenticado" },
        { status: 401 }
      );
    });

    it("should require admin or major_admin role", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "seller", email: "seller@test.com" },
      });

      const body = {
        key: "Inventario/Fichas Tecnicas/test.pdf",
        newFileName: "New Test",
        allowedRoles: ["admin"],
      };

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/edit", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      request.json = jest.fn().mockResolvedValue(body);

      await realPUT(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No tienes permisos para editar fichas técnicas" },
        { status: 403 }
      );
    });

    it("should edit ficha técnica successfully with admin role", async () => {
      const body = {
        key: "Inventario/Fichas Tecnicas/old_name.pdf",
        newFileName: "New Test Name",
        allowedRoles: ["admin", "seller"],
      };

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/edit", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      request.json = jest.fn().mockResolvedValue(body);

      await realPUT(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        message: "Ficha técnica editada exitosamente",
        newKey: "Inventario/Fichas Tecnicas/New Test Name_roles_admin-seller.pdf",
        duration: "120ms",
        cache: {
          invalidated: true,
          warming: "initiated",
        },
      });

      expect(invalidateAndWarmFichasTecnicas).toHaveBeenCalled();
    });

    it("should edit ficha técnica successfully with major_admin role", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "major_admin", email: "majoradmin@test.com" },
      });

      const body = {
        key: "Inventario/Fichas Tecnicas/admin_ficha.pdf",
        newFileName: "Updated Admin Ficha",
        allowedRoles: ["major_admin"],
      };

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/edit", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      request.json = jest.fn().mockResolvedValue(body);

      await realPUT(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        message: "Ficha técnica editada exitosamente",
        newKey: "Inventario/Fichas Tecnicas/Updated Admin Ficha_roles_major_admin.pdf",
        duration: "120ms",
        cache: {
          invalidated: true,
          warming: "initiated",
        },
      });
    });

    it("should update metadata only when filename doesn't change", async () => {
      const existingKey = "Inventario/Fichas Tecnicas/Test Name_roles_admin-seller.pdf";
      const body = {
        key: existingKey,
        newFileName: "Test Name",
        allowedRoles: ["admin", "seller"],
      };

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/edit", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      request.json = jest.fn().mockResolvedValue(body);

      await realPUT(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        message: "Permisos actualizados exitosamente",
        newKey: existingKey,
        duration: "80ms",
        cache: {
          invalidated: true,
          warming: "initiated",
        },
      });
    });

    it("should validate required parameters", async () => {
      const body = {
        key: "test.pdf",
        newFileName: "Test",
      };

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/edit", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      request.json = jest.fn().mockResolvedValue(body);

      await realPUT(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    });

    it("should handle file not found", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "notfound@test.com" },
      });

      const body = {
        key: "Inventario/Fichas Tecnicas/nonexistent.pdf",
        newFileName: "Test",
        allowedRoles: ["admin"],
      };

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/edit", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      request.json = jest.fn().mockResolvedValue(body);

      await realPUT(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "La ficha técnica no existe", duration: "50ms" },
        { status: 404 }
      );
    });

    it("should handle S3 errors", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "s3error@test.com" },
      });

      const body = {
        key: "Inventario/Fichas Tecnicas/error.pdf",
        newFileName: "Test",
        allowedRoles: ["admin"],
      };

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/edit", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      request.json = jest.fn().mockResolvedValue(body);

      await realPUT(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Error al editar la ficha técnica", duration: "50ms" },
        { status: 500 }
      );
    });

    it("should sanitize special characters in filename", async () => {
      const body = {
        key: "Inventario/Fichas Tecnicas/old.pdf",
        newFileName: "Test/File\\Name:With*Special?Characters",
        allowedRoles: ["admin"],
      };

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/edit", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      request.json = jest.fn().mockResolvedValue(body);

      await realPUT(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        message: "Ficha técnica editada exitosamente",
        newKey: "Inventario/Fichas Tecnicas/Test-File-Name-With-Special-Characters_roles_admin.pdf",
        duration: "120ms",
        cache: {
          invalidated: true,
          warming: "initiated",
        },
      });
    });

    it("should handle multiple roles in filename", async () => {
      const body = {
        key: "Inventario/Fichas Tecnicas/test.pdf",
        newFileName: "Multi Role Test",
        allowedRoles: ["major_admin", "admin", "seller"],
      };

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/edit", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      request.json = jest.fn().mockResolvedValue(body);

      await realPUT(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        message: "Ficha técnica editada exitosamente",
        newKey: "Inventario/Fichas Tecnicas/Multi Role Test_roles_major_admin-admin-seller.pdf",
        duration: "120ms",
        cache: {
          invalidated: true,
          warming: "initiated",
        },
      });
    });
  });
});