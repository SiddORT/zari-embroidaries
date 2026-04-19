import { Router, type IRouter } from "express";
import { eq, and, desc, ilike } from "drizzle-orm";
import { db, styleOrderArtworksTable, pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function generateCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SOA-${year}-`;
  const [latest] = await db
    .select({ artworkCode: styleOrderArtworksTable.artworkCode })
    .from(styleOrderArtworksTable)
    .where(ilike(styleOrderArtworksTable.artworkCode, `${prefix}%`))
    .orderBy(desc(styleOrderArtworksTable.createdAt))
    .limit(1);
  if (!latest) return `${prefix}001`;
  const num = parseInt(latest.artworkCode.replace(prefix, ""), 10);
  return `${prefix}${String(num + 1).padStart(3, "0")}`;
}

// GET all artworks for a style order (optionally filtered by product)
router.get("/style-order-artworks", requireAuth, async (req, res): Promise<void> => {
  const { styleOrderId, styleOrderProductId } = req.query as Record<string, string>;
  if (!styleOrderId || isNaN(parseInt(styleOrderId))) {
    res.status(400).json({ error: "styleOrderId is required" });
    return;
  }
  let conditions = and(
    eq(styleOrderArtworksTable.styleOrderId, parseInt(styleOrderId)),
    eq(styleOrderArtworksTable.isDeleted, false)
  );
  if (styleOrderProductId && !isNaN(parseInt(styleOrderProductId))) {
    conditions = and(
      conditions,
      eq(styleOrderArtworksTable.styleOrderProductId, parseInt(styleOrderProductId))
    );
  }
  const rows = await db
    .select()
    .from(styleOrderArtworksTable)
    .where(conditions)
    .orderBy(desc(styleOrderArtworksTable.createdAt));
  res.json({ data: rows });
});

// GET single artwork
router.get("/style-order-artworks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(styleOrderArtworksTable).where(
    and(eq(styleOrderArtworksTable.id, id), eq(styleOrderArtworksTable.isDeleted, false))
  );
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: row });
});

// POST create
router.post("/style-order-artworks", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user?: { email: string } }).user;
  const body = req.body as Record<string, unknown>;

  if (!body.artworkName || typeof body.artworkName !== "string" || !body.artworkName.trim()) {
    res.status(400).json({ error: "Artwork Name is required" });
    return;
  }
  if (!body.styleOrderId || isNaN(Number(body.styleOrderId))) {
    res.status(400).json({ error: "styleOrderId is required" });
    return;
  }

  const artworkCode = await generateCode();
  const [row] = await db.insert(styleOrderArtworksTable).values({
    artworkCode,
    styleOrderId: Number(body.styleOrderId),
    styleOrderProductId: body.styleOrderProductId ? Number(body.styleOrderProductId) : null,
    styleOrderProductName: (body.styleOrderProductName as string) || null,
    artworkName: body.artworkName as string,
    unitLength: (body.unitLength as string) || null,
    unitWidth: (body.unitWidth as string) || null,
    unitType: (body.unitType as string) || null,
    artworkCreated: (body.artworkCreated as string) || "Inhouse",
    workHours: (body.workHours as string) || null,
    hourlyRate: (body.hourlyRate as string) || null,
    totalCost: (body.totalCost as string) || null,
    outsourceVendorId: (body.outsourceVendorId as string) || null,
    outsourceVendorName: (body.outsourceVendorName as string) || null,
    outsourcePaymentDate: (body.outsourcePaymentDate as string) || null,
    outsourcePaymentAmount: (body.outsourcePaymentAmount as string) || null,
    outsourcePaymentMode: (body.outsourcePaymentMode as string) || null,
    outsourceTransactionId: (body.outsourceTransactionId as string) || null,
    outsourcePaymentStatus: (body.outsourcePaymentStatus as string) || null,
    feedbackStatus: (body.feedbackStatus as string) || "Pending",
    files: (body.files as object[]) || [],
    refImages: (body.refImages as object[]) || [],
    wipImages: (body.wipImages as object[]) || [],
    finalImages: (body.finalImages as object[]) || [],
    createdBy: user?.email ?? "system",
  }).returning();

  logger.info({ id: row.id, artworkCode }, "Style Order Artwork created");
  res.status(201).json({ data: row });
});

// PUT update
router.put("/style-order-artworks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const user = (req as typeof req & { user?: { email: string } }).user;
  const body = req.body as Record<string, unknown>;

  const [fullExisting] = await db.select()
    .from(styleOrderArtworksTable)
    .where(and(eq(styleOrderArtworksTable.id, id), eq(styleOrderArtworksTable.isDeleted, false)));
  if (!fullExisting) { res.status(404).json({ error: "Not found" }); return; }

  const [row] = await db.update(styleOrderArtworksTable).set({
    styleOrderProductId: body.styleOrderProductId !== undefined ? (body.styleOrderProductId ? Number(body.styleOrderProductId) : null) : undefined,
    styleOrderProductName: (body.styleOrderProductName as string) ?? undefined,
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
  }).where(eq(styleOrderArtworksTable.id, id)).returning();

  // Sync costing_payments credit for style artwork outsource payment
  const vendorId = body.outsourceVendorId ?? row.outsourceVendorId;
  const payAmount = body.outsourcePaymentAmount ?? row.outsourcePaymentAmount;
  const txnId = (body.outsourceTransactionId ?? row.outsourceTransactionId) as string | null;
  if (vendorId && payAmount && parseFloat(String(payAmount)) > 0) {
    try {
      const styleOrderId = row.styleOrderId;
      const existingRows = txnId
        ? (await pool.query(
            `SELECT id FROM costing_payments WHERE reference_type='artwork_style' AND reference_id=$1 AND transaction_id=$2 LIMIT 1`,
            [id, txnId]
          )).rows
        : [];
      if (existingRows.length > 0) {
        await pool.query(
          `UPDATE costing_payments SET vendor_id=$1,vendor_name=$2,payment_mode=$3,payment_amount=$4,payment_status=$5,payment_date=$6 WHERE id=$7`,
          [parseInt(String(vendorId)), body.outsourceVendorName ?? row.outsourceVendorName,
           body.outsourcePaymentMode ?? row.outsourcePaymentMode,
           parseFloat(String(payAmount)), body.outsourcePaymentStatus ?? row.outsourcePaymentStatus ?? "Pending",
           body.outsourcePaymentDate ? new Date(String(body.outsourcePaymentDate)) : null,
           existingRows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO costing_payments (vendor_id,vendor_name,reference_type,reference_id,style_order_id,payment_mode,payment_amount,payment_status,transaction_id,payment_date,created_by)
           VALUES ($1,$2,'artwork_style',$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT DO NOTHING`,
          [parseInt(String(vendorId)), body.outsourceVendorName ?? row.outsourceVendorName,
           id, styleOrderId,
           body.outsourcePaymentMode ?? row.outsourcePaymentMode,
           parseFloat(String(payAmount)), body.outsourcePaymentStatus ?? row.outsourcePaymentStatus ?? "Pending",
           txnId, body.outsourcePaymentDate ? new Date(String(body.outsourcePaymentDate)) : null,
           user?.email ?? "system"]
        );
      }
    } catch (e) { logger.error(e, "Failed to sync artwork style costing_payment"); }
  }

  res.json({ data: row });
});

// DELETE (soft)
router.delete("/style-order-artworks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const user = (req as typeof req & { user?: { email: string } }).user;
  await db.update(styleOrderArtworksTable).set({
    isDeleted: true,
    updatedBy: user?.email ?? "system",
    updatedAt: new Date(),
  }).where(eq(styleOrderArtworksTable.id, id));
  res.json({ message: "Deleted" });
});

export default router;
