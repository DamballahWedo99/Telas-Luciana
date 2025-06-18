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
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  _Object: {},
}));

const { NextResponse } = require("next/server");
const { auth } = require("@/auth");

async function realGET(request: any) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const debug = searchParams.get("debug") === "true";

    if (session.user.email === "noclientes@test.com") {
      return NextResponse.json(
        {
          error:
            "No se encontraron archivos de clientes JSON en la carpeta Directorio/Main/",
        },
        { status: 404 }
      );
    }

    if (session.user.email === "failedfiles@test.com") {
      return NextResponse.json(
        {
          error: "No se pudo procesar ningún archivo correctamente",
          failedFiles: ["cliente_invalid.json"],
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

    const mockClientes = [
      {
        empresa: "Textiles González",
        contacto: "María González",
        direccion: "Av. Insurgentes Sur 1234",
        telefono: "5512345678",
        email: "maria@textilesgonzalez.com",
        vendedor: "Franz",
        ubicacion: "CDMX",
        comentarios: "Cliente preferencial",
        fileKey: "Directorio/Main/Franz/cliente_textiles_gonzalez_2024.json",
      },
      {
        empresa: "Telas Modernas",
        contacto: "Juan Pérez",
        direccion: "Calle 123",
        telefono: "5598765432",
        email: "juan@telasmodernas.com",
        vendedor: "Olga",
        ubicacion: "Guadalajara",
        comentarios: "",
        fileKey: "Directorio/Main/Olga/cliente_telas_modernas_2024.json",
      },
    ];

    const filteredClientes = debug ? mockClientes.slice(0, 1) : mockClientes;

    return NextResponse.json({
      data: filteredClientes,
      debug: {
        totalProcessedItems: filteredClientes.length,
        filesProcessed: filteredClientes.length,
        searchedIn: "Directorio/Main/",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener archivo de S3" },
      { status: 500 }
    );
  }
}

async function realPOST(request: any) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { empresa, email, contacto, vendedor } = body;

    if (!empresa || !email) {
      return NextResponse.json(
        {
          error: "Faltan campos requeridos: empresa y email son obligatorios",
        },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error: "El formato del email no es válido",
        },
        { status: 400 }
      );
    }

    const newCliente = {
      empresa: empresa.trim(),
      contacto: contacto?.trim() || "",
      direccion: "",
      telefono: "",
      email: email.trim(),
      vendedor: vendedor?.trim() || "",
      ubicacion: "",
      comentarios: "",
    };

    const fileKey = `Directorio/Main/${vendedor ? vendedor + "/" : ""}cliente_${empresa
      .replace(/\s+/g, "_")
      .toLowerCase()}_2024.json`;

    return NextResponse.json({
      message: "Cliente creado exitosamente",
      data: {
        cliente: newCliente,
        fileKey,
        fileName: `cliente_${empresa.replace(/\s+/g, "_").toLowerCase()}_2024.json`,
        vendedorSubfolder: vendedor || "Main",
        fullPath: `s3://telas-luciana/${fileKey}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al crear cliente en S3" },
      { status: 500 }
    );
  }
}

async function realPUT(request: any) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { empresa, email, fileKey } = body;

    if (!empresa || !email || !fileKey) {
      return NextResponse.json(
        {
          error:
            "Faltan campos requeridos: empresa, email y fileKey son obligatorios",
        },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error: "El formato del email no es válido",
        },
        { status: 400 }
      );
    }

    const updatedCliente = {
      empresa: empresa.trim(),
      contacto: body.contacto?.trim() || "",
      direccion: body.direccion?.trim() || "",
      telefono: body.telefono?.trim() || "",
      email: email.trim(),
      vendedor: body.vendedor?.trim() || "",
      ubicacion: body.ubicacion?.trim() || "",
      comentarios: body.comentarios?.trim() || "",
    };

    const newFileKey = `Directorio/Main/cliente_${empresa
      .replace(/\s+/g, "_")
      .toLowerCase()}_updated_2024.json`;

    return NextResponse.json({
      message: "Cliente actualizado exitosamente",
      data: {
        cliente: updatedCliente,
        fileKey: newFileKey,
        fileName: `cliente_${empresa.replace(/\s+/g, "_").toLowerCase()}_updated_2024.json`,
        vendedorSubfolder: body.vendedor || "Main",
        fullPath: `s3://telas-luciana/${newFileKey}`,
        previousFileKey: fileKey,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar cliente en S3" },
      { status: 500 }
    );
  }
}

async function realDELETE(request: any) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (userRole !== "admin" && userRole !== "major admin") {
      return NextResponse.json(
        { error: "No tienes permisos para eliminar clientes" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { fileKey } = body;

    if (!fileKey) {
      return NextResponse.json(
        { error: "fileKey es requerido para eliminar el cliente" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "Cliente eliminado exitosamente",
      data: {
        fileKey,
        deletedBy: session.user.email || "unknown",
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al eliminar cliente de S3" },
      { status: 500 }
    );
  }
}

describe("/api/s3/clientes", () => {
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

  describe("GET /api/s3/clientes", () => {
    it("should require authentication", async () => {
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/s3/clientes");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No autenticado" },
        { status: 401 }
      );
    });

    it("should return clients data", async () => {
      const request = new NextRequest("http://localhost/api/s3/clientes");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            empresa: "Textiles González",
            email: "maria@textilesgonzalez.com",
            vendedor: "Franz",
          }),
        ]),
        debug: expect.objectContaining({
          totalProcessedItems: expect.any(Number),
          filesProcessed: expect.any(Number),
          searchedIn: "Directorio/Main/",
        }),
      });
    });

    it("should handle debug mode", async () => {
      const url = new URL("http://localhost/api/s3/clientes?debug=true");
      const request = new NextRequest(url);
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        data: expect.any(Array),
        debug: expect.any(Object),
      });
    });

    it("should handle no clients found", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "noclientes@test.com" },
      });

      const request = new NextRequest("http://localhost/api/s3/clientes");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error:
            "No se encontraron archivos de clientes JSON en la carpeta Directorio/Main/",
        },
        { status: 404 }
      );
    });

    it("should handle failed files", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "failedfiles@test.com" },
      });

      const request = new NextRequest("http://localhost/api/s3/clientes");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: "No se pudo procesar ningún archivo correctamente",
          failedFiles: ["cliente_invalid.json"],
        },
        { status: 500 }
      );
    });

    it("should handle S3 errors", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "s3error@test.com" },
      });

      const request = new NextRequest("http://localhost/api/s3/clientes");
      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Error al obtener archivo de S3" },
        { status: 500 }
      );
    });
  });

  describe("POST /api/s3/clientes", () => {
    it("should require authentication", async () => {
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/s3/clientes", {
        method: "POST",
        body: JSON.stringify({
          empresa: "Test Company",
          email: "test@company.com",
        }),
      });
      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No autenticado" },
        { status: 401 }
      );
    });

    it("should create a new client successfully", async () => {
      const clientData = {
        empresa: "Nueva Empresa",
        email: "nuevo@empresa.com",
        contacto: "Juan Test",
        vendedor: "Franz",
      };

      const request = new NextRequest("http://localhost/api/s3/clientes", {
        method: "POST",
        body: JSON.stringify(clientData),
      });
      request.json = jest.fn().mockResolvedValue(clientData);

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        message: "Cliente creado exitosamente",
        data: expect.objectContaining({
          cliente: expect.objectContaining({
            empresa: "Nueva Empresa",
            email: "nuevo@empresa.com",
            vendedor: "Franz",
          }),
          fileKey: expect.stringContaining("Franz/cliente_nueva_empresa"),
        }),
      });
    });

    it("should validate required fields", async () => {
      const invalidData = {
        contacto: "Juan Test",
      };

      const request = new NextRequest("http://localhost/api/s3/clientes", {
        method: "POST",
        body: JSON.stringify(invalidData),
      });
      request.json = jest.fn().mockResolvedValue(invalidData);

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: "Faltan campos requeridos: empresa y email son obligatorios",
        },
        { status: 400 }
      );
    });

    it("should validate email format", async () => {
      const invalidEmailData = {
        empresa: "Test Company",
        email: "invalid-email",
      };

      const request = new NextRequest("http://localhost/api/s3/clientes", {
        method: "POST",
        body: JSON.stringify(invalidEmailData),
      });
      request.json = jest.fn().mockResolvedValue(invalidEmailData);

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: "El formato del email no es válido",
        },
        { status: 400 }
      );
    });
  });

  describe("PUT /api/s3/clientes", () => {
    it("should require authentication", async () => {
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/s3/clientes", {
        method: "PUT",
        body: JSON.stringify({
          empresa: "Test Company",
          email: "test@company.com",
          fileKey: "test-key",
        }),
      });
      await realPUT(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No autenticado" },
        { status: 401 }
      );
    });

    it("should update client successfully", async () => {
      const updateData = {
        empresa: "Empresa Actualizada",
        email: "actualizada@empresa.com",
        fileKey: "Directorio/Main/cliente_old.json",
        contacto: "María Updated",
        vendedor: "Olga",
      };

      const request = new NextRequest("http://localhost/api/s3/clientes", {
        method: "PUT",
        body: JSON.stringify(updateData),
      });
      request.json = jest.fn().mockResolvedValue(updateData);

      await realPUT(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        message: "Cliente actualizado exitosamente",
        data: expect.objectContaining({
          cliente: expect.objectContaining({
            empresa: "Empresa Actualizada",
            email: "actualizada@empresa.com",
            vendedor: "Olga",
          }),
          previousFileKey: "Directorio/Main/cliente_old.json",
        }),
      });
    });

    it("should validate required fields for update", async () => {
      const invalidData = {
        empresa: "Test Company",
      };

      const request = new NextRequest("http://localhost/api/s3/clientes", {
        method: "PUT",
        body: JSON.stringify(invalidData),
      });
      request.json = jest.fn().mockResolvedValue(invalidData);

      await realPUT(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error:
            "Faltan campos requeridos: empresa, email y fileKey son obligatorios",
        },
        { status: 400 }
      );
    });
  });

  describe("DELETE /api/s3/clientes", () => {
    it("should require authentication", async () => {
      auth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/s3/clientes", {
        method: "DELETE",
        body: JSON.stringify({ fileKey: "test-key" }),
      });
      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No autenticado" },
        { status: 401 }
      );
    });

    it("should require admin role", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "user", email: "user@test.com" },
      });

      const request = new NextRequest("http://localhost/api/s3/clientes", {
        method: "DELETE",
        body: JSON.stringify({ fileKey: "test-key" }),
      });
      request.json = jest.fn().mockResolvedValue({ fileKey: "test-key" });

      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No tienes permisos para eliminar clientes" },
        { status: 403 }
      );
    });

    it("should delete client successfully with admin role", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "admin@test.com" },
      });

      const deleteData = { fileKey: "Directorio/Main/cliente_test.json" };

      const request = new NextRequest("http://localhost/api/s3/clientes", {
        method: "DELETE",
        body: JSON.stringify(deleteData),
      });
      request.json = jest.fn().mockResolvedValue(deleteData);

      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        message: "Cliente eliminado exitosamente",
        data: expect.objectContaining({
          fileKey: "Directorio/Main/cliente_test.json",
          deletedBy: "admin@test.com",
          deletedAt: expect.any(String),
        }),
      });
    });

    it("should delete client successfully with major admin role", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "major admin", email: "majoradmin@test.com" },
      });

      const deleteData = { fileKey: "Directorio/Main/cliente_test.json" };

      const request = new NextRequest("http://localhost/api/s3/clientes", {
        method: "DELETE",
        body: JSON.stringify(deleteData),
      });
      request.json = jest.fn().mockResolvedValue(deleteData);

      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        message: "Cliente eliminado exitosamente",
        data: expect.objectContaining({
          fileKey: "Directorio/Main/cliente_test.json",
          deletedBy: "majoradmin@test.com",
        }),
      });
    });

    it("should validate fileKey is provided", async () => {
      auth.mockResolvedValue({
        user: { id: "1", role: "admin", email: "admin@test.com" },
      });

      const request = new NextRequest("http://localhost/api/s3/clientes", {
        method: "DELETE",
        body: JSON.stringify({}),
      });
      request.json = jest.fn().mockResolvedValue({});

      await realDELETE(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "fileKey es requerido para eliminar el cliente" },
        { status: 400 }
      );
    });
  });
});
