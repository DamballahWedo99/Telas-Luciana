/**
 * @jest-environment node
 */

import { POST } from "@/app/api/contact/route";
import { NextRequest } from "next/server";
import { sendContactEmail } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/mail");
jest.mock("@/lib/rate-limit");

const mockSendEmail = sendContactEmail as jest.MockedFunction<
  typeof sendContactEmail
>;
const mockRateLimit = rateLimit as jest.MockedFunction<typeof rateLimit>;

describe("/api/contact", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockResolvedValue(null);
  });

  it("should validate required fields", async () => {
    const request = new NextRequest("http://localhost/api/contact", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Todos los campos son obligatorios");
  });

  it("should validate email format", async () => {
    const request = new NextRequest("http://localhost/api/contact", {
      method: "POST",
      body: JSON.stringify({
        name: "Test User",
        email: "invalid-email",
        subject: "Test Subject",
        message: "Test Message",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Email inválido");
  });

  it("should validate message length", async () => {
    const longMessage = "a".repeat(2001);
    const request = new NextRequest("http://localhost/api/contact", {
      method: "POST",
      body: JSON.stringify({
        name: "Test User",
        email: "test@test.com",
        subject: "Test Subject",
        message: longMessage,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Mensaje demasiado largo");
  });

  it("should send email successfully", async () => {
    mockSendEmail.mockResolvedValue({ success: true });

    const request = new NextRequest("http://localhost/api/contact", {
      method: "POST",
      body: JSON.stringify({
        name: "Test User",
        email: "test@test.com",
        subject: "Test Subject",
        message: "Test Message",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Correo enviado exitosamente");
    expect(mockSendEmail).toHaveBeenCalledWith(
      "Test User",
      "test@test.com",
      "Test Subject",
      "Test Message"
    );
  });

  it("should handle email sending failure", async () => {
    mockSendEmail.mockResolvedValue({ success: false, error: "SMTP Error" });

    const request = new NextRequest("http://localhost/api/contact", {
      method: "POST",
      body: JSON.stringify({
        name: "Test User",
        email: "test@test.com",
        subject: "Test Subject",
        message: "Test Message",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe("SMTP Error");
  });
});
