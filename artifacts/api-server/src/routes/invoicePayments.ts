import { Router } from "express";
import { pool, db, invoicePayments, and, eq, desc, inArray, invoicesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { recomputeInvoiceBalances } from "../lib/invoiceBalances";
import { checkPermission } from "../middlewares/checkPermission";
import { ACCOUNTS_PAYMENTS, ACCOUNTS_INVOICES } from "../constants/permissions";

const router = Router();

const PAYMENT_TYPES   = ["Cash", "Bank Transfer", "UPI", "Cheque", "Online Gateway", "Adjustment", "Other"] as const;
const PAYMENT_STATUSES = ["Processing", "Completed", "Failed"] as const;

// ── GET /api/invoice-payments/accounts ──────────────────────────────────────
// Returns all client + vendor invoices enriched with payment summary
router.get("/invoice-payments/accounts", requireAuth, 
  checkPermission({ any: [ACCOUNTS_PAYMENTS.VIEW] }),
  async (req, res) => {
  try {
    const { direction, status, search, page = "1", limit = "30" } = req.query as Record<string, string>;
    const off = (parseInt(page) - 1) * parseInt(limit);

    /* Show all invoices by default; let the status dropdown drive visibility
       (previously Draft/Cancelled were hard-excluded which hid most rows). */
    let where = "WHERE i.is_deleted = false";
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
      LEFT JOIN clients c ON c.id = i.client_id AND c.is_deleted = false
      LEFT JOIN vendors v ON v.id = i.vendor_id AND v.is_deleted = false
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
        (SELECT COUNT(*) FROM invoice_payments ip WHERE ip.invoice_id = i.id AND ip.is_deleted = false AND ip.payment_status <> 'Failed') AS payment_count,
        (SELECT MAX(ip.payment_date) FROM invoice_payments ip WHERE ip.invoice_id = i.id AND ip.is_deleted = false) AS last_payment_date
      FROM invoices i
      LEFT JOIN clients c ON c.id = i.client_id AND c.is_deleted = false
      LEFT JOIN vendors v ON v.id = i.vendor_id AND v.is_deleted = false
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
router.get("/invoice-payments", requireAuth, 
  checkPermission({ any: [ACCOUNTS_PAYMENTS.VIEW] }),
  async (req, res) => {
  try {
    const { invoice_id } = req.query;
    if (!invoice_id) return res.status(400).json({ error: "invoice_id required" });

    const rows = await pool.query(`
      SELECT ip.*
      FROM invoice_payments ip
      WHERE ip.invoice_id = $1 AND ip.is_deleted = false
      ORDER BY ip.payment_date DESC, ip.payment_id DESC
    `, [invoice_id]);

    return res.json({ data: rows.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/invoice-payments ───────────────────────────────────────────────
router.post("/invoice-payments", requireAuth, 
  checkPermission({ any: [ACCOUNTS_PAYMENTS.ADD_EDIT] }),
  async (req: any, res) => {
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

    const invRes = await client.query("SELECT * FROM invoices WHERE id = $1 AND is_deleted = false FOR UPDATE", [invoice_id]);
    if (!invRes.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Invoice not found" }); }
    const inv = invRes.rows[0];

    const payAmt   = parseFloat(payment_amount);
    const exRate   = parseFloat(exchange_rate_snapshot) || 1;
    const baseAmt  = parseFloat((payAmt * exRate).toFixed(2));               // INR anchor
    const direction = inv.invoice_direction === "Vendor" ? "Paid" : "Received";
    const partyId   = inv.invoice_direction === "Vendor" ? inv.vendor_id : inv.client_id;
    const createdBy = req.user?.email ?? "";

    // Over-payment guard, compared in the invoice's own currency
    if (payment_status === "Completed") {
      const invRate = parseFloat(inv.exchange_rate_snapshot ?? "1") || 1;
      const pendingNow = parseFloat(inv.pending_amount ?? "0");
      const amtInInvoiceCcy = baseAmt / invRate;
      if (amtInInvoiceCcy > pendingNow + 0.01) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Payment amount (${amtInInvoiceCcy.toFixed(2)} in invoice currency) exceeds pending balance (${pendingNow.toFixed(2)})`,
        });
      }
    }

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

    // Recompute received/pending in the invoice's currency from the full payment set
    const bal = await recomputeInvoiceBalances(client, invoice_id);
    const totalReceived = bal?.receivedAmount ?? 0;
    const pendingAmt    = bal?.pendingAmount ?? 0;
    const newStatus     = bal?.status ?? (inv.invoice_status ?? "Generated");

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
          (vendor_id, vendor_name, payment_date, amount, currency_code, exchange_rate_snapshot, base_currency_amount, payment_mode, reference_no, notes, order_type, created_by)
        SELECT $1, v.brand_name, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9, 'invoice', $10
        FROM vendors v WHERE v.id = $1
      `, [inv.vendor_id, payment_date + "T00:00:00Z", payAmt.toFixed(2), currency_code, String(exRate), baseAmt, payment_type, transaction_reference, remarks, createdBy]);
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
router.delete("/invoice-payments/:id", requireAuth, 
  checkPermission({ any: [ACCOUNTS_PAYMENTS.DELETE] }),
  async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const pmtRes = await client.query("SELECT * FROM invoice_payments WHERE payment_id=$1 AND is_deleted = false", [id]);
    if (!pmtRes.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Payment not found" }); }
    const pmt = pmtRes.rows[0];

    const deletedByUser = req.user?.email ?? "system";
    await client.query("UPDATE invoice_payments SET is_deleted = true, updated_at = NOW(), deleted_by = $2, deleted_at = now() WHERE payment_id=$1 AND is_deleted = false", [id, deletedByUser]);

    // Recompute invoice totals in the invoice's currency from the remaining payments
    const bal = await recomputeInvoiceBalances(client, pmt.invoice_id);

    await client.query("COMMIT");
    return res.json({
      success: true,
      invoice_status: bal?.status,
      received_amount: bal?.receivedAmount ?? 0,
      pending_amount: bal?.pendingAmount ?? 0,
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- GET /invoice-payments/swatch/:swatchOrderId
router.get(
  "/invoice-payments/swatch/:swatchOrderId",
  requireAuth,
  checkPermission({ any: [ACCOUNTS_PAYMENTS.VIEW, ACCOUNTS_INVOICES.VIEW] }),
  async (req, res) => {
    try {
      const swatchOrderId = parseInt(
        String(req.params.swatchOrderId)
      );

      if (isNaN(swatchOrderId)) {
        return res.status(400).json({
          error: "Invalid swatch order id",
        });
      }

      const rows = await pool.query(
        `
        SELECT ip.*
        FROM invoice_payments ip
        INNER JOIN invoices i
          ON i.id = ip.invoice_id
        WHERE ip.is_deleted = false
          AND i.is_deleted = false
          AND i.swatch_order_id = $1
        ORDER BY ip.payment_date DESC, ip.payment_id DESC
        `,
        [swatchOrderId]
      );

      return res.json({
        data: rows.rows,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err.message,
      });
    }
  }
);

// --- GET /invoice-payments/style/:styleOrderId
router.get(
  "/invoice-payments/style/:styleOrderId",
  requireAuth,
  checkPermission({
    any: [
      ACCOUNTS_PAYMENTS.VIEW,
      ACCOUNTS_INVOICES.VIEW
    ],
  }),
  async (req, res) => {
    try {
      const styleOrderId = parseInt(
        String(req.params.styleOrderId)
      );

      if (isNaN(styleOrderId)) {
        return res.status(400).json({
          error: "Invalid style order id",
        });
      }

      const rows = await pool.query(
        `
        SELECT ip.*
        FROM invoice_payments ip
        INNER JOIN invoices i
          ON i.id = ip.invoice_id
        WHERE ip.is_deleted = false
          AND i.is_deleted = false
          AND i.style_order_id = $1
        ORDER BY ip.payment_date DESC, ip.payment_id DESC
        `,
       [styleOrderId]
      );

      return res.json({
        data: rows.rows,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err.message,
      });
    }
  }
);

// Get invoice payment for refrence
router.get(
  "/invoice-payments/reference/:referenceType/:referenceId",
  requireAuth,
  checkPermission({
    any: [ACCOUNTS_INVOICES.VIEW],
  }),
  async (req, res) => {
    const referenceType = String(req.params.referenceType);
    const referenceId = String(req.params.referenceId);

    if (!referenceType || !referenceId) {
      return res.status(400).json({
        error: "Invalid reference type or reference id",
      });
    }

    // 1. Get all invoices for this reference
    const invoices = await db
      .select({
        id: invoicesTable.id,
      })
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.referenceType, referenceType),
          eq(invoicesTable.referenceId, referenceId),
          eq(invoicesTable.isDeleted, false)
        )
      );

    // No invoices = no payments
    if (invoices.length === 0) {
      return res.json({
        data: [],
      });
    }

    // 2. Extract invoice IDs
    const invoiceIds = invoices.map((invoice) => invoice.id);

    // 3. Get payments for all those invoices
    const rows = await db
      .select()
      .from(invoicePayments)
      .where(
        and(
          inArray(invoicePayments.invoiceId, invoiceIds),
          eq(invoicePayments.isDeleted, false)
        )
      )
      .orderBy(desc(invoicePayments.createdAt));

    return res.json({
      data: rows,
    });
  }
);

export default router;
