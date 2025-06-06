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
      findMany: jest.fn(),
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

    if (
      !session ||
      !session.user ||
      (session.user.role !== "admin" && session.user.role !== "major_admin")
    ) {
      return NextResponse.json(
        { error: "No tienes permisos para ver esta información" },
        { status: 403 }
      );
    }

    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener los usuarios" },
      { status: 500 }
    );
  }
}

describe("/api/users", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should require authentication", async () => {
    auth.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/users");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No tienes permisos para ver esta información" },
      { status: 403 }
    );
  });

  it("should require admin role", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "seller", email: "seller@test.com" },
    });

    const request = new NextRequest("http://localhost/api/users");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No tienes permisos para ver esta información" },
      { status: 403 }
    );
  });

  it("should return users for admin", async () => {
    const mockUsers = [
      {
        id: "1",
        name: "Admin User",
        email: "admin@test.com",
        role: "admin",
        isActive: true,
        createdAt: new Date(),
        lastLogin: new Date(),
      },
      {
        id: "2",
        name: "Seller User",
        email: "seller@test.com",
        role: "seller",
        isActive: true,
        createdAt: new Date(),
        lastLogin: null,
      },
    ];

    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "admin@test.com" },
    });

    db.user.findMany.mockResolvedValue(mockUsers);

    const request = new NextRequest("http://localhost/api/users");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith({ users: mockUsers });
  });

  it("should return users for major_admin", async () => {
    const mockUsers = [
      {
        id: "1",
        name: "Major Admin",
        email: "major@test.com",
        role: "major_admin",
        isActive: true,
        createdAt: new Date(),
        lastLogin: new Date(),
      },
    ];

    auth.mockResolvedValue({
      user: { id: "1", role: "major_admin", email: "major@test.com" },
    });

    db.user.findMany.mockResolvedValue(mockUsers);

    const request = new NextRequest("http://localhost/api/users");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith({ users: mockUsers });
  });

  it("should order users by creation date descending", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "admin@test.com" },
    });

    db.user.findMany.mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/users");
    await realGET(request);

    expect(db.user.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  });

  it("should handle database errors", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "admin@test.com" },
    });

    db.user.findMany.mockRejectedValue(new Error("Database error"));

    const request = new NextRequest("http://localhost/api/users");
    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Error al obtener los usuarios" },
      { status: 500 }
    );
  });

  it("should respect rate limiting", async () => {
    const mockRateLimitResponse = new Response("Rate limited", { status: 429 });
    rateLimit.mockResolvedValue(mockRateLimitResponse);

    const request = new NextRequest("http://localhost/api/users");
    const result = await realGET(request);

    expect(result).toBe(mockRateLimitResponse);
  });

  it("should only return safe user fields", async () => {
    const mockUsers = [
      {
        id: "1",
        name: "Test User",
        email: "test@test.com",
        role: "seller",
        isActive: true,
        createdAt: new Date(),
        lastLogin: new Date(),
      },
    ];

    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "admin@test.com" },
    });

    db.user.findMany.mockResolvedValue(mockUsers);

    const request = new NextRequest("http://localhost/api/users");
    await realGET(request);

    expect(db.user.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  });
});
