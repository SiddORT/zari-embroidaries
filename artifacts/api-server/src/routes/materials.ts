import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, count } from "drizzle-orm";
import { db, materialsTable } from "@workspace/db";
import { insertMaterialSchema, updateMaterialSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { ensureInventoryRecord, updateInventoryImages } from "../services/inventoryService";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

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
    db.select().from(materialsTable).where(whereClause).orderBy(desc(materialsTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: materialsTable.id }).from(materialsTable).where(whereClause),
  ]);

  res.json({ data: rows, total: countRows.length, page, limit });
});

router.post("/materials", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertMaterialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const createdBy = req.user?.email ?? "system";
  const [{ total }] = await db.select({ total: count() }).from(materialsTable);
  const materialCode = `MAT${String(total + 1).padStart(4, "0")}`;

  const [record] = await db.insert(materialsTable).values({ ...parsed.data, materialCode, createdBy }).returning();
  logger.info({ id: record.id, materialCode }, "Material created");
  ensureInventoryRecord("material", record.id, {
    itemName: [record.itemType, record.quality, record.colorName].filter(Boolean).join(" - "),
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

  const parsed = updateMaterialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db
    .update(materialsTable)
    .set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(materialsTable.id, id), eq(materialsTable.isDeleted, false)))
    .returning();

  if (!record) { res.status(404).json({ error: "Material not found" }); return; }
  logger.info({ id: record.id }, "Material updated");
  if (parsed.data.images !== undefined) {
    updateInventoryImages("material", record.id, (record.images as { id: string; name: string; data: string; size: number }[]) ?? []);
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
