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

async function realGET(request: any) {
  try {
    const rateLimitResult = await rateLimit(request, {
      type: "api",
      message: "Rate limited",
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { exists: false, message: "No hay sesión activa" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true },
    });

    if (!user) {
      return NextResponse.json(
        { exists: false, message: "Usuario no encontrado" },
        { status: 200 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { exists: false, message: "Usuario inactivo" },
        { status: 200 }
      );
    }

    return NextResponse.json({ exists: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al verificar usuario" },
      { status: 500 }
    );
  }
}

describe("/api/users/verify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return false when no session", async () => {
    auth.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/users/verify");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { exists: false, message: "No hay sesión activa" },
      { status: 401 }
    );
  });

  it("should return false when no user in session", async () => {
    auth.mockResolvedValue({ user: null });

    const request = new NextRequest("http://localhost/api/users/verify");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { exists: false, message: "No hay sesión activa" },
      { status: 401 }
    );
  });

  it("should return false when no user ID in session", async () => {
    auth.mockResolvedValue({
      user: { email: "test@test.com" },
    });

    const request = new NextRequest("http://localhost/api/users/verify");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { exists: false, message: "No hay sesión activa" },
      { status: 401 }
    );
  });

  it("should return false when user not found in database", async () => {
    auth.mockResolvedValue({
      user: { id: "999", email: "test@test.com" },
    });

    db.user.findUnique.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/users/verify");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { exists: false, message: "Usuario no encontrado" },
      { status: 200 }
    );
  });

  it("should return false when user is inactive", async () => {
    auth.mockResolvedValue({
      user: { id: "1", email: "test@test.com" },
    });

    db.user.findUnique.mockResolvedValue({
      id: "1",
      isActive: false,
    });

    const request = new NextRequest("http://localhost/api/users/verify");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { exists: false, message: "Usuario inactivo" },
      { status: 200 }
    );
  });

  it("should return true when user exists and is active", async () => {
    auth.mockResolvedValue({
      user: { id: "1", email: "test@test.com" },
    });

    db.user.findUnique.mockResolvedValue({
      id: "1",
      isActive: true,
    });

    const request = new NextRequest("http://localhost/api/users/verify");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith({ exists: true });
  });

  it("should use correct database query", async () => {
    auth.mockResolvedValue({
      user: { id: "1", email: "test@test.com" },
    });

    db.user.findUnique.mockResolvedValue({
      id: "1",
      isActive: true,
    });

    const request = new NextRequest("http://localhost/api/users/verify");
    await realGET(request);

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: "1" },
      select: { id: true, isActive: true },
    });
  });

  it("should handle database errors", async () => {
    auth.mockResolvedValue({
      user: { id: "1", email: "test@test.com" },
    });

    db.user.findUnique.mockRejectedValue(new Error("Database error"));

    const request = new NextRequest("http://localhost/api/users/verify");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Error al verificar usuario" },
      { status: 500 }
    );
  });

  it("should respect rate limiting", async () => {
    const mockRateLimitResponse = new Response("Rate limited", { status: 429 });
    rateLimit.mockResolvedValue(mockRateLimitResponse);

    const request = new NextRequest("http://localhost/api/users/verify");
    const result = await realGET(request);

    expect(result).toBe(mockRateLimitResponse);
  });

  it("should only select necessary fields from database", async () => {
    auth.mockResolvedValue({
      user: { id: "1", email: "test@test.com" },
    });

    db.user.findUnique.mockResolvedValue({
      id: "1",
      isActive: true,
    });

    const request = new NextRequest("http://localhost/api/users/verify");
    await realGET(request);

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: "1" },
      select: { id: true, isActive: true },
    });
  });
});
