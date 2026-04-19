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

export default router;
