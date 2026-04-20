import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/accounts/dashboard", requireAuth, async (req, res) => {
  try {
    const { from_date, to_date, vendor_id, client_id } = req.query as Record<string, string>;

    /* helpers */
    const dateGte = (col: string, val: string | undefined) => val ? `AND ${col} >= '${val}'` : "";
    const dateLte = (col: string, val: string | undefined) => val ? `AND ${col} <= '${val}'` : "";
    const dateRange = (col: string) => `${dateGte(col, from_date)} ${dateLte(col, to_date)}`;

    const clientCond  = client_id ? `AND client_id = ${parseInt(client_id)}` : "";
    const vendorCond  = vendor_id ? `AND vendor_id = ${parseInt(vendor_id)}` : "";

    const [
      salesRes,
      receivedRes,
      vendorBillsRes,
      vendorPaidRes,
      poRes,
      prRes,
      expenseRes,
      shippingRes,
      costingRes,
      salesTrendRes,
      purchTrendRes,
      topClientsRes,
      topVendorsRes,
    ] = await Promise.all([

      /* ── SALES: total invoiced ───────────────────────── */
      pool.query(`
        SELECT
          COALESCE(SUM(base_currency_amount), 0)::numeric(18,2) AS total_invoiced,
          COUNT(*)::int                                          AS invoice_count
        FROM invoices
        WHERE invoice_status NOT IN ('Draft','Cancelled')
          ${dateRange("invoice_date")}
          ${clientCond}
      `),

      /* ── SALES: total received ───────────────────────── */
      pool.query(`
        SELECT
          COALESCE(SUM(base_currency_amount), 0)::numeric(18,2) AS total_received,
          COUNT(*)::int AS payment_count
        FROM invoice_payments
        WHERE 1=1
          ${dateRange("payment_date")}
      `),

      /* ── PURCHASES: vendor bills ─────────────────────── */
      pool.query(`
        SELECT
          COALESCE(SUM(vendor_invoice_amount), 0)::numeric(18,2) AS total_bills,
          COUNT(*)::int                                           AS bill_count
        FROM vendor_invoice_ledger
        WHERE 1=1
          ${from_date ? `AND vendor_invoice_date >= '${from_date}'::date` : ""}
          ${to_date   ? `AND vendor_invoice_date <= '${to_date}'::date`   : ""}
          ${vendorCond}
      `),

      /* ── PURCHASES: paid to vendors ──────────────────── */
      pool.query(`
        SELECT
          COALESCE(SUM(amount::numeric), 0)::numeric(18,2) AS total_paid_vendors,
          COUNT(*)::int                                     AS payment_count
        FROM vendor_payments
        WHERE 1=1
          ${from_date ? `AND payment_date::date >= '${from_date}'::date` : ""}
          ${to_date   ? `AND payment_date::date <= '${to_date}'::date`   : ""}
          ${vendorCond}
      `),

      /* ── PROCUREMENT: purchase orders ────────────────── */
      pool.query(`
        SELECT
          COUNT(*)::int AS po_count,
          COUNT(CASE WHEN status = 'Approved' THEN 1 END)::int AS approved_count,
          COUNT(CASE WHEN status = 'Closed'   THEN 1 END)::int AS closed_count
        FROM purchase_orders
        WHERE 1=1
          ${from_date ? `AND po_date::date >= '${from_date}'::date` : ""}
          ${to_date   ? `AND po_date::date <= '${to_date}'::date`   : ""}
          ${vendorCond}
      `),

      /* ── PROCUREMENT: purchase receipts ──────────────── */
      pool.query(`
        SELECT COUNT(*)::int AS pr_count
        FROM purchase_receipts
        WHERE 1=1
          ${from_date ? `AND received_date::date >= '${from_date}'::date` : ""}
          ${to_date   ? `AND received_date::date <= '${to_date}'::date`   : ""}
      `),

      /* ── OTHER EXPENSES ──────────────────────────────── */
      pool.query(`
        SELECT
          COALESCE(SUM(amount), 0)::numeric(18,2) AS total_expenses,
          COUNT(*)::int                            AS expense_count,
          COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN amount ELSE 0 END), 0)::numeric(18,2) AS paid_expenses,
          COALESCE(SUM(CASE WHEN payment_status = 'Unpaid' THEN amount ELSE 0 END), 0)::numeric(18,2) AS unpaid_expenses
        FROM other_expenses
        WHERE 1=1
          ${dateRange("expense_date")}
          ${vendorCond}
      `),

      /* ── SHIPPING ────────────────────────────────────── */
      pool.query(`
        SELECT
          COALESCE(SUM(final_shipping_amount), 0)::numeric(18,2) AS total_shipping_cost,
          COUNT(*)::int                                           AS shipment_count,
          COUNT(CASE WHEN shipment_status = 'Delivered' THEN 1 END)::int AS delivered_count
        FROM order_shipping_details
        WHERE 1=1
          ${from_date ? `AND shipment_date >= '${from_date}'::date` : ""}
          ${to_date   ? `AND shipment_date <= '${to_date}'::date`   : ""}
      `),

      /* ── COSTING PAYMENTS (for Net Revenue) ──────────── */
      pool.query(`
        SELECT COALESCE(SUM(payment_amount::numeric), 0)::numeric(18,2) AS total_costing_paid
        FROM costing_payments
        WHERE 1=1
          ${from_date ? `AND payment_date::date >= '${from_date}'::date` : ""}
          ${to_date   ? `AND payment_date::date <= '${to_date}'::date`   : ""}
          ${vendorCond}
      `),

      /* ── TREND: monthly sales ────────────────────────── */
      pool.query(`
        SELECT
          to_char(invoice_date::date, 'YYYY-MM') AS month,
          COALESCE(SUM(base_currency_amount), 0)::numeric(18,2) AS sales
        FROM invoices
        WHERE invoice_status NOT IN ('Draft','Cancelled')
          ${dateRange("invoice_date")}
          ${clientCond}
        GROUP BY 1
        ORDER BY 1
      `),

      /* ── TREND: monthly purchases (vendor bills) ─────── */
      pool.query(`
        SELECT
          to_char(vendor_invoice_date, 'YYYY-MM') AS month,
          COALESCE(SUM(vendor_invoice_amount), 0)::numeric(18,2) AS purchases
        FROM vendor_invoice_ledger
        WHERE 1=1
          ${from_date ? `AND vendor_invoice_date >= '${from_date}'::date` : ""}
          ${to_date   ? `AND vendor_invoice_date <= '${to_date}'::date`   : ""}
          ${vendorCond}
        GROUP BY 1
        ORDER BY 1
      `),

      /* ── TOP 5 CLIENTS pending ───────────────────────── */
      pool.query(`
        SELECT
          COALESCE(sub.client_name, 'Unknown') AS client_name,
          sub.client_id,
          COUNT(*)::int                                                  AS invoice_count,
          COALESCE(SUM(sub.base_currency_amount), 0)::numeric(18,2)     AS total_invoiced,
          GREATEST(
            COALESCE(SUM(sub.base_currency_amount), 0) - COALESCE(SUM(sub.paid), 0),
            0
          )::numeric(18,2) AS pending_amount
        FROM (
          SELECT
            i.id,
            i.client_name,
            i.client_id,
            i.base_currency_amount,
            COALESCE(
              (SELECT SUM(ip.base_currency_amount) FROM invoice_payments ip WHERE ip.invoice_id = i.id),
              0
            ) AS paid
          FROM invoices i
          WHERE i.invoice_status NOT IN ('Draft','Cancelled')
            ${dateRange("i.invoice_date")}
            ${clientCond.replace("client_id", "i.client_id")}
        ) sub
        GROUP BY sub.client_name, sub.client_id
        HAVING GREATEST(COALESCE(SUM(sub.base_currency_amount),0) - COALESCE(SUM(sub.paid),0), 0) > 0
        ORDER BY pending_amount DESC
        LIMIT 5
      `),

      /* ── TOP 5 VENDORS pending ───────────────────────── */
      pool.query(`
        SELECT
          vendor_name,
          vendor_id,
          COUNT(*)::int    AS bill_count,
          COALESCE(SUM(pending_amount), 0)::numeric(18,2) AS pending_amount
        FROM vendor_invoice_ledger
        WHERE status != 'Paid'
          ${vendorCond}
        GROUP BY vendor_name, vendor_id
        ORDER BY pending_amount DESC
        LIMIT 5
      `),
    ]);

    /* ── Merge trend data ───────────────────────────────── */
    const salesMap: Record<string, number> = {};
    salesTrendRes.rows.forEach((r: any) => { salesMap[r.month] = parseFloat(r.sales); });
    const purchMap: Record<string, number> = {};
    purchTrendRes.rows.forEach((r: any) => { purchMap[r.month] = parseFloat(r.purchases); });
    const allMonths = Array.from(new Set([...Object.keys(salesMap), ...Object.keys(purchMap)])).sort();
    const trend = allMonths.map(m => ({
      month:     m,
      sales:     salesMap[m]     ?? 0,
      purchases: purchMap[m]     ?? 0,
    }));

    /* ── Compose response ───────────────────────────────── */
    const s   = salesRes.rows[0];
    const rcv = receivedRes.rows[0];
    const vb  = vendorBillsRes.rows[0];
    const vp  = vendorPaidRes.rows[0];
    const po  = poRes.rows[0];
    const pr  = prRes.rows[0];
    const exp = expenseRes.rows[0];
    const sh  = shippingRes.rows[0];
    const cp  = costingRes.rows[0];

    const totalInvoiced    = parseFloat(s.total_invoiced);
    const totalReceived    = parseFloat(rcv.total_received);
    const totalBills       = parseFloat(vb.total_bills);
    const totalPaidVendors = parseFloat(vp.total_paid_vendors);
    const totalExpenses    = parseFloat(exp.total_expenses);
    const costingPaid      = parseFloat(cp.total_costing_paid);
    const netRevenue       = totalReceived - totalPaidVendors - totalExpenses - costingPaid;

    res.json({
      sales: {
        totalInvoiced,
        totalReceived,
        pendingReceivables: Math.max(0, totalInvoiced - totalReceived),
        invoiceCount:       parseInt(s.invoice_count),
      },
      purchases: {
        totalBills,
        totalPaidVendors,
        pendingPayables: Math.max(0, totalBills - totalPaidVendors),
        billCount:        parseInt(vb.bill_count),
      },
      procurement: {
        poCount:      parseInt(po.po_count),
        approvedPos:  parseInt(po.approved_count),
        closedPos:    parseInt(po.closed_count),
        prCount:      parseInt(pr.pr_count),
      },
      expenses: {
        totalExpenses,
        paidExpenses:    parseFloat(exp.paid_expenses),
        unpaidExpenses:  parseFloat(exp.unpaid_expenses),
        expenseCount:    parseInt(exp.expense_count),
      },
      shipping: {
        totalShippingCost: parseFloat(sh.total_shipping_cost),
        shipmentCount:     parseInt(sh.shipment_count),
        deliveredCount:    parseInt(sh.delivered_count),
      },
      netRevenue,
      costingPaid,
      trend,
      topClients: topClientsRes.rows.map((r: any) => ({
        clientName:    r.client_name,
        clientId:      r.client_id,
        invoiceCount:  parseInt(r.invoice_count),
        totalInvoiced: parseFloat(r.total_invoiced),
        pendingAmount: parseFloat(r.pending_amount),
      })),
      topVendors: topVendorsRes.rows.map((r: any) => ({
        vendorName:    r.vendor_name,
        vendorId:      r.vendor_id,
        billCount:     parseInt(r.bill_count),
        pendingAmount: parseFloat(r.pending_amount),
      })),
    });
  } catch (e: any) {
    console.error("Dashboard error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
