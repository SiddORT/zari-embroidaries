import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc } from "drizzle-orm";
import { mediaUploadMiddleware, uploadFile, deleteUpload } from "../utils/uploadHelper";
import { db, pool, swatchesTable } from "@workspace/db";
import { insertSwatchSchema, updateSwatchSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

router.get("/swatches", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const clientFilter = (req.query.client as string) ?? "";
  const locationFilter = (req.query.location as string) ?? "";
  const swatchCategoryFilter = (req.query.swatchCategory as string) ?? "";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const conditions = [eq(swatchesTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(swatchesTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(swatchesTable.isActive, false));
  if (clientFilter) conditions.push(ilike(swatchesTable.client, `%${clientFilter}%`));
  if (locationFilter) conditions.push(eq(swatchesTable.location, locationFilter));
  if (swatchCategoryFilter) conditions.push(eq(swatchesTable.swatchCategory, swatchCategoryFilter));
  if (search) {
    conditions.push(or(
      ilike(swatchesTable.swatchCode, `%${search}%`),
      ilike(swatchesTable.swatchName, `%${search}%`),
      ilike(swatchesTable.client, `%${search}%`),
      ilike(swatchesTable.fabric, `%${search}%`),
    )!);
  }

  const whereClause = and(...conditions);
  const [rows, countRows] = await Promise.all([
    db.select().from(swatchesTable).where(whereClause).orderBy(desc(swatchesTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: swatchesTable.id }).from(swatchesTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

router.get("/swatches/all", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(swatchesTable).where(and(eq(swatchesTable.isDeleted, false), eq(swatchesTable.isActive, true))).orderBy(swatchesTable.swatchName);
  res.json(rows);
});

// Combined reference list: active master swatches + non-cancelled swatch orders
router.get("/swatches/for-reference", requireAuth, async (_req, res): Promise<void> => {
  const { rows } = await (pool as any).query(`
    SELECT
      CAST(id AS text)           AS id,
      swatch_code                AS code,
      swatch_name                AS name,
      COALESCE(client, '')       AS client,
      'master'                   AS source
    FROM swatches
    WHERE is_deleted = false AND is_active = true

    UNION ALL

    SELECT
      'swo:' || CAST(id AS text) AS id,
      order_code                 AS code,
      swatch_name                AS name,
      COALESCE(client_name, '')  AS client,
      'order'                    AS source
    FROM swatch_orders
    WHERE is_deleted = false AND order_status <> 'Cancelled'

    ORDER BY code
  `);
  res.json(rows);
});

router.post("/swatches", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertSwatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const createdBy = req.user?.email ?? "system";
  const prefix = "SW-";
  const [latest] = await db
    .select({ swatchCode: swatchesTable.swatchCode })
    .from(swatchesTable)
    .where(ilike(swatchesTable.swatchCode, `${prefix}%`))
    .orderBy(desc(swatchesTable.swatchCode))
    .limit(1);
  const swatchCode = !latest
    ? `${prefix}0001`
    : `${prefix}${String(parseInt(latest.swatchCode.replace(prefix, ""), 10) + 1).padStart(4, "0")}`;

  const [record] = await db.insert(swatchesTable).values({ ...parsed.data, swatchCode, createdBy }).returning();
  logger.info({ id: record.id, swatchCode }, "Swatch created");
  res.status(201).json(record);
});

router.put("/swatches/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = updateSwatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(swatchesTable).set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(swatchesTable.id, id), eq(swatchesTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Swatch not found" }); return; }
  res.json(record);
});

router.patch("/swatches/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(swatchesTable).where(and(eq(swatchesTable.id, id), eq(swatchesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Swatch not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(swatchesTable).set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() }).where(eq(swatchesTable.id, id)).returning();
  res.json(record);
});

router.delete("/swatches/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(swatchesTable).set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(swatchesTable.id, id), eq(swatchesTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Swatch not found" }); return; }
  res.json({ message: "Swatch deleted" });
});

// ─── Media upload ──────────────────────────────────────────────────────────────

interface MediaItem { url: string; type: "image" | "video"; name: string; }

router.post("/swatches/:id/media", requireAuth, mediaUploadMiddleware.single("file"), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const category = (req.body.category as string) === "final" ? "final" : "wip";

  const [existing] = await db.select().from(swatchesTable).where(and(eq(swatchesTable.id, id), eq(swatchesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Swatch not found" }); return; }

  const url = await uploadFile(req.file, { entity: "swatches", id: existing.swatchCode, category });
  const isVideo = req.file.mimetype.startsWith("video/");
  const item: MediaItem = { url, type: isVideo ? "video" : "image", name: req.file.originalname };

  const current = (category === "final" ? existing.finalMedia : existing.wipMedia) as MediaItem[] ?? [];
  const updated = [...current, item];

  const field = category === "final" ? { finalMedia: updated } : { wipMedia: updated };
  const [record] = await db.update(swatchesTable).set({ ...field, updatedBy: req.user?.email ?? "system", updatedAt: new Date() })
    .where(eq(swatchesTable.id, id)).returning();

  res.json(record);
});

router.delete("/swatches/:id/media", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { url, category } = req.body as { url: string; category: string };
  if (!url || !category) { res.status(400).json({ error: "url and category are required" }); return; }

  const [existing] = await db.select().from(swatchesTable).where(and(eq(swatchesTable.id, id), eq(swatchesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Swatch not found" }); return; }

  await deleteUpload(url);

  const current = (category === "final" ? existing.finalMedia : existing.wipMedia) as MediaItem[] ?? [];
  const updated = current.filter(m => m.url !== url);

  const field = category === "final" ? { finalMedia: updated } : { wipMedia: updated };
  const [record] = await db.update(swatchesTable).set({ ...field, updatedBy: req.user?.email ?? "system", updatedAt: new Date() })
    .where(eq(swatchesTable.id, id)).returning();

  res.json(record);
});

export default router;
