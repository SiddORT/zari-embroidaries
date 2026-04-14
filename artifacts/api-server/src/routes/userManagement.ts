import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { db, usersTable, rolesTable, rolePermissionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { hashPassword } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

export const ALL_PERMISSIONS = [
  { key: "dashboard",                    label: "Dashboard",                group: "Main" },
  { key: "orders",                       label: "Orders",                   group: "Main" },
  { key: "accounts",                     label: "Accounts",                 group: "Main" },
  { key: "quotation",                    label: "Quotation",                group: "Main" },
  { key: "shipping",                     label: "Shipping",                 group: "Main" },
  { key: "masters:hsn",                  label: "HSN",                      group: "Masters" },
  { key: "masters:materials",            label: "Materials",                group: "Masters" },
  { key: "masters:fabric",               label: "Fabric",                   group: "Masters" },
  { key: "masters:clients",              label: "Clients",                  group: "Masters" },
  { key: "masters:vendors",              label: "Vendors",                  group: "Masters" },
  { key: "masters:style_categories",     label: "Style Categories",         group: "Masters" },
  { key: "masters:swatch_categories",    label: "Swatch Categories",        group: "Masters" },
  { key: "masters:swatches",             label: "Swatches",                 group: "Masters" },
  { key: "masters:styles",               label: "Styles",                   group: "Masters" },
  { key: "masters:packaging_materials",  label: "Item Master",              group: "Masters" },
  { key: "user_management",             label: "User Management",           group: "Admin" },
];

const requireAdmin = requireAuth;

async function seedSystemRoles() {
  const existing = await db.select().from(rolesTable);
  if (existing.length === 0) {
    const [adminRole] = await db.insert(rolesTable).values({
      name: "admin", description: "Full system access", isSystem: true,
    }).returning();
    await db.insert(rolesTable).values({
      name: "user", description: "Standard user access", isSystem: true,
    });
    const allKeys = ALL_PERMISSIONS.map(p => ({ roleId: adminRole.id, permission: p.key }));
    if (allKeys.length) await db.insert(rolePermissionsTable).values(allKeys);
    logger.info("System roles seeded");
  }
}

seedSystemRoles().catch(err => logger.error(err, "Failed to seed system roles"));

router.get("/user-management/permissions", requireAdmin, (_req, res): void => {
  res.json({ data: ALL_PERMISSIONS });
});

router.get("/user-management/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      role: usersTable.role,
      isActive: usersTable.isActive,
      inviteToken: usersTable.inviteToken,
      inviteTokenExpiry: usersTable.inviteTokenExpiry,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  res.json({ data: users });
});

router.post("/user-management/users", requireAdmin, async (req, res): Promise<void> => {
  const { email, username, role } = req.body as { email: string; username: string; role: string };
  if (!email || !username || !role) {
    res.status(400).json({ error: "email, username and role are required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    res.status(409).json({ error: "A user with that email already exists" });
    return;
  }

  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const tempHash = hashPassword(crypto.randomBytes(16).toString("hex"));

  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    username,
    role,
    hashedPassword: tempHash,
    isActive: false,
    inviteToken,
    inviteTokenExpiry,
  }).returning({
    id: usersTable.id, username: usersTable.username, email: usersTable.email,
    role: usersTable.role, isActive: usersTable.isActive, createdAt: usersTable.createdAt,
    inviteToken: usersTable.inviteToken, inviteTokenExpiry: usersTable.inviteTokenExpiry,
  });

  logger.info({ userId: user.id }, "User invited");
  res.status(201).json({ data: user, inviteToken });
});

router.put("/user-management/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { username, role, isActive } = req.body as { username?: string; role?: string; isActive?: boolean };

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (username !== undefined) updates.username = username;
  if (role !== undefined) updates.role = role;
  if (isActive !== undefined) updates.isActive = isActive;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning({
      id: usersTable.id, username: usersTable.username, email: usersTable.email,
      role: usersTable.role, isActive: usersTable.isActive, createdAt: usersTable.createdAt,
    });

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ data: user });
});

router.delete("/user-management/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const authUser = (req as typeof req & { user?: { userId: number } }).user;
  if (authUser?.userId === id) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ message: "User deleted" });
});

router.post("/user-management/users/:id/resend-invite", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [user] = await db
    .update(usersTable)
    .set({ inviteToken, inviteTokenExpiry, isActive: false })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, email: usersTable.email, inviteToken: usersTable.inviteToken });

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ data: user, inviteToken });
});

router.get("/user-management/roles", requireAdmin, async (_req, res): Promise<void> => {
  const roles = await db.select().from(rolesTable).orderBy(rolesTable.createdAt);
  const perms = await db.select().from(rolePermissionsTable);
  const data = roles.map(r => ({
    ...r,
    permissions: perms.filter(p => p.roleId === r.id).map(p => p.permission),
  }));
  res.json({ data });
});

router.post("/user-management/roles", requireAdmin, async (req, res): Promise<void> => {
  const { name, description } = req.body as { name: string; description?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Role name is required" }); return; }

  const existing = await db.select().from(rolesTable).where(eq(rolesTable.name, name.trim()));
  if (existing.length > 0) { res.status(409).json({ error: "Role already exists" }); return; }

  const [role] = await db.insert(rolesTable).values({ name: name.trim(), description: description ?? null }).returning();
  res.status(201).json({ data: { ...role, permissions: [] } });
});

router.put("/user-management/roles/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, description } = req.body as { name?: string; description?: string };

  const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Role not found" }); return; }
  if (existing.isSystem && name && name !== existing.name) {
    res.status(400).json({ error: "Cannot rename a system role" }); return;
  }

  const updates: Partial<typeof rolesTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;

  const [role] = await db.update(rolesTable).set(updates).where(eq(rolesTable.id, id)).returning();
  const perms = await db.select().from(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, id));
  res.json({ data: { ...role, permissions: perms.map(p => p.permission) } });
});

router.delete("/user-management/roles/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
  if (!role) { res.status(404).json({ error: "Role not found" }); return; }
  if (role.isSystem) { res.status(400).json({ error: "Cannot delete a system role" }); return; }
  await db.delete(rolesTable).where(eq(rolesTable.id, id));
  res.json({ message: "Role deleted" });
});

router.put("/user-management/roles/:id/permissions", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { permissions } = req.body as { permissions: string[] };
  if (!Array.isArray(permissions)) { res.status(400).json({ error: "permissions must be an array" }); return; }

  const validKeys = new Set(ALL_PERMISSIONS.map(p => p.key));
  const filtered = permissions.filter(p => validKeys.has(p));

  await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, id));
  if (filtered.length > 0) {
    await db.insert(rolePermissionsTable).values(filtered.map(p => ({ roleId: id, permission: p })));
  }

  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
  res.json({ data: { ...role, permissions: filtered } });
});

export default router;
