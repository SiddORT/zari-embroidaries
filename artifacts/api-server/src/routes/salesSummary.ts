import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/accounts/sales-summary", requireAuth, async (req, res) => {
  try {
    const { from_date, to_date, client_id } = req.query as Record<string, string>;

    const dateGte = (col: string) => from_date ? `AND ${col} >= '${from_date}'::date` : "";
    const dateLte = (col: string) => to_date   ? `AND ${col} <= '${to_date}'::date`   : "";
    const dr      = (col: string) => `${dateGte(col)} ${dateLte(col)}`;
    const cc      = client_id ? `AND client_id = ${parseInt(client_id)}` : "";

    const [
      invoicedRes,
      receivedRes,
      pendingRes,
      overdueRes,
      creditRes,
      shippingRes,
    ] = await Promise.all([

      pool.query(`
        SELECT
          COALESCE(SUM(base_currency_amount), 0)::numeric(18,2) AS total_invoiced,
          COUNT(*)::int AS invoice_count
        FROM invoices
        WHERE invoice_status NOT IN ('Draft','Cancelled')
          ${dr("invoice_date")} ${cc}
      `),

      pool.query(`
        SELECT COALESCE(SUM(base_currency_amount), 0)::numeric(18,2) AS total_received
        FROM invoice_payments
        WHERE 1=1 ${dr("payment_date")}
          ${client_id ? `AND party_id::text = '${parseInt(client_id)}'` : ""}
      `),

      pool.query(`
        SELECT COALESCE(SUM(pending_amount), 0)::numeric(18,2) AS pending
        FROM invoices
        WHERE invoice_status NOT IN ('Draft','Cancelled','Paid')
          ${cc}
      `),

      pool.query(`
        SELECT COALESCE(SUM(pending_amount), 0)::numeric(18,2) AS overdue
        FROM invoices
        WHERE due_date < CURRENT_DATE
          AND invoice_status NOT IN ('Draft','Cancelled','Paid')
          ${cc}
      `),

      pool.query(`
        SELECT
          COALESCE(SUM(base_currency_amount), 0)::numeric(18,2) AS total_credit_notes,
          COUNT(*)::int AS credit_count
        FROM credit_debit_notes
        WHERE note_type = 'Credit'
          AND (status IS NULL OR status NOT IN ('Cancelled'))
          ${dr("note_date")}
          ${client_id ? `AND party_id::text = '${parseInt(client_id)}'` : ""}
      `),

      pool.query(`
        SELECT COALESCE(SUM(COALESCE(shipping_amount, 0)), 0)::numeric(18,2) AS total_shipping
        FROM invoices
        WHERE invoice_status NOT IN ('Draft','Cancelled')
          ${dr("invoice_date")} ${cc}
      `),
    ]);

    const totalInvoiced     = parseFloat(invoicedRes.rows[0].total_invoiced)    || 0;
    const invoiceCount      = invoicedRes.rows[0].invoice_count                 || 0;
    const totalReceived     = parseFloat(receivedRes.rows[0].total_received)    || 0;
    const pending           = parseFloat(pendingRes.rows[0].pending)            || 0;
    const overdue           = parseFloat(overdueRes.rows[0].overdue)            || 0;
    const totalCreditNotes  = parseFloat(creditRes.rows[0].total_credit_notes)  || 0;
    const creditCount       = creditRes.rows[0].credit_count                    || 0;
    const totalShipping     = parseFloat(shippingRes.rows[0].total_shipping)    || 0;
    const netSalesValue     = totalInvoiced - totalCreditNotes;

    res.json({
      totalInvoiced,
      invoiceCount,
      totalReceived,
      pendingReceivables: pending,
      overdueReceivables: overdue,
      totalCreditNotes,
      creditCount,
      shippingRecovered: totalShipping,
      netSalesValue,
    });
  } catch (e: any) {
    console.error("Sales summary error:", e);
    res.status(500).json({ error: e?.message ?? "Failed to load sales summary" });
  }
});

export default router;
