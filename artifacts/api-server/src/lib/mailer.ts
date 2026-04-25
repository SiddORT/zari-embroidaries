import nodemailer from "nodemailer";

function createTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error("EMAIL_USER and EMAIL_PASS environment variables are required for sending emails.");
  }

  // Auto-detect host from EMAIL_HOST env, fall back to Gmail
  const host = process.env.EMAIL_HOST ?? "smtp.gmail.com";
  const port = parseInt(process.env.EMAIL_PORT ?? "587", 10);
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const transporter = createTransporter();
  const from = process.env.EMAIL_FROM ?? process.env.EMAIL_USER;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { margin: 0; padding: 0; background: #f8f9fb; font-family: 'Helvetica Neue', Arial, sans-serif; }
        .wrapper { max-width: 520px; margin: 40px auto; }
        .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .header { background: #111111; padding: 28px 32px; text-align: center; }
        .header-title { color: #C6AF4B; font-size: 24px; font-weight: 700; letter-spacing: 1px; margin: 0; }
        .header-sub { color: #888; font-size: 12px; margin: 4px 0 0; letter-spacing: 0.5px; }
        .body { padding: 32px; }
        .body h2 { margin: 0 0 10px; font-size: 18px; color: #1C1C1C; }
        .body p { margin: 0 0 16px; font-size: 14px; color: #4B5563; line-height: 1.6; }
        .token-box { background: #FDF8E7; border: 1.5px solid #C6AF4B; border-radius: 8px; padding: 16px 20px; text-align: center; margin: 20px 0; }
        .token { font-size: 26px; font-weight: 700; letter-spacing: 4px; color: #111111; font-family: monospace; }
        .note { font-size: 12px; color: #9CA3AF; margin-top: 8px; }
        .footer { padding: 20px 32px; background: #F9FAFB; border-top: 1px solid #F0F0F0; text-align: center; }
        .footer p { margin: 0; font-size: 11px; color: #9CA3AF; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="card">
          <div class="header">
            <p class="header-title">ZARI ERP</p>
            <p class="header-sub">ENTERPRISE RESOURCE PLANNING</p>
          </div>
          <div class="body">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset the password for the account associated with <strong>${to}</strong>.</p>
            <p>Use the token below on the password reset page. This token is valid for <strong>15 minutes</strong>.</p>
            <div class="token-box">
              <div class="token">${token}</div>
              <div class="note">Copy and paste this token into the reset form</div>
            </div>
            <p>If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
          </div>
          <div class="footer">
            <p>ZARI Embroideries &copy; ${new Date().getFullYear()} &mdash; This is an automated message, please do not reply.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"ZARI ERP" <${from}>`,
    to,
    subject: "Your ZARI ERP Password Reset Token",
    html,
    text: `Your ZARI ERP password reset token is: ${token}\n\nThis token expires in 15 minutes.\n\nIf you did not request this, ignore this email.`,
  });
}
