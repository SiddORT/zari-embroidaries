import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, count, asc } from "drizzle-orm";
import { db, vendorsTable } from "@workspace/db";
import { insertVendorSchema, updateVendorSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

function buildWhere(search: string, status: string) {
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
  return and(...conditions);
}

router.get("/vendors", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const whereClause = buildWhere(search, status);
  const [rows, countRows] = await Promise.all([
    db.select().from(vendorsTable).where(whereClause).orderBy(desc(vendorsTable.createdAt), desc(vendorsTable.id)).limit(limit).offset(offset),
    db.select({ id: vendorsTable.id }).from(vendorsTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

router.get("/vendors/export-all", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const whereClause = buildWhere(search, status);
  const rows = await db.select().from(vendorsTable).where(whereClause).orderBy(desc(vendorsTable.createdAt), desc(vendorsTable.id));
  res.json({ data: rows });
});

router.get("/vendors/all", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(vendorsTable)
    .where(and(eq(vendorsTable.isDeleted, false), eq(vendorsTable.isActive, true)))
    .orderBy(vendorsTable.brandName);
  res.json(rows);
});

router.get("/vendors/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [record] = await db.select().from(vendorsTable).where(and(eq(vendorsTable.id, id), eq(vendorsTable.isDeleted, false)));
  if (!record) { res.status(404).json({ error: "Vendor not found" }); return; }
  res.json(record);
});

router.post("/vendors", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertVendorSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const existing = await db.select({ id: vendorsTable.id }).from(vendorsTable)
    .where(and(eq(vendorsTable.brandName, parsed.data.brandName), eq(vendorsTable.isDeleted, false)));
  if (existing.length > 0) { res.status(409).json({ error: "A vendor with this Brand / Vendor Name already exists." }); return; }

  const createdBy = req.user?.email ?? "system";
  const [{ total }] = await db.select({ total: count() }).from(vendorsTable);
  const vendorCode = `VEN${String(total + 1).padStart(4, "0")}`;

  const [record] = await db.insert(vendorsTable).values({ ...parsed.data, vendorCode, createdBy }).returning();
  logger.info({ id: record.id, vendorCode }, "Vendor created");
  res.status(201).json(record);
});

router.post("/vendors/import", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const body = req.body;
  if (!Array.isArray(body) || body.length === 0) {
    res.status(400).json({ error: "Request body must be a non-empty array." });
    return;
  }

  const createdBy = req.user?.email ?? "system";
  let imported = 0;
  let skipped = 0;
  const errors: { row: number; name: string; error: string }[] = [];

  for (let i = 0; i < body.length; i++) {
    const row = body[i] as Record<string, unknown>;
    const rowNum = i + 2;
    const brandName = String(row.brandName ?? "").trim();

    const hasGst = row.hasGst === true || row.hasGst === "true" || row.hasGst === "Yes";
    const parsed = insertVendorSchema.safeParse({
      brandName,
      contactName: String(row.contactName ?? "").trim(),
      email: String(row.email ?? "").trim() || undefined,
      altEmail: String(row.altEmail ?? "").trim() || undefined,
      contactNo: String(row.contactNo ?? "").trim() || undefined,
      altContactNo: String(row.altContactNo ?? "").trim() || undefined,
      country: String(row.country ?? "").trim() || undefined,
      hasGst,
      gstNo: hasGst ? (String(row.gstNo ?? "").trim() || undefined) : undefined,
      addresses: Array.isArray(row.addresses) && row.addresses.length > 0 ? row.addresses : undefined,
      bankAccounts: Array.isArray(row.bankAccounts) && row.bankAccounts.length > 0 ? row.bankAccounts : undefined,
      isActive: true,
    });

    if (!parsed.success) {
      const msgs = Object.values(parsed.error.flatten().fieldErrors).flat().join("; ");
      errors.push({ row: rowNum, name: brandName, error: msgs });
      continue;
    }

    const dup = await db.select({ id: vendorsTable.id }).from(vendorsTable)
      .where(and(eq(vendorsTable.brandName, parsed.data.brandName), eq(vendorsTable.isDeleted, false)));
    if (dup.length > 0) { skipped++; continue; }

    try {
      const [{ total }] = await db.select({ total: count() }).from(vendorsTable);
      const vendorCode = `VEN${String(total + 1).padStart(4, "0")}`;
      await db.insert(vendorsTable).values({ ...parsed.data, vendorCode, createdBy });
      imported++;
    } catch {
      errors.push({ row: rowNum, name: brandName, error: "Database insert failed." });
    }
  }

  logger.info({ imported, skipped, errors: errors.length }, "Vendor bulk import");
  res.json({ imported, skipped, errors });
});

router.put("/vendors/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = updateVendorSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  if (parsed.data.brandName) {
    const conflict = await db.select({ id: vendorsTable.id }).from(vendorsTable)
      .where(and(eq(vendorsTable.brandName, parsed.data.brandName), eq(vendorsTable.isDeleted, false)));
    if (conflict.length > 0 && conflict[0].id !== id) {
      res.status(409).json({ error: "A vendor with this Brand / Vendor Name already exists." }); return;
    }
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(vendorsTable).set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(vendorsTable.id, id), eq(vendorsTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Vendor not found" }); return; }
  res.json(record);
});

router.patch("/vendors/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(vendorsTable).where(and(eq(vendorsTable.id, id), eq(vendorsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Vendor not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(vendorsTable)
    .set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() })
    .where(eq(vendorsTable.id, id)).returning();
  res.json(record);
});

router.delete("/vendors/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(vendorsTable).set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(vendorsTable.id, id), eq(vendorsTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Vendor not found" }); return; }
  res.json({ message: "Vendor deleted" });
});

export default router;
