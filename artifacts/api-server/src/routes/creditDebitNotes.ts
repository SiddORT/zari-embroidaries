import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

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

async function applyNoteEffects(client: any, note: any) {
  if (note.status !== "Applied") return;

  if (note.note_type === "Credit Note" && note.reference_type === "Client Invoice" && note.invoice_id) {
    await client.query(
      `UPDATE invoices
         SET pending_amount  = GREATEST(0, COALESCE(pending_amount,0) - $1),
             received_amount = COALESCE(received_amount,0) + $1,
             updated_at      = NOW()
       WHERE id = $2`,
      [note.note_amount, note.invoice_id]
    );
    await client.query(
      `INSERT INTO client_invoice_ledger
         (client_id, invoice_id, entry_type, payment_amount, payment_date, transaction_reference, status, created_by)
       VALUES ($1,$2,'Credit Note',$3,$4,$5,'Applied',$6)`,
      [
        note.party_id, note.invoice_id, note.note_amount,
        note.note_date, note.note_number, note.created_by ?? "",
      ]
    );
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

async function reverseNoteEffects(client: any, note: any) {
  if (note.status !== "Applied") return;

  if (note.note_type === "Credit Note" && note.reference_type === "Client Invoice" && note.invoice_id) {
    await client.query(
      `UPDATE invoices
         SET pending_amount  = COALESCE(pending_amount,0) + $1,
             received_amount = GREATEST(0, COALESCE(received_amount,0) - $1),
             updated_at      = NOW()
       WHERE id = $2`,
      [note.note_amount, note.invoice_id]
    );
    await client.query(
      `DELETE FROM client_invoice_ledger
       WHERE invoice_id = $1 AND entry_type = 'Credit Note' AND transaction_reference = $2`,
      [note.invoice_id, note.note_number]
    );
  }
}

/* ── GET /api/credit-debit-notes ─────────────────────── */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { search, type, status, ref_type } = req.query as Record<string, string>;
    const conditions: string[] = [];
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
         LEFT JOIN invoices i                ON i.id = n.invoice_id
         LEFT JOIN vendor_invoice_ledger vil ON vil.id = n.vendor_bill_id
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
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.*, i.invoice_no,
              vil.vendor_invoice_number AS vendor_bill_number
         FROM credit_debit_notes n
         LEFT JOIN invoices i                ON i.id = n.invoice_id
         LEFT JOIN vendor_invoice_ledger vil ON vil.id = n.vendor_bill_id
        WHERE n.note_id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Note not found" });
    return res.json({ data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/credit-debit-notes ────────────────────── */
router.post("/", requireAuth, async (req, res) => {
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
router.put("/:id/apply", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT * FROM credit_debit_notes WHERE note_id = $1", [req.params.id]
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
router.put("/:id/cancel", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT * FROM credit_debit_notes WHERE note_id = $1", [req.params.id]
    );
    if (!rows.length) throw new Error("Note not found");
    const note = rows[0];
    if (note.status === "Cancelled") throw new Error("Already cancelled");

    await reverseNoteEffects(client, note);
    await client.query(
      "UPDATE credit_debit_notes SET status='Cancelled', updated_at=NOW() WHERE note_id=$1",
      [note.note_id]
    );
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
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT status FROM credit_debit_notes WHERE note_id=$1", [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    if (rows[0].status !== "Draft") return res.status(400).json({ error: "Only Draft notes can be deleted" });
    await pool.query("DELETE FROM credit_debit_notes WHERE note_id=$1", [req.params.id]);
    return res.json({ message: "Deleted" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
