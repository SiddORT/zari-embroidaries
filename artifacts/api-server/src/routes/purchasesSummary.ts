import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/accounts/purchases-summary", requireAuth, async (req, res) => {
  try {
    const { from_date, to_date, vendor_id } = req.query as Record<string, string>;

    const dateGte = (col: string) => from_date ? `AND ${col} >= '${from_date}'::date` : "";
    const dateLte = (col: string) => to_date   ? `AND ${col} <= '${to_date}'::date`   : "";
    const dr      = (col: string) => `${dateGte(col)} ${dateLte(col)}`;
    const vc      = vendor_id ? `AND vendor_id = ${parseInt(vendor_id)}` : "";
    const vcName  = vendor_id ? `AND vendor_id::text = '${parseInt(vendor_id)}'` : "";

    const [
      poRes,
      prRes,
      expenseRes,
    ] = await Promise.all([

      pool.query(`
        SELECT
          COUNT(*)::int                   AS po_count,
          COUNT(CASE WHEN status = 'Approved' THEN 1 END)::int AS approved_count,
          COUNT(CASE WHEN status = 'Pending'  THEN 1 END)::int AS pending_count
        FROM purchase_orders
        WHERE status != 'Cancelled'
          ${dr("po_date")} ${vcName}
      `),

      pool.query(`
        SELECT
          COALESCE(SUM(vendor_invoice_amount), 0)::numeric(18,2) AS total_bills,
          COUNT(*)::int AS bill_count
        FROM purchase_receipts
        WHERE status != 'Cancelled'
          AND vendor_invoice_amount IS NOT NULL
          ${from_date ? `AND COALESCE(vendor_invoice_date, received_date::text) >= '${from_date}'` : ""}
          ${to_date   ? `AND COALESCE(vendor_invoice_date, received_date::text) <= '${to_date}'`   : ""}
          ${vcName}
      `),

      pool.query(`
        SELECT
          COALESCE(SUM(amount), 0)::numeric(18,2)      AS total_expenses,
          COALESCE(SUM(paid_amount), 0)::numeric(18,2) AS paid_expenses,
          COUNT(*)::int                                 AS expense_count
        FROM other_expenses
        WHERE 1=1
          ${dr("expense_date")}
          ${vendor_id ? `AND vendor_id::text = '${parseInt(vendor_id)}'` : ""}
      `),
    ]);

    const poCount         = poRes.rows[0].po_count         || 0;
    const poApproved      = poRes.rows[0].approved_count   || 0;
    const poPending       = poRes.rows[0].pending_count    || 0;
    const totalBills      = parseFloat(prRes.rows[0].total_bills)        || 0;
    const billCount       = prRes.rows[0].bill_count                     || 0;
    const totalExpenses   = parseFloat(expenseRes.rows[0].total_expenses) || 0;
    const paidExpenses    = parseFloat(expenseRes.rows[0].paid_expenses)  || 0;
    const expenseCount    = expenseRes.rows[0].expense_count              || 0;

    // Total vendor payables = bills + expenses
    const totalVendorPayables = totalBills + totalExpenses;
    const totalPaid           = paidExpenses;
    const pendingPayables     = totalVendorPayables - totalPaid;

    res.json({
      poCount,
      poApproved,
      poPending,
      totalBills,
      billCount,
      totalPaid,
      pendingPayables: Math.max(0, pendingPayables),
      totalExpenses,
      paidExpenses,
      expenseCount,
    });
  } catch (e: any) {
    console.error("Purchases summary error:", e);
    res.status(500).json({ error: e?.message ?? "Failed to load purchases summary" });
  }
});

export default router;
