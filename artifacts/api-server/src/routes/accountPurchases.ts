import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { AuthRequest } from "../middlewares/requireAuth";
import { recomputeVendorBillBalances } from "../lib/vendorBillBalances";
import { convertPaymentToBillCcy, isOverpayment } from "../lib/procurementMath";
import { checkPermission } from "../middlewares/checkPermission";
import { ACCOUNTS_PURCHASES } from "../constants/permissions";

const router = Router();

/* ── helpers ────────────────────────────────────────────── */
function df(col: string, from?: string, to?: string) {
  if (!from && !to) return "";
  const lo = from ? `'${from}'` : "'1900-01-01'";
  const hi = to   ? `'${to}'`   : "'2999-12-31'";
  return `AND ${col}::date BETWEEN ${lo} AND ${hi}`;
}

/* ══════════════════════════════════════════════════════════
   PURCHASE ORDERS — financial summary view (legacy)
══════════════════════════════════════════════════════════ */
router.get("/purchase-orders", requireAuth, async (req, res) => {
  try {
    const { search, status, ref_type, page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;
    if (search) { conditions.push(`(po.po_number ILIKE $${p} OR po.vendor_name ILIKE $${p})`); params.push(`%${search}%`); p++; }
    if (status)   { conditions.push(`po.status = $${p}`);         params.push(status); p++; }
    if (ref_type) { conditions.push(`po.reference_type = $${p}`); params.push(ref_type); p++; }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT po.id, po.po_number, po.vendor_id, po.vendor_name, po.reference_type, po.reference_id, po.status,
              po.po_date, po.created_by, po.created_at,
              COALESCE(SUM(poi.ordered_quantity * poi.unit_price), 0)::numeric(18,2) AS po_amount,
              COALESCE(SUM(poi.ordered_quantity), 0)::numeric(14,3) AS total_ordered_qty,
              COALESCE(SUM(poi.received_quantity), 0)::numeric(14,3) AS total_received_qty,
              COUNT(poi.id)::int AS item_count,
              sw.order_code AS swatch_order_code, st.order_code AS style_order_code
       FROM purchase_orders po
       LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
       LEFT JOIN swatch_orders sw ON sw.id = po.swatch_order_id
       LEFT JOIN style_orders  st ON st.id = po.style_order_id
       ${where}
       GROUP BY po.id, sw.order_code, st.order_code
       ORDER BY po.created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, parseInt(limit), offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM purchase_orders po ${where}`, params);
    res.json({ data: rows, total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   VENDOR BILLS (legacy)
══════════════════════════════════════════════════════════ */
router.get("/vendor-bills", requireAuth, async (req, res) => {
  try {
    const { search, status, vendor_id, page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;
    if (search)    { conditions.push(`(vil.vendor_invoice_number ILIKE $${p} OR vil.vendor_name ILIKE $${p})`); params.push(`%${search}%`); p++; }
    if (status)    { conditions.push(`vil.status = $${p}`);    params.push(status); p++; }
    if (vendor_id) { conditions.push(`vil.vendor_id = $${p}`); params.push(vendor_id); p++; }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT vil.id, vil.vendor_id, vil.vendor_name, vil.purchase_receipt_id, vil.pr_number,
              vil.vendor_invoice_number, vil.vendor_invoice_date, vil.vendor_invoice_amount,
              vil.paid_amount, vil.pending_amount, vil.status, vil.notes, vil.created_at,
              po.po_number AS linked_po_number
       FROM vendor_invoice_ledger vil
       LEFT JOIN purchase_receipts pr ON pr.id = vil.purchase_receipt_id
       LEFT JOIN purchase_orders   po ON po.id = pr.po_id
       ${where} ORDER BY vil.created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, parseInt(limit), offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM vendor_invoice_ledger vil ${where}`, params);
    res.json({ data: rows, total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* Record payment on a vendor bill (legacy) */
router.post("/vendor-bills/:id/payment", requireAuth, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = parseInt(String(req.params.id));
    const { payment_amount, payment_date, payment_type, transaction_reference, remarks, currency_code, exchange_rate_snapshot } = req.body as any;
    const amt = parseFloat(payment_amount ?? "0");                          // pay currency
    if (!Number.isFinite(amt) || amt <= 0) throw new Error("Invalid payment amount");

    // No future-dated payments — compare YYYY-MM-DD strings to avoid timezone drift
    if (payment_date) {
      const dateStr = String(payment_date).slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);
      if (dateStr > todayStr) throw new Error("Payment date cannot be in the future");
    }

    const { rows } = await client.query(`SELECT * FROM vendor_invoice_ledger WHERE id = $1 FOR UPDATE`, [id]);
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Bill not found" });
    }
    const bill = rows[0];
    if (bill.status === "Paid") throw new Error("Cannot record payment: bill is already fully paid");
    if (bill.status === "Cancelled") throw new Error("Cannot record payment: bill has been cancelled");
    // Convert the payment into the bill's currency via the INR anchor and guard against overpayment.
    const payRate      = parseFloat(String(exchange_rate_snapshot ?? "1")) || 1;  // pay ccy -> INR
    const baseAmt      = amt * payRate;                                           // INR anchor
    const billRate     = parseFloat(bill.exchange_rate_snapshot ?? "1") || 1;     // bill ccy -> INR
    const amtInBillCcy = convertPaymentToBillCcy(amt, payRate, billRate);         // bill currency
    const prevPaid     = parseFloat(bill.paid_amount ?? "0");                     // bill currency
    const billTotal    = parseFloat(bill.vendor_invoice_amount);                  // bill currency
    if (isOverpayment(amtInBillCcy, billTotal, prevPaid)) throw new Error("Payment exceeds pending balance");
    await client.query(
      `INSERT INTO vendor_payments (vendor_id, vendor_name, payment_date, amount, currency_code, exchange_rate_snapshot, base_currency_amount, payment_mode, reference_no, notes, order_type, vendor_invoice_ledger_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'general',$11,$12)`,
      [bill.vendor_id, bill.vendor_name, payment_date || new Date().toISOString(), String(amt),
       String(currency_code ?? "INR"), String(payRate), baseAmt.toFixed(2),
       payment_type || "Bank Transfer", transaction_reference || "", remarks || "", id, req.user?.email ?? ""]
    );
    const bal = await recomputeVendorBillBalances(client, id);
    await client.query("COMMIT");
    return res.json({ message: "Payment recorded", paid: bal?.paidAmount ?? 0, pending: bal?.pendingAmount ?? 0, status: bal?.status ?? "Partially Paid" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    return res.status(400).json({ error: err.message });
  } finally { client.release(); }
});

/* ══════════════════════════════════════════════════════════
   VENDOR BILL STATUS CHANGE (e.g. cancel)
══════════════════════════════════════════════════════════ */
router.patch("/vendor-bills/:id/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const { status } = req.body as { status?: string };

    const allowed = ["Unpaid", "Partially Paid", "Paid", "Cancelled"];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed values: ${allowed.join(", ")}` });
    }

    const { rows: billRows } = await pool.query(
      `SELECT id, status FROM vendor_invoice_ledger WHERE id = $1 AND is_deleted = false`,
      [id]
    );
    if (!billRows.length) return res.status(404).json({ error: "Bill not found" });

    if (status === "Cancelled") {
      const { rows: payRows } = await pool.query(
        `SELECT COUNT(*) AS cnt FROM vendor_payments WHERE vendor_invoice_ledger_id = $1 AND is_deleted = false`,
        [id]
      );
      const payCount = parseInt(payRows[0]?.cnt ?? "0");
      if (payCount > 0) {
        return res.status(400).json({
          error: "Cannot cancel bill: payments have been recorded against it. Reverse all payments before cancelling.",
        });
      }
    }

    const { rows: updated } = await pool.query(
      `UPDATE vendor_invoice_ledger SET status = $1, updated_at = NOW() WHERE id = $2 AND is_deleted = false RETURNING *`,
      [status, id]
    );
    return res.json({ data: updated[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* Legacy summary */
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const { from_date, to_date, vendor_id } = req.query as Record<string, string>;
    const poDF  = df("po.po_date",       from_date, to_date);
    const prDF  = df("pr.received_date", from_date, to_date);
    const bilDF = df("vil.created_at",   from_date, to_date);
    const payDF = df("vp.payment_date",  from_date, to_date);
    const vPO  = vendor_id ? `AND po.vendor_id  = ${parseInt(vendor_id)}` : "";
    const vPR  = vendor_id ? `AND pr.vendor_id  = ${parseInt(vendor_id)}` : "";
    const vBil = vendor_id ? `AND vil.vendor_id = ${parseInt(vendor_id)}` : "";
    const vPay = vendor_id ? `AND vp.vendor_id  = ${parseInt(vendor_id)}` : "";
    const [poRes, prRes, bilRes, payRes, pendRes] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT po.id) AS total_count,
        COALESCE(SUM(poi.ordered_quantity * poi.unit_price),0)::numeric(18,2) AS total_amount,
        COALESCE(SUM(CASE WHEN po.status NOT IN ('Closed','Cancelled') THEN poi.ordered_quantity * poi.unit_price ELSE 0 END),0)::numeric(18,2) AS pending_amount
        FROM purchase_orders po LEFT JOIN purchase_order_items poi ON poi.po_id = po.id WHERE 1=1 ${poDF} ${vPO}`),
      pool.query(`SELECT COUNT(DISTINCT pr.id) AS total_count,
        COALESCE(SUM(pri.quantity * pri.unit_price),0)::numeric(18,2) AS received_value
        FROM purchase_receipts pr LEFT JOIN purchase_receipt_items pri ON pri.pr_id = pr.id WHERE 1=1 ${prDF} ${vPR}`),
      pool.query(`SELECT COUNT(*) AS total_count,
        COALESCE(SUM(vil.base_currency_amount),0)::numeric(18,2) AS total_amount,
        COALESCE(SUM(vil.paid_amount * vil.exchange_rate_snapshot),0)::numeric(18,2) AS paid_amount,
        COALESCE(SUM(vil.pending_amount * vil.exchange_rate_snapshot),0)::numeric(18,2) AS pending_amount
        FROM vendor_invoice_ledger vil WHERE 1=1 ${bilDF} ${vBil}`),
      pool.query(`SELECT COUNT(*) AS total_count,
        COALESCE(SUM(vp.base_currency_amount::numeric),0)::numeric(18,2) AS total_paid
        FROM vendor_payments vp WHERE 1=1 ${payDF} ${vPay}`),
      pool.query(`SELECT COALESCE(SUM(vil.pending_amount * vil.exchange_rate_snapshot),0)::numeric(18,2) AS bill_pending
        FROM vendor_invoice_ledger vil WHERE vil.status != 'Paid' ${bilDF} ${vBil}`),
    ]);
    res.json({ data: {
      purchaseOrders:  { totalCount: parseInt(poRes.rows[0].total_count), totalAmount: parseFloat(poRes.rows[0].total_amount), pendingAmount: parseFloat(poRes.rows[0].pending_amount) },
      purchaseReceipts:{ totalCount: parseInt(prRes.rows[0].total_count), receivedValue: parseFloat(prRes.rows[0].received_value) },
      vendorBills:     { totalCount: parseInt(bilRes.rows[0].total_count), totalAmount: parseFloat(bilRes.rows[0].total_amount), paidAmount: parseFloat(bilRes.rows[0].paid_amount), pendingAmount: parseFloat(bilRes.rows[0].pending_amount) },
      paidToVendors:   { totalCount: parseInt(payRes.rows[0].total_count), totalPaid: parseFloat(payRes.rows[0].total_paid) },
      pendingPayables: { totalPending: parseFloat(pendRes.rows[0].bill_pending) },
    }});
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   UNIFIED PAYABLES — KPI SUMMARY
══════════════════════════════════════════════════════════ */
router.get("/unified-summary", requireAuth, 
  checkPermission({ any: [ACCOUNTS_PURCHASES.VIEW] }),
  async (req, res) => {
  try {
    const { from_date, to_date, vendor_id } = req.query as Record<string, string>;
    const vid = vendor_id ? parseInt(vendor_id) : null;

    const [poR, prBillsR, outsourceR, otherR, artisanR, shippingR, paidR, pendR] = await Promise.all([

      /* Purchase Orders */
      pool.query(`SELECT COALESCE(SUM(poi.ordered_quantity * poi.unit_price),0)::numeric(18,2) AS amt
        FROM purchase_orders po LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
        WHERE 1=1 ${df("po.po_date", from_date, to_date)} ${vid ? `AND po.vendor_id=${vid}` : ""}`),

      /* PR Vendor Bills (INR anchor for cross-currency consistency) */
      pool.query(`SELECT COALESCE(SUM(base_currency_amount),0)::numeric(18,2) AS amt,
        COALESCE(SUM(paid_amount * exchange_rate_snapshot),0)::numeric(18,2) AS paid,
        COALESCE(SUM(pending_amount * exchange_rate_snapshot),0)::numeric(18,2) AS pending
        FROM vendor_invoice_ledger
        WHERE 1=1 ${df("vendor_invoice_date", from_date, to_date)} ${vid ? `AND vendor_id=${vid}` : ""}`),

      /* Outsource Jobs (total_cost is text in DB; paid summed in INR anchor) */
      pool.query(`SELECT COALESCE(SUM(oj.total_cost::numeric),0)::numeric(18,2) AS amt,
        COALESCE(SUM(COALESCE(cp.paid,0)),0)::numeric(18,2) AS paid
        FROM outsource_jobs oj
        LEFT JOIN (SELECT reference_id, SUM(base_currency_amount) AS paid FROM costing_payments
          WHERE reference_type='outsource_job' GROUP BY reference_id) cp ON cp.reference_id = oj.id
        WHERE 1=1 ${df("oj.issue_date", from_date, to_date)} ${vid ? `AND oj.vendor_id=${vid}` : ""}`),

      /* Other Expenses */
      pool.query(`SELECT COALESCE(SUM(amount),0)::numeric(18,2) AS amt,
        COALESCE(SUM(COALESCE(paid_amount,0)),0)::numeric(18,2) AS paid
        FROM other_expenses
        WHERE 1=1 ${df("expense_date", from_date, to_date)} ${vid ? `AND vendor_id=${vid}` : ""}`),

      /* Artisan Timesheets (total_rate is text in DB) */
      pool.query(`SELECT COALESCE(SUM(total_rate::numeric),0)::numeric(18,2) AS amt
        FROM artisan_timesheets
        WHERE 1=1 ${df("start_date", from_date, to_date)}`),

      /* Shipping */
      pool.query(`SELECT COALESCE(SUM(final_shipping_amount),0)::numeric(18,2) AS amt
        FROM order_shipping_details
        WHERE final_shipping_amount IS NOT NULL ${df("shipment_date", from_date, to_date)}
        ${vid ? `AND shipping_vendor_id=${vid}` : ""}`),

      /* Total paid to vendors (INR anchor) */
      pool.query(`SELECT COALESCE(SUM(base_currency_amount::numeric),0)::numeric(18,2) AS paid
        FROM vendor_payments
        WHERE 1=1 ${df("payment_date", from_date, to_date)} ${vid ? `AND vendor_id=${vid}` : ""}`),

      /* Total pending (vendor bills only — authoritative; INR anchor) */
      pool.query(`SELECT COALESCE(SUM(pending_amount * exchange_rate_snapshot),0)::numeric(18,2) AS pending
        FROM vendor_invoice_ledger
        WHERE status != 'Paid' ${df("vendor_invoice_date", from_date, to_date)} ${vid ? `AND vendor_id=${vid}` : ""}`),
    ]);

    const outsourced  = parseFloat(outsourceR.rows[0].amt)  || 0;
    const outsourcePaid = parseFloat(outsourceR.rows[0].paid) || 0;

    res.json({
      poAmount:         parseFloat(poR.rows[0].amt)           || 0,
      prBills:          parseFloat(prBillsR.rows[0].amt)       || 0,
      prBillsPaid:      parseFloat(prBillsR.rows[0].paid)      || 0,
      prBillsPending:   parseFloat(prBillsR.rows[0].pending)   || 0,
      outsourceAmount:  outsourced,
      outsourcePaid,
      outsourcePending: Math.max(0, outsourced - outsourcePaid),
      otherExpenses:    parseFloat(otherR.rows[0].amt)         || 0,
      otherPaid:        parseFloat(otherR.rows[0].paid)        || 0,
      artisanCosts:     parseFloat(artisanR.rows[0].amt)       || 0,
      shippingCosts:    parseFloat(shippingR.rows[0].amt)      || 0,
      totalPaidVendors: parseFloat(paidR.rows[0].paid)         || 0,
      pendingPayables:  parseFloat(pendR.rows[0].pending)      || 0,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   UNIFIED PAYABLES — LIABILITY TABLE
══════════════════════════════════════════════════════════ */
router.get("/unified-liabilities", requireAuth,
  checkPermission({ any: [ACCOUNTS_PURCHASES.VIEW] }),
  async (req, res) => {
  try {
    const { from_date, to_date, vendor_id, ref_type, status, department, search, ref_no, page = "1", limit = "50" } = req.query as Record<string, string>;
    const vid     = vendor_id ? parseInt(vendor_id) : null;
    const offset  = (parseInt(page) - 1) * parseInt(limit);
    const pLimit  = parseInt(limit);

    const vf = (col: string) => vid ? `AND ${col} = ${vid}` : "";

    const statusClause = status && status !== "All"
      ? `AND status = '${status.replace(/'/g, "''")}'`
      : "";

    const refTypeClause = ref_type
      ? `AND ref_type = '${ref_type.replace(/'/g, "''")}'`
      : "";

    const deptClause = department
      ? `AND department = '${department.replace(/'/g, "''")}'`
      : "";

    const searchClause = search
      ? `AND (LOWER(vendor_name) LIKE LOWER('%${search.replace(/'/g, "''")}%') OR LOWER(ref_number) LIKE LOWER('%${search.replace(/'/g, "''")}%'))`
      : "";

    const refNoClause = ref_no
      ? `AND LOWER(ref_number) LIKE LOWER('%${ref_no.replace(/'/g, "''")}%')`
      : "";

     const { rows } = await pool.query(`
      WITH tds_agg AS (
        SELECT
          base_document_type::text AS bdt,
          base_document_id         AS bdi,
          SUM(tds_amount)          AS tds_amount
        FROM payment_tds
        WHERE is_deleted = false
          AND base_document_type IS NOT NULL
          AND base_document_id   IS NOT NULL
          AND status NOT IN ('REVERSED', 'NOT_APPLICABLE')
        GROUP BY base_document_type, base_document_id
      ),
      all_liabilities AS (
        /* 1. Vendor Invoice Bills (no TDS yet — dev stage) */
        SELECT
          'Vendor Invoice'::text              AS ref_type,
          vil.id::text                        AS source_id,
          COALESCE(vil.vendor_invoice_date, vil.created_at::date)::text AS date,
          COALESCE(vil.linked_po_number, vil.pr_number, '')  AS ref_number,
          COALESCE(vil.vendor_name, '—')      AS vendor_name,
          vil.vendor_id::text                 AS vendor_id_text,
          'Vendor Invoice'                    AS department,
          vil.vendor_invoice_amount::numeric  AS amount,
          vil.paid_amount::numeric            AS paid_amount,
          vil.pending_amount::numeric         AS pending_amount,
          vil.status                          AS status,
          COALESCE(vil.currency_code, 'INR')::text AS currency_code,
          COALESCE(vil.exchange_rate_snapshot, 1)::numeric AS exchange_rate_snapshot,
          0::numeric                          AS tds_amount,
          vil.paid_amount::numeric            AS net_paid_amount
        FROM vendor_invoice_ledger vil
        WHERE 1=1
          ${df("COALESCE(vil.vendor_invoice_date, vil.created_at::date)", from_date, to_date)}
          ${vf("vil.vendor_id")}

        UNION ALL

        /* 2. Outsource Jobs (base + GST from header) — TDS via outsource_job */
        SELECT
          'Costing Outsource'::text           AS ref_type,
          oj.id::text                         AS source_id,
          oj.issue_date                       AS date,
          COALESCE(sw.order_code, st.order_code, 'OJ-' || oj.id::text) AS ref_number,
          COALESCE(oj.vendor_name, '—')       AS vendor_name,
          oj.vendor_id::text                  AS vendor_id_text,
          'Costing Outsource'                 AS department,
          (oj.total_cost::numeric * (1 + COALESCE(oj.gst_percentage::numeric, 0) / 100)) AS amount,
          COALESCE(cp.paid, 0)                AS paid_amount,
          GREATEST(
            0,
            (oj.total_cost::numeric * (1 + COALESCE(oj.gst_percentage::numeric, 0) / 100))
              - COALESCE(cp.paid, 0)
          )                                   AS pending_amount,
          CASE
            WHEN COALESCE(cp.paid, 0) >= (oj.total_cost::numeric * (1 + COALESCE(oj.gst_percentage::numeric, 0) / 100)) THEN 'Paid'
            WHEN COALESCE(cp.paid, 0) > 0 THEN 'Partially Paid'
            ELSE 'Unpaid'
          END AS status,
          'INR'::text AS currency_code,
          1::numeric  AS exchange_rate_snapshot,
          COALESCE(t.tds_amount, 0)::numeric  AS tds_amount,
          (COALESCE(cp.paid, 0) - COALESCE(t.tds_amount, 0))::numeric AS net_paid_amount
        FROM outsource_jobs oj
        LEFT JOIN swatch_orders sw ON sw.id = oj.swatch_order_id
        LEFT JOIN style_orders  st ON st.id = oj.style_order_id
        LEFT JOIN (
          SELECT reference_id, SUM(base_currency_amount) AS paid
          FROM costing_payments
          WHERE reference_type = 'outsource_job'
            AND is_deleted = false
          GROUP BY reference_id
        ) cp ON cp.reference_id = oj.id
        LEFT JOIN tds_agg t
          ON t.bdt = 'outsource_job' AND t.bdi = oj.id
        WHERE oj.is_deleted = false
          ${df("oj.issue_date", from_date, to_date)}
          ${vf("oj.vendor_id")}

        UNION ALL

        /* 3. Other Expenses — amount is BASE; GST drives the gross */
        SELECT
          'Other Expense'::text               AS ref_type,
          oe.expense_id::text                 AS source_id,
          oe.expense_date                     AS date,
          oe.expense_number                   AS ref_number,
          COALESCE(oe.vendor_name, 'N/A')     AS vendor_name,
          oe.vendor_id::text                  AS vendor_id_text,
          oe.expense_category                 AS department,
          (oe.amount::numeric * (1 + COALESCE(oe.gst_percentage::numeric, 0) / 100)) AS amount,
          COALESCE(oe.paid_amount, 0)::numeric AS paid_amount,
          GREATEST(
            0,
            (oe.amount::numeric * (1 + COALESCE(oe.gst_percentage::numeric, 0) / 100))
              - COALESCE(oe.paid_amount, 0)::numeric
          )                                   AS pending_amount,
          CASE
            WHEN oe.payment_status = 'Paid' THEN 'Paid'
            WHEN COALESCE(oe.paid_amount, 0) > 0 THEN 'Partially Paid'
            ELSE 'Unpaid'
          END AS status,
          'INR'::text AS currency_code,
          1::numeric  AS exchange_rate_snapshot,
          COALESCE(t.tds_amount, 0)::numeric  AS tds_amount,
          GREATEST(
            0,
            COALESCE(oe.paid_amount, 0) - COALESCE(t.tds_amount, 0)
          )::numeric                          AS net_paid_amount
        FROM other_expenses oe
        LEFT JOIN vendor_ledger_charges vlc
          ON vlc.order_type = 'other_expenses'
        AND vlc.order_id   = oe.expense_id
        AND vlc.is_deleted = false
        LEFT JOIN tds_agg t
          ON t.bdt = 'ledger_charge'
        AND t.bdi = vlc.id
        WHERE oe.is_deleted = false
          ${df("oe.expense_date", from_date, to_date)}
          ${vid ? `AND oe.vendor_id = ${vid}` : ""}

        UNION ALL

        /* 5. Shipping (no TDS) */
        SELECT
          'Shipping'::text                    AS ref_type,
          osd.id::text                        AS source_id,
          osd.shipment_date::text             AS date,
          COALESCE(osd.tracking_number, 'SHP-' || osd.id::text) AS ref_number,
          COALESCE(sv.vendor_name, 'Unknown Shipper') AS vendor_name,
          osd.shipping_vendor_id::text        AS vendor_id_text,
          'Shipping Vendor'                   AS department,
          COALESCE(osd.final_shipping_amount, 0)::numeric AS amount,
          0::numeric                          AS paid_amount,
          COALESCE(osd.final_shipping_amount, 0)::numeric AS pending_amount,
          'Pending'                           AS status,
          'INR'::text AS currency_code,
          1::numeric  AS exchange_rate_snapshot,
          0::numeric                          AS tds_amount,
          0::numeric                          AS net_paid_amount
        FROM order_shipping_details osd
        LEFT JOIN shipping_vendors sv ON sv.id = osd.shipping_vendor_id
        WHERE osd.final_shipping_amount IS NOT NULL AND osd.final_shipping_amount > 0
          ${df("osd.shipment_date", from_date, to_date)}
          ${vid ? `AND osd.shipping_vendor_id = ${vid}` : ""}

        UNION ALL

        /* 6. Custom Charges (base + GST from header) — TDS via custom_charge */
        SELECT
          'Custom Charge'::text               AS ref_type,
          cc.id::text                         AS source_id,
          cc.created_at::text                 AS date,
          COALESCE(sw.order_code, st.order_code, 'CC-' || cc.id::text) AS ref_number,
          cc.vendor_name            AS vendor_name,
          cc.vendor_id::text                  AS vendor_id_text,
          'Costing Custom Charge'             AS department,
          (cc.total_amount::numeric * (1 + COALESCE(cc.gst_percentage::numeric, 0) / 100)) AS amount,
          COALESCE(cp.paid, 0)                AS paid_amount,
          GREATEST(
            0,
            (cc.total_amount::numeric * (1 + COALESCE(cc.gst_percentage::numeric, 0) / 100))
              - COALESCE(cp.paid, 0)
          )                                   AS pending_amount,
          CASE
            WHEN COALESCE(cp.paid, 0) >= (cc.total_amount::numeric * (1 + COALESCE(cc.gst_percentage::numeric, 0) / 100)) THEN 'Paid'
            WHEN COALESCE(cp.paid, 0) > 0 THEN 'Partially Paid'
            ELSE 'Unpaid'
          END AS status,
          'INR'::text AS currency_code,
          1::numeric  AS exchange_rate_snapshot,
          COALESCE(t.tds_amount, 0)::numeric  AS tds_amount,
          (COALESCE(cp.paid, 0) - COALESCE(t.tds_amount, 0))::numeric AS net_paid_amount
        FROM custom_charges cc
        LEFT JOIN swatch_orders sw ON sw.id = cc.swatch_order_id
        LEFT JOIN style_orders  st ON st.id = cc.style_order_id
        LEFT JOIN (
          SELECT reference_id, SUM(base_currency_amount) AS paid
          FROM costing_payments
          WHERE reference_type = 'custom_charge'
            AND is_deleted = false
          GROUP BY reference_id
        ) cp ON cp.reference_id = cc.id
        LEFT JOIN tds_agg t
          ON t.bdt = 'custom_charge' AND t.bdi = cc.id
        WHERE cc.is_deleted = false
          ${df("cc.created_at", from_date, to_date)}
          ${vf("cc.vendor_id")}

        UNION ALL

        /* 7. Purchase Receipts — TDS via pr */
        SELECT
          'Purchase Receipt'::text            AS ref_type,
          pr.id::text                         AS source_id,
          COALESCE(pr.received_date, pr.created_at)::text AS date,
          pr.pr_number                        AS ref_number,
          COALESCE(pr.vendor_name, '—')       AS vendor_name,
          COALESCE(pr.vendor_id, po.vendor_id)::text AS vendor_id_text,
          'Purchase Receipt'                  AS department,
          COALESCE(
            pr.vendor_invoice_amount::numeric,
            pr.total_amount_with_gst::numeric,
            items.total_with_gst,
            (pr.received_qty::numeric * pr.actual_price::numeric),
            0
          )                                   AS amount,
          COALESCE(pp.paid, 0)                AS paid_amount,
          GREATEST(
            0,
            COALESCE(
              pr.vendor_invoice_amount::numeric,
              pr.total_amount_with_gst::numeric,
              items.total_with_gst,
              (pr.received_qty::numeric * pr.actual_price::numeric),
              0
            ) - COALESCE(pp.paid, 0)
          )                                   AS pending_amount,
          CASE
            WHEN COALESCE(pp.paid, 0) >= COALESCE(
              pr.vendor_invoice_amount::numeric,
              pr.total_amount_with_gst::numeric,
              items.total_with_gst,
              (pr.received_qty::numeric * pr.actual_price::numeric),
              0
            ) THEN 'Paid'
            WHEN COALESCE(pp.paid, 0) > 0 THEN 'Partially Paid'
            ELSE 'Unpaid'
          END AS status,
          'INR'::text AS currency_code,
          1::numeric  AS exchange_rate_snapshot,
          COALESCE(t.tds_amount, 0)::numeric  AS tds_amount,
          (COALESCE(pp.paid, 0) - COALESCE(t.tds_amount, 0))::numeric AS net_paid_amount
        FROM purchase_receipts pr
        LEFT JOIN purchase_orders po ON pr.po_id = po.id AND po.is_deleted = false
        LEFT JOIN (
          SELECT
            pr_id,
            SUM(quantity * unit_price * (1 + COALESCE(gst_percentage, 0) / 100)) AS total_with_gst
          FROM purchase_receipt_items
          WHERE is_deleted = false
          GROUP BY pr_id
        ) items ON items.pr_id = pr.id
        LEFT JOIN (
          SELECT pr_id, SUM(base_currency_amount) AS paid
          FROM pr_payments
          WHERE is_deleted = false
          GROUP BY pr_id
        ) pp ON pp.pr_id = pr.id
        LEFT JOIN tds_agg t
          ON t.bdt = 'pr' AND t.bdi = pr.id
        WHERE pr.is_deleted = false
          ${df("COALESCE(pr.received_date, pr.created_at)", from_date, to_date)}
          ${vid ? `AND COALESCE(pr.vendor_id, po.vendor_id) = ${vid}` : ""}

        UNION ALL

        /* 8. Vendor Challans (Verified only) — TDS via vendor_challan */
        SELECT
          'Vendor Challan'::text              AS ref_type,
          vc.id::text                         AS source_id,
          COALESCE(vc.challan_date::timestamptz, vc.created_at)::text AS date,
          vc.challan_number                   AS ref_number,
          COALESCE(vc.vendor_name, '—')       AS vendor_name,
          vc.vendor_id::text                  AS vendor_id_text,
          'Vendor Challan'                    AS department,
          COALESCE(items.amount, 0)           AS amount,
          COALESCE(vp.paid, 0)                AS paid_amount,
          GREATEST(0, COALESCE(items.amount, 0) - COALESCE(vp.paid, 0)) AS pending_amount,
          CASE
            WHEN COALESCE(vp.paid, 0) >= COALESCE(items.amount, 0) THEN 'Paid'
            WHEN COALESCE(vp.paid, 0) > 0 THEN 'Partially Paid'
            ELSE 'Unpaid'
          END AS status,
          'INR'::text AS currency_code,
          1::numeric  AS exchange_rate_snapshot,
          COALESCE(t.tds_amount, 0)::numeric  AS tds_amount,
          (COALESCE(vp.paid, 0) - COALESCE(t.tds_amount, 0))::numeric AS net_paid_amount
        FROM vendor_challans vc
        LEFT JOIN (
          SELECT
            vendor_challan_id,
            SUM(amount * (1 + COALESCE(gst_percentage, 0) / 100)) AS amount
          FROM vendor_challan_items
          WHERE is_deleted = false
          GROUP BY vendor_challan_id
        ) items ON items.vendor_challan_id = vc.id
        LEFT JOIN (
          SELECT reference_id, SUM(base_currency_amount) AS paid
          FROM vendor_payments
          WHERE reference_type = 'vendor_challan'
            AND is_deleted = false
          GROUP BY reference_id
        ) vp ON vp.reference_id = vc.id
        LEFT JOIN tds_agg t
          ON t.bdt = 'vendor_challan' AND t.bdi = vc.id
        WHERE vc.is_deleted = false
          AND vc.status = 'Verified'
          ${df("COALESCE(vc.challan_date::timestamptz, vc.created_at)", from_date, to_date)}
          ${vf("vc.vendor_id")}

        UNION ALL

/* 9. Artwork — Swatch (Outsource only) — TDS via artwork_swatch */
SELECT
  'Artwork (Swatch)'::text            AS ref_type,
  a.id::text                          AS source_id,
  a.created_at::text                  AS date,
  COALESCE(a.artwork_code, 'ART-' || a.id::text) AS ref_number,
  COALESCE(a.outsource_vendor_name, '—') AS vendor_name,
  a.outsource_vendor_id::text         AS vendor_id_text,
  'Artwork (Swatch)'                  AS department,
  (
    COALESCE(NULLIF(a.total_cost, '')::numeric, 0)
    * (1 + COALESCE(a.gst_percentage::numeric, 0) / 100)
  )                                   AS amount,
  COALESCE(cp.paid, 0)                AS paid_amount,
  GREATEST(
    0,
    (
      COALESCE(NULLIF(a.total_cost, '')::numeric, 0)
      * (1 + COALESCE(a.gst_percentage::numeric, 0) / 100)
    ) - COALESCE(cp.paid, 0)
  )                                   AS pending_amount,
  CASE
    WHEN COALESCE(cp.paid, 0) >=
         (
           COALESCE(NULLIF(a.total_cost, '')::numeric, 0)
           * (1 + COALESCE(a.gst_percentage::numeric, 0) / 100)
         ) THEN 'Paid'
    WHEN COALESCE(cp.paid, 0) > 0 THEN 'Partially Paid'
    ELSE 'Unpaid'
  END AS status,
  'INR'::text AS currency_code,
  1::numeric  AS exchange_rate_snapshot,
  COALESCE(t.tds_amount, 0)::numeric  AS tds_amount,
  (COALESCE(cp.paid, 0) - COALESCE(t.tds_amount, 0))::numeric AS net_paid_amount
FROM artworks a
LEFT JOIN (
  SELECT reference_id, SUM(base_currency_amount) AS paid
  FROM costing_payments
  WHERE reference_type = 'artwork_swatch'
    AND is_deleted = false
  GROUP BY reference_id
) cp ON cp.reference_id = a.id
LEFT JOIN tds_agg t
  ON t.bdt = 'artwork_swatch' AND t.bdi = a.id
WHERE a.outsource_vendor_id IS NOT NULL
  AND a.outsource_vendor_id <> ''
  AND a.outsource_vendor_name IS NOT NULL
  AND a.outsource_vendor_name <> ''
  AND a.is_deleted = false
  AND a.artwork_created = 'Outsource'
  AND a.total_cost IS NOT NULL
  AND a.total_cost <> ''
  ${df("a.created_at", from_date, to_date)}
  ${vid ? `AND a.outsource_vendor_id ~ '^[0-9]+$' AND a.outsource_vendor_id::integer = ${vid}` : ""}
        UNION ALL

      

/* 10. Artwork — Style (Outsource only) — TDS via artwork_style */
SELECT
  'Artwork (Style)'::text             AS ref_type,
  soa.id::text                        AS source_id,
  soa.created_at::text                AS date,
  COALESCE(soa.artwork_code, 'ART-' || soa.id::text) AS ref_number,
  COALESCE(soa.outsource_vendor_name, '—') AS vendor_name,
  soa.outsource_vendor_id::text       AS vendor_id_text,
  'Artwork (Style)'                   AS department,
  (
    COALESCE(NULLIF(soa.total_cost, '')::numeric, 0)
    * (1 + COALESCE(soa.gst_percentage::numeric, 0) / 100)
  )                                   AS amount,
  COALESCE(cp.paid, 0)                AS paid_amount,
  GREATEST(
    0,
    (
      COALESCE(NULLIF(soa.total_cost, '')::numeric, 0)
      * (1 + COALESCE(soa.gst_percentage::numeric, 0) / 100)
    ) - COALESCE(cp.paid, 0)
  )                                   AS pending_amount,
  CASE
    WHEN COALESCE(cp.paid, 0) >=
         (
           COALESCE(NULLIF(soa.total_cost, '')::numeric, 0)
           * (1 + COALESCE(soa.gst_percentage::numeric, 0) / 100)
         ) THEN 'Paid'
    WHEN COALESCE(cp.paid, 0) > 0 THEN 'Partially Paid'
    ELSE 'Unpaid'
  END AS status,
  'INR'::text AS currency_code,
  1::numeric  AS exchange_rate_snapshot,
  COALESCE(t.tds_amount, 0)::numeric  AS tds_amount,
  (COALESCE(cp.paid, 0) - COALESCE(t.tds_amount, 0))::numeric AS net_paid_amount
FROM style_order_artworks soa
LEFT JOIN (
  SELECT reference_id, SUM(base_currency_amount) AS paid
  FROM costing_payments
  WHERE reference_type = 'artwork_style'
    AND is_deleted = false
  GROUP BY reference_id
) cp ON cp.reference_id = soa.id
LEFT JOIN tds_agg t
  ON t.bdt = 'artwork_style' AND t.bdi = soa.id
WHERE soa.outsource_vendor_id IS NOT NULL
  AND soa.outsource_vendor_id <> ''
  AND soa.outsource_vendor_name IS NOT NULL
  AND soa.outsource_vendor_name <> ''
  AND soa.is_deleted = false
  AND soa.artwork_created = 'Outsource'
  AND soa.total_cost IS NOT NULL
  AND soa.total_cost <> ''
  ${df("soa.created_at", from_date, to_date)}
  ${vid ? `AND soa.outsource_vendor_id ~ '^[0-9]+$' AND soa.outsource_vendor_id::integer = ${vid}` : ""}
UNION ALL

  /* 11. Toile Work — TDS via toile */
SELECT
  'Toile'::text                       AS ref_type,
  soa.id::text                        AS source_id,
  soa.created_at::text                AS date,
  COALESCE(soa.artwork_code, 'TOI-' || soa.id::text) AS ref_number,
  COALESCE(soa.toile_vendor_name, '—') AS vendor_name,
  soa.toile_vendor_id::text           AS vendor_id_text,
  'Toile Work'                        AS department,
  (
    COALESCE(NULLIF(soa.toile_making_cost,''), NULLIF(soa.toile_cost,''))::numeric
    * (1 + COALESCE(soa.toil_gst_percentage::numeric, 0) / 100)
  )                                   AS amount,
  COALESCE(cp.paid, 0)                AS paid_amount,
  GREATEST(
    0,
    (
      COALESCE(NULLIF(soa.toile_making_cost,''), NULLIF(soa.toile_cost,''))::numeric
      * (1 + COALESCE(soa.toil_gst_percentage::numeric, 0) / 100)
    ) - COALESCE(cp.paid, 0)
  )                                   AS pending_amount,
  CASE
    WHEN COALESCE(cp.paid, 0) >=
         (
           COALESCE(NULLIF(soa.toile_making_cost,''), NULLIF(soa.toile_cost,''))::numeric
           * (1 + COALESCE(soa.toil_gst_percentage::numeric, 0) / 100)
         ) THEN 'Paid'
    WHEN COALESCE(cp.paid, 0) > 0 THEN 'Partially Paid'
    ELSE 'Unpaid'
  END AS status,
  'INR'::text AS currency_code,
  1::numeric  AS exchange_rate_snapshot,
  COALESCE(t.tds_amount, 0)::numeric  AS tds_amount,
  GREATEST(0, COALESCE(cp.paid, 0) - COALESCE(t.tds_amount, 0))::numeric AS net_paid_amount
FROM style_order_artworks soa
LEFT JOIN (
  SELECT reference_id, SUM(base_currency_amount) AS paid
  FROM costing_payments
  WHERE reference_type = 'toile'
    AND is_deleted = false
  GROUP BY reference_id
) cp ON cp.reference_id = soa.id
LEFT JOIN tds_agg t
  ON t.bdt = 'toile' AND t.bdi = soa.id
WHERE soa.is_deleted = false
  AND soa.toile_vendor_id   IS NOT NULL AND soa.toile_vendor_id   <> ''
  AND soa.toile_vendor_name IS NOT NULL AND soa.toile_vendor_name <> ''
  AND (
    (soa.toile_making_cost IS NOT NULL AND soa.toile_making_cost <> '')
    OR (soa.toile_cost IS NOT NULL AND soa.toile_cost <> '')
  )
  ${df("soa.created_at", from_date, to_date)}
  ${vid ? `AND soa.toile_vendor_id ~ '^[0-9]+$' AND soa.toile_vendor_id::integer = ${vid}` : ""}

          UNION ALL

  /* 12. Style Order Products (Pattern) — TDS via style_order_product */
SELECT
  'Style Order Product'::text         AS ref_type,
  sop.id::text                        AS source_id,
  sop.created_at::text                AS date,
  COALESCE(st.order_code, sop.product_name, 'SOP-' || sop.id::text) AS ref_number,
  COALESCE(sop.pattern_vendor_name, '—') AS vendor_name,
  sop.pattern_vendor_id::text         AS vendor_id_text,
  'Style Order Product (Pattern)'     AS department,
  (
    COALESCE(NULLIF(sop.pattern_payment_amount, '')::numeric, 0)
    * (1 + COALESCE(sop.gst_percentage::numeric, 0) / 100)
  )                                   AS amount,
  COALESCE(cp.paid, 0)                AS paid_amount,
  GREATEST(
    0,
    (
      COALESCE(NULLIF(sop.pattern_payment_amount, '')::numeric, 0)
      * (1 + COALESCE(sop.gst_percentage::numeric, 0) / 100)
    ) - COALESCE(cp.paid, 0)
  )                                   AS pending_amount,
  CASE
    WHEN COALESCE(cp.paid, 0) >=
         (
           COALESCE(NULLIF(sop.pattern_payment_amount, '')::numeric, 0)
           * (1 + COALESCE(sop.gst_percentage::numeric, 0) / 100)
         ) THEN 'Paid'
    WHEN COALESCE(cp.paid, 0) > 0 THEN 'Partially Paid'
    ELSE 'Unpaid'
  END AS status,
  'INR'::text AS currency_code,
  1::numeric  AS exchange_rate_snapshot,
  COALESCE(t.tds_amount, 0)::numeric  AS tds_amount,
  GREATEST(0, COALESCE(cp.paid, 0) - COALESCE(t.tds_amount, 0))::numeric AS net_paid_amount
FROM style_order_products sop
LEFT JOIN style_orders st ON st.id = sop.style_order_id
LEFT JOIN (
  SELECT reference_id, SUM(base_currency_amount) AS paid
  FROM costing_payments
  WHERE reference_type = 'style_order_product'
    AND is_deleted = false
  GROUP BY reference_id
) cp ON cp.reference_id = sop.id
LEFT JOIN tds_agg t
  ON t.bdt = 'style_order_product' AND t.bdi = sop.id
WHERE sop.is_deleted = false
  AND sop.pattern_vendor_id   IS NOT NULL AND sop.pattern_vendor_id   <> ''
  AND sop.pattern_vendor_name IS NOT NULL AND sop.pattern_vendor_name <> ''
  AND sop.pattern_payment_amount IS NOT NULL
  AND sop.pattern_payment_amount <> ''
  ${df("sop.created_at", from_date, to_date)}
  ${vid ? `AND sop.pattern_vendor_id ~ '^[0-9]+$' AND sop.pattern_vendor_id::integer = ${vid}` : ""}
      )
  
      SELECT *, COUNT(*) OVER () AS total_count
      FROM all_liabilities
      WHERE 1=1 ${statusClause} ${refTypeClause} ${deptClause} ${searchClause} ${refNoClause}
      ORDER BY
        CASE status
          WHEN 'Unpaid'          THEN 1
          WHEN 'Partially Paid'  THEN 2
          WHEN 'Pending'         THEN 3
          WHEN 'Paid'            THEN 4
          WHEN 'Completed'       THEN 5
          ELSE 6
        END,
        date DESC NULLS LAST,
        amount DESC
      LIMIT ${pLimit} OFFSET ${offset}
    `);

    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
    res.json({
      data: rows.map(r => ({ ...r, total_count: undefined })),
      total,
      page: parseInt(page),
      limit: pLimit,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   TOP VENDORS PENDING PAYMENT
══════════════════════════════════════════════════════════ */
router.get("/top-vendors-pending", requireAuth, 
  checkPermission({ any: [ACCOUNTS_PURCHASES.VIEW] }),
  async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT vendor_id, vendor_name,
             SUM(pending_amount * exchange_rate_snapshot)::numeric(18,2) AS total_pending,
             COUNT(*)::int AS bill_count
      FROM vendor_invoice_ledger
      WHERE status != 'Paid' AND vendor_name IS NOT NULL
      GROUP BY vendor_id, vendor_name
      ORDER BY total_pending DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   RECORD PAYMENT — unified across all source types
══════════════════════════════════════════════════════════ */
// router.post("/record-payment", requireAuth, 
//   checkPermission({ any: [ACCOUNTS_PURCHASES.ADD_EDIT] }),
//   async (req: AuthRequest, res) => {
//   const client = await pool.connect();
//   try {
//     await client.query("BEGIN");
//     const {
//       ref_type, source_id,
//       vendor_name, vendor_id,
//       payment_amount, payment_date, payment_type,
//       transaction_reference, remarks,
//       currency_code, exchange_rate_snapshot,
//     } = req.body as any;

//     const amt = parseFloat(payment_amount ?? "0");
//     if (amt <= 0) throw new Error("payment_amount must be > 0");
//     const pDate = payment_date || new Date().toISOString().slice(0, 10);
//     const pMode = payment_type || "Bank Transfer";
//     const payCcy  = currency_code || "INR";
//     const payRate = parseFloat(exchange_rate_snapshot ?? "1") || 1;     // pay ccy -> INR
//     const baseAmt = parseFloat((amt * payRate).toFixed(2));             // INR anchor

//     if (ref_type === "Purchase Receipt") {
//       /* Update vendor_invoice_ledger + insert vendor_payments */
//       /* Note: pending_amount is a generated column (vendor_invoice_amount - paid_amount) — do NOT update it */
//       const id = parseInt(source_id);
//       const { rows } = await client.query(`SELECT * FROM vendor_invoice_ledger WHERE id = $1 FOR UPDATE`, [id]);
//       if (!rows.length) throw new Error("Bill not found");
//       const bill = rows[0];
//       if (bill.status === "Cancelled") throw new Error("Cannot record payment on a Cancelled bill");
//       if (bill.status === "Paid") throw new Error("Cannot record payment on a Paid bill");
//       const billCcyCode = bill.currency_code || "INR";
//       const billRate = parseFloat(bill.exchange_rate_snapshot ?? "1") || 1;   // bill ccy -> INR
//       const amtInBillCcy = baseAmt / billRate;                                // bill currency
//       const prevPaid = parseFloat(bill.paid_amount ?? "0");                   // bill currency
//       const totalBill = parseFloat(bill.vendor_invoice_amount);              // bill currency
//       const pendingInBillCcy = totalBill - prevPaid;
//       if (amtInBillCcy > pendingInBillCcy + 0.01) {
//         throw new Error(
//           `Payment (${amtInBillCcy.toFixed(2)} ${billCcyCode}) exceeds pending balance (${pendingInBillCcy.toFixed(2)} ${billCcyCode})`
//         );
//       }
//       await client.query(
//         `INSERT INTO vendor_payments (vendor_id,vendor_name,payment_date,amount,currency_code,exchange_rate_snapshot,base_currency_amount,payment_mode,reference_no,notes,order_type,vendor_invoice_ledger_id,created_by)
//          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'general',$11,$12)`,
//         [bill.vendor_id, bill.vendor_name, pDate, amt, payCcy, payRate, baseAmt, pMode, transaction_reference || "", remarks || "", id, req.user?.email ?? ""]
//       );
//       await recomputeVendorBillBalances(client, id);

//     } else if (ref_type === "Costing Outsource") {
//       /* Insert into costing_payments — lock the job row first to serialize concurrent payments */
//       const id = parseInt(source_id);
//       const { rows: jobRows } = await client.query(
//         `SELECT * FROM outsource_jobs WHERE id = $1 AND is_deleted = false FOR UPDATE`,
//         [id]
//       );
//       if (!jobRows.length) throw new Error("Outsource job not found");
//       await client.query(
//         `INSERT INTO costing_payments (vendor_id,vendor_name,reference_type,reference_id,payment_type,payment_mode,payment_amount,currency_code,exchange_rate_snapshot,base_currency_amount,payment_status,transaction_id,payment_date,remarks,created_by)
//          VALUES ($1,$2,'outsource_job',$3,'outsource',$4,$5,$6,$7,$8,'Completed',$9,$10,$11,$12)`,
//         [vendor_id || null, vendor_name || "", id, pMode, amt, payCcy, payRate, baseAmt, transaction_reference || "", pDate, remarks || "", req.user?.email ?? ""]
//       );

//     } else if (ref_type === "Other Expense") {
//       /* Update other_expenses — lock the row first to serialize concurrent payments */
//       const id = parseInt(source_id);
//       const { rows } = await client.query(`SELECT * FROM other_expenses WHERE expense_id = $1 FOR UPDATE`, [id]);
//       if (!rows.length) throw new Error("Expense not found");
//       const exp = rows[0];
//       const newPaid   = parseFloat(exp.paid_amount ?? "0") + amt;
//       const newStatus = newPaid >= parseFloat(exp.amount) ? "Paid" : "Partially Paid";
//       await client.query(
//         `UPDATE other_expenses SET paid_amount=$1, payment_status=$2, updated_at=NOW() WHERE expense_id=$3`,
//         [newPaid, newStatus, id]
//       );
//       await client.query(
//         `INSERT INTO vendor_payments (vendor_id,vendor_name,payment_date,amount,currency_code,exchange_rate_snapshot,base_currency_amount,payment_mode,reference_no,notes,order_type,created_by)
//          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'general',$11)`,
//         [vendor_id || null, vendor_name || "", pDate, amt, payCcy, payRate, baseAmt, pMode, transaction_reference || "", remarks || "", req.user?.email ?? ""]
//       );

//     } else {
//       /* Artisan / Shipping / other — just log in vendor_payments */
//       await client.query(
//         `INSERT INTO vendor_payments (vendor_id,vendor_name,payment_date,amount,currency_code,exchange_rate_snapshot,base_currency_amount,payment_mode,reference_no,notes,order_type,created_by)
//          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'general',$11)`,
//         [vendor_id || null, vendor_name || "", pDate, amt, payCcy, payRate, baseAmt, pMode, transaction_reference || "", remarks || "", req.user?.email ?? ""]
//       );
//     }

//     await client.query("COMMIT");
//     res.json({ message: "Vendor payment recorded successfully" });
//   } catch (err: any) {
//     await client.query("ROLLBACK");
//     res.status(400).json({ error: err.message });
//   } finally { client.release(); }
// });

// ============================================================================
// HELPER FUNCTIONS FOR RECORD PAYMENT
// ============================================================================

interface RecordPaymentRequest {
  ref_type: string;
  source_id: string;
  vendor_name: string;
  vendor_id: number;
  payment_amount: string;
  payment_date: string;
  payment_type: string;
  transaction_reference: string;
  remarks: string;
  currency_code: string;
  exchange_rate_snapshot: string;
  tds_master_id?: number;
}

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


async function validatePaymentAmount(amount: number): Promise<void> {
  if (amount <= 0) {
    throw new Error("payment_amount must be > 0");
  }
}

function calculatePaymentAmounts(
  paymentAmount: string,
  exchangeRateSnapshot: string,
  currencyCode: string
): { amt: number; payRate: number; baseAmt: number; payCcy: string } {
  const amt = parseFloat(paymentAmount ?? "0");
  const payRate = parseFloat(exchangeRateSnapshot ?? "1") || 1;
  const baseAmt = parseFloat((amt * payRate).toFixed(2));
  const payCcy = currencyCode || "INR";
  
  return { amt, payRate, baseAmt, payCcy };
}

async function insertVendorPayment(
  client: any,
  vendorId: number | null,
  vendorName: string,
  paymentDate: string,
  amt: number,
  payCcy: string,
  payRate: number,
  baseAmt: number,
  paymentMode: string,
  transactionReference: string,
  remarks: string,
  orderType: string,
  vendorInvoiceLedgerId: number | null,
  username: string,
  refrenceType:string,
  referenceId:number | null,
): Promise<number> {
  const result = await client.query(
    `INSERT INTO vendor_payments 
      (vendor_id, vendor_name, payment_date, amount, currency_code, 
       exchange_rate_snapshot, base_currency_amount, payment_mode, 
       reference_no, notes, order_type, vendor_invoice_ledger_id, created_by, 
       reference_type, reference_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id`,
    [
      vendorId || null,
      vendorName || "",
      paymentDate,
      amt,
      payCcy,
      payRate,
      baseAmt,
      paymentMode,
      transactionReference || "",
      remarks || "",
      orderType,
      vendorInvoiceLedgerId,
      username,
      refrenceType,
      referenceId
    ]
  );
  return result.rows[0].id;
}

async function getTDSMaster(
  client: any,
  tdsMasterId: number
): Promise<{
  id: number;
  rate_percent: number;
  threshold_amount: number;
}> {
  const result = await client.query(
    `SELECT
       id,
       rate_percent::numeric AS rate_percent,
       threshold_amount::numeric AS threshold_amount
     FROM tds_master
     WHERE id = $1
       AND status = true
       AND is_deleted = false`,
    [tdsMasterId]
  );
  if (result.rows.length === 0) {
    throw new Error(
      `Invalid or inactive TDS master (ID: ${tdsMasterId})`
    );
  }
  return {
    id: result.rows[0].id,
    rate_percent: parseFloat(result.rows[0].rate_percent),
    threshold_amount: parseFloat(result.rows[0].threshold_amount || "0"),
  };
}

async function insertPaymentTDSRecord(
  client: any,
  tdsMasterId: number,
  paymentSourceType: string,
  paymentSourceId: number,
  paymentDate: any,
  vendorId: number | null,
  baseDocumentType: string,
  baseDocumentId: number,
  grossAmount: number,
  gstAmount: number,
  gstPercentage: number,
  baseAmount: number,
  paidAmount: number,
  tdsRate: number,
  tdsAmount: number,
  username: string,
  additionalData?: {
    allocations?: WaterfallAllocation[];  // For purchase receipts & vendor challans
  }
): Promise<number> {
  // Insert the main payment_tds record
  const result = await client.query(
    `INSERT INTO payment_tds
       (tds_master_id, payment_source_type, payment_source_id, payment_date,
        vendor_id, base_document_type, base_document_id,
        gross_amount, gst_amount, gst_percentage,
        payment_currency_code, payment_exchange_rate, base_amount,
        paid_amount, tds_rate, tds_amount, status, created_by)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7,
             $8, $9, $10,
             'INR', 1, $11,
             $12, $13, $14, 'DEDUCTED', $15)
     RETURNING id`,
    [
      tdsMasterId,
      paymentSourceType,
      paymentSourceId,
      paymentDate ? new Date(paymentDate) : new Date(),
      vendorId,
      baseDocumentType,
      baseDocumentId,
      grossAmount.toFixed(2),
      gstAmount.toFixed(2),
      gstPercentage.toFixed(2),
      baseAmount.toFixed(2),
      paidAmount.toFixed(2),
      tdsRate.toFixed(2),
      tdsAmount.toFixed(2),
      username
    ]
  );

  const tdsId = result.rows[0].id;

  if (baseDocumentType === 'pr' && additionalData?.allocations) {
    await insertPaymentTDSItems(
      client,
      tdsId,
      additionalData.allocations,
      tdsRate,
      'purchase_receipt_item',
      username
    );
  } else if (baseDocumentType === 'vendor_challan' && additionalData?.allocations) {
    await insertPaymentTDSItems(
      client,
      tdsId,
      additionalData.allocations,
      tdsRate,
      'vendor_challan_items',
      username
    );
  }

  return tdsId;
}

async function insertPaymentTDSItems(
  client: any,
  tdsId: number,
  allocations: WaterfallAllocation[],
  defaultTdsRate: number,
  baseDocumentItemType: string,
  username: string
): Promise<void> {
  for (const alloc of allocations) {
    const tdsRate = alloc.tdsAmount > 0 ? defaultTdsRate : 0;
    const tdsAmount = alloc.tdsAmount ?? 0;

    await client.query(
      `INSERT INTO payment_tds_items
         (payment_tds_id, base_document_item_type, base_document_item_id,
          base_amount, gst_amount, gst_percentage,
          tds_rate, tds_amount, paid_amount, created_by)
       VALUES ($1, $2, $3,
               $4, $5, $6,
               $7, $8, $9, $10)`,
      [
        tdsId,
        baseDocumentItemType,
        alloc.itemId,
        alloc.allocBase.toFixed(2),
        alloc.allocGst.toFixed(2),
        alloc.gstPercentage.toFixed(2),
        tdsRate.toFixed(2),
        tdsAmount.toFixed(2),
        alloc.paidAmount.toFixed(2),
        username
      ]
    );
  }
}

// ============================================================================
// HANDLER FUNCTIONS FOR EACH REF_TYPE
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

async function getPurchaseReceiptItems(client: any, entryId: number): Promise<any[]> {
  const items = await client.query(
    `SELECT pri.id, pri.quantity, pri.unit_price, pri.gst_percentage,
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

/**
 * Generic item-level payment lookup. Defaults to purchase_receipt_item to
 * preserve existing PR behaviour; pass 'vendor_challan_items' for challans.
 */
async function getExistingPaymentsForItems(
  client: any,
  itemIds: number[],
  baseDocumentItemType: 'purchase_receipt_item' | 'vendor_challan_items' = 'purchase_receipt_item'
): Promise<Map<number, number>> {
  if (itemIds.length === 0) return new Map();

  const paidRows = await client.query(
    `SELECT
       pi.base_document_item_id AS item_id,
       COALESCE(SUM(pi.paid_amount + pi.tds_amount), 0) AS paid_so_far
     FROM payment_items pi
     WHERE pi.base_document_item_type = $2
       AND pi.is_deleted = false
       AND pi.base_document_item_id = ANY($1::int[])
     GROUP BY pi.base_document_item_id`,
    [itemIds, baseDocumentItemType]
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
  tdsRate: number,
  threshold: number = 0
): { allocations: WaterfallAllocation[]; unallocatedAmount: number } {
  let remainingAmount = amountToAllocate;
  const allocations: WaterfallAllocation[] = [];

  for (const item of orderedItems) {
    if (remainingAmount <= 0.001) break;
    if (item.remaining <= 0.001) continue;

    const allocGross = Math.min(remainingAmount, item.remaining);
    const allocGst = item.total > 0 ? allocGross * (item.gst / item.total) : 0;
    const allocBase = allocGross - allocGst;

    // Per-item threshold: TDS only applies when the allocated base for THIS
    // item meets or exceeds the TDS master threshold.
    const tdsApplicable = allocBase >= threshold;
    const tdsAmount = tdsApplicable ? (allocBase * tdsRate) / 100 : 0;
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

async function insertPaymentItems(
  client: any,
  paymentSourceType: 'pr_payments' | 'vendor_payments',
  paymentSourceId: number,
  baseDocumentType: 'purchase_receipts' | 'vendor_challans',
  baseDocumentId: number,
  baseDocumentItemType: 'purchase_receipt_item' | 'vendor_challan_items',
  allocations: WaterfallAllocation[],
  username: string
): Promise<void> {
  for (const a of allocations) {
    await client.query(
      `INSERT INTO payment_items
         (payment_source_type, payment_source_id,
          base_document_type, base_document_id,
          base_document_item_type, base_document_item_id,
          base_amount, gst_amount, gross_amount,
          paid_amount, tds_amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6,
               $7, $8, $9, $10, $11, $12)`,
      [
        paymentSourceType,
        paymentSourceId,
        baseDocumentType,
        baseDocumentId,
        baseDocumentItemType,
        a.itemId,
        a.allocBase.toFixed(2),
        a.allocGst.toFixed(2),
        a.allocGross.toFixed(2),
        a.paidAmount.toFixed(2),
        a.tdsAmount.toFixed(2),
        username
      ]
    );
  }
}

async function getPROutstanding(client: any, entryId: number): Promise<number> {
  const outstandingRes = await client.query(
    `SELECT 
     COALESCE( SUM( pri.quantity * pri.unit_price * ( 1 + COALESCE(pri.gst_percentage, 0) / 100 ) ), 0 ) AS total_amount,
     COALESCE( SUM(pp.amount::numeric), 0 ) AS paid_amount
     FROM purchase_receipt_items pri
     LEFT JOIN pr_payments pp 
       ON pp.pr_id = pri.pr_id 
       AND pp.is_deleted = false
     WHERE pri.pr_id = $1 
       AND pri.is_deleted = false`,
    [entryId]
  );

  const totalAmount = parseFloat( outstandingRes.rows[0]?.total_amount || 0 );
  const paidAmount = parseFloat( outstandingRes.rows[0]?.paid_amount || 0 );
  return totalAmount - paidAmount;
}

async function handlePurchaseReceiptPayment(
  client: any,
  sourceId: string,
  vendorIdRaw: any,
  paymentData: any,
  tdsMasterId: number | undefined,
  username: string
): Promise<void> {
  const entryId  = parseInt(sourceId);
  const vendorId = parseInt(String(vendorIdRaw));

  if (Number.isNaN(entryId))  throw new Error("Invalid Purchase Receipt id");
  if (Number.isNaN(vendorId)) throw new Error("vendor_id is required for Purchase Receipt payments");

  await verifyPurchaseReceipt(client, entryId, vendorId);

  // PR is INR-denominated → allocate in base currency (INR)
  const allocAmt = parseFloat(paymentData.baseAmt ?? "0");
  if (!(allocAmt > 0)) throw new Error("Payment amount must be greater than zero");

  /* ───────────────────────── WITH TDS ───────────────────────── */
  if (tdsMasterId) {
    const tdsMaster = await getTDSMaster(client, tdsMasterId);
    const tdsRate   = tdsMaster.rate_percent;
    const threshold = tdsMaster.threshold_amount ?? 0;

    const items = await getPurchaseReceiptItems(client, entryId);
    const itemIds = items.map((r: any) => r.id);
    const paidMap = await getExistingPaymentsForItems(client, itemIds);
    const orderedItems = calculateItemBalances(items, paidMap).sort((a, b) => a.id - b.id);

    const { allocations, unallocatedAmount } = allocateWaterfall(
      allocAmt, orderedItems, tdsRate, threshold
    );

    if (unallocatedAmount > 0.01) {
      throw new Error(
        `Amount exceeds total outstanding balance on this PR by ${unallocatedAmount.toFixed(2)}. ` +
        `Please reduce the amount or handle as an advance.`
      );
    }
    if (allocations.length === 0) {
      throw new Error(`Nothing to allocate — all items on this PR are already fully paid.`);
    }

    const totalOutstanding = orderedItems.reduce((s, i) => s + i.remaining, 0);
    const prPaymentType = allocAmt >= totalOutstanding - 0.01 ? "Full" : "Partial";

    const prPaymentId = await insertPRPayment(
      client, entryId, allocAmt, prPaymentType,
      paymentData.paymentDate, paymentData.paymentMode, username
    );

    // Always write the item ledger — TDS or not
    await insertPaymentItems(
      client,
      "pr_payments",
      prPaymentId,
      "purchase_receipts",
      entryId,
      "purchase_receipt_item",
      allocations,
      username
    );

    // Aggregate for the parent TDS row
    const allBase  = allocations.reduce((s, a) => s + a.allocBase, 0);
    const allGst   = allocations.reduce((s, a) => s + a.allocGst, 0);
    const allGross = allocations.reduce((s, a) => s + a.allocGross, 0);
    const allPaid  = allocations.reduce((s, a) => s + a.paidAmount, 0);
    const allTds   = allocations.reduce((s, a) => s + a.tdsAmount, 0);
    const blendedGstPct = allBase > 0 ? (allGst / allBase) * 100 : 0;

    // Only create payment_tds if at least one line crossed the threshold
    if (allTds > 0) {
      const tdsEligibleAllocations = allocations.filter(a => a.tdsAmount > 0);
      await insertPaymentTDSRecord(
        client,
        tdsMasterId,
        "pr_payments",
        prPaymentId,
        paymentData.paymentDate,
        vendorId,
        "pr",
        entryId,
        allGross,
        allGst,
        blendedGstPct,
        allBase,
        allPaid,
        tdsRate,
        allTds,
        username,
        { allocations: tdsEligibleAllocations }
      );
    }
    return;
  }

  /* ──────────────────────── WITHOUT TDS ─────────────────────── */
  const outstanding = await getPROutstanding(client, entryId);
  const paymentType = allocAmt >= outstanding - 0.01 ? "Full" : "Partial";

  const prPaymentId = await insertPRPayment(
    client, entryId, allocAmt, paymentType,
    paymentData.paymentDate, paymentData.paymentMode, username
  );

  // Still compute allocations so the item ledger records which items were paid
  const items = await getPurchaseReceiptItems(client, entryId);
  const itemIds = items.map((r: any) => r.id);
  const paidMap = await getExistingPaymentsForItems(client, itemIds);
  const orderedItems = calculateItemBalances(items, paidMap).sort((a, b) => a.id - b.id);

  const { allocations } = allocateWaterfall(allocAmt, orderedItems, 0, 0);

  await insertPaymentItems(
    client,
    "pr_payments",
    prPaymentId,
    "purchase_receipts",
    entryId,
    "purchase_receipt_item",
    allocations,
    username
  );
}

async function handleCostingOutsourcePayment(
  client: any,
  sourceId: string,
  vendorId: number,
  vendorName: string,
  paymentData: any,
  tdsMasterId: number | undefined,
  username: string
): Promise<void> {
  const entryId = parseInt(sourceId);

  if (Number.isNaN(entryId)) {
    throw new Error("Invalid outsource job id");
  }

  // Lock the job row + fetch swatch/style for costing_payments
  const { rows: jobRows } = await client.query(
    `SELECT id, swatch_order_id, style_order_id, total_cost, gst_percentage
     FROM outsource_jobs
     WHERE id = $1
       AND is_deleted = false
     FOR UPDATE`,
    [entryId]
  );

  if (!jobRows.length) {
    throw new Error("Outsource job not found");
  }

  const job = jobRows[0];

  const gstPct = parseFloat(job.gst_percentage || "0");

  // Payment amount in INR (base currency).
  // allocAmt is treated as the payment amount.
  const allocAmt = parseFloat(paymentData.baseAmt ?? "0");

  if (!(allocAmt > 0)) {
    throw new Error("Payment amount must be greater than zero");
  }

  
  // Split payment into GST + TDS base
  //
  // Example:
  // allocAmt = 1000
  // gstPct   = 5
  //
  // GST      = 1000 * 5 / 100 = 50
  // TDS base = 1000 - 50      = 950
  
  const totalAmount = Number(allocAmt.toFixed(2));

  const payGst =
    gstPct > 0
      ? Number(((totalAmount * gstPct) / 100).toFixed(2))
      : 0;

  const payBase = Number(
    (totalAmount - payGst).toFixed(2)
  );

  
  // Resolve TDS master + threshold check
  
  let tdsMaster: {
    id: number;
    rate_percent: number;
    threshold_amount: number;
  } | null = null;

  let tdsApplicable = false;

  if (tdsMasterId) {
    tdsMaster = await getTDSMaster(client, tdsMasterId);

    const threshold = tdsMaster.threshold_amount ?? 0;

    if (payBase >= threshold) {
      tdsApplicable = true;
    }
  }

  const paymentType = "outsource";

  
  // Insert costing payment
  
  const result = await client.query(
    `INSERT INTO costing_payments
       (
         vendor_id,
         vendor_name,
         reference_type,
         reference_id,
         swatch_order_id,
         style_order_id,
         payment_type,
         payment_mode,
         payment_amount,
         currency_code,
         exchange_rate_snapshot,
         base_currency_amount,
         payment_status,
         transaction_id,
         payment_date,
         remarks,
         created_by
       )
     VALUES
       (
         $1, $2, 'outsource_job', $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11,
         'Completed', $12, $13, $14, $15
       )
     RETURNING id`,
    [
      vendorId || null,
      vendorName || "",
      entryId,
      job.swatch_order_id,
      job.style_order_id,
      paymentType,
      paymentData.paymentMode,
      paymentData.amt,
      paymentData.payCcy,
      paymentData.payRate,
      totalAmount,
      paymentData.transactionReference || "",
      paymentData.paymentDate,
      paymentData.remarks || "",
      username,
    ]
  );

  const costingPaymentId = result.rows[0].id;

  
  // Insert TDS record if applicable
  
  if (tdsApplicable && tdsMaster) {
    const tdsRate = tdsMaster.rate_percent;

    // TDS is calculated on the amount after GST
    const tdsAmount = Number(
      ((payBase * tdsRate) / 100).toFixed(2)
    );

    // Actual cash paid after TDS
    const paidAmount = Number(
      (totalAmount - tdsAmount).toFixed(2)
    );

    await insertPaymentTDSRecord(
      client,
      tdsMaster.id,
      "costing_payments",
      costingPaymentId,
      paymentData.paymentDate,
      vendorId,
      "outsource_job",
      entryId,
      totalAmount,     // gross_amount
      payGst,          // gst_amount
      gstPct,          // gst_percentage
      payBase,         // base_amount
      paidAmount,      // net cash after TDS
      tdsRate,
      tdsAmount,
      username
    );
  }
}

  
async function handleOtherExpensePayment(
  client: any,
  sourceId: string,
  vendorId: number | null | undefined,
  vendorName: string,
  paymentData: any,
  tdsMasterId: number | undefined,
  username: string
): Promise<void> {
  const expenseId = parseInt(sourceId);
  if (Number.isNaN(expenseId)) throw new Error("Invalid expense id");

  // Lock the expense row (source of truth for the listing)
  const { rows } = await client.query(
    `SELECT * FROM other_expenses
     WHERE expense_id = $1 AND is_deleted = false
     FOR UPDATE`,
    [expenseId]
  );
  if (!rows.length) throw new Error("Expense not found");
  const exp = rows[0];

  // other_expenses.amount is BASE; gst_percentage drives the gross
  const baseAmount  = parseFloat(exp.amount || "0");
  const gstPct      = parseFloat(exp.gst_percentage || "0");
  const totalAmount = baseAmount * (1 + gstPct / 100);   // gross, used for status

  // Payment amount in INR (base currency); user-entered value is GST-INCLUSIVE
  const allocAmt = parseFloat(paymentData.baseAmt ?? "0");
  if (!(allocAmt > 0)) throw new Error("Payment amount must be greater than zero");

  // ── Case 2: vendor_id assigned → find & lock the mirror ledger charge ──
  let ledgerCharge: { id: number } | null = null;
  if (vendorId) {
    const lc = await client.query(
      `SELECT id
       FROM vendor_ledger_charges
       WHERE order_type = 'other_expenses'
         AND order_id   = $1
         AND vendor_id  = $2
         AND is_deleted = false
       FOR UPDATE`,
      [expenseId, vendorId]
    );
    ledgerCharge = lc.rows[0] ?? null;
  }
  if (ledgerCharge == null) throw new Error("vendor_ledger_charges not found");

  // Compute new paid/status against the expense (source of truth)
  const newPaid = parseFloat(exp.paid_amount ?? "0") + allocAmt;
  const newStatus =
    newPaid >= totalAmount - 0.01 ? "Paid"
    : newPaid > 0                 ? "Partially Paid"
    : "Unpaid";

  // Insert vendor payment — reference_type depends on which case we're in
  const referenceId   = ledgerCharge ? ledgerCharge.id : null;

  const paymentId = await insertVendorPayment(
    client,
    vendorId || null,
    vendorName || "",
    paymentData.paymentDate,
    paymentData.amt,
    paymentData.payCcy,
    paymentData.payRate,
    paymentData.baseAmt,
    paymentData.paymentMode,
    paymentData.transactionReference,
    paymentData.remarks || "",
    ledgerCharge ? "ledger_charge" : "general", 
    null,
    username,
    "ledger_charge",
    referenceId
  );

  // Update the expense row (drives listing pending_amount)
  await client.query(
    `UPDATE other_expenses
     SET paid_amount = $1, payment_status = $2, updated_at = NOW()
     WHERE expense_id = $3`,
    [newPaid, newStatus, expenseId]
  );

  // ── TDS ──
  if (tdsMasterId) {
    const tdsMaster = await getTDSMaster(client, tdsMasterId);
    const threshold = tdsMaster.threshold_amount ?? 0;

    // allocAmt is treated as the total payment amount.
    // GST is calculated directly on allocAmt.
    const totalAmount = allocAmt;

    const payGst =
      gstPct > 0
        ? Number(((totalAmount * gstPct) / 100).toFixed(2))
        : 0;

    // TDS is calculated on amount after GST.
    const payBase = Number(
      (totalAmount - payGst).toFixed(2)
    );

    if (payBase >= threshold) {
      const tdsRate = tdsMaster.rate_percent;

      const tdsAmount = Number(
        ((payBase * tdsRate) / 100).toFixed(2)
      );

      const paidAmount = Number(
        (totalAmount - tdsAmount).toFixed(2)
      );

      await insertPaymentTDSRecord(
        client,
        tdsMaster.id,
        "vendor_payments",
        paymentId,
        paymentData.paymentDate,
        vendorId!,
        ledgerCharge ? "ledger_charge" : "other_expense",
        referenceId ?? 0,
        totalAmount,     // gross_amount
        payGst,          // gst_amount
        gstPct,          // gst_percentage
        payBase,         // base_amount
        paidAmount,      // net cash after TDS
        tdsRate,
        tdsAmount,
        username
      );
    }
  }
}

async function handleCustomChargePayment(
  client: any,
  sourceId: string,
  vendorId: number,
  vendorName: string,
  paymentData: any,
  tdsMasterId: number | undefined,
  username: string
): Promise<void> {
  const entryId = parseInt(sourceId);

  if (Number.isNaN(entryId)) {
    throw new Error("Invalid custom charge id");
  }

  if (!vendorId) {
    throw new Error("vendor_id is required for Custom Charge payments");
  }

  // Lock the charge row + fetch swatch/style for costing_payments
  const { rows: chargeRows } = await client.query(
    `SELECT
        id,
        swatch_order_id,
        style_order_id,
        total_amount,
        gst_percentage
     FROM custom_charges
     WHERE id = $1
       AND is_deleted = false
     FOR UPDATE`,
    [entryId]
  );

  if (!chargeRows.length) {
    throw new Error("Custom charge not found");
  }

  const charge = chargeRows[0];

  const gstPct = parseFloat(charge.gst_percentage || "0");

  // Payment amount in INR (base currency).
  // allocAmt is treated as the payment amount.
  const allocAmt = parseFloat(paymentData.baseAmt ?? "0");

  if (!(allocAmt > 0)) {
    throw new Error("Payment amount must be greater than zero");
  }

  const totalAmount = Number(allocAmt.toFixed(2));

  const payGst =
    gstPct > 0
      ? Number(((totalAmount * gstPct) / 100).toFixed(2))
      : 0;

  const payBase = Number(
    (totalAmount - payGst).toFixed(2)
  );


  let tdsMaster: {
    id: number;
    rate_percent: number;
    threshold_amount: number;
  } | null = null;

  let tdsApplicable = false;

  if (tdsMasterId) {
    tdsMaster = await getTDSMaster(client, tdsMasterId);

    const threshold = tdsMaster.threshold_amount ?? 0;

    if (payBase >= threshold) {
      tdsApplicable = true;
    }
  }

  const paymentType = "custom_charge";

  const result = await client.query(
    `INSERT INTO costing_payments
       (
         vendor_id,
         vendor_name,
         reference_type,
         reference_id,
         swatch_order_id,
         style_order_id,
         payment_type,
         payment_mode,
         payment_amount,
         currency_code,
         exchange_rate_snapshot,
         base_currency_amount,
         payment_status,
         transaction_id,
         payment_date,
         remarks,
         created_by
       )
     VALUES
       (
         $1, $2, 'custom_charge', $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11,
         'Completed', $12, $13, $14, $15
       )
     RETURNING id`,
    [
      vendorId,
      vendorName || "",
      entryId,
      charge.swatch_order_id,
      charge.style_order_id,
      paymentType,
      paymentData.paymentMode,
      paymentData.amt,
      paymentData.payCcy,
      paymentData.payRate,
      totalAmount,
      paymentData.transactionReference || "",
      paymentData.paymentDate,
      paymentData.remarks || "",
      username,
    ]
  );

  const costingPaymentId = result.rows[0].id;

  
  // Insert TDS record if applicable
  
  if (tdsApplicable && tdsMaster) {
    const tdsRate = tdsMaster.rate_percent;

    // TDS is calculated on the amount after GST
    const tdsAmount = Number(
      ((payBase * tdsRate) / 100).toFixed(2)
    );

    // Actual cash paid after TDS
    const paidAmount = Number(
      (totalAmount - tdsAmount).toFixed(2)
    );

    await insertPaymentTDSRecord(
      client,
      tdsMaster.id,
      "costing_payments",
      costingPaymentId,
      paymentData.paymentDate,
      vendorId,
      "custom_charge",
      entryId,
      totalAmount,     // gross_amount
      payGst,          // gst_amount
      gstPct,          // gst_percentage
      payBase,         // base_amount
      paidAmount,      // net cash after TDS
      tdsRate,
      tdsAmount,
      username
    );
  }
}


async function getVendorChallanDetails(
  client: any,
  entryId: number,
  vendorId: number
): Promise<{ id: number; challan_number: string; vendor_id: number; vendor_name: string }> {
  // Lock the row so concurrent payments can't race
  const challanRes = await client.query(
    `SELECT id, challan_number, vendor_id, vendor_name, status
     FROM vendor_challans
     WHERE id = $1 AND vendor_id = $2 AND is_deleted = false
     FOR UPDATE`,
    [entryId, vendorId]
  );
  if (challanRes.rows.length === 0) {
    throw new Error(`Vendor challan ${entryId} not found or does not belong to vendor`);
  }
  const row = challanRes.rows[0];
  if (row.status !== "Verified") {
    throw new Error(`Vendor challan ${row.challan_number} is not Verified — cannot record payment.`);
  }
  return row;
}

async function getVendorChallanItems(client: any, entryId: number): Promise<any[]> {
  const items = await client.query(
    `SELECT
       vci.id,
       vci.quantity,
       vci.rate AS unit_price,
       vci.gst_percentage,
       (vci.quantity * vci.rate * (1 + COALESCE(vci.gst_percentage, 0) / 100)) AS total_amount
     FROM vendor_challan_items vci
     WHERE vci.vendor_challan_id = $1 AND vci.is_deleted = false`,
    [entryId]
  );
  if (items.rows.length === 0) {
    throw new Error(`No items found on Vendor Challan ${entryId}.`);
  }
  return items.rows;
}

async function getVendorChallanTotalAmount(client: any, entryId: number): Promise<{
  totalAmount: number;
  totalBase: number;
  blendedGstPct: number;
}> {
  const itemsRes = await client.query(
    `SELECT
      SUM((quantity * rate) * (1 + COALESCE(gst_percentage, 0) / 100)) AS total_with_gst,
      SUM(quantity * rate) AS total_base,
      CASE
        WHEN SUM(quantity * rate) > 0
        THEN (SUM((quantity * rate) * (1 + COALESCE(gst_percentage, 0) / 100)) - SUM(quantity * rate)) / SUM(quantity * rate) * 100
        ELSE 0
      END AS blended_gst_percentage
    FROM vendor_challan_items
    WHERE vendor_challan_id = $1 AND is_deleted = false`,
    [entryId]
  );

  const totalAmount   = parseFloat(itemsRes.rows[0]?.total_with_gst || "0");
  const totalBase     = parseFloat(itemsRes.rows[0]?.total_base || "0");
  const blendedGstPct = parseFloat(itemsRes.rows[0]?.blended_gst_percentage || "0");

  if (totalAmount === 0) {
    throw new Error(`Vendor challan ${entryId} has no items or total amount is zero`);
  }

  return { totalAmount, totalBase, blendedGstPct };
}

async function getVendorChallanPaidAmount(
  client: any,
  vendorId: number,
  entryId: number
): Promise<number> {
  const paidRes = await client.query(
    `SELECT COALESCE(SUM(base_currency_amount), 0) AS paid_amount
     FROM vendor_payments
     WHERE vendor_id = $1
       AND reference_type = 'vendor_challan'
       AND reference_id = $2
       AND is_deleted = false`,
    [vendorId, entryId]
  );
  return parseFloat(paidRes.rows[0].paid_amount || "0");
}

async function insertVendorPaymentWithReference(
  client: any,
  vendorId: number,
  vendorName: string,
  paymentDate: any,
  allocAmt: number,
  paymentMode: string,
  referenceNo: string | null,
  notes: string,
  referenceType: string,
  referenceId: number,
  username: string
): Promise<number> {
  const result = await client.query(
    `INSERT INTO vendor_payments
      (vendor_id, vendor_name, payment_date, amount,
       currency_code, exchange_rate_snapshot, base_currency_amount,
       payment_mode, reference_no, notes,
       reference_type, reference_id,
       created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10,
            $11, $12,
            $13)
    RETURNING id`,
    [
      vendorId,
      vendorName,
      paymentDate ? new Date(paymentDate) : new Date(),
      allocAmt,
      "INR",
      "1",
      String(allocAmt),
      paymentMode,
      referenceNo || null,
      notes,
      referenceType,
      referenceId,
      username
    ]
  );
  return result.rows[0].id;
}

async function handleVendorChallanPayment(
  client: any,
  sourceId: string,
  vendorId: number,
  vendorName: string,
  paymentData: any,
  tdsMasterId: number | undefined,
  username: string
): Promise<void> {
  const entryId = parseInt(sourceId);
  if (Number.isNaN(entryId)) throw new Error("Invalid vendor challan id");
  if (!vendorId) throw new Error("vendor_id is required for Vendor Challan payments");

  // 1. Fetch the vendor challan details (locks the row)
  const challan = await getVendorChallanDetails(client, entryId, vendorId);

  // 2. Compute total amount (base + GST) from vendor_challan_items
  const { totalAmount } = await getVendorChallanTotalAmount(client, entryId);

  // 3. Compute current paid amount from vendor_payments for this challan
  const currentPaid = await getVendorChallanPaidAmount(client, vendorId, entryId);

  // Payment amount in INR (base currency); user-entered value is GST-INCLUSIVE
  const allocAmt = parseFloat(paymentData.baseAmt ?? "0");
  if (!(allocAmt > 0)) throw new Error("Payment amount must be greater than zero");

  // 4. Prevent overpayment (allow a small tolerance of 0.01)
  const newPaid = currentPaid + allocAmt;
  if (newPaid > totalAmount + 0.01) {
    throw new Error(
      `Payment amount exceeds remaining balance for challan ${challan.challan_number}. ` +
      `Total: ${totalAmount}, Already paid: ${currentPaid}, Attempting to pay: ${allocAmt}`
    );
  }

  // 5. Prepare notes from record-payment payload
  const notes = paymentData.remarks
    ? `${paymentData.remarks} (against challan ${challan.challan_number})`
    : `Challan payment ${challan.challan_number}`;

  const referenceNo = paymentData.transactionReference || null;

  // 6. Fetch items + existing item-level payments (same for both branches)
  const items = await getVendorChallanItems(client, entryId);
  const itemIds = items.map((r: any) => r.id);
  const paidMap = await getExistingPaymentsForItems(client, itemIds, "vendor_challan_items");
  const itemBalances = calculateItemBalances(items, paidMap);
  const orderedItems = itemBalances.sort((a, b) => a.id - b.id);

  // 7. TDS-applicable branch
  if (tdsMasterId) {
    const tdsMaster = await getTDSMaster(client, tdsMasterId);
    const tdsRate   = tdsMaster.rate_percent;
    const threshold = tdsMaster.threshold_amount ?? 0;

    const { allocations, unallocatedAmount } = allocateWaterfall(
      allocAmt, orderedItems, tdsRate, threshold
    );

    if (unallocatedAmount > 0.01) {
      throw new Error(
        `Amount exceeds total outstanding balance on this challan by ${unallocatedAmount.toFixed(2)}. ` +
        `Please reduce the amount or handle as an advance.`
      );
    }
    if (allocations.length === 0) {
      throw new Error(`Nothing to allocate — all items on this challan are already fully paid.`);
    }

    const paymentId = await insertVendorPaymentWithReference(
      client,
      vendorId,
      challan.vendor_name || vendorName || "",
      paymentData.paymentDate,
      allocAmt,
      paymentData.paymentMode,
      referenceNo,
      notes,
      "vendor_challan",
      entryId,
      username
    );

    // Always write the item ledger — TDS or not
    await insertPaymentItems(
      client,
      "vendor_payments",
      paymentId,
      "vendor_challans",
      entryId,
      "vendor_challan_items",
      allocations,
      username
    );

    // Aggregate ALL items for the parent payment_tds row
    const allBase  = allocations.reduce((s: number, a: any) => s + a.allocBase, 0);
    const allGst   = allocations.reduce((s: number, a: any) => s + a.allocGst, 0);
    const allGross = allocations.reduce((s: number, a: any) => s + a.allocGross, 0);
    const allPaid  = allocations.reduce((s: number, a: any) => s + a.paidAmount, 0);
    const allTds   = allocations.reduce((s: number, a: any) => s + a.tdsAmount, 0);
    const blendedGstPct = allBase > 0 ? (allGst / allBase) * 100 : 0;

    // Only create payment_tds when at least one item crossed the threshold
    if (allTds > 0) {
      const tdsEligibleAllocations = allocations.filter((a: any) => a.tdsAmount > 0);

      await insertPaymentTDSRecord(
        client,
        tdsMaster.id,
        "vendor_payments",
        paymentId,
        paymentData.paymentDate,
        vendorId,
        "vendor_challan",
        entryId,
        allGross,
        allGst,
        blendedGstPct,
        allBase,
        allPaid,
        tdsRate,
        allTds,
        username,
        { allocations: tdsEligibleAllocations }
      );
    }

    return;
  }

  // 8. No TDS — still do waterfall so the item ledger is populated
  const { allocations, unallocatedAmount } = allocateWaterfall(allocAmt, orderedItems, 0, 0);

  if (unallocatedAmount > 0.01) {
    throw new Error(
      `Amount exceeds total outstanding balance on this challan by ${unallocatedAmount.toFixed(2)}. ` +
      `Please reduce the amount or handle as an advance.`
    );
  }
  if (allocations.length === 0) {
    throw new Error(`Nothing to allocate — all items on this challan are already fully paid.`);
  }

  const paymentId = await insertVendorPaymentWithReference(
    client,
    vendorId,
    challan.vendor_name || vendorName || "",
    paymentData.paymentDate,
    allocAmt,
    paymentData.paymentMode,
    referenceNo,
    notes,
    "vendor_challan",
    entryId,
    username
  );

  await insertPaymentItems(
    client,
    "vendor_payments",
    paymentId,
    "vendor_challans",
    entryId,
    "vendor_challan_items",
    allocations,
    username
  );
}

const GENERIC_REF_TO_BASE_DOC: Record<string, string> = {
  "Artwork (Swatch)": "artwork_swatch",
  "Artwork (Style)":  "artwork_style",
  "Toile":            "toile",
  "Shipping":         "shipping",
  // "Artisan" intentionally omitted — no vendor, no TDS ledger
};

async function handleGenericPayment(
  client: any,
  refType: string,
  sourceId: string,
  vendorId: number | null | undefined,
  vendorName: string,
  paymentData: any,
  tdsMasterId: number | undefined,
  username: string
): Promise<void> {
  const entryId = parseInt(sourceId);
  if (Number.isNaN(entryId)) throw new Error("Invalid source id");

  // vendor_payments.vendor_id is still NOT NULL — reject up front
  if (!vendorId) {
    throw new Error(
      `Cannot record a payment for "${refType}" — no vendor is assigned to this record.`
    );
  }

  const allocAmt = parseFloat(paymentData.baseAmt ?? "0");
  if (!(allocAmt > 0)) throw new Error("Payment amount must be greater than zero");

  // Insert the vendor payment
  const paymentId = await insertVendorPayment(
    client,
    vendorId,
    vendorName || "",
    paymentData.paymentDate,
    paymentData.amt,
    paymentData.payCcy,
    paymentData.payRate,
    paymentData.baseAmt,
    paymentData.paymentMode,
    paymentData.transactionReference,
    paymentData.remarks || "",
    "general",
    null,
    username,
    "general",
    null
  );

  // ── TDS ──
  if (!tdsMasterId) return;

  const baseDocType = GENERIC_REF_TO_BASE_DOC[refType];
  if (!baseDocType) return;   // Artisan or unknown ref_type — no TDS row

  const tdsMaster = await getTDSMaster(client, tdsMasterId);
  const threshold = tdsMaster.threshold_amount ?? 0;

  // These sources don't carry a GST split today → base = gross
  const gstPct  = 0;
  const payGst  = 0;
  const payBase = allocAmt;

  if (payBase < threshold) return;   // below threshold — skip TDS row

  const tdsRate    = tdsMaster.rate_percent;
  const tdsAmount  = (payBase * tdsRate) / 100;
  const paidAmount = allocAmt - tdsAmount;

  await insertPaymentTDSRecord(
    client,
    tdsMaster.id,
    "vendor_payments",
    paymentId,
    paymentData.paymentDate,
    vendorId,            // still non-null here, guaranteed by the guard above
    baseDocType,
    entryId,
    allocAmt,            // gross_amount
    payGst,              // gst_amount  (0 today)
    gstPct,              // gst_percentage
    payBase,             // base_amount = gross today
    paidAmount,          // net cash after TDS
    tdsRate,
    tdsAmount,
    username
  );
}

async function handleArtworkSwatchPayment(
  client: any,
  sourceId: string,
  vendorId: number | null,
  vendorName: string,
  paymentData: any,
  tdsMasterId: number | undefined,
  username: string
): Promise<void> {
  const entryId = parseInt(sourceId);
  if (Number.isNaN(entryId)) throw new Error("Invalid artwork id");

  const { rows: artRows } = await client.query(
    `SELECT id, artwork_code, swatch_order_id,
            outsource_vendor_id, outsource_vendor_name,
            gst_percentage
     FROM artworks
     WHERE id = $1 AND is_deleted = false
     FOR UPDATE`,
    [entryId]
  );
  if (!artRows.length) throw new Error("Artwork (Swatch) not found");
  const art = artRows[0];

  const resolvedVendorId =
    vendorId ??
    (art.outsource_vendor_id ? parseInt(String(art.outsource_vendor_id)) : null);
  if (!resolvedVendorId) {
    throw new Error("Cannot record a payment for Artwork (Swatch) — no vendor is assigned.");
  }

  const allocAmt = parseFloat(paymentData.baseAmt ?? "0");
  if (!(allocAmt > 0)) throw new Error("Payment amount must be greater than zero");

  const totalAmount = Number(allocAmt.toFixed(2));
  const gstPct = parseFloat(art.gst_percentage || "0");
  const payGst  = gstPct > 0 ? Number(((totalAmount * gstPct) / 100).toFixed(2)) : 0;
  const payBase = Number((totalAmount - payGst).toFixed(2));

  const notes = paymentData.remarks
    ? `${paymentData.remarks} (against artwork ${art.artwork_code ?? entryId})`
    : `Artwork (Swatch) payment ${art.artwork_code ?? entryId}`;

  const payRes = await client.query(
    `INSERT INTO costing_payments
       (vendor_id, vendor_name, reference_type, reference_id,
        swatch_order_id, style_order_id,
        payment_type, payment_mode, payment_amount,
        currency_code, exchange_rate_snapshot, base_currency_amount,
        payment_status, transaction_id, payment_date, remarks, created_by)
     VALUES ($1, $2, 'artwork_swatch', $3, $4, $5,
             $6, $7, $8,
             $9, $10, $11,
             'Completed', $12, $13, $14, $15)
     RETURNING id`,
    [
      resolvedVendorId,
      vendorName || art.outsource_vendor_name || "",
      entryId,
      art.swatch_order_id,   // swatch_order_id
      null,                  // style_order_id is always null for swatch artworks
      paymentData.paymentType || "costing",
      paymentData.paymentMode,
      paymentData.amt,
      paymentData.payCcy,
      String(paymentData.payRate),
      totalAmount,
      paymentData.transactionReference || null,
      paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date(),
      notes,
      username,
    ]
  );
  const paymentId = payRes.rows[0].id;

  if (!tdsMasterId) return;

  const tdsMaster = await getTDSMaster(client, tdsMasterId);
  if (payBase < (tdsMaster.threshold_amount ?? 0)) return;

  const tdsRate    = tdsMaster.rate_percent;
  const tdsAmount  = Number(((payBase * tdsRate) / 100).toFixed(2));
  const paidAmount = Number((totalAmount - tdsAmount).toFixed(2));

  await insertPaymentTDSRecord(
    client,
    tdsMaster.id,
    "costing_payments",
    paymentId,
    paymentData.paymentDate,
    resolvedVendorId,
    "artwork_swatch",
    entryId,
    totalAmount, payGst, gstPct, payBase, paidAmount,
    tdsRate, tdsAmount, username
  );
}

async function handleArtworkStylePayment(
  client: any,
  sourceId: string,
  vendorId: number | null,
  vendorName: string,
  paymentData: any,
  tdsMasterId: number | undefined,
  username: string
): Promise<void> {
  const entryId = parseInt(sourceId);
  if (Number.isNaN(entryId)) throw new Error("Invalid style artwork id");

  const { rows: artRows } = await client.query(
    `SELECT id, artwork_code, style_order_id,
            outsource_vendor_id, outsource_vendor_name,
            artwork_created, gst_percentage
     FROM style_order_artworks
     WHERE id = $1 AND is_deleted = false
     FOR UPDATE`,
    [entryId]
  );
  if (!artRows.length) throw new Error("Artwork (Style) not found");
  const art = artRows[0];

  if (art.artwork_created !== "Outsource") {
    throw new Error("This artwork is not an outsource record — cannot record a vendor payment.");
  }

  const resolvedVendorId =
    vendorId ??
    (art.outsource_vendor_id ? parseInt(String(art.outsource_vendor_id)) : null);
  if (!resolvedVendorId) {
    throw new Error("Cannot record a payment for Artwork (Style) — no vendor is assigned.");
  }

  const allocAmt = parseFloat(paymentData.baseAmt ?? "0");
  if (!(allocAmt > 0)) throw new Error("Payment amount must be greater than zero");

  const totalAmount = Number(allocAmt.toFixed(2));
  const gstPct = parseFloat(art.gst_percentage || "0");
  const payGst  = gstPct > 0 ? Number(((allocAmt * gstPct) / 100).toFixed(2)) : 0;
  const payBase = Number((totalAmount - payGst).toFixed(2));

  const notes = paymentData.remarks
    ? `${paymentData.remarks} (against style artwork ${art.artwork_code ?? entryId})`
    : `Artwork (Style) payment ${art.artwork_code ?? entryId}`;

  const payRes = await client.query(
    `INSERT INTO costing_payments
       (vendor_id, vendor_name, reference_type, reference_id,
        swatch_order_id, style_order_id,
        payment_type, payment_mode, payment_amount,
        currency_code, exchange_rate_snapshot, base_currency_amount,
        payment_status, transaction_id, payment_date, remarks, created_by)
     VALUES ($1, $2, 'artwork_style', $3, $4, $5,
             $6, $7, $8,
             $9, $10, $11,
             'Completed', $12, $13, $14, $15)
     RETURNING id`,
    [
      resolvedVendorId,
      vendorName || art.outsource_vendor_name || "",
      entryId,
      null,                  
      art.style_order_id,
      paymentData.paymentType || "Partial",
      paymentData.paymentMode,
      paymentData.amt,
      paymentData.payCcy,
      String(paymentData.payRate),
      totalAmount,
      paymentData.transactionReference || null,
      paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date(),
      notes,
      username,
    ]
  );
  const paymentId = payRes.rows[0].id;

  if (!tdsMasterId) return;

  const tdsMaster = await getTDSMaster(client, tdsMasterId);
  if (payBase < (tdsMaster.threshold_amount ?? 0)) return;

  const tdsRate    = tdsMaster.rate_percent;
  const tdsAmount  = Number(((payBase * tdsRate) / 100).toFixed(2));
  const paidAmount = Number((totalAmount - tdsAmount).toFixed(2));

  await insertPaymentTDSRecord(
    client,
    tdsMaster.id,
    "costing_payments",
    paymentId,
    paymentData.paymentDate,
    resolvedVendorId,
    "artwork_style",
    entryId,
    totalAmount, payGst, gstPct, payBase, paidAmount,
    tdsRate, tdsAmount, username
  );
}

async function handleToilePayment(
  client: any,
  sourceId: string,
  vendorId: number | null,
  vendorName: string,
  paymentData: any,
  tdsMasterId: number | undefined,
  username: string
): Promise<void> {
  const entryId = parseInt(sourceId);
  if (Number.isNaN(entryId)) throw new Error("Invalid toile id");

  const { rows: soaRows } = await client.query(
    `SELECT id, artwork_code, style_order_id,
            toile_vendor_id, toile_vendor_name,
            toile_making_cost, toile_cost,
            toil_gst_percentage, toile_payment_amount
     FROM style_order_artworks
     WHERE id = $1 AND is_deleted = false
     FOR UPDATE`,
    [entryId]
  );
  if (!soaRows.length) throw new Error("Toile record not found");
  const soa = soaRows[0];

  if (!soa.toile_vendor_id || !soa.toile_vendor_name) {
    throw new Error("Cannot record a payment for Toile — both vendor id and vendor name must be present.");
  }

  const resolvedVendorId = vendorId ?? parseInt(String(soa.toile_vendor_id));
  if (!resolvedVendorId) {
    throw new Error("Cannot record a payment for Toile — no vendor is assigned.");
  }

  const allocAmt = parseFloat(paymentData.baseAmt ?? "0");
  if (!(allocAmt > 0)) throw new Error("Payment amount must be greater than zero");

  const totalAmount = Number(allocAmt.toFixed(2));
  const gstPct = parseFloat(soa.toil_gst_percentage || "0");
  const payGst  = gstPct > 0 ? Number(((allocAmt * gstPct) / 100).toFixed(2)) : 0;
  const payBase = Number((totalAmount - payGst).toFixed(2));

  const notes = paymentData.remarks
    ? `${paymentData.remarks} (against toile ${soa.artwork_code ?? entryId})`
    : `Toile payment ${soa.artwork_code ?? entryId}`;

  const payRes = await client.query(
    `INSERT INTO costing_payments
       (vendor_id, vendor_name, reference_type, reference_id,
        swatch_order_id, style_order_id,
        payment_type, payment_mode, payment_amount,
        currency_code, exchange_rate_snapshot, base_currency_amount,
        payment_status, transaction_id, payment_date, remarks, created_by)
     VALUES ($1, $2, 'toile', $3, $4, $5,
             $6, $7, $8,
             $9, $10, $11,
             'Completed', $12, $13, $14, $15)
     RETURNING id`,
    [
      resolvedVendorId,
      vendorName || soa.toile_vendor_name || "",
      entryId,
      null,                  
      soa.style_order_id,
      paymentData.paymentType || "Partial",
      paymentData.paymentMode,
      paymentData.amt,
      paymentData.payCcy,
      String(paymentData.payRate),
      totalAmount,
      paymentData.transactionReference || null,
      paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date(),
      notes,
      username,
    ]
  );
  const paymentId = payRes.rows[0].id;

  const currentToilePaid = parseFloat(String(soa.toile_payment_amount ?? "0")) || 0;
  await client.query(
    `UPDATE style_order_artworks SET toile_payment_amount = $1 WHERE id = $2`,
    [(currentToilePaid + totalAmount).toFixed(2), entryId]
  );

  if (!tdsMasterId) return;

  const tdsMaster = await getTDSMaster(client, tdsMasterId);
  if (payBase < (tdsMaster.threshold_amount ?? 0)) return;

  const tdsRate    = tdsMaster.rate_percent;
  const tdsAmount  = Number(((payBase * tdsRate) / 100).toFixed(2));
  const paidAmount = Number((totalAmount - tdsAmount).toFixed(2));

  await insertPaymentTDSRecord(
    client,
    tdsMaster.id,
    "costing_payments",
    paymentId,
    paymentData.paymentDate,
    resolvedVendorId,
    "toile",
    entryId,
    totalAmount, payGst, gstPct, payBase, paidAmount,
    tdsRate, tdsAmount, username
  );
}

async function handleStyleOrderProductPayment(
  client: any,
  sourceId: string,
  vendorId: number | null,
  vendorName: string,
  paymentData: any,
  tdsMasterId: number | undefined,
  username: string
): Promise<void> {
  const entryId = parseInt(sourceId);
  if (Number.isNaN(entryId)) throw new Error("Invalid style order product id");

  const { rows: sopRows } = await client.query(
    `SELECT sop.id, sop.product_name, sop.style_order_id,
            sop.pattern_vendor_id, sop.pattern_vendor_name,
            sop.pattern_payment_amount, sop.gst_percentage,
            st.order_code
     FROM style_order_products sop
     LEFT JOIN style_orders st ON st.id = sop.style_order_id
     WHERE sop.id = $1 AND sop.is_deleted = false
     FOR UPDATE OF sop`,
    [entryId]
  );
  if (!sopRows.length) throw new Error("Style order product not found");
  const sop = sopRows[0];

  if (!sop.pattern_vendor_id || !sop.pattern_vendor_name) {
    throw new Error("Cannot record a payment for Style Order Product — both pattern vendor id and name must be present.");
  }

  const resolvedVendorId = vendorId ?? parseInt(String(sop.pattern_vendor_id));
  if (!resolvedVendorId) {
    throw new Error("Cannot record a payment — no vendor is assigned.");
  }

  const allocAmt = parseFloat(paymentData.baseAmt ?? "0");
  if (!(allocAmt > 0)) throw new Error("Payment amount must be greater than zero");

  const totalAmount = Number(allocAmt.toFixed(2));
  const gstPct = parseFloat(sop.gst_percentage || "0");
  const payGst  = gstPct > 0 ? Number(((allocAmt * gstPct) / 100).toFixed(2)) : 0;
  const payBase = Number((totalAmount - payGst).toFixed(2));

  const refLabel = sop.order_code ?? sop.product_name ?? entryId;
  const notes = paymentData.remarks
    ? `${paymentData.remarks} (against order ${refLabel})`
    : `Style order product payment ${refLabel}`;

  const payRes = await client.query(
    `INSERT INTO costing_payments
       (vendor_id, vendor_name, reference_type, reference_id,
        swatch_order_id, style_order_id,
        payment_type, payment_mode, payment_amount,
        currency_code, exchange_rate_snapshot, base_currency_amount,
        payment_status, transaction_id, payment_date, remarks, created_by)
     VALUES ($1, $2, 'style_order_product', $3, $4, $5,
             $6, $7, $8,
             $9, $10, $11,
             'Completed', $12, $13, $14, $15)
     RETURNING id`,
    [
      resolvedVendorId,
      vendorName || sop.pattern_vendor_name || "",
      entryId,
      null,
      sop.style_order_id,
      paymentData.paymentType || "Partial",
      paymentData.paymentMode,
      paymentData.amt,
      paymentData.payCcy,
      String(paymentData.payRate),
      totalAmount,
      paymentData.transactionReference || null,
      paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date(),
      notes,
      username,
    ]
  );
  const paymentId = payRes.rows[0].id;

  if (!tdsMasterId) return;

  const tdsMaster = await getTDSMaster(client, tdsMasterId);
  if (payBase < (tdsMaster.threshold_amount ?? 0)) return;

  const tdsRate    = tdsMaster.rate_percent;
  const tdsAmount  = Number(((payBase * tdsRate) / 100).toFixed(2));
  const paidAmount = Number((totalAmount - tdsAmount).toFixed(2));

  await insertPaymentTDSRecord(
    client,
    tdsMaster.id,
    "costing_payments",
    paymentId,
    paymentData.paymentDate,
    resolvedVendorId,
    "style_order_product",
    entryId,
    totalAmount, payGst, gstPct, payBase, paidAmount,
    tdsRate, tdsAmount, username
  );
}

async function validatePaymentBalance(
  client: any,
  refType: string,
  sourceId: number,
  newAllocAmt: number
): Promise<void> {
  const SQL_BY_REF: Record<string, string> = {
    "Purchase Receipt": `
      SELECT
        COALESCE(
          pr.vendor_invoice_amount::numeric,
          pr.total_amount_with_gst::numeric,
          items.total_with_gst,
          (pr.received_qty::numeric * pr.actual_price::numeric),
          0
        ) AS total,
        COALESCE(pp.paid, 0) AS paid
      FROM purchase_receipts pr
      LEFT JOIN (
        SELECT pr_id,
               SUM(quantity * unit_price * (1 + COALESCE(gst_percentage, 0) / 100)) AS total_with_gst
        FROM purchase_receipt_items
        WHERE is_deleted = false
        GROUP BY pr_id
      ) items ON items.pr_id = pr.id
      LEFT JOIN (
        SELECT pr_id, SUM(base_currency_amount) AS paid
        FROM pr_payments
        WHERE is_deleted = false
        GROUP BY pr_id
      ) pp ON pp.pr_id = pr.id
      WHERE pr.id = $1 AND pr.is_deleted = false
    `,

    "Costing Outsource": `
      SELECT
        (oj.total_cost::numeric * (1 + COALESCE(oj.gst_percentage::numeric, 0) / 100)) AS total,
        COALESCE(cp.paid, 0) AS paid
      FROM outsource_jobs oj
      LEFT JOIN (
        SELECT reference_id, SUM(base_currency_amount) AS paid
        FROM costing_payments
        WHERE reference_type = 'outsource_job' AND is_deleted = false
        GROUP BY reference_id
      ) cp ON cp.reference_id = oj.id
      WHERE oj.id = $1 AND oj.is_deleted = false
    `,

    "Other Expense": `
      SELECT
        (oe.amount::numeric * (1 + COALESCE(oe.gst_percentage::numeric, 0) / 100)) AS total,
        COALESCE(oe.paid_amount, 0)::numeric AS paid
      FROM other_expenses oe
      WHERE oe.expense_id = $1 AND oe.is_deleted = false
    `,

    "Custom Charge": `
      SELECT
        (cc.total_amount::numeric * (1 + COALESCE(cc.gst_percentage::numeric, 0) / 100)) AS total,
        COALESCE(cp.paid, 0) AS paid
      FROM custom_charges cc
      LEFT JOIN (
        SELECT reference_id, SUM(base_currency_amount) AS paid
        FROM costing_payments
        WHERE reference_type = 'custom_charge' AND is_deleted = false
        GROUP BY reference_id
      ) cp ON cp.reference_id = cc.id
      WHERE cc.id = $1 AND cc.is_deleted = false
    `,

    "Vendor Challan": `
      SELECT
        COALESCE(items.amount, 0) AS total,
        COALESCE(vp.paid, 0)      AS paid
      FROM vendor_challans vc
      LEFT JOIN (
        SELECT vendor_challan_id,
               SUM(amount * (1 + COALESCE(gst_percentage, 0) / 100)) AS amount
        FROM vendor_challan_items
        WHERE is_deleted = false
        GROUP BY vendor_challan_id
      ) items ON items.vendor_challan_id = vc.id
      LEFT JOIN (
        SELECT reference_id, SUM(base_currency_amount) AS paid
        FROM vendor_payments
        WHERE reference_type = 'vendor_challan' AND is_deleted = false
        GROUP BY reference_id
      ) vp ON vp.reference_id = vc.id
      WHERE vc.id = $1 AND vc.is_deleted = false AND vc.status = 'Verified'
    `,

    "Artwork (Swatch)": `
      SELECT
        (
          COALESCE(NULLIF(a.total_cost, '')::numeric, 0)
          * (1 + COALESCE(a.gst_percentage::numeric, 0) / 100)
        ) AS total,
        COALESCE(cp.paid, 0) AS paid
      FROM artworks a
      LEFT JOIN (
        SELECT reference_id, SUM(base_currency_amount) AS paid
        FROM costing_payments
        WHERE reference_type = 'artwork_swatch' AND is_deleted = false
        GROUP BY reference_id
      ) cp ON cp.reference_id = a.id
      WHERE a.id = $1 AND a.is_deleted = false AND a.artwork_created = 'Outsource'
    `,

    "Artwork (Style)": `
      SELECT
        (
          COALESCE(NULLIF(soa.total_cost, '')::numeric, 0)
          * (1 + COALESCE(soa.gst_percentage::numeric, 0) / 100)
        ) AS total,
        COALESCE(cp.paid, 0) AS paid
      FROM style_order_artworks soa
      LEFT JOIN (
        SELECT reference_id, SUM(base_currency_amount) AS paid
        FROM costing_payments
        WHERE reference_type = 'artwork_style' AND is_deleted = false
        GROUP BY reference_id
      ) cp ON cp.reference_id = soa.id
      WHERE soa.id = $1
        AND soa.is_deleted = false
        AND soa.artwork_created = 'Outsource'
    `,

    "Toile": `
      SELECT
        (
          COALESCE(NULLIF(soa.toile_making_cost,''), NULLIF(soa.toile_cost,''))::numeric
          * (1 + COALESCE(soa.toil_gst_percentage::numeric, 0) / 100)
        ) AS total,
        COALESCE(cp.paid, 0) AS paid
      FROM style_order_artworks soa
      LEFT JOIN (
        SELECT reference_id, SUM(base_currency_amount) AS paid
        FROM costing_payments
        WHERE reference_type = 'toile' AND is_deleted = false
        GROUP BY reference_id
      ) cp ON cp.reference_id = soa.id
      WHERE soa.id = $1 AND soa.is_deleted = false
    `,

    "Style Order Product": `
      SELECT
        (
          COALESCE(NULLIF(sop.pattern_payment_amount, '')::numeric, 0)
          * (1 + COALESCE(sop.gst_percentage::numeric, 0) / 100)
        ) AS total,
        COALESCE(cp.paid, 0) AS paid
      FROM style_order_products sop
      LEFT JOIN (
        SELECT reference_id, SUM(base_currency_amount) AS paid
        FROM costing_payments
        WHERE reference_type = 'style_order_product' AND is_deleted = false
        GROUP BY reference_id
      ) cp ON cp.reference_id = sop.id
      WHERE sop.id = $1 AND sop.is_deleted = false
    `,
  };

  const sql = SQL_BY_REF[refType];
  if (!sql) return;   // Artisan / Shipping / unknown — no payable concept yet

  const { rows } = await client.query(sql, [sourceId]);
  if (!rows.length) throw new Error(`Source record not found for ${refType} #${sourceId}`);

  const total = parseFloat(rows[0].total || "0");
  const paid  = parseFloat(rows[0].paid  || "0");

  if (paid + newAllocAmt > total + 0.01) {
    throw new Error(
      `Payment exceeds balance for ${refType} #${sourceId}. ` +
      `Total: ${total.toFixed(2)}, Already paid: ${paid.toFixed(2)}, ` +
      `Attempting: ${newAllocAmt.toFixed(2)}, ` +
      `Max allowed: ${Math.max(0, total - paid).toFixed(2)}`
    );
  }
}

// ============================================================================
// MAIN ROUTE HANDLER
// ============================================================================

router.post("/record-payment", requireAuth, 
  checkPermission({ any: [ACCOUNTS_PURCHASES.ADD_EDIT] }),
  async (req: AuthRequest, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      const { ref_type, source_id, vendor_name, vendor_id, payment_amount, payment_date, payment_type, 
        transaction_reference, remarks, currency_code, exchange_rate_snapshot, tds_master_id, } = req.body as RecordPaymentRequest;

      // Validate payment amount
      await validatePaymentAmount(parseFloat(payment_amount ?? "0"));

      // Calculate payment amounts
      const paymentData = calculatePaymentAmounts( payment_amount, exchange_rate_snapshot, currency_code );

      // Add additional fields to paymentData
      const fullPaymentData = {
        ...paymentData,
        paymentDate: payment_date || new Date().toISOString().slice(0, 10),
        paymentMode: payment_type || "Bank Transfer",
        transactionReference: transaction_reference || "",
        remarks: remarks || "",
      };

      const username = req.user?.email ?? "";
      await validatePaymentBalance(
        client,
        ref_type,
        parseInt(source_id),
        paymentData.baseAmt        
      );

      // Route to appropriate handler based on ref_type
      switch (ref_type) {
        case "Purchase Receipt":
          await handlePurchaseReceiptPayment(
            client,
            source_id,
            vendor_id,
            fullPaymentData,
            tds_master_id,
            username
          );
          break;

        case "Costing Outsource":
          await handleCostingOutsourcePayment(
            client,
            source_id,
            vendor_id,
            vendor_name,
            fullPaymentData,
            tds_master_id,
            username
          );
          break;

        case "Other Expense":
          await handleOtherExpensePayment(
            client,
            source_id,
            vendor_id,
            vendor_name,
            fullPaymentData,
            tds_master_id,
            username
          );
          break;

        case "Custom Charge":
          await handleCustomChargePayment(
            client,
            source_id,
            vendor_id,
            vendor_name,
            fullPaymentData,
            tds_master_id,
            username
          );
          break;

        case "Vendor Challan":
          await handleVendorChallanPayment(
            client,
            source_id,
            Number(vendor_id),          
            vendor_name,
            fullPaymentData,
            tds_master_id,
            username
          );
          break;

        case "Artwork (Swatch)":
          await handleArtworkSwatchPayment(
            client,
            source_id,
            vendor_id ? Number(vendor_id) : null,
            vendor_name,
            fullPaymentData,
            tds_master_id,
            username
          );
          break;

        case "Artwork (Style)":
          await handleArtworkStylePayment(
            client,
            source_id,
            vendor_id ? Number(vendor_id) : null,
            vendor_name,
            fullPaymentData,
            tds_master_id,
            username
          );
          break;

        case "Toile":
          await handleToilePayment(
            client,
            source_id,
            vendor_id ? Number(vendor_id) : null,
            vendor_name,
            fullPaymentData,
            tds_master_id,
            username
          );
          break;
        
        case "Style Order Product":
          await handleStyleOrderProductPayment(
            client,
            source_id,
            vendor_id ? Number(vendor_id) : null,
            vendor_name,
            fullPaymentData,
            tds_master_id,
            username
          );
          break;

        default:
          await handleGenericPayment(
            client,
            ref_type,
            source_id,
            vendor_id ? Number(vendor_id) : null,   
            vendor_name,
            fullPaymentData,
            tds_master_id,
            username
          );
          break;
      }

      await client.query("COMMIT");
      res.json({ message: "Vendor payment recorded successfully" });
      
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.log(err )
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  }
);
export default router;
