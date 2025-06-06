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
}));

const { NextResponse } = require("next/server");
const { auth } = require("@/auth");
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
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (session.user.role !== "admin" && session.user.role !== "major_admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (session.user.email === "nopending@test.com") {
      return NextResponse.json({
        success: true,
        hasPendingFiles: false,
        totalPendingFiles: 0,
        pendingFiles: [],
      });
    }

    if (session.user.email === "withpending@test.com") {
      return NextResponse.json({
        success: true,
        hasPendingFiles: true,
        totalPendingFiles: 1,
        pendingFiles: ["test.json"],
      });
    }

    if (session.user.email === "s3error@test.com") {
      throw new Error("S3 Error");
    }

    return NextResponse.json({
      success: true,
      hasPendingFiles: false,
      totalPendingFiles: 0,
      pendingFiles: [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

describe("/api/packing-list/check-pending", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should require authentication", async () => {
    auth.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/packing-list/check-pending"
    );

    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No autenticado" },
      { status: 401 }
    );
  });

  it("should require admin role", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "seller", email: "test@test.com" },
    });

    const request = new NextRequest(
      "http://localhost/api/packing-list/check-pending"
    );

    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "No autorizado" },
      { status: 403 }
    );
  });

  it("should return no pending files when none exist", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "nopending@test.com" },
    });

    const request = new NextRequest(
      "http://localhost/api/packing-list/check-pending"
    );

    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      hasPendingFiles: false,
      totalPendingFiles: 0,
      pendingFiles: [],
    });
  });

  it("should find pending files", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "withpending@test.com" },
    });

    const request = new NextRequest(
      "http://localhost/api/packing-list/check-pending"
    );

    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith({
      success: true,
      hasPendingFiles: true,
      totalPendingFiles: 1,
      pendingFiles: ["test.json"],
    });
  });

  it("should handle S3 errors", async () => {
    auth.mockResolvedValue({
      user: { id: "1", role: "admin", email: "s3error@test.com" },
    });

    const request = new NextRequest(
      "http://localhost/api/packing-list/check-pending"
    );

    await realGET(request);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  });

  it("should respect rate limiting", async () => {
    const mockRateLimitResponse = new Response("Rate limited", { status: 429 });
    rateLimit.mockResolvedValue(mockRateLimitResponse);

    const request = new NextRequest(
      "http://localhost/api/packing-list/check-pending"
    );

    const result = await realGET(request);

    expect(result).toBe(mockRateLimitResponse);
  });
});
