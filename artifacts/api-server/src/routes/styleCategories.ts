import { Router, type IRouter } from "express";
import { eq, ilike, and, desc } from "drizzle-orm";
import { db, styleCategoriesTable } from "@workspace/db";
import { insertStyleCategorySchema, updateStyleCategorySchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

router.get("/style-categories", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const conditions = [eq(styleCategoriesTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(styleCategoriesTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(styleCategoriesTable.isActive, false));
  if (search) conditions.push(ilike(styleCategoriesTable.categoryName, `%${search}%`));

  const whereClause = and(...conditions);
  const [rows, countRows] = await Promise.all([
    db.select().from(styleCategoriesTable).where(whereClause).orderBy(desc(styleCategoriesTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: styleCategoriesTable.id }).from(styleCategoriesTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

router.get("/style-categories/all", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(styleCategoriesTable).where(and(eq(styleCategoriesTable.isDeleted, false), eq(styleCategoriesTable.isActive, true))).orderBy(styleCategoriesTable.categoryName);
  res.json(rows);
});

router.post("/style-categories", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertStyleCategorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const existing = await db.select().from(styleCategoriesTable).where(and(eq(styleCategoriesTable.categoryName, parsed.data.categoryName), eq(styleCategoriesTable.isDeleted, false)));
  if (existing.length > 0) { res.status(409).json({ error: "Category name already exists" }); return; }

  const createdBy = req.user?.email ?? "system";
  const [record] = await db.insert(styleCategoriesTable).values({ ...parsed.data, createdBy }).returning();
  logger.info({ id: record.id }, "Style category created");
  res.status(201).json(record);
});

router.put("/style-categories/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = updateStyleCategorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(styleCategoriesTable).set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(styleCategoriesTable.id, id), eq(styleCategoriesTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Category not found" }); return; }
  res.json(record);
});

router.patch("/style-categories/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(styleCategoriesTable).where(and(eq(styleCategoriesTable.id, id), eq(styleCategoriesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Category not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(styleCategoriesTable).set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() }).where(eq(styleCategoriesTable.id, id)).returning();
  res.json(record);
});

router.delete("/style-categories/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(styleCategoriesTable).set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(styleCategoriesTable.id, id), eq(styleCategoriesTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Category not found" }); return; }
  res.json({ message: "Category deleted" });
});

export default router;
