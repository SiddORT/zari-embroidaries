import { Router, type IRouter } from "express";
// import { eq, ilike, and, desc } from "drizzle-orm";
import { db, unitTypesTable, insertUnitTypeSchema, updateUnitTypeSchema, eq, ilike, and, desc } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { checkPermission } from "../middlewares/checkPermission";
import { MASTERS_UNIT_TYPES } from "../constants/permissions";
import { logger } from "../lib/logger";
import { zodFieldErrorsToHuman } from "../lib/importHelpers";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

function buildWhere(search: string, status: string) {
  const conditions: ReturnType<typeof eq>[] = [eq(unitTypesTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(unitTypesTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(unitTypesTable.isActive, false));
  if (search) conditions.push(ilike(unitTypesTable.name, `%${search}%`));
  return and(...conditions);
}

router.get("/unit-types-master", requireAuth, checkPermission(MASTERS_UNIT_TYPES.VIEW), async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const whereClause = buildWhere(search, status);
  const [rows, countRows] = await Promise.all([
    db.select().from(unitTypesTable).where(whereClause).orderBy(desc(unitTypesTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: unitTypesTable.id }).from(unitTypesTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

router.get("/unit-types-master/export-all", requireAuth, checkPermission(MASTERS_UNIT_TYPES.DOWNLOAD), async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const whereClause = buildWhere(search, status);
  const rows = await db.select().from(unitTypesTable).where(whereClause).orderBy(desc(unitTypesTable.createdAt));
  res.json({ data: rows });
});

router.post("/unit-types-master", requireAuth, checkPermission(MASTERS_UNIT_TYPES.ADD_EDIT), async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertUnitTypeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const existing = await db.select().from(unitTypesTable).where(eq(unitTypesTable.name, parsed.data.name));
  if (existing.length > 0) { res.status(409).json({ error: "Unit Type Name already exists." }); return; }

  const [record] = await db.insert(unitTypesTable).values(parsed.data).returning();
  logger.info({ id: record.id }, "Unit type created");
  res.status(201).json(record);
});

router.post("/unit-types-master/import", requireAuth, checkPermission(MASTERS_UNIT_TYPES.ADD_EDIT), async (req: AuthRequest, res): Promise<void> => {
  const body = req.body;
  if (!Array.isArray(body) || body.length === 0) {
    res.status(400).json({ error: "Request body must be a non-empty array." });
    return;
  }

  let imported = 0;
  let skipped = 0;
  const errors: { row: number; name: string; error: string }[] = [];

  for (let i = 0; i < body.length; i++) {
    const row = body[i] as Record<string, unknown>;
    const rowNum = i + 2;

    const parsed = insertUnitTypeSchema.safeParse({ name: String(row.name ?? "").trim(), isActive: true });
    if (!parsed.success) {
      const msgs = zodFieldErrorsToHuman(parsed.error.flatten().fieldErrors);
      errors.push({ row: rowNum, name: String(row.name ?? ""), error: msgs });
      continue;
    }

    const existing = await db.select({ id: unitTypesTable.id }).from(unitTypesTable)
      .where(eq(unitTypesTable.name, parsed.data.name));
    if (existing.length > 0) { skipped++; continue; }

    try {
      await db.insert(unitTypesTable).values(parsed.data);
      imported++;
    } catch {
      errors.push({ row: rowNum, name: parsed.data.name, error: "Database insert failed." });
    }
  }

  logger.info({ imported, skipped, errors: errors.length }, "Unit type bulk import");
  res.json({ imported, skipped, errors });
});

router.put("/unit-types-master/:id", requireAuth, checkPermission(MASTERS_UNIT_TYPES.ADD_EDIT), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = updateUnitTypeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  if (parsed.data.name) {
    const conflict = await db.select({ id: unitTypesTable.id }).from(unitTypesTable)
      .where(eq(unitTypesTable.name, parsed.data.name));
    if (conflict.length > 0 && conflict[0].id !== id) {
      res.status(409).json({ error: "Unit Type Name already exists." }); return;
    }
  }

  const [record] = await db.update(unitTypesTable).set(parsed.data)
    .where(eq(unitTypesTable.id, id)).returning();
  if (!record) { res.status(404).json({ error: "Unit Type not found" }); return; }
  res.json(record);
});

router.patch("/unit-types-master/:id/status", requireAuth, checkPermission(MASTERS_UNIT_TYPES.ADD_EDIT), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(unitTypesTable).where(and(eq(unitTypesTable.id, id), eq(unitTypesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Unit Type not found" }); return; }
  const [record] = await db.update(unitTypesTable)
    .set({ isActive: !existing.isActive })
    .where(eq(unitTypesTable.id, id)).returning();
  res.json(record);
});

router.delete("/unit-types-master/:id", requireAuth, checkPermission(MASTERS_UNIT_TYPES.DELETE), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const deletedByUser = (req.user as any)?.email ?? "system";
  const [record] = await db.update(unitTypesTable)
    .set({ isDeleted: true, deletedBy: deletedByUser, deletedAt: new Date() })
    .where(and(eq(unitTypesTable.id, id), eq(unitTypesTable.isDeleted, false)))
    .returning();
  if (!record) { res.status(404).json({ error: "Unit Type not found" }); return; }
  res.json({ message: "Unit Type deleted" });
});

export default router;
