import { Router, type IRouter } from "express";
import { eq, ilike, and, desc, sql } from "drizzle-orm";
import { db, itemsTable, insertItemSchema, updateItemSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const NUMERIC_REGEX = /^[0-9]+(\.[0-9]{1,2})?$/;

function validateItemPayload(body: Record<string, unknown>): string | null {
  const name = (body.itemName as string ?? "").trim();
  if (!name) return "Item Name is required.";
  if (name.length > 100) return "Item Name must be at most 100 characters.";
  if (!NAME_REGEX.test(name)) return "Item Name must contain only letters and spaces.";
  if (body.itemType && !NAME_REGEX.test((body.itemType as string).trim()))
    return "Item Type must contain only letters and spaces.";
  const ut = (body.unitType as string ?? "").trim();
  if (!ut) return "Unit Type is required.";
  if (!NAME_REGEX.test(ut)) return "Unit Type must contain only letters.";
  const up = (body.unitPrice as string ?? "").trim();
  if (!up) return "Unit Price is required.";
  if (!NUMERIC_REGEX.test(up)) return "Unit Price must be a positive numeric value.";
  return null;
}

async function generateItemCode(): Promise<string> {
  const [{ count }] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(itemsTable);
  return `ITM${String(count + 1).padStart(4, "0")}`;
}

function computeStock(locationStocks: { location: string; stock: string }[]): string {
  const total = locationStocks.reduce((sum, s) => sum + (parseFloat(s.stock) || 0), 0);
  return String(total);
}

/* ─── Export All ─────────────────────────────────────────────────── */
router.get("/items/export-all", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";

  const conditions = [eq(itemsTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(itemsTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(itemsTable.isActive, false));
  if (search) conditions.push(ilike(itemsTable.itemName, `%${search}%`));

  const rows = await db.select().from(itemsTable)
    .where(and(...conditions))
    .orderBy(desc(itemsTable.createdAt), desc(itemsTable.id));
  res.json(rows);
});

/* ─── Import ─────────────────────────────────────────────────────── */
router.post("/items/import", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { rows: rawRows } = req.body as { rows: Record<string, unknown>[] };
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    res.status(400).json({ error: "No rows provided." }); return;
  }

  const createdBy = req.user?.email ?? "system";
  const results: { row: number; status: "success" | "error"; itemCode?: string; errors?: string[] }[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 2;
    const rowErrors: string[] = [];

    const itemName = typeof raw["Item Name"] === "string" ? raw["Item Name"].trim() : "";
    const itemType = typeof raw["Item Type"] === "string" ? raw["Item Type"].trim() : "";
    const unitType = typeof raw["Unit Type"] === "string" ? raw["Unit Type"].trim() : "";
    const unitPrice = typeof raw["Unit Price"] === "string" ? raw["Unit Price"].trim() : String(raw["Unit Price"] ?? "").trim();
    const currentStock = typeof raw["Current Stock"] === "string" ? raw["Current Stock"].trim() : String(raw["Current Stock"] ?? "0").trim();
    const description = typeof raw["Description"] === "string" ? raw["Description"].trim() : "";
    const hsnCode = typeof raw["HSN Code"] === "string" ? raw["HSN Code"].trim() : "";
    const gstPercent = typeof raw["GST %"] === "string" ? raw["GST %"].trim() : String(raw["GST %"] ?? "").trim();
    const isActiveRaw = typeof raw["Status"] === "string" ? raw["Status"].trim().toLowerCase() : "active";
    const isActive = isActiveRaw !== "inactive";

    if (!itemName) rowErrors.push("Item Name is required.");
    else if (itemName.length > 100) rowErrors.push("Item Name must be at most 100 characters.");
    else if (!NAME_REGEX.test(itemName)) rowErrors.push("Item Name must contain only letters and spaces.");
    if (itemType && !NAME_REGEX.test(itemType)) rowErrors.push("Item Type must contain only letters and spaces.");
    if (!unitType) rowErrors.push("Unit Type is required.");
    else if (!NAME_REGEX.test(unitType)) rowErrors.push("Unit Type must contain only letters.");
    if (!unitPrice) rowErrors.push("Unit Price is required.");
    else if (!NUMERIC_REGEX.test(unitPrice)) rowErrors.push("Unit Price must be a positive numeric value.");

    if (rowErrors.length > 0) { results.push({ row: rowNum, status: "error", errors: rowErrors }); continue; }

    try {
      const itemCode = await generateItemCode();
      const [record] = await db.insert(itemsTable).values({
        itemCode,
        itemName,
        itemType,
        description: description || undefined,
        unitType,
        unitPrice,
        currentStock: currentStock || "0",
        hsnCode: hsnCode || undefined,
        gstPercent: gstPercent || undefined,
        isActive,
        createdBy,
      }).returning();
      results.push({ row: rowNum, status: "success", itemCode: record.itemCode });
    } catch (err) {
      results.push({ row: rowNum, status: "error", errors: [(err as Error).message] });
    }
  }

  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;
  res.json({ succeeded, failed, results });
});

/* ─── List ───────────────────────────────────────────────────────── */
router.get("/items", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const conditions = [eq(itemsTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(itemsTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(itemsTable.isActive, false));
  if (search) conditions.push(ilike(itemsTable.itemName, `%${search}%`));

  const where = and(...conditions);
  const [rows, countRows] = await Promise.all([
    db.select().from(itemsTable).where(where)
      .orderBy(desc(itemsTable.createdAt), desc(itemsTable.id))
      .limit(limit).offset(offset),
    db.select({ id: itemsTable.id }).from(itemsTable).where(where),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

/* ─── Create ─────────────────────────────────────────────────────── */
router.post("/items", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const bodyErr = validateItemPayload(req.body as Record<string, unknown>);
  if (bodyErr) { res.status(400).json({ error: bodyErr }); return; }

  const parsed = insertItemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const d = parsed.data;
  const locationStocks = d.locationStocks ?? [];
  const currentStock = locationStocks.length > 0 ? computeStock(locationStocks) : (d.currentStock ?? "0");

  const itemCode = await generateItemCode();
  const createdBy = req.user?.email ?? "system";

  const [record] = await db.insert(itemsTable).values({
    itemCode,
    itemName: d.itemName.trim(),
    itemType: (d.itemType ?? "").trim(),
    description: d.description?.trim() || undefined,
    unitType: d.unitType.trim(),
    unitPrice: d.unitPrice.trim(),
    hsnCode: d.hsnCode?.trim() || undefined,
    gstPercent: d.gstPercent?.trim() || undefined,
    currentStock,
    locationStocks,
    images: d.images ?? [],
    reorderLevel: d.reorderLevel || undefined,
    minimumLevel: d.minimumLevel || undefined,
    maximumLevel: d.maximumLevel || undefined,
    isActive: d.isActive ?? true,
    createdBy,
  }).returning();

  logger.info({ id: record.id, itemCode: record.itemCode }, "Item created");
  res.status(201).json(record);
});

/* ─── Update ─────────────────────────────────────────────────────── */
router.put("/items/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const bodyErr = validateItemPayload(req.body as Record<string, unknown>);
  if (bodyErr) { res.status(400).json({ error: bodyErr }); return; }

  const parsed = updateItemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const d = parsed.data;
  const locationStocks = d.locationStocks ?? [];
  const currentStock = locationStocks.length > 0 ? computeStock(locationStocks) : (d.currentStock ?? "0");

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(itemsTable)
    .set({
      ...(d.itemName !== undefined && { itemName: d.itemName.trim() }),
      ...(d.itemType !== undefined && { itemType: d.itemType.trim() }),
      ...(d.description !== undefined && { description: d.description.trim() || undefined }),
      ...(d.unitType !== undefined && { unitType: d.unitType.trim() }),
      ...(d.unitPrice !== undefined && { unitPrice: d.unitPrice.trim() }),
      ...(d.hsnCode !== undefined && { hsnCode: d.hsnCode.trim() || undefined }),
      ...(d.gstPercent !== undefined && { gstPercent: d.gstPercent.trim() || undefined }),
      ...(d.locationStocks !== undefined && { locationStocks, currentStock }),
      ...(d.images !== undefined && { images: d.images }),
      ...(d.reorderLevel !== undefined && { reorderLevel: d.reorderLevel || undefined }),
      ...(d.minimumLevel !== undefined && { minimumLevel: d.minimumLevel || undefined }),
      ...(d.maximumLevel !== undefined && { maximumLevel: d.maximumLevel || undefined }),
      ...(d.isActive !== undefined && { isActive: d.isActive }),
      updatedBy,
      updatedAt: new Date(),
    })
    .where(and(eq(itemsTable.id, id), eq(itemsTable.isDeleted, false)))
    .returning();

  if (!record) { res.status(404).json({ error: "Item not found" }); return; }
  res.json(record);
});

/* ─── Toggle Status ──────────────────────────────────────────────── */
router.patch("/items/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(itemsTable)
    .where(and(eq(itemsTable.id, id), eq(itemsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Item not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(itemsTable)
    .set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() })
    .where(eq(itemsTable.id, id)).returning();
  res.json(record);
});

/* ─── Delete ─────────────────────────────────────────────────────── */
router.delete("/items/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(itemsTable)
    .set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(itemsTable.id, id), eq(itemsTable.isDeleted, false)))
    .returning();
  if (!record) { res.status(404).json({ error: "Item not found" }); return; }
  res.json({ message: "Item deleted" });
});

export default router;
