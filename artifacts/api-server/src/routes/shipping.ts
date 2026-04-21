import { Router, type Request } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

type AuthRequest = Request & { user?: { userId: number; email: string; name?: string; role: string } };

const router = Router();

// ── Table bootstrap ─────────────────────────────────────────────────────────
export async function ensureShippingTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipping_vendors (
      id              SERIAL PRIMARY KEY,
      vendor_name     TEXT NOT NULL,
      contact_person  TEXT,
      phone_number    TEXT,
      email_address   TEXT,
      weight_rate_per_kg  NUMERIC(12,4) NOT NULL DEFAULT 0,
      minimum_charge      NUMERIC(12,2) NOT NULL DEFAULT 0,
      remarks         TEXT,
      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_shipping_details (
      id                          SERIAL PRIMARY KEY,
      reference_type              TEXT NOT NULL CHECK (reference_type IN ('Swatch','Style')),
      reference_id                INTEGER NOT NULL,
      client_name                 TEXT,
      shipping_vendor_id          INTEGER REFERENCES shipping_vendors(id),
      tracking_number             TEXT,
      tracking_url                TEXT,
      shipment_weight             NUMERIC(12,4) NOT NULL DEFAULT 0,
      rate_per_kg                 NUMERIC(12,4) NOT NULL DEFAULT 0,
      calculated_shipping_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
      manual_shipping_amount_override NUMERIC(12,2),
      final_shipping_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
      shipment_status             TEXT NOT NULL DEFAULT 'Pending',
      shipment_date               DATE,
      expected_delivery_date      DATE,
      actual_delivery_date        DATE,
      remarks                     TEXT,
      created_by                  TEXT NOT NULL,
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Migration: expand reference_type check constraint to allow 'PackingList'
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'order_shipping_details_reference_type_check'
      ) THEN
        ALTER TABLE order_shipping_details
          DROP CONSTRAINT order_shipping_details_reference_type_check;
      END IF;
      ALTER TABLE order_shipping_details
        ADD CONSTRAINT order_shipping_details_reference_type_check
        CHECK (reference_type IN ('Swatch','Style','PackingList'));
    END $$;
  `);
}

// ═══════════════════════════════════════════════════════════════
// SHIPPING VENDORS
// ═══════════════════════════════════════════════════════════════

// GET /api/shipping/vendors
router.get("/shipping/vendors", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM shipping_vendors WHERE is_active = TRUE ORDER BY vendor_name`
    );
    res.json({ data: r.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shipping/vendors/all  (includes inactive, for master management)
router.get("/shipping/vendors/all", requireAuth, async (req, res) => {
  try {
    const { search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const params: any[] = [];
    const conditions: string[] = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(vendor_name ILIKE $${params.length} OR contact_person ILIKE $${params.length} OR phone_number ILIKE $${params.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [rows, count] = await Promise.all([
      pool.query(`SELECT * FROM shipping_vendors ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, parseInt(limit), offset]),
      pool.query(`SELECT COUNT(*) FROM shipping_vendors ${where}`, params),
    ]);
    res.json({ data: rows.rows, total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shipping/vendors
router.post("/shipping/vendors", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { vendor_name, contact_person, phone_number, email_address, weight_rate_per_kg, minimum_charge, remarks } = req.body;
    if (!vendor_name?.trim()) return res.status(400).json({ error: "Vendor name is required" });
    const r = await pool.query(
      `INSERT INTO shipping_vendors (vendor_name, contact_person, phone_number, email_address, weight_rate_per_kg, minimum_charge, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [vendor_name.trim(), contact_person || null, phone_number || null, email_address || null,
       parseFloat(weight_rate_per_kg) || 0, parseFloat(minimum_charge) || 0, remarks || null]
    );
    res.status(201).json({ data: r.rows[0], message: "Shipping vendor created" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shipping/vendors/:id
router.put("/shipping/vendors/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { vendor_name, contact_person, phone_number, email_address, weight_rate_per_kg, minimum_charge, remarks } = req.body;
    if (!vendor_name?.trim()) return res.status(400).json({ error: "Vendor name is required" });
    const r = await pool.query(
      `UPDATE shipping_vendors SET vendor_name=$1, contact_person=$2, phone_number=$3, email_address=$4,
       weight_rate_per_kg=$5, minimum_charge=$6, remarks=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [vendor_name.trim(), contact_person || null, phone_number || null, email_address || null,
       parseFloat(weight_rate_per_kg) || 0, parseFloat(minimum_charge) || 0, remarks || null, id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ data: r.rows[0], message: "Shipping vendor updated" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/shipping/vendors/:id/status
router.patch("/shipping/vendors/:id/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `UPDATE shipping_vendors SET is_active = NOT is_active, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ data: r.rows[0], message: `Vendor ${r.rows[0].is_active ? "activated" : "deactivated"}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/shipping/vendors/:id  (admin only)
router.delete("/shipping/vendors/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(`DELETE FROM shipping_vendors WHERE id=$1 RETURNING id`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: "Vendor not found" });
    res.json({ message: "Vendor deleted" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// SHIPPING DETAILS
// ═══════════════════════════════════════════════════════════════

function calcShipping(weight: number, ratePerKg: number, minCharge: number, override?: number | null): {
  calculated: number; final: number;
} {
  const calculated = Math.max(weight * ratePerKg, minCharge);
  const final = (override != null && override > 0) ? override : calculated;
  return { calculated, final };
}

// GET /api/shipping/details — list with filters
router.get("/shipping/details", requireAuth, async (req, res) => {
  try {
    const { status, vendorId, referenceType, fromDate, toDate, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) { params.push(status); conditions.push(`d.shipment_status = $${params.length}`); }
    if (vendorId) { params.push(parseInt(vendorId)); conditions.push(`d.shipping_vendor_id = $${params.length}`); }
    if (referenceType) { params.push(referenceType); conditions.push(`d.reference_type = $${params.length}`); }
    if (fromDate) { params.push(fromDate); conditions.push(`d.shipment_date >= $${params.length}`); }
    if (toDate) { params.push(toDate); conditions.push(`d.shipment_date <= $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(d.tracking_number ILIKE $${params.length} OR d.client_name ILIKE $${params.length} OR CAST(d.reference_id AS TEXT) ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT d.*, sv.vendor_name,
                COALESCE(sw.order_code, so.order_code) AS order_code
         FROM order_shipping_details d
         LEFT JOIN shipping_vendors sv ON sv.id = d.shipping_vendor_id
         LEFT JOIN swatch_orders sw ON d.reference_type = 'Swatch' AND sw.id = d.reference_id
         LEFT JOIN style_orders so  ON d.reference_type = 'Style'  AND so.id = d.reference_id
         ${where} ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), offset]
      ),
      pool.query(`SELECT COUNT(*) FROM order_shipping_details d ${where}`, params),
    ]);

    res.json({ data: rows.rows, total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shipping/details/by-reference?referenceType=Swatch&referenceId=5
router.get("/shipping/details/by-reference", requireAuth, async (req, res) => {
  try {
    const { referenceType, referenceId } = req.query as Record<string, string>;
    if (!referenceType || !referenceId) return res.status(400).json({ error: "referenceType and referenceId are required" });
    const r = await pool.query(
      `SELECT d.*, sv.vendor_name, sv.weight_rate_per_kg as vendor_rate_per_kg, sv.minimum_charge as vendor_minimum_charge
       FROM order_shipping_details d
       LEFT JOIN shipping_vendors sv ON sv.id = d.shipping_vendor_id
       WHERE d.reference_type = $1 AND d.reference_id = $2
       ORDER BY d.created_at DESC`,
      [referenceType, parseInt(referenceId)]
    );
    res.json({ data: r.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shipping/details/:id
router.get("/shipping/details/:id", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT d.*, sv.vendor_name FROM order_shipping_details d
       LEFT JOIN shipping_vendors sv ON sv.id = d.shipping_vendor_id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ data: r.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shipping/details
router.post("/shipping/details", requireAuth, async (req: AuthRequest, res) => {
  try {
    const actor = (req as any).user?.name || (req as any).user?.email || "System";
    const {
      reference_type, reference_id, client_name, shipping_vendor_id,
      tracking_number, tracking_url,
      shipment_weight, manual_shipping_amount_override,
      shipment_status, shipment_date, expected_delivery_date, actual_delivery_date, remarks
    } = req.body;

    if (!shipping_vendor_id) return res.status(400).json({ error: "Shipping vendor is required" });
    const weight = parseFloat(shipment_weight) || 0;
    if (weight <= 0) return res.status(400).json({ error: "Shipment weight must be greater than 0" });

    // Validate tracking number uniqueness per vendor
    if (tracking_number?.trim()) {
      const dup = await pool.query(
        `SELECT id FROM order_shipping_details WHERE tracking_number = $1 AND shipping_vendor_id = $2`,
        [tracking_number.trim(), shipping_vendor_id]
      );
      if (dup.rows.length) return res.status(400).json({ error: "Tracking number already exists for this vendor" });
    }

    const vendor = await pool.query(`SELECT weight_rate_per_kg, minimum_charge FROM shipping_vendors WHERE id = $1`, [shipping_vendor_id]);
    if (!vendor.rows.length) return res.status(404).json({ error: "Shipping vendor not found" });
    const { weight_rate_per_kg, minimum_charge } = vendor.rows[0];
    const override = manual_shipping_amount_override ? parseFloat(manual_shipping_amount_override) : null;
    const { calculated, final } = calcShipping(weight, parseFloat(weight_rate_per_kg), parseFloat(minimum_charge), override);

    const r = await pool.query(
      `INSERT INTO order_shipping_details
         (reference_type, reference_id, client_name, shipping_vendor_id, tracking_number, tracking_url,
          shipment_weight, rate_per_kg, calculated_shipping_amount, manual_shipping_amount_override,
          final_shipping_amount, shipment_status, shipment_date, expected_delivery_date, actual_delivery_date,
          remarks, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [reference_type || "PackingList", reference_id || 0, client_name || null, shipping_vendor_id,
       tracking_number?.trim() || null, tracking_url?.trim() || null,
       weight, parseFloat(weight_rate_per_kg), calculated, override,
       final, shipment_status || "Pending",
       shipment_date || null, expected_delivery_date || null, actual_delivery_date || null,
       remarks || null, actor]
    );
    res.status(201).json({ data: r.rows[0], message: "Shipping details added successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shipping/details/:id
router.put("/shipping/details/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query(`SELECT * FROM order_shipping_details WHERE id = $1`, [id]);
    if (!existing.rows.length) return res.status(404).json({ error: "Not found" });

    const {
      shipping_vendor_id, tracking_number, tracking_url,
      shipment_weight, manual_shipping_amount_override,
      shipment_status, shipment_date, expected_delivery_date, actual_delivery_date, remarks
    } = req.body;

    const weight = parseFloat(shipment_weight) || 0;
    if (weight <= 0) return res.status(400).json({ error: "Shipment weight must be greater than 0" });

    // Validate tracking number uniqueness per vendor (exclude self)
    if (tracking_number?.trim()) {
      const dup = await pool.query(
        `SELECT id FROM order_shipping_details WHERE tracking_number = $1 AND shipping_vendor_id = $2 AND id != $3`,
        [tracking_number.trim(), shipping_vendor_id, id]
      );
      if (dup.rows.length) return res.status(400).json({ error: "Tracking number already exists for this vendor" });
    }

    const vendor = await pool.query(`SELECT weight_rate_per_kg, minimum_charge FROM shipping_vendors WHERE id = $1`, [shipping_vendor_id]);
    if (!vendor.rows.length) return res.status(404).json({ error: "Shipping vendor not found" });
    const { weight_rate_per_kg, minimum_charge } = vendor.rows[0];
    const override = manual_shipping_amount_override ? parseFloat(manual_shipping_amount_override) : null;
    const { calculated, final } = calcShipping(weight, parseFloat(weight_rate_per_kg), parseFloat(minimum_charge), override);

    const r = await pool.query(
      `UPDATE order_shipping_details SET
         shipping_vendor_id=$1, tracking_number=$2, tracking_url=$3,
         shipment_weight=$4, rate_per_kg=$5, calculated_shipping_amount=$6,
         manual_shipping_amount_override=$7, final_shipping_amount=$8,
         shipment_status=$9, shipment_date=$10, expected_delivery_date=$11,
         actual_delivery_date=$12, remarks=$13, updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [shipping_vendor_id, tracking_number?.trim() || null, tracking_url?.trim() || null,
       weight, parseFloat(weight_rate_per_kg), calculated, override,
       final, shipment_status || "Pending",
       shipment_date || null, expected_delivery_date || null, actual_delivery_date || null,
       remarks || null, id]
    );
    res.json({ data: r.rows[0], message: "Shipping details updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/shipping/details/:id/status
router.patch("/shipping/details/:id/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { shipment_status } = req.body;
    const valid = ["Pending","Dispatched","In Transit","Delivered","Returned","Cancelled"];
    if (!valid.includes(shipment_status)) return res.status(400).json({ error: "Invalid shipment status" });
    const r = await pool.query(
      `UPDATE order_shipping_details SET shipment_status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [shipment_status, id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ data: r.rows[0], message: "Shipment status updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/shipping/details/:id  (admin only)
router.delete("/shipping/details/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
    const r = await pool.query(`DELETE FROM order_shipping_details WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Shipping record deleted" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
