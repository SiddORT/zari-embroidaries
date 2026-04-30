import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { AuthRequest } from "../middlewares/requireAuth";
import { uploadMiddleware, uploadFile } from "../utils/uploadHelper";

const router = Router();

async function nextExpenseNumber(client: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EXP-${year}-`;
  const { rows } = await client.query(
    `SELECT expense_number FROM other_expenses WHERE expense_number LIKE $1 ORDER BY expense_number DESC LIMIT 1`,
    [`${prefix}%`]
  );
  if (!rows.length) return `${prefix}00001`;
  const last = parseInt(rows[0].expense_number.replace(prefix, ""), 10) || 0;
  return `${prefix}${String(last + 1).padStart(5, "0")}`;
}

/* ── categories ─────────────────────────── */
router.get("/other-expenses/categories", requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT expense_category FROM other_expenses ORDER BY expense_category`
    );
    const defaults = [
      "Courier Charges", "Office Expenses", "Packaging Expenses",
      "Sampling Misc Expenses", "Transport Charges", "Utility Expenses", "Other",
    ];
    const fromDb = rows.map((r: any) => r.expense_category as string);
    const merged = Array.from(new Set([...defaults, ...fromDb])).sort();
    return res.json(merged);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/* ── list ─────────────────────────────────── */
router.get("/other-expenses", requireAuth, async (req, res) => {
  try {
    const {
      search, status, category, vendor_id, from_date, to_date,
      page = "1", limit = "50",
    } = req.query as Record<string, string>;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (search) {
      conditions.push(
        `(oe.expense_number ILIKE $${p} OR oe.vendor_name ILIKE $${p} OR oe.expense_category ILIKE $${p} OR oe.remarks ILIKE $${p})`
      );
      params.push(`%${search}%`); p++;
    }
    if (status)    { conditions.push(`oe.payment_status = $${p}`); params.push(status); p++; }
    if (category)  { conditions.push(`oe.expense_category = $${p}`); params.push(category); p++; }
    if (vendor_id) { conditions.push(`oe.vendor_id = $${p}`);  params.push(parseInt(vendor_id)); p++; }
    if (from_date) { conditions.push(`oe.expense_date >= $${p}`); params.push(from_date); p++; }
    if (to_date)   { conditions.push(`oe.expense_date <= $${p}`); params.push(to_date); p++; }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT oe.*, v.brand_name AS vendor_display_name
         FROM other_expenses oe
         LEFT JOIN vendors v ON v.id = oe.vendor_id
         ${where}
         ORDER BY oe.expense_date DESC, oe.created_at DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        [...params, parseInt(limit), offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM other_expenses oe ${where}`,
        params
      ),
    ]);

    return res.json({ rows: dataRes.rows, total: parseInt(countRes.rows[0].count) });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/* ── get one ──────────────────────────────── */
router.get("/other-expenses/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT oe.*, v.brand_name AS vendor_display_name
       FROM other_expenses oe
       LEFT JOIN vendors v ON v.id = oe.vendor_id
       WHERE oe.expense_id = $1`,
      [parseInt(String(req.params.id))]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(rows[0]);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/* ── create ───────────────────────────────── */
router.post("/other-expenses", requireAuth, uploadMiddleware.single("attachment"), async (req: any, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const user = (req as AuthRequest).user;
    const {
      expense_category, vendor_id, vendor_name = "",
      reference_type = "Manual", reference_id = "",
      amount, currency_code = "INR", payment_status = "Unpaid",
      payment_type = "", expense_date, remarks = "",
    } = req.body;

    if (!expense_category?.trim())
      return res.status(400).json({ error: "Expense category is required" });
    if (!expense_date?.trim())
      return res.status(400).json({ error: "Expense date is required" });
    if (!amount || parseFloat(amount) <= 0)
      return res.status(400).json({ error: "Amount must be greater than 0" });
    if (!currency_code?.trim())
      return res.status(400).json({ error: "Currency is required" });

    const expense_number   = await nextExpenseNumber(client);
    const attachmentPath   = req.file
      ? await uploadFile(req.file, { entity: "expenses", id: expense_number })
      : "";
    const amountNum        = parseFloat(amount);
    const vendorIdNum      = vendor_id ? parseInt(vendor_id) : null;

    const { rows } = await client.query(
      `INSERT INTO other_expenses
         (expense_number, expense_category, vendor_id, vendor_name, reference_type,
          reference_id, amount, currency_code, payment_status, payment_type,
          expense_date, remarks, attachment, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        expense_number, expense_category, vendorIdNum,
        vendor_name, reference_type, reference_id,
        amountNum, currency_code, payment_status, payment_type,
        expense_date, remarks, attachmentPath,
        user?.email ?? "system",
      ]
    );

    const expense = rows[0];

    if (vendorIdNum) {
      const vRes = await client.query(`SELECT brand_name FROM vendors WHERE id = $1`, [vendorIdNum]);
      const vName = vRes.rows[0]?.brand_name ?? vendor_name;
      await client.query(
        `INSERT INTO vendor_ledger_charges
           (vendor_id, vendor_name, charge_date, description, amount, notes, order_type, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'other_expense',$7)`,
        [
          vendorIdNum, vName, expense_date,
          `Other Expense: ${expense_category} [${expense_number}]`,
          String(amountNum), remarks,
          user?.email ?? "system",
        ]
      );
    }

    await client.query("COMMIT");
    return res.status(201).json({
      ...expense,
      message: vendorIdNum
        ? "Expense recorded successfully and linked to vendor ledger"
        : "Expense recorded successfully",
    });
  } catch (e: any) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* ── update ───────────────────────────────── */
router.put("/other-expenses/:id", requireAuth, uploadMiddleware.single("attachment"), async (req: any, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const {
      expense_category, vendor_id, vendor_name = "",
      reference_type = "Manual", reference_id = "",
      amount, currency_code = "INR", payment_status = "Unpaid",
      payment_type = "", expense_date, remarks = "",
    } = req.body;

    if (!expense_category?.trim())
      return res.status(400).json({ error: "Expense category is required" });
    if (!expense_date?.trim())
      return res.status(400).json({ error: "Expense date is required" });
    if (!amount || parseFloat(amount) <= 0)
      return res.status(400).json({ error: "Amount must be greater than 0" });

    const curr = await pool.query(`SELECT attachment FROM other_expenses WHERE expense_id = $1`, [id]);
    if (!curr.rows.length) return res.status(404).json({ error: "Not found" });

    const attachmentPath = req.file
      ? await uploadFile(req.file, { entity: "expenses", id: id })
      : curr.rows[0].attachment;

    const { rows } = await pool.query(
      `UPDATE other_expenses SET
         expense_category=$1, vendor_id=$2, vendor_name=$3, reference_type=$4,
         reference_id=$5, amount=$6, currency_code=$7, payment_status=$8,
         payment_type=$9, expense_date=$10, remarks=$11, attachment=$12,
         updated_at=NOW()
       WHERE expense_id=$13
       RETURNING *`,
      [
        expense_category,
        vendor_id ? parseInt(vendor_id) : null,
        vendor_name, reference_type, reference_id,
        parseFloat(amount), currency_code, payment_status, payment_type,
        expense_date, remarks, attachmentPath, id,
      ]
    );

    return res.json(rows[0]);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/* ── delete (admin only) ─────────────────── */
router.delete("/other-expenses/:id", requireAuth, async (req: any, res) => {
  try {
    const user = (req as AuthRequest).user;
    if ((user as any)?.role !== "admin")
      return res.status(403).json({ error: "Admin only" });
    await pool.query(`DELETE FROM other_expenses WHERE expense_id = $1`, [parseInt(String(req.params.id))]);
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
