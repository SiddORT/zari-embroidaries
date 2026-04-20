import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

function dateRange(from?: string, to?: string) {
  const now = new Date();
  const fy  = now.getFullYear();
  const dfrom = from || `${fy}-01-01`;
  const dto   = to   || now.toISOString().slice(0, 10);
  return { dfrom, dto };
}

router.get("/reports/filter-options", requireAuth, async (_req, res) => {
  try {
    const [clients, vendors, items] = await Promise.all([
      pool.query(`SELECT id, brand_name FROM clients WHERE brand_name IS NOT NULL ORDER BY brand_name`),
      pool.query(`SELECT id, brand_name FROM vendors WHERE brand_name IS NOT NULL ORDER BY brand_name`),
      pool.query(`SELECT id, item_name FROM inventory_items WHERE is_active = true ORDER BY item_name`),
    ]);
    res.json({
      clients: clients.rows,
      vendors: vendors.rows,
      items:   items.rows,
    });
  } catch (err) {
    console.error("[reports/filter-options]", err);
    res.status(500).json({ error: "Failed to load filter options" });
  }
});

router.get("/reports/stock-summary", requireAuth, async (req, res) => {
  try {
    const { category = "all", item = "all" } = req.query as Record<string, string>;
    const conds: string[] = ["is_active = true"];
    const params: string[] = [];
    if (category !== "all") { params.push(category); conds.push(`source_type = $${params.length}`); }
    if (item !== "all")     { params.push(item);     conds.push(`item_name ILIKE $${params.length}`); }
    const rows = await pool.query(`
      SELECT
        item_name,
        source_type                                                                   AS category,
        unit_type,
        ROUND(current_stock::numeric, 3)                                              AS current_stock,
        ROUND((COALESCE(swatch_reserved_qty,0) + COALESCE(style_reserved_qty,0))::numeric, 3) AS reserved,
        ROUND(available_stock::numeric, 3)                                            AS available,
        ROUND(reorder_level::numeric, 3)                                              AS reorder_level,
        CASE
          WHEN current_stock::numeric <= 0                                            THEN 'Out of Stock'
          WHEN reorder_level::numeric > 0 AND current_stock::numeric <= reorder_level::numeric THEN 'Low Stock'
          ELSE 'In Stock'
        END                                                                           AS stock_status
      FROM inventory_items
      WHERE ${conds.join(" AND ")}
      ORDER BY item_name
    `, params);
    res.json({ data: rows.rows });
  } catch (err) {
    console.error("[reports/stock-summary]", err);
    res.status(500).json({ error: "Failed to load stock summary" });
  }
});

router.get("/reports/stock-movement", requireAuth, async (req, res) => {
  try {
    const { from, to, item = "all" } = req.query as Record<string, string>;
    const { dfrom, dto } = dateRange(from, to);
    const extra: string[] = [];
    const params: (string)[] = [dfrom, dto];
    if (item !== "all") { params.push(item); extra.push(`AND ii.item_name ILIKE $${params.length}`); }
    const rows = await pool.query(`
      SELECT
        TO_CHAR(sl.created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY') AS date,
        ii.item_name,
        ii.unit_type,
        sl.transaction_type,
        COALESCE(sl.reference_number, '—')                                AS reference,
        ROUND(COALESCE(sl.in_quantity,0)::numeric,  3)                   AS qty_in,
        ROUND(COALESCE(sl.out_quantity,0)::numeric, 3)                   AS qty_out,
        ROUND(COALESCE(sl.balance_quantity,0)::numeric, 3)               AS balance
      FROM stock_ledger sl
      JOIN inventory_items ii ON ii.id = sl.item_id
      WHERE sl.created_at BETWEEN $1 AND $2::date + interval '1 day'
        ${extra.join(" ")}
      ORDER BY sl.created_at DESC
      LIMIT 500
    `, params);
    res.json({ data: rows.rows });
  } catch (err) {
    console.error("[reports/stock-movement]", err);
    res.status(500).json({ error: "Failed to load stock movement" });
  }
});

router.get("/reports/purchase-summary", requireAuth, async (req, res) => {
  try {
    const { from, to, vendor = "all" } = req.query as Record<string, string>;
    const { dfrom, dto } = dateRange(from, to);
    const vCond = vendor !== "all" ? `AND v.brand_name ILIKE $3` : "";
    const params: string[] = vendor !== "all" ? [dfrom, dto, vendor] : [dfrom, dto];
    const rows = await pool.query(`
      SELECT
        v.brand_name                                                                             AS vendor,
        COALESCE(SUM(DISTINCT poi.unit_price::numeric * poi.ordered_quantity::numeric), 0)      AS po_amount,
        COALESCE((
          SELECT SUM(actual_price::numeric)
          FROM purchase_receipts pr2
          WHERE pr2.vendor_name = v.brand_name
            AND pr2.received_date::date BETWEEN $1 AND $2
        ), 0)                                                                                   AS pr_value,
        COALESCE(SUM(vil.vendor_invoice_amount), 0)                                             AS vendor_bills,
        COALESCE(SUM(vil.vendor_invoice_amount) - SUM(COALESCE(vil.paid_amount,0)), 0)          AS pending_payables
      FROM vendors v
      LEFT JOIN purchase_orders po
        ON po.vendor_id = v.id AND po.po_date::date BETWEEN $1 AND $2
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
      LEFT JOIN vendor_invoice_ledger vil
        ON vil.vendor_id = v.id AND vil.vendor_invoice_date::date BETWEEN $1 AND $2
      WHERE 1=1 ${vCond}
      GROUP BY v.id, v.brand_name
      HAVING
        COALESCE(SUM(poi.unit_price::numeric * poi.ordered_quantity::numeric), 0) > 0
        OR COALESCE(SUM(vil.vendor_invoice_amount), 0) > 0
      ORDER BY vendor_bills DESC
    `, params);
    res.json({ data: rows.rows });
  } catch (err) {
    console.error("[reports/purchase-summary]", err);
    res.status(500).json({ error: "Failed to load purchase summary" });
  }
});

router.get("/reports/invoice-summary", requireAuth, async (req, res) => {
  try {
    const { from, to, client = "all" } = req.query as Record<string, string>;
    const { dfrom, dto } = dateRange(from, to);
    const conds = [`(invoice_date BETWEEN $1 AND $2 OR created_at::date BETWEEN $1::date AND $2::date)`];
    const params: string[] = [dfrom, dto];
    if (client !== "all") { params.push(client); conds.push(`client_name ILIKE $${params.length}`); }
    const rows = await pool.query(`
      SELECT
        invoice_no,
        client_name,
        COALESCE(invoice_date, TO_CHAR(created_at, 'YYYY-MM-DD'))         AS invoice_date,
        ROUND(COALESCE(total_amount, 0)::numeric, 2)                     AS invoice_amount,
        ROUND(COALESCE(received_amount, 0)::numeric, 2)                  AS received_amount,
        ROUND(COALESCE(pending_amount,  0)::numeric, 2)                  AS pending_amount,
        COALESCE(invoice_status, status, 'Draft')                        AS status
      FROM invoices
      WHERE ${conds.join(" AND ")}
      ORDER BY COALESCE(invoice_date, TO_CHAR(created_at, 'YYYY-MM-DD')) DESC
      LIMIT 500
    `, params);
    res.json({ data: rows.rows });
  } catch (err) {
    console.error("[reports/invoice-summary]", err);
    res.status(500).json({ error: "Failed to load invoice summary" });
  }
});

router.get("/reports/vendor-ledger", requireAuth, async (req, res) => {
  try {
    const { from, to, vendor = "all" } = req.query as Record<string, string>;
    const { dfrom, dto } = dateRange(from, to);
    const conds = [`vil.vendor_invoice_date::date BETWEEN $1 AND $2`];
    const params: string[] = [dfrom, dto];
    if (vendor !== "all") { params.push(vendor); conds.push(`vil.vendor_name ILIKE $${params.length}`); }
    const rows = await pool.query(`
      SELECT
        vil.vendor_name                                                 AS vendor,
        vil.entry_type,
        COALESCE(vil.vendor_invoice_number, vil.pr_number, '—')        AS reference,
        ROUND(COALESCE(vil.vendor_invoice_amount, 0)::numeric, 2)      AS amount,
        ROUND(COALESCE(vil.paid_amount, 0)::numeric, 2)                AS paid,
        ROUND((COALESCE(vil.vendor_invoice_amount,0) - COALESCE(vil.paid_amount,0))::numeric, 2) AS balance,
        TO_CHAR(vil.vendor_invoice_date, 'DD Mon YYYY')                AS date,
        vil.status
      FROM vendor_invoice_ledger vil
      WHERE ${conds.join(" AND ")}
      ORDER BY vil.vendor_invoice_date DESC
      LIMIT 500
    `, params);
    res.json({ data: rows.rows });
  } catch (err) {
    console.error("[reports/vendor-ledger]", err);
    res.status(500).json({ error: "Failed to load vendor ledger" });
  }
});

router.get("/reports/client-ledger", requireAuth, async (req, res) => {
  try {
    const { from, to, client = "all" } = req.query as Record<string, string>;
    const { dfrom, dto } = dateRange(from, to);
    const conds = [`cil.created_at::date BETWEEN $1 AND $2`];
    const params: string[] = [dfrom, dto];
    if (client !== "all") { params.push(client); conds.push(`c.brand_name ILIKE $${params.length}`); }
    const rows = await pool.query(`
      SELECT
        COALESCE(c.brand_name, cil.client_id::text)                    AS client,
        cil.entry_type,
        COALESCE(i.invoice_no, '—')                                    AS reference,
        ROUND(COALESCE(cil.payment_amount, 0)::numeric, 2)             AS amount,
        COALESCE(cil.payment_date, TO_CHAR(cil.created_at, 'YYYY-MM-DD')) AS date,
        cil.status
      FROM client_invoice_ledger cil
      LEFT JOIN clients c  ON c.id  = cil.client_id
      LEFT JOIN invoices i ON i.id  = cil.invoice_id
      WHERE ${conds.join(" AND ")}
      ORDER BY cil.created_at DESC
      LIMIT 500
    `, params);
    res.json({ data: rows.rows });
  } catch (err) {
    console.error("[reports/client-ledger]", err);
    res.status(500).json({ error: "Failed to load client ledger" });
  }
});

router.get("/reports/order-profitability", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;
    const { dfrom, dto } = dateRange(from, to);
    const rows = await pool.query(`
      SELECT
        so.order_code                                                   AS order_id,
        so.client_name,
        'Swatch'                                                        AS order_type,
        ROUND(COALESCE(inv.total_amount, 0)::numeric, 2)               AS invoice_amount,
        ROUND(COALESCE(ship.final_shipping_amount, 0)::numeric, 2)     AS shipping_cost,
        0::numeric                                                      AS total_cost,
        ROUND((COALESCE(inv.total_amount,0) - COALESCE(ship.final_shipping_amount,0))::numeric, 2) AS net_profit
      FROM swatch_orders so
      LEFT JOIN LATERAL (
        SELECT SUM(total_amount::numeric) AS total_amount
        FROM invoices WHERE swatch_order_id = so.id
      ) inv ON true
      LEFT JOIN LATERAL (
        SELECT SUM(final_shipping_amount::numeric) AS final_shipping_amount
        FROM order_shipping_details WHERE reference_id = so.id AND reference_type = 'swatch_order'
      ) ship ON true
      WHERE so.created_at::date BETWEEN $1 AND $2
      UNION ALL
      SELECT
        sto.order_code,
        sto.client_name,
        'Style',
        ROUND(COALESCE(inv.total_amount, 0)::numeric, 2),
        ROUND(COALESCE(ship.final_shipping_amount, 0)::numeric, 2),
        0::numeric,
        ROUND((COALESCE(inv.total_amount,0) - COALESCE(ship.final_shipping_amount,0))::numeric, 2)
      FROM style_orders sto
      LEFT JOIN LATERAL (
        SELECT SUM(total_amount::numeric) AS total_amount
        FROM invoices WHERE style_order_id = sto.id
      ) inv ON true
      LEFT JOIN LATERAL (
        SELECT SUM(final_shipping_amount::numeric) AS final_shipping_amount
        FROM order_shipping_details WHERE reference_id = sto.id AND reference_type = 'style_order'
      ) ship ON true
      WHERE sto.created_at::date BETWEEN $1 AND $2
      ORDER BY invoice_amount DESC NULLS LAST
      LIMIT 300
    `, [dfrom, dto]);
    res.json({ data: rows.rows });
  } catch (err) {
    console.error("[reports/order-profitability]", err);
    res.status(500).json({ error: "Failed to load order profitability" });
  }
});

router.get("/reports/purchase-vs-sales", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;
    const { dfrom, dto } = dateRange(from, to);
    const [sales, purchases, expenses] = await Promise.all([
      pool.query(`
        SELECT ROUND(COALESCE(SUM(total_amount::numeric),0),2) AS total_sales
        FROM invoices
        WHERE (invoice_date BETWEEN $1 AND $2 OR created_at::date BETWEEN $1::date AND $2::date)
      `, [dfrom, dto]),
      pool.query(`
        SELECT ROUND(COALESCE(SUM(poi.unit_price::numeric * poi.ordered_quantity::numeric),0),2) AS total_purchases
        FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.po_id
        WHERE po.po_date AT TIME ZONE 'UTC' BETWEEN $1::timestamptz AND ($2::date + interval '1 day')::timestamptz
      `, [dfrom, dto]),
      pool.query(`
        SELECT ROUND(COALESCE(SUM(amount::numeric),0),2) AS total_expenses
        FROM other_expenses
        WHERE expense_date BETWEEN $1 AND $2
      `, [dfrom, dto]),
    ]);
    const ts = parseFloat(sales.rows[0].total_sales    || "0");
    const tp = parseFloat(purchases.rows[0].total_purchases || "0");
    const te = parseFloat(expenses.rows[0].total_expenses  || "0");
    res.json({
      data: [{
        period:         `${dfrom} to ${dto}`,
        total_sales:    ts,
        total_purchases: tp,
        other_expenses: te,
        net_revenue:    ts - tp - te,
      }],
    });
  } catch (err) {
    console.error("[reports/purchase-vs-sales]", err);
    res.status(500).json({ error: "Failed to load purchase vs sales" });
  }
});

router.get("/reports/gst-summary", requireAuth, async (req, res) => {
  try {
    const { year, month, client, vendor } = req.query as Record<string, string>;
    const gstYear   = parseInt(year  || String(new Date().getFullYear()), 10);
    const gstMonth  = month  && month  !== "all" ? parseInt(month,  10) : null;
    const gstClient = client && client !== "all" ? client : null;
    const gstVendor = vendor && vendor !== "all" ? vendor : null;

    const params: (number | string | null)[] = [gstYear, gstMonth, gstClient, gstVendor];

    const rows = await pool.query(`
      SELECT
        invoice_no                                                                        AS ref_no,
        client_name                                                                       AS party_name,
        'Sales Invoice'                                                                   AS transaction_type,
        ROUND(COALESCE(subtotal_amount, 0), 2)                                           AS taxable_amount,
        ROUND(COALESCE(subtotal_amount,0) * COALESCE(NULLIF(cgst_rate,'')::numeric,0) / 100, 2) AS cgst,
        ROUND(COALESCE(subtotal_amount,0) * COALESCE(NULLIF(sgst_rate,'')::numeric,0) / 100, 2) AS sgst,
        0::numeric                                                                        AS igst,
        ROUND(COALESCE(subtotal_amount,0) * (COALESCE(NULLIF(cgst_rate,'')::numeric,0) + COALESCE(NULLIF(sgst_rate,'')::numeric,0)) / 100, 2) AS total_gst,
        COALESCE(invoice_date, TO_CHAR(created_at, 'YYYY-MM-DD'))                       AS transaction_date
      FROM invoices
      WHERE LEFT(COALESCE(invoice_date, TO_CHAR(created_at,'YYYY-MM-DD')), 4) = $1::text
        AND ($2::int IS NULL OR SUBSTRING(COALESCE(invoice_date, TO_CHAR(created_at,'YYYY-MM-DD')), 6, 2)::int = $2::int)
        AND ($3::text IS NULL OR client_name ILIKE '%' || $3::text || '%')
        AND subtotal_amount IS NOT NULL
        AND COALESCE(NULLIF(cgst_rate,''),'0') != '0'

      UNION ALL

      SELECT
        COALESCE(vendor_invoice_number, pr_number, '—')                                 AS ref_no,
        vendor_name                                                                       AS party_name,
        'Vendor Bill'                                                                     AS transaction_type,
        ROUND(vendor_invoice_amount * 100.0 / 118, 2)                                   AS taxable_amount,
        ROUND(vendor_invoice_amount * 9.0 / 118, 2)                                     AS cgst,
        ROUND(vendor_invoice_amount * 9.0 / 118, 2)                                     AS sgst,
        0::numeric                                                                        AS igst,
        ROUND(vendor_invoice_amount * 18.0 / 118, 2)                                    AS total_gst,
        vendor_invoice_date::text                                                         AS transaction_date
      FROM vendor_invoice_ledger
      WHERE EXTRACT(YEAR FROM vendor_invoice_date) = $1::int
        AND ($2::int IS NULL OR EXTRACT(MONTH FROM vendor_invoice_date) = $2::int)
        AND ($4::text IS NULL OR vendor_name ILIKE '%' || $4::text || '%')

      ORDER BY transaction_date DESC
    `, params);

    const collected = rows.rows.filter(r => r.transaction_type === 'Sales Invoice');
    const paid      = rows.rows.filter(r => r.transaction_type === 'Vendor Bill');

    const sumF = (arr: Record<string, unknown>[], key: string) =>
      arr.reduce((s, r) => s + parseFloat(String(r[key] ?? "0")), 0);

    const summary = {
      collected: {
        cgst:  parseFloat(sumF(collected, 'cgst').toFixed(2)),
        sgst:  parseFloat(sumF(collected, 'sgst').toFixed(2)),
        igst:  parseFloat(sumF(collected, 'igst').toFixed(2)),
        total: parseFloat(sumF(collected, 'total_gst').toFixed(2)),
      },
      paid: {
        cgst:  parseFloat(sumF(paid, 'cgst').toFixed(2)),
        sgst:  parseFloat(sumF(paid, 'sgst').toFixed(2)),
        igst:  parseFloat(sumF(paid, 'igst').toFixed(2)),
        total: parseFloat(sumF(paid, 'total_gst').toFixed(2)),
      },
    };
    const netLiability = parseFloat((summary.collected.total - summary.paid.total).toFixed(2));

    res.json({ data: rows.rows, summary, netLiability });
  } catch (err) {
    console.error("[reports/gst-summary]", err);
    res.status(500).json({ error: "Failed to load GST summary" });
  }
});

export default router;

