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
// router.get("/invoice-payments", requireAuth, 
//   checkPermission({ any: [ACCOUNTS_PAYMENTS.VIEW] }),
//   async (req, res) => {
//   try {
//     const { invoice_id } = req.query;
//     if (!invoice_id) return res.status(400).json({ error: "invoice_id required" });

//     const rows = await pool.query(`
//       SELECT ip.*
//       FROM invoice_payments ip
//       WHERE ip.invoice_id = $1 AND ip.is_deleted = false
//       ORDER BY ip.payment_date DESC, ip.payment_id DESC
//     `, [invoice_id]);

//     return res.json({ data: rows.rows });
//   } catch (err: any) {
//     return res.status(500).json({ error: err.message });
//   }
// });

router.get(
  "/invoice-payments",
  requireAuth,
  checkPermission({ any: [ACCOUNTS_PAYMENTS.VIEW] }),
  async (req, res) => {
    try {
      const { invoice_id } = req.query;
      if (!invoice_id) return res.status(400).json({ error: "invoice_id required" });

      const rows = await pool.query(
        `
        SELECT
          ip.*,
          pt.id                  AS tds_id,
          pt.tds_master_id,
          pt.tds_rate,
          pt.tds_amount,
          pt.base_amount         AS tds_base_amount,
          pt.gst_amount          AS tds_gst_amount,
          pt.gst_percentage      AS tds_gst_percentage,
          pt.paid_amount         AS tds_paid_amount,
          pt.status              AS tds_status,
          tm.section_code        AS tds_section_code,
          tm.service_name        AS tds_service_name,
          tm.rate_percent        AS tds_master_rate
        FROM invoice_payments ip
        LEFT JOIN invoice_payment_tds pt
          ON pt.payment_id = ip.payment_id
         AND pt.is_deleted = false
        LEFT JOIN tds_master tm
          ON tm.id = pt.tds_master_id
        WHERE ip.invoice_id = $1
          AND ip.is_deleted = false
        ORDER BY ip.payment_date DESC, ip.payment_id DESC
        `,
        [invoice_id]
      );

      return res.json({ data: rows.rows });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
);


// ── POST /api/invoice-payments ───────────────────────────────────────────────
// router.post("/invoice-payments", requireAuth, 
//   checkPermission({ any: [ACCOUNTS_PAYMENTS.ADD_EDIT] }),
//   async (req: any, res) => {
//   const {
//     invoice_id, payment_type, payment_amount, currency_code = "INR",
//     exchange_rate_snapshot = 1, transaction_reference = "", payment_status = "Completed",
//     payment_date, remarks = "",
//   } = req.body;

//   if (!invoice_id || !payment_amount || !payment_date)
//     return res.status(400).json({ error: "invoice_id, payment_amount, payment_date are required" });
//   if (!PAYMENT_TYPES.includes(payment_type))
//     return res.status(400).json({ error: "Invalid payment_type" });
//   if (!PAYMENT_STATUSES.includes(payment_status))
//     return res.status(400).json({ error: "Invalid payment_status" });

//   const client = await pool.connect();
//   try {
//     await client.query("BEGIN");

//     const invRes = await client.query("SELECT * FROM invoices WHERE id = $1 AND is_deleted = false FOR UPDATE", [invoice_id]);
//     if (!invRes.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Invoice not found" }); }
//     const inv = invRes.rows[0];

//     const payAmt   = parseFloat(payment_amount);
//     const exRate   = parseFloat(exchange_rate_snapshot) || 1;
//     const baseAmt  = parseFloat((payAmt * exRate).toFixed(2));               // INR anchor
//     const direction = inv.invoice_direction === "Vendor" ? "Paid" : "Received";
//     const partyId   = inv.invoice_direction === "Vendor" ? inv.vendor_id : inv.client_id;
//     const createdBy = req.user?.email ?? "";

//     // Over-payment guard, compared in the invoice's own currency
//     if (payment_status === "Completed") {
//       const invRate = parseFloat(inv.exchange_rate_snapshot ?? "1") || 1;
//       const pendingNow = parseFloat(inv.pending_amount ?? "0");
//       const amtInInvoiceCcy = baseAmt / invRate;
//       if (amtInInvoiceCcy > pendingNow + 0.01) {
//         await client.query("ROLLBACK");
//         return res.status(400).json({
//           error: `Payment amount (${amtInInvoiceCcy.toFixed(2)} in invoice currency) exceeds pending balance (${pendingNow.toFixed(2)})`,
//         });
//       }
//     }

//     // Insert payment record
//     const pmtRes = await client.query(`
//       INSERT INTO invoice_payments
//         (invoice_id, payment_direction, party_id, payment_type, payment_amount,
//          currency_code, exchange_rate_snapshot, base_currency_amount,
//          transaction_reference, payment_status, payment_date, remarks, created_by)
//       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
//       RETURNING *
//     `, [invoice_id, direction, partyId, payment_type, payAmt, currency_code,
//         exRate, baseAmt, transaction_reference, payment_status, payment_date, remarks, createdBy]);

//     // Recompute received/pending in the invoice's currency from the full payment set
//     const bal = await recomputeInvoiceBalances(client, invoice_id);
//     const totalReceived = bal?.receivedAmount ?? 0;
//     const pendingAmt    = bal?.pendingAmount ?? 0;
//     const newStatus     = bal?.status ?? (inv.invoice_status ?? "Generated");

//     // Ledger entry
//     if (direction === "Received" && inv.client_id) {
//       await client.query(`
//         INSERT INTO client_invoice_ledger
//           (client_id, invoice_id, entry_type, payment_amount, payment_date, transaction_reference, status, created_by)
//         VALUES ($1,$2,'Payment Received',$3,$4,$5,$6,$7)
//       `, [inv.client_id, invoice_id, payAmt, payment_date, transaction_reference, payment_status, createdBy]);
//     } else if (direction === "Paid" && inv.vendor_id) {
//       await client.query(`
//         INSERT INTO vendor_payments
//           (vendor_id, vendor_name, payment_date, amount, currency_code, exchange_rate_snapshot, base_currency_amount, payment_mode, reference_no, notes, order_type, created_by)
//         SELECT $1, v.brand_name, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9, 'invoice', $10
//         FROM vendors v WHERE v.id = $1
//       `, [inv.vendor_id, payment_date + "T00:00:00Z", payAmt.toFixed(2), currency_code, String(exRate), baseAmt, payment_type, transaction_reference, remarks, createdBy]);
//     }

//     await client.query("COMMIT");
//     return res.json({ data: pmtRes.rows[0], invoice_status: newStatus, received_amount: totalReceived, pending_amount: pendingAmt });
//   } catch (err: any) {
//     await client.query("ROLLBACK");
//     return res.status(500).json({ error: err.message });
//   } finally {
//     client.release();
//   }
// });

// ============================================================================
// INVOICE PAYMENT HELPERS
// ============================================================================

interface InvoiceLineBalance {
  id: number;
  lineNo: number;
  taxable: number;   // invoice_line_items.total (qty × unit_price, ex-GST)
  gst: number;       // taxable × gstPct / 100
  gstPct: number;
  gross: number;     // taxable + gst
  remaining: number; // gross − already-allocated gross
}

interface InvoiceAllocation {
  lineId: number;
  allocGross: number;
  allocTaxable: number;
  allocGst: number;
  gstPct: number;
  tdsAmount: number;
  netReceived: number;
}

async function getInvoiceLineBalances(
  client: any,
  invoiceId: number
): Promise<InvoiceLineBalance[]> {
  const { rows } = await client.query(
    `SELECT
       ili.id,
       ili.line_no,
       ili.total::numeric          AS total,
       ili.hsn_gst_pct,
       ili.created_at,
       COALESCE(SUM(ipi.allocated_gross_amount), 0)::numeric AS allocated
     FROM invoice_line_items ili
     LEFT JOIN invoice_payment_items ipi
       ON ipi.invoice_line_item_id = ili.id
     WHERE ili.invoice_id = $1 AND ili.is_deleted = false
     GROUP BY ili.id, ili.line_no, ili.total, ili.hsn_gst_pct, ili.created_at
     ORDER BY ili.created_at ASC, ili.id ASC`,
    [invoiceId]
  );

  return rows.map((r: any) => {
    const taxable = parseFloat(String(r.total ?? "0"));
    const gstPct  = parseFloat(String(r.hsn_gst_pct ?? "0")) || 0;
    const gst     = gstPct > 0 ? (taxable * gstPct) / 100 : 0;
    const gross   = taxable + gst;

    const allocated = parseFloat(String(r.allocated ?? "0"));
    const remaining = Math.max(0, gross - allocated);

    return { id: r.id, lineNo: r.line_no, taxable, gst, gstPct, gross, remaining };
  });
}

function allocateInvoiceWaterfall(
  amountToAllocate: number,
  lines: InvoiceLineBalance[],
  tdsRate: number,
  tdsThreshold: number
): { allocations: InvoiceAllocation[]; unallocated: number } {
  let remainingAmount = amountToAllocate;
  const allocations: InvoiceAllocation[] = [];

  for (const line of lines) {
    if (remainingAmount <= 0.001) break;
    if (line.remaining <= 0.001) continue;

    const allocGross = Math.min(remainingAmount, line.remaining);

    // Split allocated gross proportionally into base + GST using the line's ratio.
    const allocTaxable = line.gross > 0
      ? allocGross * (line.taxable / line.gross)
      : allocGross;
    const allocGst = allocGross - allocTaxable;

    const tdsApplicable = allocTaxable >= tdsThreshold;
    const tdsAmount     = tdsApplicable ? (allocTaxable * tdsRate) / 100 : 0;
    const netReceived   = allocGross - tdsAmount;

    allocations.push({
      lineId: line.id,
      allocGross,
      allocTaxable,
      allocGst,
      gstPct: line.gstPct,
      tdsAmount,
      netReceived,
    });

    remainingAmount -= allocGross;
  }

  return { allocations, unallocated: remainingAmount };
}

async function insertInvoicePaymentItems(
  client: any,
  paymentId: number,
  invoiceId: number,
  allocations: InvoiceAllocation[],
  username: string
): Promise<Map<number, number>> {
  const lineToPaymentItem = new Map<number, number>();
  let seq = 1;

  for (const a of allocations) {
    const res = await client.query(
      `INSERT INTO invoice_payment_items
         (payment_id, invoice_id, invoice_line_item_id,
          allocated_gross_amount, allocated_taxable_amount,
          net_received_amount, allocation_sequence, remarks, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        paymentId,
        invoiceId,
        a.lineId,
        a.allocGross.toFixed(4),
        a.allocTaxable.toFixed(4),
        a.netReceived.toFixed(4),
        seq++,
        "",
        username,
      ]
    );
    lineToPaymentItem.set(a.lineId, res.rows[0].id);
  }

  return lineToPaymentItem;
}

async function insertInvoicePaymentTds(
  client: any,
  tdsMasterId: number,
  paymentId: number,
  paymentDate: string | Date,
  partyId: number,
  invoiceId: number,
  grossAmount: number,
  gstAmount: number,
  gstPercentage: number,
  baseAmount: number,
  paidAmount: number,
  tdsRate: number,
  tdsAmount: number,
  paymentCurrencyCode: string,
  paymentExchangeRate: number,
  eligibleAllocations: Array<InvoiceAllocation & { paymentItemId: number }>,
  username: string
): Promise<number> {
  const tdsRes = await client.query(
    `INSERT INTO invoice_payment_tds
       (tds_master_id, payment_id, payment_date, client_id, invoice_id,
        gross_amount, gst_amount, gst_percentage,
        payment_currency_code, payment_exchange_rate,
        base_amount, paid_amount, tds_rate, tds_amount, status, created_by)
     VALUES ($1,$2,$3,$4,$5,
             $6,$7,$8,
             $9,$10,
             $11,$12,$13,$14,'DEDUCTED',$15)
     RETURNING id`,
    [
      tdsMasterId,
      paymentId,
      paymentDate ? new Date(paymentDate) : new Date(),
      partyId,
      invoiceId,
      grossAmount.toFixed(2),
      gstAmount.toFixed(2),
      gstPercentage.toFixed(2),
      paymentCurrencyCode,
      paymentExchangeRate.toFixed(6),
      baseAmount.toFixed(2),
      paidAmount.toFixed(2),
      tdsRate.toFixed(2),
      tdsAmount.toFixed(2),
      username,
    ]
  );
  const tdsId = tdsRes.rows[0].id;

  for (const a of eligibleAllocations) {
    await client.query(
      `INSERT INTO invoice_payment_tds_items
         (invoice_payment_tds_id, invoice_line_item_id, payment_item_id,
          base_amount, gst_amount, gst_percentage,
          tds_rate, tds_amount, paid_amount, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        tdsId,
        a.lineId,
        a.paymentItemId,
        a.allocTaxable.toFixed(2),
        a.allocGst.toFixed(2),
        a.gstPct.toFixed(2),
        tdsRate.toFixed(2),
        a.tdsAmount.toFixed(2),
        a.netReceived.toFixed(2),
        username,
      ]
    );
  }

  return tdsId;
}

router.post(
  "/invoice-payments",
  requireAuth,
  checkPermission({ any: [ACCOUNTS_PAYMENTS.ADD_EDIT] }),
  async (req: any, res) => {
    const {
      invoice_id, payment_type, payment_amount, currency_code = "INR",
      exchange_rate_snapshot = 1, transaction_reference = "",
      payment_status = "Completed", payment_date, remarks = "",
      tds_master_id,
    } = req.body;

    if (!invoice_id || !payment_amount || !payment_date)
      return res.status(400).json({ error: "invoice_id, payment_amount, payment_date are required" });
    if (!PAYMENT_TYPES.includes(payment_type))
      return res.status(400).json({ error: "Invalid payment_type" });
    if (!PAYMENT_STATUSES.includes(payment_status))
      return res.status(400).json({ error: "Invalid payment_status" });

    const client = await pool.connect();
    let began = false;
    try {
      await client.query("BEGIN");
      began = true;

      // 1. Lock the invoice
      const invRes = await client.query(
        "SELECT * FROM invoices WHERE id = $1 AND is_deleted = false FOR UPDATE",
        [invoice_id]
      );
      if (!invRes.rows.length) {
        await client.query("ROLLBACK"); began = false;
        return res.status(404).json({ error: "Invoice not found" });
      }
      const inv = invRes.rows[0];

      const payAmt   = parseFloat(payment_amount);
      const exRate   = parseFloat(exchange_rate_snapshot) || 1;
      const baseAmt  = parseFloat((payAmt * exRate).toFixed(2));   // INR anchor
      const direction = inv.invoice_direction === "Vendor" ? "Paid" : "Received";
      const partyId   = inv.invoice_direction === "Vendor" ? inv.vendor_id : inv.client_id;
      const createdBy = req.user?.email ?? "";

      const invRate    = parseFloat(inv.exchange_rate_snapshot ?? "1") || 1;
      const pendingNow = parseFloat(inv.pending_amount ?? "0");

      // 2. Overpayment guard — compared in the invoice's own currency
      if (payment_status === "Completed") {
        const amtInInvoiceCcy = baseAmt / invRate;
        if (amtInInvoiceCcy > pendingNow + 0.01) {
          await client.query("ROLLBACK"); began = false;
          return res.status(400).json({
            error: `Payment amount (${amtInInvoiceCcy.toFixed(2)} in invoice currency) exceeds pending balance (${pendingNow.toFixed(2)})`,
          });
        }
      }

      // 3. Resolve TDS master (if provided)
      let tdsMaster: { id: number; rate_percent: number; threshold_amount: number } | null = null;
      if (tds_master_id) {
        const tdsRes = await client.query(
          `SELECT id, rate_percent::numeric AS rate_percent,
                  threshold_amount::numeric AS threshold_amount
             FROM tds_master
            WHERE id = $1 AND status = true AND is_deleted = false`,
          [tds_master_id]
        );
        if (!tdsRes.rows.length) {
          await client.query("ROLLBACK"); began = false;
          return res.status(400).json({ error: `Invalid or inactive TDS master (ID: ${tds_master_id})` });
        }
        tdsMaster = {
          id: tdsRes.rows[0].id,
          rate_percent: parseFloat(tdsRes.rows[0].rate_percent),
          threshold_amount: parseFloat(tdsRes.rows[0].threshold_amount || "0"),
        };
      }

      // 4. Amount to allocate, expressed in invoice currency
      const allocAmtInInvoiceCcy = parseFloat((baseAmt / invRate).toFixed(2));

      // 5. Load line balances and run waterfall
      const lineBalances = await getInvoiceLineBalances(client, invoice_id);
      if (lineBalances.length === 0) {
        await client.query("ROLLBACK"); began = false;
        return res.status(400).json({ error: "Invoice has no line items — cannot allocate payment." });
      }

      const tdsRate      = tdsMaster?.rate_percent ?? 0;
      const tdsThreshold = tdsMaster?.threshold_amount ?? 0;

      const { allocations, unallocated } = allocateInvoiceWaterfall(
        allocAmtInInvoiceCcy,
        lineBalances,
        tdsRate,
        tdsThreshold
      );

      if (unallocated > 0.01) {
        await client.query("ROLLBACK"); began = false;
        return res.status(400).json({
          error: `Amount exceeds total outstanding balance on this invoice by ${unallocated.toFixed(2)}.`,
        });
      }
      if (allocations.length === 0) {
        await client.query("ROLLBACK"); began = false;
        return res.status(400).json({ error: "Nothing to allocate — invoice is already fully paid." });
      }

      // 6. Insert the aggregate payment row
      const pmtRes = await client.query(`
        INSERT INTO invoice_payments
          (invoice_id, payment_direction, party_id, payment_type, payment_amount,
           currency_code, exchange_rate_snapshot, base_currency_amount,
           transaction_reference, payment_status, payment_date, remarks, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING *
      `, [invoice_id, direction, partyId, payment_type, payAmt, currency_code,
          exRate, baseAmt, transaction_reference, payment_status, payment_date, remarks, createdBy]);

      const paymentId = pmtRes.rows[0].payment_id;

      // 7. Insert invoice_payment_items (line-level allocation)
      const lineToPaymentItem = await insertInvoicePaymentItems(
        client, paymentId, invoice_id, allocations, createdBy
      );

      // 8. Insert TDS aggregate + per-line rows
      if (tdsMaster) {
        const eligible = allocations.filter(a => a.tdsAmount > 0);

        if (eligible.length > 0) {
          const totalGross   = allocations.reduce((s, a) => s + a.allocGross, 0);
          const totalTaxable = allocations.reduce((s, a) => s + a.allocTaxable, 0);
          const totalGst     = allocations.reduce((s, a) => s + a.allocGst, 0);
          const totalTds     = eligible.reduce((s, a) => s + a.tdsAmount, 0);

          // TDS tables store INR (base). Convert invoice ccy → INR via invRate.
          const grossINR      = totalGross   * invRate;
          const taxableINR    = totalTaxable * invRate;
          const gstINR        = totalGst     * invRate;
          const tdsINR        = totalTds     * invRate;
          const paidINR       = (totalGross - totalTds) * invRate;
          const blendedGstPct = totalTaxable > 0 ? (totalGst / totalTaxable) * 100 : 0;

          const eligibleWithItems = eligible.map(a => ({
            ...a,
            paymentItemId: lineToPaymentItem.get(a.lineId)!,
          }));

          await insertInvoicePaymentTds(
            client,
            tdsMaster.id,
            paymentId,
            payment_date,
            partyId,
            invoice_id,
            grossINR,
            gstINR,
            blendedGstPct,
            taxableINR,
            paidINR,
            tdsRate,
            tdsINR,
            currency_code,
            exRate,
            eligibleWithItems,
            createdBy
          );
        }
      }

      // 9. Recompute invoice balances
      const bal = await recomputeInvoiceBalances(client, invoice_id);
      const totalReceived = bal?.receivedAmount ?? 0;
      const pendingAmt    = bal?.pendingAmount ?? 0;
      const newStatus     = bal?.status ?? (inv.invoice_status ?? "Generated");

      // 10. Ledger entries
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
      began = false;
      return res.json({
        data: pmtRes.rows[0],
        invoice_status: newStatus,
        received_amount: totalReceived,
        pending_amount: pendingAmt,
        allocations: allocations.map(a => ({
          line_id: a.lineId,
          gross: a.allocGross.toFixed(2),
          taxable: a.allocTaxable.toFixed(2),
          gst: a.allocGst.toFixed(2),
          tds: a.tdsAmount.toFixed(2),
          net: a.netReceived.toFixed(2),
        })),
      });
    } catch (err: any) {
      if (began) { try { await client.query("ROLLBACK"); } catch {} }
      console.error("Error in /invoice-payments:", err);
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }
);

// ── DELETE /api/invoice-payments/:id ────────────────────────────────────────
// router.delete("/invoice-payments/:id", requireAuth, 
//   checkPermission({ any: [ACCOUNTS_PAYMENTS.DELETE] }),
//   async (req, res) => {
//   const id = parseInt(String(req.params.id));
//   if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

//   const client = await pool.connect();
//   try {
//     await client.query("BEGIN");

//     const pmtRes = await client.query("SELECT * FROM invoice_payments WHERE payment_id=$1 AND is_deleted = false", [id]);
//     if (!pmtRes.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Payment not found" }); }
//     const pmt = pmtRes.rows[0];

//     const deletedByUser = req.user?.email ?? "system";
//     await client.query("UPDATE invoice_payments SET is_deleted = true, updated_at = NOW(), deleted_by = $2, deleted_at = now() WHERE payment_id=$1 AND is_deleted = false", [id, deletedByUser]);

//     // Recompute invoice totals in the invoice's currency from the remaining payments
//     const bal = await recomputeInvoiceBalances(client, pmt.invoice_id);

//     await client.query("COMMIT");
//     return res.json({
//       success: true,
//       invoice_status: bal?.status,
//       received_amount: bal?.receivedAmount ?? 0,
//       pending_amount: bal?.pendingAmount ?? 0,
//     });
//   } catch (err: any) {
//     await client.query("ROLLBACK");
//     return res.status(500).json({ error: err.message });
//   } finally {
//     client.release();
//   }
// });

router.delete(
  "/invoice-payments/:id",
  requireAuth,
  checkPermission({ any: [ACCOUNTS_PAYMENTS.DELETE] }),
  async (req, res) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const client = await pool.connect();
    let began = false;
    try {
      await client.query("BEGIN");
      began = true;

      const deletedBy = req.user?.email ?? "system";
      const now = new Date();

      // 1. Lock the payment row
      const pmtRes = await client.query(
        `SELECT * FROM invoice_payments
          WHERE payment_id = $1 AND is_deleted = false
          FOR UPDATE`,
        [id]
      );
      if (!pmtRes.rows.length) {
        await client.query("ROLLBACK"); began = false;
        return res.status(404).json({ error: "Payment not found" });
      }
      const pmt = pmtRes.rows[0];

      // 2. Soft-delete child TDS items (deepest level)
      const tdsRes = await client.query(
        `SELECT id FROM invoice_payment_tds
          WHERE payment_id = $1 AND is_deleted = false`,
        [id]
      );
      const tdsIds = tdsRes.rows.map((r: any) => r.id);

      if (tdsIds.length > 0) {
        await client.query(
          `UPDATE invoice_payment_tds_items
              SET is_deleted = true, deleted_by = $2, deleted_at = $3, updated_by = $2, updated_at = $3
            WHERE invoice_payment_tds_id = ANY($1::int[])
              AND is_deleted = false`,
          [tdsIds, deletedBy, now]
        );
      }

      // 3. Soft-delete the TDS aggregate rows
      await client.query(
        `UPDATE invoice_payment_tds
            SET is_deleted = true, deleted_by = $2, deleted_at = $3, updated_by = $2, updated_at = $3
          WHERE payment_id = $1
            AND is_deleted = false`,
        [id, deletedBy, now]
      );

      // 4. Soft-delete the payment item allocations
      await client.query(
        `UPDATE invoice_payment_items
            SET is_deleted = true, deleted_by = $2, deleted_at = $3, updated_by = $2, updated_at = $3
          WHERE payment_id = $1
            AND is_deleted = false`,
        [id, deletedBy, now]
      );

      // 5. Soft-delete the payment row itself
      await client.query(
        `UPDATE invoice_payments
           SET is_deleted = true, updated_at = NOW(), updated_by = $2, deleted_by = $2, deleted_at = $3
          WHERE payment_id = $1
            AND is_deleted = false`,
        [id, deletedBy, now]
      );

      // 6. Recompute invoice totals from the remaining payments
      const bal = await recomputeInvoiceBalances(client, pmt.invoice_id);

      await client.query("COMMIT");
      began = false;
      return res.json({
        success: true,
        invoice_status: bal?.status,
        received_amount: bal?.receivedAmount ?? 0,
        pending_amount: bal?.pendingAmount ?? 0,
      });
    } catch (err: any) {
      if (began) { try { await client.query("ROLLBACK"); } catch {} }
      console.error("Error deleting invoice payment:", err);
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }
);

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

    try {
      const query = `
        SELECT 
          ip.payment_id,
          ip.invoice_id,
          ip.payment_direction,
          ip.party_id,
          ip.payment_type,
          ip.payment_amount,
          ip.currency_code,
          ip.exchange_rate_snapshot,
          ip.base_currency_amount,
          ip.transaction_reference,
          ip.payment_status,
          ip.payment_date,
          ip.remarks,
          ip.attachment,
          ip.created_by,
          ip.created_at,
          ip.updated_at,
          ip.is_deleted,
          ip.deleted_by,
          ip.deleted_at
        FROM 
          invoice_payments ip
        INNER JOIN 
          invoices i ON i.id = ip.invoice_id
        WHERE 
          i.reference_type = $1
          AND i.reference_id = $2
          AND i.is_deleted = false
          AND ip.is_deleted = false
        ORDER BY 
          ip.created_at DESC
      `;

      const result = await pool.query(query, [referenceType, referenceId]);
      
      return res.json({
        data: result.rows,
      });
    } catch (error) {
      console.error("Error fetching invoice payments by reference:", error);
      return res.status(500).json({
        error: "Failed to fetch invoice payments",
      });
    }
  }
);

export default router;
