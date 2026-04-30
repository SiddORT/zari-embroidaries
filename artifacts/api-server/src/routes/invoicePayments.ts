import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const PAYMENT_TYPES   = ["Cash", "Bank Transfer", "UPI", "Cheque", "Online Gateway", "Adjustment", "Other"] as const;
const PAYMENT_STATUSES = ["Processing", "Completed", "Failed"] as const;

function computeAutoStatus(totalAmt: number, pendingAmt: number, dueDate: string, currentStatus: string): string {
  if (currentStatus === "Draft" || currentStatus === "Sent" || currentStatus === "Cancelled") return currentStatus;
  const today = new Date().toISOString().slice(0, 10);
  if (pendingAmt <= 0)                        return "Paid";
  if (pendingAmt < totalAmt && pendingAmt > 0) return "Partially Paid";
  if (dueDate && dueDate < today)              return "Overdue";
  return "Generated";
}

// ── GET /api/invoice-payments/accounts ──────────────────────────────────────
// Returns all client + vendor invoices enriched with payment summary
router.get("/invoice-payments/accounts", requireAuth, async (req, res) => {
  try {
    const { direction, status, search, page = "1", limit = "30" } = req.query as Record<string, string>;
    const off = (parseInt(page) - 1) * parseInt(limit);

    let where = "WHERE i.invoice_status NOT IN ('Draft','Cancelled')";
    const params: (string | number)[] = [];
    let idx = 1;

    if (direction && direction !== "all") { where += ` AND i.invoice_direction = $${idx++}`; params.push(direction); }
    if (status && status !== "all")       { where += ` AND i.invoice_status = $${idx++}`;    params.push(status); }
    if (search)                           {
      where += ` AND (i.invoice_no ILIKE $${idx} OR c.brand_name ILIKE $${idx} OR v.brand_name ILIKE $${idx++})`;
      params.push(`%${search}%`);
    }

    const countQ = await pool.query(`
      SELECT COUNT(*) AS total
      FROM invoices i
      LEFT JOIN clients c ON c.id = i.client_id
      LEFT JOIN vendors v ON v.id = i.vendor_id
      ${where}
    `, params);

    const rows = await pool.query(`
      SELECT
        i.id, i.invoice_no, i.invoice_direction, i.invoice_type, i.invoice_status,
        i.client_id, i.vendor_id,
        COALESCE(c.brand_name, i.client_name, '') AS party_name,
        COALESCE(v.brand_name, '')                 AS vendor_name,
        i.currency_code, i.exchange_rate_snapshot,
        i.total_amount::numeric,
        i.received_amount::numeric,
        i.pending_amount::numeric,
        i.invoice_date, i.due_date,
        (SELECT COUNT(*) FROM invoice_payments ip WHERE ip.invoice_id = i.id AND ip.payment_status <> 'Failed') AS payment_count,
        (SELECT MAX(ip.payment_date) FROM invoice_payments ip WHERE ip.invoice_id = i.id) AS last_payment_date
      FROM invoices i
      LEFT JOIN clients c ON c.id = i.client_id
      LEFT JOIN vendors v ON v.id = i.vendor_id
      ${where}
      ORDER BY i.invoice_date DESC, i.id DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...params, parseInt(limit), off]);

    return res.json({ data: rows.rows, total: parseInt(countQ.rows[0].total), page: parseInt(page), limit: parseInt(limit) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/invoice-payments?invoice_id=X ──────────────────────────────────
router.get("/invoice-payments", requireAuth, async (req, res) => {
  try {
    const { invoice_id } = req.query;
    if (!invoice_id) return res.status(400).json({ error: "invoice_id required" });

    const rows = await pool.query(`
      SELECT ip.*
      FROM invoice_payments ip
      WHERE ip.invoice_id = $1
      ORDER BY ip.payment_date DESC, ip.payment_id DESC
    `, [invoice_id]);

    return res.json({ data: rows.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/invoice-payments ───────────────────────────────────────────────
router.post("/invoice-payments", requireAuth, async (req: any, res) => {
  const {
    invoice_id, payment_type, payment_amount, currency_code = "INR",
    exchange_rate_snapshot = 1, transaction_reference = "", payment_status = "Completed",
    payment_date, remarks = "",
  } = req.body;

  if (!invoice_id || !payment_amount || !payment_date)
    return res.status(400).json({ error: "invoice_id, payment_amount, payment_date are required" });
  if (!PAYMENT_TYPES.includes(payment_type))
    return res.status(400).json({ error: "Invalid payment_type" });
  if (!PAYMENT_STATUSES.includes(payment_status))
    return res.status(400).json({ error: "Invalid payment_status" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const invRes = await client.query("SELECT * FROM invoices WHERE id = $1 FOR UPDATE", [invoice_id]);
    if (!invRes.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Invoice not found" }); }
    const inv = invRes.rows[0];

    const payAmt   = parseFloat(payment_amount);
    const exRate   = parseFloat(exchange_rate_snapshot) || 1;
    const baseAmt  = parseFloat((payAmt * exRate).toFixed(2));
    const direction = inv.invoice_direction === "Vendor" ? "Paid" : "Received";
    const partyId   = inv.invoice_direction === "Vendor" ? inv.vendor_id : inv.client_id;
    const createdBy = req.user?.email ?? "";

    // Insert payment record
    const pmtRes = await client.query(`
      INSERT INTO invoice_payments
        (invoice_id, payment_direction, party_id, payment_type, payment_amount,
         currency_code, exchange_rate_snapshot, base_currency_amount,
         transaction_reference, payment_status, payment_date, remarks, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [invoice_id, direction, partyId, payment_type, payAmt, currency_code,
        exRate, baseAmt, transaction_reference, payment_status, payment_date, remarks, createdBy]);

    // Recompute totals from all completed payments
    const totRes = await client.query(`
      SELECT COALESCE(SUM(base_currency_amount),0) AS total_received
      FROM invoice_payments
      WHERE invoice_id = $1 AND payment_status = 'Completed'
    `, [invoice_id]);

    const totalReceived = parseFloat(totRes.rows[0].total_received);
    const totalAmt       = parseFloat(inv.total_amount ?? "0");
    const pendingAmt     = parseFloat(Math.max(0, totalAmt - totalReceived).toFixed(2));
    const newStatus      = computeAutoStatus(totalAmt, pendingAmt, inv.due_date ?? "", inv.invoice_status ?? "Generated");

    await client.query(`
      UPDATE invoices SET received_amount=$1, pending_amount=$2, invoice_status=$3, status=$3, updated_at=NOW()
      WHERE id=$4
    `, [totalReceived.toFixed(2), pendingAmt.toFixed(2), newStatus, invoice_id]);

    // Ledger entry
    if (direction === "Received" && inv.client_id) {
      await client.query(`
        INSERT INTO client_invoice_ledger
          (client_id, invoice_id, entry_type, payment_amount, payment_date, transaction_reference, status, created_by)
        VALUES ($1,$2,'Payment Received',$3,$4,$5,$6,$7)
      `, [inv.client_id, invoice_id, payAmt, payment_date, transaction_reference, payment_status, createdBy]);
    } else if (direction === "Paid" && inv.vendor_id) {
      await client.query(`
        INSERT INTO vendor_payments
          (vendor_id, vendor_name, payment_date, amount, payment_mode, reference_no, notes, order_type, created_by)
        SELECT $1, v.brand_name, $2::timestamptz, $3, $4, $5, $6, 'invoice', $7
        FROM vendors v WHERE v.id = $1
      `, [inv.vendor_id, payment_date + "T00:00:00Z", payAmt.toFixed(2), payment_type, transaction_reference, remarks, createdBy]);
    }

    await client.query("COMMIT");
    return res.json({ data: pmtRes.rows[0], invoice_status: newStatus, received_amount: totalReceived, pending_amount: pendingAmt });
  } catch (err: any) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── DELETE /api/invoice-payments/:id ────────────────────────────────────────
router.delete("/invoice-payments/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const pmtRes = await client.query("SELECT * FROM invoice_payments WHERE payment_id=$1", [id]);
    if (!pmtRes.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Payment not found" }); }
    const pmt = pmtRes.rows[0];

    await client.query("DELETE FROM invoice_payments WHERE payment_id=$1", [id]);

    // Recompute invoice totals
    const totRes = await client.query(`
      SELECT COALESCE(SUM(base_currency_amount),0) AS total_received
      FROM invoice_payments WHERE invoice_id=$1 AND payment_status='Completed'
    `, [pmt.invoice_id]);

    const invRes = await client.query("SELECT * FROM invoices WHERE id=$1", [pmt.invoice_id]);
    if (invRes.rows.length) {
      const inv = invRes.rows[0];
      const totalReceived = parseFloat(totRes.rows[0].total_received);
      const totalAmt       = parseFloat(inv.total_amount ?? "0");
      const pendingAmt     = parseFloat(Math.max(0, totalAmt - totalReceived).toFixed(2));
      const newStatus      = computeAutoStatus(totalAmt, pendingAmt, inv.due_date ?? "", inv.invoice_status ?? "Generated");
      await client.query(`
        UPDATE invoices SET received_amount=$1, pending_amount=$2, invoice_status=$3, status=$3, updated_at=NOW()
        WHERE id=$4
      `, [totalReceived.toFixed(2), pendingAmt.toFixed(2), newStatus, pmt.invoice_id]);
    }

    await client.query("COMMIT");
    return res.json({ success: true });
  } catch (err: any) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
