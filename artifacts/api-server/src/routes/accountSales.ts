import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

/* ══════════════════════════════════════════════════════════
   UNIFIED SUMMARY CARDS
══════════════════════════════════════════════════════════ */
router.get("/unified-summary", requireAuth, async (req, res) => {
  try {
    const { from_date, to_date } = req.query as Record<string, string>;

    const df = (col: string) => {
      const parts: string[] = [];
      if (from_date) parts.push(`${col} >= '${from_date}'`);
      if (to_date)   parts.push(`${col} <= '${to_date}'`);
      return parts.length ? "AND " + parts.join(" AND ") : "";
    };

    const [
      invoiceTotals,
      receivedTotals,
      overdueTotals,
      advanceTotals,
    ] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(total_amount),0)    AS total_invoice_amount,
          COALESCE(SUM(received_amount),0) AS total_received,
          COALESCE(SUM(pending_amount),0)  AS total_pending
        FROM invoices
        WHERE invoice_direction = 'Client' ${df("invoice_date")}
      `),
      pool.query(`
        SELECT COALESCE(SUM(payment_amount),0) AS total_payments
        FROM invoice_payments
        WHERE payment_direction = 'Received' ${df("payment_date")}
      `),
      pool.query(`
        SELECT COALESCE(SUM(pending_amount),0) AS overdue_amount
        FROM invoices
        WHERE invoice_direction = 'Client'
          AND pending_amount > 0
          AND due_date IS NOT NULL AND due_date != ''
          AND due_date < CURRENT_DATE::text
          ${from_date ? `AND invoice_date >= '${from_date}'` : ''}
          ${to_date   ? `AND invoice_date <= '${to_date}'`   : ''}
      `),
      pool.query(`
        SELECT COALESCE(SUM(total_amount),0) AS advance_total
        FROM invoices
        WHERE invoice_direction = 'Client'
          AND invoice_type = 'Advance'
          ${df("invoice_date")}
      `),
    ]);

    return res.json({
      total_invoice_amount: invoiceTotals.rows[0].total_invoice_amount,
      total_received:       invoiceTotals.rows[0].total_received,
      total_pending:        invoiceTotals.rows[0].total_pending,
      total_payments:       receivedTotals.rows[0].total_payments,
      overdue_amount:       overdueTotals.rows[0].overdue_amount,
      advance_total:        advanceTotals.rows[0].advance_total,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════
   TOP CLIENTS PENDING
══════════════════════════════════════════════════════════ */
router.get("/top-clients-pending", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(c.brand_name, inv.client_name, 'Unknown') AS client_name,
        inv.client_id,
        COUNT(inv.id)           AS invoice_count,
        SUM(inv.pending_amount) AS total_pending
      FROM invoices inv
      LEFT JOIN clients c ON c.id = inv.client_id
      WHERE inv.invoice_direction = 'Client'
        AND inv.pending_amount > 0
      GROUP BY inv.client_id, COALESCE(c.brand_name, inv.client_name, 'Unknown')
      ORDER BY total_pending DESC
      LIMIT 10
    `);
    return res.json(rows);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════
   UNIFIED RECEIVABLES TABLE
══════════════════════════════════════════════════════════ */
router.get("/unified-receivables", requireAuth, async (req, res) => {
  try {
    const {
      from_date, to_date, client_id, ref_type, status,
      search, ref_no, page = "1", limit = "10",
    } = req.query as Record<string, string>;

    const offset  = (parseInt(page) - 1) * parseInt(limit);
    const pLimit  = parseInt(limit);

    const statusClause  = status && status !== "All"
      ? `AND status = '${status.replace(/'/g, "''")}'` : "";
    const refTypeClause = ref_type
      ? `AND ref_type = '${ref_type.replace(/'/g, "''")}'` : "";
    const clientClause  = client_id
      ? `AND client_id = ${parseInt(client_id)}` : "";
    const searchClause  = search
      ? `AND (LOWER(client_name) LIKE LOWER('%${search.replace(/'/g, "''")}%') OR LOWER(ref_number) LIKE LOWER('%${search.replace(/'/g, "''")}%'))` : "";
    const refNoClause   = ref_no
      ? `AND LOWER(ref_number) LIKE LOWER('%${ref_no.replace(/'/g, "''")}%')` : "";
    const dateFrom = from_date ? `AND date >= '${from_date}'` : "";
    const dateTo   = to_date   ? `AND date <= '${to_date}'`   : "";

    const { rows } = await pool.query(`
      WITH all_receivables AS (

        /* 1. Sales Invoices */
        SELECT
          COALESCE(inv.invoice_type, 'Final Invoice')::text  AS ref_type,
          'inv-' || inv.id::text                             AS source_id,
          COALESCE(inv.invoice_date, inv.created_at::date::text) AS date,
          COALESCE(inv.invoice_no, '')                       AS ref_number,
          COALESCE(c.brand_name, inv.client_name, '—')       AS client_name,
          COALESCE(
            CASE WHEN inv.swatch_order_id IS NOT NULL THEN 'SW-' || inv.swatch_order_id::text
                 WHEN inv.style_order_id  IS NOT NULL THEN 'ST-' || inv.style_order_id::text
                 ELSE inv.reference_id END, '—')             AS order_ref,
          inv.total_amount                                   AS amount,
          inv.received_amount                                AS received_amount,
          inv.pending_amount                                 AS pending_amount,
          COALESCE(inv.currency_code, 'INR')                 AS currency_code,
          CASE
            WHEN inv.pending_amount = 0 AND inv.total_amount > 0                      THEN 'Paid'
            WHEN inv.received_amount > 0 AND inv.pending_amount > 0                   THEN 'Partially Received'
            WHEN inv.due_date IS NOT NULL AND inv.due_date != ''
                 AND inv.due_date < CURRENT_DATE::text AND inv.pending_amount > 0     THEN 'Overdue'
            ELSE 'Pending'
          END                                                AS status,
          inv.client_id,
          inv.id::text                                       AS orig_id
        FROM invoices inv
        LEFT JOIN clients c ON c.id = inv.client_id
        WHERE inv.invoice_direction = 'Client'

        UNION ALL

        /* 2. Credit / Debit Note Adjustments (Client) */
        SELECT
          'Credit Note Adjustment'::text                     AS ref_type,
          'cdn-' || cdn.note_id::text                        AS source_id,
          COALESCE(cdn.note_date, cdn.created_at::date::text) AS date,
          cdn.note_number                                    AS ref_number,
          COALESCE(cdn.party_name, '—')                      AS client_name,
          ''                                                 AS order_ref,
          cdn.note_amount                                    AS amount,
          CASE WHEN cdn.status = 'Applied' THEN cdn.note_amount ELSE 0 END AS received_amount,
          CASE WHEN cdn.status = 'Applied' THEN 0 ELSE cdn.note_amount END AS pending_amount,
          COALESCE(cdn.currency_code, 'INR')                 AS currency_code,
          CASE cdn.status
            WHEN 'Applied' THEN 'Paid'
            WHEN 'Draft'   THEN 'Pending'
            ELSE cdn.status
          END                                                AS status,
          cdn.party_id                                       AS client_id,
          cdn.note_id::text                                  AS orig_id
        FROM credit_debit_notes cdn
        WHERE cdn.party_type = 'Client'

      )
      SELECT *, COUNT(*) OVER () AS total_count
      FROM all_receivables
      WHERE 1=1 ${statusClause} ${refTypeClause} ${clientClause} ${searchClause} ${refNoClause} ${dateFrom} ${dateTo}
      ORDER BY
        CASE status
          WHEN 'Overdue'              THEN 1
          WHEN 'Pending'              THEN 2
          WHEN 'Partially Received'   THEN 3
          WHEN 'Paid'                 THEN 4
          ELSE 5
        END,
        date DESC NULLS LAST,
        amount DESC
      LIMIT ${pLimit} OFFSET ${offset}
    `);

    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
    return res.json({
      data:  rows.map(r => ({ ...r, total_count: undefined })),
      total,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════
   RECORD CLIENT PAYMENT
══════════════════════════════════════════════════════════ */
router.post("/record-payment", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      source_id, ref_type, client_name, client_id,
      payment_amount, payment_type, transaction_id,
      payment_date, currency_code, exchange_rate_snapshot, remarks,
    } = req.body;

    const amt = parseFloat(payment_amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: "Invalid payment amount" });

    await client.query("BEGIN");

    const isInvoice = source_id?.startsWith("inv-");
    const invoiceId = isInvoice ? parseInt(source_id.replace("inv-", "")) : null;

    if (isInvoice && invoiceId) {
      /* 1. Insert into invoice_payments */
      await client.query(`
        INSERT INTO invoice_payments
          (invoice_id, payment_direction, party_id, payment_type, payment_amount,
           currency_code, exchange_rate_snapshot, base_currency_amount,
           transaction_reference, payment_status, payment_date, remarks)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Completed',$10,$11)
      `, [
        invoiceId, "Received", client_id ?? null,
        payment_type ?? "Bank Transfer", amt,
        currency_code ?? "INR",
        parseFloat(exchange_rate_snapshot ?? "1"),
        amt * parseFloat(exchange_rate_snapshot ?? "1"),
        transaction_id ?? "",
        payment_date ?? new Date().toISOString().split("T")[0],
        remarks ?? "",
      ]);

      /* 2. Update invoice received_amount / pending_amount */
      await client.query(`
        UPDATE invoices
        SET
          received_amount = LEAST(total_amount, received_amount + $1),
          pending_amount  = GREATEST(0, pending_amount - $1),
          invoice_status  = CASE
            WHEN GREATEST(0, pending_amount - $1) = 0 THEN 'Paid'
            WHEN received_amount + $1 > 0             THEN 'Partially Paid'
            ELSE invoice_status
          END
        WHERE id = $2
      `, [amt, invoiceId]);

      /* 3. Insert into client_invoice_ledger */
      await client.query(`
        INSERT INTO client_invoice_ledger
          (client_id, invoice_id, entry_type, payment_amount, payment_date,
           transaction_reference, status)
        VALUES ($1,$2,'Payment Received',$3,$4,$5,'Completed')
      `, [
        client_id ?? null, invoiceId, amt,
        payment_date ?? new Date().toISOString().split("T")[0],
        transaction_id ?? "",
      ]);
    }
    /* Credit note adjustments — just log in ledger if client_id exists */
    else if (client_id) {
      await client.query(`
        INSERT INTO client_invoice_ledger
          (client_id, invoice_id, entry_type, payment_amount, payment_date,
           transaction_reference, status)
        VALUES ($1, NULL, $2, $3, $4, $5, 'Completed')
      `, [
        client_id,
        ref_type ?? "Adjustment",
        amt,
        payment_date ?? new Date().toISOString().split("T")[0],
        transaction_id ?? "",
      ]);
    }

    await client.query("COMMIT");
    return res.json({ success: true });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
