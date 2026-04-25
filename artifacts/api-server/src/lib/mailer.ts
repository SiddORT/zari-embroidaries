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

export async function sendInviteEmail(to: string, username: string, inviteUrl: string): Promise<void> {
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
        .btn { display: inline-block; background: #C6AF4B; color: #111111 !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 13px 28px; border-radius: 8px; letter-spacing: 0.3px; }
        .url-box { background: #f8f9fb; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 16px; margin: 16px 0; word-break: break-all; font-size: 11px; color: #6B7280; font-family: monospace; }
        .note { font-size: 12px; color: #9CA3AF; margin-top: 4px; }
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
            <h2>You've been invited, ${username}!</h2>
            <p>An administrator has created an account for you on <strong>ZARI ERP</strong>. Click the button below to set your password and activate your account.</p>
            <p style="text-align:center; margin: 28px 0;">
              <a href="${inviteUrl}" class="btn">Set Password &amp; Activate Account</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <div class="url-box">${inviteUrl}</div>
            <p class="note">This invite link expires in <strong>7 days</strong>. If you were not expecting this invitation, you can safely ignore this email.</p>
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
    subject: `You've been invited to ZARI ERP`,
    html,
    text: `Hi ${username},\n\nYou've been invited to ZARI ERP. Click the link below to set your password:\n\n${inviteUrl}\n\nThis link expires in 7 days.`,
  });
}

export async function sendAdminPasswordResetEmail(to: string, username: string, inviteUrl: string): Promise<void> {
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
        .alert { background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #92400E; }
        .btn { display: inline-block; background: #C6AF4B; color: #111111 !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 13px 28px; border-radius: 8px; letter-spacing: 0.3px; }
        .url-box { background: #f8f9fb; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 16px; margin: 16px 0; word-break: break-all; font-size: 11px; color: #6B7280; font-family: monospace; }
        .note { font-size: 12px; color: #9CA3AF; margin-top: 4px; }
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
            <h2>Password Reset by Administrator</h2>
            <div class="alert">⚠️ An administrator has reset your password. Please set a new password using the link below.</div>
            <p>Hi <strong>${username}</strong>, your ZARI ERP password has been reset. Click the button below to choose a new password and restore your access.</p>
            <p style="text-align:center; margin: 28px 0;">
              <a href="${inviteUrl}" class="btn">Set New Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <div class="url-box">${inviteUrl}</div>
            <p class="note">This link expires in <strong>7 days</strong>. If you did not request a reset, contact your administrator immediately.</p>
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
    subject: `ZARI ERP — Your password has been reset`,
    html,
    text: `Hi ${username},\n\nAn administrator has reset your ZARI ERP password.\n\nClick the link below to set a new password:\n${inviteUrl}\n\nThis link expires in 7 days.`,
  });
}

export async function sendPoApprovalRequestEmail(opts: {
  adminEmails: string[];
  poNumber: string;
  vendorName: string;
  createdBy: string;
  referenceType: "Swatch" | "Style";
  referenceId: number | string;
  orderCode?: string;
  itemCount: number;
  erpUrl: string;
}): Promise<void> {
  const transporter = createTransporter();
  const from = process.env.EMAIL_FROM ?? process.env.EMAIL_USER;
  const { adminEmails, poNumber, vendorName, createdBy, referenceType, orderCode, itemCount, erpUrl } = opts;

  const refLabel = referenceType === "Swatch" ? "Swatch Order" : "Style Order";
  const refValue = orderCode ?? String(opts.referenceId);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { margin: 0; padding: 0; background: #f8f9fb; font-family: 'Helvetica Neue', Arial, sans-serif; }
        .wrapper { max-width: 540px; margin: 40px auto; }
        .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .header { background: #111111; padding: 24px 32px; }
        .header-title { color: #C6AF4B; font-size: 22px; font-weight: 700; letter-spacing: 1px; margin: 0; }
        .header-sub { color: #888; font-size: 11px; margin: 4px 0 0; letter-spacing: 0.5px; }
        .alert-bar { background: #FEF3C7; border-left: 4px solid #C6AF4B; padding: 12px 20px; font-size: 13px; color: #92400E; font-weight: 600; }
        .body { padding: 28px 32px; }
        .body h2 { margin: 0 0 8px; font-size: 17px; color: #1C1C1C; }
        .body p { margin: 0 0 14px; font-size: 14px; color: #4B5563; line-height: 1.6; }
        .info-grid { background: #FAFAF8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px 20px; margin: 18px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #F0F0F0; font-size: 13px; }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #6B7280; font-weight: 500; }
        .info-value { color: #111111; font-weight: 600; }
        .btn { display: inline-block; background: #C6AF4B; color: #111111 !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 13px 32px; border-radius: 8px; letter-spacing: 0.3px; }
        .footer { padding: 18px 32px; background: #F9FAFB; border-top: 1px solid #F0F0F0; text-align: center; }
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
          <div class="alert-bar">⏳ Action Required: Purchase Order Awaiting Your Approval</div>
          <div class="body">
            <h2>New Purchase Order — Approval Needed</h2>
            <p>A new Purchase Order has been created and is waiting for your approval before any purchase receipts can be raised.</p>
            <div class="info-grid">
              <div class="info-row"><span class="info-label">PO Number</span><span class="info-value">${poNumber}</span></div>
              <div class="info-row"><span class="info-label">Vendor</span><span class="info-value">${vendorName}</span></div>
              <div class="info-row"><span class="info-label">${refLabel}</span><span class="info-value">${refValue}</span></div>
              <div class="info-row"><span class="info-label">Items</span><span class="info-value">${itemCount} line item${itemCount !== 1 ? "s" : ""}</span></div>
              <div class="info-row"><span class="info-label">Created By</span><span class="info-value">${createdBy}</span></div>
              <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color:#D97706;">Draft — Pending Approval</span></div>
            </div>
            <p style="text-align:center; margin: 24px 0;">
              <a href="${erpUrl}" class="btn">Review &amp; Approve in ZARI ERP</a>
            </p>
            <p style="font-size:12px; color:#9CA3AF;">Once approved, purchase receipts will be enabled for this order. If you did not expect this PO, please contact the creator.</p>
          </div>
          <div class="footer">
            <p>ZARI Embroideries &copy; ${new Date().getFullYear()} &mdash; This is an automated notification, please do not reply.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"ZARI ERP" <${from}>`,
    to: adminEmails.join(", "),
    subject: `[Action Required] PO ${poNumber} — Approve to enable Purchase Receipts`,
    html,
    text: `A new Purchase Order (${poNumber}) from vendor "${vendorName}" has been created for ${refLabel} ${refValue} by ${createdBy}.\n\nPlease log in to ZARI ERP to review and approve it:\n${erpUrl}\n\nOnce approved, purchase receipts will be enabled.`,
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
