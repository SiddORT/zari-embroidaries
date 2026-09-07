import { Router } from "express";
import { db, vendorPaymentsTable, vendorLedgerChargesTable, vendorsTable } from "@workspace/db";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { insertVendorPaymentSchema, insertVendorLedgerChargeSchema ,  eq, and } from "@workspace/db";
import { recomputeVendorBillBalances } from "../lib/vendorBillBalances";
import { checkPermission } from "../middlewares/checkPermission";
import { ACCOUNTS_VENDOR_LEDGERS, ACCOUNTS_CREDIT_DEBIT_NOTES } from "../constants/permissions";

const router = Router();

router.get("/vendor-ledger/summary", requireAuth, 
  checkPermission({ any: [ACCOUNTS_VENDOR_LEDGERS.VIEW, ACCOUNTS_CREDIT_DEBIT_NOTES.VIEW] }),
  async (req, res) => {
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
        FROM outsource_jobs WHERE is_deleted = false GROUP BY vendor_id
      ) oj_sum ON oj_sum.vendor_id = v.id

      /* costing: custom charges */
      LEFT JOIN (
        SELECT vendor_id, SUM(total_amount::numeric) AS total, COUNT(*) AS cnt
        FROM custom_charges WHERE is_deleted = false GROUP BY vendor_id
      ) cc_sum ON cc_sum.vendor_id = v.id

      /* manual ledger charges */
      LEFT JOIN (
        SELECT vendor_id, SUM(amount::numeric) AS total, COUNT(*) AS cnt
        FROM vendor_ledger_charges WHERE is_deleted = false GROUP BY vendor_id
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
          AND is_deleted = false
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
          AND is_deleted = false
        GROUP BY outsource_vendor_id::integer
      ) soa_sum ON soa_sum.vendor_id = v.id

      /* style-order artworks — toile vendor */
      LEFT JOIN (
        SELECT toile_vendor_id::integer AS vendor_id,
               SUM(COALESCE(NULLIF(toile_making_cost,''), NULLIF(toile_cost,''))::numeric) AS total,
               COUNT(*) AS cnt
        FROM style_order_artworks
        WHERE toile_vendor_id IS NOT NULL
          AND toile_vendor_id <> ''
          AND (
            (toile_making_cost IS NOT NULL AND toile_making_cost <> '')
            OR (toile_cost IS NOT NULL AND toile_cost <> '')
          )
          AND is_deleted = false
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
          AND is_deleted = false
        GROUP BY pattern_vendor_id::integer
      ) pat_sum ON pat_sum.vendor_id = v.id

      /* vendor invoice ledger entries (debits) — INR anchor */
      LEFT JOIN (
        SELECT vendor_id, SUM(base_currency_amount::numeric) AS total, COUNT(*) AS cnt
        FROM vendor_invoice_ledger WHERE is_deleted = false GROUP BY vendor_id
      ) vil_sum ON vil_sum.vendor_id = v.id

      /* vendor payments (credits) — INR anchor */
      LEFT JOIN (
        SELECT vendor_id, SUM(base_currency_amount::numeric) AS total, COUNT(*) AS cnt
        FROM vendor_payments WHERE is_deleted = false GROUP BY vendor_id
      ) vp_sum ON vp_sum.vendor_id = v.id

      /* costing payments — outsource jobs / custom charges / artwork (credits) — INR anchor */
      LEFT JOIN (
        SELECT vendor_id, SUM(base_currency_amount::numeric) AS total, COUNT(*) AS cnt
        FROM costing_payments WHERE is_deleted = false GROUP BY vendor_id
      ) cp_sum ON cp_sum.vendor_id = v.id

      WHERE v.is_deleted = false
      ORDER BY v.brand_name ASC
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load vendor ledger summary" });
  }
});

// router.get("/vendor-ledger/:vendorId/entries", requireAuth, 
//   checkPermission({ any: [ACCOUNTS_VENDOR_LEDGERS.VIEW] }), 
//   async (req, res) => {
//   try {
//     const vendorId = parseInt(String(req.params.vendorId));
//     const { orderType = "all", startDate, endDate } = req.query as Record<string, string>;

//     const params: (string | number)[] = [vendorId];
//     let dateFilter = "";
//     if (startDate) {
//       params.push(startDate);
//       dateFilter += ` AND entry_date >= $${params.length}::timestamptz`;
//     }
//     if (endDate) {
//       params.push(endDate + "T23:59:59Z");
//       dateFilter += ` AND entry_date <= $${params.length}::timestamptz`;
//     }
//     const orderTypeFilter =
//       orderType !== "all"
//         ? ` AND order_type = '${orderType === "style" ? "style" : orderType === "swatch" ? "swatch" : orderType}'`
//         : "";

//     const result = await pool.query(`
//       SELECT * FROM (

//         /* ── Costing: outsource jobs ───────────────────────────────── */
//         SELECT
//           'outsource'             AS entry_type,
//           oj.id::text             AS entry_id,
//           oj.created_at           AS entry_date,
//           CONCAT('Outsource Job', COALESCE(': ' || oj.notes, '')) AS description,
//           CASE WHEN oj.swatch_order_id IS NOT NULL THEN 'swatch' ELSE 'style' END AS order_type,
//           COALESCE(so.order_code, sw.order_code) AS order_code,
//           oj.total_cost::numeric  AS debit,
//           0::numeric              AS credit
//         FROM outsource_jobs oj
//         LEFT JOIN style_orders  so ON oj.style_order_id  = so.id AND so.is_deleted = false
//         LEFT JOIN swatch_orders sw ON oj.swatch_order_id = sw.id AND sw.is_deleted = false
//         WHERE oj.vendor_id = $1 AND oj.is_deleted = false

//         UNION ALL

//         /* ── Costing: custom charges ───────────────────────────────── */
//         SELECT
//           'custom_charge'          AS entry_type,
//           cc.id::text              AS entry_id,
//           cc.created_at            AS entry_date,
//           CONCAT('Charge: ', cc.description) AS description,
//           CASE WHEN cc.swatch_order_id IS NOT NULL THEN 'swatch' ELSE 'style' END AS order_type,
//           COALESCE(so.order_code, sw.order_code) AS order_code,
//           cc.total_amount::numeric  AS debit,
//           0::numeric                AS credit
//         FROM custom_charges cc
//         LEFT JOIN style_orders  so ON cc.style_order_id  = so.id AND so.is_deleted = false
//         LEFT JOIN swatch_orders sw ON cc.swatch_order_id = sw.id AND sw.is_deleted = false
//         WHERE cc.vendor_id = $1 AND cc.is_deleted = false

//         UNION ALL

//         /* ── Manual ledger charges ─────────────────────────────────── */
//         SELECT
//           'ledger_charge'       AS entry_type,
//           lc.id::text           AS entry_id,
//           lc.charge_date        AS entry_date,
//           CONCAT('Manual Charge: ', lc.description) AS description,
//           lc.order_type,
//           COALESCE(lc.style_order_code, lc.swatch_order_code) AS order_code,
//           lc.amount::numeric    AS debit,
//           0::numeric            AS credit
//         FROM vendor_ledger_charges lc
//         WHERE lc.vendor_id = $1 AND lc.is_deleted = false

//         UNION ALL

//         /* ── Swatch-order artworks outsourced ─────────────────────── */
//         SELECT
//           'artwork_swatch'         AS entry_type,
//           a.id::text               AS entry_id,
//           a.created_at             AS entry_date,
//           CONCAT('Artwork (Swatch): ', a.artwork_name,
//             COALESCE(' [' || a.artwork_code || ']', '')) AS description,
//           'swatch'                 AS order_type,
//           sw.order_code            AS order_code,
//           a.outsource_payment_amount::numeric AS debit,
//           0::numeric               AS credit
//         FROM artworks a
//         LEFT JOIN swatch_orders sw ON a.swatch_order_id = sw.id AND sw.is_deleted = false
//         WHERE a.outsource_vendor_id IS NOT NULL
//           AND a.outsource_vendor_id <> ''
//           AND a.outsource_payment_amount IS NOT NULL
//           AND a.outsource_payment_amount <> ''
//           AND a.outsource_vendor_id::integer = $1
//           AND a.is_deleted = false

//         UNION ALL

//         /* ── Style-order artworks outsourced ──────────────────────── */
//         SELECT
//           'artwork_style'          AS entry_type,
//           soa.id::text             AS entry_id,
//           soa.created_at           AS entry_date,
//           CONCAT('Artwork (Style): ', soa.artwork_name,
//             COALESCE(' [' || soa.artwork_code || ']', '')) AS description,
//           'style'                  AS order_type,
//           so.order_code            AS order_code,
//           soa.outsource_payment_amount::numeric AS debit,
//           0::numeric               AS credit
//         FROM style_order_artworks soa
//         LEFT JOIN style_orders so ON soa.style_order_id = so.id AND so.is_deleted = false
//         WHERE soa.outsource_vendor_id IS NOT NULL
//           AND soa.outsource_vendor_id <> ''
//           AND soa.outsource_payment_amount IS NOT NULL
//           AND soa.outsource_payment_amount <> ''
//           AND soa.outsource_vendor_id::integer = $1
//           AND soa.is_deleted = false

//         UNION ALL

//         /* ── Style-order artworks — Toile vendor ─────────────────── */
//         SELECT
//           'toile'                  AS entry_type,
//           soa.id::text             AS entry_id,
//           soa.created_at           AS entry_date,
//           CONCAT('Toile: ', soa.artwork_name,
//             COALESCE(' [' || soa.artwork_code || ']', '')) AS description,
//           'style'                  AS order_type,
//           so.order_code            AS order_code,
//           COALESCE(NULLIF(soa.toile_making_cost,''), NULLIF(soa.toile_cost,''))::numeric AS debit,
//           0::numeric               AS credit
//         FROM style_order_artworks soa
//         LEFT JOIN style_orders so ON soa.style_order_id = so.id AND so.is_deleted = false
//         WHERE soa.toile_vendor_id IS NOT NULL
//           AND soa.toile_vendor_id <> ''
//           AND (
//             (soa.toile_making_cost IS NOT NULL AND soa.toile_making_cost <> '')
//             OR (soa.toile_cost IS NOT NULL AND soa.toile_cost <> '')
//           )
//           AND soa.toile_vendor_id::integer = $1
//           AND soa.is_deleted = false

//         UNION ALL

//         /* ── Style-order artworks — Pattern Outhouse vendor ────────── */
//         SELECT
//           'pattern_outhouse'               AS entry_type,
//           soa.id::text                     AS entry_id,
//           soa.created_at                   AS entry_date,
//           CONCAT('Pattern (Outhouse): ', soa.artwork_name,
//             COALESCE(' [' || soa.artwork_code || ']', '')) AS description,
//           'style'                          AS order_type,
//           so.order_code                    AS order_code,
//           soa.pattern_payment_amount::numeric AS debit,
//           0::numeric                       AS credit
//         FROM style_order_artworks soa
//         LEFT JOIN style_orders so ON soa.style_order_id = so.id AND so.is_deleted = false
//         WHERE soa.pattern_vendor_id IS NOT NULL
//           AND soa.pattern_vendor_id <> ''
//           AND soa.pattern_payment_amount IS NOT NULL
//           AND soa.pattern_payment_amount <> ''
//           AND soa.pattern_vendor_id::integer = $1
//           AND soa.is_deleted = false

//         UNION ALL

//         /* ── Vendor invoice ledger entries ─────────────────────────── */
//         SELECT
//           'vendor_invoice'               AS entry_type,
//           vil.id::text                   AS entry_id,
//           COALESCE(vil.vendor_invoice_date::timestamptz, vil.created_at) AS entry_date,
//           CONCAT('Vendor Invoice: ', vil.vendor_invoice_number,
//             ' (PR: ', vil.pr_number, ')') AS description,
//           'procurement'                  AS order_type,
//           vil.pr_number                  AS order_code,
//           vil.base_currency_amount       AS debit,
//           0::numeric                     AS credit
//         FROM vendor_invoice_ledger vil
//         WHERE vil.vendor_id = $1 AND vil.is_deleted = false

//         UNION ALL

//         /* ── Vendor payments (credits) ────────────────────────────── */
//         SELECT
//           'payment'          AS entry_type,
//           vp.id::text        AS entry_id,
//           vp.payment_date    AS entry_date,
//           CONCAT('Payment — ', vp.payment_mode,
//             COALESCE(' (' || vp.reference_no || ')', '')) AS description,
//           vp.order_type,
//           COALESCE(vp.style_order_code, vp.swatch_order_code) AS order_code,
//           0::numeric                  AS debit,
//           vp.base_currency_amount     AS credit
//         FROM vendor_payments vp
//         WHERE vp.vendor_id = $1 AND vp.is_deleted = false

//         UNION ALL

//         /* ── Costing payments (credits — outsource/custom/artwork) ── */
//         SELECT
//           CONCAT('costing_payment_', cp.reference_type) AS entry_type,
//           cp.id::text          AS entry_id,
//           COALESCE(cp.payment_date, cp.created_at) AS entry_date,
//           CONCAT(
//             CASE cp.reference_type
//               WHEN 'outsource_job'  THEN 'Outsource Payment'
//               WHEN 'custom_charge'  THEN 'Custom Charge Payment'
//               WHEN 'artwork_swatch' THEN 'Artwork Payment (Swatch)'
//               WHEN 'artwork_style'  THEN 'Artwork Payment (Style)'
//               ELSE 'Costing Payment'
//             END,
//             COALESCE(' — ' || cp.payment_mode, ''),
//             COALESCE(' [' || cp.transaction_id || ']', '')
//           ) AS description,
//           CASE
//             WHEN cp.swatch_order_id IS NOT NULL THEN 'swatch'
//             WHEN cp.style_order_id  IS NOT NULL THEN 'style'
//             ELSE 'general'
//           END AS order_type,
//           COALESCE(so.order_code, sw.order_code) AS order_code,
//           0::numeric                  AS debit,
//           cp.base_currency_amount     AS credit
//         FROM costing_payments cp
//         LEFT JOIN style_orders  so ON cp.style_order_id  = so.id AND so.is_deleted = false
//         LEFT JOIN swatch_orders sw ON cp.swatch_order_id = sw.id AND sw.is_deleted = false
//         WHERE cp.vendor_id = $1 AND cp.is_deleted = false

//       ) ledger
//       WHERE 1=1${dateFilter}${orderTypeFilter}
//       ORDER BY entry_date ASC
//     `, params);

//     const entries = result.rows;
//     let running = 0;
//     const withBalance = entries.map(
//       (row: { debit: string | number; credit: string | number; [key: string]: unknown }) => {
//         running += Number(row.debit) - Number(row.credit);
//         return { ...row, running_balance: running };
//       }
//     );

//     return res.json(withBalance);
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ error: "Failed to load ledger entries" });
//   }
// });

router.get("/vendor-ledger/:vendorId/entries", requireAuth, async (req, res) => {
  try {
    const vendorId = parseInt(String(req.params.vendorId), 10);
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const orderType = (req.query.orderType as string) || "all";

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

    let orderTypeFilter = "";
    if (orderType !== "all") {
      const validType = orderType === "style" ? "style" : orderType === "swatch" ? "swatch" : orderType;
      orderTypeFilter = ` AND order_type = '${validType}'`;
    }

    const query = `
      WITH
      /* ── Costing payments grouped by reference ─────────────────── */
      payment_sums AS (
        SELECT
          reference_type,
          reference_id,
          SUM(base_currency_amount) AS paid_amount
        FROM costing_payments
        WHERE vendor_id = $1 AND is_deleted = false
        GROUP BY reference_type, reference_id
      ),
      /* ── PR payments grouped by receipt id ────────────────────── */
      pr_payment_sums AS (
        SELECT
          pr_id,
          SUM(base_currency_amount) AS pr_paid_amount
        FROM pr_payments
        WHERE is_deleted = false
        GROUP BY pr_id
      ),
      ledger_base AS (
        SELECT
          entry_type,
          entry_id,
          entry_date,
          description,
          order_type,
          order_code,
          total_amount,
          credit,
          CASE
            WHEN entry_type IN ('outsource', 'custom_charge', 'artwork_swatch', 'artwork_style') THEN
              CASE entry_type
                WHEN 'outsource' THEN 'outsource_job'
                WHEN 'custom_charge' THEN 'custom_charge'
                WHEN 'artwork_swatch' THEN 'artwork_swatch'
                WHEN 'artwork_style' THEN 'artwork_style'
              END
            ELSE NULL
          END AS payment_ref_type,
          CASE
            WHEN entry_type IN ('outsource', 'custom_charge', 'artwork_swatch', 'artwork_style') THEN entry_id
            ELSE NULL
          END AS payment_ref_id,
          entry_type IN ('outsource', 'custom_charge', 'ledger_charge', 'artwork_swatch', 'artwork_style', 'toile', 'pattern_outhouse', 'vendor_invoice', 'purchase_receipt') AS is_charge
        FROM (
          /* ── Costing: outsource jobs (GST inclusive) ──────────────── */
          SELECT
            'outsource'             AS entry_type,
            oj.id::text             AS entry_id,
            oj.created_at           AS entry_date,
            CONCAT('Outsource Job', COALESCE(': ' || oj.notes, '')) AS description,
            CASE WHEN oj.swatch_order_id IS NOT NULL THEN 'swatch' ELSE 'style' END AS order_type,
            COALESCE(so.order_code, sw.order_code) AS order_code,
            (oj.total_cost::numeric * (1 + (COALESCE(oj.gst_percentage, '0')::numeric / 100))) AS total_amount,
            0::numeric              AS credit
          FROM outsource_jobs oj
          LEFT JOIN style_orders  so ON oj.style_order_id  = so.id AND so.is_deleted = false
          LEFT JOIN swatch_orders sw ON oj.swatch_order_id = sw.id AND sw.is_deleted = false
          WHERE oj.vendor_id = $1 AND oj.is_deleted = false

          UNION ALL

          /* ── Costing: custom charges (GST inclusive) ──────────────── */
          SELECT
            'custom_charge'          AS entry_type,
            cc.id::text              AS entry_id,
            cc.created_at            AS entry_date,
            CONCAT('Charge: ', cc.description) AS description,
            CASE WHEN cc.swatch_order_id IS NOT NULL THEN 'swatch' ELSE 'style' END AS order_type,
            COALESCE(so.order_code, sw.order_code) AS order_code,
            (cc.total_amount::numeric * (1 + (COALESCE(cc.gst_percentage, '0')::numeric / 100))) AS total_amount,
            0::numeric               AS credit
          FROM custom_charges cc
          LEFT JOIN style_orders  so ON cc.style_order_id  = so.id AND so.is_deleted = false
          LEFT JOIN swatch_orders sw ON cc.swatch_order_id = sw.id AND sw.is_deleted = false
          WHERE cc.vendor_id = $1 AND cc.is_deleted = false

          UNION ALL

          /* ── Manual ledger charges (no GST) ───────────────────────── */
          SELECT
            'ledger_charge'       AS entry_type,
            lc.id::text           AS entry_id,
            lc.charge_date        AS entry_date,
            CONCAT('Manual Charge: ', lc.description) AS description,
            lc.order_type,
            COALESCE(lc.style_order_code, lc.swatch_order_code) AS order_code,
            lc.amount::numeric    AS total_amount,
            0::numeric            AS credit
          FROM vendor_ledger_charges lc
          WHERE lc.vendor_id = $1 AND lc.is_deleted = false

          UNION ALL

          /* ── Swatch-order artworks outsourced (no GST) ────────────── */
          SELECT
            'artwork_swatch'         AS entry_type,
            a.id::text               AS entry_id,
            a.created_at             AS entry_date,
            CONCAT('Artwork (Swatch): ', a.artwork_name,
              COALESCE(' [' || a.artwork_code || ']', '')) AS description,
            'swatch'                 AS order_type,
            sw.order_code            AS order_code,
            a.outsource_payment_amount::numeric AS total_amount,
            0::numeric               AS credit
          FROM artworks a
          LEFT JOIN swatch_orders sw ON a.swatch_order_id = sw.id AND sw.is_deleted = false
          WHERE a.outsource_vendor_id IS NOT NULL
            AND a.outsource_vendor_id <> ''
            AND a.outsource_payment_amount IS NOT NULL
            AND a.outsource_payment_amount <> ''
            AND a.outsource_vendor_id::integer = $1
            AND a.is_deleted = false

          UNION ALL

          /* ── Style-order artworks outsourced (no GST) ─────────────── */
          SELECT
            'artwork_style'          AS entry_type,
            soa.id::text             AS entry_id,
            soa.created_at           AS entry_date,
            CONCAT('Artwork (Style): ', soa.artwork_name,
              COALESCE(' [' || soa.artwork_code || ']', '')) AS description,
            'style'                  AS order_type,
            so.order_code            AS order_code,
            soa.outsource_payment_amount::numeric AS total_amount,
            0::numeric               AS credit
          FROM style_order_artworks soa
          LEFT JOIN style_orders so ON soa.style_order_id = so.id AND so.is_deleted = false
          WHERE soa.outsource_vendor_id IS NOT NULL
            AND soa.outsource_vendor_id <> ''
            AND soa.outsource_payment_amount IS NOT NULL
            AND soa.outsource_payment_amount <> ''
            AND soa.outsource_vendor_id::integer = $1
            AND soa.is_deleted = false

          UNION ALL

          /* ── Style-order artworks — Toile vendor (no GST) ─────────── */
          SELECT
            'toile'                  AS entry_type,
            soa.id::text             AS entry_id,
            soa.created_at           AS entry_date,
            CONCAT('Toile: ', soa.artwork_name,
              COALESCE(' [' || soa.artwork_code || ']', '')) AS description,
            'style'                  AS order_type,
            so.order_code            AS order_code,
            COALESCE(NULLIF(soa.toile_making_cost,''), NULLIF(soa.toile_cost,''))::numeric AS total_amount,
            0::numeric               AS credit
          FROM style_order_artworks soa
          LEFT JOIN style_orders so ON soa.style_order_id = so.id AND so.is_deleted = false
          WHERE soa.toile_vendor_id IS NOT NULL
            AND soa.toile_vendor_id <> ''
            AND (
              (soa.toile_making_cost IS NOT NULL AND soa.toile_making_cost <> '')
              OR (soa.toile_cost IS NOT NULL AND soa.toile_cost <> '')
            )
            AND soa.toile_vendor_id::integer = $1
            AND soa.is_deleted = false

          UNION ALL

          /* ── Style-order artworks — Pattern Outhouse (no GST) ─────── */
          SELECT
            'pattern_outhouse'               AS entry_type,
            soa.id::text                     AS entry_id,
            soa.created_at                   AS entry_date,
            CONCAT('Pattern (Outhouse): ', soa.artwork_name,
              COALESCE(' [' || soa.artwork_code || ']', '')) AS description,
            'style'                          AS order_type,
            so.order_code                    AS order_code,
            soa.pattern_payment_amount::numeric AS total_amount,
            0::numeric                       AS credit
          FROM style_order_artworks soa
          LEFT JOIN style_orders so ON soa.style_order_id = so.id AND so.is_deleted = false
          WHERE soa.pattern_vendor_id IS NOT NULL
            AND soa.pattern_vendor_id <> ''
            AND soa.pattern_payment_amount IS NOT NULL
            AND soa.pattern_payment_amount <> ''
            AND soa.pattern_vendor_id::integer = $1
            AND soa.is_deleted = false

          UNION ALL

          /* ── Vendor invoice ledger (already GST inclusive) ────────── */
          SELECT
            'vendor_invoice'               AS entry_type,
            vil.id::text                   AS entry_id,
            COALESCE(vil.vendor_invoice_date::timestamptz, vil.created_at) AS entry_date,
            CONCAT('Vendor Invoice: ', vil.vendor_invoice_number,
              ' (PR: ', vil.pr_number, ')') AS description,
            'procurement'                  AS order_type,
            vil.pr_number                  AS order_code,
            vil.base_currency_amount       AS total_amount,
            0::numeric                     AS credit
          FROM vendor_invoice_ledger vil
          WHERE vil.vendor_id = $1 AND vil.is_deleted = false

          UNION ALL

          /* ── Purchase Receipts (goods received) ────────────────────── */
          SELECT
            'purchase_receipt'             AS entry_type,
            pr.id::text                    AS entry_id,
            COALESCE(pr.received_date, pr.created_at) AS entry_date,
            CONCAT('Purchase Receipt: ', pr.pr_number,
              COALESCE(' (Inv: ' || pr.vendor_invoice_number || ')', '')) AS description,
            CASE
              WHEN po.style_order_id IS NOT NULL THEN 'style'
              WHEN po.swatch_order_id IS NOT NULL THEN 'swatch'
              ELSE 'procurement'
            END AS order_type,
            COALESCE(so.order_code, sw.order_code, po.po_number, pr.pr_number) AS order_code,
            COALESCE(
              pr.vendor_invoice_amount,
              items.total_with_gst,                                    
              (pr.received_qty::numeric * pr.actual_price::numeric),   
              0
            ) AS total_amount,
            0::numeric                     AS credit
          FROM purchase_receipts pr
          JOIN purchase_orders po ON pr.po_id = po.id AND po.is_deleted = false
          LEFT JOIN style_orders so ON po.style_order_id = so.id AND so.is_deleted = false
          LEFT JOIN swatch_orders sw ON po.swatch_order_id = sw.id AND sw.is_deleted = false
          LEFT JOIN (
            SELECT
              pr_id,
              SUM(quantity * unit_price) AS base_total,
              SUM(quantity * unit_price * (1 + COALESCE(gst_percentage, 0) / 100)) AS total_with_gst
            FROM purchase_receipt_items
            WHERE is_deleted = false
            GROUP BY pr_id
          ) items ON items.pr_id = pr.id
          WHERE po.vendor_id = $1 AND pr.is_deleted = false

          UNION ALL

          /* ── PR Payments (credits) ─────────────────────────────────── */
          SELECT
            'pr_payment'                   AS entry_type,
            pp.id::text                    AS entry_id,
            pp.payment_date                AS entry_date,
            CONCAT('PR Payment — ', pp.payment_mode,
              COALESCE(' (' || pp.transaction_status || ')', '')) AS description,
            CASE
              WHEN po.style_order_id IS NOT NULL THEN 'style'
              WHEN po.swatch_order_id IS NOT NULL THEN 'swatch'
              ELSE 'procurement'
            END AS order_type,
            COALESCE(so.order_code, sw.order_code, po.po_number, pr.pr_number) AS order_code,
            0::numeric                     AS total_amount,
            pp.base_currency_amount        AS credit
          FROM pr_payments pp
          JOIN purchase_receipts pr ON pp.pr_id = pr.id AND pr.is_deleted = false
          JOIN purchase_orders po ON pr.po_id = po.id AND po.is_deleted = false
          LEFT JOIN style_orders so ON po.style_order_id = so.id AND so.is_deleted = false
          LEFT JOIN swatch_orders sw ON po.swatch_order_id = sw.id AND sw.is_deleted = false
          WHERE po.vendor_id = $1 AND pp.is_deleted = false

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
            0::numeric                  AS total_amount,
            vp.base_currency_amount     AS credit
          FROM vendor_payments vp
          WHERE vp.vendor_id = $1 AND vp.is_deleted = false

          UNION ALL

          /* ── Costing payments (credits) ───────────────────────────── */
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
            0::numeric                  AS total_amount,
            cp.base_currency_amount     AS credit
          FROM costing_payments cp
          LEFT JOIN style_orders  so ON cp.style_order_id  = so.id AND so.is_deleted = false
          LEFT JOIN swatch_orders sw ON cp.swatch_order_id = sw.id AND sw.is_deleted = false
          WHERE cp.vendor_id = $1 AND cp.is_deleted = false
        ) ledger_union
      )
      SELECT
        entry_type,
        entry_id,
        entry_date,
        description,
        order_type,
        order_code,
        total_amount,
        CASE
          WHEN is_charge THEN
            total_amount
            - COALESCE(paid_amount, 0)
            - CASE
                WHEN entry_type = 'purchase_receipt'
                THEN COALESCE(pr_pay.pr_paid_amount, 0)
                ELSE 0
              END
          ELSE 0
        END AS debit,
        credit
      FROM ledger_base
      LEFT JOIN payment_sums ON
        ledger_base.payment_ref_type = payment_sums.reference_type
        AND ledger_base.payment_ref_id::integer = payment_sums.reference_id
      LEFT JOIN pr_payment_sums pr_pay
        ON entry_type = 'purchase_receipt'
        AND entry_id::integer = pr_pay.pr_id
      WHERE 1=1 ${dateFilter}${orderTypeFilter}
      ORDER BY entry_date ASC
    `;

    const result = await pool.query(query, params);
    const entries = result.rows;

    let runningBalance = 0;
    const withBalance = entries.map((row) => {
      runningBalance += Number(row.total_amount) - Number(row.credit);
      return { ...row, running_balance: runningBalance };
    });

    return res.json(withBalance);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load ledger entries" });
  }
});

router.get("/vendor-ledger/:vendorId/info", requireAuth, async (req, res) => {
  try {
    const vendorId = parseInt(String(req.params.vendorId));
    const rows = await db
      .select()
      .from(vendorsTable)
      .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.isDeleted, false)));
    if (!rows.length) return res.status(404).json({ error: "Vendor not found" });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load vendor" });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface PaymentAllocation {
  entryType: string;
  entryId: number;
  amount: string;
  debit?: string;
  tdsMasterId?: number;
}

interface ItemBalance {
  id: number;
  quantity: number;
  unitPrice: number;
  base: number;
  gst: number;
  gstPct: number;
  total: number;
  remaining: number;
}

interface WaterfallAllocation {
  itemId: number;
  allocBase: number;
  allocGst: number;
  allocGross: number;
  tdsAmount: number;
  paidAmount: number;
  gstPercentage: number;
  quantity: number;
  unitPrice: number;
}

// ============================================================================
// 1. VALIDATION HELPERS
// ============================================================================

function validatePaymentAmount(amt: number): void {
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error("Payment amount must be greater than 0");
  }
}

function validatePaymentDate(paymentDate: any): void {
  if (paymentDate) {
    const dateStr = String(paymentDate).slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);
    if (dateStr > todayStr) {
      throw new Error("Payment date cannot be in the future");
    }
  }
}

function validateAllocationsSum(allocations: any[], totalAmt: number): void {
  const sumAlloc = allocations.reduce((s: number, a: any) => s + parseFloat(a.amount), 0);
  if (Math.abs(sumAlloc - totalAmt) > 0.01) {
    throw new Error("Allocated amounts do not sum to total payment");
  }
}

async function validateOutstandingBalance(client: any, vendorId: number, amt: number): Promise<void> {
  const balRes = await client.query(
    `SELECT
      -- Outsource jobs: total_cost + GST
      COALESCE((
        SELECT SUM(
          total_cost::numeric + (total_cost::numeric * COALESCE(gst_percentage::numeric, 0) / 100)
        ) 
        FROM outsource_jobs 
        WHERE vendor_id = $1 AND is_deleted = false
      ), 0)
      
      -- Custom charges: total_amount + GST
    + COALESCE((
        SELECT SUM(
          total_amount::numeric + (total_amount::numeric * COALESCE(gst_percentage::numeric, 0) / 100)
        ) 
        FROM custom_charges 
        WHERE vendor_id = $1 AND is_deleted = false
      ), 0)
      
      -- Vendor ledger charges: amount + GST (already includes GST calculation)
    + COALESCE((
        SELECT SUM(amount::numeric + (amount::numeric * COALESCE(gst_percentage::numeric, 0) / 100))
        FROM vendor_ledger_charges
        WHERE vendor_id = $1 AND is_deleted = false
      ), 0)
      
      -- Artworks outsource payments (these are already GST-inclusive amounts)
    + COALESCE((SELECT SUM(outsource_payment_amount::numeric)
                  FROM artworks
                  WHERE outsource_vendor_id IS NOT NULL AND outsource_vendor_id <> ''
                    AND outsource_payment_amount IS NOT NULL AND outsource_payment_amount <> ''
                    AND outsource_vendor_id::integer = $1 AND is_deleted = false), 0)
      
      -- Style order artworks outsource payments (already GST-inclusive)
    + COALESCE((SELECT SUM(outsource_payment_amount::numeric)
                  FROM style_order_artworks
                  WHERE outsource_vendor_id IS NOT NULL AND outsource_vendor_id <> ''
                    AND outsource_payment_amount IS NOT NULL AND outsource_payment_amount <> ''
                    AND outsource_vendor_id::integer = $1 AND is_deleted = false), 0)
      
      -- Toile costs (already GST-inclusive or specified amounts)
    + COALESCE((SELECT SUM(COALESCE(NULLIF(toile_making_cost,''), NULLIF(toile_cost,''))::numeric)
                  FROM style_order_artworks
                  WHERE toile_vendor_id IS NOT NULL AND toile_vendor_id <> ''
                    AND ((toile_making_cost IS NOT NULL AND toile_making_cost <> '')
                        OR (toile_cost IS NOT NULL AND toile_cost <> ''))
                    AND toile_vendor_id::integer = $1 AND is_deleted = false), 0)
      
      -- Pattern payments (already GST-inclusive)
    + COALESCE((SELECT SUM(pattern_payment_amount::numeric)
                  FROM style_order_artworks
                  WHERE pattern_vendor_id IS NOT NULL AND pattern_vendor_id <> ''
                    AND pattern_payment_amount IS NOT NULL AND pattern_payment_amount <> ''
                    AND pattern_vendor_id::integer = $1 AND is_deleted = false), 0)
      
      -- Vendor invoice ledger (already GST-inclusive)
    + COALESCE((SELECT SUM(base_currency_amount::numeric)   FROM vendor_invoice_ledger    WHERE vendor_id = $1 AND is_deleted = false), 0)
      
      -- Purchase receipts: calculate with GST from items
    + COALESCE((
        SELECT SUM(
          COALESCE(
            pr.vendor_invoice_amount,
            (pr.received_qty::numeric * pr.actual_price::numeric),
            items.total_amount_with_gst,
            0
          )
        )
        FROM purchase_receipts pr
        JOIN purchase_orders po ON pr.po_id = po.id AND po.is_deleted = false
        LEFT JOIN (
          SELECT 
            pr_id, 
            SUM(quantity * unit_price) AS total_amount,
            SUM(quantity * unit_price * (1 + COALESCE(gst_percentage, 0) / 100)) AS total_amount_with_gst
          FROM purchase_receipt_items
          WHERE is_deleted = false
          GROUP BY pr_id
        ) items ON items.pr_id = pr.id
        WHERE po.vendor_id = $1 AND pr.is_deleted = false
      ), 0)
      
      -- Subtract all payments made
    - COALESCE((SELECT SUM(base_currency_amount::numeric)   FROM vendor_payments          WHERE vendor_id = $1 AND is_deleted = false), 0)
    - COALESCE((SELECT SUM(base_currency_amount::numeric)   FROM costing_payments         WHERE vendor_id = $1 AND is_deleted = false), 0)
    - COALESCE((SELECT SUM(base_currency_amount::numeric)   FROM pr_payments              WHERE pr_id IN (
        SELECT pr.id FROM purchase_receipts pr
        JOIN purchase_orders po ON pr.po_id = po.id
        WHERE po.vendor_id = $1 AND pr.is_deleted = false
      ) AND is_deleted = false), 0)
      AS outstanding`,
    [vendorId]
  );
  
  const outstanding = Math.max(0, parseFloat(balRes.rows[0]?.outstanding ?? "0"));
  if (amt > outstanding + 0.01) {
    throw new Error(`Payment amount (₹${amt.toFixed(2)}) cannot exceed outstanding balance (₹${outstanding.toFixed(2)})`);
  }
}

// ============================================================================
// 2. PURCHASE RECEIPT HELPERS
// ============================================================================

async function verifyPurchaseReceipt(client: any, entryId: number, vendorId: number): Promise<void> {
  const prRes = await client.query(
    `SELECT pr.id, pr.vendor_id
     FROM purchase_receipts pr
     JOIN purchase_orders po ON pr.po_id = po.id
     WHERE pr.id = $1 AND po.vendor_id = $2 AND pr.is_deleted = false`,
    [entryId, vendorId]
  );
  if (prRes.rows.length === 0) {
    throw new Error(`Purchase receipt ${entryId} not found or does not belong to vendor`);
  }
}

async function getTDSMasterRate(client: any, tdsMasterId: number): Promise<number> {
  const tdsMasterRes = await client.query(
    `SELECT rate_percent FROM tds_master 
     WHERE id = $1 AND status = true AND is_deleted = false`,
    [tdsMasterId]
  );
  if (tdsMasterRes.rows.length === 0) {
    throw new Error(`Invalid or inactive TDS master (ID: ${tdsMasterId})`);
  }
  return parseFloat(tdsMasterRes.rows[0].rate_percent);
}

async function getPurchaseReceiptItems(client: any, entryId: number): Promise<any[]> {
  const items = await client.query(
    `SELECT 
      pri.id,
      pri.quantity,
      pri.unit_price,
      pri.gst_percentage,
      (pri.quantity * pri.unit_price * (1 + COALESCE(pri.gst_percentage, 0) / 100)) as total_amount
     FROM purchase_receipt_items pri
     WHERE pri.pr_id = $1 AND pri.is_deleted = false`,
    [entryId]
  );
  if (items.rows.length === 0) {
    throw new Error(`No items found on Purchase Receipt ${entryId}.`);
  }
  return items.rows;
}

async function getExistingPaymentsForItems(client: any, itemIds: number[]): Promise<Map<number, number>> {
  if (itemIds.length === 0) return new Map();
  
  const paidRows = await client.query(
    `SELECT 
      pti.base_document_item_id as item_id,
      COALESCE(SUM(pti.paid_amount + pti.tds_amount), 0) as paid_so_far
     FROM payment_tds_items pti
     JOIN payment_tds pt ON pti.payment_tds_id = pt.id
     WHERE pti.base_document_item_type = 'purchase_receipt_item'
       AND pti.is_deleted = false
       AND pti.base_document_item_id = ANY($1::int[])
     GROUP BY pti.base_document_item_id`,
    [itemIds]
  );
  
  return new Map<number, number>(
    paidRows.rows.map((r: any) => [r.item_id, parseFloat(r.paid_so_far)])
  );
}

function calculateItemBalances(items: any[], paidMap: Map<number, number>): ItemBalance[] {
  return items.map((item: any) => {
    const totalWithGst = parseFloat(item.total_amount);
    const gstPct = parseFloat(item.gst_percentage ?? "0");
    const baseAmount = gstPct > 0 ? totalWithGst / (1 + gstPct / 100) : totalWithGst;
    const gstAmount = totalWithGst - baseAmount;
    const paidSoFar = paidMap.get(item.id) ?? 0;
    
    return {
      id: item.id,
      quantity: parseFloat(item.quantity),
      unitPrice: parseFloat(item.unit_price),
      base: baseAmount,
      gst: gstAmount,
      gstPct: gstPct,
      total: totalWithGst,
      remaining: Math.max(0, totalWithGst - paidSoFar)
    };
  });
}

function allocateWaterfall(
  amountToAllocate: number,
  orderedItems: ItemBalance[],
  tdsRate: number
): { allocations: WaterfallAllocation[]; unallocatedAmount: number } {
  let remainingAmount = amountToAllocate;
  const allocations: WaterfallAllocation[] = [];

  for (const item of orderedItems) {
    if (remainingAmount <= 0.001) break;
    if (item.remaining <= 0.001) continue;

    const allocGross = Math.min(remainingAmount, item.remaining);
    const allocGst = item.total > 0 ? allocGross * (item.gst / item.total) : 0;
    const allocBase = allocGross - allocGst;
    const tdsAmount = (allocBase * tdsRate) / 100;
    const paidAmount = allocBase - tdsAmount + allocGst;

    allocations.push({
      itemId: item.id,
      allocBase,
      allocGst,
      allocGross,
      tdsAmount,
      paidAmount,
      gstPercentage: item.gstPct,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    });

    remainingAmount -= allocGross;
  }

  return { allocations, unallocatedAmount: remainingAmount };
}

async function insertPRPayment(
  client: any,
  entryId: number,
  allocAmt: number,
  paymentType: string,
  paymentDate: any,
  paymentMode: string,
  username: string
): Promise<number> {
  const result = await client.query(
    `INSERT INTO pr_payments
       (pr_id, payment_type, payment_date, payment_mode, amount,
        currency_code, exchange_rate_snapshot, base_currency_amount,
        transaction_status, payment_status, created_by)
     VALUES ($1, $2, $3, $4, $5,
             'INR', 1, $6,
             '', 'Completed', $7)
     RETURNING id`,
    [
      entryId,
      paymentType,
      paymentDate ? new Date(paymentDate) : new Date(),
      paymentMode,
      String(allocAmt),
      allocAmt,
      username
    ]
  );
  return result.rows[0].id;
}

async function insertPaymentTDS(
  client: any,
  tdsMasterId: number,
  prPaymentId: number,
  paymentDate: any,
  vendorId: number,
  entryId: number,
  totalBase: number,
  totalGst: number,
  blendedGstPct: number,
  totalPaid: number,
  tdsRate: number,
  totalTds: number,
  username: string
): Promise<number> {
  const result = await client.query(
    `INSERT INTO payment_tds
       (tds_master_id, payment_source_type, payment_source_id, payment_date,
        vendor_id, base_document_type, base_document_id,
        gross_amount, gst_amount, gst_percentage,
        payment_currency_code, payment_exchange_rate, base_amount,
        paid_amount, tds_rate, tds_amount, status, created_by)
     VALUES ($1, 'pr_payments', $2, $3, $4,
             'pr', $5,
             $6, $7, $8,
             'INR', 1, $9,
             $10, $11, $12, 'DEDUCTED', $13)
     RETURNING id`,
    [
      tdsMasterId,
      prPaymentId,
      paymentDate ? new Date(paymentDate) : new Date(),
      vendorId,
      entryId,
      (totalBase + totalGst).toFixed(2),
      totalGst.toFixed(2),
      blendedGstPct.toFixed(2),
      totalBase.toFixed(2),
      totalPaid.toFixed(2),
      tdsRate.toFixed(2),
      totalTds.toFixed(2),
      username
    ]
  );
  return result.rows[0].id;
}

async function insertPaymentTDSItems(
  client: any,
  tdsId: number,
  allocations: WaterfallAllocation[],
  tdsRate: number,
  username: string
): Promise<void> {
  for (const alloc of allocations) {
    await client.query(
      `INSERT INTO payment_tds_items
         (payment_tds_id, base_document_item_type, base_document_item_id,
          base_amount, gst_amount, gst_percentage,
          tds_rate, tds_amount, paid_amount, created_by)
       VALUES ($1, 'purchase_receipt_item', $2,
               $3, $4, $5,
               $6, $7, $8, $9)`,
      [
        tdsId,
        alloc.itemId,
        alloc.allocBase.toFixed(2),
        alloc.allocGst.toFixed(2),
        alloc.gstPercentage.toFixed(2),
        tdsRate.toFixed(2),
        alloc.tdsAmount.toFixed(2),
        alloc.paidAmount.toFixed(2),
        username
      ]
    );
  }
}

async function getPROutstanding(client: any, entryId: number): Promise<number> {
  const outstandingRes = await client.query(
    `SELECT 
      COALESCE(SUM(pri.quantity * pri.unit_price * (1 + COALESCE(pri.gst_percentage, 0) / 100)), 0) as total_amount,
      COALESCE(SUM(pp.amount), 0) as paid_amount
     FROM purchase_receipt_items pri
     LEFT JOIN pr_payments pp ON pp.pr_id = pri.pr_id AND pp.is_deleted = false
     WHERE pri.pr_id = $1 AND pri.is_deleted = false`,
    [entryId]
  );
  
  const totalAmount = parseFloat(outstandingRes.rows[0]?.total_amount || 0);
  const paidAmount = parseFloat(outstandingRes.rows[0]?.paid_amount || 0);
  return totalAmount - paidAmount;
}

// ============================================================================
// 3. ENTRY TYPE HANDLERS
// ============================================================================

async function handleOutsourcePayment(
  client: any,
  entryId: number,
  vendorId: number,
  allocAmt: number,
  paymentType: string,
  data: any,
  alloc: PaymentAllocation,
  username: string
): Promise<void> {
  // Get outsource job details including GST information
  const jobRes = await client.query(
    `SELECT swatch_order_id, style_order_id, total_cost, gst_percentage 
     FROM outsource_jobs 
     WHERE id = $1 AND is_deleted = false`,
    [entryId]
  );
  if (jobRes.rows.length === 0) {
    throw new Error(`Outsource job ${entryId} not found`);
  }
  const { swatch_order_id, style_order_id, total_cost, gst_percentage } = jobRes.rows[0];

  // Get TDS master ID if provided
  const tdsMasterId = alloc.tdsMasterId || (data as any).tdsMasterId || null;

  // Calculate base amount and GST
  const totalCost = parseFloat(total_cost);
  const gstPct = parseFloat(gst_percentage || '0');
  const gstAmount = (totalCost * gstPct) / 100;
  const baseAmount = totalCost; // total_cost is the base amount excluding GST

  // If TDS is applicable, handle TDS deduction
  if (tdsMasterId) {
    // Get TDS master details
    const tdsMasterRes = await client.query(
      `SELECT rate_percent FROM tds_master 
       WHERE id = $1 AND status = true AND is_deleted = false`,
      [tdsMasterId]
    );
    
    if (tdsMasterRes.rows.length === 0) {
      throw new Error(`Invalid or inactive TDS master (ID: ${tdsMasterId})`);
    }
    
    const tdsRate = parseFloat(tdsMasterRes.rows[0].rate_percent);
    
    // Calculate TDS on base amount (not on GST)
    const tdsAmount = (baseAmount * tdsRate) / 100;
    const paidAmount = allocAmt - tdsAmount; // Net amount after TDS deduction
    
    // Insert costing_payments record first to get the ID
    const costingPaymentRes = await client.query(
      `INSERT INTO costing_payments
         (vendor_id, vendor_name, reference_type, reference_id,
          swatch_order_id, style_order_id,
          payment_type, payment_mode, payment_amount,
          currency_code, exchange_rate_snapshot, base_currency_amount,
          payment_status, transaction_id, payment_date, remarks, created_by)
       VALUES ($1, $2, 'outsource_job', $3, $4, $5,
               $13, $6, $7,
               'INR', 1, $8,
               'Completed', $9, $10, $11, $12)
       RETURNING id`,
      [
        vendorId,
        data.vendorName,
        entryId,
        swatch_order_id,
        style_order_id,
        data.paymentMode,
        allocAmt,
        allocAmt,
        data.referenceNo || null,
        data.paymentDate ? new Date(data.paymentDate) : new Date(),
        data.notes ? data.notes + ` (against outsource ${entryId})` : `Outsource payment ${entryId}`,
        username,
        paymentType
      ]
    );
    
    const costingPaymentId = costingPaymentRes.rows[0].id;
    
    // Insert payment_tds record
    await client.query(
      `INSERT INTO payment_tds
         (tds_master_id, payment_source_type, payment_source_id, payment_date,
          vendor_id, base_document_type, base_document_id,
          gross_amount, gst_amount, gst_percentage,
          payment_currency_code, payment_exchange_rate, base_amount,
          paid_amount, tds_rate, tds_amount, status, created_by)
       VALUES ($1, 'costing_payments', $2, $3, $4,
               'outsource_job', $5,
               $6, $7, $8,
               'INR', 1, $9,
               $10, $11, $12, 'DEDUCTED', $13)`,
      [
        tdsMasterId,
        costingPaymentId, // payment_source_id from costing_payments
        data.paymentDate ? new Date(data.paymentDate) : new Date(),
        vendorId,
        entryId,
        String(totalCost + gstAmount), // gross_amount = base + gst
        String(gstAmount), // gst_amount
        String(gstPct), // gst_percentage
        String(baseAmount), // base_amount (without GST)
        String(paidAmount), // paid_amount = gross - TDS
        String(tdsRate),
        String(tdsAmount),
        username
      ]
    );
    
  } else {
    // No TDS - simple payment insertion
    await client.query(
      `INSERT INTO costing_payments
         (vendor_id, vendor_name, reference_type, reference_id,
          swatch_order_id, style_order_id,
          payment_type, payment_mode, payment_amount,
          currency_code, exchange_rate_snapshot, base_currency_amount,
          payment_status, transaction_id, payment_date, remarks, created_by)
       VALUES ($1, $2, 'outsource_job', $3, $4, $5,
               $13, $6, $7,
               'INR', 1, $8,
               'Completed', $9, $10, $11, $12)`,
      [
        vendorId,
        data.vendorName,
        entryId,
        swatch_order_id,
        style_order_id,
        data.paymentMode,
        allocAmt,
        allocAmt,
        data.referenceNo || null,
        data.paymentDate ? new Date(data.paymentDate) : new Date(),
        data.notes ? data.notes + ` (against outsource ${entryId})` : `Outsource payment ${entryId}`,
        username,
        paymentType
      ]
    );
  }
}

async function handleCustomChargePayment(
  client: any,
  entryId: number,
  vendorId: number,
  allocAmt: number,
  paymentType: string,
  data: any,
  alloc: PaymentAllocation,
  username: string
): Promise<void> {
  // Get custom charge details including GST information
  const chargeRes = await client.query(
    `SELECT id, swatch_order_id, style_order_id, total_amount, gst_percentage 
     FROM custom_charges 
     WHERE id = $1 AND is_deleted = false`,
    [entryId]
  );
  if (chargeRes.rows.length === 0) {
    throw new Error(`Custom charge ${entryId} not found`);
  }
  const { id: customChargeId, swatch_order_id, style_order_id, total_amount, gst_percentage } = chargeRes.rows[0];

  // Get TDS master ID if provided
  const tdsMasterId = alloc.tdsMasterId || (data as any).tdsMasterId || null;

  // Calculate base amount and GST
  const totalAmount = parseFloat(total_amount);
  const gstPct = parseFloat(gst_percentage || '0');
  const gstAmount = (totalAmount * gstPct) / 100;
  const baseAmount = totalAmount; // total_amount is the base amount excluding GST

  // If TDS is applicable, handle TDS deduction
  if (tdsMasterId) {
    // Get TDS master details
    const tdsMasterRes = await client.query(
      `SELECT rate_percent FROM tds_master 
       WHERE id = $1 AND status = true AND is_deleted = false`,
      [tdsMasterId]
    );
    
    if (tdsMasterRes.rows.length === 0) {
      throw new Error(`Invalid or inactive TDS master (ID: ${tdsMasterId})`);
    }
    
    const tdsRate = parseFloat(tdsMasterRes.rows[0].rate_percent);
    
    // Calculate TDS on base amount (not on GST)
    const tdsAmount = (baseAmount * tdsRate) / 100;
    const paidAmount = allocAmt - tdsAmount; // Net amount after TDS deduction
    
    // Insert costing_payments record first to get the ID
    const costingPaymentRes = await client.query(
      `INSERT INTO costing_payments
         (vendor_id, vendor_name, reference_type, reference_id,
          swatch_order_id, style_order_id,
          payment_type, payment_mode, payment_amount,
          currency_code, exchange_rate_snapshot, base_currency_amount,
          payment_status, transaction_id, payment_date, remarks, created_by)
       VALUES ($1, $2, $3, $4, $5, $6,
               $14, $7, $8,
               'INR', 1, $9,
               'Completed', $10, $11, $12, $13)
       RETURNING id`,
      [
        vendorId,
        data.vendorName,
        'custom_charge',
        customChargeId,
        swatch_order_id,
        style_order_id,
        data.paymentMode,
        allocAmt,
        allocAmt,
        data.referenceNo || null,
        data.paymentDate ? new Date(data.paymentDate) : new Date(),
        data.notes ? data.notes + ` (against custom charge ${entryId})` : `Custom charge payment ${entryId}`,
        username,
        paymentType
      ]
    );
    
    const costingPaymentId = costingPaymentRes.rows[0].id;
    
    // Insert payment_tds record
    await client.query(
      `INSERT INTO payment_tds
         (tds_master_id, payment_source_type, payment_source_id, payment_date,
          vendor_id, base_document_type, base_document_id,
          gross_amount, gst_amount, gst_percentage,
          payment_currency_code, payment_exchange_rate, base_amount,
          paid_amount, tds_rate, tds_amount, status, created_by)
       VALUES ($1, 'costing_payments', $2, $3, $4,
               'custom_charge', $5,
               $6, $7, $8,
               'INR', 1, $9,
               $10, $11, $12, 'DEDUCTED', $13)`,
      [
        tdsMasterId,
        costingPaymentId, // payment_source_id from costing_payments
        data.paymentDate ? new Date(data.paymentDate) : new Date(),
        vendorId,
        entryId,
        String(totalAmount + gstAmount), // gross_amount = base + gst
        String(gstAmount), // gst_amount
        String(gstPct), // gst_percentage
        String(baseAmount), // base_amount (without GST)
        String(paidAmount), // paid_amount = gross - TDS
        String(tdsRate),
        String(tdsAmount),
        username
      ]
    );
    
  } else {
    // No TDS - simple payment insertion
    await client.query(
      `INSERT INTO costing_payments
         (vendor_id, vendor_name, reference_type, reference_id,
          swatch_order_id, style_order_id,
          payment_type, payment_mode, payment_amount,
          currency_code, exchange_rate_snapshot, base_currency_amount,
          payment_status, transaction_id, payment_date, remarks, created_by)
       VALUES ($1, $2, $3, $4, $5, $6,
               $14, $7, $8,
               'INR', 1, $9,
               'Completed', $10, $11, $12, $13)`,
      [
        vendorId,
        data.vendorName,
        'custom_charge',
        customChargeId,
        swatch_order_id,
        style_order_id,
        data.paymentMode,
        allocAmt,
        allocAmt,
        data.referenceNo || null,
        data.paymentDate ? new Date(data.paymentDate) : new Date(),
        data.notes ? data.notes + ` (against custom charge ${entryId})` : `Custom charge payment ${entryId}`,
        username,
        paymentType
      ]
    );
  }
}

async function handlePurchaseReceiptPayment(
  client: any,
  entryId: number,
  vendorId: number,
  allocAmt: number,
  data: any,
  alloc: PaymentAllocation,
  username: string
): Promise<void> {
  await verifyPurchaseReceipt(client, entryId, vendorId);

  const tdsMasterId = alloc.tdsMasterId || (data as any).tdsMasterId || null;

  if (tdsMasterId) {
    // Get TDS rate
    const tdsRate = await getTDSMasterRate(client, tdsMasterId);
    
    // Get items and existing payments
    const items = await getPurchaseReceiptItems(client, entryId);
    const itemIds = items.map((r: any) => r.id);
    const paidMap = await getExistingPaymentsForItems(client, itemIds);
    
    // Calculate balances
    const itemBalances = calculateItemBalances(items, paidMap);
    const orderedItems = itemBalances.sort((a, b) => a.id - b.id);
    
    // Allocate waterfall
    const { allocations, unallocatedAmount } = allocateWaterfall(allocAmt, orderedItems, tdsRate);
    
    if (unallocatedAmount > 0.01) {
      throw new Error(
        `Amount exceeds total outstanding balance on this PR by ${unallocatedAmount.toFixed(2)}. ` +
        `Please reduce the amount or handle as an advance.`
      );
    }
    
    if (allocations.length === 0) {
      throw new Error(`Nothing to allocate — all items on this PR are already fully paid.`);
    }
    
    // Aggregate totals
    const totalBase = allocations.reduce((s: number, a: any) => s + a.allocBase, 0);
    const totalGst = allocations.reduce((s: number, a: any) => s + a.allocGst, 0);
    const totalTds = allocations.reduce((s: number, a: any) => s + a.tdsAmount, 0);
    const totalPaid = allocations.reduce((s: number, a: any) => s + a.paidAmount, 0);
    const blendedGstPct = totalBase > 0 ? (totalGst / totalBase) * 100 : 0;
    
    // Determine payment type
    const totalOutstanding = orderedItems.reduce((s, item) => s + item.remaining, 0);
    const prPaymentType = (allocAmt >= totalOutstanding - 0.01) ? 'Full' : 'Partial';
    
    // Insert PR payment
    const prPaymentId = await insertPRPayment(
      client, entryId, allocAmt, prPaymentType,
      data.paymentDate, data.paymentMode, username
    );
    
    // Insert TDS record
    const tdsId = await insertPaymentTDS(
      client, tdsMasterId, prPaymentId, data.paymentDate,
      vendorId, entryId, totalBase, totalGst, blendedGstPct,
      totalPaid, tdsRate, totalTds, username
    );
    
    // Insert TDS items
    await insertPaymentTDSItems(client, tdsId, allocations, tdsRate, username);
    
  } else {
    // No TDS - simple payment
    const outstanding = await getPROutstanding(client, entryId);
    const paymentType = (allocAmt >= outstanding - 0.01) ? 'Full' : 'Partial';
    
    await insertPRPayment(
      client, entryId, allocAmt, paymentType,
      data.paymentDate, data.paymentMode, username
    );
  }
}

async function handleLedgerChargePayment(
  client: any,
  entryId: number,
  vendorId: number,
  allocAmt: number,
  data: any,
  alloc: PaymentAllocation,
  username: string
): Promise<void> {
  const ledgerRes = await client.query(
    `SELECT id, amount, gst_percentage, order_type, order_id, paid_amount
    FROM vendor_ledger_charges
    WHERE id = $1 AND vendor_id = $2 AND is_deleted = false`,
    [entryId, vendorId]
  );
  if (ledgerRes.rows.length === 0) {
    throw new Error(`Ledger charge ${entryId} not found or does not belong to vendor`);
  }
  
  const ledger = ledgerRes.rows[0];
  const baseAmount = parseFloat(ledger.amount);
  const gstPct = parseFloat(ledger.gst_percentage || '0');
  const totalAmount = baseAmount + (baseAmount * gstPct / 100);
  const currentPaid = parseFloat(ledger.paid_amount || '0');
  const newPaid = currentPaid + allocAmt;

  // Get TDS master ID if provided
  const tdsMasterId = alloc.tdsMasterId || (data as any).tdsMasterId || null;

  let newStatus = 'Unpaid';
  if (newPaid >= totalAmount - 0.01) {
    newStatus = 'Paid';
  } else if (newPaid > 0) {
    newStatus = 'Partially Paid';
  }

  // Update ledger charge
  await client.query(
    `UPDATE other_expenses
    SET paid_amount = $1, payment_status = $2, updated_at = NOW()
    WHERE expense_id = $3`,
    [String(newPaid), newStatus, ledger.order_id]
  );

  // If TDS is applicable, handle TDS deduction
  if (tdsMasterId) {
    // Get TDS master details
    const tdsMasterRes = await client.query(
      `SELECT rate_percent FROM tds_master 
       WHERE id = $1 AND status = true AND is_deleted = false`,
      [tdsMasterId]
    );
    
    if (tdsMasterRes.rows.length === 0) {
      throw new Error(`Invalid or inactive TDS master (ID: ${tdsMasterId})`);
    }
    
    const tdsRate = parseFloat(tdsMasterRes.rows[0].rate_percent);
    
    // Calculate TDS on base amount (not on GST)
    const gstAmount = (baseAmount * gstPct) / 100;
    const tdsAmount = (baseAmount * tdsRate) / 100;
    const paidAmount = allocAmt - tdsAmount; // Net amount after TDS deduction
    
    // Insert payment record (into vendor_payments) first to get the ID
    const notes = data.notes ? data.notes + ` (against ledger charge ${entryId})` : `Ledger charge payment ${entryId}`;
    const paymentRes = await client.query(
      `INSERT INTO vendor_payments
        (vendor_id, vendor_name, payment_date, amount,
          currency_code, exchange_rate_snapshot, base_currency_amount,
          payment_mode, reference_no, notes, order_type,
          style_order_id, style_order_code, swatch_order_id, swatch_order_code,
          created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11,
              $12, $13, $14, $15, $16)
      RETURNING id`,
      [
        vendorId, data.vendorName,
        data.paymentDate ? new Date(data.paymentDate) : new Date(),
        allocAmt, 'INR', '1', String(allocAmt),
        data.paymentMode, data.referenceNo || null, notes,
        'ledger_charge',
        null, null, null, null,
        username
      ]
    );
    
    const paymentId = paymentRes.rows[0].id;
    
    // Insert payment_tds record
    await client.query(
      `INSERT INTO payment_tds
         (tds_master_id, payment_source_type, payment_source_id, payment_date,
          vendor_id, base_document_type, base_document_id,
          gross_amount, gst_amount, gst_percentage,
          payment_currency_code, payment_exchange_rate, base_amount,
          paid_amount, tds_rate, tds_amount, status, created_by)
       VALUES ($1, 'vendor_payments', $2, $3, $4,
               'ledger_charge', $5,
               $6, $7, $8,
               'INR', 1, $9,
               $10, $11, $12, 'DEDUCTED', $13)`,
      [
        tdsMasterId,
        paymentId, // payment_source_id from vendor_payments
        data.paymentDate ? new Date(data.paymentDate) : new Date(),
        vendorId,
        entryId,
        String(totalAmount), // gross_amount = base + gst
        String(gstAmount), // gst_amount
        String(gstPct), // gst_percentage
        String(baseAmount), // base_amount (without GST)
        String(paidAmount), // paid_amount = gross - TDS
        String(tdsRate),
        String(tdsAmount),
        username
      ]
    );
    
  } else {
    // No TDS - simple payment insertion
    const notes = data.notes ? data.notes + ` (against ledger charge ${entryId})` : `Ledger charge payment ${entryId}`;
    await client.query(
      `INSERT INTO vendor_payments
        (vendor_id, vendor_name, payment_date, amount,
          currency_code, exchange_rate_snapshot, base_currency_amount,
          payment_mode, reference_no, notes, order_type,
          style_order_id, style_order_code, swatch_order_id, swatch_order_code,
          created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11,
              $12, $13, $14, $15, $16)`,
      [
        vendorId, data.vendorName,
        data.paymentDate ? new Date(data.paymentDate) : new Date(),
        allocAmt, 'INR', '1', String(allocAmt),
        data.paymentMode, data.referenceNo || null, notes,
        'ledger_charge',
        null, null, null, null,
        username
      ]
    );
  }
}

async function handleGenericPayment(
  client: any,
  entryType: string,
  entryId: number,
  vendorId: number,
  allocAmt: number,
  data: any,
  username: string
): Promise<void> {
  const notes = data.notes ? data.notes + ` (against ${entryType} ${entryId})` : `Payment for ${entryType} ${entryId}`;
  
  await client.query(
    `INSERT INTO vendor_payments
       (vendor_id, vendor_name, payment_date, amount,
        currency_code, exchange_rate_snapshot, base_currency_amount,
        payment_mode, reference_no, notes, order_type,
        style_order_id, style_order_code, swatch_order_id, swatch_order_code,
        created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7,
             $8, $9, $10, $11,
             $12, $13, $14, $15, $16)`,
    [
      vendorId,
      data.vendorName,
      data.paymentDate ? new Date(data.paymentDate) : new Date(),
      allocAmt,
      'INR',
      '1',
      String(allocAmt),
      data.paymentMode,
      data.referenceNo || null,
      notes,
      data.orderType || 'general',
      data.styleOrderId || null,
      data.styleOrderCode || null,
      data.swatchOrderId || null,
      data.swatchOrderCode || null,
      username
    ]
  );
}

// ============================================================================
// 4. MAIN ROUTE HANDLER
// ============================================================================

router.post("/vendor-ledger/:vendorId/pay", requireAuth, async (req, res) => {
  try {
    const vendorId = parseInt(String(req.params.vendorId));
    const user = (req as { user?: { username?: string } }).user;
    const username = user?.username ?? "system";
    
    // Parse and validate request
    const parsed = insertVendorPaymentSchema.safeParse({ ...req.body, vendorId });
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid data", issues: parsed.error.issues });
    }

    const data = parsed.data;
    const amt = parseFloat(String(data.amount));
    
    // Validate payment
    validatePaymentAmount(amt);
    validatePaymentDate(data.paymentDate);
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Validate outstanding balance
      await validateOutstandingBalance(client, vendorId, amt);

      const allocations = (req.body as any).allocations;

      // Fallback: no allocations → single vendor_payments insert
      if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
        const rows = await db
          .insert(vendorPaymentsTable)
          .values({
            vendorId: data.vendorId,
            vendorName: data.vendorName,
            paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
            amount: data.amount,
            currencyCode: "INR",
            exchangeRateSnapshot: "1",
            baseCurrencyAmount: String(amt),
            paymentMode: data.paymentMode,
            referenceNo: data.referenceNo,
            notes: data.notes,
            orderType: data.orderType,
            styleOrderId: data.styleOrderId,
            styleOrderCode: data.styleOrderCode,
            swatchOrderId: data.swatchOrderId,
            swatchOrderCode: data.swatchOrderCode,
            createdBy: username,
          })
          .returning();
        
        await client.query('COMMIT');
        return res.status(201).json(rows[0]);
      }

      // Validate allocations sum
      validateAllocationsSum(allocations, amt);

      // Process each allocation
      for (const alloc of allocations) {
        const entryType = alloc.entryType;
        const entryId = alloc.entryId;
        const allocAmt = parseFloat(alloc.amount);
        const debit = parseFloat(alloc.debit || "0");
        
        if (allocAmt <= 0) continue;

        // Determine payment type
        const paymentType = (allocAmt >= debit - 0.01) ? 'Full' : 'Partial';

        // Route to appropriate handler
        switch (entryType) {
          case 'outsource':
              await handleOutsourcePayment(client, entryId, vendorId, allocAmt, paymentType, data, alloc, username);
            break;
            
          case 'custom_charge':
              await handleCustomChargePayment(client, entryId, vendorId, allocAmt, paymentType, data, alloc, username);
            break;
            
          case 'purchase_receipt':
            await handlePurchaseReceiptPayment(client, entryId, vendorId, allocAmt, data, alloc, username);
            break;
            
          case 'ledger_charge':
            await handleLedgerChargePayment(client, entryId, vendorId, allocAmt, data, alloc, username); 
            break;
            
          default:
            await handleGenericPayment(client, entryType, entryId, vendorId, allocAmt, data, username);
            break;
        }
      }
      await client.query('COMMIT');
      return res.status(201).json({ message: "Payment recorded successfully", allocations });
      
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(err);
      return res.status(500).json({ error: err.message || "Failed to record payment" });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to record payment" });
  }
});

router.post("/vendor-ledger/:vendorId/charge", requireAuth, async (req, res) => {
  try {
    const vendorId = parseInt(String(req.params.vendorId));
    const user = (req as { user?: { username?: string } }).user;
    const parsed = insertVendorLedgerChargeSchema.safeParse({ ...req.body, vendorId });
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid data", issues: parsed.error.issues });

    const data = parsed.data;
    const chargeAmt = parseFloat(String(data.amount));
    if (!Number.isFinite(chargeAmt) || chargeAmt <= 0)
      return res.status(400).json({ error: "Charge amount must be greater than 0" });
    if (!data.description || !String(data.description).trim())
      return res.status(400).json({ error: "Charge description is required" });
    if (data.chargeDate) {
      const dateStr = String(data.chargeDate).slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);
      if (dateStr > todayStr)
        return res.status(400).json({ error: "Charge date cannot be in the future" });
    }
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

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to add charge" });
  }
});

router.delete("/vendor-ledger/payments/:id", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(String(req.params.id));
    await client.query("BEGIN");
    const del = await client.query(
      `UPDATE vendor_payments
          SET is_deleted = true, deleted_by = $2, deleted_at = NOW()
        WHERE id = $1 AND is_deleted = false
        RETURNING vendor_invoice_ledger_id`,
      [id, (req.user as { email?: string } | undefined)?.email ?? "system"]
    );
    if (!del.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }
    // If the payment was applied to a vendor bill, recompute that bill's
    // paid/pending/status from the remaining non-deleted linked payments.
    const billId = del.rows[0].vendor_invoice_ledger_id as number | null;
    if (billId) {
      await recomputeVendorBillBalances(client, billId);
    }
    await client.query("COMMIT");
    return res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: "Failed to delete payment" });
  } finally {
    client.release();
  }
});

router.delete("/vendor-ledger/charges/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [row] = await db.update(vendorLedgerChargesTable)
      .set({ isDeleted: true, deletedBy: (req.user as any)?.email ?? "system", deletedAt: new Date() })
      .where(and(eq(vendorLedgerChargesTable.id, id), eq(vendorLedgerChargesTable.isDeleted, false)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete charge" });
  }
});

export default router;
