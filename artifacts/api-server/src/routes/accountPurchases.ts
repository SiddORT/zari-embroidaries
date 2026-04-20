import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { AuthRequest } from "../middlewares/requireAuth";

const router = Router();

/* ── helpers ─────────────────────────────────────────── */
async function nextExpenseNumber(client: any): Promise<string> {
  const year = new Date().getFullYear();
  const { rows } = await client.query(
    `SELECT expense_number FROM other_expenses WHERE expense_number LIKE $1 ORDER BY expense_id DESC LIMIT 1`,
    [`EXP-${year}-%`]
  );
  let seq = 1;
  if (rows.length) {
    const last = rows[0].expense_number.split("-").pop();
    seq = parseInt(last, 10) + 1;
  }
  return `EXP-${year}-${String(seq).padStart(5, "0")}`;
}

/* ══════════════════════════════════════════════════════
   PURCHASE ORDERS — financial summary view
══════════════════════════════════════════════════════ */
router.get("/purchase-orders", requireAuth, async (req, res) => {
  try {
    const { search, status, ref_type, page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (search) {
      conditions.push(`(po.po_number ILIKE $${p} OR po.vendor_name ILIKE $${p})`);
      params.push(`%${search}%`); p++;
    }
    if (status) { conditions.push(`po.status = $${p}`); params.push(status); p++; }
    if (ref_type) { conditions.push(`po.reference_type = $${p}`); params.push(ref_type); p++; }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT
         po.id, po.po_number, po.vendor_id, po.vendor_name,
         po.reference_type, po.reference_id, po.status,
         po.po_date, po.created_by, po.created_at,
         COALESCE(SUM(poi.ordered_quantity  * poi.unit_price), 0)::numeric(18,2) AS po_amount,
         COALESCE(SUM(poi.ordered_quantity),  0)::numeric(14,3) AS total_ordered_qty,
         COALESCE(SUM(poi.received_quantity), 0)::numeric(14,3) AS total_received_qty,
         COALESCE(SUM(poi.ordered_quantity - poi.received_quantity), 0)::numeric(14,3) AS pending_qty,
         COUNT(poi.id)::int AS item_count,
         sw.order_code AS swatch_order_code,
         st.order_code AS style_order_code
       FROM purchase_orders po
       LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
       LEFT JOIN swatch_orders sw ON sw.id = po.swatch_order_id
       LEFT JOIN style_orders  st ON st.id = po.style_order_id
       ${where}
       GROUP BY po.id, sw.order_code, st.order_code
       ORDER BY po.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, parseInt(limit), offset]
    );

    const count = await pool.query(
      `SELECT COUNT(*) FROM purchase_orders po ${where}`, params
    );

    res.json({ data: rows, total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   VENDOR BILLS
══════════════════════════════════════════════════════ */
router.get("/vendor-bills", requireAuth, async (req, res) => {
  try {
    const { search, status, vendor_id, page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (search) {
      conditions.push(`(vil.vendor_invoice_number ILIKE $${p} OR vil.vendor_name ILIKE $${p})`);
      params.push(`%${search}%`); p++;
    }
    if (status) { conditions.push(`vil.status = $${p}`); params.push(status); p++; }
    if (vendor_id) { conditions.push(`vil.vendor_id = $${p}`); params.push(vendor_id); p++; }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT
         vil.id, vil.vendor_id, vil.vendor_name,
         vil.purchase_receipt_id, vil.pr_number,
         vil.vendor_invoice_number, vil.vendor_invoice_date,
         vil.vendor_invoice_amount,
         vil.paid_amount,
         vil.pending_amount,
         vil.status, vil.notes, vil.created_at,
         vil.vendor_invoice_file,
         po.po_number AS linked_po_number
       FROM vendor_invoice_ledger vil
       LEFT JOIN purchase_receipts pr ON pr.id = vil.purchase_receipt_id
       LEFT JOIN purchase_orders   po ON po.id = pr.po_id
       ${where}
       ORDER BY vil.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, parseInt(limit), offset]
    );

    const count = await pool.query(
      `SELECT COUNT(*) FROM vendor_invoice_ledger vil ${where}`, params
    );

    res.json({ data: rows, total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* Record payment on a vendor bill */
router.post("/vendor-bills/:id/payment", requireAuth, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = parseInt(req.params.id);
    const { payment_amount, payment_date, payment_type, transaction_reference, remarks } = req.body as any;

    const amt = parseFloat(payment_amount ?? "0");
    if (amt <= 0) throw new Error("payment_amount must be > 0");

    const { rows } = await client.query(
      `SELECT * FROM vendor_invoice_ledger WHERE id = $1`, [id]
    );
    if (!rows.length) throw new Error("Bill not found");
    const bill = rows[0];

    const newPaid = parseFloat(bill.paid_amount ?? "0") + amt;
    const newPending = parseFloat(bill.vendor_invoice_amount) - newPaid;
    const newStatus = newPending <= 0.005 ? "Paid" : "Partially Paid";

    await client.query(
      `UPDATE vendor_invoice_ledger
         SET paid_amount = $1, status = $2, updated_at = NOW()
       WHERE id = $3`,
      [newPaid, newStatus, id]
    );

    await client.query(
      `INSERT INTO vendor_payments
         (vendor_id, vendor_name, payment_date, amount, payment_mode, reference_no, notes, order_type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'general',$8)`,
      [
        bill.vendor_id, bill.vendor_name,
        payment_date || new Date().toISOString(),
        amt, payment_type || "Bank Transfer",
        transaction_reference || "", remarks || "",
        req.user?.email ?? "",
      ]
    );

    await client.query("COMMIT");
    res.json({ message: "Payment recorded", paid: newPaid, pending: Math.max(0, newPending), status: newStatus });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════
   OTHER EXPENSES
══════════════════════════════════════════════════════ */
router.get("/expenses", requireAuth, async (req, res) => {
  try {
    const { search, status, category, vendor_id, from_date, to_date, page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (search) {
      conditions.push(`(e.expense_number ILIKE $${p} OR e.vendor_name ILIKE $${p} OR e.expense_category ILIKE $${p} OR e.remarks ILIKE $${p})`);
      params.push(`%${search}%`); p++;
    }
    if (status)    { conditions.push(`e.payment_status = $${p}`);    params.push(status); p++; }
    if (category)  { conditions.push(`e.expense_category = $${p}`);  params.push(category); p++; }
    if (vendor_id) { conditions.push(`e.vendor_id = $${p}`);         params.push(vendor_id); p++; }
    if (from_date) { conditions.push(`e.expense_date >= $${p}`);      params.push(from_date); p++; }
    if (to_date)   { conditions.push(`e.expense_date <= $${p}`);      params.push(to_date); p++; }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT e.*, v.brand_name AS vendor_brand
       FROM other_expenses e
       LEFT JOIN vendors v ON v.id = e.vendor_id
       ${where}
       ORDER BY e.created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, parseInt(limit), offset]
    );

    const count = await pool.query(
      `SELECT COUNT(*) FROM other_expenses e ${where}`, params
    );

    res.json({ data: rows, total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/expenses/categories", requireAuth, async (_req, res) => {
  try {
    const defaults = [
      "Courier Charges", "Office Expenses", "Sampling Misc Expenses",
      "Transport Charges", "Packaging Expenses", "Utility Expenses", "Other",
    ];
    const { rows } = await pool.query(
      `SELECT DISTINCT expense_category FROM other_expenses ORDER BY expense_category`
    );
    const custom = rows.map((r: any) => r.expense_category).filter((c: string) => !defaults.includes(c));
    res.json({ data: [...defaults, ...custom] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/expenses", requireAuth, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      expense_category, vendor_id, vendor_name = "", reference_type = "Manual", reference_id = "",
      amount, currency_code = "INR", payment_status = "Unpaid", payment_type = "",
      expense_date, remarks = "", attachment = "",
    } = req.body as any;

    if (!expense_category) throw new Error("expense_category is required");
    if (!amount || parseFloat(amount) <= 0) throw new Error("amount must be > 0");
    if (!expense_date) throw new Error("expense_date is required");

    const expense_number = await nextExpenseNumber(client);
    const createdBy = req.user?.email ?? "";

    const { rows } = await client.query(
      `INSERT INTO other_expenses
         (expense_number, expense_category, vendor_id, vendor_name, reference_type, reference_id,
          amount, currency_code, payment_status, payment_type, expense_date, remarks, attachment, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        expense_number, expense_category,
        vendor_id || null, vendor_name, reference_type, reference_id,
        parseFloat(amount), currency_code, payment_status, payment_type,
        expense_date, remarks, attachment, createdBy,
      ]
    );

    if (vendor_id && payment_status !== "Paid") {
      await client.query(
        `INSERT INTO vendor_ledger_charges
           (vendor_id, vendor_name, charge_date, description, amount, notes, order_type, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'general',$7)`,
        [
          vendor_id, vendor_name || "",
          expense_date, `Expense: ${expense_category} [${expense_number}]`,
          String(amount), remarks, createdBy,
        ]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ data: rows[0], message: "Expense recorded successfully and added to vendor ledger" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.put("/expenses/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      expense_category, vendor_id, vendor_name = "", reference_type, reference_id,
      amount, currency_code, payment_status, payment_type, expense_date, remarks, attachment,
    } = req.body as any;

    const { rows } = await pool.query(
      `UPDATE other_expenses
         SET expense_category=$1, vendor_id=$2, vendor_name=$3, reference_type=$4, reference_id=$5,
             amount=$6, currency_code=$7, payment_status=$8, payment_type=$9,
             expense_date=$10, remarks=$11, attachment=$12, updated_at=NOW()
       WHERE expense_id=$13
       RETURNING *`,
      [
        expense_category, vendor_id || null, vendor_name, reference_type, reference_id,
        parseFloat(amount), currency_code, payment_status, payment_type,
        expense_date, remarks, attachment, id,
      ]
    );

    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ data: rows[0] });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/expenses/:id/payment", requireAuth, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = parseInt(req.params.id);
    const { payment_amount, payment_date, payment_type, transaction_reference, remarks } = req.body as any;
    const amt = parseFloat(payment_amount ?? "0");
    if (amt <= 0) throw new Error("payment_amount must be > 0");

    const { rows } = await client.query(`SELECT * FROM other_expenses WHERE expense_id=$1`, [id]);
    if (!rows.length) throw new Error("Expense not found");
    const exp = rows[0];

    const newPaid = parseFloat(exp.paid_amount ?? "0") + amt;
    const total = parseFloat(exp.amount);
    const newStatus = newPaid >= total - 0.005 ? "Paid" : "Partially Paid";

    await client.query(
      `UPDATE other_expenses SET paid_amount=$1, payment_status=$2, payment_type=$3, updated_at=NOW() WHERE expense_id=$4`,
      [newPaid, newStatus, payment_type || exp.payment_type || "Bank Transfer", id]
    );

    if (exp.vendor_id) {
      await client.query(
        `INSERT INTO vendor_payments
           (vendor_id, vendor_name, payment_date, amount, payment_mode, reference_no, notes, order_type, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'general',$8)`,
        [
          exp.vendor_id, exp.vendor_name,
          payment_date || new Date().toISOString(), amt,
          payment_type || "Bank Transfer",
          transaction_reference || "", remarks || "",
          req.user?.email ?? "",
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Payment recorded", paid: newPaid, status: newStatus });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.delete("/expenses/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM other_expenses WHERE expense_id=$1 RETURNING expense_id`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
