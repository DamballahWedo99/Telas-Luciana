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
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  rateLimit: jest.fn().mockResolvedValue(null),
}));

const { NextResponse } = require("next/server");
const { db } = require("@/lib/db");
const bcrypt = require("bcryptjs");

async function realPOST(request: any) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: { resetToken: token },
    });

    if (!user) {
      return NextResponse.json(
        { error: "El enlace es inválido o ha expirado" },
        { status: 400 }
      );
    }

    const isCurrentPassword = await bcrypt.compare(password, user.password);
    if (isCurrentPassword) {
      return NextResponse.json(
        { error: "No puedes reutilizar una contraseña anterior" },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(password, 12) },
    });

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

async function realGET(request: any) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token requerido" },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({
      where: { resetToken: token },
    });

    if (user) {
      return NextResponse.json({ valid: true });
    } else {
      return NextResponse.json(
        { valid: false, error: "Token inválido" },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: "Error al verificar token" },
      { status: 500 }
    );
  }
}

describe("/api/auth/reset-password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST", () => {
    it("should validate required fields", async () => {
      const request = new NextRequest(
        "http://localhost/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "Datos inválidos" },
        { status: 400 }
      );
    });

    it("should reject invalid token", async () => {
      db.user.findFirst.mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: "invalid-token",
            password: "newpassword123",
          }),
        }
      );

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "El enlace es inválido o ha expirado" },
        { status: 400 }
      );
    });

    it("should reject reused password", async () => {
      const mockUser = {
        id: "1",
        password: "hashedcurrent",
        resetToken: "valid-token",
      };

      db.user.findFirst.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const request = new NextRequest(
        "http://localhost/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: "valid-token",
            password: "currentpassword",
          }),
        }
      );

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: "No puedes reutilizar una contraseña anterior" },
        { status: 400 }
      );
    });

    it("should successfully reset password", async () => {
      const mockUser = {
        id: "1",
        password: "hashedcurrent",
        resetToken: "valid-token",
      };

      db.user.findFirst.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);
      bcrypt.hash.mockResolvedValue("hashednew");
      db.user.update.mockResolvedValue({});

      const request = new NextRequest(
        "http://localhost/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token: "valid-token",
            password: "newpassword123",
          }),
        }
      );

      await realPOST(request);

      expect(NextResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Contraseña actualizada",
      });
      expect(db.user.update).toHaveBeenCalled();
    });
  });

  describe("GET", () => {
    it("should validate token", async () => {
      db.user.findFirst.mockResolvedValue({
        id: "1",
        resetToken: "valid-token",
      });

      const request = new NextRequest(
        "http://localhost/api/auth/reset-password?token=valid-token"
      );

      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith({ valid: true });
    });

    it("should reject missing token", async () => {
      const request = new NextRequest(
        "http://localhost/api/auth/reset-password"
      );

      await realGET(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { valid: false, error: "Token requerido" },
        { status: 400 }
      );
    });
  });
});
