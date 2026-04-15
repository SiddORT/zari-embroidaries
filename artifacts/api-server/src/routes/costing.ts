import { Router } from "express";
import { db } from "@workspace/db";
import {
  swatchBomTable, purchaseOrdersTable, purchaseReceiptsTable, prPaymentsTable,
  materialsTable, fabricsTable, vendorsTable,
} from "@workspace/db/schema";
import { eq, ilike, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// ─── Material Search (materials + fabrics combined) ───────────────────────────
router.get("/material-search", requireAuth, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const limit = 30;
  const [mats, fabs] = await Promise.all([
    db.select().from(materialsTable)
      .where(q ? or(ilike(materialsTable.materialCode, `%${q}%`), ilike(materialsTable.colorName, `%${q}%`), ilike(materialsTable.itemType, `%${q}%`)) : undefined)
      .limit(limit),
    db.select().from(fabricsTable)
      .where(q ? or(ilike(fabricsTable.fabricCode, `%${q}%`), ilike(fabricsTable.colorName, `%${q}%`), ilike(fabricsTable.fabricType, `%${q}%`)) : undefined)
      .limit(limit),
  ]);
  const results = [
    ...mats.map(m => ({
      id: m.id, type: "material" as const,
      code: m.materialCode,
      name: `${m.itemType} — ${m.colorName}${m.size ? ` (${m.size})` : ""}`,
      currentStock: m.currentStock,
      avgUnitPrice: m.unitPrice,
      unitType: m.unitType,
      warehouseLocation: m.location ?? "",
    })),
    ...fabs.map(f => ({
      id: f.id, type: "fabric" as const,
      code: f.fabricCode,
      name: `${f.fabricType} — ${f.colorName}`,
      currentStock: f.currentStock,
      avgUnitPrice: f.pricePerMeter,
      unitType: f.unitType,
      warehouseLocation: f.location ?? "",
    })),
  ];
  res.json({ data: results });
});

// ─── BOM ─────────────────────────────────────────────────────────────────────
router.get("/bom/:swatchOrderId", requireAuth, async (req, res) => {
  const rows = await db.select().from(swatchBomTable)
    .where(eq(swatchBomTable.swatchOrderId, Number(req.params.swatchOrderId)))
    .orderBy(swatchBomTable.createdAt);
  res.json({ data: rows });
});

router.post("/bom", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { swatchOrderId, materialType, materialId, materialCode, materialName, currentStock, avgUnitPrice, unitType, warehouseLocation, requiredQty } = req.body as Record<string, string>;
  const reqQty = parseFloat(requiredQty) || 0;
  const price = parseFloat(avgUnitPrice) || 0;
  const estimatedAmount = (reqQty * price).toFixed(2);
  const [row] = await db.insert(swatchBomTable).values({
    swatchOrderId: Number(swatchOrderId),
    materialType,
    materialId: Number(materialId),
    materialCode,
    materialName,
    currentStock,
    avgUnitPrice,
    unitType,
    warehouseLocation,
    requiredQty,
    estimatedAmount,
    createdBy: user.email,
  }).returning();
  res.status(201).json({ data: row });
});

router.delete("/bom/:id", requireAuth, async (req, res) => {
  await db.delete(swatchBomTable).where(eq(swatchBomTable.id, Number(req.params.id)));
  res.json({ success: true });
});

// ─── PO Number Generator ─────────────────────────────────────────────────────
async function nextPoNumber(): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const all = await db.select({ n: purchaseOrdersTable.poNumber }).from(purchaseOrdersTable);
  const nums = all.map(r => parseInt(r.n.split("-").pop() ?? "0")).filter(n => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `PO-${year}-${String(next).padStart(4, "0")}`;
}

async function nextPrNumber(): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const all = await db.select({ n: purchaseReceiptsTable.prNumber }).from(purchaseReceiptsTable);
  const nums = all.map(r => parseInt(r.n.split("-").pop() ?? "0")).filter(n => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `PR-${year}-${String(next).padStart(4, "0")}`;
}

// ─── PO ──────────────────────────────────────────────────────────────────────
router.get("/po/:swatchOrderId", requireAuth, async (req, res) => {
  const rows = await db.select().from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.swatchOrderId, Number(req.params.swatchOrderId)))
    .orderBy(purchaseOrdersTable.createdAt);
  res.json({ data: rows });
});

router.post("/po", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { swatchOrderId, vendorId, notes, bomItems } = req.body as {
    swatchOrderId: number;
    vendorId: number;
    notes?: string;
    bomItems?: { bomRowId: number; materialCode: string; materialName: string; unitType: string; targetPrice: string; quantity: string }[];
  };
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId));
  if (!vendor) { res.status(404).json({ error: "Vendor not found" }); return; }
  const poNumber = await nextPoNumber();
  const items = bomItems ?? [];
  const [row] = await db.insert(purchaseOrdersTable).values({
    poNumber,
    swatchOrderId: Number(swatchOrderId),
    vendorId,
    vendorName: vendor.brandName,
    status: "Draft",
    notes: notes ?? null,
    bomRowIds: items.map(i => i.bomRowId),
    bomItems: items,
    createdBy: user.email,
  }).returning();
  res.status(201).json({ data: row });
});

router.patch("/po/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { status, notes } = req.body as { status?: string; notes?: string };
  const updates: Record<string, unknown> = { updatedBy: user.email, updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (status === "Approved") { updates.approvedBy = user.email; updates.approvedAt = new Date(); }
  const [row] = await db.update(purchaseOrdersTable).set(updates).where(eq(purchaseOrdersTable.id, Number(req.params.id))).returning();
  res.json({ data: row });
});

router.delete("/po/:id", requireAuth, async (req, res) => {
  await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, Number(req.params.id)));
  res.json({ success: true });
});

// ─── PR ──────────────────────────────────────────────────────────────────────
router.get("/pr/:swatchOrderId", requireAuth, async (req, res) => {
  const rows = await db.select().from(purchaseReceiptsTable)
    .where(eq(purchaseReceiptsTable.swatchOrderId, Number(req.params.swatchOrderId)))
    .orderBy(purchaseReceiptsTable.createdAt);
  res.json({ data: rows });
});

router.post("/pr", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { poId, swatchOrderId, receivedQty, actualPrice, warehouseLocation } = req.body as Record<string, string | number>;
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, Number(poId)));
  if (!po) { res.status(404).json({ error: "PO not found" }); return; }
  const prNumber = await nextPrNumber();
  const [row] = await db.insert(purchaseReceiptsTable).values({
    prNumber,
    poId: Number(poId),
    swatchOrderId: Number(swatchOrderId),
    vendorName: po.vendorName,
    receivedQty: String(receivedQty),
    actualPrice: String(actualPrice),
    warehouseLocation: String(warehouseLocation ?? ""),
    status: "Open",
    createdBy: user.email,
  }).returning();
  res.status(201).json({ data: row });
});

router.patch("/pr/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { status } = req.body as { status?: string };
  const updates: Record<string, unknown> = { updatedBy: user.email, updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  const [row] = await db.update(purchaseReceiptsTable).set(updates).where(eq(purchaseReceiptsTable.id, Number(req.params.id))).returning();
  res.json({ data: row });
});

router.delete("/pr/:id", requireAuth, async (req, res) => {
  await db.delete(purchaseReceiptsTable).where(eq(purchaseReceiptsTable.id, Number(req.params.id)));
  res.json({ success: true });
});

// ─── Payments ─────────────────────────────────────────────────────────────────
router.get("/payments/:prId", requireAuth, async (req, res) => {
  const rows = await db.select().from(prPaymentsTable)
    .where(eq(prPaymentsTable.prId, Number(req.params.prId)))
    .orderBy(prPaymentsTable.createdAt);
  res.json({ data: rows });
});

router.post("/payments", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { prId, paymentType, paymentDate, paymentMode, amount, transactionStatus, paymentStatus, attachment } = req.body as Record<string, unknown>;
  const [row] = await db.insert(prPaymentsTable).values({
    prId: Number(prId),
    paymentType: String(paymentType),
    paymentDate: paymentDate ? new Date(String(paymentDate)) : new Date(),
    paymentMode: String(paymentMode ?? ""),
    amount: String(amount),
    transactionStatus: String(transactionStatus ?? ""),
    paymentStatus: String(paymentStatus ?? "Pending"),
    attachment: (attachment ?? null) as any,
    createdBy: user.email,
  }).returning();
  res.status(201).json({ data: row });
});

router.delete("/payments/:id", requireAuth, async (req, res) => {
  await db.delete(prPaymentsTable).where(eq(prPaymentsTable.id, Number(req.params.id)));
  res.json({ success: true });
});

export default router;
