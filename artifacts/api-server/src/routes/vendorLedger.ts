import { Router } from "express";
import { db, vendorPaymentsTable, vendorLedgerChargesTable, vendorsTable } from "@workspace/db";
import { pool } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { insertVendorPaymentSchema, insertVendorLedgerChargeSchema } from "@workspace/db";

const router = Router();

router.get("/vendor-ledger/summary", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.id                AS vendor_id,
        v.vendor_code       AS vendor_code,
        v.brand_name        AS brand_name,
        v.contact_name      AS contact_name,
        v.email             AS email,
        v.contact_no        AS contact_no,
        v.is_active         AS is_active,
        COALESCE(oj_sum.total,  0)
          + COALESCE(cc_sum.total,  0)
          + COALESCE(lc_sum.total,  0)
          + COALESCE(art_sum.total, 0)
          + COALESCE(soa_sum.total, 0)
          + COALESCE(toi_sum.total, 0)
          + COALESCE(pat_sum.total, 0)
          + COALESCE(vil_sum.total, 0)  AS total_debits,
        COALESCE(vp_sum.total, 0)
          + COALESCE(cp_sum.total, 0)   AS total_credits,
        COALESCE(oj_sum.cnt,  0)
          + COALESCE(cc_sum.cnt,  0)
          + COALESCE(lc_sum.cnt,  0)
          + COALESCE(art_sum.cnt, 0)
          + COALESCE(soa_sum.cnt, 0)
          + COALESCE(toi_sum.cnt, 0)
          + COALESCE(pat_sum.cnt, 0)
          + COALESCE(vil_sum.cnt, 0)
          + COALESCE(vp_sum.cnt,  0)    AS total_entries
      FROM vendors v

      /* costing: outsource jobs */
      LEFT JOIN (
        SELECT vendor_id, SUM(total_cost::numeric) AS total, COUNT(*) AS cnt
        FROM outsource_jobs GROUP BY vendor_id
      ) oj_sum ON oj_sum.vendor_id = v.id

      /* costing: custom charges */
      LEFT JOIN (
        SELECT vendor_id, SUM(total_amount::numeric) AS total, COUNT(*) AS cnt
        FROM custom_charges GROUP BY vendor_id
      ) cc_sum ON cc_sum.vendor_id = v.id

      /* manual ledger charges */
      LEFT JOIN (
        SELECT vendor_id, SUM(amount::numeric) AS total, COUNT(*) AS cnt
        FROM vendor_ledger_charges GROUP BY vendor_id
      ) lc_sum ON lc_sum.vendor_id = v.id

      /* swatch-order artworks outsourced */
      LEFT JOIN (
        SELECT outsource_vendor_id::integer AS vendor_id,
               SUM(outsource_payment_amount::numeric) AS total,
               COUNT(*) AS cnt
        FROM artworks
        WHERE outsource_vendor_id IS NOT NULL
          AND outsource_vendor_id <> ''
          AND outsource_payment_amount IS NOT NULL
          AND outsource_payment_amount <> ''
        GROUP BY outsource_vendor_id::integer
      ) art_sum ON art_sum.vendor_id = v.id

      /* style-order artworks outsourced */
      LEFT JOIN (
        SELECT outsource_vendor_id::integer AS vendor_id,
               SUM(outsource_payment_amount::numeric) AS total,
               COUNT(*) AS cnt
        FROM style_order_artworks
        WHERE outsource_vendor_id IS NOT NULL
          AND outsource_vendor_id <> ''
          AND outsource_payment_amount IS NOT NULL
          AND outsource_payment_amount <> ''
        GROUP BY outsource_vendor_id::integer
      ) soa_sum ON soa_sum.vendor_id = v.id

      /* style-order artworks — toile vendor */
      LEFT JOIN (
        SELECT toile_vendor_id::integer AS vendor_id,
               SUM(toile_cost::numeric) AS total,
               COUNT(*) AS cnt
        FROM style_order_artworks
        WHERE toile_vendor_id IS NOT NULL
          AND toile_vendor_id <> ''
          AND toile_cost IS NOT NULL
          AND toile_cost <> ''
        GROUP BY toile_vendor_id::integer
      ) toi_sum ON toi_sum.vendor_id = v.id

      /* style-order artworks — pattern outhouse vendor */
      LEFT JOIN (
        SELECT pattern_vendor_id::integer AS vendor_id,
               SUM(pattern_payment_amount::numeric) AS total,
               COUNT(*) AS cnt
        FROM style_order_artworks
        WHERE pattern_vendor_id IS NOT NULL
          AND pattern_vendor_id <> ''
          AND pattern_payment_amount IS NOT NULL
          AND pattern_payment_amount <> ''
        GROUP BY pattern_vendor_id::integer
      ) pat_sum ON pat_sum.vendor_id = v.id

      /* vendor invoice ledger entries (debits) */
      LEFT JOIN (
        SELECT vendor_id, SUM(vendor_invoice_amount::numeric) AS total, COUNT(*) AS cnt
        FROM vendor_invoice_ledger GROUP BY vendor_id
      ) vil_sum ON vil_sum.vendor_id = v.id

      /* vendor payments (credits) */
      LEFT JOIN (
        SELECT vendor_id, SUM(amount::numeric) AS total, COUNT(*) AS cnt
        FROM vendor_payments GROUP BY vendor_id
      ) vp_sum ON vp_sum.vendor_id = v.id

      /* costing payments — outsource jobs / custom charges / artwork (credits) */
      LEFT JOIN (
        SELECT vendor_id, SUM(payment_amount::numeric) AS total, COUNT(*) AS cnt
        FROM costing_payments GROUP BY vendor_id
      ) cp_sum ON cp_sum.vendor_id = v.id

      WHERE v.is_deleted = false
      ORDER BY v.brand_name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load vendor ledger summary" });
  }
});

router.get("/vendor-ledger/:vendorId/entries", requireAuth, async (req, res) => {
  try {
    const vendorId = parseInt(req.params.vendorId);
    const { orderType = "all", startDate, endDate } = req.query as Record<string, string>;

    const params: (string | number)[] = [vendorId];
    let dateFilter = "";
    if (startDate) {
      params.push(startDate);
      dateFilter += ` AND entry_date >= $${params.length}::timestamptz`;
    }
    if (endDate) {
      params.push(endDate + "T23:59:59Z");
      dateFilter += ` AND entry_date <= $${params.length}::timestamptz`;
    }
    const orderTypeFilter =
      orderType !== "all"
        ? ` AND order_type = '${orderType === "style" ? "style" : orderType === "swatch" ? "swatch" : orderType}'`
        : "";

    const result = await pool.query(`
      SELECT * FROM (

        /* ── Costing: outsource jobs ───────────────────────────────── */
        SELECT
          'outsource'             AS entry_type,
          oj.id::text             AS entry_id,
          oj.created_at           AS entry_date,
          CONCAT('Outsource Job', COALESCE(': ' || oj.notes, '')) AS description,
          CASE WHEN oj.swatch_order_id IS NOT NULL THEN 'swatch' ELSE 'style' END AS order_type,
          COALESCE(so.order_code, sw.order_code) AS order_code,
          oj.total_cost::numeric  AS debit,
          0::numeric              AS credit
        FROM outsource_jobs oj
        LEFT JOIN style_orders  so ON oj.style_order_id  = so.id
        LEFT JOIN swatch_orders sw ON oj.swatch_order_id = sw.id
        WHERE oj.vendor_id = $1

        UNION ALL

        /* ── Costing: custom charges ───────────────────────────────── */
        SELECT
          'custom_charge'          AS entry_type,
          cc.id::text              AS entry_id,
          cc.created_at            AS entry_date,
          CONCAT('Charge: ', cc.description) AS description,
          CASE WHEN cc.swatch_order_id IS NOT NULL THEN 'swatch' ELSE 'style' END AS order_type,
          COALESCE(so.order_code, sw.order_code) AS order_code,
          cc.total_amount::numeric  AS debit,
          0::numeric                AS credit
        FROM custom_charges cc
        LEFT JOIN style_orders  so ON cc.style_order_id  = so.id
        LEFT JOIN swatch_orders sw ON cc.swatch_order_id = sw.id
        WHERE cc.vendor_id = $1

        UNION ALL

        /* ── Manual ledger charges ─────────────────────────────────── */
        SELECT
          'ledger_charge'       AS entry_type,
          lc.id::text           AS entry_id,
          lc.charge_date        AS entry_date,
          CONCAT('Manual Charge: ', lc.description) AS description,
          lc.order_type,
          COALESCE(lc.style_order_code, lc.swatch_order_code) AS order_code,
          lc.amount::numeric    AS debit,
          0::numeric            AS credit
        FROM vendor_ledger_charges lc
        WHERE lc.vendor_id = $1

        UNION ALL

        /* ── Swatch-order artworks outsourced ─────────────────────── */
        SELECT
          'artwork_swatch'         AS entry_type,
          a.id::text               AS entry_id,
          a.created_at             AS entry_date,
          CONCAT('Artwork (Swatch): ', a.artwork_name,
            COALESCE(' [' || a.artwork_code || ']', '')) AS description,
          'swatch'                 AS order_type,
          sw.order_code            AS order_code,
          a.outsource_payment_amount::numeric AS debit,
          0::numeric               AS credit
        FROM artworks a
        LEFT JOIN swatch_orders sw ON a.swatch_order_id = sw.id
        WHERE a.outsource_vendor_id IS NOT NULL
          AND a.outsource_vendor_id <> ''
          AND a.outsource_payment_amount IS NOT NULL
          AND a.outsource_payment_amount <> ''
          AND a.outsource_vendor_id::integer = $1
          AND a.is_deleted = false

        UNION ALL

        /* ── Style-order artworks outsourced ──────────────────────── */
        SELECT
          'artwork_style'          AS entry_type,
          soa.id::text             AS entry_id,
          soa.created_at           AS entry_date,
          CONCAT('Artwork (Style): ', soa.artwork_name,
            COALESCE(' [' || soa.artwork_code || ']', '')) AS description,
          'style'                  AS order_type,
          so.order_code            AS order_code,
          soa.outsource_payment_amount::numeric AS debit,
          0::numeric               AS credit
        FROM style_order_artworks soa
        LEFT JOIN style_orders so ON soa.style_order_id = so.id
        WHERE soa.outsource_vendor_id IS NOT NULL
          AND soa.outsource_vendor_id <> ''
          AND soa.outsource_payment_amount IS NOT NULL
          AND soa.outsource_payment_amount <> ''
          AND soa.outsource_vendor_id::integer = $1

        UNION ALL

        /* ── Style-order artworks — Toile vendor ─────────────────── */
        SELECT
          'toile'                  AS entry_type,
          soa.id::text             AS entry_id,
          soa.created_at           AS entry_date,
          CONCAT('Toile: ', soa.artwork_name,
            COALESCE(' [' || soa.artwork_code || ']', '')) AS description,
          'style'                  AS order_type,
          so.order_code            AS order_code,
          soa.toile_cost::numeric  AS debit,
          0::numeric               AS credit
        FROM style_order_artworks soa
        LEFT JOIN style_orders so ON soa.style_order_id = so.id
        WHERE soa.toile_vendor_id IS NOT NULL
          AND soa.toile_vendor_id <> ''
          AND soa.toile_cost IS NOT NULL
          AND soa.toile_cost <> ''
          AND soa.toile_vendor_id::integer = $1

        UNION ALL

        /* ── Style-order artworks — Pattern Outhouse vendor ────────── */
        SELECT
          'pattern_outhouse'               AS entry_type,
          soa.id::text                     AS entry_id,
          soa.created_at                   AS entry_date,
          CONCAT('Pattern (Outhouse): ', soa.artwork_name,
            COALESCE(' [' || soa.artwork_code || ']', '')) AS description,
          'style'                          AS order_type,
          so.order_code                    AS order_code,
          soa.pattern_payment_amount::numeric AS debit,
          0::numeric                       AS credit
        FROM style_order_artworks soa
        LEFT JOIN style_orders so ON soa.style_order_id = so.id
        WHERE soa.pattern_vendor_id IS NOT NULL
          AND soa.pattern_vendor_id <> ''
          AND soa.pattern_payment_amount IS NOT NULL
          AND soa.pattern_payment_amount <> ''
          AND soa.pattern_vendor_id::integer = $1

        UNION ALL

        /* ── Vendor invoice ledger entries ─────────────────────────── */
        SELECT
          'vendor_invoice'               AS entry_type,
          vil.id::text                   AS entry_id,
          COALESCE(vil.vendor_invoice_date::timestamptz, vil.created_at) AS entry_date,
          CONCAT('Vendor Invoice: ', vil.vendor_invoice_number,
            ' (PR: ', vil.pr_number, ')') AS description,
          'procurement'                  AS order_type,
          vil.pr_number                  AS order_code,
          vil.vendor_invoice_amount      AS debit,
          0::numeric                     AS credit
        FROM vendor_invoice_ledger vil
        WHERE vil.vendor_id = $1

        UNION ALL

        /* ── Vendor payments (credits) ────────────────────────────── */
        SELECT
          'payment'          AS entry_type,
          vp.id::text        AS entry_id,
          vp.payment_date    AS entry_date,
          CONCAT('Payment — ', vp.payment_mode,
            COALESCE(' (' || vp.reference_no || ')', '')) AS description,
          vp.order_type,
          COALESCE(vp.style_order_code, vp.swatch_order_code) AS order_code,
          0::numeric         AS debit,
          vp.amount::numeric AS credit
        FROM vendor_payments vp
        WHERE vp.vendor_id = $1

        UNION ALL

        /* ── Costing payments (credits — outsource/custom/artwork) ── */
        SELECT
          CONCAT('costing_payment_', cp.reference_type) AS entry_type,
          cp.id::text          AS entry_id,
          COALESCE(cp.payment_date, cp.created_at) AS entry_date,
          CONCAT(
            CASE cp.reference_type
              WHEN 'outsource_job'  THEN 'Outsource Payment'
              WHEN 'custom_charge'  THEN 'Custom Charge Payment'
              WHEN 'artwork_swatch' THEN 'Artwork Payment (Swatch)'
              WHEN 'artwork_style'  THEN 'Artwork Payment (Style)'
              ELSE 'Costing Payment'
            END,
            COALESCE(' — ' || cp.payment_mode, ''),
            COALESCE(' [' || cp.transaction_id || ']', '')
          ) AS description,
          CASE
            WHEN cp.swatch_order_id IS NOT NULL THEN 'swatch'
            WHEN cp.style_order_id  IS NOT NULL THEN 'style'
            ELSE 'general'
          END AS order_type,
          COALESCE(so.order_code, sw.order_code) AS order_code,
          0::numeric            AS debit,
          cp.payment_amount     AS credit
        FROM costing_payments cp
        LEFT JOIN style_orders  so ON cp.style_order_id  = so.id
        LEFT JOIN swatch_orders sw ON cp.swatch_order_id = sw.id
        WHERE cp.vendor_id = $1

      ) ledger
      WHERE 1=1${dateFilter}${orderTypeFilter}
      ORDER BY entry_date ASC
    `, params);

    const entries = result.rows;
    let running = 0;
    const withBalance = entries.map(
      (row: { debit: string | number; credit: string | number; [key: string]: unknown }) => {
        running += Number(row.debit) - Number(row.credit);
        return { ...row, running_balance: running };
      }
    );

    res.json(withBalance);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load ledger entries" });
  }
});

router.get("/vendor-ledger/:vendorId/info", requireAuth, async (req, res) => {
  try {
    const vendorId = parseInt(req.params.vendorId);
    const rows = await db
      .select()
      .from(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.isDeleted, false)));
    if (!rows.length) return res.status(404).json({ error: "Vendor not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to load vendor" });
  }
});

router.post("/vendor-ledger/:vendorId/pay", requireAuth, async (req, res) => {
  try {
    const vendorId = parseInt(req.params.vendorId);
    const user = (req as { user?: { username?: string } }).user;
    const parsed = insertVendorPaymentSchema.safeParse({ ...req.body, vendorId });
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid data", issues: parsed.error.issues });

    const data = parsed.data;
    const rows = await db
      .insert(vendorPaymentsTable)
      .values({
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
        amount: data.amount,
        paymentMode: data.paymentMode,
        referenceNo: data.referenceNo,
        notes: data.notes,
        orderType: data.orderType,
        styleOrderId: data.styleOrderId,
        styleOrderCode: data.styleOrderCode,
        swatchOrderId: data.swatchOrderId,
        swatchOrderCode: data.swatchOrderCode,
        createdBy: user?.username ?? "system",
      })
      .returning();

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record payment" });
  }
});

router.post("/vendor-ledger/:vendorId/charge", requireAuth, async (req, res) => {
  try {
    const vendorId = parseInt(req.params.vendorId);
    const user = (req as { user?: { username?: string } }).user;
    const parsed = insertVendorLedgerChargeSchema.safeParse({ ...req.body, vendorId });
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid data", issues: parsed.error.issues });

    const data = parsed.data;
    const rows = await db
      .insert(vendorLedgerChargesTable)
      .values({
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        chargeDate: data.chargeDate ? new Date(data.chargeDate) : new Date(),
        description: data.description,
        amount: data.amount,
        notes: data.notes,
        orderType: data.orderType,
        styleOrderId: data.styleOrderId,
        styleOrderCode: data.styleOrderCode,
        swatchOrderId: data.swatchOrderId,
        swatchOrderCode: data.swatchOrderCode,
        createdBy: user?.username ?? "system",
      })
      .returning();

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add charge" });
  }
});

router.delete("/vendor-ledger/payments/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(vendorPaymentsTable).where(eq(vendorPaymentsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

router.delete("/vendor-ledger/charges/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(vendorLedgerChargesTable).where(eq(vendorLedgerChargesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete charge" });
  }
});

export default router;
