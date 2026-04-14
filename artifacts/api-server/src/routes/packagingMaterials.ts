import { Router, type IRouter } from "express";
import { eq, ilike, and, or, desc } from "drizzle-orm";
import { db, packagingMaterialsTable, insertPackagingMaterialSchema, updatePackagingMaterialSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

router.get("/packaging-materials", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const department = (req.query.department as string) ?? "";
  const vendor = (req.query.vendor as string) ?? "";
  const location = (req.query.location as string) ?? "";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const conditions = [eq(packagingMaterialsTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(packagingMaterialsTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(packagingMaterialsTable.isActive, false));
  if (department) conditions.push(ilike(packagingMaterialsTable.department, `%${department}%`));
  if (vendor) conditions.push(ilike(packagingMaterialsTable.vendor, `%${vendor}%`));
  if (location) conditions.push(eq(packagingMaterialsTable.location, location));
  if (search) {
    conditions.push(or(
      ilike(packagingMaterialsTable.itemName, `%${search}%`),
      ilike(packagingMaterialsTable.itemCode, `%${search}%`),
    )!);
  }

  const whereClause = and(...conditions);
  const [rows, countRows] = await Promise.all([
    db.select().from(packagingMaterialsTable).where(whereClause).orderBy(desc(packagingMaterialsTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: packagingMaterialsTable.id }).from(packagingMaterialsTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

router.post("/packaging-materials", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertPackagingMaterialSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }
  const createdBy = req.user?.email ?? "system";
  const total = await db.select({ id: packagingMaterialsTable.id }).from(packagingMaterialsTable);
  const itemCode = `ITM${String(total.length + 1).padStart(4, "0")}`;
  const [record] = await db.insert(packagingMaterialsTable).values({ ...parsed.data, itemCode, createdBy }).returning();
  logger.info({ id: record.id, itemCode }, "Item master record created");
  res.status(201).json(record);
});

router.put("/packaging-materials/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = updatePackagingMaterialSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(packagingMaterialsTable)
    .set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(packagingMaterialsTable.id, id), eq(packagingMaterialsTable.isDeleted, false)))
    .returning();
  if (!record) { res.status(404).json({ error: "Record not found" }); return; }
  res.json(record);
});

router.patch("/packaging-materials/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [current] = await db.select().from(packagingMaterialsTable).where(and(eq(packagingMaterialsTable.id, id), eq(packagingMaterialsTable.isDeleted, false)));
  if (!current) { res.status(404).json({ error: "Record not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(packagingMaterialsTable)
    .set({ isActive: !current.isActive, updatedBy, updatedAt: new Date() })
    .where(eq(packagingMaterialsTable.id, id)).returning();
  res.json(record);
});

router.delete("/packaging-materials/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const updatedBy = req.user?.email ?? "system";
  await db.update(packagingMaterialsTable)
    .set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(eq(packagingMaterialsTable.id, id));
  res.json({ message: "Deleted" });
});

export default router;
