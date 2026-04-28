import { Router, type IRouter } from "express";
import { eq, ilike, and, desc } from "drizzle-orm";
import { db, itemTypesTable, insertItemTypeSchema, updateItemTypeSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Item Type Name is required.";
  if (trimmed.length > 100) return "Item Type Name must be at most 100 characters.";
  if (!NAME_REGEX.test(trimmed)) return "Item Type Name must contain only letters and spaces.";
  return null;
}

router.get("/item-types/export-all", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";

  const conditions = [eq(itemTypesTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(itemTypesTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(itemTypesTable.isActive, false));
  if (search) conditions.push(ilike(itemTypesTable.name, `%${search}%`));

  const rows = await db.select().from(itemTypesTable)
    .where(and(...conditions))
    .orderBy(desc(itemTypesTable.createdAt), desc(itemTypesTable.id));
  res.json(rows);
});

router.post("/item-types/import", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { rows: rawRows } = req.body as { rows: Record<string, unknown>[] };
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    res.status(400).json({ error: "No rows provided." });
    return;
  }

  const createdBy = req.user?.email ?? "system";
  const results: { row: number; status: "success" | "error"; name?: string; errors?: string[] }[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 2;
    const rowErrors: string[] = [];

    const name = typeof raw["Item Type Name"] === "string" ? raw["Item Type Name"].trim() : "";
    const isActiveRaw = typeof raw["Status"] === "string" ? raw["Status"].trim().toLowerCase() : "active";
    const isActive = isActiveRaw !== "inactive";

    const nameError = validateName(name);
    if (nameError) rowErrors.push(nameError);

    if (rowErrors.length > 0) {
      results.push({ row: rowNum, status: "error", errors: rowErrors });
      continue;
    }

    try {
      const existing = await db.select().from(itemTypesTable)
        .where(and(eq(itemTypesTable.name, name), eq(itemTypesTable.isDeleted, false)));
      if (existing.length > 0) {
        results.push({ row: rowNum, status: "error", errors: [`Item type "${name}" already exists.`] });
        continue;
      }
      const [record] = await db.insert(itemTypesTable).values({ name, isActive, createdBy }).returning();
      results.push({ row: rowNum, status: "success", name: record.name });
    } catch (err) {
      results.push({ row: rowNum, status: "error", errors: [(err as Error).message] });
    }
  }

  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;
  res.json({ succeeded, failed, results });
});

router.get("/item-types/all", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({ id: itemTypesTable.id, name: itemTypesTable.name })
    .from(itemTypesTable)
    .where(and(eq(itemTypesTable.isDeleted, false), eq(itemTypesTable.isActive, true)))
    .orderBy(itemTypesTable.name);
  res.json(rows);
});

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
    db.select().from(itemTypesTable).where(whereClause)
      .orderBy(desc(itemTypesTable.createdAt), desc(itemTypesTable.id))
      .limit(limit).offset(offset),
    db.select({ id: itemTypesTable.id }).from(itemTypesTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

router.post("/item-types", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const nameError = validateName((req.body as Record<string, unknown>).name as string ?? "");
  if (nameError) { res.status(400).json({ error: nameError }); return; }

  const parsed = insertItemTypeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const trimmedName = parsed.data.name.trim();
  const existing = await db.select().from(itemTypesTable)
    .where(and(eq(itemTypesTable.name, trimmedName), eq(itemTypesTable.isDeleted, false)));
  if (existing.length > 0) { res.status(409).json({ error: "Item type name already exists" }); return; }

  const createdBy = req.user?.email ?? "system";
  const [record] = await db.insert(itemTypesTable).values({ ...parsed.data, name: trimmedName, createdBy }).returning();
  logger.info({ id: record.id }, "Item type created");
  res.status(201).json(record);
});

router.put("/item-types/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const rawName = (req.body as Record<string, unknown>).name;
  if (rawName !== undefined) {
    const nameError = validateName(rawName as string ?? "");
    if (nameError) { res.status(400).json({ error: nameError }); return; }
  }

  const parsed = updateItemTypeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const updatedBy = req.user?.email ?? "system";
  const updateData = parsed.data.name ? { ...parsed.data, name: parsed.data.name.trim() } : parsed.data;
  const [record] = await db.update(itemTypesTable).set({ ...updateData, updatedBy, updatedAt: new Date() })
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
