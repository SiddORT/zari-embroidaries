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

router.get("/invoices/next-number", requireAuth, async (_req, res) => {
  const invoiceNo = await getNextInvoiceNo();
  res.json({ data: invoiceNo });
});

router.get("/invoices/swatch/:swatchOrderId", requireAuth, async (req, res) => {
  const id = parseInt(req.params.swatchOrderId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const rows = await db.select().from(invoicesTable).where(eq(invoicesTable.swatchOrderId, id)).limit(1);
  res.json({ data: rows[0] ?? null });
});

router.post("/invoices", requireAuth, async (req, res) => {
  const b = req.body;
  const invoiceNo = b.invoiceNo ?? (await getNextInvoiceNo());
  const [row] = await db.insert(invoicesTable).values({
    invoiceNo,
    swatchOrderId: Number(b.swatchOrderId),
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
    notes: b.notes ?? "",
    paymentTerms: b.paymentTerms ?? "",
    status: b.status ?? "Draft",
  }).returning();
  res.status(201).json({ data: row });
});

router.put("/invoices/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const b = req.body;
  const [row] = await db.update(invoicesTable).set({
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
    notes: b.notes ?? "",
    paymentTerms: b.paymentTerms ?? "",
    status: b.status ?? "Draft",
    updatedAt: new Date(),
  }).where(eq(invoicesTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ data: row });
});

router.delete("/invoices/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
  res.json({ success: true });
});

export default router;
