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
    videos: (body.videos as object[]) || [],
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
    // Toile
    toileMakingCost: (body.toileMakingCost as string) ?? null,
    toileVendorId: (body.toileVendorId as string) ?? null,
    toileVendorName: (body.toileVendorName as string) ?? null,
    toileCost: (body.toileCost as string) ?? null,
    toilePaymentType: (body.toilePaymentType as string) ?? null,
    toilePaymentDate: (body.toilePaymentDate as string) ?? null,
    toilePaymentMode: (body.toilePaymentMode as string) ?? null,
    toilePaymentStatus: (body.toilePaymentStatus as string) ?? null,
    toilePaymentAmount: (body.toilePaymentAmount as string) ?? null,
    toileTransactionId: (body.toileTransactionId as string) ?? null,
    toileRemarks: (body.toileRemarks as string) ?? null,
    toileImages: (body.toileImages as object[]) ?? undefined,
    // Pattern
    patternType: (body.patternType as string) ?? null,
    patternMakingCost: (body.patternMakingCost as string) ?? null,
    patternDoc: (body.patternDoc as object[]) ?? undefined,
    patternOuthouseDoc: (body.patternOuthouseDoc as object[]) ?? undefined,
    patternVendorId: (body.patternVendorId as string) ?? null,
    patternVendorName: (body.patternVendorName as string) ?? null,
    patternPaymentType: (body.patternPaymentType as string) ?? null,
    patternPaymentMode: (body.patternPaymentMode as string) ?? null,
    patternPaymentStatus: (body.patternPaymentStatus as string) ?? null,
    patternPaymentAmount: (body.patternPaymentAmount as string) ?? null,
    patternTransactionId: (body.patternTransactionId as string) ?? null,
    patternPaymentDate: (body.patternPaymentDate as string) ?? null,
    patternRemarks: (body.patternRemarks as string) ?? null,
    feedbackStatus: (body.feedbackStatus as string) || undefined,
    files: (body.files as object[]) ?? undefined,
    refImages: (body.refImages as object[]) ?? undefined,
    wipImages: (body.wipImages as object[]) ?? undefined,
    finalImages: (body.finalImages as object[]) ?? undefined,
    videos: (body.videos as object[]) ?? undefined,
    updatedBy: user?.email ?? "system",
    updatedAt: new Date(),
  }).where(eq(styleOrderArtworksTable.id, id)).returning();

  const styleOrderId = row.styleOrderId;

  // Helper: upsert a single costing_payment row
  async function syncCostingPayment(
    refType: string, vendorIdStr: string | null | undefined, vendorNameStr: string | null | undefined,
    payAmt: string | null | undefined, payMode: string | null | undefined,
    payStatus: string | null | undefined, txnIdStr: string | null | undefined,
    payDate: string | null | undefined, payType: string | null | undefined, remarks: string | null | undefined,
  ) {
    if (!vendorIdStr || !payAmt || parseFloat(String(payAmt)) <= 0) return;
    try {
      const existingRows = txnIdStr
        ? (await pool.query(
            `SELECT id FROM costing_payments WHERE reference_type=$1 AND reference_id=$2 AND transaction_id=$3 LIMIT 1`,
            [refType, id, txnIdStr]
          )).rows
        : [];
      if (existingRows.length > 0) {
        await pool.query(
          `UPDATE costing_payments SET vendor_id=$1,vendor_name=$2,payment_type=$3,payment_mode=$4,payment_amount=$5,payment_status=$6,payment_date=$7,remarks=$8 WHERE id=$9`,
          [parseInt(String(vendorIdStr)), vendorNameStr, payType ?? null, payMode ?? null,
           parseFloat(String(payAmt)), payStatus ?? "Pending",
           payDate ? new Date(String(payDate)) : null, remarks ?? null, existingRows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO costing_payments (vendor_id,vendor_name,reference_type,reference_id,style_order_id,payment_type,payment_mode,payment_amount,payment_status,transaction_id,payment_date,remarks,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT DO NOTHING`,
          [parseInt(String(vendorIdStr)), vendorNameStr, refType, id, styleOrderId,
           payType ?? null, payMode ?? null, parseFloat(String(payAmt)), payStatus ?? "Pending",
           txnIdStr ?? null, payDate ? new Date(String(payDate)) : null, remarks ?? null, user?.email ?? "system"]
        );
      }
    } catch (e) { logger.error(e, `Failed to sync costing_payment [${refType}]`); }
  }

  // Sync outsource artwork payment
  await syncCostingPayment(
    'artwork_style',
    String(body.outsourceVendorId ?? row.outsourceVendorId ?? ""),
    String(body.outsourceVendorName ?? row.outsourceVendorName ?? ""),
    String(body.outsourcePaymentAmount ?? row.outsourcePaymentAmount ?? ""),
    String(body.outsourcePaymentMode ?? row.outsourcePaymentMode ?? ""),
    String(body.outsourcePaymentStatus ?? row.outsourcePaymentStatus ?? ""),
    String(body.outsourceTransactionId ?? row.outsourceTransactionId ?? ""),
    String(body.outsourcePaymentDate ?? row.outsourcePaymentDate ?? ""),
    null, null,
  );

  // Sync toile payment
  await syncCostingPayment(
    'artwork_toile',
    String(body.toileVendorId ?? row.toileVendorId ?? ""),
    String(body.toileVendorName ?? row.toileVendorName ?? ""),
    String(body.toilePaymentAmount ?? row.toilePaymentAmount ?? ""),
    String(body.toilePaymentMode ?? row.toilePaymentMode ?? ""),
    String(body.toilePaymentStatus ?? row.toilePaymentStatus ?? ""),
    String(body.toileTransactionId ?? row.toileTransactionId ?? ""),
    String(body.toilePaymentDate ?? row.toilePaymentDate ?? ""),
    String(body.toilePaymentType ?? row.toilePaymentType ?? ""),
    String(body.toileRemarks ?? row.toileRemarks ?? ""),
  );

  // Sync pattern outhouse payment
  await syncCostingPayment(
    'artwork_pattern',
    String(body.patternVendorId ?? row.patternVendorId ?? ""),
    String(body.patternVendorName ?? row.patternVendorName ?? ""),
    String(body.patternPaymentAmount ?? row.patternPaymentAmount ?? ""),
    String(body.patternPaymentMode ?? row.patternPaymentMode ?? ""),
    String(body.patternPaymentStatus ?? row.patternPaymentStatus ?? ""),
    String(body.patternTransactionId ?? row.patternTransactionId ?? ""),
    String(body.patternPaymentDate ?? row.patternPaymentDate ?? ""),
    String(body.patternPaymentType ?? row.patternPaymentType ?? ""),
    String(body.patternRemarks ?? row.patternRemarks ?? ""),
  );

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
