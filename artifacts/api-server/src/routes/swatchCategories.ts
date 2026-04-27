import { Router, type IRouter } from "express";
import { eq, ilike, and, desc } from "drizzle-orm";
import { db, swatchCategoriesTable, insertSwatchCategorySchema, updateSwatchCategorySchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

function buildWhere(search: string, status: string) {
  const conditions = [eq(swatchCategoriesTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(swatchCategoriesTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(swatchCategoriesTable.isActive, false));
  if (search) conditions.push(ilike(swatchCategoriesTable.name, `%${search}%`));
  return and(...conditions);
}

router.get("/swatch-categories", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const whereClause = buildWhere(search, status);
  const [rows, countRows] = await Promise.all([
    db.select().from(swatchCategoriesTable).where(whereClause).orderBy(desc(swatchCategoriesTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: swatchCategoriesTable.id }).from(swatchCategoriesTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

router.get("/swatch-categories/export-all", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const whereClause = buildWhere(search, status);
  const rows = await db.select().from(swatchCategoriesTable).where(whereClause).orderBy(desc(swatchCategoriesTable.createdAt));
  res.json({ data: rows });
});

router.get("/swatch-categories/all", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(swatchCategoriesTable)
    .where(and(eq(swatchCategoriesTable.isDeleted, false), eq(swatchCategoriesTable.isActive, true)))
    .orderBy(swatchCategoriesTable.name);
  res.json(rows);
});

router.post("/swatch-categories", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertSwatchCategorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const existing = await db.select().from(swatchCategoriesTable)
    .where(and(eq(swatchCategoriesTable.name, parsed.data.name), eq(swatchCategoriesTable.isDeleted, false)));
  if (existing.length > 0) { res.status(409).json({ error: "Category Name already exists." }); return; }

  const createdBy = req.user?.email ?? "system";
  const [record] = await db.insert(swatchCategoriesTable).values({ ...parsed.data, createdBy }).returning();
  logger.info({ id: record.id }, "Swatch category created");
  res.status(201).json(record);
});

router.post("/swatch-categories/import", requireAuth, async (req: AuthRequest, res): Promise<void> => {
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

    const parsed = insertSwatchCategorySchema.safeParse({
      name: String(row.name ?? "").trim(),
      isActive: true,
    });

    if (!parsed.success) {
      const msgs = Object.values(parsed.error.flatten().fieldErrors).flat().join("; ");
      errors.push({ row: rowNum, name: String(row.name ?? ""), error: msgs });
      continue;
    }

    const existing = await db.select({ id: swatchCategoriesTable.id }).from(swatchCategoriesTable)
      .where(and(eq(swatchCategoriesTable.name, parsed.data.name), eq(swatchCategoriesTable.isDeleted, false)));
    if (existing.length > 0) { skipped++; continue; }

    try {
      await db.insert(swatchCategoriesTable).values({ ...parsed.data, createdBy });
      imported++;
    } catch {
      errors.push({ row: rowNum, name: parsed.data.name, error: "Database insert failed." });
    }
  }

  logger.info({ imported, skipped, errors: errors.length }, "Swatch category bulk import");
  res.json({ imported, skipped, errors });
});

router.put("/swatch-categories/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = updateSwatchCategorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  if (parsed.data.name) {
    const conflict = await db.select({ id: swatchCategoriesTable.id }).from(swatchCategoriesTable)
      .where(and(eq(swatchCategoriesTable.name, parsed.data.name), eq(swatchCategoriesTable.isDeleted, false)));
    if (conflict.length > 0 && conflict[0].id !== id) {
      res.status(409).json({ error: "Category Name already exists." }); return;
    }
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(swatchCategoriesTable).set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(swatchCategoriesTable.id, id), eq(swatchCategoriesTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Category not found" }); return; }
  res.json(record);
});

router.patch("/swatch-categories/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(swatchCategoriesTable)
    .where(and(eq(swatchCategoriesTable.id, id), eq(swatchCategoriesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Category not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(swatchCategoriesTable)
    .set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() })
    .where(eq(swatchCategoriesTable.id, id)).returning();
  res.json(record);
});

router.delete("/swatch-categories/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(swatchCategoriesTable)
    .set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(swatchCategoriesTable.id, id), eq(swatchCategoriesTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Category not found" }); return; }
  res.json({ message: "Category deleted" });
});

export default router;
