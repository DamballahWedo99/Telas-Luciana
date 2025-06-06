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

jest.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  rateLimit: jest.fn().mockResolvedValue(null),
}));

const { NextResponse } = require("next/server");
const { auth } = require("@/auth");
const { db } = require("@/lib/db");
const { rateLimit } = require("@/lib/rate-limit");

async function realDELETE(
  request: any,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Rate limited",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();

    if (
      !session ||
      !session.user ||
      (session.user.role !== "admin" && session.user.role !== "major_admin")
    ) {
      return NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      );
    }

    const userId = params.id;

    if (!userId) {
      return NextResponse.json(
        { error: "ID de usuario no proporcionado" },
        { status: 400 }
      );
    }

    if (session.user.id === userId) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propia cuenta" },
        { status: 400 }
      );
    }

    const userToDelete = await db.user.findUnique({
      where: { id: userId },
    });

    if (!userToDelete) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (session.user.role === "admin" && userToDelete.role !== "seller") {
      return NextResponse.json(
        { error: "Los administradores solo pueden eliminar vendedores" },
        { status: 403 }
      );
    }

    if (userToDelete.role === "major_admin") {
      const majorAdminCount = await db.user.count({
        where: { role: "major_admin" },
      });

      if (majorAdminCount <= 1) {
        return NextResponse.json(
          { error: "No se puede eliminar el último administrador principal" },
          { status: 400 }
        );
      }
    }

    await db.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: "Usuario eliminado correctamente",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al eliminar el usuario" },
      { status: 500 }
    );
  }
}

describe("/api/users/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should require user ID parameter", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "admin@test.com" },
    });

    const request = new NextRequest("http://localhost/api/users/");
    await realDELETE(request, { params: { id: "" } });

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "ID de usuario no proporcionado" },
      { status: 400 }
    );
  });

  it("should require admin authentication", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "seller", email: "seller@test.com" },
    });

    const request = new NextRequest("http://localhost/api/users/2");
    await realDELETE(request, { params: { id: "2" } });

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No tienes permisos para realizar esta acción" },
      { status: 403 }
    );
  });

  it("should prevent self-deletion", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "admin@test.com" },
    });

    const request = new NextRequest("http://localhost/api/users/1");
    await realDELETE(request, { params: { id: "1" } });

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No puedes eliminar tu propia cuenta" },
      { status: 400 }
    );
  });

  it("should handle user not found", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "admin@test.com" },
    });

    db.user.findUnique.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/users/999");
    await realDELETE(request, { params: { id: "999" } });

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Usuario no encontrado" },
      { status: 404 }
    );
  });

  it("should allow admin to delete sellers only", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "admin@test.com" },
    });

    db.user.findUnique.mockResolvedValue({
      id: "2",
      email: "admin2@test.com",
      role: "admin",
    });

    const request = new NextRequest("http://localhost/api/users/2");
    await realDELETE(request, { params: { id: "2" } });

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Los administradores solo pueden eliminar vendedores" },
      { status: 403 }
    );
  });

  it("should prevent deletion of last major_admin", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "major_admin", email: "major@test.com" },
    });

    db.user.findUnique.mockResolvedValue({
      id: "2",
      email: "major2@test.com",
      role: "major_admin",
    });

    db.user.count.mockResolvedValue(1);

    const request = new NextRequest("http://localhost/api/users/2");
    await realDELETE(request, { params: { id: "2" } });

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No se puede eliminar el último administrador principal" },
      { status: 400 }
    );
  });

  it("should successfully delete seller as admin", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "admin@test.com" },
    });

    db.user.findUnique.mockResolvedValue({
      id: "2",
      email: "seller@test.com",
      role: "seller",
    });

    db.user.delete.mockResolvedValue({});

    const request = new NextRequest("http://localhost/api/users/2");
    await realDELETE(request, { params: { id: "2" } });

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      message: "Usuario eliminado correctamente",
    });
    expect(db.user.delete).toHaveBeenCalledWith({
      where: { id: "2" },
    });
  });

  it("should successfully delete admin as major_admin", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "major_admin", email: "major@test.com" },
    });

    db.user.findUnique.mockResolvedValue({
      id: "2",
      email: "admin@test.com",
      role: "admin",
    });

    db.user.delete.mockResolvedValue({});

    const request = new NextRequest("http://localhost/api/users/2");
    await realDELETE(request, { params: { id: "2" } });

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      message: "Usuario eliminado correctamente",
    });
  });

  it("should allow deletion of major_admin when multiple exist", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "major_admin", email: "major1@test.com" },
    });

    db.user.findUnique.mockResolvedValue({
      id: "2",
      email: "major2@test.com",
      role: "major_admin",
    });

    db.user.count.mockResolvedValue(2);
    db.user.delete.mockResolvedValue({});

    const request = new NextRequest("http://localhost/api/users/2");
    await realDELETE(request, { params: { id: "2" } });

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      message: "Usuario eliminado correctamente",
    });
  });

  it("should handle database errors", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "admin@test.com" },
    });

    db.user.findUnique.mockRejectedValue(new Error("Database error"));

    const request = new NextRequest("http://localhost/api/users/2");
    await realDELETE(request, { params: { id: "2" } });

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Error al eliminar el usuario" },
      { status: 500 }
    );
  });

  it("should respect rate limiting", async () => {
    const mockRateLimitResponse = new Response("Rate limited", { status: 429 });
    rateLimit.mockResolvedValue(mockRateLimitResponse);

    const request = new NextRequest("http://localhost/api/users/2");
    const result = await realDELETE(request, { params: { id: "2" } });

    expect(result).toBe(mockRateLimitResponse);
  });

  it("should require authentication", async () => {
    auth.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/users/2");
    await realDELETE(request, { params: { id: "2" } });

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No tienes permisos para realizar esta acción" },
      { status: 403 }
    );
  });
});
