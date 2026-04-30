import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, count, asc } from "drizzle-orm";
import { db, clientsTable } from "@workspace/db";
import { insertClientSchema, updateClientSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { zodFieldErrorsToHuman } from "../lib/importHelpers";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const CONTACT_DIGITS_REGEX = /^[0-9]{10}$/;

function buildWhere(search: string, status: string) {
  const conditions = [eq(clientsTable.isDeleted, false)];
  if (status === "active") conditions.push(eq(clientsTable.isActive, true));
  else if (status === "inactive") conditions.push(eq(clientsTable.isActive, false));
  if (search) {
    conditions.push(or(
      ilike(clientsTable.clientCode, `%${search}%`),
      ilike(clientsTable.brandName, `%${search}%`),
      ilike(clientsTable.contactName, `%${search}%`),
      ilike(clientsTable.email, `%${search}%`),
      ilike(clientsTable.contactNo, `%${search}%`),
    )!);
  }
  return and(...conditions);
}

router.get("/clients", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const whereClause = buildWhere(search, status);
  const [rows, countRows] = await Promise.all([
    db.select().from(clientsTable).where(whereClause).orderBy(desc(clientsTable.createdAt), desc(clientsTable.id)).limit(limit).offset(offset),
    db.select({ id: clientsTable.id }).from(clientsTable).where(whereClause),
  ]);
  res.json({ data: rows, total: countRows.length, page, limit });
});

router.get("/clients/export-all", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const whereClause = buildWhere(search, status);
  const rows = await db.select().from(clientsTable).where(whereClause).orderBy(desc(clientsTable.createdAt), desc(clientsTable.id));
  res.json({ data: rows });
});

router.get("/clients/all", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(clientsTable).where(and(eq(clientsTable.isDeleted, false), eq(clientsTable.isActive, true))).orderBy(clientsTable.brandName);
  res.json(rows);
});

router.get("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [record] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.isDeleted, false)));
  if (!record) { res.status(404).json({ error: "Client not found" }); return; }
  res.json(record);
});

router.post("/clients", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertClientSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const bn = parsed.data.brandName.trim();
  const cn = parsed.data.contactName.trim();

  if (!NAME_REGEX.test(bn)) {
    res.status(400).json({ error: "Client Name must contain only letters and spaces." }); return;
  }
  if (!NAME_REGEX.test(cn)) {
    res.status(400).json({ error: "Contact Name must contain only letters and spaces." }); return;
  }

  const existing = await db.select({ id: clientsTable.id }).from(clientsTable)
    .where(and(eq(clientsTable.isDeleted, false), ilike(clientsTable.brandName, bn)));
  if (existing.length > 0) {
    res.status(409).json({ error: `A client named "${bn}" already exists.` }); return;
  }

  const createdBy = req.user?.email ?? "system";
  const [{ total }] = await db.select({ total: count() }).from(clientsTable);
  const clientCode = `CLI${String(total + 1).padStart(4, "0")}`;

  const [record] = await db.insert(clientsTable).values({ ...parsed.data, brandName: bn, contactName: cn, clientCode, createdBy }).returning();
  logger.info({ id: record.id, clientCode }, "Client created");
  res.status(201).json(record);
});

router.put("/clients/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = updateClientSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  if (parsed.data.brandName !== undefined) {
    const bn = parsed.data.brandName.trim();
    if (!NAME_REGEX.test(bn)) {
      res.status(400).json({ error: "Client Name must contain only letters and spaces." }); return;
    }
    parsed.data.brandName = bn;
    const conflict = await db.select({ id: clientsTable.id }).from(clientsTable)
      .where(and(eq(clientsTable.brandName, bn), eq(clientsTable.isDeleted, false)));
    if (conflict.length > 0 && conflict[0].id !== id) { res.status(409).json({ error: `A client named "${bn}" already exists.` }); return; }
  }
  if (parsed.data.contactName !== undefined) {
    const cn = parsed.data.contactName.trim();
    if (!NAME_REGEX.test(cn)) {
      res.status(400).json({ error: "Contact Name must contain only letters and spaces." }); return;
    }
    parsed.data.contactName = cn;
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(clientsTable).set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(clientsTable.id, id), eq(clientsTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Client not found" }); return; }
  res.json(record);
});

router.patch("/clients/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Client not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(clientsTable).set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() }).where(eq(clientsTable.id, id)).returning();
  res.json(record);
});

router.delete("/clients/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(clientsTable).set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(clientsTable.id, id), eq(clientsTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Client not found" }); return; }
  res.json({ message: "Client deleted" });
});

router.post("/clients/import", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const body = req.body;
  if (!Array.isArray(body) || body.length === 0) {
    res.status(400).json({ error: "Request body must be a non-empty array." }); return;
  }

  const createdBy = req.user?.email ?? "system";
  let imported = 0;
  let skipped = 0;
  const errors: { row: number; name: string; error: string }[] = [];

  for (let i = 0; i < body.length; i++) {
    const row = body[i] as Record<string, unknown>;
    const rowNum = i + 2;
    const brandName = String(row.brandName ?? "").trim();
    const contactName = String(row.contactName ?? "").trim();

    if (!brandName) { errors.push({ row: rowNum, name: "", error: "Brand / Client Name is required." }); skipped++; continue; }
    if (!NAME_REGEX.test(brandName)) { errors.push({ row: rowNum, name: brandName, error: "Client Name must contain only letters and spaces." }); skipped++; continue; }
    if (!contactName) { errors.push({ row: rowNum, name: brandName, error: "Contact Name is required." }); skipped++; continue; }
    if (!NAME_REGEX.test(contactName)) { errors.push({ row: rowNum, name: brandName, error: "Contact Name must contain only letters and spaces." }); skipped++; continue; }

    const rawContact = String(row.contactNo ?? "").trim().replace(/\D/g, "");
    const contact10 = rawContact.length > 10 ? rawContact.slice(-10) : rawContact;
    if (!CONTACT_DIGITS_REGEX.test(contact10)) {
      errors.push({ row: rowNum, name: brandName, error: "Contact Number must be exactly 10 digits." }); skipped++; continue;
    }

    const existing = await db.select({ id: clientsTable.id }).from(clientsTable)
      .where(and(eq(clientsTable.isDeleted, false), ilike(clientsTable.brandName, brandName)));
    if (existing.length > 0) { errors.push({ row: rowNum, name: brandName, error: "Client already exists." }); skipped++; continue; }

    const addresses = Array.isArray(row.addresses) && row.addresses.length > 0 ? row.addresses : undefined;

    const parsed = insertClientSchema.safeParse({
      brandName,
      contactName,
      email: String(row.email ?? "").trim() || undefined,
      altEmail: String(row.altEmail ?? "").trim() || undefined,
      contactNo: contact10,
      altContactNo: String(row.altContactNo ?? "").trim() || undefined,
      country: String(row.country ?? "").trim() || undefined,
      countryOfOrigin: String(row.country ?? "").trim() || undefined,
      invoiceCurrency: String(row.invoiceCurrency ?? "").trim() || undefined,
      addresses,
      isActive: true,
    });

    if (!parsed.success) {
      errors.push({ row: rowNum, name: brandName, error: zodFieldErrorsToHuman(parsed.error.flatten().fieldErrors) }); skipped++; continue;
    }

    try {
      const [{ total }] = await db.select({ total: count() }).from(clientsTable);
      const clientCode = `CLI${String(total + 1).padStart(4, "0")}`;
      await db.insert(clientsTable).values({ ...parsed.data, clientCode, createdBy });
      imported++;
    } catch (err) {
      errors.push({ row: rowNum, name: brandName, error: "Database error." });
      skipped++;
    }
  }

  res.json({ imported, skipped, errors });
});

export default router;
