import { Router } from "express";
import { db } from "@workspace/db";
import {
  swatchBomTable, purchaseOrdersTable, purchaseReceiptsTable, prPaymentsTable,
  consumptionLogTable, artisanTimesheetsTable, outsourceJobsTable, customChargesTable,
  materialsTable, fabricsTable, vendorsTable, hsnTable,
} from "@workspace/db/schema";
import { eq, ilike, or, desc } from "drizzle-orm";
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

router.patch("/bom/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { consumedQty } = req.body as { consumedQty?: string };
  const updates: Record<string, unknown> = { updatedBy: user.email, updatedAt: new Date() };
  if (consumedQty !== undefined) updates.consumedQty = consumedQty;
  const [row] = await db.update(swatchBomTable).set(updates).where(eq(swatchBomTable.id, Number(req.params.id))).returning();
  res.json({ data: row });
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
    referenceType: "Swatch",
    referenceId: Number(swatchOrderId),
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
  const { poId, swatchOrderId, bomRowId, receivedQty, actualPrice, warehouseLocation } = req.body as Record<string, string | number | null>;
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, Number(poId)));
  if (!po) { res.status(404).json({ error: "PO not found" }); return; }

  const newQty = parseFloat(String(receivedQty)) || 0;
  const resolvedBomRowId = bomRowId != null ? Number(bomRowId) : null;
  const bomItems = po.bomItems ?? [];
  const isSingleItem = bomItems.length === 1;

  // Find the relevant BOM item for this PR
  let orderedQty = 0;
  if (resolvedBomRowId != null) {
    const item = bomItems.find(i => i.bomRowId === resolvedBomRowId);
    orderedQty = parseFloat(item?.quantity ?? "0") || 0;
  } else if (isSingleItem) {
    orderedQty = parseFloat(bomItems[0]?.quantity ?? "0") || 0;
  }

  // Get existing PRs for this specific item to check remaining qty
  const existingPrs = await db.select().from(purchaseReceiptsTable).where(eq(purchaseReceiptsTable.poId, Number(poId)));
  const relevantPrs = resolvedBomRowId != null
    ? existingPrs.filter(pr => pr.bomRowId === resolvedBomRowId)
    : (isSingleItem ? existingPrs : existingPrs.filter(pr => pr.bomRowId == null));
  const alreadyReceived = relevantPrs.reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0), 0);

  if (orderedQty > 0) {
    if (alreadyReceived >= orderedQty) {
      res.status(400).json({ error: `This item is already fully received (${alreadyReceived} / ${orderedQty}). No further PR is allowed.` });
      return;
    }
    const remaining = orderedQty - alreadyReceived;
    if (newQty > remaining) {
      res.status(400).json({ error: `Received quantity (${newQty}) exceeds remaining ordered quantity. Max allowed: ${remaining.toFixed(4)}` });
      return;
    }
  }

  const prNumber = await nextPrNumber();
  const [row] = await db.insert(purchaseReceiptsTable).values({
    prNumber,
    poId: Number(poId),
    bomRowId: resolvedBomRowId,
    swatchOrderId: Number(swatchOrderId),
    vendorName: po.vendorName,
    receivedQty: String(receivedQty),
    actualPrice: String(actualPrice),
    warehouseLocation: String(warehouseLocation ?? ""),
    status: "Open",
    createdBy: user.email,
  }).returning();

  // Auto-close PO when ALL items are fully received
  if (po.status !== "Closed" && bomItems.length > 0) {
    const allPoPrs = await db.select().from(purchaseReceiptsTable).where(eq(purchaseReceiptsTable.poId, Number(poId)));
    const allCovered = bomItems.every(item => {
      // Use exact bomRowId match; for single-item POs with legacy PRs (no bomRowId), sum all PRs
      const relevant = allPoPrs.filter(pr =>
        pr.bomRowId === item.bomRowId ||
        (pr.bomRowId == null && bomItems.length === 1)
      );
      const received = relevant.reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0), 0);
      const ordered = parseFloat(item.quantity) || 0;
      return ordered > 0 && received >= ordered;
    });
    if (allCovered) {
      await db.update(purchaseOrdersTable).set({ status: "Closed", updatedBy: user.email, updatedAt: new Date() }).where(eq(purchaseOrdersTable.id, Number(poId)));
    }
  }

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

// ─── Consumption Log ───────────────────────────────────────────────────────────
router.get("/consumption/:swatchOrderId", requireAuth, async (req, res) => {
  const rows = await db.select().from(consumptionLogTable)
    .where(eq(consumptionLogTable.swatchOrderId, Number(req.params.swatchOrderId)))
    .orderBy(consumptionLogTable.consumedAt);
  res.json({ data: rows });
});

router.post("/consumption", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { swatchOrderId, bomRowId, materialCode, materialName, materialType, unitType, consumedQty, notes } = req.body as Record<string, string | number>;

  // Validate: consumed qty must not exceed available stock (initial stock + PR received - already consumed)
  const [bomRow] = await db.select().from(swatchBomTable).where(eq(swatchBomTable.id, Number(bomRowId)));
  if (!bomRow) { res.status(404).json({ error: "BOM item not found" }); return; }
  const currentStock = parseFloat(bomRow.currentStock || "0");
  const existingConsumed = parseFloat(bomRow.consumedQty || "0");
  const newConsumedQty = parseFloat(String(consumedQty)) || 0;
  // Include all PR received qty for this BOM row in the available stock calculation
  const allPrsForRow = await db.select().from(purchaseReceiptsTable)
    .where(eq(purchaseReceiptsTable.bomRowId, Number(bomRowId)));
  const totalPrReceived = allPrsForRow.reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0), 0);
  const liveStock = currentStock + totalPrReceived;
  const available = liveStock - existingConsumed;
  if (newConsumedQty > available) {
    res.status(400).json({ error: `Cannot consume ${newConsumedQty} — only ${available.toFixed(4)} available (Base stock: ${currentStock}, PR received: ${totalPrReceived}, Already consumed: ${existingConsumed}).` });
    return;
  }

  const [entry] = await db.insert(consumptionLogTable).values({
    swatchOrderId: Number(swatchOrderId),
    bomRowId: Number(bomRowId),
    materialCode: String(materialCode),
    materialName: String(materialName),
    materialType: String(materialType),
    unitType: String(unitType ?? ""),
    consumedQty: String(consumedQty),
    consumedBy: user.email,
    notes: notes ? String(notes) : null,
  }).returning();

  // Recompute total consumed qty for this BOM row and update it
  const allEntries = await db.select().from(consumptionLogTable)
    .where(eq(consumptionLogTable.bomRowId, Number(bomRowId)));
  const totalConsumed = allEntries.reduce((s, e) => s + (parseFloat(e.consumedQty) || 0), 0);
  await db.update(swatchBomTable).set({ consumedQty: totalConsumed.toString(), updatedBy: user.email, updatedAt: new Date() })
    .where(eq(swatchBomTable.id, Number(bomRowId)));

  res.status(201).json({ data: entry });
});

router.delete("/consumption/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [entry] = await db.select().from(consumptionLogTable).where(eq(consumptionLogTable.id, Number(req.params.id)));
  if (!entry) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(consumptionLogTable).where(eq(consumptionLogTable.id, Number(req.params.id)));

  // Recompute and update BOM consumed qty
  const remaining = await db.select().from(consumptionLogTable).where(eq(consumptionLogTable.bomRowId, entry.bomRowId));
  const totalConsumed = remaining.reduce((s, e) => s + (parseFloat(e.consumedQty) || 0), 0);
  await db.update(swatchBomTable).set({ consumedQty: totalConsumed.toString(), updatedBy: user.email, updatedAt: new Date() })
    .where(eq(swatchBomTable.id, entry.bomRowId));

  res.json({ success: true });
});

// ─── Vendor Search (for outsource jobs) ──────────────────────────────────────
router.get("/vendor-search", requireAuth, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const rows = await db.select({
    id: vendorsTable.id,
    brandName: vendorsTable.brandName,
    vendorCode: vendorsTable.vendorCode,
    contactName: vendorsTable.contactName,
  }).from(vendorsTable)
    .where(q
      ? or(ilike(vendorsTable.brandName, `%${q}%`), ilike(vendorsTable.vendorCode, `%${q}%`))
      : undefined)
    .limit(30);
  res.json({ data: rows });
});

// ─── HSN Search (for outsource jobs) ─────────────────────────────────────────
router.get("/hsn-search", requireAuth, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const rows = await db.select({
    id: hsnTable.id,
    hsnCode: hsnTable.hsnCode,
    gstPercentage: hsnTable.gstPercentage,
    govtDescription: hsnTable.govtDescription,
  }).from(hsnTable)
    .where(q
      ? or(ilike(hsnTable.hsnCode, `%${q}%`), ilike(hsnTable.govtDescription, `%${q}%`))
      : undefined)
    .limit(30);
  res.json({ data: rows });
});

// ─── Artisan Timesheets ───────────────────────────────────────────────────────
router.get("/artisan-timesheets/:swatchOrderId", requireAuth, async (req, res) => {
  const rows = await db.select().from(artisanTimesheetsTable)
    .where(eq(artisanTimesheetsTable.swatchOrderId, Number(req.params.swatchOrderId)))
    .orderBy(desc(artisanTimesheetsTable.createdAt));
  res.json({ data: rows });
});

router.post("/artisan-timesheets", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { swatchOrderId, noOfArtisans, startDate, endDate, shiftType, totalHours, hourlyRate, notes } = req.body;
  if (!swatchOrderId || !startDate || !endDate || !shiftType) {
    res.status(400).json({ error: "swatchOrderId, startDate, endDate and shiftType are required" }); return;
  }
  const totalHoursNum = parseFloat(totalHours) || 0;
  const hourlyRateNum = parseFloat(hourlyRate) || 0;
  const noOfArtisansNum = parseInt(noOfArtisans) || 1;
  const totalRate = (totalHoursNum * hourlyRateNum * noOfArtisansNum).toFixed(2);
  const [row] = await db.insert(artisanTimesheetsTable).values({
    swatchOrderId: Number(swatchOrderId),
    noOfArtisans: noOfArtisansNum,
    startDate: String(startDate),
    endDate: String(endDate),
    shiftType: String(shiftType),
    totalHours: String(totalHoursNum),
    hourlyRate: String(hourlyRateNum),
    totalRate,
    notes: notes ? String(notes) : null,
    createdBy: user.email,
  }).returning();
  res.status(201).json({ data: row });
});

router.delete("/artisan-timesheets/:id", requireAuth, async (req, res) => {
  await db.delete(artisanTimesheetsTable).where(eq(artisanTimesheetsTable.id, Number(req.params.id)));
  res.json({ success: true });
});

// ─── Outsource Jobs ───────────────────────────────────────────────────────────
router.get("/outsource-jobs/:swatchOrderId", requireAuth, async (req, res) => {
  const rows = await db.select().from(outsourceJobsTable)
    .where(eq(outsourceJobsTable.swatchOrderId, Number(req.params.swatchOrderId)))
    .orderBy(desc(outsourceJobsTable.createdAt));
  res.json({ data: rows });
});

router.post("/outsource-jobs", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { swatchOrderId, vendorId, vendorName, hsnId, hsnCode, gstPercentage, issueDate, targetDate, deliveryDate, totalCost, notes } = req.body;
  if (!swatchOrderId || !vendorId || !hsnId || !issueDate) {
    res.status(400).json({ error: "swatchOrderId, vendorId, hsnId and issueDate are required" }); return;
  }
  const [row] = await db.insert(outsourceJobsTable).values({
    swatchOrderId: Number(swatchOrderId),
    vendorId: Number(vendorId),
    vendorName: String(vendorName),
    hsnId: Number(hsnId),
    hsnCode: String(hsnCode),
    gstPercentage: String(gstPercentage || "5"),
    issueDate: String(issueDate),
    targetDate: targetDate ? String(targetDate) : null,
    deliveryDate: deliveryDate ? String(deliveryDate) : null,
    totalCost: String(parseFloat(totalCost) || 0),
    notes: notes ? String(notes) : null,
    createdBy: user.email,
  }).returning();
  res.status(201).json({ data: row });
});

router.delete("/outsource-jobs/:id", requireAuth, async (req, res) => {
  await db.delete(outsourceJobsTable).where(eq(outsourceJobsTable.id, Number(req.params.id)));
  res.json({ success: true });
});

// ─── Custom Charges ───────────────────────────────────────────────────────────
router.get("/custom-charges/:swatchOrderId", requireAuth, async (req, res) => {
  const rows = await db.select().from(customChargesTable)
    .where(eq(customChargesTable.swatchOrderId, Number(req.params.swatchOrderId)))
    .orderBy(desc(customChargesTable.createdAt));
  res.json({ data: rows });
});

router.post("/custom-charges", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { swatchOrderId, vendorId, vendorName, hsnId, hsnCode, gstPercentage, description, unitPrice, quantity } = req.body;
  if (!swatchOrderId || !vendorId || !hsnId || !description) {
    res.status(400).json({ error: "swatchOrderId, vendorId, hsnId and description are required" }); return;
  }
  const unitPriceNum = parseFloat(unitPrice) || 0;
  const quantityNum = parseFloat(quantity) || 1;
  const totalAmount = (unitPriceNum * quantityNum).toFixed(2);
  const [row] = await db.insert(customChargesTable).values({
    swatchOrderId: Number(swatchOrderId),
    vendorId: Number(vendorId),
    vendorName: String(vendorName),
    hsnId: Number(hsnId),
    hsnCode: String(hsnCode),
    gstPercentage: String(gstPercentage || "5"),
    description: String(description),
    unitPrice: String(unitPriceNum),
    quantity: String(quantityNum),
    totalAmount,
    createdBy: user.email,
  }).returning();
  res.status(201).json({ data: row });
});

router.delete("/custom-charges/:id", requireAuth, async (req, res) => {
  await db.delete(customChargesTable).where(eq(customChargesTable.id, Number(req.params.id)));
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE ORDER COSTING ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Style BOM ───────────────────────────────────────────────────────────────
router.get("/style-bom/:styleOrderId", requireAuth, async (req, res) => {
  const rows = await db.select().from(swatchBomTable)
    .where(eq(swatchBomTable.styleOrderId, Number(req.params.styleOrderId)))
    .orderBy(swatchBomTable.createdAt);
  res.json({ data: rows });
});

router.post("/style-bom", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { styleOrderId, materialType, materialId, materialCode, materialName, currentStock, avgUnitPrice, unitType, warehouseLocation, requiredQty } = req.body as Record<string, string>;
  const reqQty = parseFloat(requiredQty) || 0;
  const price = parseFloat(avgUnitPrice) || 0;
  const estimatedAmount = (reqQty * price).toFixed(2);
  const [row] = await db.insert(swatchBomTable).values({
    styleOrderId: Number(styleOrderId),
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

// ─── Style PO ─────────────────────────────────────────────────────────────────
router.get("/style-po/:styleOrderId", requireAuth, async (req, res) => {
  const rows = await db.select().from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.styleOrderId, Number(req.params.styleOrderId)))
    .orderBy(purchaseOrdersTable.createdAt);
  res.json({ data: rows });
});

router.post("/style-po", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { styleOrderId, vendorId, notes, bomItems } = req.body as {
    styleOrderId: number;
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
    styleOrderId: Number(styleOrderId),
    referenceType: "Style",
    referenceId: Number(styleOrderId),
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

// ─── Style PR ─────────────────────────────────────────────────────────────────
router.get("/style-pr/:styleOrderId", requireAuth, async (req, res) => {
  const rows = await db.select().from(purchaseReceiptsTable)
    .where(eq(purchaseReceiptsTable.styleOrderId, Number(req.params.styleOrderId)))
    .orderBy(purchaseReceiptsTable.createdAt);
  res.json({ data: rows });
});

router.post("/style-pr", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { poId, styleOrderId, bomRowId, receivedQty, actualPrice, warehouseLocation } = req.body as Record<string, string | number | null>;
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, Number(poId)));
  if (!po) { res.status(404).json({ error: "PO not found" }); return; }

  const newQty = parseFloat(String(receivedQty)) || 0;
  const resolvedBomRowId = bomRowId != null ? Number(bomRowId) : null;
  const bomItems = po.bomItems ?? [];
  const isSingleItem = bomItems.length === 1;

  let orderedQty = 0;
  if (resolvedBomRowId != null) {
    const item = bomItems.find(i => i.bomRowId === resolvedBomRowId);
    orderedQty = parseFloat(item?.quantity ?? "0") || 0;
  } else if (isSingleItem) {
    orderedQty = parseFloat(bomItems[0]?.quantity ?? "0") || 0;
  }

  const existingPrs = await db.select().from(purchaseReceiptsTable).where(eq(purchaseReceiptsTable.poId, Number(poId)));
  const relevantPrs = resolvedBomRowId != null
    ? existingPrs.filter(pr => pr.bomRowId === resolvedBomRowId)
    : (isSingleItem ? existingPrs : existingPrs.filter(pr => pr.bomRowId == null));
  const alreadyReceived = relevantPrs.reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0), 0);

  if (orderedQty > 0) {
    if (alreadyReceived >= orderedQty) {
      res.status(400).json({ error: `This item is already fully received (${alreadyReceived} / ${orderedQty}). No further PR is allowed.` });
      return;
    }
    const remaining = orderedQty - alreadyReceived;
    if (newQty > remaining) {
      res.status(400).json({ error: `Received quantity (${newQty}) exceeds remaining ordered quantity. Max allowed: ${remaining.toFixed(4)}` });
      return;
    }
  }

  const prNumber = await nextPrNumber();
  const [row] = await db.insert(purchaseReceiptsTable).values({
    prNumber,
    poId: Number(poId),
    bomRowId: resolvedBomRowId,
    styleOrderId: Number(styleOrderId),
    vendorName: po.vendorName,
    receivedQty: String(receivedQty),
    actualPrice: String(actualPrice),
    warehouseLocation: String(warehouseLocation ?? ""),
    status: "Open",
    createdBy: user.email,
  }).returning();

  if (po.status !== "Closed" && bomItems.length > 0) {
    const allPoPrs = await db.select().from(purchaseReceiptsTable).where(eq(purchaseReceiptsTable.poId, Number(poId)));
    const allCovered = bomItems.every(item => {
      const relevant = allPoPrs.filter(pr =>
        pr.bomRowId === item.bomRowId ||
        (pr.bomRowId == null && bomItems.length === 1)
      );
      const received = relevant.reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0), 0);
      const ordered = parseFloat(item.quantity) || 0;
      return ordered > 0 && received >= ordered;
    });
    if (allCovered) {
      await db.update(purchaseOrdersTable).set({ status: "Closed", updatedBy: user.email, updatedAt: new Date() }).where(eq(purchaseOrdersTable.id, Number(poId)));
    }
  }

  res.status(201).json({ data: row });
});

// ─── Style Consumption ────────────────────────────────────────────────────────
router.get("/style-consumption/:styleOrderId", requireAuth, async (req, res) => {
  const rows = await db.select().from(consumptionLogTable)
    .where(eq(consumptionLogTable.styleOrderId, Number(req.params.styleOrderId)))
    .orderBy(consumptionLogTable.consumedAt);
  res.json({ data: rows });
});

router.post("/style-consumption", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { styleOrderId, styleOrderProductId, styleOrderProductName, bomRowId, materialCode, materialName, materialType, unitType, consumedQty, notes } = req.body as Record<string, string | number>;

  const [bomRow] = await db.select().from(swatchBomTable).where(eq(swatchBomTable.id, Number(bomRowId)));
  if (!bomRow) { res.status(404).json({ error: "BOM item not found" }); return; }
  const currentStock = parseFloat(bomRow.currentStock || "0");
  const existingConsumed = parseFloat(bomRow.consumedQty || "0");
  const newConsumedQty = parseFloat(String(consumedQty)) || 0;
  const allPrsForRow = await db.select().from(purchaseReceiptsTable)
    .where(eq(purchaseReceiptsTable.bomRowId, Number(bomRowId)));
  const totalPrReceived = allPrsForRow.reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0), 0);
  const liveStock = currentStock + totalPrReceived;
  const available = liveStock - existingConsumed;
  if (newConsumedQty > available) {
    res.status(400).json({ error: `Cannot consume ${newConsumedQty} — only ${available.toFixed(4)} available (Base stock: ${currentStock}, PR received: ${totalPrReceived}, Already consumed: ${existingConsumed}).` });
    return;
  }

  const [entry] = await db.insert(consumptionLogTable).values({
    styleOrderId: Number(styleOrderId),
    styleOrderProductId: styleOrderProductId ? Number(styleOrderProductId) : null,
    styleOrderProductName: styleOrderProductName ? String(styleOrderProductName) : null,
    bomRowId: Number(bomRowId),
    materialCode: String(materialCode),
    materialName: String(materialName),
    materialType: String(materialType),
    unitType: String(unitType ?? ""),
    consumedQty: String(consumedQty),
    consumedBy: user.email,
    notes: notes ? String(notes) : null,
  }).returning();

  const allEntries = await db.select().from(consumptionLogTable)
    .where(eq(consumptionLogTable.bomRowId, Number(bomRowId)));
  const totalConsumed = allEntries.reduce((s, e) => s + (parseFloat(e.consumedQty) || 0), 0);
  await db.update(swatchBomTable).set({ consumedQty: totalConsumed.toString(), updatedBy: user.email, updatedAt: new Date() })
    .where(eq(swatchBomTable.id, Number(bomRowId)));

  res.status(201).json({ data: entry });
});

// ─── Style Artisan Timesheets ─────────────────────────────────────────────────
router.get("/style-artisan-timesheets/:styleOrderId", requireAuth, async (req, res) => {
  const rows = await db.select().from(artisanTimesheetsTable)
    .where(eq(artisanTimesheetsTable.styleOrderId, Number(req.params.styleOrderId)))
    .orderBy(desc(artisanTimesheetsTable.createdAt));
  res.json({ data: rows });
});

router.post("/style-artisan-timesheets", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { styleOrderId, styleOrderProductId, styleOrderProductName, noOfArtisans, startDate, endDate, shiftType, totalHours, hourlyRate, notes } = req.body;
  if (!styleOrderId || !startDate || !endDate || !shiftType) {
    res.status(400).json({ error: "styleOrderId, startDate, endDate and shiftType are required" }); return;
  }
  const totalHoursNum = parseFloat(totalHours) || 0;
  const hourlyRateNum = parseFloat(hourlyRate) || 0;
  const noOfArtisansNum = parseInt(noOfArtisans) || 1;
  const totalRate = (totalHoursNum * hourlyRateNum * noOfArtisansNum).toFixed(2);
  const [row] = await db.insert(artisanTimesheetsTable).values({
    styleOrderId: Number(styleOrderId),
    styleOrderProductId: styleOrderProductId ? Number(styleOrderProductId) : null,
    styleOrderProductName: styleOrderProductName ? String(styleOrderProductName) : null,
    noOfArtisans: noOfArtisansNum,
    startDate: String(startDate),
    endDate: String(endDate),
    shiftType: String(shiftType),
    totalHours: String(totalHoursNum),
    hourlyRate: String(hourlyRateNum),
    totalRate,
    notes: notes ? String(notes) : null,
    createdBy: user.email,
  }).returning();
  res.status(201).json({ data: row });
});

// ─── Style Outsource Jobs ─────────────────────────────────────────────────────
router.get("/style-outsource-jobs/:styleOrderId", requireAuth, async (req, res) => {
  const rows = await db.select().from(outsourceJobsTable)
    .where(eq(outsourceJobsTable.styleOrderId, Number(req.params.styleOrderId)))
    .orderBy(desc(outsourceJobsTable.createdAt));
  res.json({ data: rows });
});

router.post("/style-outsource-jobs", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { styleOrderId, styleOrderProductId, styleOrderProductName, vendorId, vendorName, hsnId, hsnCode, gstPercentage, issueDate, targetDate, deliveryDate, totalCost, notes } = req.body;
  if (!styleOrderId || !vendorId || !hsnId || !issueDate) {
    res.status(400).json({ error: "styleOrderId, vendorId, hsnId and issueDate are required" }); return;
  }
  const [row] = await db.insert(outsourceJobsTable).values({
    styleOrderId: Number(styleOrderId),
    styleOrderProductId: styleOrderProductId ? Number(styleOrderProductId) : null,
    styleOrderProductName: styleOrderProductName ? String(styleOrderProductName) : null,
    vendorId: Number(vendorId),
    vendorName: String(vendorName),
    hsnId: Number(hsnId),
    hsnCode: String(hsnCode),
    gstPercentage: String(gstPercentage || "5"),
    issueDate: String(issueDate),
    targetDate: targetDate ? String(targetDate) : null,
    deliveryDate: deliveryDate ? String(deliveryDate) : null,
    totalCost: String(parseFloat(totalCost) || 0),
    notes: notes ? String(notes) : null,
    createdBy: user.email,
  }).returning();
  res.status(201).json({ data: row });
});

// ─── Style Custom Charges ─────────────────────────────────────────────────────
router.get("/style-custom-charges/:styleOrderId", requireAuth, async (req, res) => {
  const rows = await db.select().from(customChargesTable)
    .where(eq(customChargesTable.styleOrderId, Number(req.params.styleOrderId)))
    .orderBy(desc(customChargesTable.createdAt));
  res.json({ data: rows });
});

router.post("/style-custom-charges", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { styleOrderId, styleOrderProductId, styleOrderProductName, vendorId, vendorName, hsnId, hsnCode, gstPercentage, description, unitPrice, quantity } = req.body;
  if (!styleOrderId || !vendorId || !hsnId || !description) {
    res.status(400).json({ error: "styleOrderId, vendorId, hsnId and description are required" }); return;
  }
  const unitPriceNum = parseFloat(unitPrice) || 0;
  const quantityNum = parseFloat(quantity) || 1;
  const totalAmount = (unitPriceNum * quantityNum).toFixed(2);
  const [row] = await db.insert(customChargesTable).values({
    styleOrderId: Number(styleOrderId),
    styleOrderProductId: styleOrderProductId ? Number(styleOrderProductId) : null,
    styleOrderProductName: styleOrderProductName ? String(styleOrderProductName) : null,
    vendorId: Number(vendorId),
    vendorName: String(vendorName),
    hsnId: Number(hsnId),
    hsnCode: String(hsnCode),
    gstPercentage: String(gstPercentage || "5"),
    description: String(description),
    unitPrice: String(unitPriceNum),
    quantity: String(quantityNum),
    totalAmount,
    createdBy: user.email,
  }).returning();
  res.status(201).json({ data: row });
});

export default router;
