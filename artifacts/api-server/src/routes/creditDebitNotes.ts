import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { recomputeInvoiceBalances } from "../lib/invoiceBalances";
import { checkPermission } from "../middlewares/checkPermission";
import { ACCOUNTS_CREDIT_DEBIT_NOTES } from "../constants/permissions";

const router = Router();

/* ── helpers ─────────────────────────────────────────── */
async function nextNoteNumber(client: any, type: string): Promise<string> {
  const prefix = type === "Credit Note" ? "CN" : "DN";
  const year = new Date().getFullYear();
  const { rows } = await client.query(
    `SELECT note_number FROM credit_debit_notes
     WHERE note_number LIKE $1
     ORDER BY note_id DESC LIMIT 1`,
    [`${prefix}-${year}-%`]
  );
  let seq = 1;
  if (rows.length) {
    const last = rows[0].note_number.split("-").pop();
    seq = parseInt(last, 10) + 1;
  }
  return `${prefix}-${year}-${String(seq).padStart(5, "0")}`;
}

/* Apply a note's effects. The note row must already be persisted with status='Applied'
   before calling, because recomputeInvoiceBalances sums applied notes straight from the DB.
   Credit notes adjust the invoice balance in the invoice's own currency via the INR anchor. */
async function applyNoteEffects(client: any, note: any) {
  if (note.status !== "Applied") return;

  if (note.note_type === "Credit Note" && note.reference_type === "Client Invoice" && note.invoice_id) {
    await client.query(
      `INSERT INTO client_invoice_ledger
         (client_id, invoice_id, entry_type, payment_amount, payment_date, transaction_reference, status, created_by)
       VALUES ($1,$2,'Credit Note',$3,$4,$5,'Applied',$6)`,
      [
        note.party_id, note.invoice_id, note.note_amount,
        note.note_date, note.note_number, note.created_by ?? "",
      ]
    );
    await recomputeInvoiceBalances(client, note.invoice_id);
  }

  if (note.note_type === "Debit Note" && note.reference_type === "Vendor Bill" && note.vendor_bill_id) {
    await client.query(
      `UPDATE vendor_invoice_ledger
         SET status = 'Adjusted', notes = COALESCE(notes,'') || ' | Debit Note: ' || $1
       WHERE id = $2`,
      [note.note_number, note.vendor_bill_id]
    );
  }
}

/* Reverse a note's effects. Call AFTER the note's DB status has been flipped away from
   'Applied' so the balance recompute no longer counts it. */
async function reverseNoteEffects(client: any, note: any, deletedBy: string) {
  if (note.note_type === "Credit Note" && note.reference_type === "Client Invoice" && note.invoice_id) {
    await client.query(
      `UPDATE client_invoice_ledger SET is_deleted = true, deleted_by = $3, deleted_at = now()
       WHERE invoice_id = $1 AND entry_type = 'Credit Note' AND transaction_reference = $2 AND is_deleted = false`,
      [note.invoice_id, note.note_number, deletedBy]
    );
    await recomputeInvoiceBalances(client, note.invoice_id);
  }
}

/* ── GET /api/credit-debit-notes ─────────────────────── */
router.get("/", requireAuth, 
  checkPermission({ any: [ACCOUNTS_CREDIT_DEBIT_NOTES.VIEW] }), 
  async (req, res) => {
  try {
    const { search, type, status, ref_type } = req.query as Record<string, string>;
    const conditions: string[] = ["n.is_deleted = false"];
    const params: any[] = [];
    let p = 1;

    if (search) {
      conditions.push(`(n.note_number ILIKE $${p} OR n.party_name ILIKE $${p} OR n.reason ILIKE $${p})`);
      params.push(`%${search}%`); p++;
    }
    if (type)     { conditions.push(`n.note_type = $${p}`);      params.push(type); p++; }
    if (status)   { conditions.push(`n.status = $${p}`);         params.push(status); p++; }
    if (ref_type) { conditions.push(`n.reference_type = $${p}`); params.push(ref_type); p++; }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT n.*,
              i.invoice_no,
              vil.vendor_invoice_number AS vendor_bill_number
         FROM credit_debit_notes n
         LEFT JOIN invoices i                ON i.id = n.invoice_id AND i.is_deleted = false
         LEFT JOIN vendor_invoice_ledger vil ON vil.id = n.vendor_bill_id AND vil.is_deleted = false
       ${where}
       ORDER BY n.note_id DESC`,
      params
    );
    return res.json({ data: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ── GET /api/credit-debit-notes/:id ─────────────────── */
router.get("/:id", requireAuth, 
  checkPermission({ any: [ACCOUNTS_CREDIT_DEBIT_NOTES.VIEW] }), 
  async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.*, i.invoice_no,
              vil.vendor_invoice_number AS vendor_bill_number
         FROM credit_debit_notes n
         LEFT JOIN invoices i                ON i.id = n.invoice_id AND i.is_deleted = false
         LEFT JOIN vendor_invoice_ledger vil ON vil.id = n.vendor_bill_id AND vil.is_deleted = false
        WHERE n.note_id = $1 AND n.is_deleted = false`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Note not found" });
    return res.json({ data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/credit-debit-notes ────────────────────── */
router.post("/", requireAuth, 
  checkPermission({ any: [ACCOUNTS_CREDIT_DEBIT_NOTES.ADD_EDIT] }), 
  async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      note_type, reference_type = "Manual Entry",
      invoice_id, vendor_bill_id,
      party_id, party_name, party_type,
      currency_code = "INR", exchange_rate_snapshot = 1,
      note_amount, reason, remarks, note_date,
      status = "Draft",
    } = req.body as any;

    if (!note_amount || parseFloat(note_amount) <= 0)
      throw new Error("note_amount must be > 0");
    if (!reason) throw new Error("reason is required");
    if (!note_date) throw new Error("note_date is required");
    if (reference_type === "Client Invoice" && !invoice_id)
      throw new Error("invoice_id is required for Client Invoice");
    if (reference_type === "Vendor Bill" && !vendor_bill_id)
      throw new Error("vendor_bill_id is required for Vendor Bill");

    // Server-side cap: note_amount must not exceed source document outstanding/total.
    // Credit notes are compared in the invoice's currency (convert the note via the INR anchor).
    const amtNum = parseFloat(note_amount);
    if (note_type === "Credit Note" && reference_type === "Client Invoice" && invoice_id) {
      const { rows: invRows } = await client.query(
        `SELECT COALESCE(pending_amount, total_amount, 0) AS cap, exchange_rate_snapshot
           FROM invoices WHERE id = $1 AND is_deleted = false`,
        [invoice_id]
      );
      if (!invRows.length) throw new Error("Linked invoice not found");
      const cap = parseFloat(invRows[0].cap);                                  // invoice currency
      const invRate = parseFloat(invRows[0].exchange_rate_snapshot ?? "1") || 1;
      const noteRate = parseFloat(exchange_rate_snapshot ?? "1") || 1;
      const noteInInvoiceCcy = (amtNum * noteRate) / invRate;                  // invoice currency
      if (noteInInvoiceCcy > cap + 0.01)
        throw new Error(`Credit Note amount (${noteInInvoiceCcy.toFixed(2)} in invoice currency) cannot exceed invoice pending amount (${cap.toFixed(2)})`);
    }
    if (note_type === "Debit Note" && reference_type === "Vendor Bill" && vendor_bill_id) {
      const { rows: vbRows } = await client.query(
        `SELECT COALESCE(pending_amount, vendor_invoice_amount, 0) AS cap FROM vendor_invoice_ledger WHERE id = $1 AND is_deleted = false`,
        [vendor_bill_id]
      );
      if (!vbRows.length) throw new Error("Linked vendor bill not found");
      const cap = parseFloat(vbRows[0].cap);
      if (amtNum > cap + 0.001)
        throw new Error(`Debit Note amount (₹${amtNum.toFixed(2)}) cannot exceed vendor bill amount (₹${cap.toFixed(2)})`);
    }

    const note_number = await nextNoteNumber(client, note_type);
    const base = parseFloat(note_amount) * parseFloat(exchange_rate_snapshot);
    const createdBy = (req as any).user?.username ?? (req as any).user?.name ?? "";

    const { rows } = await client.query(
      `INSERT INTO credit_debit_notes
         (note_number, note_type, reference_type, invoice_id, vendor_bill_id,
          party_id, party_name, party_type,
          currency_code, exchange_rate_snapshot, note_amount, base_currency_amount,
          reason, remarks, note_date, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        note_number, note_type, reference_type,
        invoice_id || null, vendor_bill_id || null,
        party_id || null, party_name || "", party_type || "",
        currency_code, exchange_rate_snapshot, note_amount, base,
        reason, remarks || "", note_date, status, createdBy,
      ]
    );
    const note = rows[0];
    await applyNoteEffects(client, note);
    await client.query("COMMIT");
    return res.json({ data: note, message: "Credit / Debit note created and balances updated" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    return res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ── PUT /api/credit-debit-notes/:id/apply ───────────── */
router.put("/:id/apply", requireAuth, 
  checkPermission({ any: [ACCOUNTS_CREDIT_DEBIT_NOTES.ADD_EDIT] }), 
  async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT * FROM credit_debit_notes WHERE note_id = $1 AND is_deleted = false", [req.params.id]
    );
    if (!rows.length) throw new Error("Note not found");
    const note = rows[0];
    if (note.status !== "Draft") throw new Error("Only Draft notes can be applied");

    await client.query(
      "UPDATE credit_debit_notes SET status='Applied', updated_at=NOW() WHERE note_id=$1",
      [note.note_id]
    );
    note.status = "Applied";
    await applyNoteEffects(client, note);
    await client.query("COMMIT");
    return res.json({ data: { ...note, status: "Applied" }, message: "Note applied and balances updated" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    return res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ── PUT /api/credit-debit-notes/:id/cancel ─────────── */
router.put("/:id/cancel", requireAuth, 
  checkPermission({ any: [ACCOUNTS_CREDIT_DEBIT_NOTES.ADD_EDIT] }), 
  async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT * FROM credit_debit_notes WHERE note_id = $1 AND is_deleted = false", [req.params.id]
    );
    if (!rows.length) throw new Error("Note not found");
    const note = rows[0];
    if (note.status === "Cancelled") throw new Error("Already cancelled");

    const deletedByUser = (req as any).user?.username ?? (req as any).user?.name ?? "system";
    const wasApplied = note.status === "Applied";
    // Flip status first so the balance recompute inside reverseNoteEffects no longer counts this note
    await client.query(
      "UPDATE credit_debit_notes SET status='Cancelled', updated_at=NOW() WHERE note_id=$1",
      [note.note_id]
    );
    if (wasApplied) await reverseNoteEffects(client, note, deletedByUser);
    await client.query("COMMIT");
    return res.json({ data: { ...note, status: "Cancelled" }, message: "Note cancelled and balances reversed" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    return res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ── DELETE /api/credit-debit-notes/:id ─────────────── */
router.delete("/:id", requireAuth, 
  checkPermission({ any: [ACCOUNTS_CREDIT_DEBIT_NOTES.DELETE] }), 
  async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT status FROM credit_debit_notes WHERE note_id=$1 AND is_deleted = false", [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    if (rows[0].status !== "Draft") return res.status(400).json({ error: "Only Draft notes can be deleted" });
    const deletedByUser = (req as any).user?.username ?? (req as any).user?.name ?? "system";
    await pool.query("UPDATE credit_debit_notes SET is_deleted = true, updated_at = NOW(), deleted_by = $2, deleted_at = now() WHERE note_id=$1 AND is_deleted = false", [req.params.id, deletedByUser]);
    return res.json({ message: "Deleted" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
