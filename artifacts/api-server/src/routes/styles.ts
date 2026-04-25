import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc } from "drizzle-orm";
import { db, pool, stylesTable } from "@workspace/db";
import { insertStyleSchema, updateStyleSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

async function generateStyleNo(): Promise<string> {
  const prefix = "ST-";
  const [latest] = await db
    .select({ styleNo: stylesTable.styleNo })
    .from(stylesTable)
    .where(ilike(stylesTable.styleNo, `${prefix}%`))
    .orderBy(desc(stylesTable.styleNo))
    .limit(1);
  if (!latest) return `${prefix}0001`;
  const num = parseInt(latest.styleNo.replace(prefix, ""), 10);
  return `${prefix}${String(isNaN(num) ? 1 : num + 1).padStart(4, "0")}`;
}

router.get("/styles", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const clientFilter = (req.query.client as string) ?? "";
  const locationFilter = (req.query.location as string) ?? "";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const conditions = [eq(stylesTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(stylesTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(stylesTable.isActive, false));
  if (clientFilter) conditions.push(ilike(stylesTable.client, `%${clientFilter}%`));
  if (locationFilter) conditions.push(ilike(stylesTable.placeOfIssue, `%${locationFilter}%`));
  if (search) {
    conditions.push(or(
      ilike(stylesTable.styleNo, `%${search}%`),
      ilike(stylesTable.client, `%${search}%`),
      ilike(stylesTable.description, `%${search}%`),
    )!);
  }

  const whereClause = and(...conditions);
  const [rows, countRows] = await Promise.all([
    db.select().from(stylesTable).where(whereClause).orderBy(desc(stylesTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: stylesTable.id }).from(stylesTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

// Combined reference list: active master styles + non-cancelled style orders
router.get("/styles/for-reference", requireAuth, async (_req, res): Promise<void> => {
  const { rows } = await (pool as any).query(`
    SELECT
      CAST(id AS text)                      AS id,
      style_no                              AS code,
      COALESCE(description, style_no, '')   AS name,
      COALESCE(client, '')                  AS client,
      'master'                              AS source
    FROM styles
    WHERE is_deleted = false AND is_active = true

    UNION ALL

    SELECT
      'sto:' || CAST(id AS text)            AS id,
      order_code                            AS code,
      style_name                            AS name,
      COALESCE(client_name, '')             AS client,
      'order'                               AS source
    FROM style_orders
    WHERE is_deleted = false AND order_status <> 'Cancelled'

    ORDER BY code
  `);
  res.json(rows);
});

router.post("/styles", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertStyleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const createdBy = req.user?.email ?? "system";
  const styleNo = await generateStyleNo();
  const [record] = await db.insert(stylesTable).values({ ...parsed.data, styleNo, createdBy }).returning();
  logger.info({ id: record.id }, "Style created");
  res.status(201).json(record);
});

router.put("/styles/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = updateStyleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }
  const updatedBy = req.user?.email ?? "system";
  const { styleNo: _ignored, ...updateData } = parsed.data;
  const [record] = await db.update(stylesTable).set({ ...updateData, updatedBy, updatedAt: new Date() })
    .where(and(eq(stylesTable.id, id), eq(stylesTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Style not found" }); return; }
  res.json(record);
});

router.patch("/styles/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(stylesTable).where(and(eq(stylesTable.id, id), eq(stylesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Style not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(stylesTable).set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() }).where(eq(stylesTable.id, id)).returning();
  res.json(record);
});

router.delete("/styles/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(stylesTable).set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(stylesTable.id, id), eq(stylesTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Style not found" }); return; }
  res.json({ message: "Style deleted" });
});

export default router;
