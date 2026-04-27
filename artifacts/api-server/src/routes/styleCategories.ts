import { Router, type IRouter } from "express";
import { eq, ilike, and, desc } from "drizzle-orm";
import { db, styleCategoriesTable } from "@workspace/db";
import { insertStyleCategorySchema, updateStyleCategorySchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

function buildWhere(search: string, status: string) {
  const conditions = [eq(styleCategoriesTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(styleCategoriesTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(styleCategoriesTable.isActive, false));
  if (search) conditions.push(ilike(styleCategoriesTable.categoryName, `%${search}%`));
  return and(...conditions);
}

router.get("/style-categories", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const whereClause = buildWhere(search, status);
  const [rows, countRows] = await Promise.all([
    db.select().from(styleCategoriesTable).where(whereClause).orderBy(desc(styleCategoriesTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: styleCategoriesTable.id }).from(styleCategoriesTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

router.get("/style-categories/export-all", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const whereClause = buildWhere(search, status);
  const rows = await db.select().from(styleCategoriesTable).where(whereClause).orderBy(desc(styleCategoriesTable.createdAt));
  res.json({ data: rows });
});

router.get("/style-categories/all", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(styleCategoriesTable)
    .where(and(eq(styleCategoriesTable.isDeleted, false), eq(styleCategoriesTable.isActive, true)))
    .orderBy(styleCategoriesTable.categoryName);
  res.json(rows);
});

router.post("/style-categories", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertStyleCategorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const existing = await db.select().from(styleCategoriesTable)
    .where(and(eq(styleCategoriesTable.categoryName, parsed.data.categoryName), eq(styleCategoriesTable.isDeleted, false)));
  if (existing.length > 0) { res.status(409).json({ error: "Category Name already exists." }); return; }

  const createdBy = req.user?.email ?? "system";
  const [record] = await db.insert(styleCategoriesTable).values({ ...parsed.data, createdBy }).returning();
  logger.info({ id: record.id }, "Style category created");
  res.status(201).json(record);
});

router.post("/style-categories/import", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const body = req.body;
  if (!Array.isArray(body) || body.length === 0) {
    res.status(400).json({ error: "Request body must be a non-empty array." });
    return;
  }

  const createdBy = req.user?.email ?? "system";
  let imported = 0;
  let skipped = 0;
  const errors: { row: number; name: string; error: string }[] = [];

  for (let i = 0; i < body.length; i++) {
    const row = body[i] as Record<string, unknown>;
    const rowNum = i + 2;

    const parsed = insertStyleCategorySchema.safeParse({
      categoryName: String(row.categoryName ?? "").trim(),
      isActive: true,
    });

    if (!parsed.success) {
      const msgs = Object.values(parsed.error.flatten().fieldErrors).flat().join("; ");
      errors.push({ row: rowNum, name: String(row.categoryName ?? ""), error: msgs });
      continue;
    }

    const existing = await db.select({ id: styleCategoriesTable.id }).from(styleCategoriesTable)
      .where(and(eq(styleCategoriesTable.categoryName, parsed.data.categoryName), eq(styleCategoriesTable.isDeleted, false)));
    if (existing.length > 0) { skipped++; continue; }

    try {
      await db.insert(styleCategoriesTable).values({ ...parsed.data, createdBy });
      imported++;
    } catch {
      errors.push({ row: rowNum, name: parsed.data.categoryName, error: "Database insert failed." });
    }
  }

  logger.info({ imported, skipped, errors: errors.length }, "Style category bulk import");
  res.json({ imported, skipped, errors });
});

router.put("/style-categories/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = updateStyleCategorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  if (parsed.data.categoryName) {
    const conflict = await db.select({ id: styleCategoriesTable.id }).from(styleCategoriesTable)
      .where(and(eq(styleCategoriesTable.categoryName, parsed.data.categoryName), eq(styleCategoriesTable.isDeleted, false)));
    if (conflict.length > 0 && conflict[0].id !== id) {
      res.status(409).json({ error: "Category Name already exists." }); return;
    }
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(styleCategoriesTable).set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(styleCategoriesTable.id, id), eq(styleCategoriesTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Category not found" }); return; }
  res.json(record);
});

router.patch("/style-categories/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(styleCategoriesTable)
    .where(and(eq(styleCategoriesTable.id, id), eq(styleCategoriesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Category not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(styleCategoriesTable)
    .set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() })
    .where(eq(styleCategoriesTable.id, id)).returning();
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
