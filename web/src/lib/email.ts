/**
 * Email utility for sending transactional emails via the Resend API.
 *
 * Graceful no-op when RESEND_API_KEY is not configured — logs a warning
 * but never crashes the application.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL ?? "alerts@waterwatcher.app";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY not configured. Skipping email to ${to}: ${subject}`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend API error (${res.status}): ${body}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[email] Failed to send email:", error);
    return false;
  }
}

/**
 * Send a password reset email with a reset link.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const resetUrl = `${APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; color: #1a1a1a; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .header { background: #1e40af; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; }
    .footer { text-align: center; padding: 16px; color: #64748b; font-size: 12px; }
    .btn { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Water Watcher</h1></div>
    <div class="content">
      <h2>Reset Your Password</h2>
      <p>You requested a password reset. Click the button below to set a new password:</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${resetUrl}" class="btn">Reset Password</a>
      </p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
        Or copy this link: ${resetUrl}
      </p>
    </div>
    <div class="footer">Water Watcher &mdash; Whitewater Rafting Tracker</div>
  </div>
</body>
</html>`;

  return sendEmail(email, "Reset your Water Watcher password", html);
}

/**
 * Send an email verification link.
 */
export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; color: #1a1a1a; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .header { background: #1e40af; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; }
    .footer { text-align: center; padding: 16px; color: #64748b; font-size: 12px; }
    .btn { display: inline-block; background: #166534; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Water Watcher</h1></div>
    <div class="content">
      <h2>Verify Your Email</h2>
      <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${verifyUrl}" class="btn">Verify Email</a>
      </p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
      <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
        Or copy this link: ${verifyUrl}
      </p>
    </div>
    <div class="footer">Water Watcher &mdash; Whitewater Rafting Tracker</div>
  </div>
</body>
</html>`;

  return sendEmail(email, "Verify your Water Watcher email", html);
}
