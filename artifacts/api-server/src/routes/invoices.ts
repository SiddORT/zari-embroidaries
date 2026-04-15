import { Router } from "express";
import { db, invoicesTable } from "@workspace/db";
import { eq, like, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

async function getNextInvoiceNo(): Promise<string> {
  const year = new Date().getFullYear().toString();
  const prefix = `INV-${year}-`;
  const result = await db
    .select({ invoiceNo: invoicesTable.invoiceNo })
    .from(invoicesTable)
    .where(like(invoicesTable.invoiceNo, `${prefix}%`))
    .orderBy(desc(invoicesTable.invoiceNo))
    .limit(1);
  if (result.length === 0) return `${prefix}0001`;
  const last = result[0].invoiceNo;
  const seq = parseInt(last.replace(prefix, ""), 10) + 1;
  return `${prefix}${seq.toString().padStart(4, "0")}`;
}

// GET /api/invoices/next-number
router.get("/invoices/next-number", requireAuth, async (_req, res) => {
  const invoiceNo = await getNextInvoiceNo();
  res.json({ data: invoiceNo });
});

// GET /api/invoices/swatch/:swatchOrderId
router.get("/invoices/swatch/:swatchOrderId", requireAuth, async (req, res) => {
  const id = parseInt(req.params.swatchOrderId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const rows = await db.select().from(invoicesTable).where(eq(invoicesTable.swatchOrderId, id)).limit(1);
  res.json({ data: rows[0] ?? null });
});

// POST /api/invoices
router.post("/invoices", requireAuth, async (req, res) => {
  const body = req.body;
  const invoiceNo = body.invoiceNo ?? (await getNextInvoiceNo());
  const [row] = await db.insert(invoicesTable).values({
    invoiceNo,
    swatchOrderId: Number(body.swatchOrderId),
    invoiceDate: body.invoiceDate ?? new Date().toISOString().slice(0, 10),
    dueDate: body.dueDate ?? "",
    clientName: body.clientName ?? "",
    clientAddress: body.clientAddress ?? "",
    clientGstin: body.clientGstin ?? "",
    clientEmail: body.clientEmail ?? "",
    items: body.items ?? [],
    discountType: body.discountType ?? "flat",
    discountValue: String(body.discountValue ?? "0"),
    taxLabel: body.taxLabel ?? "GST",
    taxRate: String(body.taxRate ?? "0"),
    notes: body.notes ?? "",
    paymentTerms: body.paymentTerms ?? "",
    status: body.status ?? "Draft",
  }).returning();
  res.status(201).json({ data: row });
});

// PUT /api/invoices/:id
router.put("/invoices/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const body = req.body;
  const [row] = await db.update(invoicesTable).set({
    invoiceDate: body.invoiceDate,
    dueDate: body.dueDate ?? "",
    clientName: body.clientName ?? "",
    clientAddress: body.clientAddress ?? "",
    clientGstin: body.clientGstin ?? "",
    clientEmail: body.clientEmail ?? "",
    items: body.items ?? [],
    discountType: body.discountType ?? "flat",
    discountValue: String(body.discountValue ?? "0"),
    taxLabel: body.taxLabel ?? "GST",
    taxRate: String(body.taxRate ?? "0"),
    notes: body.notes ?? "",
    paymentTerms: body.paymentTerms ?? "",
    status: body.status ?? "Draft",
    updatedAt: new Date(),
  }).where(eq(invoicesTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ data: row });
});

// DELETE /api/invoices/:id
router.delete("/invoices/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
  res.json({ success: true });
});

export default router;
