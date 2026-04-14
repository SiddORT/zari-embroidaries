import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, count } from "drizzle-orm";
import { db, fabricsTable } from "@workspace/db";
import { insertFabricSchema, updateFabricSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

router.get("/fabrics", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const fabricType = (req.query.fabricType as string) ?? "";
  const vendor = (req.query.vendor as string) ?? "";
  const hsnCode = (req.query.hsnCode as string) ?? "";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const conditions = [eq(fabricsTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(fabricsTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(fabricsTable.isActive, false));
  if (fabricType) conditions.push(ilike(fabricsTable.fabricType, `%${fabricType}%`));
  if (vendor) conditions.push(ilike(fabricsTable.vendor, `%${vendor}%`));
  if (hsnCode) conditions.push(ilike(fabricsTable.hsnCode, `%${hsnCode}%`));

  if (search) {
    conditions.push(
      or(
        ilike(fabricsTable.fabricCode, `%${search}%`),
        ilike(fabricsTable.fabricType, `%${search}%`),
        ilike(fabricsTable.quality, `%${search}%`),
        ilike(fabricsTable.colorName, `%${search}%`),
        ilike(fabricsTable.hsnCode, `%${search}%`),
      )!,
    );
  }

  const whereClause = and(...conditions);
  const [rows, countRows] = await Promise.all([
    db.select().from(fabricsTable).where(whereClause).orderBy(desc(fabricsTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: fabricsTable.id }).from(fabricsTable).where(whereClause),
  ]);

  res.json({ data: rows, total: countRows.length, page, limit });
});

router.post("/fabrics", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertFabricSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const createdBy = req.user?.email ?? "system";
  const [{ total }] = await db.select({ total: count() }).from(fabricsTable);
  const fabricCode = `FAB${String(total + 1).padStart(4, "0")}`;

  const [record] = await db.insert(fabricsTable).values({ ...parsed.data, fabricCode, createdBy }).returning();
  logger.info({ id: record.id, fabricCode }, "Fabric created");
  res.status(201).json(record);
});

router.put("/fabrics/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = updateFabricSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
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
  res.json(record);
});

router.patch("/fabrics/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
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
  const id = parseInt(req.params.id, 10);
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
