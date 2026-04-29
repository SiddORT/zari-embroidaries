import { Router, type IRouter } from "express";
import { eq, and, desc, ilike } from "drizzle-orm";
import { db, artworksTable, pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function generateArtworkCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ART-${year}-`;
  const [latest] = await db
    .select({ artworkCode: artworksTable.artworkCode })
    .from(artworksTable)
    .where(ilike(artworksTable.artworkCode, `${prefix}%`))
    .orderBy(desc(artworksTable.createdAt))
    .limit(1);
  if (!latest) return `${prefix}001`;
  const num = parseInt(latest.artworkCode.replace(prefix, ""), 10);
  return `${prefix}${String(num + 1).padStart(3, "0")}`;
}

router.get("/artworks", requireAuth, async (req, res): Promise<void> => {
  const { swatchOrderId } = req.query as Record<string, string>;
  if (!swatchOrderId || isNaN(parseInt(swatchOrderId))) {
    res.status(400).json({ error: "swatchOrderId is required" });
    return;
  }
  const rows = await db
    .select()
    .from(artworksTable)
    .where(and(
      eq(artworksTable.swatchOrderId, parseInt(swatchOrderId)),
      eq(artworksTable.isDeleted, false)
    ))
    .orderBy(desc(artworksTable.createdAt));
  res.json({ data: rows });
});

router.get("/artworks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(artworksTable).where(
    and(eq(artworksTable.id, id), eq(artworksTable.isDeleted, false))
  );
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: row });
});

router.post("/artworks", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user?: { email: string } }).user;
  const body = req.body as Record<string, unknown>;

  if (!body.artworkName || typeof body.artworkName !== "string" || !body.artworkName.trim()) {
    res.status(400).json({ error: "Artwork Name is required" });
    return;
  }
  if (!body.swatchOrderId || isNaN(Number(body.swatchOrderId))) {
    res.status(400).json({ error: "swatchOrderId is required" });
    return;
  }

  const artworkCode = await generateArtworkCode();
  const [row] = await db.insert(artworksTable).values({
    artworkCode,
    swatchOrderId: Number(body.swatchOrderId),
    artworkName: body.artworkName as string,
    unitLength: (body.unitLength as string) || null,
    unitWidth: (body.unitWidth as string) || null,
    unitType: (body.unitType as string) || null,
    artworkCreated: (body.artworkCreated as string) || "Inhouse",
    workHours: (body.workHours as string) || null,
    hourlyRate: (body.hourlyRate as string) || null,
    totalCost: (body.totalCost as string) || null,
    feedbackStatus: (body.feedbackStatus as string) || "Pending",
    files: (body.files as object[]) || [],
    refImages: (body.refImages as object[]) || [],
    wipImages: (body.wipImages as object[]) || [],
    finalImages: (body.finalImages as object[]) || [],
    createdBy: user?.email ?? "system",
  }).returning();

  logger.info({ id: row.id, artworkCode }, "Artwork created");
  res.status(201).json({ data: row });
});

router.put("/artworks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const user = (req as typeof req & { user?: { email: string } }).user;
  const body = req.body as Record<string, unknown>;

  const [existing] = await db.select()
    .from(artworksTable).where(and(eq(artworksTable.id, id), eq(artworksTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [row] = await db.update(artworksTable).set({
    artworkName: (body.artworkName as string) || undefined,
    unitLength: (body.unitLength as string) ?? null,
    unitWidth: (body.unitWidth as string) ?? null,
    unitType: (body.unitType as string) ?? null,
    artworkCreated: (body.artworkCreated as string) || undefined,
    workHours: (body.workHours as string) ?? null,
    hourlyRate: (body.hourlyRate as string) ?? null,
    totalCost: (body.totalCost as string) ?? null,
    outsourceVendorId: (body.outsourceVendorId as string) ?? null,
    outsourceVendorName: (body.outsourceVendorName as string) ?? null,
    outsourcePaymentDate: (body.outsourcePaymentDate as string) ?? null,
    outsourcePaymentAmount: (body.outsourcePaymentAmount as string) ?? null,
    outsourcePaymentMode: (body.outsourcePaymentMode as string) ?? null,
    outsourceTransactionId: (body.outsourceTransactionId as string) ?? null,
    outsourcePaymentStatus: (body.outsourcePaymentStatus as string) ?? null,
    feedbackStatus: (body.feedbackStatus as string) || undefined,
    files: (body.files as object[]) ?? undefined,
    refImages: (body.refImages as object[]) ?? undefined,
    wipImages: (body.wipImages as object[]) ?? undefined,
    finalImages: (body.finalImages as object[]) ?? undefined,
    updatedBy: user?.email ?? "system",
    updatedAt: new Date(),
  }).where(eq(artworksTable.id, id)).returning();

  // Sync costing_payments credit when outsource payment details are present
  const vendorId = body.outsourceVendorId ?? row.outsourceVendorId;
  const payAmount = body.outsourcePaymentAmount ?? row.outsourcePaymentAmount;
  const txnId = (body.outsourceTransactionId ?? row.outsourceTransactionId) as string | null;
  if (vendorId && payAmount && parseFloat(String(payAmount)) > 0) {
    try {
      const swatchOrderId = row.swatchOrderId;
      const upsertRef = txnId
        ? `SELECT id FROM costing_payments WHERE reference_type='artwork_swatch' AND reference_id=$1 AND transaction_id=$2 LIMIT 1`
        : null;
      const existingRows = upsertRef
        ? (await pool.query(upsertRef, [id, txnId])).rows
        : [];
      if (existingRows.length > 0) {
        await pool.query(
          `UPDATE costing_payments SET vendor_id=$1,vendor_name=$2,payment_mode=$3,payment_amount=$4,payment_status=$5,payment_date=$6 WHERE id=$7`,
          [parseInt(String(vendorId)), body.outsourceVendorName ?? row.outsourceVendorName,
           body.outsourcePaymentMode ?? row.outsourcePaymentMode,
           parseFloat(String(payAmount)), body.outsourcePaymentStatus ?? row.outsourcePaymentStatus ?? "Pending",
           body.outsourcePaymentDate ? new Date(String(body.outsourcePaymentDate)) : (row.outsourcePaymentDate ? new Date(row.outsourcePaymentDate) : null),
           existingRows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO costing_payments (vendor_id,vendor_name,reference_type,reference_id,swatch_order_id,payment_mode,payment_amount,payment_status,transaction_id,payment_date,created_by)
           VALUES ($1,$2,'artwork_swatch',$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT DO NOTHING`,
          [parseInt(String(vendorId)), body.outsourceVendorName ?? row.outsourceVendorName, id, swatchOrderId,
           body.outsourcePaymentMode ?? row.outsourcePaymentMode,
           parseFloat(String(payAmount)), body.outsourcePaymentStatus ?? row.outsourcePaymentStatus ?? "Pending",
           txnId, body.outsourcePaymentDate ? new Date(String(body.outsourcePaymentDate)) : null,
           user?.email ?? "system"]
        );
      }
    } catch (e) { logger.error(e, "Failed to sync artwork swatch costing_payment"); }
  }

  res.json({ data: row });
});

router.delete("/artworks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const user = (req as typeof req & { user?: { email: string } }).user;
  await db.update(artworksTable).set({
    isDeleted: true,
    updatedBy: user?.email ?? "system",
    updatedAt: new Date()
  }).where(eq(artworksTable.id, id));
  res.json({ message: "Deleted" });
});

export default router;
