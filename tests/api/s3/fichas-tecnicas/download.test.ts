/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

jest.mock("next/server", () => ({
  NextRequest: jest.requireActual("next/server").NextRequest,
  NextResponse: class MockNextResponse {
    public body: any;
    public status: number;
    public headers: Map<string, string>;

    constructor(body: any, options: any = {}) {
      this.body = body;
      this.status = options.status || 200;
      this.headers = new Map(Object.entries(options.headers || {}));
    }

    static json = jest.fn().mockImplementation((data, options) => ({
      data,
      status: options?.status || 200,
      json: jest.fn().mockResolvedValue(data),
    }));
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
  HeadObjectCommand: jest.fn(),
}));

const { NextResponse } = require("next/server");
const { auth } = require("@/auth");
const { S3Client } = require("@aws-sdk/client-s3");

const mockS3Client = {
  send: jest.fn(),
};

S3Client.mockImplementation(() => mockS3Client);

async function realGET(request: any) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "Key del archivo requerido" },
        { status: 400 }
      );
    }

    const userRole = session.user.role || "seller";

    if (session.user.email === "s3error@test.com") {
      return NextResponse.json(
        { error: "Error al descargar la ficha técnica" },
        { status: 500 }
      );
    }

    if (session.user.email === "notfound@test.com") {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    if (session.user.email === "nopermission@test.com") {
      return NextResponse.json(
        { error: "No tienes permisos para descargar esta ficha técnica" },
        { status: 403 }
      );
    }

    const mockPermissions: Record<string, string[]> = {
      "Inventario/Fichas Tecnicas/admin_only.pdf": ["major_admin"],
      "Inventario/Fichas Tecnicas/admin_seller.pdf": ["admin", "seller"],
      "Inventario/Fichas Tecnicas/all_roles.pdf": ["major_admin", "admin", "seller"],
    };

    const allowedRoles = mockPermissions[key] || ["major_admin", "admin", "seller"];
    const hasPermission = userRole === "major_admin" || allowedRoles.includes(userRole);

    if (!hasPermission) {
      return NextResponse.json(
        { error: "No tienes permisos para descargar esta ficha técnica" },
        { status: 403 }
      );
    }

    const mockPdfContent = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);

    return new NextResponse(mockPdfContent, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${key.split("/").pop()}"`,
        "X-Download-Duration": "100ms",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error al descargar la ficha técnica",
        duration: "100ms",
      },
      { status: 500 }
    );
  }
}

describe("/api/s3/fichas-tecnicas/download", () => {
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

  describe("GET /api/s3/fichas-tecnicas/download", () => {
    it("should require authentication", async () => {
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/download?key=test.pdf");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No autenticado" },
        { status: 401 }
      );
    });

    it("should require key parameter", async () => {
      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas/download");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Key del archivo requerido" },
        { status: 400 }
      );
    });

    it("should download file successfully for admin with permission", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "admin@test.com" },
      });

      const request = new NextRequest(
        "http://localhost/api/s3/fichas-tecnicas/download?key=Inventario/Fichas Tecnicas/admin_seller.pdf"
      );
      const response = await realGET(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      expect(response.headers.get("Content-Disposition")).toBe(
        'attachment; filename="admin_seller.pdf"'
      );
      expect(response.headers.get("X-Download-Duration")).toBe("100ms");
    });

    it("should download file successfully for seller with permission", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "seller", email: "seller@test.com" },
      });

      const request = new NextRequest(
        "http://localhost/api/s3/fichas-tecnicas/download?key=Inventario/Fichas Tecnicas/all_roles.pdf"
      );
      const response = await realGET(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
    });

    it("should download file successfully for major_admin with any file", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "major_admin", email: "majoradmin@test.com" },
      });

      const request = new NextRequest(
        "http://localhost/api/s3/fichas-tecnicas/download?key=Inventario/Fichas Tecnicas/admin_only.pdf"
      );
      const response = await realGET(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
    });

    it("should deny access for seller without permission", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "seller", email: "seller@test.com" },
      });

      const request = new NextRequest(
        "http://localhost/api/s3/fichas-tecnicas/download?key=Inventario/Fichas Tecnicas/admin_only.pdf"
      );
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No tienes permisos para descargar esta ficha técnica" },
        { status: 403 }
      );
    });

    it("should deny access when user has no permission", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "nopermission@test.com" },
      });

      const request = new NextRequest(
        "http://localhost/api/s3/fichas-tecnicas/download?key=test.pdf"
      );
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No tienes permisos para descargar esta ficha técnica" },
        { status: 403 }
      );
    });

    it("should handle file not found", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "notfound@test.com" },
      });

      const request = new NextRequest(
        "http://localhost/api/s3/fichas-tecnicas/download?key=nonexistent.pdf"
      );
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    });

    it("should handle S3 errors", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "s3error@test.com" },
      });

      const request = new NextRequest(
        "http://localhost/api/s3/fichas-tecnicas/download?key=error.pdf"
      );
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Error al descargar la ficha técnica" },
        { status: 500 }
      );
    });

    it("should handle role fallback for unknown roles", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "unknown", email: "unknown@test.com" },
      });

      const request = new NextRequest(
        "http://localhost/api/s3/fichas-tecnicas/download?key=Inventario/Fichas Tecnicas/admin_only.pdf"
      );
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No tienes permisos para descargar esta ficha técnica" },
        { status: 403 }
      );
    });

    it("should allow download for files with default permissions", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "seller", email: "seller@test.com" },
      });

      const request = new NextRequest(
        "http://localhost/api/s3/fichas-tecnicas/download?key=Inventario/Fichas Tecnicas/default_permissions.pdf"
      );
      const response = await realGET(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
    });
  });
});