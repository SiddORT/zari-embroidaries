import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, count } from "drizzle-orm";
import { db, vendorsTable } from "@workspace/db";
import { insertVendorSchema, updateVendorSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

router.get("/vendors", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const conditions = [eq(vendorsTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(vendorsTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(vendorsTable.isActive, false));
  if (search) {
    conditions.push(or(
      ilike(vendorsTable.vendorCode, `%${search}%`),
      ilike(vendorsTable.brandName, `%${search}%`),
      ilike(vendorsTable.contactName, `%${search}%`),
      ilike(vendorsTable.contactNo, `%${search}%`),
    )!);
  }

  const whereClause = and(...conditions);
  const [rows, countRows] = await Promise.all([
    db.select().from(vendorsTable).where(whereClause).orderBy(desc(vendorsTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: vendorsTable.id }).from(vendorsTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

router.get("/vendors/all", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(vendorsTable).where(and(eq(vendorsTable.isDeleted, false), eq(vendorsTable.isActive, true))).orderBy(vendorsTable.brandName);
  res.json(rows);
});

router.post("/vendors", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertVendorSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const createdBy = req.user?.email ?? "system";
  const [{ total }] = await db.select({ total: count() }).from(vendorsTable);
  const vendorCode = `VEN${String(total + 1).padStart(4, "0")}`;

  const [record] = await db.insert(vendorsTable).values({ ...parsed.data, vendorCode, createdBy }).returning();
  logger.info({ id: record.id, vendorCode }, "Vendor created");
  res.status(201).json(record);
});

router.put("/vendors/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = updateVendorSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(vendorsTable).set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(vendorsTable.id, id), eq(vendorsTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Vendor not found" }); return; }
  res.json(record);
});

router.patch("/vendors/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(vendorsTable).where(and(eq(vendorsTable.id, id), eq(vendorsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Vendor not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(vendorsTable).set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() }).where(eq(vendorsTable.id, id)).returning();
  res.json(record);
});

router.delete("/vendors/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(vendorsTable).set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(vendorsTable.id, id), eq(vendorsTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Vendor not found" }); return; }
  res.json({ message: "Vendor deleted" });
});

export default router;
