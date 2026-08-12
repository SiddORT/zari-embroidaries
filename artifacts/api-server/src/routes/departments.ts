import { Router, type IRouter } from "express";
// import { eq, ilike, and, desc } from "drizzle-orm";
import { db, departmentsTable, insertDepartmentSchema, updateDepartmentSchema , eq, ilike, and, desc} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { checkPermission } from "../middlewares/checkPermission";
import { MASTERS_DEPARTMENTS } from "../constants/permissions";
import { logger } from "../lib/logger";
import { zodFieldErrorsToHuman } from "../lib/importHelpers";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

function buildWhere(search: string, status: string) {
  const conditions = [eq(departmentsTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(departmentsTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(departmentsTable.isActive, false));
  if (search) conditions.push(ilike(departmentsTable.name, `%${search}%`));
  return and(...conditions);
}

router.get("/departments", requireAuth, checkPermission(MASTERS_DEPARTMENTS.VIEW), async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const whereClause = buildWhere(search, status);
  const [rows, countRows] = await Promise.all([
    db.select().from(departmentsTable).where(whereClause).orderBy(desc(departmentsTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: departmentsTable.id }).from(departmentsTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

router.get("/departments/export-all", requireAuth, checkPermission(MASTERS_DEPARTMENTS.DOWNLOAD), async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const whereClause = buildWhere(search, status);
  const rows = await db.select().from(departmentsTable).where(whereClause).orderBy(desc(departmentsTable.createdAt));
  res.json({ data: rows });
});

router.post("/departments", requireAuth, checkPermission(MASTERS_DEPARTMENTS.ADD_EDIT), async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertDepartmentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const existing = await db.select().from(departmentsTable)
    .where(and(eq(departmentsTable.name, parsed.data.name), eq(departmentsTable.isDeleted, false)));
  if (existing.length > 0) { res.status(409).json({ error: "Department Name already exists." }); return; }

  const createdBy = req.user?.email ?? "system";
  const [record] = await db.insert(departmentsTable).values({ ...parsed.data, createdBy }).returning();
  logger.info({ id: record.id }, "Department created");
  res.status(201).json(record);
});

router.post("/departments/import", requireAuth, checkPermission(MASTERS_DEPARTMENTS.ADD_EDIT), async (req: AuthRequest, res): Promise<void> => {
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

    const parsed = insertDepartmentSchema.safeParse({ name: String(row.name ?? "").trim(), isActive: true });
    if (!parsed.success) {
      const msgs = zodFieldErrorsToHuman(parsed.error.flatten().fieldErrors);
      errors.push({ row: rowNum, name: String(row.name ?? ""), error: msgs });
      continue;
    }

    const existing = await db.select({ id: departmentsTable.id }).from(departmentsTable)
      .where(and(eq(departmentsTable.name, parsed.data.name), eq(departmentsTable.isDeleted, false)));
    if (existing.length > 0) { skipped++; continue; }

    try {
      await db.insert(departmentsTable).values({ ...parsed.data, createdBy });
      imported++;
    } catch {
      errors.push({ row: rowNum, name: parsed.data.name, error: "Database insert failed." });
    }
  }

  logger.info({ imported, skipped, errors: errors.length }, "Department bulk import");
  res.json({ imported, skipped, errors });
});

router.put("/departments/:id", requireAuth, checkPermission(MASTERS_DEPARTMENTS.ADD_EDIT), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = updateDepartmentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  if (parsed.data.name) {
    const conflict = await db.select({ id: departmentsTable.id }).from(departmentsTable)
      .where(and(eq(departmentsTable.name, parsed.data.name), eq(departmentsTable.isDeleted, false)));
    if (conflict.length > 0 && conflict[0].id !== id) {
      res.status(409).json({ error: "Department Name already exists." }); return;
    }
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(departmentsTable)
    .set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(departmentsTable.id, id), eq(departmentsTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Department not found" }); return; }
  res.json(record);
});

router.patch("/departments/:id/status", requireAuth, checkPermission(MASTERS_DEPARTMENTS.ADD_EDIT), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(departmentsTable)
    .where(and(eq(departmentsTable.id, id), eq(departmentsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Department not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(departmentsTable)
    .set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() })
    .where(eq(departmentsTable.id, id)).returning();
  res.json(record);
});

router.delete("/departments/:id", requireAuth, checkPermission(MASTERS_DEPARTMENTS.DELETE), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(departmentsTable)
    .set({ isDeleted: true, updatedBy, updatedAt: new Date(), deletedBy: updatedBy, deletedAt: new Date() })
    .where(and(eq(departmentsTable.id, id), eq(departmentsTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Department not found" }); return; }
  res.json({ message: "Department deleted" });
});

export default router;
