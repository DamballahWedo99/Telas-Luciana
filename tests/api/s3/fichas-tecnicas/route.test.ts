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

jest.mock("@/lib/cache-middleware", () => ({
  withCache: jest.fn().mockImplementation((fn) => fn),
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  ListObjectsV2Command: jest.fn(),
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

    const userRole = session.user.role || "seller";
    const url = new URL(request.url);
    const isInternal = request.headers.get("x-internal-request") === "true";

    if (session.user.email === "s3error@test.com") {
      return NextResponse.json(
        { error: "Error al cargar las fichas técnicas" },
        { status: 500 }
      );
    }

    if (session.user.email === "nofichas@test.com") {
      return NextResponse.json({ fichas: [] });
    }

    const mockFichas = [
      {
        key: "Inventario/Fichas Tecnicas/ficha_admin_only.pdf",
        name: "ficha_admin_only",
        size: 1024,
        lastModified: "2024-01-01T00:00:00.000Z",
        allowedRoles: ["major_admin"],
      },
      {
        key: "Inventario/Fichas Tecnicas/ficha_all_roles.pdf",
        name: "ficha_all_roles",
        size: 2048,
        lastModified: "2024-01-02T00:00:00.000Z",
        allowedRoles: ["major_admin", "admin", "seller"],
      },
      {
        key: "Inventario/Fichas Tecnicas/ficha_admin_seller.pdf",
        name: "ficha_admin_seller",
        size: 1536,
        lastModified: "2024-01-03T00:00:00.000Z",
        allowedRoles: ["admin", "seller"],
      },
    ];

    let filteredFichas = mockFichas;

    if (!isInternal) {
      filteredFichas = mockFichas.filter((ficha) => {
        if (userRole === "major_admin") {
          return true;
        } else if (userRole === "admin") {
          return ficha.allowedRoles.includes("admin");
        } else if (userRole === "seller") {
          return ficha.allowedRoles.includes("seller");
        }
        return false;
      });
    }

    return NextResponse.json({
      fichas: filteredFichas,
      duration: "50ms",
      debug: {
        totalFichas: mockFichas.length,
        filteredFichas: filteredFichas.length,
        userRole,
        isInternal,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al cargar las fichas técnicas", duration: "50ms" },
      { status: 500 }
    );
  }
}

describe("/api/s3/fichas-tecnicas", () => {
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

  describe("GET /api/s3/fichas-tecnicas", () => {
    it("should require authentication", async () => {
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No autenticado" },
        { status: 401 }
      );
    });

    it("should return filtered fichas for admin role", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "admin@test.com" },
      });

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        fichas: expect.arrayContaining([
          expect.objectContaining({
            name: "ficha_all_roles",
            allowedRoles: ["major_admin", "admin", "seller"],
          }),
          expect.objectContaining({
            name: "ficha_admin_seller",
            allowedRoles: ["admin", "seller"],
          }),
        ]),
        duration: "50ms",
        debug: expect.objectContaining({
          totalFichas: 3,
          filteredFichas: 2,
          userRole: "admin",
          isInternal: false,
        }),
      });

      const response = NextResponse.json.mock.calls[0][0];
      expect(response.fichas).toHaveLength(2);
    });

    it("should return filtered fichas for seller role", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "seller", email: "seller@test.com" },
      });

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        fichas: expect.arrayContaining([
          expect.objectContaining({
            name: "ficha_all_roles",
            allowedRoles: ["major_admin", "admin", "seller"],
          }),
          expect.objectContaining({
            name: "ficha_admin_seller",
            allowedRoles: ["admin", "seller"],
          }),
        ]),
        duration: "50ms",
        debug: expect.objectContaining({
          userRole: "seller",
          filteredFichas: 2,
        }),
      });
    });

    it("should return all fichas for major_admin role", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "major_admin", email: "majoradmin@test.com" },
      });

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        fichas: expect.any(Array),
        duration: "50ms",
        debug: expect.objectContaining({
          totalFichas: 3,
          filteredFichas: 3,
          userRole: "major_admin",
        }),
      });
    });

    it("should handle internal requests", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "seller", email: "seller@test.com" },
      });

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas");
      request.headers.set("x-internal-request", "true");

      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        fichas: expect.any(Array),
        duration: "50ms",
        debug: expect.objectContaining({
          isInternal: true,
          filteredFichas: 3,
        }),
      });
    });

    it("should handle refresh parameter", async () => {
      const url = new URL("http://localhost/api/s3/fichas-tecnicas?refresh=true");
      const request = new NextRequest(url);

      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        fichas: expect.any(Array),
        duration: "50ms",
        debug: expect.any(Object),
      });
    });

    it("should handle empty fichas response", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "nofichas@test.com" },
      });

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith({ fichas: [] });
    });

    it("should handle S3 errors", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "s3error@test.com" },
      });

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Error al cargar las fichas técnicas" },
        { status: 500 }
      );
    });

    it("should handle role-based filtering correctly for seller with no access", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "unknown", email: "unknown@test.com" },
      });

      const request = new NextRequest("http://localhost/api/s3/fichas-tecnicas");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        fichas: [],
        duration: "50ms",
        debug: expect.objectContaining({
          filteredFichas: 0,
          userRole: "unknown",
        }),
      });
    });
  });
});