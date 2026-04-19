import { Router, type Request } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { hashPassword, verifyPassword } from "../lib/auth";

type AuthRequest = Request & { user?: { userId: number; email: string; name?: string; role: string } };

const router = Router();

const COMMON_CURRENCIES = [
  { code: "INR", name: "Indian Rupee",       symbol: "₹",   decimal_places: 2, is_active: true,  is_base: true  },
  { code: "USD", name: "US Dollar",           symbol: "$",   decimal_places: 2, is_active: true,  is_base: false },
  { code: "EUR", name: "Euro",                symbol: "€",   decimal_places: 2, is_active: true,  is_base: false },
  { code: "GBP", name: "British Pound",       symbol: "£",   decimal_places: 2, is_active: true,  is_base: false },
  { code: "AED", name: "UAE Dirham",          symbol: "AED", decimal_places: 2, is_active: true,  is_base: false },
  { code: "JPY", name: "Japanese Yen",        symbol: "¥",   decimal_places: 0, is_active: false, is_base: false },
  { code: "CNY", name: "Chinese Yuan",        symbol: "¥",   decimal_places: 2, is_active: false, is_base: false },
  { code: "CAD", name: "Canadian Dollar",     symbol: "CA$", decimal_places: 2, is_active: false, is_base: false },
  { code: "AUD", name: "Australian Dollar",   symbol: "A$",  decimal_places: 2, is_active: false, is_base: false },
  { code: "CHF", name: "Swiss Franc",         symbol: "Fr",  decimal_places: 2, is_active: false, is_base: false },
  { code: "SGD", name: "Singapore Dollar",    symbol: "S$",  decimal_places: 2, is_active: false, is_base: false },
  { code: "SAR", name: "Saudi Riyal",         symbol: "SR",  decimal_places: 2, is_active: false, is_base: false },
  { code: "QAR", name: "Qatari Riyal",        symbol: "QR",  decimal_places: 2, is_active: false, is_base: false },
  { code: "KWD", name: "Kuwaiti Dinar",       symbol: "KD",  decimal_places: 3, is_active: false, is_base: false },
  { code: "BHD", name: "Bahraini Dinar",      symbol: "BD",  decimal_places: 3, is_active: false, is_base: false },
  { code: "OMR", name: "Omani Rial",          symbol: "OR",  decimal_places: 3, is_active: false, is_base: false },
];

export async function ensureSettingsTables() {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS currencies (
      code           TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      symbol         TEXT NOT NULL,
      decimal_places INTEGER NOT NULL DEFAULT 2,
      is_active      BOOLEAN NOT NULL DEFAULT TRUE,
      is_base        BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id                 SERIAL PRIMARY KEY,
      currency_code      TEXT NOT NULL,
      rate               NUMERIC(20,6) NOT NULL,
      source_type        TEXT NOT NULL DEFAULT 'Auto',
      is_manual_override BOOLEAN NOT NULL DEFAULT FALSE,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id           SERIAL PRIMARY KEY,
      bank_name    TEXT NOT NULL,
      account_no   TEXT NOT NULL,
      ifsc_code    TEXT NOT NULL DEFAULT '',
      branch       TEXT NOT NULL DEFAULT '',
      account_name TEXT NOT NULL DEFAULT '',
      bank_upi     TEXT NOT NULL DEFAULT '',
      is_default   BOOLEAN NOT NULL DEFAULT FALSE,
      created_by   TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS activity_logs (
      id           SERIAL PRIMARY KEY,
      user_email   TEXT NOT NULL,
      user_name    TEXT NOT NULL DEFAULT '',
      method       TEXT NOT NULL,
      url          TEXT NOT NULL,
      action       TEXT NOT NULL DEFAULT '',
      status_code  INTEGER NOT NULL DEFAULT 200,
      ip_address   TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS warehouse_locations (
      id             SERIAL PRIMARY KEY,
      name           TEXT NOT NULL,
      code           TEXT NOT NULL DEFAULT '',
      address_line1  TEXT NOT NULL DEFAULT '',
      address_line2  TEXT NOT NULL DEFAULT '',
      city           TEXT NOT NULL DEFAULT '',
      state          TEXT NOT NULL DEFAULT '',
      pincode        TEXT NOT NULL DEFAULT '',
      country        TEXT NOT NULL DEFAULT 'India',
      contact_name   TEXT NOT NULL DEFAULT '',
      contact_phone  TEXT NOT NULL DEFAULT '',
      contact_email  TEXT NOT NULL DEFAULT '',
      is_active      BOOLEAN NOT NULL DEFAULT TRUE,
      notes          TEXT NOT NULL DEFAULT '',
      created_by     TEXT NOT NULL DEFAULT '',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query(`SELECT COUNT(*) FROM currencies`);
  if (parseInt(rows[0].count) === 0) {
    for (const c of COMMON_CURRENCIES) {
      await pool.query(
        `INSERT INTO currencies (code, name, symbol, decimal_places, is_active, is_base)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`,
        [c.code, c.name, c.symbol, c.decimal_places, c.is_active, c.is_base]
      );
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_templates (
      id             SERIAL PRIMARY KEY,
      name           TEXT NOT NULL,
      layout         TEXT NOT NULL DEFAULT 'classic',
      payment_terms  TEXT NOT NULL DEFAULT '',
      notes          TEXT NOT NULL DEFAULT '',
      is_default     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows: tplCheck } = await pool.query(`SELECT COUNT(*) FROM invoice_templates`);
  if (parseInt(tplCheck[0].count) === 0) {
    await pool.query(`
      INSERT INTO invoice_templates (name, layout, payment_terms, notes, is_default) VALUES
      ('Classic', 'classic',
        'Payment due within 30 days of invoice date. Late payments attract 2% interest per month.',
        'Thank you for your business. Please make all cheques payable to Zari Embroideries.',
        TRUE),
      ('Modern', 'modern',
        'Net 15 — Payment due within 15 days of invoice date. Bank transfer preferred.',
        'We value your partnership. For billing queries contact accounts@zariembroideries.com.',
        FALSE),
      ('Premium', 'premium',
        'Advance payment required prior to dispatch. 50% on order, 50% before shipment.',
        'Goods once dispatched are non-returnable. Subject to jurisdiction of local courts only.',
        FALSE)
    `);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_gst_settings (
      gst_settings_id       SERIAL PRIMARY KEY,
      company_gstin         TEXT NOT NULL DEFAULT '',
      company_state         TEXT NOT NULL DEFAULT '',
      company_country       TEXT NOT NULL DEFAULT 'India',
      export_under_lut_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
      reverse_charge_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
      gst_mode              TEXT NOT NULL DEFAULT 'Auto Detect',
      default_service_gst_rate  NUMERIC(5,2) NOT NULL DEFAULT 18,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// ═══════════════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════════════

// GET /api/settings/profile
router.get("/settings/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, username, email, phone_number, profile_photo, role, is_active, created_at FROM users WHERE id = $1`,
      [req.user!.userId]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    const u = rows[0];
    res.json({
      data: {
        id: u.id,
        name: u.username,
        email: u.email,
        phone_number: u.phone_number ?? "",
        profile_photo: u.profile_photo ?? null,
        role: u.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/settings/profile
router.patch("/settings/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, phone_number, profile_photo } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    await pool.query(
      `UPDATE users SET username=$1, phone_number=$2, profile_photo=$3 WHERE id=$4`,
      [name.trim(), phone_number?.trim() || null, profile_photo ?? null, req.user!.userId]
    );
    res.json({ message: "Profile updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/settings/password
router.patch("/settings/password", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    if (!current_password || !new_password || !confirm_password)
      return res.status(400).json({ error: "All password fields are required" });
    if (new_password.length < 8)
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    if (new_password !== confirm_password)
      return res.status(400).json({ error: "New passwords do not match" });

    const { rows } = await pool.query(`SELECT hashed_password FROM users WHERE id = $1`, [req.user!.userId]);
    if (!rows.length) return res.status(404).json({ error: "User not found" });

    if (!verifyPassword(current_password, rows[0].hashed_password))
      return res.status(400).json({ error: "Current password is incorrect" });

    const hashed = hashPassword(new_password);
    await pool.query(`UPDATE users SET hashed_password=$1 WHERE id=$2`, [hashed, req.user!.userId]);
    res.json({ message: "Password updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CURRENCIES
// ═══════════════════════════════════════════════════════════════

function adminOnly(req: AuthRequest, res: any): boolean {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return false;
  }
  return true;
}

// GET /api/settings/currencies
router.get("/settings/currencies", requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM currencies ORDER BY is_base DESC, is_active DESC, code ASC`);
    res.json({ data: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/settings/currencies/base
router.patch("/settings/currencies/base", requireAuth, async (req: AuthRequest, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Currency code is required" });
    const { rows } = await pool.query(`SELECT code FROM currencies WHERE code = $1`, [code]);
    if (!rows.length) return res.status(404).json({ error: "Currency not found" });
    await pool.query(`UPDATE currencies SET is_base = FALSE, updated_at = NOW()`);
    await pool.query(`UPDATE currencies SET is_base = TRUE, is_active = TRUE, updated_at = NOW() WHERE code = $1`, [code]);
    res.json({ message: `Base currency set to ${code}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/settings/currencies/:code/toggle
router.patch("/settings/currencies/:code/toggle", requireAuth, async (req: AuthRequest, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const { code } = req.params;
    const { rows } = await pool.query(`SELECT * FROM currencies WHERE code = $1`, [code]);
    if (!rows.length) return res.status(404).json({ error: "Currency not found" });
    if (rows[0].is_base) return res.status(400).json({ error: "Cannot deactivate the base currency" });
    await pool.query(
      `UPDATE currencies SET is_active = NOT is_active, updated_at = NOW() WHERE code = $1`,
      [code]
    );
    res.json({ message: "Currency status updated" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// EXCHANGE RATES
// ═══════════════════════════════════════════════════════════════

// GET /api/settings/exchange-rates
router.get("/settings/exchange-rates", requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (er.currency_code)
        er.currency_code, er.rate, er.source_type, er.is_manual_override, er.created_at,
        c.name AS currency_name, c.symbol
      FROM exchange_rates er
      JOIN currencies c ON c.code = er.currency_code
      WHERE c.is_active = TRUE
      ORDER BY er.currency_code, er.created_at DESC
    `);
    res.json({ data: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/exchange-rates/refresh
router.post("/settings/exchange-rates/refresh", requireAuth, async (req: AuthRequest, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const baseRow = await pool.query(`SELECT code FROM currencies WHERE is_base = TRUE LIMIT 1`);
    const baseCode = baseRow.rows[0]?.code ?? "INR";

    const resp = await fetch(`https://open.er-api.com/v6/latest/${baseCode}`);
    if (!resp.ok) throw new Error("Failed to fetch exchange rates from API");
    const json: any = await resp.json();
    if (json.result !== "success") throw new Error(json["error-type"] ?? "Exchange rate API error");

    const activeCurrencies = await pool.query(
      `SELECT code FROM currencies WHERE is_active = TRUE AND code != $1`,
      [baseCode]
    );

    let updated = 0;
    for (const { code } of activeCurrencies.rows) {
      const rate = json.rates[code];
      if (rate == null) continue;
      await pool.query(
        `INSERT INTO exchange_rates (currency_code, rate, source_type, is_manual_override) VALUES ($1,$2,'Auto',FALSE)`,
        [code, rate]
      );
      updated++;
    }

    res.json({ message: `Exchange rates updated successfully (${updated} currencies)` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/settings/exchange-rates/:code (manual override)
router.patch("/settings/exchange-rates/:code", requireAuth, async (req: AuthRequest, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const { code } = req.params;
    const { rate } = req.body;
    if (!rate || isNaN(parseFloat(rate)) || parseFloat(rate) <= 0)
      return res.status(400).json({ error: "Valid positive rate is required" });
    const { rows } = await pool.query(`SELECT code FROM currencies WHERE code = $1`, [code]);
    if (!rows.length) return res.status(404).json({ error: "Currency not found" });
    await pool.query(
      `INSERT INTO exchange_rates (currency_code, rate, source_type, is_manual_override) VALUES ($1,$2,'Manual',TRUE)`,
      [code, parseFloat(rate)]
    );
    res.json({ message: `Exchange rate for ${code} updated manually` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// BANK ACCOUNTS
// ═══════════════════════════════════════════════════════════════

// GET /api/settings/bank-accounts
router.get("/settings/bank-accounts", requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM bank_accounts ORDER BY is_default DESC, created_at ASC`
    );
    res.json({ data: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/bank-accounts
router.post("/settings/bank-accounts", requireAuth, async (req: AuthRequest, res) => {
  const { bank_name, account_no, ifsc_code, branch, account_name, bank_upi, is_default } = req.body;
  if (!bank_name?.trim()) return res.status(400).json({ error: "Bank name is required" });
  if (!account_no?.trim()) return res.status(400).json({ error: "Account number is required" });
  try {
    if (is_default) await pool.query(`UPDATE bank_accounts SET is_default = FALSE`);
    const { rows } = await pool.query(
      `INSERT INTO bank_accounts (bank_name, account_no, ifsc_code, branch, account_name, bank_upi, is_default, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [bank_name.trim(), account_no.trim(), ifsc_code?.trim() ?? "", branch?.trim() ?? "", account_name?.trim() ?? "", bank_upi?.trim() ?? "", !!is_default, req.user?.email ?? ""]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/bank-accounts/:id
router.put("/settings/bank-accounts/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { bank_name, account_no, ifsc_code, branch, account_name, bank_upi } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE bank_accounts SET bank_name=$1, account_no=$2, ifsc_code=$3, branch=$4, account_name=$5, bank_upi=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [bank_name?.trim(), account_no?.trim(), ifsc_code?.trim() ?? "", branch?.trim() ?? "", account_name?.trim() ?? "", bank_upi?.trim() ?? "", id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ data: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/settings/bank-accounts/:id/default
router.patch("/settings/bank-accounts/:id/default", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await pool.query(`UPDATE bank_accounts SET is_default = FALSE`);
    const { rows } = await pool.query(
      `UPDATE bank_accounts SET is_default = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ data: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/settings/bank-accounts/:id
router.delete("/settings/bank-accounts/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await pool.query(`DELETE FROM bank_accounts WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
// ACTIVITY LOGS
// ═══════════════════════════════════════════════════════════════

// GET /api/settings/activity-logs
router.get("/settings/activity-logs", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { user_email, from, to, search, page = "1", limit: lim = "100" } = req.query as Record<string, string>;
    const isAdmin = req.user?.role === "admin";
    const offset = (parseInt(page) - 1) * parseInt(lim);

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    // Non-admins can only see their own logs
    if (!isAdmin) {
      conditions.push(`user_email = $${idx++}`);
      params.push(req.user?.email);
    } else if (user_email) {
      conditions.push(`user_email = $${idx++}`);
      params.push(user_email);
    }

    if (from) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(new Date(from).toISOString());
    }
    if (to) {
      conditions.push(`created_at <= $${idx++}`);
      params.push(new Date(to).toISOString());
    }
    if (search) {
      conditions.push(`(action ILIKE $${idx} OR url ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRes = await pool.query(`SELECT COUNT(*) FROM activity_logs ${where}`, params);
    const { rows } = await pool.query(
      `SELECT * FROM activity_logs ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(lim), offset]
    );
    res.json({ data: rows, total: parseInt(countRes.rows[0].count) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/activity-logs/action — log client-side events (e.g. PDF downloads)
router.post("/settings/activity-logs/action", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { description, method = "GET", url = "/client-action" } = req.body as { description: string; method?: string; url?: string };
    if (!description?.trim()) return res.status(400).json({ error: "description required" });
    await pool.query(
      `INSERT INTO activity_logs (user_email, user_name, method, url, action, status_code, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        req.user?.email ?? "anonymous",
        (req.user as any)?.username ?? req.user?.email ?? "",
        method,
        url,
        description.trim(),
        200,
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? "",
      ]
    );
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/settings/activity-logs/users — list of users for admin filter
router.get("/settings/activity-logs/users", requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (user_email) user_email, user_name
       FROM activity_logs
       ORDER BY user_email, created_at DESC`
    );
    res.json({ data: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
// WAREHOUSE LOCATIONS
// ═══════════════════════════════════════════════════════════════

// GET /api/settings/warehouses
router.get("/settings/warehouses", requireAuth, async (req: AuthRequest, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const { rows } = await pool.query(`SELECT * FROM warehouse_locations ORDER BY name ASC`);
    res.json({ data: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/warehouses
router.post("/settings/warehouses", requireAuth, async (req: AuthRequest, res) => {
  if (!adminOnly(req, res)) return;
  const { name, code, address_line1, address_line2, city, state, pincode, country, contact_name, contact_phone, contact_email, is_active, notes } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Warehouse name is required" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO warehouse_locations
        (name, code, address_line1, address_line2, city, state, pincode, country, contact_name, contact_phone, contact_email, is_active, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [name.trim(), code?.trim() ?? "", address_line1?.trim() ?? "", address_line2?.trim() ?? "",
       city?.trim() ?? "", state?.trim() ?? "", pincode?.trim() ?? "", country?.trim() || "India",
       contact_name?.trim() ?? "", contact_phone?.trim() ?? "", contact_email?.trim() ?? "",
       is_active !== false, notes?.trim() ?? "", req.user?.email ?? ""]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/warehouses/:id
router.put("/settings/warehouses/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!adminOnly(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { name, code, address_line1, address_line2, city, state, pincode, country, contact_name, contact_phone, contact_email, is_active, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE warehouse_locations SET
        name=$1, code=$2, address_line1=$3, address_line2=$4, city=$5, state=$6, pincode=$7,
        country=$8, contact_name=$9, contact_phone=$10, contact_email=$11, is_active=$12, notes=$13, updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [name?.trim(), code?.trim() ?? "", address_line1?.trim() ?? "", address_line2?.trim() ?? "",
       city?.trim() ?? "", state?.trim() ?? "", pincode?.trim() ?? "", country?.trim() || "India",
       contact_name?.trim() ?? "", contact_phone?.trim() ?? "", contact_email?.trim() ?? "",
       is_active !== false, notes?.trim() ?? "", id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ data: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/settings/warehouses/:id
router.delete("/settings/warehouses/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!adminOnly(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await pool.query(`DELETE FROM warehouse_locations WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
// COMPANY GST SETTINGS
// ═══════════════════════════════════════════════════════════════

// GET /api/settings/gst
router.get("/settings/gst", requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM company_gst_settings ORDER BY gst_settings_id LIMIT 1`
    );
    if (!rows.length) {
      return res.json({ data: null });
    }
    res.json({ data: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/gst
router.put("/settings/gst", requireAuth, async (req: AuthRequest, res) => {
  if (!adminOnly(req, res)) return;
  try {
    const {
      company_gstin, company_state, company_country,
      export_under_lut_enabled, reverse_charge_enabled,
      gst_mode, default_service_gst_rate,
    } = req.body;

    if (!company_state?.trim()) return res.status(400).json({ error: "Company state is required" });
    if (!company_country?.trim()) return res.status(400).json({ error: "Company country is required" });
    if (!gst_mode) return res.status(400).json({ error: "GST mode is required" });
    const rate = parseFloat(default_service_gst_rate);
    if (isNaN(rate) || rate < 0) return res.status(400).json({ error: "Default service GST rate must be 0 or greater" });

    const existing = await pool.query(`SELECT gst_settings_id FROM company_gst_settings LIMIT 1`);
    if (existing.rows.length) {
      await pool.query(
        `UPDATE company_gst_settings SET
           company_gstin=$1, company_state=$2, company_country=$3,
           export_under_lut_enabled=$4, reverse_charge_enabled=$5,
           gst_mode=$6, default_service_gst_rate=$7, updated_at=NOW()
         WHERE gst_settings_id=$8`,
        [company_gstin?.trim() ?? "", company_state.trim(), company_country.trim(),
         !!export_under_lut_enabled, !!reverse_charge_enabled,
         gst_mode, rate, existing.rows[0].gst_settings_id]
      );
    } else {
      await pool.query(
        `INSERT INTO company_gst_settings
           (company_gstin, company_state, company_country, export_under_lut_enabled,
            reverse_charge_enabled, gst_mode, default_service_gst_rate)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [company_gstin?.trim() ?? "", company_state.trim(), company_country.trim(),
         !!export_under_lut_enabled, !!reverse_charge_enabled, gst_mode, rate]
      );
    }

    res.json({ message: "GST settings updated successfully" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Invoice Templates ────────────────────────────────────────────────────────

// GET /api/settings/invoice-templates
router.get("/settings/invoice-templates", requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM invoice_templates ORDER BY id ASC`);
    res.json({ data: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/settings/invoice-templates/:id  (update payment_terms & notes)
router.patch("/settings/invoice-templates/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { payment_terms, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE invoice_templates SET payment_terms=$1, notes=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
      [payment_terms ?? "", notes ?? "", id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Template not found" });
    res.json({ data: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/invoice-templates/:id/set-default
router.post("/settings/invoice-templates/:id/set-default", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query(`UPDATE invoice_templates SET is_default = FALSE, updated_at=NOW()`);
    const { rows } = await pool.query(
      `UPDATE invoice_templates SET is_default = TRUE, updated_at=NOW() WHERE id=$1 RETURNING *`, [id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Template not found" });
    res.json({ data: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
