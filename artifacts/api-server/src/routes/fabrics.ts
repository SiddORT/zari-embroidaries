import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, count, asc } from "drizzle-orm";
import { db, fabricsTable } from "@workspace/db";
import { insertFabricSchema, updateFabricSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { ensureInventoryRecord, updateInventoryImages, updateInventoryStockLevels } from "../services/inventoryService";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const NUMERIC_REGEX = /^[0-9]+(\.[0-9]{1,2})?$/;
const VALID_GST = ["0", "5", "12", "18", "28"];

function validateFabricFields(data: Record<string, unknown>): string | null {
  const ft = String(data.fabricType ?? "").trim();
  const q = String(data.quality ?? "").trim();
  const cn = String(data.colorName ?? "").trim();
  const w = String(data.width ?? "").trim();
  const wut = String(data.widthUnitType ?? "").trim();
  const pm = String(data.pricePerMeter ?? "").trim();

  if (!ft) return "Fabric Type is required.";
  if (!NAME_REGEX.test(ft) || ft.length > 100) return "Fabric Type must contain only letters and spaces (max 100 characters).";
  if (!q) return "Quality is required.";
  if (!NAME_REGEX.test(q) || q.length > 100) return "Quality must contain only letters and spaces (max 100 characters).";
  if (!cn) return "Color Name is required.";
  if (!NAME_REGEX.test(cn) || cn.length > 100) return "Color Name must contain only letters and spaces (max 100 characters).";
  if (!w) return "Width is required.";
  if (!NUMERIC_REGEX.test(w) || parseFloat(w) <= 0) return "Width must be a positive numeric value.";
  if (!wut) return "Width Unit Type is required.";
  if (!NAME_REGEX.test(wut) || wut.length > 50) return "Width Unit Type must contain only letters (max 50 characters).";
  if (!pm) return "Price Per Meter is required.";
  if (!NUMERIC_REGEX.test(pm) || parseFloat(pm) <= 0) return "Price must be a positive numeric value.";
  return null;
}

function buildWhere(search: string, status: string, fabricType: string, vendor: string, hsnCode: string) {
  const conditions = [eq(fabricsTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(fabricsTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(fabricsTable.isActive, false));
  if (fabricType) conditions.push(ilike(fabricsTable.fabricType, `%${fabricType}%`));
  if (vendor) conditions.push(ilike(fabricsTable.vendor, `%${vendor}%`));
  if (hsnCode) conditions.push(ilike(fabricsTable.hsnCode, `%${hsnCode}%`));
  if (search) {
    conditions.push(or(
      ilike(fabricsTable.fabricCode, `%${search}%`),
      ilike(fabricsTable.fabricType, `%${search}%`),
      ilike(fabricsTable.quality, `%${search}%`),
      ilike(fabricsTable.colorName, `%${search}%`),
      ilike(fabricsTable.hsnCode, `%${search}%`),
    )!);
  }
  return and(...conditions);
}

router.get("/fabrics", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const fabricType = (req.query.fabricType as string) ?? "";
  const vendor = (req.query.vendor as string) ?? "";
  const hsnCode = (req.query.hsnCode as string) ?? "";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const whereClause = buildWhere(search, status, fabricType, vendor, hsnCode);
  const [rows, countRows] = await Promise.all([
    db.select().from(fabricsTable).where(whereClause)
      .orderBy(desc(fabricsTable.createdAt), desc(fabricsTable.id))
      .limit(limit).offset(offset),
    db.select({ id: fabricsTable.id }).from(fabricsTable).where(whereClause),
  ]);

  res.json({ data: rows, total: countRows.length, page, limit });
});

router.get("/fabrics/export-all", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const fabricType = (req.query.fabricType as string) ?? "";
  const vendor = (req.query.vendor as string) ?? "";
  const hsnCode = (req.query.hsnCode as string) ?? "";
  const whereClause = buildWhere(search, status, fabricType, vendor, hsnCode);
  const rows = await db.select().from(fabricsTable).where(whereClause)
    .orderBy(desc(fabricsTable.createdAt), desc(fabricsTable.id));
  res.json({ data: rows });
});

router.get("/fabrics/all", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(fabricsTable)
    .where(and(eq(fabricsTable.isDeleted, false), eq(fabricsTable.isActive, true)))
    .orderBy(asc(fabricsTable.fabricType));
  res.json(rows);
});

router.post("/fabrics/import", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const rows = req.body as Record<string, unknown>[];
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "No rows provided." }); return;
  }

  let imported = 0, skipped = 0;
  const errors: { row: number; name: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const fabricType = String(row.fabricType ?? "").trim();
    const quality = String(row.quality ?? "").trim();
    const colorName = String(row.colorName ?? "").trim();
    const width = String(row.width ?? "").trim();
    const widthUnitType = String(row.widthUnitType ?? "").trim();
    const pricePerMeter = String(row.pricePerMeter ?? "").trim();
    const hsnCode = String(row.hsnCode ?? "").trim();
    const displayName = fabricType || `Row ${rowNum}`;

    if (!fabricType) { errors.push({ row: rowNum, name: displayName, error: "Fabric Type is required." }); skipped++; continue; }
    if (!NAME_REGEX.test(fabricType) || fabricType.length > 100) { errors.push({ row: rowNum, name: displayName, error: "Fabric Type must contain only letters and spaces (max 100 characters)." }); skipped++; continue; }
    if (!quality) { errors.push({ row: rowNum, name: displayName, error: "Quality is required." }); skipped++; continue; }
    if (!NAME_REGEX.test(quality) || quality.length > 100) { errors.push({ row: rowNum, name: displayName, error: "Quality must contain only letters and spaces (max 100 characters)." }); skipped++; continue; }
    if (!colorName) { errors.push({ row: rowNum, name: displayName, error: "Color Name is required." }); skipped++; continue; }
    if (!NAME_REGEX.test(colorName) || colorName.length > 100) { errors.push({ row: rowNum, name: displayName, error: "Color Name must contain only letters and spaces (max 100 characters)." }); skipped++; continue; }
    if (!width || !NUMERIC_REGEX.test(width) || parseFloat(width) <= 0) { errors.push({ row: rowNum, name: displayName, error: "Width must be a positive numeric value." }); skipped++; continue; }
    if (!widthUnitType) { errors.push({ row: rowNum, name: displayName, error: "Width Unit Type is required." }); skipped++; continue; }
    if (!NAME_REGEX.test(widthUnitType) || widthUnitType.length > 50) { errors.push({ row: rowNum, name: displayName, error: "Width Unit Type must contain only letters (max 50 characters)." }); skipped++; continue; }
    if (!pricePerMeter || !NUMERIC_REGEX.test(pricePerMeter) || parseFloat(pricePerMeter) <= 0) { errors.push({ row: rowNum, name: displayName, error: "Price Per Meter must be a positive numeric value." }); skipped++; continue; }
    if (!hsnCode) { errors.push({ row: rowNum, name: displayName, error: "HSN Code is required." }); skipped++; continue; }

    const hexCode = String(row.hexCode ?? "").trim() || "#c9b45c";
    const height = String(row.height ?? "").trim() || undefined;
    const unitType = String(row.unitType ?? "").trim() || undefined;
    const gstPercent = String(row.gstPercent ?? "").trim() || undefined;
    const vendor = String(row.vendor ?? "").trim() || undefined;

    try {
      const [{ total }] = await db.select({ total: count() }).from(fabricsTable);
      const fabricCode = `FAB${String(total + 1).padStart(4, "0")}`;
      const createdBy = req.user?.email ?? "system";

      await db.insert(fabricsTable).values({
        fabricCode, fabricType, quality, colorName,
        hexCode, color: hexCode,
        width, height: height ?? null,
        widthUnitType, unitType: unitType ?? "",
        pricePerMeter, hsnCode,
        gstPercent: gstPercent ?? "",
        vendor: vendor ?? null,
        currentStock: "0", locationStocks: [], images: [],
        isActive: true, isDeleted: false, createdBy,
      });
      imported++;
    } catch {
      errors.push({ row: rowNum, name: displayName, error: "Failed to insert record." });
      skipped++;
    }
  }

  res.json({ imported, skipped, errors });
});

function cleanStockLevels(body: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...body };
  if (cleaned.reorderLevel === "") delete cleaned.reorderLevel;
  if (cleaned.minimumLevel === "") delete cleaned.minimumLevel;
  if (cleaned.maximumLevel === "") delete cleaned.maximumLevel;
  return cleaned;
}

router.post("/fabrics", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const fieldError = validateFabricFields(req.body);
  if (fieldError) { res.status(400).json({ error: fieldError }); return; }

  const parsed = insertFabricSchema.safeParse(cleanStockLevels(req.body));
  if (!parsed.success) {
    const firstMsg = parsed.error.issues[0]?.message ?? "Validation failed";
    res.status(400).json({ error: firstMsg, details: parsed.error.flatten() });
    return;
  }

  const createdBy = req.user?.email ?? "system";
  const [{ total }] = await db.select({ total: count() }).from(fabricsTable);
  const fabricCode = `FAB${String(total + 1).padStart(4, "0")}`;

  const [record] = await db.insert(fabricsTable).values({ ...parsed.data, fabricCode, createdBy }).returning();
  logger.info({ id: record.id, fabricCode }, "Fabric created");
  ensureInventoryRecord("fabric", record.id, {
    itemName: [record.fabricType, record.quality, record.colorName].filter(Boolean).join(" - "),
    itemCode: record.fabricCode,
    category: record.fabricType,
    warehouseLocation: record.location ?? undefined,
    unitType: record.unitType,
    averagePrice: record.pricePerMeter,
    preferredVendor: record.vendor ?? undefined,
    images: (record.images as { id: string; name: string; data: string; size: number }[]) ?? [],
  });
  res.status(201).json(record);
});

router.put("/fabrics/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const fieldError = validateFabricFields(req.body);
  if (fieldError) { res.status(400).json({ error: fieldError }); return; }

  const parsed = updateFabricSchema.safeParse(cleanStockLevels(req.body));
  if (!parsed.success) {
    const firstMsg = parsed.error.issues[0]?.message ?? "Validation failed";
    res.status(400).json({ error: firstMsg, details: parsed.error.flatten() });
    return;
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db
    .update(fabricsTable)
    .set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(fabricsTable.id, id), eq(fabricsTable.isDeleted, false)))
    .returning();

  if (!record) { res.status(404).json({ error: "Fabric not found" }); return; }
  logger.info({ id: record.id }, "Fabric updated");
  if (parsed.data.images !== undefined) {
    updateInventoryImages("fabric", record.id, (record.images as { id: string; name: string; data: string; size: number }[]) ?? []);
  }
  if (parsed.data.reorderLevel !== undefined || parsed.data.minimumLevel !== undefined || parsed.data.maximumLevel !== undefined) {
    updateInventoryStockLevels("fabric", record.id, parsed.data.reorderLevel, parsed.data.minimumLevel, parsed.data.maximumLevel);
  }
  res.json(record);
});

router.patch("/fabrics/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db.select().from(fabricsTable).where(and(eq(fabricsTable.id, id), eq(fabricsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Fabric not found" }); return; }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db
    .update(fabricsTable)
    .set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() })
    .where(eq(fabricsTable.id, id))
    .returning();

  logger.info({ id: record.id, isActive: record.isActive }, "Fabric status toggled");
  res.json(record);
});

router.delete("/fabrics/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db
    .update(fabricsTable)
    .set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(fabricsTable.id, id), eq(fabricsTable.isDeleted, false)))
    .returning();

  if (!record) { res.status(404).json({ error: "Fabric not found" }); return; }
  logger.info({ id: record.id }, "Fabric soft-deleted");
  res.json({ message: "Fabric deleted", record });
});

export default router;
