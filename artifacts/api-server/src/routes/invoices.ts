import { Router } from "express";
import { db, invoicesTable, pool } from "@workspace/db";
import { eq, like, desc, ilike, and, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import type { Request } from "express";

interface AuthRequest extends Request { user?: { email: string; role: string } }

const router = Router();

const INVOICE_DIRECTIONS = ["Client", "Vendor"] as const;
const INVOICE_TYPES = ["Proforma", "Advance", "Partial", "Material Recovery", "Artwork Charges", "Courier Charges", "Final Invoice", "Custom"] as const;
const INVOICE_STATUSES = ["Draft", "Generated", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"] as const;

function computeAutoStatus(totalAmt: number, pendingAmt: number, dueDate: string, explicitStatus?: string): string {
  if (explicitStatus === "Draft" || explicitStatus === "Sent" || explicitStatus === "Cancelled") return explicitStatus;
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate && dueDate < today && pendingAmt > 0) return "Overdue";
  if (pendingAmt <= 0) return "Paid";
  if (pendingAmt > 0 && pendingAmt < totalAmt) return "Partially Paid";
  return "Generated";
}

const REFERENCE_TYPES = ["Swatch", "Style", "Quotation", "Purchase Receipt", "Shipping", "Artwork", "Manual"] as const;

async function getNextInvoiceNo(): Promise<string> {
  const year = new Date().getFullYear().toString();
  const prefix = `INV-${year}-`;
  const result = await db
    .select({ invoiceNo: invoicesTable.invoiceNo })
    .from(invoicesTable)
    .where(like(invoicesTable.invoiceNo, `${prefix}%`))
    .orderBy(desc(invoicesTable.invoiceNo))
    .limit(1);
  if (result.length === 0) return `${prefix}00001`;
  const last = result[0].invoiceNo;
  const seq = parseInt(last.replace(prefix, ""), 10) + 1;
  return `${prefix}${seq.toString().padStart(5, "0")}`;
}

// GET /invoices/next-number
router.get("/invoices/next-number", requireAuth, async (_req, res) => {
  const invoiceNo = await getNextInvoiceNo();
  res.json({ data: invoiceNo });
});

// GET /invoices — list with filters
router.get("/invoices", requireAuth, async (req, res) => {
  try {
    const { direction, type, status, search, refType, refId, page = "1", limit: lim = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(lim);

    let rows = await db
      .select()
      .from(invoicesTable)
      .orderBy(desc(invoicesTable.createdAt));

    // Filter in JS (simpler with the current drizzle version)
    if (direction) rows = rows.filter(r => r.invoiceDirection === direction);
    if (type) rows = rows.filter(r => r.invoiceType === type);
    if (status) rows = rows.filter(r => r.invoiceStatus === status);
    if (refType) rows = rows.filter(r => r.referenceType === refType);
    if (refId) rows = rows.filter(r => (r.referenceId ?? "") === String(refId));
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(r =>
        r.invoiceNo.toLowerCase().includes(s) ||
        (r.clientName ?? "").toLowerCase().includes(s) ||
        (r.referenceId ?? "").toLowerCase().includes(s) ||
        (r.remarks ?? "").toLowerCase().includes(s)
      );
    }

    const total = rows.length;
    const paged = rows.slice(offset, offset + parseInt(lim));
    res.json({ data: paged, total });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /invoices/:id — single
router.get("/invoices/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [row] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ data: row });
});

// GET /invoices/swatch/:swatchOrderId
router.get("/invoices/swatch/:swatchOrderId", requireAuth, async (req, res) => {
  const id = parseInt(req.params.swatchOrderId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const codeRes = await pool.query(`SELECT order_code FROM swatch_orders WHERE id = $1`, [id]);
  const orderCode: string | undefined = codeRes.rows[0]?.order_code;
  const rows = await db.select().from(invoicesTable).where(
    or(
      eq(invoicesTable.swatchOrderId, id),
      and(eq(invoicesTable.referenceType, "Swatch"), eq(invoicesTable.referenceId, String(id))),
      ...(orderCode ? [and(eq(invoicesTable.referenceType, "Swatch"), eq(invoicesTable.referenceId, orderCode))!] : [])
    )
  ).orderBy(desc(invoicesTable.createdAt));
  res.json({ data: rows });
});

// GET /invoices/style/:styleOrderId
router.get("/invoices/style/:styleOrderId", requireAuth, async (req, res) => {
  const id = parseInt(req.params.styleOrderId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const codeRes = await pool.query(`SELECT order_code FROM style_orders WHERE id = $1`, [id]);
  const orderCode: string | undefined = codeRes.rows[0]?.order_code;
  const rows = await db.select().from(invoicesTable).where(
    or(
      eq(invoicesTable.styleOrderId, id),
      and(eq(invoicesTable.referenceType, "Style"), eq(invoicesTable.referenceId, String(id))),
      ...(orderCode ? [and(eq(invoicesTable.referenceType, "Style"), eq(invoicesTable.referenceId, orderCode))!] : [])
    )
  ).orderBy(desc(invoicesTable.createdAt));
  res.json({ data: rows });
});

// POST /invoices — create
router.post("/invoices", requireAuth, async (req: AuthRequest, res) => {
  try {
    const b = req.body;
    const invoiceNo = b.invoiceNo ?? (await getNextInvoiceNo());

    const invoiceCurrencyAmt = parseFloat(b.invoiceCurrencyAmount ?? b.totalAmount ?? "0");
    const rate = parseFloat(b.exchangeRateSnapshot ?? "1");
    const baseCurrencyAmt = invoiceCurrencyAmt * rate;
    const totalAmt = parseFloat(b.totalAmount ?? String(invoiceCurrencyAmt));
    const receivedAmt = parseFloat(b.receivedAmount ?? "0");
    const pendingAmt = totalAmt - receivedAmt;
    const autoStatus = computeAutoStatus(totalAmt, pendingAmt, b.dueDate ?? "", b.invoiceStatus ?? "Draft");

    const [row] = await db.insert(invoicesTable).values({
      invoiceNo,
      invoiceDirection: b.invoiceDirection ?? "Client",
      invoiceType: b.invoiceType ?? "Final Invoice",
      invoiceStatus: autoStatus,
      clientId: b.clientId ? Number(b.clientId) : null,
      vendorId: b.vendorId ? Number(b.vendorId) : null,
      referenceType: b.referenceType ?? "Manual",
      referenceId: b.referenceId ?? "",
      currencyCode: b.currencyCode ?? "INR",
      exchangeRateSnapshot: String(rate),
      subtotalAmount: String(parseFloat(b.subtotalAmount ?? "0")),
      shippingAmount: String(parseFloat(b.shippingAmount ?? "0")),
      adjustmentAmount: String(parseFloat(b.adjustmentAmount ?? "0")),
      totalAmount: String(totalAmt),
      invoiceCurrencyAmount: String(invoiceCurrencyAmt),
      baseCurrencyAmount: String(baseCurrencyAmt),
      receivedAmount: String(receivedAmt),
      pendingAmount: String(pendingAmt),
      invoiceDate: b.invoiceDate ?? new Date().toISOString().slice(0, 10),
      dueDate: b.dueDate ?? "",
      clientName: b.clientName ?? "",
      clientAddress: b.clientAddress ?? "",
      clientGstin: b.clientGstin ?? "",
      clientEmail: b.clientEmail ?? "",
      clientPhone: b.clientPhone ?? "",
      clientState: b.clientState ?? "",
      items: b.items ?? [],
      discountType: b.discountType ?? "flat",
      discountValue: String(b.discountValue ?? "0"),
      cgstRate: String(b.cgstRate ?? "0"),
      sgstRate: String(b.sgstRate ?? "0"),
      bankName: b.bankName ?? "",
      bankAccount: b.bankAccount ?? "",
      bankIfsc: b.bankIfsc ?? "",
      bankBranch: b.bankBranch ?? "",
      bankUpi: b.bankUpi ?? "",
      remarks: b.remarks ?? "",
      notes: b.notes ?? "",
      paymentTerms: b.paymentTerms ?? "",
      swatchOrderId: b.swatchOrderId ? Number(b.swatchOrderId) : null,
      styleOrderId: b.styleOrderId ? Number(b.styleOrderId) : null,
      createdBy: req.user?.email ?? "",
      status: autoStatus,
    }).returning();

    res.status(201).json({ data: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /invoices/:id — update
router.put("/invoices/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const b = req.body;

    const invoiceCurrencyAmt = parseFloat(b.invoiceCurrencyAmount ?? b.totalAmount ?? "0");
    const rate = parseFloat(b.exchangeRateSnapshot ?? "1");
    const baseCurrencyAmt = invoiceCurrencyAmt * rate;
    const totalAmt = parseFloat(b.totalAmount ?? String(invoiceCurrencyAmt));
    const receivedAmt = parseFloat(b.receivedAmount ?? "0");
    const pendingAmt = totalAmt - receivedAmt;
    const autoStatus = computeAutoStatus(totalAmt, pendingAmt, b.dueDate ?? "", b.invoiceStatus);

    const [row] = await db.update(invoicesTable).set({
      invoiceDirection: b.invoiceDirection,
      invoiceType: b.invoiceType,
      invoiceStatus: autoStatus,
      clientId: b.clientId ? Number(b.clientId) : null,
      vendorId: b.vendorId ? Number(b.vendorId) : null,
      referenceType: b.referenceType,
      referenceId: b.referenceId ?? "",
      currencyCode: b.currencyCode ?? "INR",
      exchangeRateSnapshot: String(rate),
      subtotalAmount: String(parseFloat(b.subtotalAmount ?? "0")),
      shippingAmount: String(parseFloat(b.shippingAmount ?? "0")),
      adjustmentAmount: String(parseFloat(b.adjustmentAmount ?? "0")),
      totalAmount: String(totalAmt),
      invoiceCurrencyAmount: String(invoiceCurrencyAmt),
      baseCurrencyAmount: String(baseCurrencyAmt),
      receivedAmount: String(receivedAmt),
      pendingAmount: String(pendingAmt),
      invoiceDate: b.invoiceDate,
      dueDate: b.dueDate ?? "",
      clientName: b.clientName ?? "",
      clientAddress: b.clientAddress ?? "",
      clientGstin: b.clientGstin ?? "",
      clientEmail: b.clientEmail ?? "",
      clientPhone: b.clientPhone ?? "",
      clientState: b.clientState ?? "",
      items: b.items ?? [],
      discountType: b.discountType ?? "flat",
      discountValue: String(b.discountValue ?? "0"),
      cgstRate: String(b.cgstRate ?? "0"),
      sgstRate: String(b.sgstRate ?? "0"),
      bankName: b.bankName ?? "",
      bankAccount: b.bankAccount ?? "",
      bankIfsc: b.bankIfsc ?? "",
      bankBranch: b.bankBranch ?? "",
      bankUpi: b.bankUpi ?? "",
      remarks: b.remarks ?? "",
      notes: b.notes ?? "",
      paymentTerms: b.paymentTerms ?? "",
      status: autoStatus,
      updatedAt: new Date(),
    }).where(eq(invoicesTable.id, id)).returning();

    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ data: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /invoices/:id/status — quick status update
router.patch("/invoices/:id/status", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { invoiceStatus } = req.body;
  if (!INVOICE_STATUSES.includes(invoiceStatus)) return res.status(400).json({ error: "Invalid status" });
  const [row] = await db.update(invoicesTable)
    .set({ invoiceStatus, status: invoiceStatus, updatedAt: new Date() })
    .where(eq(invoicesTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ data: row });
});

// PATCH /invoices/:id/payment — record payment
router.patch("/invoices/:id/payment", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  const totalAmt = parseFloat(String(existing.totalAmount ?? "0"));
  const receivedAmt = parseFloat(req.body.receivedAmount ?? "0");
  const pendingAmt = Math.max(0, totalAmt - receivedAmt);
  const newStatus = computeAutoStatus(totalAmt, pendingAmt, String(existing.dueDate ?? ""), existing.invoiceStatus ?? "Generated");

  const [row] = await db.update(invoicesTable)
    .set({ receivedAmount: String(receivedAmt), pendingAmount: String(pendingAmt), invoiceStatus: newStatus, status: newStatus, updatedAt: new Date() })
    .where(eq(invoicesTable.id, id))
    .returning();
  res.json({ data: row });
});

// DELETE /invoices/:id
router.delete("/invoices/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
  res.json({ success: true });
});

export { INVOICE_DIRECTIONS, INVOICE_TYPES, INVOICE_STATUSES, REFERENCE_TYPES };
export default router;
