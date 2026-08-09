import { Router, type IRouter } from "express";
// import { eq, ilike, or, and, desc, count, asc } from "drizzle-orm";
import { db, clientsTable , eq, ilike, or, and, desc, count} from "@workspace/db";
import { insertClientSchema, updateClientSchema, deliveryAddresses, swatchOrdersTable, styleOrdersTable, quotations } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { checkPermission } from "../middlewares/checkPermission";
import { LOGISTICS_PACKING_LISTS, MASTERS_CLIENTS } from "../constants/permissions";
import { logger } from "../lib/logger";
import { nextSequenceNumber } from "../utils/sequence";
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

router.get("/clients", requireAuth, 
  checkPermission({ any: [MASTERS_CLIENTS.VIEW, LOGISTICS_PACKING_LISTS.VIEW] }), 
  async (req: AuthRequest, res): Promise<void> => {
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

router.get("/clients/export-all", requireAuth, checkPermission(MASTERS_CLIENTS.DOWNLOAD), async (req: AuthRequest, res): Promise<void> => {
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

router.get("/clients/:id", requireAuth, checkPermission(MASTERS_CLIENTS.VIEW), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [record] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.isDeleted, false)));
  if (!record) { res.status(404).json({ error: "Client not found" }); return; }
  const [swatch] = await db
    .select({ id: swatchOrdersTable.id })
    .from(swatchOrdersTable)
    .where(eq(swatchOrdersTable.clientId, String(id)))
    .limit(1);

  const [style] = await db
    .select({ id: styleOrdersTable.id })
    .from(styleOrdersTable)
    .where(eq(styleOrdersTable.clientId, String(id)))
    .limit(1);

  const [quotation] = await db
    .select({ id: quotations.id })
    .from(quotations)
    .where(eq(quotations.clientId, id))
    .limit(1);

  const hasOrders = !!(swatch || style || quotation);

  res.json({
    ...record,
    hasOrders,
  });
});

router.post("/clients", requireAuth, checkPermission(MASTERS_CLIENTS.ADD_EDIT), async (req: AuthRequest, res): Promise<void> => {
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

  const customCode = parsed.data.customClientCode?.trim();

  if (customCode) {
    const existingCode = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(
        and(
          eq(clientsTable.isDeleted, false),
          ilike(clientsTable.customClientCode, customCode)
        )
      );

    if (existingCode.length > 0) {
      res.status(409).json({
        error: `Custom Client Code "${customCode}" already exists.`,
      });
      return;
    }
  }

  const createdBy = req.user?.email ?? "system";
  const next = await nextSequenceNumber("clients", "client_code", "CLI%");
  const clientCode = `CLI${String(next).padStart(4, "0")}`;

  const [record] = await db.insert(clientsTable).values({ ...parsed.data, brandName: bn, contactName: cn, clientCode, createdBy }).returning();
  const deliveryAddressList =
  parsed.data.addresses?.filter(
    a => a.type === "Delivery Address"
  ) ?? [];  

  if (deliveryAddressList.length > 0) {
    await db.insert(deliveryAddresses).values(
      deliveryAddressList.map((a, index) => ({
        clientId: record.id,
        label: a.name || `Delivery ${index + 1}`,
        addressLine1: a.address1 || null,
        addressLine2: a.address2 || null,
        city: a.city || null,
        state: a.state || null,
        country: a.country || null,
        pincode: a.pincode || null,
        isDefault: a.isDeliveryDefault ?? false,
      }))
    );
  }
  logger.info({ id: record.id, clientCode }, "Client created");
  res.status(201).json(record);
});

router.put("/clients/:id", requireAuth, checkPermission(MASTERS_CLIENTS.ADD_EDIT), async (req: AuthRequest, res): Promise<void> => {
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
  
  const incomingAddresses = parsed.data.addresses ?? [];
  
  // Get existing delivery addresses for this client
  const existingDeliveryAddresses = await db.select().from(deliveryAddresses)
    .where(and(
      eq(deliveryAddresses.clientId, id),
      eq(deliveryAddresses.isDeleted, false)
    ));

  // Map existing by client_address_id for quick lookup
  const existingByClientAddrId = new Map(
    existingDeliveryAddresses
      .filter(a => a.clientAddressId)
      .map(a => [a.clientAddressId, a])
  );

  const usedDbIds = new Set<number>();
  const addressesToInsert: any[] = [];

  for (const incoming of incomingAddresses) {
    const isDelivery = incoming.type === "Delivery Address";
    const clientAddrId = incoming.id;

    if (!clientAddrId) {
      // No id from frontend — treat as new if delivery
      if (isDelivery) {
        addressesToInsert.push({
          clientId: id,
          clientAddressId: null,
          label: incoming.name || "Delivery Address",
          addressLine1: incoming.address1 || null,
          addressLine2: incoming.address2 || null,
          city: incoming.city || null,
          state: incoming.state || null,
          country: incoming.country || null,
          pincode: incoming.pincode || null,
          isDefault: incoming.isDeliveryDefault ?? false,
        });
      }
      continue;
    }

    const existing = existingByClientAddrId.get(clientAddrId);

    if (existing) {
      // Found matching record by client_address_id
      if (isDelivery) {
        // Still delivery — UPDATE (full replace, no text comparison)
        usedDbIds.add(existing.id);
        await db.update(deliveryAddresses)
          .set({
            label: incoming.name || existing.label,
            addressLine1: incoming.address1 ?? existing.addressLine1,
            addressLine2: incoming.address2 ?? existing.addressLine2,
            city: incoming.city ?? existing.city,
            state: incoming.state ?? existing.state,
            country: incoming.country ?? existing.country,
            pincode: incoming.pincode ?? existing.pincode,
            isDefault: incoming.isDeliveryDefault ?? existing.isDefault,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(deliveryAddresses.id, existing.id));
      } else {
        // Changed to non-delivery — SOFT DELETE
        usedDbIds.add(existing.id);
        await db.update(deliveryAddresses)
          .set({ 
            isDeleted: true, 
            deletedAt: new Date(),
            deletedBy: req.user?.email ?? "system",
            clientAddressId: null,
          })
          .where(eq(deliveryAddresses.id, existing.id));
      }
    } else {
      // No existing record for this client_address_id
      if (isDelivery) {
        addressesToInsert.push({
          clientId: id,
          clientAddressId: clientAddrId,
          label: incoming.name || "Delivery Address",
          addressLine1: incoming.address1 || null,
          addressLine2: incoming.address2 || null,
          city: incoming.city || null,
          state: incoming.state || null,
          country: incoming.country || null,
          pincode: incoming.pincode || null,
          isDefault: incoming.isDeliveryDefault ?? false,
        });
      }
    }
  }

  // Bulk insert new ones
  if (addressesToInsert.length > 0) {
    await db.insert(deliveryAddresses).values(addressesToInsert);
  }

  // Soft-delete existing records whose client_address_id is no longer in incoming
  const incomingIds = new Set(incomingAddresses.map(a => a.id).filter(Boolean));
  for (const existing of existingDeliveryAddresses) {
    if (existing.clientAddressId && !incomingIds.has(existing.clientAddressId) && !usedDbIds.has(existing.id)) {
      await db.update(deliveryAddresses)
        .set({ 
          isDeleted: true, 
          deletedAt: new Date(),
          deletedBy: req.user?.email ?? "system",
          clientAddressId: null,
        })
        .where(eq(deliveryAddresses.id, existing.id));
    }
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(clientsTable).set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(clientsTable.id, id), eq(clientsTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Client not found" }); return; }
  res.json(record);
});

router.patch("/clients/:id/status", requireAuth, checkPermission(MASTERS_CLIENTS.ADD_EDIT), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [existing] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Client not found" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(clientsTable).set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() }).where(eq(clientsTable.id, id)).returning();
  res.json(record);
});

router.delete("/clients/:id", requireAuth, checkPermission(MASTERS_CLIENTS.DELETE), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const updatedBy = req.user?.email ?? "system";
  const [record] = await db.update(clientsTable).set({ isDeleted: true, updatedBy, updatedAt: new Date(), deletedBy: updatedBy, deletedAt: new Date() })
    .where(and(eq(clientsTable.id, id), eq(clientsTable.isDeleted, false))).returning();
  if (!record) { res.status(404).json({ error: "Client not found" }); return; }

   await db.update(deliveryAddresses)
        .set({
            isDeleted: true,
            updatedAt: new Date().toISOString(),
            deletedBy: updatedBy,
            deletedAt: new Date(),
        })
        .where(and(
            eq(deliveryAddresses.clientId, id),
            eq(deliveryAddresses.isDeleted, false)
        ));

  res.json({ message: "Client deleted" });
});

router.post("/clients/import", requireAuth, checkPermission(MASTERS_CLIENTS.ADD_EDIT), async (req: AuthRequest, res): Promise<void> => {
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
      const contactName = String(row.contactName ?? "").trim();

      if (!brandName) { errors.push({ row: rowNum, name: "", error: "Brand / Client Name is required." }); skipped++; continue; }
      if (!NAME_REGEX.test(brandName)) { errors.push({ row: rowNum, name: brandName, error: "Client Name must contain only letters and spaces." }); skipped++; continue; }
      if (!contactName) { errors.push({ row: rowNum, name: brandName, error: "Contact Name is required." }); skipped++; continue; }
      if (!NAME_REGEX.test(contactName)) { errors.push({ row: rowNum, name: brandName, error: "Contact Name must contain only letters and spaces." }); skipped++; continue; }

      const existing = await db.select({ id: clientsTable.id }).from(clientsTable)
          .where(and(eq(clientsTable.isDeleted, false), ilike(clientsTable.brandName, brandName)));
      if (existing.length > 0) { errors.push({ row: rowNum, name: brandName, error: "Client already exists." }); skipped++; continue; }

      const addresses = Array.isArray(row.addresses) && row.addresses.length > 0 ? row.addresses : undefined;

      const parsed = insertClientSchema.safeParse({
          customClientCode: String(row.customClientCode ?? "").trim() || undefined,  // From Excel: CL001
          brandName,
          contactName,
          email: String(row.email ?? "").trim() || undefined,
          altEmail: String(row.altEmail ?? "").trim() || undefined,
          contactNo: String(row.contactNo ?? "").trim() || undefined,
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

          // Insert client with server-generated clientCode + Excel customClientCode
          const [insertedClient] = await db.insert(clientsTable)
              .values({
                  ...parsed.data,
                  clientCode,// Server-generated: CLI0001
                  createdBy,
              })
              .returning({ id: clientsTable.id });

          if (!insertedClient) {
              errors.push({ row: rowNum, name: brandName, error: "Failed to insert client." });
              skipped++;
              continue;
          }

          const clientId = insertedClient.id;

          // --- Insert delivery addresses into separate table ---
          if (addresses && addresses.length > 0) {
            const addressesToInsert = addresses
              .filter((addr: any) => {
                return (
                  addr?.type === "Delivery Address" &&
                  (
                    addr.address1 ||
                    addr.address2 ||
                    addr.city ||
                    addr.state ||
                    addr.pincode ||
                    addr.country
                  )
                );
              })
              .map((addr: any) => ({
                clientId,
                clientAddressId: addr.id ?? null,
                label: addr.name || "Default",
                addressLine1: addr.address1 || null,
                addressLine2: addr.address2 || null,
                city: addr.city || null,
                state: addr.state || null,
                country: addr.country || null,
                pincode: addr.pincode || null,
                isDefault: addr.isDeliveryDefault ?? false,
              }));

            if (addressesToInsert.length > 0) {
              await db.insert(deliveryAddresses).values(addressesToInsert);
            }
          }
          imported++;
      } catch (err) {
          errors.push({ row: rowNum, name: brandName, error: "Database error." });
          skipped++;
      }
  }

  res.json({ imported, skipped, errors });
});

export default router;
