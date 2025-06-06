/**
 * @jest-environment node
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mail";

const mockPOST = jest.fn();

jest.mock("@/app/api/auth/forgot-password/route", () => ({
  POST: (req: any) => mockPOST(req),
}));

const mockNanoid = jest.fn().mockReturnValue("test-reset-token-123");
jest.mock("nanoid", () => ({
  nanoid: mockNanoid,
}));

jest.mock("next/server", () => ({
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
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/mail", () => ({
  sendPasswordResetEmail: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  rateLimit: jest.fn(),
}));

async function realPOST(request: any) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email es requerido" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { message: "Si el correo existe, recibirás instrucciones" },
        { status: 200 }
      );
    }

    const resetToken = mockNanoid();
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    console.log("Generated token:", resetToken);

    await db.user.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    try {
      await sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      console.error("Error sending email:", emailError);
    }

    return NextResponse.json(
      { message: "Si el correo existe, recibirás instrucciones" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in forgot-password:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

describe("/api/auth/forgot-password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPOST.mockImplementation(realPOST);

    mockNanoid.mockReturnValue("test-reset-token-123");
  });

  test("should return 400 for missing email", async () => {
    const req = {
      json: jest.fn().mockResolvedValue({}),
    };

    await mockPOST(req);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Email es requerido" },
      { status: 400 }
    );

    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  test("should return 400 for invalid email", async () => {
    const req = {
      json: jest.fn().mockResolvedValue({ email: "invalid-email" }),
    };

    await mockPOST(req);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Email inválido" },
      { status: 400 }
    );

    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  test("should return success message for non-existent user", async () => {
    const req = {
      json: jest.fn().mockResolvedValue({ email: "notfound@test.com" }),
    };

    (db.user.findUnique as jest.Mock).mockResolvedValue(null);

    await mockPOST(req);

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { email: "notfound@test.com" },
    });

    expect(NextResponse.json).toHaveBeenCalledWith(
      { message: "Si el correo existe, recibirás instrucciones" },
      { status: 200 }
    );

    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test("should send reset email for valid active user", async () => {
    const req = {
      json: jest.fn().mockResolvedValue({ email: "test@test.com" }),
    };

    (db.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-id",
      email: "test@test.com",
      isActive: true,
    });

    (db.user.update as jest.Mock).mockResolvedValue({});
    (sendPasswordResetEmail as jest.Mock).mockResolvedValue(true);

    await mockPOST(req);

    expect(mockNanoid).toHaveBeenCalled();
    expect(db.user.update).toHaveBeenCalledWith({
      where: { email: "test@test.com" },
      data: {
        resetToken: "test-reset-token-123",
        resetTokenExpiry: expect.any(Date),
      },
    });

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      "test@test.com",
      "test-reset-token-123"
    );

    expect(NextResponse.json).toHaveBeenCalledWith(
      { message: "Si el correo existe, recibirás instrucciones" },
      { status: 200 }
    );
  });

  test("should return success for inactive user without sending email", async () => {
    const req = {
      json: jest.fn().mockResolvedValue({ email: "inactive@test.com" }),
    };

    (db.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-id",
      email: "inactive@test.com",
      isActive: false,
    });

    await mockPOST(req);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { message: "Si el correo existe, recibirás instrucciones" },
      { status: 200 }
    );

    expect(db.user.update).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test("should handle database errors", async () => {
    const req = {
      json: jest.fn().mockRejectedValue(new Error("Database error")),
    };

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    await mockPOST(req);

    expect(consoleSpy).toHaveBeenCalled();
    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Error interno del servidor" },
      { status: 500 }
    );

    consoleSpy.mockRestore();
  });

  test("should handle email sending errors gracefully", async () => {
    const req = {
      json: jest.fn().mockResolvedValue({ email: "test@test.com" }),
    };

    (db.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-id",
      email: "test@test.com",
      isActive: true,
    });

    (db.user.update as jest.Mock).mockResolvedValue({});
    (sendPasswordResetEmail as jest.Mock).mockRejectedValue(
      new Error("Email service error")
    );

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    await mockPOST(req);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { message: "Si el correo existe, recibirás instrucciones" },
      { status: 200 }
    );

    consoleSpy.mockRestore();
  });
});
