/**
 * Tests for password reset and email verification API routes.
 *
 * Covers:
 * - POST /api/auth/forgot-password: sends reset email, prevents enumeration
 * - POST /api/auth/reset-password: validates token, resets password
 * - GET /api/auth/verify-email: validates token, sets emailVerified
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  passwordResetToken: {
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  verificationToken: {
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const mockSendPasswordResetEmail = vi.hoisted(() => vi.fn());
const mockHashPassword = vi.hoisted(() => vi.fn());
const mockRandomBytes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

vi.mock("@/lib/auth-utils", () => ({
  hashPassword: mockHashPassword,
}));

vi.mock("crypto", async (importOriginal) => {
  const original = await importOriginal<typeof import("crypto")>();
  return {
    ...original,
    randomBytes: mockRandomBytes,
  };
});

vi.mock("@/lib/api-errors", async () => {
  const { NextResponse } = await import("next/server");
  return {
    apiError: (status: number, message: string) =>
      NextResponse.json({ error: message }, { status }),
    handleApiError: (error: unknown) => {
      console.error("API error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    },
  };
});

import { POST as forgotPasswordPOST } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordPOST } from "@/app/api/auth/reset-password/route";
import { GET as verifyEmailGET } from "@/app/api/auth/verify-email/route";

function mockRequest(body: unknown, url = "http://localhost/api/auth/forgot-password"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockGetRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRandomBytes.mockReturnValue({
      toString: () => "a".repeat(64),
    });
    mockSendPasswordResetEmail.mockResolvedValue(true);
  });

  it("returns 200 and sends email for valid credentials user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "salt:hash",
    });
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.passwordResetToken.create.mockResolvedValue({});

    const res = await forgotPasswordPOST(
      mockRequest({ email: "test@example.com" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain("reset link has been sent");
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      "test@example.com",
      "a".repeat(64)
    );
  });

  it("returns 200 for unknown email (no enumeration)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await forgotPasswordPOST(
      mockRequest({ email: "unknown@example.com" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain("reset link has been sent");
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("returns 400 for missing email", async () => {
    const res = await forgotPasswordPOST(mockRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email format", async () => {
    const res = await forgotPasswordPOST(mockRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 for OAuth-only user (no passwordHash) without sending email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "oauth-user",
      passwordHash: null,
    });

    const res = await forgotPasswordPOST(
      mockRequest({ email: "oauth@example.com" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain("reset link has been sent");
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("deletes existing tokens before creating new one", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "salt:hash",
    });
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.passwordResetToken.create.mockResolvedValue({});

    await forgotPasswordPOST(mockRequest({ email: "test@example.com" }));

    expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
    });
  });

  it("creates token with 1-hour expiry", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "salt:hash",
    });
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.passwordResetToken.create.mockResolvedValue({});

    const before = Date.now();
    await forgotPasswordPOST(mockRequest({ email: "test@example.com" }));

    const createCall = mockPrisma.passwordResetToken.create.mock.calls[0][0];
    const expires = createCall.data.expires as Date;
    const expiresMs = expires.getTime();
    // Should be approximately 1 hour from now
    expect(expiresMs).toBeGreaterThanOrEqual(before + 59 * 60 * 1000);
    expect(expiresMs).toBeLessThanOrEqual(before + 61 * 60 * 1000);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB down"));

    const res = await forgotPasswordPOST(
      mockRequest({ email: "test@example.com" })
    );
    expect(res.status).toBe(500);
  });
});

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHashPassword.mockResolvedValue("newsalt:newhash");
  });

  it("resets password with valid token", async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      token: "valid-token",
      email: "test@example.com",
      expires: new Date(Date.now() + 3600000), // 1 hour from now
    });
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    const res = await resetPasswordPOST(
      mockRequest(
        { token: "valid-token", newPassword: "newSecureP4ss!" },
        "http://localhost/api/auth/reset-password"
      )
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain("reset successfully");
    expect(mockHashPassword).toHaveBeenCalledWith("newSecureP4ss!");
  });

  it("returns 400 for expired token", async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      token: "expired-token",
      email: "test@example.com",
      expires: new Date(Date.now() - 3600000), // 1 hour ago
    });
    mockPrisma.passwordResetToken.delete.mockResolvedValue({});

    const res = await resetPasswordPOST(
      mockRequest(
        { token: "expired-token", newPassword: "newSecureP4ss!" },
        "http://localhost/api/auth/reset-password"
      )
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("expired");
  });

  it("returns 400 for invalid/nonexistent token", async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);

    const res = await resetPasswordPOST(
      mockRequest(
        { token: "nonexistent-token", newPassword: "newSecureP4ss!" },
        "http://localhost/api/auth/reset-password"
      )
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid");
  });

  it("returns 400 for missing fields", async () => {
    const res = await resetPasswordPOST(
      mockRequest({}, "http://localhost/api/auth/reset-password")
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing token", async () => {
    const res = await resetPasswordPOST(
      mockRequest(
        { newPassword: "newPass1234" },
        "http://localhost/api/auth/reset-password"
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing newPassword", async () => {
    const res = await resetPasswordPOST(
      mockRequest(
        { token: "some-token" },
        "http://localhost/api/auth/reset-password"
      )
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for short password", async () => {
    const res = await resetPasswordPOST(
      mockRequest(
        { token: "some-token", newPassword: "short" },
        "http://localhost/api/auth/reset-password"
      )
    );
    expect(res.status).toBe(400);
  });

  it("deletes token after successful reset (via transaction)", async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      token: "valid-token",
      email: "test@example.com",
      expires: new Date(Date.now() + 3600000),
    });
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    await resetPasswordPOST(
      mockRequest(
        { token: "valid-token", newPassword: "newSecureP4ss!" },
        "http://localhost/api/auth/reset-password"
      )
    );

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.anything(), // user.update
        expect.anything(), // passwordResetToken.delete
      ])
    );
  });

  it("updates password hash for correct email", async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      token: "valid-token",
      email: "test@example.com",
      expires: new Date(Date.now() + 3600000),
    });
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    await resetPasswordPOST(
      mockRequest(
        { token: "valid-token", newPassword: "newSecureP4ss!" },
        "http://localhost/api/auth/reset-password"
      )
    );

    expect(mockHashPassword).toHaveBeenCalledWith("newSecureP4ss!");
  });

  it("cleans up expired token", async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      token: "expired-token",
      email: "test@example.com",
      expires: new Date(Date.now() - 1000),
    });
    mockPrisma.passwordResetToken.delete.mockResolvedValue({});

    await resetPasswordPOST(
      mockRequest(
        { token: "expired-token", newPassword: "newSecureP4ss!" },
        "http://localhost/api/auth/reset-password"
      )
    );

    expect(mockPrisma.passwordResetToken.delete).toHaveBeenCalledWith({
      where: { token: "expired-token" },
    });
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.passwordResetToken.findUnique.mockRejectedValue(new Error("DB down"));

    const res = await resetPasswordPOST(
      mockRequest(
        { token: "valid-token", newPassword: "newSecureP4ss!" },
        "http://localhost/api/auth/reset-password"
      )
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/auth/verify-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects with success message for valid token", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue({
      token: "valid-verify-token",
      identifier: "test@example.com",
      expires: new Date(Date.now() + 3600000),
    });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.verificationToken.delete.mockResolvedValue({});

    const res = await verifyEmailGET(
      mockGetRequest("http://localhost/api/auth/verify-email?token=valid-verify-token")
    );

    expect(res.status).toBe(307); // redirect
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("message=");
    expect(location).toContain("verified");
  });

  it("sets emailVerified for valid token", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue({
      token: "valid-verify-token",
      identifier: "test@example.com",
      expires: new Date(Date.now() + 3600000),
    });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.verificationToken.delete.mockResolvedValue({});

    await verifyEmailGET(
      mockGetRequest("http://localhost/api/auth/verify-email?token=valid-verify-token")
    );

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "test@example.com" },
        data: expect.objectContaining({
          emailVerified: expect.any(Date),
        }),
      })
    );
  });

  it("redirects with error for invalid/nonexistent token", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue(null);

    const res = await verifyEmailGET(
      mockGetRequest("http://localhost/api/auth/verify-email?token=bad-token")
    );

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("error=");
  });

  it("redirects with error for expired token", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue({
      token: "expired-token",
      identifier: "test@example.com",
      expires: new Date(Date.now() - 3600000),
    });
    mockPrisma.verificationToken.delete.mockResolvedValue({});

    const res = await verifyEmailGET(
      mockGetRequest("http://localhost/api/auth/verify-email?token=expired-token")
    );

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("error=");
    expect(location).toContain("expired");
  });

  it("redirects with error when token is missing", async () => {
    const res = await verifyEmailGET(
      mockGetRequest("http://localhost/api/auth/verify-email")
    );

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("error=");
    expect(location).toContain("Missing");
  });

  it("deletes verification token after use", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue({
      token: "valid-verify-token",
      identifier: "test@example.com",
      expires: new Date(Date.now() + 3600000),
    });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.verificationToken.delete.mockResolvedValue({});

    await verifyEmailGET(
      mockGetRequest("http://localhost/api/auth/verify-email?token=valid-verify-token")
    );

    expect(mockPrisma.verificationToken.delete).toHaveBeenCalledWith({
      where: {
        identifier_token: {
          identifier: "test@example.com",
          token: "valid-verify-token",
        },
      },
    });
  });

  it("redirects to signin on unexpected error", async () => {
    mockPrisma.verificationToken.findUnique.mockRejectedValue(new Error("DB down"));

    const res = await verifyEmailGET(
      mockGetRequest("http://localhost/api/auth/verify-email?token=valid-token")
    );

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("error=");
  });
});
