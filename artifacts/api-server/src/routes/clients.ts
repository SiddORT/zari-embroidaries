import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, count } from "drizzle-orm";
import { db, clientsTable } from "@workspace/db";
import { insertClientSchema, updateClientSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

router.get("/clients", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const conditions = [eq(clientsTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(clientsTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(clientsTable.isActive, false));
  if (search) {
    conditions.push(or(
      ilike(clientsTable.clientCode, `%${search}%`),
      ilike(clientsTable.brandName, `%${search}%`),
      ilike(clientsTable.contactName, `%${search}%`),
      ilike(clientsTable.email, `%${search}%`),
      ilike(clientsTable.contactNo, `%${search}%`),
    )!);
  }

  const whereClause = and(...conditions);
  const [rows, countRows] = await Promise.all([
    db.select().from(clientsTable).where(whereClause).orderBy(desc(clientsTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: clientsTable.id }).from(clientsTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

router.get("/clients/all", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(clientsTable).where(and(eq(clientsTable.isDeleted, false), eq(clientsTable.isActive, true))).orderBy(clientsTable.brandName);
  res.json(rows);
});

router.get("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [record] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.isDeleted, false)));
  if (!record) { res.status(404).json({ error: "Client not found" }); return; }
  res.json(record);
});

router.post("/clients", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertClientSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const createdBy = req.user?.email ?? "system";
  const [{ total }] = await db.select({ total: count() }).from(clientsTable);
  const clientCode = `CLI${String(total + 1).padStart(4, "0")}`;

  const [record] = await db.insert(clientsTable).values({ ...parsed.data, clientCode, createdBy }).returning();
  logger.info({ id: record.id, clientCode }, "Client created");
  res.status(201).json(record);
});

router.put("/clients/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = updateClientSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(clientsTable).set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(clientsTable.id, id), eq(clientsTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Client not found" }); return; }
  res.json(record);
});

router.patch("/clients/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Client not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(clientsTable).set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() }).where(eq(clientsTable.id, id)).returning();
  res.json(record);
});

router.delete("/clients/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(clientsTable).set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(clientsTable.id, id), eq(clientsTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Client not found" }); return; }
  res.json({ message: "Client deleted" });
});

export default router;
