import { Router, type IRouter } from "express";
// import { and, eq } from "drizzle-orm";
import { db, usersTable, rolesTable, rolePermissionsTable , and, eq } from "@workspace/db";
import {
  LoginBody,
  LoginResponse,
  LogoutResponse,
  ForgotPasswordBody,
  ForgotPasswordResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
  GetMeResponse,
} from "@workspace/api-zod";
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  generateResetToken,
} from "../lib/auth";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { sendPasswordResetEmail } from "../lib/mailer";

const router: IRouter = Router();

const resetTokens = new Map<string, { email: string; expiresAt: number }>();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email.toLowerCase()), eq(usersTable.isDeleted, false)));

  if (!user || !verifyPassword(password, user.hashedPassword)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: "Account is disabled" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role, username: user.username });

  const response = LoginResponse.parse({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    },
  });

  req.log.info({ userId: user.id }, "User logged in");
  res.json(response);
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  const response = LogoutResponse.parse({ message: "Logged out successfully" });
  res.json(response);
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email.toLowerCase()), eq(usersTable.isDeleted, false)));

  if (!user) {
    res.status(404).json({ error: "No account found with this email address. Please check and try again." });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "This account has been deactivated. Please contact your administrator." });
    return;
  }

  const token = generateResetToken();
  resetTokens.set(token, {
    email: user.email,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });

  logger.info({ email: user.email }, "Password reset token generated — sending email");

  try {
    await sendPasswordResetEmail(user.email, token);
    logger.info({ email: user.email }, "Password reset email sent");
  } catch (err) {
    logger.error({ err, email: user.email }, "Failed to send password reset email");
    resetTokens.delete(token);
    res.status(500).json({ error: "Failed to send reset email. Please try again or contact support." });
    return;
  }

  res.json(
    ForgotPasswordResponse.parse({
      message: `Password reset instructions have been sent to ${user.email}.`,
    }),
  );
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { token, newPassword } = parsed.data;

  const entry = resetTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  const hashed = hashPassword(newPassword);
  await db
    .update(usersTable)
    .set({ hashedPassword: hashed })
    .where(eq(usersTable.email, entry.email));

  resetTokens.delete(token);
  logger.info({ email: entry.email }, "Password reset successful");

  res.json(ResetPasswordResponse.parse({ message: "Password reset successfully" }));
});

router.get("/auth/invite/:token", async (req, res): Promise<void> => {
  const { token } = req.params;
  const [user] = await db
    .select({ id: usersTable.id, username: usersTable.username, email: usersTable.email, inviteTokenExpiry: usersTable.inviteTokenExpiry })
    .from(usersTable)
    .where(and(eq(usersTable.inviteToken, token), eq(usersTable.isDeleted, false)));

  if (!user || !user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
    res.status(400).json({ error: "Invalid or expired invite link" });
    return;
  }
  res.json({ data: { username: user.username, email: user.email } });
});

router.post("/auth/accept-invite", async (req, res): Promise<void> => {
  const { token, password } = req.body as { token: string; password: string };
  if (!token || !password || password.length < 8) {
    res.status(400).json({ error: "Token and a password of at least 8 characters are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.inviteToken, token), eq(usersTable.isDeleted, false)));

  if (!user || !user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
    res.status(400).json({ error: "Invalid or expired invite link" });
    return;
  }

  const hashed = hashPassword(password);
  await db
    .update(usersTable)
    .set({ hashedPassword: hashed, isActive: true, inviteToken: null, inviteTokenExpiry: null })
    .where(eq(usersTable.id, user.id));

  logger.info({ userId: user.id }, "Invite accepted, account activated");
  res.json({ message: "Account activated. You can now sign in." });
});

router.get("/auth/my-permissions", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user?: { role?: string } }).user;
  if (!user?.role) { res.json({ permissions: [] }); return; }

  const rows = await db
    .select({ permission: rolePermissionsTable.permission })
    .from(rolePermissionsTable)
    .innerJoin(rolesTable, eq(rolesTable.id, rolePermissionsTable.roleId))
    .where(
      and(
        eq(rolesTable.name, user.role),
        eq(rolePermissionsTable.isDeleted, false),
        eq(rolesTable.isDeleted, false),
      ),
    );

  res.json({ permissions: rows.map(r => r.permission) });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user?: { userId: number } }).user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [dbUser] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, user.userId), eq(usersTable.isDeleted, false)));

  if (!dbUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  let permissions: string[] = [];

  if (dbUser.roleId) {
    const rolePermissions = await db
      .select({
        permission: rolePermissionsTable.permission,
      })
      .from(rolePermissionsTable)
      .where(
        and(
          eq(rolePermissionsTable.roleId, dbUser.roleId),
          eq(rolePermissionsTable.isDeleted, false),
        ),
      );

    permissions = rolePermissions.map((item) => item.permission);
  }

  res.json(
    GetMeResponse.parse({
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      role: dbUser.role,
      roleId: dbUser.roleId,
      isActive: dbUser.isActive,
      createdAt: dbUser.createdAt.toISOString(),
      permissions,
    }),
  );
});

export default router;
