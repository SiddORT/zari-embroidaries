import { Router, type IRouter } from "express";
import { eq, ilike, and, desc } from "drizzle-orm";
import { db, itemTypesTable, insertItemTypeSchema, updateItemTypeSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

router.get("/item-types", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const conditions = [eq(itemTypesTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(itemTypesTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(itemTypesTable.isActive, false));
  if (search) conditions.push(ilike(itemTypesTable.name, `%${search}%`));

  const whereClause = and(...conditions);
  const [rows, countRows] = await Promise.all([
    db.select().from(itemTypesTable).where(whereClause).orderBy(desc(itemTypesTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: itemTypesTable.id }).from(itemTypesTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

router.post("/item-types", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertItemTypeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const existing = await db.select().from(itemTypesTable).where(and(eq(itemTypesTable.name, parsed.data.name), eq(itemTypesTable.isDeleted, false)));
  if (existing.length > 0) { res.status(409).json({ error: "Item type name already exists" }); return; }

  const createdBy = req.user?.email ?? "system";
  const [record] = await db.insert(itemTypesTable).values({ ...parsed.data, createdBy }).returning();
  logger.info({ id: record.id }, "Item type created");
  res.status(201).json(record);
});

router.put("/item-types/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = updateItemTypeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(itemTypesTable).set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(itemTypesTable.id, id), eq(itemTypesTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Item type not found" }); return; }
  res.json(record);
});

router.patch("/item-types/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(itemTypesTable).where(and(eq(itemTypesTable.id, id), eq(itemTypesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Item type not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(itemTypesTable).set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() }).where(eq(itemTypesTable.id, id)).returning();
  res.json(record);
});

router.delete("/item-types/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(itemTypesTable).set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(itemTypesTable.id, id), eq(itemTypesTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Item type not found" }); return; }
  res.json({ message: "Item type deleted" });
});

export default router;
