/**
 * Tests for the email utility (lib/email.ts).
 *
 * Covers:
 * - sendPasswordResetEmail calls Resend API with correct payload
 * - sendVerificationEmail calls Resend API with correct payload
 * - Graceful no-op when RESEND_API_KEY not set
 * - Email content includes correct URLs/tokens
 * - Error handling for API failures
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Save originals so we can restore
const originalEnv = { ...process.env };

describe("email utility", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    // Default: API key is set
    process.env.RESEND_API_KEY = "re_test_key_123";
    process.env.NEXT_PUBLIC_APP_URL = "https://waterwatcher.app";
    process.env.NOTIFICATION_FROM_EMAIL = "test@waterwatcher.app";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    // Restore original env
    process.env.RESEND_API_KEY = originalEnv.RESEND_API_KEY;
    process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL;
    process.env.NOTIFICATION_FROM_EMAIL = originalEnv.NOTIFICATION_FROM_EMAIL;
  });

  describe("sendPasswordResetEmail", () => {
    it("calls Resend API with correct payload", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ id: "email-1" }),
      });

      const { sendPasswordResetEmail } = await import("@/lib/email");
      const result = await sendPasswordResetEmail("user@example.com", "abc123token");

      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer re_test_key_123",
          }),
        })
      );
    });

    it("includes reset URL with token in email body", async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      const { sendPasswordResetEmail } = await import("@/lib/email");
      await sendPasswordResetEmail("user@example.com", "mytoken123");

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(callBody.html).toContain("https://waterwatcher.app/auth/reset-password?token=mytoken123");
    });

    it("sends to correct recipient", async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      const { sendPasswordResetEmail } = await import("@/lib/email");
      await sendPasswordResetEmail("recipient@test.com", "token");

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(callBody.to).toBe("recipient@test.com");
    });

    it("includes correct subject", async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      const { sendPasswordResetEmail } = await import("@/lib/email");
      await sendPasswordResetEmail("user@example.com", "token");

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(callBody.subject).toContain("Reset");
    });

    it("includes Water Watcher branding in HTML", async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      const { sendPasswordResetEmail } = await import("@/lib/email");
      await sendPasswordResetEmail("user@example.com", "token");

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(callBody.html).toContain("Water Watcher");
    });

    it("returns false on API error", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const { sendPasswordResetEmail } = await import("@/lib/email");
      const result = await sendPasswordResetEmail("user@example.com", "token");

      expect(result).toBe(false);
    });

    it("returns false on network error", async () => {
      fetchSpy.mockRejectedValue(new Error("Network error"));

      const { sendPasswordResetEmail } = await import("@/lib/email");
      const result = await sendPasswordResetEmail("user@example.com", "token");

      expect(result).toBe(false);
    });
  });

  describe("sendVerificationEmail", () => {
    it("calls Resend API with correct payload", async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      const { sendVerificationEmail } = await import("@/lib/email");
      const result = await sendVerificationEmail("user@example.com", "verify-token");

      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("includes verification URL with token in email body", async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      const { sendVerificationEmail } = await import("@/lib/email");
      await sendVerificationEmail("user@example.com", "verify-abc");

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(callBody.html).toContain("https://waterwatcher.app/api/auth/verify-email?token=verify-abc");
    });

    it("sends to correct recipient", async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      const { sendVerificationEmail } = await import("@/lib/email");
      await sendVerificationEmail("new@user.com", "token");

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(callBody.to).toBe("new@user.com");
    });

    it("includes correct subject", async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      const { sendVerificationEmail } = await import("@/lib/email");
      await sendVerificationEmail("user@example.com", "token");

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(callBody.subject).toContain("Verify");
    });

    it("returns false on API error", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      });

      const { sendVerificationEmail } = await import("@/lib/email");
      const result = await sendVerificationEmail("user@example.com", "token");

      expect(result).toBe(false);
    });
  });

  describe("graceful no-op when RESEND_API_KEY not set", () => {
    it("sendPasswordResetEmail returns false without calling fetch", async () => {
      delete process.env.RESEND_API_KEY;

      const { sendPasswordResetEmail } = await import("@/lib/email");
      const result = await sendPasswordResetEmail("user@example.com", "token");

      expect(result).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("sendVerificationEmail returns false without calling fetch", async () => {
      delete process.env.RESEND_API_KEY;

      const { sendVerificationEmail } = await import("@/lib/email");
      const result = await sendVerificationEmail("user@example.com", "token");

      expect(result).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("email content structure", () => {
    it("password reset email includes DOCTYPE and HTML structure", async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      const { sendPasswordResetEmail } = await import("@/lib/email");
      await sendPasswordResetEmail("user@example.com", "token");

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(callBody.html).toContain("<!DOCTYPE html>");
      expect(callBody.html).toContain("</html>");
    });

    it("verification email includes DOCTYPE and HTML structure", async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      const { sendVerificationEmail } = await import("@/lib/email");
      await sendVerificationEmail("user@example.com", "token");

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(callBody.html).toContain("<!DOCTYPE html>");
      expect(callBody.html).toContain("</html>");
    });

    it("password reset email URL-encodes the token", async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      const { sendPasswordResetEmail } = await import("@/lib/email");
      await sendPasswordResetEmail("user@example.com", "token with spaces&special=chars");

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(callBody.html).toContain(encodeURIComponent("token with spaces&special=chars"));
    });

    it("verification email URL-encodes the token", async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      const { sendVerificationEmail } = await import("@/lib/email");
      await sendVerificationEmail("user@example.com", "token&with=special");

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(callBody.html).toContain(encodeURIComponent("token&with=special"));
    });
  });
});
