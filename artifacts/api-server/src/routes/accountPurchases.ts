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
    const { from_date, to_date, vendor_id, ref_type, status, department,
            search, ref_no, page = "1", limit = "50" } = req.query as Record<string, string>;
    const vid     = vendor_id ? parseInt(vendor_id) : null;
    const offset  = (parseInt(page) - 1) * parseInt(limit);
    const pLimit  = parseInt(limit);

    /* Build per-source vendor filter */
    const vf = (col: string) => vid ? `AND ${col} = ${vid}` : "";

    /* Build status filter (applied after UNION) */
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
      WITH all_liabilities AS (
        /* 1. PR Vendor Invoice Bills */
        SELECT
          'Purchase Receipt'::text            AS ref_type,
          vil.id::text                        AS source_id,
          COALESCE(vil.vendor_invoice_date, vil.created_at::date)::text AS date,
          COALESCE(vil.linked_po_number, vil.pr_number, '')  AS ref_number,
          COALESCE(vil.vendor_name, '—')      AS vendor_name,
          vil.vendor_id::text                 AS vendor_id_text,
          'Purchase Receipt Vendor Bills'     AS department,
          vil.vendor_invoice_amount::numeric  AS amount,
          vil.paid_amount::numeric            AS paid_amount,
          vil.pending_amount::numeric         AS pending_amount,
          vil.status                          AS status,
          COALESCE(vil.currency_code, 'INR')::text AS currency_code,
          COALESCE(vil.exchange_rate_snapshot, 1)::numeric AS exchange_rate_snapshot
        FROM vendor_invoice_ledger vil
        WHERE 1=1
          ${df("COALESCE(vil.vendor_invoice_date, vil.created_at::date)", from_date, to_date)}
          ${vf("vil.vendor_id")}

        UNION ALL

        /* 2. Outsource Jobs */
        SELECT
          'Costing Outsource'::text           AS ref_type,
          oj.id::text                         AS source_id,
          oj.issue_date::text                 AS date,
          COALESCE(sw.order_code, st.order_code, 'OJ-' || oj.id::text) AS ref_number,
          COALESCE(oj.vendor_name, '—')       AS vendor_name,
          oj.vendor_id::text                  AS vendor_id_text,
          'Costing Outsource'                 AS department,
          oj.total_cost::numeric              AS amount,
          COALESCE(cp.paid, 0)                AS paid_amount,
          GREATEST(0, oj.total_cost::numeric - COALESCE(cp.paid, 0)) AS pending_amount,
          CASE
            WHEN COALESCE(cp.paid, 0) >= oj.total_cost::numeric THEN 'Paid'
            WHEN COALESCE(cp.paid, 0) > 0                       THEN 'Partially Paid'
            ELSE 'Unpaid'
          END AS status,
          'INR'::text AS currency_code,
          1::numeric  AS exchange_rate_snapshot
        FROM outsource_jobs oj
        LEFT JOIN swatch_orders sw ON sw.id = oj.swatch_order_id
        LEFT JOIN style_orders  st ON st.id = oj.style_order_id
        LEFT JOIN (
          SELECT reference_id, SUM(base_currency_amount) AS paid
          FROM costing_payments WHERE reference_type = 'outsource_job'
          GROUP BY reference_id
        ) cp ON cp.reference_id = oj.id
        WHERE 1=1
          ${df("oj.issue_date", from_date, to_date)}
          ${vf("oj.vendor_id")}

        UNION ALL

        /* 3. Other Expenses */
        SELECT
          'Other Expense'::text               AS ref_type,
          oe.expense_id::text                 AS source_id,
          oe.expense_date::text               AS date,
          oe.expense_number                   AS ref_number,
          COALESCE(oe.vendor_name, 'N/A')     AS vendor_name,
          oe.vendor_id::text                  AS vendor_id_text,
          oe.expense_category                 AS department,
          oe.amount::numeric                  AS amount,
          COALESCE(oe.paid_amount, 0)::numeric AS paid_amount,
          GREATEST(0, oe.amount::numeric - COALESCE(oe.paid_amount, 0)::numeric) AS pending_amount,
          CASE
            WHEN oe.payment_status = 'Paid' THEN 'Paid'
            WHEN COALESCE(oe.paid_amount, 0) > 0 THEN 'Partially Paid'
            ELSE 'Unpaid'
          END AS status,
          'INR'::text AS currency_code,
          1::numeric  AS exchange_rate_snapshot
        FROM other_expenses oe
        WHERE 1=1
          ${df("oe.expense_date", from_date, to_date)}
          ${vid ? `AND oe.vendor_id = ${vid}` : ""}

        UNION ALL

        /* 4. Artisan Timesheets (internal cost) */
        SELECT
          'Artisan'::text                     AS ref_type,
          at.id::text                         AS source_id,
          at.start_date::text                 AS date,
          COALESCE(sw2.order_code, st2.order_code, 'AT-' || at.id::text) AS ref_number,
          'Internal Artisans'                 AS vendor_name,
          NULL                                AS vendor_id_text,
          'Artisan Labor'                     AS department,
          at.total_rate::numeric              AS amount,
          0::numeric                          AS paid_amount,
          at.total_rate::numeric              AS pending_amount,
          'Pending'                           AS status,
          'INR'::text AS currency_code,
          1::numeric  AS exchange_rate_snapshot
        FROM artisan_timesheets at
        LEFT JOIN swatch_orders sw2 ON sw2.id = at.swatch_order_id
        LEFT JOIN style_orders  st2 ON st2.id = at.style_order_id
        WHERE 1=1
          ${df("at.start_date", from_date, to_date)}
          ${vid ? "AND 1=0" : ""}

        UNION ALL

        /* 5. Shipping */
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
          1::numeric  AS exchange_rate_snapshot
        FROM order_shipping_details osd
        LEFT JOIN shipping_vendors sv ON sv.id = osd.shipping_vendor_id
        WHERE osd.final_shipping_amount IS NOT NULL AND osd.final_shipping_amount > 0
          ${df("osd.shipment_date", from_date, to_date)}
          ${vid ? `AND osd.shipping_vendor_id = ${vid}` : ""}
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
router.post("/record-payment", requireAuth, 
  checkPermission({ any: [ACCOUNTS_PURCHASES.ADD_EDIT] }),
  async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      ref_type, source_id,
      vendor_name, vendor_id,
      payment_amount, payment_date, payment_type,
      transaction_reference, remarks,
      currency_code, exchange_rate_snapshot,
    } = req.body as any;

    const amt = parseFloat(payment_amount ?? "0");
    if (amt <= 0) throw new Error("payment_amount must be > 0");
    const pDate = payment_date || new Date().toISOString().slice(0, 10);
    const pMode = payment_type || "Bank Transfer";
    const payCcy  = currency_code || "INR";
    const payRate = parseFloat(exchange_rate_snapshot ?? "1") || 1;     // pay ccy -> INR
    const baseAmt = parseFloat((amt * payRate).toFixed(2));             // INR anchor

    if (ref_type === "Purchase Receipt") {
      /* Update vendor_invoice_ledger + insert vendor_payments */
      /* Note: pending_amount is a generated column (vendor_invoice_amount - paid_amount) — do NOT update it */
      const id = parseInt(source_id);
      const { rows } = await client.query(`SELECT * FROM vendor_invoice_ledger WHERE id = $1 FOR UPDATE`, [id]);
      if (!rows.length) throw new Error("Bill not found");
      const bill = rows[0];
      if (bill.status === "Cancelled") throw new Error("Cannot record payment on a Cancelled bill");
      if (bill.status === "Paid") throw new Error("Cannot record payment on a Paid bill");
      const billCcyCode = bill.currency_code || "INR";
      const billRate = parseFloat(bill.exchange_rate_snapshot ?? "1") || 1;   // bill ccy -> INR
      const amtInBillCcy = baseAmt / billRate;                                // bill currency
      const prevPaid = parseFloat(bill.paid_amount ?? "0");                   // bill currency
      const totalBill = parseFloat(bill.vendor_invoice_amount);              // bill currency
      const pendingInBillCcy = totalBill - prevPaid;
      if (amtInBillCcy > pendingInBillCcy + 0.01) {
        throw new Error(
          `Payment (${amtInBillCcy.toFixed(2)} ${billCcyCode}) exceeds pending balance (${pendingInBillCcy.toFixed(2)} ${billCcyCode})`
        );
      }
      await client.query(
        `INSERT INTO vendor_payments (vendor_id,vendor_name,payment_date,amount,currency_code,exchange_rate_snapshot,base_currency_amount,payment_mode,reference_no,notes,order_type,vendor_invoice_ledger_id,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'general',$11,$12)`,
        [bill.vendor_id, bill.vendor_name, pDate, amt, payCcy, payRate, baseAmt, pMode, transaction_reference || "", remarks || "", id, req.user?.email ?? ""]
      );
      await recomputeVendorBillBalances(client, id);

    } else if (ref_type === "Costing Outsource") {
      /* Insert into costing_payments — lock the job row first to serialize concurrent payments */
      const id = parseInt(source_id);
      const { rows: jobRows } = await client.query(
        `SELECT * FROM outsource_jobs WHERE id = $1 AND is_deleted = false FOR UPDATE`,
        [id]
      );
      if (!jobRows.length) throw new Error("Outsource job not found");
      await client.query(
        `INSERT INTO costing_payments (vendor_id,vendor_name,reference_type,reference_id,payment_type,payment_mode,payment_amount,currency_code,exchange_rate_snapshot,base_currency_amount,payment_status,transaction_id,payment_date,remarks,created_by)
         VALUES ($1,$2,'outsource_job',$3,'outsource',$4,$5,$6,$7,$8,'Completed',$9,$10,$11,$12)`,
        [vendor_id || null, vendor_name || "", id, pMode, amt, payCcy, payRate, baseAmt, transaction_reference || "", pDate, remarks || "", req.user?.email ?? ""]
      );

    } else if (ref_type === "Other Expense") {
      /* Update other_expenses — lock the row first to serialize concurrent payments */
      const id = parseInt(source_id);
      const { rows } = await client.query(`SELECT * FROM other_expenses WHERE expense_id = $1 FOR UPDATE`, [id]);
      if (!rows.length) throw new Error("Expense not found");
      const exp = rows[0];
      const newPaid   = parseFloat(exp.paid_amount ?? "0") + amt;
      const newStatus = newPaid >= parseFloat(exp.amount) ? "Paid" : "Partially Paid";
      await client.query(
        `UPDATE other_expenses SET paid_amount=$1, payment_status=$2, updated_at=NOW() WHERE expense_id=$3`,
        [newPaid, newStatus, id]
      );
      await client.query(
        `INSERT INTO vendor_payments (vendor_id,vendor_name,payment_date,amount,currency_code,exchange_rate_snapshot,base_currency_amount,payment_mode,reference_no,notes,order_type,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'general',$11)`,
        [vendor_id || null, vendor_name || "", pDate, amt, payCcy, payRate, baseAmt, pMode, transaction_reference || "", remarks || "", req.user?.email ?? ""]
      );

    } else {
      /* Artisan / Shipping / other — just log in vendor_payments */
      await client.query(
        `INSERT INTO vendor_payments (vendor_id,vendor_name,payment_date,amount,currency_code,exchange_rate_snapshot,base_currency_amount,payment_mode,reference_no,notes,order_type,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'general',$11)`,
        [vendor_id || null, vendor_name || "", pDate, amt, payCcy, payRate, baseAmt, pMode, transaction_reference || "", remarks || "", req.user?.email ?? ""]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Vendor payment recorded successfully" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
});

export default router;
