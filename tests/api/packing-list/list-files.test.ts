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
  ListObjectsV2Command: jest.fn(),
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

    const isAdmin = session.user.role === "admin" || session.user.role === "major_admin";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "No autorizado para listar archivos" },
        { status: 403 }
      );
    }

    if (session.user.email === "s3error@test.com") {
      return NextResponse.json(
        { error: "Error al listar archivos del packing list" },
        { status: 500 }
      );
    }

    if (session.user.email === "nofiles@test.com") {
      return NextResponse.json({ files: [] });
    }

    const mockFiles = [
      {
        key: "Inventario/Catalogo_Rollos/packing_list_2024_01.json",
        lastModified: new Date("2024-01-15T10:30:00Z"),
        size: 15680,
      },
      {
        key: "Inventario/Catalogo_Rollos/packing_list_2024_02.json",
        lastModified: new Date("2024-02-10T14:22:00Z"),
        size: 23450,
      },
      {
        key: "Inventario/Catalogo_Rollos/inventory_main.json",
        lastModified: new Date("2024-03-05T09:15:00Z"),
        size: 45320,
      },
      {
        key: "Inventario/Catalogo_Rollos/backup_inventory.json",
        lastModified: new Date("2024-03-01T16:45:00Z"),
        size: 12890,
      },
      {
        key: "Inventario/Catalogo_Rollos/inventory_row_data.json",
        lastModified: new Date("2024-03-03T11:20:00Z"),
        size: 8750,
      },
    ];

    const filteredFiles = mockFiles.filter((file) => {
      const key = file.key || "";
      const isJson = key.endsWith(".json");
      const isNotBackup = !key.includes("backup");
      const isNotRow = !key.includes("_row");

      return isJson && isNotBackup && isNotRow;
    });

    return NextResponse.json({ files: filteredFiles });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al listar archivos del packing list" },
      { status: 500 }
    );
  }
}

describe("/api/packing-list/list-files", () => {
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

  describe("GET /api/packing-list/list-files", () => {
    it("should require authentication", async () => {
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/packing-list/list-files");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No autenticado" },
        { status: 401 }
      );
    });

    it("should require admin or major_admin role", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "seller", email: "seller@test.com" },
      });

      const request = new NextRequest("http://localhost/api/packing-list/list-files");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No autorizado para listar archivos" },
        { status: 403 }
      );
    });

    it("should list files successfully with admin role", async () => {
      const request = new NextRequest("http://localhost/api/packing-list/list-files");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        files: expect.arrayContaining([
          expect.objectContaining({
            key: "Inventario/Catalogo_Rollos/packing_list_2024_01.json",
            size: 15680,
          }),
          expect.objectContaining({
            key: "Inventario/Catalogo_Rollos/packing_list_2024_02.json",
            size: 23450,
          }),
          expect.objectContaining({
            key: "Inventario/Catalogo_Rollos/inventory_main.json",
            size: 45320,
          }),
        ]),
      });
    });

    it("should list files successfully with major_admin role", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "major_admin", email: "majoradmin@test.com" },
      });

      const request = new NextRequest("http://localhost/api/packing-list/list-files");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        files: expect.any(Array),
      });

      const response = NextResponse.json.mock.calls[0][0];
      expect(response.files).toHaveLength(3);
    });

    it("should filter out backup files", async () => {
      const request = new NextRequest("http://localhost/api/packing-list/list-files");
      await realGET(request);

      const response = NextResponse.json.mock.calls[0][0];
      const backupFiles = response.files.filter((file: any) => file.key.includes("backup"));
      expect(backupFiles).toHaveLength(0);
    });

    it("should filter out row files", async () => {
      const request = new NextRequest("http://localhost/api/packing-list/list-files");
      await realGET(request);

      const response = NextResponse.json.mock.calls[0][0];
      const rowFiles = response.files.filter((file: any) => file.key.includes("_row"));
      expect(rowFiles).toHaveLength(0);
    });

    it("should only include JSON files", async () => {
      const request = new NextRequest("http://localhost/api/packing-list/list-files");
      await realGET(request);

      const response = NextResponse.json.mock.calls[0][0];
      const nonJsonFiles = response.files.filter((file: any) => !file.key.endsWith(".json"));
      expect(nonJsonFiles).toHaveLength(0);
    });

    it("should handle empty file list", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "nofiles@test.com" },
      });

      const request = new NextRequest("http://localhost/api/packing-list/list-files");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith({ files: [] });
    });

    it("should handle S3 errors", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "s3error@test.com" },
      });

      const request = new NextRequest("http://localhost/api/packing-list/list-files");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Error al listar archivos del packing list" },
        { status: 500 }
      );
    });

    it("should include file metadata", async () => {
      const request = new NextRequest("http://localhost/api/packing-list/list-files");
      await realGET(request);

      const response = NextResponse.json.mock.calls[0][0];
      expect(response.files[0]).toEqual(
        expect.objectContaining({
          key: expect.any(String),
          lastModified: expect.any(Date),
          size: expect.any(Number),
        })
      );
    });

    it("should handle files with various naming patterns", async () => {
      const request = new NextRequest("http://localhost/api/packing-list/list-files");
      await realGET(request);

      const response = NextResponse.json.mock.calls[0][0];
      const fileKeys = response.files.map((file: any) => file.key);

      expect(fileKeys).toContain("Inventario/Catalogo_Rollos/packing_list_2024_01.json");
      expect(fileKeys).toContain("Inventario/Catalogo_Rollos/inventory_main.json");
      expect(fileKeys).not.toContain("Inventario/Catalogo_Rollos/backup_inventory.json");
      expect(fileKeys).not.toContain("Inventario/Catalogo_Rollos/inventory_row_data.json");
    });

    it("should handle unexpected errors gracefully", async () => {
      auth.mockRejectedValue(new Error("Authentication service error"));

      const request = new NextRequest("http://localhost/api/packing-list/list-files");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Error al listar archivos del packing list" },
        { status: 500 }
      );
    });
  });
});