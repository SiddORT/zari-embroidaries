import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc } from "drizzle-orm";
import { db, hsnTable } from "@workspace/db";
import { insertHsnSchema, updateHsnSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { zodFieldErrorsToHuman } from "../lib/importHelpers";
import type { Request } from "express";

const router: IRouter = Router();

type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

function buildWhere(search: string, status: string) {
  const conditions = [eq(hsnTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(hsnTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(hsnTable.isActive, false));
  if (search) {
    conditions.push(
      or(
        ilike(hsnTable.hsnCode, `%${search}%`),
        ilike(hsnTable.govtDescription, `%${search}%`),
      )!,
    );
  }
  return and(...conditions);
}

router.get("/hsn", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const whereClause = buildWhere(search, status);

  const [rows, countRows] = await Promise.all([
    db.select().from(hsnTable).where(whereClause).orderBy(desc(hsnTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: hsnTable.id }).from(hsnTable).where(whereClause),
  ]);

  res.json({ data: rows, total: countRows.length, page, limit });
});

router.get("/hsn/export-all", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const whereClause = buildWhere(search, status);
  const rows = await db.select().from(hsnTable).where(whereClause).orderBy(desc(hsnTable.createdAt));
  res.json({ data: rows });
});

router.get("/hsn/all", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(hsnTable)
    .where(and(eq(hsnTable.isDeleted, false), eq(hsnTable.isActive, true)))
    .orderBy(hsnTable.hsnCode);
  res.json(rows);
});

router.post("/hsn", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertHsnSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const createdBy = req.user?.email ?? "system";

  const [existing] = await db
    .select({ id: hsnTable.id })
    .from(hsnTable)
    .where(eq(hsnTable.hsnCode, parsed.data.hsnCode));

  if (existing) {
    res.status(409).json({ error: "HSN Code already exists." });
    return;
  }

  const [record] = await db
    .insert(hsnTable)
    .values({ ...parsed.data, createdBy })
    .returning();

  logger.info({ id: record.id, hsnCode: record.hsnCode }, "HSN record created");
  res.status(201).json(record);
});

router.post("/hsn/import", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const body = req.body;
  if (!Array.isArray(body) || body.length === 0) {
    res.status(400).json({ error: "Request body must be a non-empty array of HSN records." });
    return;
  }

  const createdBy = req.user?.email ?? "system";
  let imported = 0;
  let skipped = 0;
  const errors: { row: number; hsnCode: string; error: string }[] = [];

  for (let i = 0; i < body.length; i++) {
    const row = body[i] as Record<string, unknown>;
    const rowNum = i + 2;

    const parsed = insertHsnSchema.safeParse({
      hsnCode: String(row.hsnCode ?? "").trim(),
      gstPercentage: String(row.gstPercentage ?? "").trim(),
      govtDescription: String(row.govtDescription ?? "").trim(),
      remarks: row.remarks ? String(row.remarks).trim() : undefined,
      isActive: row.isActive !== undefined ? Boolean(row.isActive) : true,
    });

    if (!parsed.success) {
      const msgs = zodFieldErrorsToHuman(parsed.error.flatten().fieldErrors);
      errors.push({ row: rowNum, hsnCode: String(row.hsnCode ?? ""), error: msgs });
      continue;
    }

    const [existing] = await db
      .select({ id: hsnTable.id })
      .from(hsnTable)
      .where(eq(hsnTable.hsnCode, parsed.data.hsnCode));

    if (existing) {
      skipped++;
      continue;
    }

    try {
      await db.insert(hsnTable).values({ ...parsed.data, createdBy });
      imported++;
    } catch {
      errors.push({ row: rowNum, hsnCode: parsed.data.hsnCode, error: "Database insert failed." });
    }
  }

  logger.info({ imported, skipped, errors: errors.length }, "HSN bulk import completed");
  res.json({ imported, skipped, errors });
});

router.put("/hsn/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = updateHsnSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const updatedBy = req.user?.email ?? "system";

  if (parsed.data.hsnCode) {
    const [conflict] = await db
      .select({ id: hsnTable.id })
      .from(hsnTable)
      .where(eq(hsnTable.hsnCode, parsed.data.hsnCode));
    if (conflict && conflict.id !== id) {
      res.status(409).json({ error: "HSN Code already exists." });
      return;
    }
  }

  const [record] = await db
    .update(hsnTable)
    .set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(hsnTable.id, id), eq(hsnTable.isDeleted, false)))
    .returning();

  if (!record) {
    res.status(404).json({ error: "HSN record not found" });
    return;
  }

  logger.info({ id: record.id }, "HSN record updated");
  res.json(record);
});

router.patch("/hsn/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(hsnTable)
    .where(and(eq(hsnTable.id, id), eq(hsnTable.isDeleted, false)));

  if (!existing) {
    res.status(404).json({ error: "HSN record not found" });
    return;
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db
    .update(hsnTable)
    .set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() })
    .where(eq(hsnTable.id, id))
    .returning();

  logger.info({ id: record.id, isActive: record.isActive }, "HSN status toggled");
  res.json(record);
});

router.delete("/hsn/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db
    .update(hsnTable)
    .set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(hsnTable.id, id), eq(hsnTable.isDeleted, false)))
    .returning();

  if (!record) {
    res.status(404).json({ error: "HSN record not found" });
    return;
  }

  logger.info({ id: record.id }, "HSN record soft-deleted (is_deleted=true)");
  res.json({ message: "HSN record deleted", record });
});

export default router;
