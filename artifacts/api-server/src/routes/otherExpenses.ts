import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { AuthRequest } from "../middlewares/requireAuth";
import { uploadMiddleware, uploadFile } from "../utils/uploadHelper";
import { checkPermission } from "../middlewares/checkPermission";
import { ACCOUNTS_OTHER_EXPENSES } from "../constants/permissions";

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
      `SELECT DISTINCT expense_category FROM other_expenses WHERE is_deleted = false ORDER BY expense_category`
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
router.get( "/other-expenses", requireAuth,
  checkPermission({ any: [ACCOUNTS_OTHER_EXPENSES.VIEW] }),
  async (req, res) => {
    try {
     const { search, status, category, vendor_id, from_date, to_date, page = "1", limit = "50", } = req.query as Record<string, string>;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const conditions: string[] = ["oe.is_deleted = false"];
      const params: any[] = [];
      let p = 1;

      if (search) {
        conditions.push(
          `(oe.expense_number ILIKE $${p} OR oe.vendor_name ILIKE $${p} OR oe.expense_category ILIKE $${p} OR oe.remarks ILIKE $${p})`
        );
        params.push(`%${search}%`);
        p++;
      }
      if (status) {
        conditions.push(`oe.payment_status = $${p}`);
        params.push(status);
        p++;
      }
      if (category) {
        conditions.push(`oe.expense_category = $${p}`);
        params.push(category);
        p++;
      }
      if (vendor_id) {
        conditions.push(`oe.vendor_id = $${p}`);
        params.push(parseInt(vendor_id));
        p++;
      }
      if (from_date) {
        conditions.push(`oe.expense_date >= $${p}`);
        params.push(from_date);
        p++;
      }
      if (to_date) {
        conditions.push(`oe.expense_date <= $${p}`);
        params.push(to_date);
        p++;
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const selectColumns = `
       oe.*, v.brand_name AS vendor_display_name,
       ROUND( oe.amount * COALESCE(NULLIF(oe.gst_percentage, '')::numeric, 0) / 100, 2 ) AS gst_amount,
       ROUND( oe.amount * ( 1 + COALESCE(NULLIF(oe.gst_percentage, '')::numeric, 0) / 100 ), 2 ) AS amount_with_gst
      `;

      const [dataRes, countRes] = await Promise.all([
        pool.query(
          `SELECT ${selectColumns}
           FROM other_expenses oe
           LEFT JOIN vendors v ON v.id = oe.vendor_id AND v.is_deleted = false
           ${where}
           ORDER BY oe.expense_date DESC, oe.created_at DESC
           LIMIT $${p} OFFSET $${p + 1}`,
          [...params, parseInt(limit), offset]
        ),
        pool.query(`SELECT COUNT(*) FROM other_expenses oe ${where}`, params),
      ]);

      return res.json({
        rows: dataRes.rows,
        total: parseInt(countRes.rows[0].count),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
);

/* ── get one ──────────────────────────────── */
router.get("/other-expenses/:id", requireAuth, 
  checkPermission({any:[ACCOUNTS_OTHER_EXPENSES.VIEW]}),
  async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT oe.*, v.brand_name AS vendor_display_name
       FROM other_expenses oe
       LEFT JOIN vendors v ON v.id = oe.vendor_id AND v.is_deleted = false
       WHERE oe.expense_id = $1 AND oe.is_deleted = false`,
      [parseInt(String(req.params.id))]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    return res.json(rows[0]);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/* ── create ───────────────────────────────── */
router.post( "/other-expenses", requireAuth,
  checkPermission({ any: [ACCOUNTS_OTHER_EXPENSES.ADD_EDIT] }),
  uploadMiddleware.single("attachment"),
  async (req: any, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const user = (req as AuthRequest).user;
      const {
        expense_category,
        vendor_id,
        vendor_name = "",
        reference_type = "Manual",
        reference_id = "",
        amount,
        currency_code = "INR",
        payment_status = "Unpaid",
        payment_type = "",
        expense_date,
        remarks = "",
        hsn_id,
        hsn_code,
        gst_percentage,
      } = req.body;

      if (!expense_category?.trim())
        return res.status(400).json({ error: "Expense category is required" });
      if (!expense_date?.trim())
        return res.status(400).json({ error: "Expense date is required" });
      if (!amount || parseFloat(amount) <= 0)
        return res.status(400).json({ error: "Amount must be greater than 0" });
      if (!currency_code?.trim())
        return res.status(400).json({ error: "Currency is required" });

      const hsnIdNum = parseInt(hsn_id);
      if (!hsn_id || isNaN(hsnIdNum) || hsnIdNum <= 0)
        return res.status(400).json({ error: "Valid HSN ID is required" });
      if (!hsn_code?.trim())
        return res.status(400).json({ error: "HSN code is required" });
      if (!gst_percentage?.trim())
        return res.status(400).json({ error: "GST percentage is required" });

      const expense_number = await nextExpenseNumber(client);
      const attachmentPath = req.file
        ? await uploadFile(req.file, { entity: "expenses", id: expense_number })
        : "";
      const amountNum = parseFloat(amount);
      const vendorIdNum = vendor_id ? parseInt(vendor_id) : null;

      const { rows } = await client.query(
        `INSERT INTO other_expenses
           (expense_number, expense_category, vendor_id, vendor_name, reference_type,
            reference_id, amount, currency_code, payment_status, payment_type,
            expense_date, remarks, attachment, created_by,
            hsn_id, hsn_code, gst_percentage)        
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [
         expense_number, expense_category, vendorIdNum,
         vendor_name, reference_type, reference_id,
         amountNum, currency_code, payment_status,
         payment_type, expense_date, remarks,
         attachmentPath, user?.email ?? "system", hsnIdNum,        
         hsn_code.trim(), gst_percentage.trim(), 
        ]
      );

      const expense = rows[0];
      if (vendorIdNum) {
        const vRes = await client.query(
          `SELECT brand_name FROM vendors WHERE id = $1`,
          [vendorIdNum]
        );
        const vName = vRes.rows[0]?.brand_name ?? vendor_name;
        await client.query(
          `INSERT INTO vendor_ledger_charges
             (vendor_id, vendor_name, charge_date, description, amount, notes,
              hsn_id, hsn_code, gst_percentage, order_type, order_id, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'other_expenses',$10, $11)`,
          [
            vendorIdNum, vName, expense_date,
            `Other Expense: ${expense_category} [${expense_number}]`,
            String(amountNum), remarks, hsnIdNum,             
            hsn_code.trim(), gst_percentage.trim(),
            expense.expense_id, user?.email ?? "system", 
          ]
        );
      }

      await client.query("COMMIT");
      return res.status(201).json({ ...expense, message: vendorIdNum ? "Expense recorded successfully and linked to vendor ledger" : "Expense recorded successfully", });
    } catch (e: any) {
      await client.query("ROLLBACK");
      return res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

/* ── update ───────────────────────────────── */
router.put(
  "/other-expenses/:id",
  requireAuth,
  checkPermission({ any: [ACCOUNTS_OTHER_EXPENSES.ADD_EDIT] }),
  uploadMiddleware.single("attachment"),
  async (req: any, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const id = parseInt(String(req.params.id));
      const user = (req as AuthRequest).user;

      const {
        expense_category,
        vendor_id,
        vendor_name = "",
        reference_type = "Manual",
        reference_id = "",
        amount,
        currency_code = "INR",
        payment_status = "Unpaid",
        payment_type = "",
        expense_date,
        remarks = "",
        hsn_id,
        hsn_code,
        gst_percentage,
      } = req.body;

      if (!expense_category?.trim())
        return res.status(400).json({ error: "Expense category is required" });
      if (!expense_date?.trim())
        return res.status(400).json({ error: "Expense date is required" });
      if (!amount || parseFloat(amount) <= 0)
        return res.status(400).json({ error: "Amount must be greater than 0" });
      if (!currency_code?.trim())
        return res.status(400).json({ error: "Currency is required" });

      const hsnIdNum = parseInt(hsn_id);
      if (!hsn_id || isNaN(hsnIdNum) || hsnIdNum <= 0)
        return res.status(400).json({ error: "Valid HSN ID is required" });
      if (!hsn_code?.trim())
        return res.status(400).json({ error: "HSN code is required" });
      if (!gst_percentage?.trim())
        return res.status(400).json({ error: "GST percentage is required" });

      const curr = await client.query(
        `SELECT vendor_id, attachment FROM other_expenses WHERE expense_id = $1 AND is_deleted = false`,
        [id]
      );
      if (!curr.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Not found" });
      }
      const oldVendorId = curr.rows[0].vendor_id;

      const attachmentPath = req.file
        ? await uploadFile(req.file, { entity: "expenses", id })
        : curr.rows[0].attachment;

      const amountNum = parseFloat(amount);
      const vendorIdNum = vendor_id ? parseInt(vendor_id) : null;

      const { rows } = await client.query(
        `UPDATE other_expenses SET
           expense_category = $1, vendor_id = $2, vendor_name = $3, reference_type = $4,
           reference_id = $5, amount = $6, currency_code = $7, payment_status = $8,
           payment_type = $9, expense_date = $10, remarks = $11, attachment = $12,
           hsn_id = $13, hsn_code = $14, gst_percentage = $15, updated_at = NOW()
         WHERE expense_id = $16
         RETURNING *`,
        [
          expense_category, vendorIdNum, vendor_name, reference_type,
          reference_id, amountNum, currency_code, payment_status,
          payment_type, expense_date, remarks, attachmentPath,
         hsnIdNum, hsn_code.trim(), gst_percentage.trim(), id,
        ]
      );
      const expense = rows[0];

      // Check if a ledger entry already exists for this expense
      const ledgerExists = await client.query(
        `SELECT id FROM vendor_ledger_charges WHERE order_type = 'other_expenses' AND order_id = $1`,
        [id]
      );

      if (vendorIdNum) {
        // Vendor is provided → ensure ledger entry exists (insert or update)
        // Get the vendor's brand name (fallback to provided vendor_name)
        const vRes = await client.query(
          `SELECT brand_name FROM vendors WHERE id = $1`,
          [vendorIdNum]
        );
        const vName = vRes.rows[0]?.brand_name ?? vendor_name;

        if (ledgerExists.rows.length > 0) {
          // Update existing ledger entry
          await client.query(
            `UPDATE vendor_ledger_charges SET
             vendor_id = $1, vendor_name = $2, charge_date = $3, description = $4,
              amount = $5, notes = $6, hsn_id = $7, hsn_code = $8,
              gst_percentage = $9, updated_at = NOW()
             WHERE order_type = 'other_expenses' AND order_id = $10`,
            [
            vendorIdNum, vName, expense_date,
              `Other Expense: ${expense_category} [${expense.expense_number}]`,
             String(amountNum), remarks, hsnIdNum, hsn_code.trim(), gst_percentage.trim(), id,
            ]
          );
        } else {
          // Insert a new ledger entry
          await client.query(
            `INSERT INTO vendor_ledger_charges
               (vendor_id, vendor_name, charge_date, description, amount, notes,
                hsn_id, hsn_code, gst_percentage, order_type, order_id, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'other_expenses',$10,$11)`,
            [
            vendorIdNum, vName, expense_date,
              `Other Expense: ${expense_category} [${expense.expense_number}]`,
             String(amountNum), remarks, hsnIdNum, hsn_code.trim(),
             gst_percentage.trim(), id, user?.email ?? "system",
            ]
          );
        }
      } else {
        if (ledgerExists.rows.length > 0) {
          await client.query(
            `DELETE FROM vendor_ledger_charges WHERE order_type = 'other_expenses' AND order_id = $1`,
            [id]
          );
        }
      }

      await client.query("COMMIT");
      return res.json(expense);
    } catch (e: any) {
      await client.query("ROLLBACK");
      return res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

/* ── delete (admin only) ─────────────────── */
router.delete(
  "/other-expenses/:id",
  requireAuth,
  checkPermission({ any: [ACCOUNTS_OTHER_EXPENSES.DELETE] }),
  async (req: any, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const user = (req as AuthRequest).user;
      if ((user as any)?.role !== "admin") {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Admin only" });
      }

      const id = parseInt(String(req.params.id));
      const deletedByUser = (user as any)?.email ?? "system";

      // Check if expense exists and is not deleted
      const check = await client.query(
        `SELECT expense_id FROM other_expenses WHERE expense_id = $1 AND is_deleted = false`,
        [id]
      );
      if (!check.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Expense not found or already deleted" });
      }

      // Soft-delete the expense
      await client.query(
        `UPDATE other_expenses 
         SET is_deleted = true, updated_at = NOW(), deleted_by = $2, deleted_at = NOW() 
         WHERE expense_id = $1`,
        [id, deletedByUser]
      );

      // Delete the associated vendor ledger charge (if exists)
      await client.query(
        `DELETE FROM vendor_ledger_charges 
         WHERE order_type = 'other_expenses' AND order_id = $1`,
        [id]
      );

      await client.query("COMMIT");
      return res.json({ success: true });
    } catch (e: any) {
      await client.query("ROLLBACK");
      return res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

export default router;
