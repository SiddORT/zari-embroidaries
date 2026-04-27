import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, count } from "drizzle-orm";
import { db, materialsTable } from "@workspace/db";
import { insertMaterialSchema, updateMaterialSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { ensureInventoryRecord, updateInventoryImages, updateInventoryStockLevels } from "../services/inventoryService";
import type { Request } from "express";
import * as XLSX from "xlsx";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const NUMERIC_REGEX = /^[0-9]+(\.[0-9]{1,2})?$/;

function validateMaterialFields(data: Record<string, unknown>): string[] {
  const errs: string[] = [];
  const textFields: [string, string, number][] = [
    ["itemType", "Item Type", 100],
    ["quality", "Quality", 100],
    ["type", "Type", 100],
    ["colorName", "Color Name", 100],
    ["unitType", "Unit Type", 50],
  ];
  for (const [field, label, max] of textFields) {
    const v = typeof data[field] === "string" ? (data[field] as string).trim() : "";
    if (!v) continue;
    if (v.length > max) errs.push(`${label} must be at most ${max} characters.`);
    if (!NAME_REGEX.test(v)) errs.push(`${label} must contain only letters and spaces.`);
  }
  for (const [field, label] of [["size", "Size"], ["unitPrice", "Unit Price"], ["currentStock", "Current Stock"]] as [string, string][]) {
    const v = typeof data[field] === "string" ? (data[field] as string).trim() : "";
    if (!v) continue;
    if (!NUMERIC_REGEX.test(v)) errs.push(`${label} must be a positive numeric value.`);
  }
  return errs;
}

router.get("/materials/export-all", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const hsnCodeFilter = (req.query.hsnCode as string) ?? "";
  const typeFilter = (req.query.type as string) ?? "";
  const vendorFilter = (req.query.vendor as string) ?? "";

  const conditions = [eq(materialsTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(materialsTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(materialsTable.isActive, false));
  if (hsnCodeFilter) conditions.push(eq(materialsTable.hsnCode, hsnCodeFilter));
  if (typeFilter) conditions.push(eq(materialsTable.itemType, typeFilter));
  if (vendorFilter) conditions.push(ilike(materialsTable.vendor, `%${vendorFilter}%`));
  if (search) {
    conditions.push(or(
      ilike(materialsTable.materialCode, `%${search}%`),
      ilike(materialsTable.materialName, `%${search}%`),
      ilike(materialsTable.itemType, `%${search}%`),
      ilike(materialsTable.quality, `%${search}%`),
      ilike(materialsTable.colorName, `%${search}%`),
      ilike(materialsTable.hsnCode, `%${search}%`),
      ilike(materialsTable.vendor, `%${search}%`),
    )!);
  }

  const rows = await db.select().from(materialsTable).where(and(...conditions))
    .orderBy(desc(materialsTable.createdAt), desc(materialsTable.id));
  res.json(rows);
});

router.post("/materials/import", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { rows: rawRows } = req.body as { rows: Record<string, unknown>[] };
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    res.status(400).json({ error: "No rows provided." });
    return;
  }

  const createdBy = req.user?.email ?? "system";
  const results: { row: number; status: "success" | "error"; materialCode?: string; errors?: string[] }[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 2;
    const rowErrors: string[] = [];

    const quality = typeof raw["Quality"] === "string" ? raw["Quality"].trim() : "";
    const colorName = typeof raw["Color Name"] === "string" ? raw["Color Name"].trim() : "";
    const size = typeof raw["Size"] === "string" ? raw["Size"].trim() : String(raw["Size"] ?? "").trim();
    const unitPrice = typeof raw["Unit Price"] === "string" ? raw["Unit Price"].trim() : String(raw["Unit Price"] ?? "").trim();
    const unitType = typeof raw["Unit Type"] === "string" ? raw["Unit Type"].trim() : "";
    const currentStock = typeof raw["Current Stock"] === "string" ? raw["Current Stock"].trim() : String(raw["Current Stock"] ?? "").trim();
    const hsnCode = typeof raw["HSN Code"] === "string" ? raw["HSN Code"].trim() : String(raw["HSN Code"] ?? "").trim();
    const gstPercent = typeof raw["GST %"] === "string" ? raw["GST %"].trim() : String(raw["GST %"] ?? "").trim();
    const itemType = typeof raw["Item Type"] === "string" ? raw["Item Type"].trim() : "";
    const materialName = typeof raw["Material Name"] === "string" ? raw["Material Name"].trim() : "";
    const type = typeof raw["Type"] === "string" ? raw["Type"].trim() : "";
    const colorHex = typeof raw["Hex Code"] === "string" ? raw["Hex Code"].trim() : "#c9b45c";
    const vendor = typeof raw["Preferred Vendors"] === "string" ? raw["Preferred Vendors"].trim() : "";
    const isActiveRaw = typeof raw["Status"] === "string" ? raw["Status"].trim().toLowerCase() : "active";
    const isActive = isActiveRaw !== "inactive";

    if (!quality) rowErrors.push("Quality is required");
    else if (!NAME_REGEX.test(quality)) rowErrors.push("Quality must contain only letters and spaces.");
    if (!colorName) rowErrors.push("Color Name is required");
    else if (!NAME_REGEX.test(colorName)) rowErrors.push("Color Name must contain only letters and spaces.");
    if (!size) rowErrors.push("Size is required");
    else if (!NUMERIC_REGEX.test(size)) rowErrors.push("Size must be a positive numeric value.");
    if (!unitPrice) rowErrors.push("Unit Price is required");
    else if (!NUMERIC_REGEX.test(unitPrice)) rowErrors.push("Unit Price must be a positive numeric value.");
    if (!unitType) rowErrors.push("Unit Type is required");
    else if (!NAME_REGEX.test(unitType)) rowErrors.push("Unit Type must contain only letters.");
    if (!currentStock) rowErrors.push("Current Stock is required");
    else if (!NUMERIC_REGEX.test(currentStock)) rowErrors.push("Current Stock must be a positive numeric value.");
    if (!hsnCode) rowErrors.push("HSN Code is required");
    if (!gstPercent) rowErrors.push("GST % is required");
    if (itemType && !NAME_REGEX.test(itemType)) rowErrors.push("Item Type must contain only letters and spaces.");
    if (type && !NAME_REGEX.test(type)) rowErrors.push("Type must contain only letters and spaces.");

    if (rowErrors.length > 0) {
      results.push({ row: rowNum, status: "error", errors: rowErrors });
      continue;
    }

    try {
      const [{ total }] = await db.select({ total: count() }).from(materialsTable);
      const materialCode = `MAT${String(total + 1).padStart(4, "0")}`;
      const [record] = await db.insert(materialsTable).values({
        materialCode, materialName: materialName || null, itemType, quality, type: type || null,
        hexCode: colorHex, color: colorHex, colorName, size, unitPrice, unitType, currentStock,
        hsnCode, gstPercent, vendor: vendor || null, isActive, createdBy, images: [], locationStocks: [],
      }).returning();
      results.push({ row: rowNum, status: "success", materialCode: record.materialCode });
    } catch (err) {
      results.push({ row: rowNum, status: "error", errors: [(err as Error).message] });
    }
  }

  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;
  res.json({ succeeded, failed, results });
});

router.get("/materials/all", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(materialsTable)
    .where(and(eq(materialsTable.isDeleted, false), eq(materialsTable.isActive, true)))
    .orderBy(materialsTable.itemType, materialsTable.quality);
  res.json(rows);
});

router.get("/materials", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const hsnCodeFilter = (req.query.hsnCode as string) ?? "";
  const typeFilter = (req.query.type as string) ?? "";
  const vendorFilter = (req.query.vendor as string) ?? "";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const conditions = [eq(materialsTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(materialsTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(materialsTable.isActive, false));
  if (hsnCodeFilter) conditions.push(eq(materialsTable.hsnCode, hsnCodeFilter));
  if (typeFilter) conditions.push(eq(materialsTable.itemType, typeFilter));
  if (vendorFilter) conditions.push(ilike(materialsTable.vendor, `%${vendorFilter}%`));

  if (search) {
    conditions.push(
      or(
        ilike(materialsTable.materialCode, `%${search}%`),
        ilike(materialsTable.materialName, `%${search}%`),
        ilike(materialsTable.itemType, `%${search}%`),
        ilike(materialsTable.quality, `%${search}%`),
        ilike(materialsTable.colorName, `%${search}%`),
        ilike(materialsTable.hsnCode, `%${search}%`),
        ilike(materialsTable.vendor, `%${search}%`),
      )!,
    );
  }

  const whereClause = and(...conditions);
  const [rows, countRows] = await Promise.all([
    db.select().from(materialsTable).where(whereClause)
      .orderBy(desc(materialsTable.createdAt), desc(materialsTable.id))
      .limit(limit).offset(offset),
    db.select({ id: materialsTable.id }).from(materialsTable).where(whereClause),
  ]);

  res.json({ data: rows, total: countRows.length, page, limit });
});

router.post("/materials", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const extraErrors = validateMaterialFields(req.body as Record<string, unknown>);
  if (extraErrors.length > 0) {
    res.status(400).json({ error: extraErrors[0], details: extraErrors });
    return;
  }

  const parsed = insertMaterialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const createdBy = req.user?.email ?? "system";
  const [{ total }] = await db.select({ total: count() }).from(materialsTable);
  const materialCode = `MAT${String(total + 1).padStart(4, "0")}`;

  const ls = parsed.data.locationStocks ?? [];
  const totalStock = ls.reduce((sum, s) => sum + (parseFloat(s.stock) || 0), 0);
  const currentStock = ls.length > 0 ? String(totalStock) : parsed.data.currentStock;

  const [record] = await db.insert(materialsTable).values({
    ...parsed.data,
    materialCode,
    currentStock,
    createdBy,
  }).returning();

  logger.info({ id: record.id, materialCode }, "Material created");
  ensureInventoryRecord("material", record.id, {
    itemName: record.materialName || [record.itemType, record.quality, record.colorName].filter(Boolean).join(" - "),
    itemCode: record.materialCode,
    category: record.itemType,
    warehouseLocation: record.location ?? undefined,
    unitType: record.unitType,
    averagePrice: record.unitPrice,
    preferredVendor: record.vendor ?? undefined,
    images: (record.images as { id: string; name: string; data: string; size: number }[]) ?? [],
  });
  res.status(201).json(record);
});

router.put("/materials/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const extraErrors = validateMaterialFields(req.body as Record<string, unknown>);
  if (extraErrors.length > 0) {
    res.status(400).json({ error: extraErrors[0], details: extraErrors });
    return;
  }

  const parsed = updateMaterialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const updatedBy = req.user?.email ?? "system";

  const ls = parsed.data.locationStocks;
  let currentStock = parsed.data.currentStock;
  if (ls && ls.length > 0) {
    const total = ls.reduce((sum, s) => sum + (parseFloat(s.stock) || 0), 0);
    currentStock = String(total);
  }

  const [record] = await db
    .update(materialsTable)
    .set({ ...parsed.data, currentStock, updatedBy, updatedAt: new Date() })
    .where(and(eq(materialsTable.id, id), eq(materialsTable.isDeleted, false)))
    .returning();

  if (!record) { res.status(404).json({ error: "Material not found" }); return; }
  logger.info({ id: record.id }, "Material updated");
  if (parsed.data.images !== undefined) {
    updateInventoryImages("material", record.id, (record.images as { id: string; name: string; data: string; size: number }[]) ?? []);
  }
  if (parsed.data.reorderLevel !== undefined || parsed.data.minimumLevel !== undefined || parsed.data.maximumLevel !== undefined) {
    updateInventoryStockLevels("material", record.id, parsed.data.reorderLevel, parsed.data.minimumLevel, parsed.data.maximumLevel);
  }
  res.json(record);
});

router.patch("/materials/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db.select().from(materialsTable).where(and(eq(materialsTable.id, id), eq(materialsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Material not found" }); return; }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db
    .update(materialsTable)
    .set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() })
    .where(eq(materialsTable.id, id))
    .returning();

  logger.info({ id: record.id, isActive: record.isActive }, "Material status toggled");
  res.json(record);
});

router.delete("/materials/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db
    .update(materialsTable)
    .set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(materialsTable.id, id), eq(materialsTable.isDeleted, false)))
    .returning();

  if (!record) { res.status(404).json({ error: "Material not found" }); return; }
  logger.info({ id: record.id }, "Material soft-deleted");
  res.json({ message: "Material deleted", record });
});

export default router;
