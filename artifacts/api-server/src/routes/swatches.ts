import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, ne } from "drizzle-orm";
import { mediaUploadMiddleware, uploadFile, deleteUpload } from "../utils/uploadHelper";
import { db, pool, swatchesTable } from "@workspace/db";
import { insertSwatchSchema, updateSwatchSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { zodFieldErrorsToHuman } from "../lib/importHelpers";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const NUMERIC_REGEX = /^[0-9]+(\.[0-9]{1,2})?$/;

function buildConditions(req: Request) {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const clientFilter = (req.query.client as string) ?? "";
  const locationFilter = (req.query.location as string) ?? "";
  const swatchCategoryFilter = (req.query.swatchCategory as string) ?? "";

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
  return conditions;
}

router.get("/swatches", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const conditions = buildConditions(req);
  const whereClause = and(...conditions);
  const [rows, countRows] = await Promise.all([
    db.select().from(swatchesTable).where(whereClause).orderBy(desc(swatchesTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: swatchesTable.id }).from(swatchesTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

router.get("/swatches/export-all", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const conditions = buildConditions(req);
  const whereClause = and(...conditions);
  const rows = await db.select().from(swatchesTable).where(whereClause).orderBy(desc(swatchesTable.createdAt));
  res.json(rows);
});

router.get("/swatches/all", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(swatchesTable).where(and(eq(swatchesTable.isDeleted, false), eq(swatchesTable.isActive, true))).orderBy(swatchesTable.swatchName);
  res.json(rows);
});

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

function validateSwatchBody(body: Record<string, unknown>): string[] {
  const errs: string[] = [];
  const name = typeof body.swatchName === "string" ? body.swatchName.trim() : "";
  if (!name) errs.push("Swatch Name is required.");
  else if (!NAME_REGEX.test(name)) errs.push("Swatch Name must contain only letters and spaces (max 100 characters).");
  else if (name.length > 100) errs.push("Swatch Name must contain only letters and spaces (max 100 characters).");

  const swatchDate = typeof body.swatchDate === "string" ? body.swatchDate.trim() : "";
  if (swatchDate) {
    const d = new Date(swatchDate);
    const today = new Date(); today.setHours(23, 59, 59, 999);
    if (d > today) errs.push("Future date is not allowed.");
  }

  const length = typeof body.length === "string" ? body.length.trim() : "";
  if (length && !NUMERIC_REGEX.test(length)) errs.push("Length must be a positive numeric value.");

  const width = typeof body.width === "string" ? body.width.trim() : "";
  if (width && !NUMERIC_REGEX.test(width)) errs.push("Width must be a positive numeric value.");

  const hours = typeof body.hours === "string" ? body.hours.trim() : "";
  if (hours && !NUMERIC_REGEX.test(hours)) errs.push("Hours must be a positive numeric value.");

  return errs;
}

router.get("/swatches/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [record] = await db.select().from(swatchesTable).where(and(eq(swatchesTable.id, id), eq(swatchesTable.isDeleted, false)));
  if (!record) { res.status(404).json({ error: "Swatch not found" }); return; }
  res.json(record);
});

router.post("/swatches", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const validationErrs = validateSwatchBody(req.body as Record<string, unknown>);
  if (validationErrs.length > 0) { res.status(400).json({ error: validationErrs[0], details: validationErrs }); return; }

  const parsed = insertSwatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const dupSwatch = await db.select({ id: swatchesTable.id }).from(swatchesTable).where(
    and(ilike(swatchesTable.swatchName, parsed.data.swatchName), eq(swatchesTable.isDeleted, false))
  );
  if (dupSwatch.length > 0) { res.status(409).json({ error: `A swatch named "${parsed.data.swatchName}" already exists.` }); return; }

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
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const validationErrs = validateSwatchBody(req.body as Record<string, unknown>);
  if (validationErrs.length > 0) { res.status(400).json({ error: validationErrs[0], details: validationErrs }); return; }

  const parsed = updateSwatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  if (parsed.data.swatchName) {
    const dupSwatch = await db.select({ id: swatchesTable.id }).from(swatchesTable).where(
      and(ilike(swatchesTable.swatchName, parsed.data.swatchName), eq(swatchesTable.isDeleted, false), ne(swatchesTable.id, id))
    );
    if (dupSwatch.length > 0) { res.status(409).json({ error: `A swatch named "${parsed.data.swatchName}" already exists.` }); return; }
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(swatchesTable).set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(swatchesTable.id, id), eq(swatchesTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Swatch not found" }); return; }
  res.json(record);
});

router.patch("/swatches/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(swatchesTable).where(and(eq(swatchesTable.id, id), eq(swatchesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Swatch not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(swatchesTable).set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() }).where(eq(swatchesTable.id, id)).returning();
  res.json(record);
});

router.delete("/swatches/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(swatchesTable).set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(swatchesTable.id, id), eq(swatchesTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Swatch not found" }); return; }
  res.json({ message: "Swatch deleted" });
});

router.post("/swatches/import", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const rows = req.body as Record<string, unknown>[];
  if (!Array.isArray(rows) || rows.length === 0) { res.status(400).json({ error: "No data provided" }); return; }

  const createdBy = req.user?.email ?? "system";
  const prefix = "SW-";

  const results: { row: number; status: "success" | "error"; swatchCode?: string; errors?: string[] }[] = [];
  let succeeded = 0; let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const body = {
      swatchName: String(raw["Swatch Name"] ?? raw["swatchName"] ?? "").trim(),
      client: String(raw["Client"] ?? raw["client"] ?? "").trim() || undefined,
      swatchCategory: String(raw["Category"] ?? raw["swatchCategory"] ?? "").trim() || undefined,
      fabric: String(raw["Base Fabric"] ?? raw["fabric"] ?? "").trim() || undefined,
      location: String(raw["Location"] ?? raw["location"] ?? "").trim() || undefined,
      swatchDate: String(raw["Date"] ?? raw["swatchDate"] ?? "").trim() || undefined,
      length: String(raw["Length"] ?? raw["length"] ?? "").trim() || undefined,
      width: String(raw["Width"] ?? raw["width"] ?? "").trim() || undefined,
      unitType: String(raw["Unit Type"] ?? raw["unitType"] ?? "").trim() || undefined,
      hours: String(raw["Hours"] ?? raw["hours"] ?? "").trim() || undefined,
      isActive: true,
    };

    const errs = validateSwatchBody(body as Record<string, unknown>);
    if (errs.length > 0) { results.push({ row: i + 2, status: "error", errors: errs }); failed++; continue; }

    try {
      const parsed = insertSwatchSchema.safeParse(body);
      if (!parsed.success) {
        results.push({ row: i + 2, status: "error", errors: [zodFieldErrorsToHuman(parsed.error.flatten().fieldErrors)] });
        failed++; continue;
      }

      const dupSwatch = await db.select({ id: swatchesTable.id }).from(swatchesTable).where(
        and(ilike(swatchesTable.swatchName, parsed.data.swatchName), eq(swatchesTable.isDeleted, false))
      );
      if (dupSwatch.length > 0) { results.push({ row: i + 2, status: "error", errors: [`A swatch named "${parsed.data.swatchName}" already exists.`] }); failed++; continue; }

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
      results.push({ row: i + 2, status: "success", swatchCode: record.swatchCode });
      succeeded++;
    } catch (err) {
      results.push({ row: i + 2, status: "error", errors: [err instanceof Error ? err.message : "Unknown error"] });
      failed++;
    }
  }

  res.json({ succeeded, failed, results });
});

// ─── Media upload ──────────────────────────────────────────────────────────────

interface MediaItem { url: string; type: "image" | "video"; name: string; }

router.post("/swatches/:id/media", requireAuth, mediaUploadMiddleware.single("file"), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
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
  const id = parseInt(String(req.params.id), 10);
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
