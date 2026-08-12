import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import path from "path";
import fs from "fs";
import { uploadMiddleware, uploadFile, deleteUpload, resolveUploadAbsPath } from "../utils/uploadHelper";
import { nextSequenceNumber } from "../utils/sequence";
import { checkPermission } from "../middlewares/checkPermission";
import { LOGISTICS_PACKING_LISTS } from "../constants/permissions";

type AuthRequest = Request & { user?: { userId: number; email: string; name?: string; role: string } };

const router = Router();

function err(res: Response, e: unknown, msg = "Server error") {
  console.error(`[packing-lists] ${msg}:`, e);
  return res.status(500).json({ error: msg });
}

async function nextPLNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextSequenceNumber("packing_lists", "pl_number", `PL-${year}-%`);
  return `PL-${year}-${String(n).padStart(4, "0")}`;
}

// ═══════════════════════════════════════════════════════════════
// DELIVERY ADDRESSES
// ═══════════════════════════════════════════════════════════════

router.get("/delivery-addresses", requireAuth, async (req, res) => {
  try {
    const { client_id } = req.query;
    const where = client_id ? "WHERE da.is_deleted = false AND da.client_id = $1" : "WHERE da.is_deleted = false";
    const params = client_id ? [client_id] : [];
    const r = await pool.query(
      `SELECT da.*, c.brand_name AS client_name
       FROM delivery_addresses da
       JOIN clients c ON c.id = da.client_id AND c.is_deleted = false
       ${where}
       ORDER BY da.is_default DESC, da.label`,
      params
    );
    return res.json({ data: r.rows });
  } catch (e) { return err(res, e, "Failed to fetch delivery addresses"); }
});

router.post("/delivery-addresses", requireAuth, async (req, res) => {
  try {
    const { client_id, label, address_line1, address_line2, city, state, country, pincode, is_default } = req.body;
    if (!client_id) return res.status(400).json({ error: "client_id is required" });
    // Validation
    if (!label || !String(label).trim()) return res.status(400).json({ error: "Label is required" });
    if (!address_line1 || !String(address_line1).trim()) return res.status(400).json({ error: "Address Line 1 is required" });
    if (!city || !String(city).trim()) return res.status(400).json({ error: "City is required" });
    if (!state || !String(state).trim()) return res.status(400).json({ error: "State is required" });
    if (!country || !String(country).trim()) return res.status(400).json({ error: "Country is required" });
    if (!pincode || !/^\d{6}$/.test(String(pincode).trim())) return res.status(400).json({ error: "Pincode must be exactly 6 digits" });
    const lettersOnly = /^[A-Za-z][A-Za-z\s.\-']{0,99}$/;
    if (!lettersOnly.test(String(city).trim())) return res.status(400).json({ error: "City must contain only letters" });
    if (!lettersOnly.test(String(state).trim())) return res.status(400).json({ error: "State must contain only letters" });
    if (!lettersOnly.test(String(country).trim())) return res.status(400).json({ error: "Country must contain only letters" });
    if (is_default) {
      await pool.query(`UPDATE delivery_addresses SET is_default = FALSE WHERE client_id = $1`, [client_id]);
    }
    const r = await pool.query(
      `INSERT INTO delivery_addresses (client_id, label, address_line1, address_line2, city, state, country, pincode, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [client_id, label || "Default", address_line1 || null, address_line2 || null,
       city || null, state || null, country || null, pincode || null, !!is_default]
    );
    return res.status(201).json({ data: r.rows[0] });
  } catch (e) { return err(res, e, "Failed to create delivery address"); }
});

router.put("/delivery-addresses/:id", requireAuth, async (req, res) => {
  try {
    const { label, address_line1, address_line2, city, state, country, pincode, is_default } = req.body;
    const existing = await pool.query(`SELECT * FROM delivery_addresses WHERE id = $1 AND is_deleted = false`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: "Not found" });
    // Mirror POST validation for any field actually being changed.
    const lettersOnly = /^[A-Za-z][A-Za-z\s.\-']{0,99}$/;
    if (label !== undefined && !String(label).trim()) return res.status(400).json({ error: "Label is required" });
    if (address_line1 !== undefined && !String(address_line1).trim()) return res.status(400).json({ error: "Address Line 1 is required" });
    if (city !== undefined) {
      if (!String(city).trim()) return res.status(400).json({ error: "City is required" });
      if (!lettersOnly.test(String(city).trim())) return res.status(400).json({ error: "City must contain only letters" });
    }
    if (state !== undefined) {
      if (!String(state).trim()) return res.status(400).json({ error: "State is required" });
      if (!lettersOnly.test(String(state).trim())) return res.status(400).json({ error: "State must contain only letters" });
    }
    if (country !== undefined) {
      if (!String(country).trim()) return res.status(400).json({ error: "Country is required" });
      if (!lettersOnly.test(String(country).trim())) return res.status(400).json({ error: "Country must contain only letters" });
    }
    if (pincode !== undefined && !/^\d{6}$/.test(String(pincode).trim())) {
      return res.status(400).json({ error: "Pincode must be exactly 6 digits" });
    }
    if (is_default) {
      await pool.query(`UPDATE delivery_addresses SET is_default = FALSE WHERE client_id = $1`, [existing.rows[0].client_id]);
    }
    const r = await pool.query(
      `UPDATE delivery_addresses SET
         label = $1, address_line1 = $2, address_line2 = $3, city = $4, state = $5,
         country = $6, pincode = $7, is_default = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [label || existing.rows[0].label, address_line1 ?? existing.rows[0].address_line1,
       address_line2 ?? existing.rows[0].address_line2, city ?? existing.rows[0].city,
       state ?? existing.rows[0].state, country ?? existing.rows[0].country,
       pincode ?? existing.rows[0].pincode, is_default !== undefined ? !!is_default : existing.rows[0].is_default,
       req.params.id]
    );
    return res.json({ data: r.rows[0] });
  } catch (e) { return err(res, e, "Failed to update delivery address"); }
});

router.delete("/delivery-addresses/:id", requireAuth, async (req, res) => {
  try {
    const deletedByUser = (req.user as any)?.email ?? "system";
    const inUse = await pool.query(`SELECT id FROM packing_lists WHERE delivery_address_id = $1 AND is_deleted = false LIMIT 1`, [req.params.id]);
    if (inUse.rows.length) return res.status(400).json({ error: "Address is used by a packing list and cannot be deleted" });
    const { rowCount } = await pool.query(`UPDATE delivery_addresses SET is_deleted = true, updated_at = NOW(), deleted_by = $2, deleted_at = now() WHERE id = $1 AND is_deleted = false`, [req.params.id, deletedByUser]);
    if (rowCount === 0) return res.status(404).json({ error: "Not found" });
    return res.json({ success: true });
  } catch (e) { return err(res, e, "Failed to delete delivery address"); }
});

// ═══════════════════════════════════════════════════════════════
// ELIGIBLE ORDERS (by client + delivery address, no PL required)
// ═══════════════════════════════════════════════════════════════

router.get("/eligible-orders-for-packing", requireAuth, async (req, res) => {
  try {
    const { client_id, delivery_address_id } = req.query;
    if (!client_id) return res.status(400).json({ error: "client_id is required" });


    const [swatches, styles] = await Promise.all([
      pool.query(
        `SELECT id, order_code, swatch_name AS name, client_name, order_status, quantity
         FROM swatch_orders o
         WHERE client_id::text = $1::text  AND is_deleted = FALSE
           AND order_status NOT IN ('Shipped','Cancelled')
           AND order_status = 'Completed'
         ORDER BY order_code DESC LIMIT 300`,
        [client_id]
      ),
      pool.query(
        `SELECT id, order_code, style_name AS name, client_name, order_status, quantity
         FROM style_orders o
         WHERE client_id::text = $1::text  AND is_deleted = FALSE
           AND order_status NOT IN ('Shipped','Cancelled')
           AND order_status = 'Completed'
         ORDER BY order_code DESC LIMIT 300`,
        [client_id]
      ),
    ]);

    return res.json({ swatches: swatches.rows, styles: styles.rows });
  } catch (e) { return err(res, e, "Failed to fetch eligible orders"); }
});

// ═══════════════════════════════════════════════════════════════
// PACKING LISTS — LIST + DETAIL + CREATE + UPDATE + DELETE
// ═══════════════════════════════════════════════════════════════

// GET /api/packing-lists
router.get("/packing-lists", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.VIEW] }),  
  async (req, res) => {
  try {
    const { client_id, shipment_id, status, page = "1", limit = "25" } = req.query;
    const conditions: string[] = ["pl.is_deleted = false"];
    const params: unknown[] = [];
    let p = 1;

    if (client_id)   { conditions.push(`pl.client_id = $${p++}`);   params.push(client_id); }
    if (shipment_id) { conditions.push(`pl.shipment_id = $${p++}`); params.push(shipment_id); }
    if (status)      { conditions.push(`pl.status = $${p++}`);      params.push(status); }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [data, total] = await Promise.all([
      pool.query(
        `SELECT pl.*,
                c.brand_name AS client_name,
                da.label AS delivery_address_label,
                da.address_line1, da.address_line2, da.city, da.state, da.country AS addr_country,
                osd.tracking_number AS shipment_tracking,
                osd.shipment_status AS shipment_status_val,
                osd.shipment_date,
                (SELECT COUNT(*) FROM packing_packages pp WHERE pp.packing_list_id = pl.id AND pp.is_deleted = false) AS total_packages,
                (SELECT COALESCE(SUM(pp.net_weight),0)   FROM packing_packages pp WHERE pp.packing_list_id = pl.id AND pp.is_deleted = false) AS total_net_weight,
                (SELECT COALESCE(SUM(pp.gross_weight),0) FROM packing_packages pp WHERE pp.packing_list_id = pl.id AND pp.is_deleted = false) AS total_gross_weight,
                (SELECT COUNT(*) FROM packing_packages pp
                   JOIN packing_package_items ppi ON ppi.package_id = pp.id AND ppi.is_deleted = false
                   WHERE pp.packing_list_id = pl.id AND pp.is_deleted = false) AS total_items
         FROM packing_lists pl
         JOIN clients c ON c.id = pl.client_id AND c.is_deleted = false
         LEFT JOIN delivery_addresses da ON da.id = pl.delivery_address_id AND da.is_deleted = false
         LEFT JOIN order_shipping_details osd ON osd.id = pl.shipment_id AND osd.is_deleted = false
         ${where}
         ORDER BY pl.created_at DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        [...params, parseInt(limit as string), offset]
      ),
      pool.query(`SELECT COUNT(*) FROM packing_lists pl ${where}`, params),
    ]);

    return res.json({ data: data.rows, total: parseInt(total.rows[0].count), page: parseInt(page as string) });
  } catch (e) { return err(res, e, "Failed to fetch packing lists"); }
});

// GET /api/packing-lists/:id
router.get("/packing-lists/:id", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.VIEW] }),  
  async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT pl.*,
              c.brand_name AS client_name,
              da.label AS delivery_address_label,
              da.address_line1, da.address_line2, da.city, da.state, da.country AS addr_country, da.pincode AS addr_pincode,
              osd.tracking_number AS shipment_tracking,
              osd.shipment_date, osd.shipment_status AS shipment_status_val,
              sv.vendor_name AS shipping_vendor_name
       FROM packing_lists pl
       JOIN clients c ON c.id = pl.client_id AND c.is_deleted = false
       LEFT JOIN delivery_addresses da ON da.id = pl.delivery_address_id AND da.is_deleted = false
       LEFT JOIN order_shipping_details osd ON osd.id = pl.shipment_id AND osd.is_deleted = false
       LEFT JOIN shipping_vendors sv ON sv.id = osd.shipping_vendor_id AND sv.is_deleted = false
       WHERE pl.id = $1 AND pl.is_deleted = false`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Packing list not found" });

    // Load packages with their items
    const pkgs = await pool.query(
      `SELECT pp.*,
              (SELECT COUNT(*) FROM packing_package_items ppi WHERE ppi.package_id = pp.id AND ppi.is_deleted = false) AS item_count
       FROM packing_packages pp
       WHERE pp.packing_list_id = $1 AND pp.is_deleted = false
       ORDER BY pp.package_number`,
      [req.params.id]
    );

    const packagesWithItems: any[] = [];
    for (const pkg of pkgs.rows) {
      const items = await pool.query(
        `SELECT * FROM packing_package_items WHERE package_id = $1 AND is_deleted = false ORDER BY id`,
        [pkg.id]
      );
      packagesWithItems.push({ ...pkg, items: items.rows });
    }

    return res.json({ data: { ...r.rows[0], packages: packagesWithItems } });
  } catch (e) { return err(res, e, "Failed to fetch packing list"); }
});

// ── helper: insert one package item, handles stock deduction for inventory items ──
async function insertPackageItem(pkgId: number, item: any): Promise<void> {
  const src = item.item_source ?? "order";

  if (src === "order") {
    await pool.query(
      `INSERT INTO packing_package_items
         (package_id, item_source, order_type, order_id, order_code, description, quantity, unit, item_weight)
       VALUES ($1,'order',$2,$3,$4,$5,$6,$7,$8)`,
      [pkgId, item.order_type, item.order_id, item.order_code || null,
       item.description || null, item.quantity || null, item.unit || null, item.item_weight || null]
    );
    return;
  }

  if (src === "custom") {
    await pool.query(
      `INSERT INTO packing_package_items
         (package_id, item_source, description, quantity, unit, item_weight)
       VALUES ($1,'custom',$2,$3,$4,$5)`,
      [pkgId, item.description || null, item.quantity || null, item.unit || null, item.item_weight || null]
    );
    return;
  }

  // material or fabric — deduct stock
  if (src === "material" || src === "fabric") {
    const invTable = src === "material" ? "materials" : "fabrics";
    const qty = parseFloat(item.quantity);
    if (!item.inventory_id || isNaN(qty) || qty <= 0) {
      // Skip silently if no inventory reference or qty
      return;
    }

    const inv = await pool.query(
      `SELECT current_stock, location_stocks FROM ${invTable} WHERE id = $1 AND is_deleted = false`,
      [item.inventory_id]
    );
    if (!inv.rows.length) return;

    const invRow = inv.rows[0];
    const locationStocks: { location: string; stock: string }[] = invRow.location_stocks ?? [];
    let resolvedLocation: string | null = item.deducted_from_location || null;
    let stockDeducted = 0;

    if (resolvedLocation && locationStocks.length > 0) {
      const locIdx = locationStocks.findIndex((ls: { location: string }) => ls.location === resolvedLocation);
      if (locIdx >= 0) {
        const locStock = parseFloat(locationStocks[locIdx].stock);
        const deduct = Math.min(qty, locStock);
        locationStocks[locIdx] = { location: resolvedLocation, stock: String(locStock - deduct) };
        const newTotal = Math.max(0, parseFloat(invRow.current_stock) - deduct);
        await pool.query(
          `UPDATE ${invTable} SET current_stock = $1, location_stocks = $2 WHERE id = $3`,
          [String(newTotal), JSON.stringify(locationStocks), item.inventory_id]
        );
        stockDeducted = deduct;
      }
    } else {
      const totalStock = parseFloat(invRow.current_stock);
      const deduct = Math.min(qty, totalStock);
      await pool.query(
        `UPDATE ${invTable} SET current_stock = $1 WHERE id = $2`,
        [String(Math.max(0, totalStock - deduct)), item.inventory_id]
      );
      resolvedLocation = null;
      stockDeducted = deduct;
    }

    await pool.query(
      `INSERT INTO packing_package_items
         (package_id, item_source, inventory_id, inventory_type,
          description, quantity, unit, item_weight, stock_deducted, deducted_from_location)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [pkgId, src, item.inventory_id, src,
       item.description || null, String(qty), item.unit || null, item.item_weight || null,
       stockDeducted, resolvedLocation]
    );
  }
}

// POST /api/packing-lists
router.post("/packing-lists", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.ADD_EDIT] }), 
  async (req: AuthRequest, res) => {
  try {
    const {
      client_id, delivery_address_id, shipment_id,
      destination_country, remarks, status = "Draft",
      packages = [],
    } = req.body;

    if (!client_id) return res.status(400).json({ error: "client_id is required" });
    if (!delivery_address_id) return res.status(400).json({ error: "delivery_address_id is required" });
    if (!Array.isArray(packages) || packages.length === 0)
      return res.status(400).json({ error: "At least one package is required" });

    // Validate every package: weights/dims must be ≥ 0, and net ≤ gross.
    for (let i = 0; i < packages.length; i++) {
      const pk = packages[i];
      const net = parseFloat(pk.net_weight);
      const gross = parseFloat(pk.gross_weight);
      if (!isNaN(net) && !isNaN(gross) && net > gross) {
        return res.status(400).json({ error: `Package ${i + 1}: Net weight (${net}) cannot exceed Gross weight (${gross})` });
      }
      for (const k of ["length", "width", "height", "net_weight", "gross_weight"] as const) {
        const v = parseFloat(pk[k]);
        if (!isNaN(v) && v < 0) return res.status(400).json({ error: `Package ${i + 1}: ${k} cannot be negative` });
      }
    }

    const addrCheck = await pool.query(
      `SELECT id FROM delivery_addresses WHERE id = $1 AND client_id = $2 AND is_deleted = false`,
      [delivery_address_id, client_id]
    );
    if (!addrCheck.rows.length)
      return res.status(400).json({ error: "Delivery address does not belong to selected client" });

    // Validate: no shipped orders
    for (const pkg of packages) {
      for (const item of (pkg.items ?? [])) {
        const tbl = item.order_type === "Swatch" ? "swatch_orders" : "style_orders";
        const chk = await pool.query(`SELECT order_status FROM ${tbl} WHERE id = $1 AND is_deleted = false`, [item.order_id]);
        if (chk.rows[0]?.order_status === "Shipped")
          return res.status(400).json({ error: `Order ${item.order_code ?? item.order_id} is already shipped and cannot be packed` });
      }
    }

    const pl_number = await nextPLNumber();
    const created_by = req.user?.name || req.user?.email || "system";

    const pl = await pool.query(
      `INSERT INTO packing_lists
         (pl_number, client_id, delivery_address_id, shipment_id, destination_country, remarks, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [pl_number, client_id, delivery_address_id, shipment_id || null,
       destination_country || null, remarks || null, status, created_by]
    );
    const plId = pl.rows[0].id;

    // Insert packages + items
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      const pkgRow = await pool.query(
        `INSERT INTO packing_packages (packing_list_id, package_number, length, width, height, net_weight, gross_weight, shipment_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [plId, i + 1, pkg.length || null, pkg.width || null, pkg.height || null,
         pkg.net_weight || null, pkg.gross_weight || null, pkg.shipment_id || shipment_id || null]
      );
      const pkgId = pkgRow.rows[0].id;
      for (const item of (pkg.items ?? [])) {
        await insertPackageItem(pkgId, item);
      }
    }

    return res.status(201).json({
      data: pl.rows[0],
      message: "Packing list created successfully with package details",
    });
  } catch (e) { return err(res, e, "Failed to create packing list"); }
});

// PUT /api/packing-lists/:id  (header + packages full replace)
router.put("/packing-lists/:id", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.ADD_EDIT] }), 
  async (req, res) => {
  try {
    const deletedByUser = (req.user as any)?.email ?? "system";
    const existing = await pool.query(`SELECT * FROM packing_lists WHERE id = $1 AND is_deleted = false`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: "Not found" });
    const ex = existing.rows[0];

    const { delivery_address_id, shipment_id, destination_country, status, remarks, packages } = req.body;

    if (delivery_address_id && delivery_address_id !== ex.delivery_address_id) {
      const addrCheck = await pool.query(
        `SELECT id FROM delivery_addresses WHERE id = $1 AND client_id = $2 AND is_deleted = false`,
        [delivery_address_id, ex.client_id]
      );
      if (!addrCheck.rows.length)
        return res.status(400).json({ error: "Delivery address does not belong to this client" });
    }

    const r = await pool.query(
      `UPDATE packing_lists SET
         delivery_address_id = $1, shipment_id = $2, destination_country = $3,
         status = $4, remarks = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [
        delivery_address_id ?? ex.delivery_address_id,
        shipment_id !== undefined ? (shipment_id || null) : ex.shipment_id,
        destination_country ?? ex.destination_country,
        status ?? ex.status,
        remarks ?? ex.remarks,
        req.params.id,
      ]
    );

    // If packages array provided, do a clean replace
    if (Array.isArray(packages)) {
      // Validate every package the same way as POST.
      for (let i = 0; i < packages.length; i++) {
        const pk = packages[i];
        const net = parseFloat(pk.net_weight);
        const gross = parseFloat(pk.gross_weight);
        if (!isNaN(net) && !isNaN(gross) && net > gross) {
          return res.status(400).json({ error: `Package ${i + 1}: Net weight (${net}) cannot exceed Gross weight (${gross})` });
        }
        for (const k of ["length", "width", "height", "net_weight", "gross_weight"] as const) {
          const v = parseFloat(pk[k]);
          if (!isNaN(v) && v < 0) return res.status(400).json({ error: `Package ${i + 1}: ${k} cannot be negative` });
        }
      }
      // Before deleting, restore stock for any inventory items being replaced
      const oldItems = await pool.query(
        `SELECT ppi.* FROM packing_package_items ppi
         JOIN packing_packages pp ON pp.id = ppi.package_id AND pp.is_deleted = false
         WHERE pp.packing_list_id = $1
           AND ppi.is_deleted = false
           AND ppi.item_source IN ('material','fabric')
           AND ppi.stock_deducted > 0`,
        [req.params.id]
      );
      for (const oi of oldItems.rows) {
        const invTable = oi.item_source === "material" ? "materials" : "fabrics";
        const deducted = parseFloat(oi.stock_deducted);
        const inv = await pool.query(`SELECT current_stock, location_stocks FROM ${invTable} WHERE id = $1`, [oi.inventory_id]);
        if (!inv.rows.length) continue;
        const invRow = inv.rows[0];
        const newTotal = parseFloat(invRow.current_stock) + deducted;
        if (oi.deducted_from_location) {
          const ls: { location: string; stock: string }[] = invRow.location_stocks ?? [];
          const idx = ls.findIndex((x: { location: string }) => x.location === oi.deducted_from_location);
          if (idx >= 0) ls[idx] = { location: oi.deducted_from_location, stock: String(parseFloat(ls[idx].stock) + deducted) };
          else ls.push({ location: oi.deducted_from_location, stock: String(deducted) });
          await pool.query(`UPDATE ${invTable} SET current_stock = $1, location_stocks = $2 WHERE id = $3`, [String(newTotal), JSON.stringify(ls), oi.inventory_id]);
        } else {
          await pool.query(`UPDATE ${invTable} SET current_stock = $1 WHERE id = $2`, [String(newTotal), oi.inventory_id]);
        }
      }

      // Soft-delete all existing packages and their items (clean replace)
      await pool.query(
        `UPDATE packing_package_items SET is_deleted = true, deleted_by = $2, deleted_at = now()
         WHERE package_id IN (SELECT id FROM packing_packages WHERE packing_list_id = $1 AND is_deleted = false)`,
        [req.params.id, deletedByUser]
      );
      await pool.query(`UPDATE packing_packages SET is_deleted = true, deleted_by = $2, deleted_at = now() WHERE packing_list_id = $1`, [req.params.id, deletedByUser]);

      for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i];
        const pkgRow = await pool.query(
          `INSERT INTO packing_packages (packing_list_id, package_number, length, width, height, net_weight, gross_weight, shipment_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [req.params.id, i + 1, pkg.length || null, pkg.width || null, pkg.height || null,
           pkg.net_weight || null, pkg.gross_weight || null, pkg.shipment_id || shipment_id || null]
        );
        const pkgId = pkgRow.rows[0].id;
        for (const item of (pkg.items ?? [])) {
          await insertPackageItem(pkgId, item);
        }
      }
    }

    return res.json({ data: r.rows[0] });
  } catch (e) { return err(res, e, "Failed to update packing list"); }
});

// DELETE /api/packing-lists/:id
router.delete("/packing-lists/:id", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.DELETE] }), 
  async (req, res) => {
  try {
    const deletedByUser = (req.user as any)?.email ?? "system";
    const { rowCount } = await pool.query(
      `UPDATE packing_lists SET is_deleted = true, updated_at = NOW(), deleted_by = $2, deleted_at = now() WHERE id = $1 AND is_deleted = false`,
      [req.params.id, deletedByUser]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Not found" });
    // Soft-delete children (legacy list items, packages, and package items)
    await pool.query(`UPDATE packing_list_items SET is_deleted = true, deleted_by = $2, deleted_at = now() WHERE packing_list_id = $1`, [req.params.id, deletedByUser]);
    await pool.query(
      `UPDATE packing_package_items SET is_deleted = true, deleted_by = $2, deleted_at = now()
       WHERE package_id IN (SELECT id FROM packing_packages WHERE packing_list_id = $1)`,
      [req.params.id, deletedByUser]
    );
    await pool.query(`UPDATE packing_packages SET is_deleted = true, deleted_by = $2, deleted_at = now() WHERE packing_list_id = $1`, [req.params.id, deletedByUser]);
    return res.json({ success: true });
  } catch (e) { return err(res, e, "Failed to delete packing list"); }
});

// ═══════════════════════════════════════════════════════════════
// PACKAGES — CREATE / UPDATE / DELETE
// ═══════════════════════════════════════════════════════════════

// POST /api/packing-lists/:id/packages
router.post("/packing-lists/:id/packages", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.ADD_EDIT] }), 
  async (req, res) => {
  try {
    const pl = await pool.query(`SELECT * FROM packing_lists WHERE id = $1 AND is_deleted = false`, [req.params.id]);
    if (!pl.rows.length) return res.status(404).json({ error: "Packing list not found" });

    const { length, width, height, net_weight, gross_weight, shipment_id } = req.body;

    const maxPkg = await pool.query(
      `SELECT COALESCE(MAX(package_number),0) AS mx FROM packing_packages WHERE packing_list_id = $1`,
      [req.params.id]
    );
    const nextNum = parseInt(maxPkg.rows[0].mx) + 1;

    const r = await pool.query(
      `INSERT INTO packing_packages (packing_list_id, package_number, length, width, height, net_weight, gross_weight, shipment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, nextNum, length || null, width || null, height || null,
       net_weight || null, gross_weight || null, shipment_id || pl.rows[0].shipment_id || null]
    );
    return res.status(201).json({ data: { ...r.rows[0], items: [] } });
  } catch (e) { return err(res, e, "Failed to create package"); }
});

// PUT /api/packing-lists/:id/packages/:pkgId
router.put("/packing-lists/:id/packages/:pkgId", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.ADD_EDIT] }), 
  async (req, res) => {
  try {
    const { length, width, height, net_weight, gross_weight, shipment_id } = req.body;
    const r = await pool.query(
      `UPDATE packing_packages SET
         length = COALESCE($1, length), width = COALESCE($2, width), height = COALESCE($3, height),
         net_weight = COALESCE($4, net_weight), gross_weight = COALESCE($5, gross_weight),
         shipment_id = COALESCE($6, shipment_id)
       WHERE id = $7 AND packing_list_id = $8 AND is_deleted = false RETURNING *`,
      [length ?? null, width ?? null, height ?? null, net_weight ?? null, gross_weight ?? null,
       shipment_id ?? null, req.params.pkgId, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Package not found" });

    // Return with items
    const items = await pool.query(`SELECT * FROM packing_package_items WHERE package_id = $1 AND is_deleted = false ORDER BY id`, [req.params.pkgId]);
    return res.json({ data: { ...r.rows[0], items: items.rows } });
  } catch (e) { return err(res, e, "Failed to update package"); }
});

// DELETE /api/packing-lists/:id/packages/:pkgId
router.delete("/packing-lists/:id/packages/:pkgId", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.DELETE] }), 
  async (req, res) => {
  try {
    const deletedByUser = (req.user as any)?.email ?? "system";
    const { rowCount } = await pool.query(
      `UPDATE packing_packages SET is_deleted = true, deleted_by = $3, deleted_at = now() WHERE id = $1 AND packing_list_id = $2 AND is_deleted = false`,
      [req.params.pkgId, req.params.id, deletedByUser]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Package not found" });
    await pool.query(`UPDATE packing_package_items SET is_deleted = true, deleted_by = $2, deleted_at = now() WHERE package_id = $1`, [req.params.pkgId, deletedByUser]);
    return res.json({ success: true });
  } catch (e) { return err(res, e, "Failed to delete package"); }
});

// ═══════════════════════════════════════════════════════════════
// INVENTORY SEARCH (for custom packing items)
// ═══════════════════════════════════════════════════════════════

// GET /api/packing-lists/inventory/search?type=material|fabric&q=...
router.get("/packing-lists/inventory/search", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.VIEW] }), 
  async (req, res) => {
  try {
    const { type, q = "" } = req.query as { type?: string; q?: string };
    const search = `%${q}%`;
    if (type === "material") {
      const r = await pool.query(
        `SELECT id, material_code AS code, COALESCE(material_name, quality) AS name,
                current_stock, location_stocks, unit_type AS unit, color_name, quality
         FROM materials
         WHERE is_deleted = false AND is_active = true
           AND (material_code ILIKE $1 OR material_name ILIKE $1 OR quality ILIKE $1 OR color_name ILIKE $1)
         ORDER BY material_code LIMIT 50`,
        [search]
      );
      return res.json({ data: r.rows });
    } else if (type === "fabric") {
      const r = await pool.query(
        `SELECT id, fabric_code AS code, 
            COALESCE(fabric_type || ' - ' || quality || ' - ' || color_name, fabric_type, quality, fabric_code) AS name,
                current_stock, location_stocks, unit_type AS unit
         FROM fabrics
         WHERE is_deleted = false AND is_active = true
           AND (fabric_code ILIKE $1 OR fabric_type ILIKE $1 OR quality ILIKE $1 OR color_name ILIKE $1)
         ORDER BY fabric_code LIMIT 50`,
        [search]
      );
      return res.json({ data: r.rows });
    }
    return res.status(400).json({ error: "type must be 'material' or 'fabric'" });
  } catch (e) { return err(res, e, "Failed to search inventory"); }
});

// ═══════════════════════════════════════════════════════════════
// PACKAGE ITEMS — ADD / REMOVE
// ═══════════════════════════════════════════════════════════════

// POST /api/packing-lists/:id/packages/:pkgId/items
router.post("/packing-lists/:id/packages/:pkgId/items", requireAuth, async (req, res) => {
  try {
    const pkg = await pool.query(
      `SELECT pp.*, pl.client_id, pl.delivery_address_id FROM packing_packages pp
       JOIN packing_lists pl ON pl.id = pp.packing_list_id AND pl.is_deleted = false
       WHERE pp.id = $1 AND pp.packing_list_id = $2 AND pp.is_deleted = false`,
      [req.params.pkgId, req.params.id]
    );
    if (!pkg.rows.length) return res.status(404).json({ error: "Package not found" });

    const {
      item_source = "order",
      order_type, order_id, order_code,
      description, quantity, unit, item_weight,
      inventory_id, inventory_type, deducted_from_location,
    } = req.body;

    // ── ORDER item (existing behaviour) ──────────────────────────
    if (item_source === "order") {
      const { client_id, delivery_address_id } = pkg.rows[0];

      const dup = await pool.query(
        `SELECT ppi.id FROM packing_package_items ppi
         JOIN packing_packages pp ON pp.id = ppi.package_id AND pp.is_deleted = false
         WHERE pp.packing_list_id = $1 AND ppi.is_deleted = false AND ppi.order_type = $2 AND ppi.order_id = $3`,
        [req.params.id, order_type, order_id]
      );
      if (dup.rows.length)
        return res.status(400).json({ error: "This order is already packed in another package of this packing list" });

      const tbl = order_type === "Swatch" ? "swatch_orders" : "style_orders";
      const orderRow = await pool.query(`SELECT order_status FROM ${tbl} WHERE id = $1 AND is_deleted = false`, [order_id]);
      if (orderRow.rows[0]?.order_status === "Shipped")
        return res.status(400).json({ error: "Cannot add a shipped order to a packing list" });

      if (delivery_address_id) {
        const chk = await pool.query(
          `SELECT id FROM ${tbl} WHERE id = $1 AND client_id::text = $2::text AND delivery_address_id = $3 AND is_deleted = false`,
          [order_id, client_id, delivery_address_id]
        );
        if (!chk.rows.length)
          return res.status(400).json({ error: "Order delivery address does not match this packing list. Selection blocked." });
      }

      const r = await pool.query(
        `INSERT INTO packing_package_items
           (package_id, item_source, order_type, order_id, order_code, description, quantity, unit, item_weight)
         VALUES ($1,'order',$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [req.params.pkgId, order_type, order_id, order_code || null,
         description || null, quantity || null, unit || null, item_weight || null]
      );
      return res.status(201).json({ data: r.rows[0] });
    }

    // ── CUSTOM (non-inventory) ────────────────────────────────────
    if (item_source === "custom") {
      const r = await pool.query(
        `INSERT INTO packing_package_items
           (package_id, item_source, description, quantity, unit, item_weight)
         VALUES ($1,'custom',$2,$3,$4,$5) RETURNING *`,
        [req.params.pkgId, description || null, quantity || null, unit || null, item_weight || null]
      );
      return res.status(201).json({ data: r.rows[0] });
    }

    // ── MATERIAL or FABRIC (inventory) ───────────────────────────
    if (item_source === "material" || item_source === "fabric") {
      if (!inventory_id) return res.status(400).json({ error: "inventory_id is required" });
      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: "quantity must be a positive number" });

      const invTable = item_source === "material" ? "materials" : "fabrics";
      const inv = await pool.query(
        `SELECT id, current_stock, location_stocks FROM ${invTable} WHERE id = $1 AND is_deleted = false`,
        [inventory_id]
      );
      if (!inv.rows.length) return res.status(404).json({ error: "Inventory item not found" });

      const invRow = inv.rows[0];
      const locationStocks: { location: string; stock: string }[] = invRow.location_stocks ?? [];

      let stockDeducted = 0;
      let resolvedLocation: string | null = deducted_from_location || null;

      if (resolvedLocation && locationStocks.length > 0) {
        // Deduct from a specific warehouse location
        const locIdx = locationStocks.findIndex(ls => ls.location === resolvedLocation);
        if (locIdx === -1) return res.status(400).json({ error: `Location "${resolvedLocation}" not found on this item` });
        const locStock = parseFloat(locationStocks[locIdx].stock);
        if (qty > locStock)
          return res.status(400).json({ error: `Only ${locStock} available at ${resolvedLocation}` });

        locationStocks[locIdx] = { location: resolvedLocation, stock: String(locStock - qty) };
        const newTotal = parseFloat(invRow.current_stock) - qty;
        await pool.query(
          `UPDATE ${invTable} SET current_stock = $1, location_stocks = $2 WHERE id = $3`,
          [String(newTotal), JSON.stringify(locationStocks), inventory_id]
        );
        stockDeducted = qty;
      } else {
        // No location breakdown — deduct from total current_stock
        const totalStock = parseFloat(invRow.current_stock);
        if (qty > totalStock)
          return res.status(400).json({ error: `Only ${totalStock} available in stock` });
        await pool.query(
          `UPDATE ${invTable} SET current_stock = $1 WHERE id = $2`,
          [String(totalStock - qty), inventory_id]
        );
        resolvedLocation = null;
        stockDeducted = qty;
      }

      const r = await pool.query(
        `INSERT INTO packing_package_items
           (package_id, item_source, inventory_id, inventory_type,
            description, quantity, unit, item_weight, stock_deducted, deducted_from_location)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [req.params.pkgId, item_source, inventory_id, item_source,
         description || null, String(qty), unit || null, item_weight || null,
         stockDeducted, resolvedLocation]
      );
      return res.status(201).json({ data: r.rows[0] });
    }

    return res.status(400).json({ error: "Invalid item_source" });
  } catch (e) { return err(res, e, "Failed to add item to package"); }
});

// PATCH /api/packing-lists/:id/packages/:pkgId/items/:itemId
router.patch("/packing-lists/:id/packages/:pkgId/items/:itemId", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.ADD_EDIT] }), 
  async (req, res) => {
  try {
    const { quantity, unit, item_weight, description } = req.body;
    const r = await pool.query(
      `UPDATE packing_package_items SET
         quantity    = COALESCE($1, quantity),
         unit        = COALESCE($2, unit),
         item_weight = COALESCE($3, item_weight),
         description = COALESCE($4, description)
       WHERE id = $5 AND package_id = $6 AND is_deleted = false RETURNING *`,
      [quantity ?? null, unit ?? null, item_weight ?? null, description ?? null, req.params.itemId, req.params.pkgId]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Item not found" });
    return res.json({ data: r.rows[0] });
  } catch (e) { return err(res, e, "Failed to update package item"); }
});

// DELETE /api/packing-lists/:id/packages/:pkgId/items/:itemId
router.delete("/packing-lists/:id/packages/:pkgId/items/:itemId", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.DELETE] }), 
  async (req, res) => {
  try {
    const deletedByUser = (req.user as any)?.email ?? "system";
    const itemRes = await pool.query(
      `SELECT * FROM packing_package_items WHERE id = $1 AND package_id = $2 AND is_deleted = false`,
      [req.params.itemId, req.params.pkgId]
    );
    if (!itemRes.rows.length) return res.status(404).json({ error: "Item not found" });
    const item = itemRes.rows[0];

    // Restore stock if this was an inventory item with deducted stock
    if ((item.item_source === "material" || item.item_source === "fabric") && parseFloat(item.stock_deducted ?? "0") > 0) {
      const invTable = item.item_source === "material" ? "materials" : "fabrics";
      const deducted = parseFloat(item.stock_deducted);
      const inv = await pool.query(`SELECT current_stock, location_stocks FROM ${invTable} WHERE id = $1`, [item.inventory_id]);
      if (inv.rows.length) {
        const invRow = inv.rows[0];
        const newTotal = parseFloat(invRow.current_stock) + deducted;
        if (item.deducted_from_location) {
          const locationStocks: { location: string; stock: string }[] = invRow.location_stocks ?? [];
          const locIdx = locationStocks.findIndex((ls: { location: string }) => ls.location === item.deducted_from_location);
          if (locIdx >= 0) {
            locationStocks[locIdx] = { location: item.deducted_from_location, stock: String(parseFloat(locationStocks[locIdx].stock) + deducted) };
          } else {
            locationStocks.push({ location: item.deducted_from_location, stock: String(deducted) });
          }
          await pool.query(
            `UPDATE ${invTable} SET current_stock = $1, location_stocks = $2 WHERE id = $3`,
            [String(newTotal), JSON.stringify(locationStocks), item.inventory_id]
          );
        } else {
          await pool.query(`UPDATE ${invTable} SET current_stock = $1 WHERE id = $2`, [String(newTotal), item.inventory_id]);
        }
      }
    }

    await pool.query(`UPDATE packing_package_items SET is_deleted = true, deleted_by = $3, deleted_at = now() WHERE id = $1 AND package_id = $2`, [req.params.itemId, req.params.pkgId, deletedByUser]);
    return res.json({ success: true });
  } catch (e) { return err(res, e, "Failed to remove item from package"); }
});

// ═══════════════════════════════════════════════════════════════
// ITEM IMAGE UPLOAD (on package items)
// ═══════════════════════════════════════════════════════════════

router.get("/packing-lists/item-images/:filename", async (req, res) => {
  try {
    const filename = path.basename(String(req.params.filename));
    const filePath = path.join(process.cwd(), "uploads", "packing-list-items", filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Image not found" });
    return res.sendFile(filePath);
  } catch (e) { return err(res, e, "Failed to serve image"); }
});

router.get("/packing-lists/order-artwork-image", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.VIEW] }), 
  async (req, res) => {
  try {
    const { type, item_id } = req.query as { type: string; item_id: string };
    if (!type || !item_id) return res.status(400).json({ error: "type and item_id required" });
    let rows: any[] = [];
    if (type === "Swatch") {
      const r = await pool.query(
        `SELECT final_images FROM artworks
         WHERE swatch_order_id = $1 AND is_deleted = false
           AND final_images IS NOT NULL AND jsonb_array_length(final_images) > 0
         ORDER BY id DESC LIMIT 1`,
        [item_id]
      );
      rows = r.rows;
    } else if (type === "Style") {
      const r = await pool.query(
        `SELECT final_images FROM style_order_artworks
         WHERE style_order_id = $1 AND is_deleted = false
           AND final_images IS NOT NULL AND jsonb_array_length(final_images) > 0
         ORDER BY id DESC LIMIT 1`,
        [item_id]
      );
      rows = r.rows;
    }
    if (!rows.length) return res.json({ data: null });
    const images = rows[0].final_images;
    const first = Array.isArray(images) && images.length > 0 ? images[0] : null;
    return res.json({ data: first ?? null });
  } catch (e) { return err(res, e, "Failed to fetch order artwork image"); }
});

router.post(
  "/packing-lists/:id/packages/:pkgId/items/:itemId/image",
  requireAuth,
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.ADD_EDIT] }),
  uploadMiddleware.single("image"),
  async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const old = await pool.query(`SELECT item_image_url FROM packing_package_items WHERE id = $1 AND package_id = $2 AND is_deleted = false`, [req.params.itemId, req.params.pkgId]);
      if (old.rows[0]?.item_image_url) {
        await deleteUpload(old.rows[0].item_image_url);
      }

      const imageUrl = await uploadFile(req.file, {
        entity: "packing-lists",
        id: req.params.id,
        category: "images",
      });

      const r = await pool.query(
        `UPDATE packing_package_items SET item_image_url = $1 WHERE id = $2 AND package_id = $3 AND is_deleted = false RETURNING *`,
        [imageUrl, req.params.itemId, req.params.pkgId]
      );
      if (!r.rows.length) return res.status(404).json({ error: "Item not found" });
      return res.json({ data: r.rows[0] });
    } catch (e) { return err(res, e, "Failed to upload image"); }
  }
);

router.delete("/packing-lists/:id/packages/:pkgId/items/:itemId/image", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.DELETE] }), 
  async (req, res) => {
  try {
    const old = await pool.query(`SELECT item_image_url FROM packing_package_items WHERE id = $1 AND package_id = $2 AND is_deleted = false`, [req.params.itemId, req.params.pkgId]);
    if (old.rows[0]?.item_image_url) {
      await deleteUpload(old.rows[0].item_image_url);
    }
    const r = await pool.query(
      `UPDATE packing_package_items SET item_image_url = NULL WHERE id = $1 AND package_id = $2 AND is_deleted = false RETURNING *`,
      [req.params.itemId, req.params.pkgId]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Item not found" });
    return res.json({ data: r.rows[0] });
  } catch (e) { return err(res, e, "Failed to remove image"); }
});

// ═══════════════════════════════════════════════════════════════
// ELIGIBLE ORDERS FOR EXISTING PACKING LIST
// ═══════════════════════════════════════════════════════════════

router.get("/packing-lists/:id/eligible-orders", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.VIEW] }), 
  async (req, res) => {
  try {
    const pl = await pool.query(`SELECT * FROM packing_lists WHERE id = $1 AND is_deleted = false`, [req.params.id]);
    if (!pl.rows.length) return res.status(404).json({ error: "Not found" });
    const { client_id, delivery_address_id } = pl.rows[0];

    // Already packed in this packing list
    const packed = await pool.query(
      `SELECT ppi.order_type, ppi.order_id FROM packing_package_items ppi
       JOIN packing_packages pp ON pp.id = ppi.package_id AND pp.is_deleted = false
       WHERE pp.packing_list_id = $1 AND ppi.is_deleted = false`,
      [req.params.id]
    );
    const packedSwatch = new Set(packed.rows.filter(r => r.order_type === "Swatch").map(r => r.order_id));
    const packedStyle  = new Set(packed.rows.filter(r => r.order_type === "Style").map(r => r.order_id));

    const daCondition = delivery_address_id
      ? `AND o.delivery_address_id = ${parseInt(delivery_address_id)}`
      : "";

    const [swatches, styles] = await Promise.all([
      pool.query(
        `SELECT id, order_code, swatch_name AS name, client_name, delivery_address_id, order_status, quantity
         FROM swatch_orders o
         WHERE client_id::text = $1::text ${daCondition} AND is_deleted = FALSE
           AND order_status NOT IN ('Shipped','Cancelled')
         ORDER BY order_code DESC LIMIT 200`,
        [client_id]
      ),
      pool.query(
        `SELECT id, order_code, style_name AS name, client_name, delivery_address_id, order_status, quantity
         FROM style_orders o
         WHERE client_id::text = $1::text ${daCondition} AND is_deleted = FALSE
           AND order_status NOT IN ('Shipped','Cancelled')
         ORDER BY order_code DESC LIMIT 200`,
        [client_id]
      ),
    ]);

    return res.json({
      swatches: swatches.rows.map(r => ({ ...r, already_added: packedSwatch.has(r.id) })),
      styles:   styles.rows.map(r => ({ ...r, already_added: packedStyle.has(r.id) })),
    });
  } catch (e) { return err(res, e, "Failed to fetch eligible orders"); }
});

// ═══════════════════════════════════════════════════════════════
// PDF HTML — Per-package layout
// ═══════════════════════════════════════════════════════════════

router.get("/packing-lists/:id/pdf-html", requireAuth, 
  checkPermission({ any: [LOGISTICS_PACKING_LISTS.VIEW] }), 
  async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT pl.*,
              c.brand_name AS client_name, c.address1 AS client_address, c.country AS client_country,
              da.label AS delivery_address_label, da.address_line1, da.address_line2,
              da.city, da.state, da.country AS addr_country, da.pincode AS addr_pincode,
              osd.tracking_number AS shipment_tracking, osd.shipment_date
       FROM packing_lists pl
       JOIN clients c ON c.id = pl.client_id AND c.is_deleted = false
       LEFT JOIN delivery_addresses da ON da.id = pl.delivery_address_id AND da.is_deleted = false
       LEFT JOIN order_shipping_details osd ON osd.id = pl.shipment_id AND osd.is_deleted = false
       WHERE pl.id = $1 AND pl.is_deleted = false`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Packing list not found" });
    const pl = r.rows[0];

    const pkgs = await pool.query(
      `SELECT * FROM packing_packages WHERE packing_list_id = $1 AND is_deleted = false ORDER BY package_number`,
      [req.params.id]
    );

    let totalNetWeight = 0;
    let totalGrossWeight = 0;
    let totalItems = 0;

    const packagesHtml: string[] = [];
    for (const pkg of pkgs.rows) {
      totalNetWeight += parseFloat(pkg.net_weight ?? 0);
      totalGrossWeight += parseFloat(pkg.gross_weight ?? 0);

      const items = await pool.query(
        `SELECT * FROM packing_package_items WHERE package_id = $1 AND is_deleted = false ORDER BY id`,
        [pkg.id]
      );
      totalItems += items.rows.length;

      const dimStr = [pkg.length, pkg.width, pkg.height].filter(Boolean).join(" × ");

      const rowsHtml = items.rows.map((item, i) => {
        let imgTag = "";
        if (item.item_image_url) {
          try {
            const filePath = resolveUploadAbsPath(item.item_image_url);
            const buf = fs.readFileSync(filePath);
            const ext = path.extname(item.item_image_url).slice(1).toLowerCase() || "jpeg";
            const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
            imgTag = `<img src="data:${mime};base64,${buf.toString("base64")}" style="max-width:64px;max-height:64px;border-radius:4px;object-fit:cover;" />`;
          } catch {}
        }
        return `
        <tr>
          <td>${i + 1}</td>
          <td style="text-align:center;">${imgTag || '<span style="color:#ccc;font-size:10px;">—</span>'}</td>
          <td>${item.order_type}</td>
          <td>${item.order_code ?? ""}</td>
          <td>${item.description ?? ""}</td>
          <td>${item.quantity ?? ""}</td>
          <td>${item.unit ?? ""}</td>
          <td>${item.item_weight != null ? Number(item.item_weight).toFixed(3) + " kg" : "—"}</td>
        </tr>`;
      }).join("");

      packagesHtml.push(`
      <div class="pkg-section">
        <div class="pkg-header">PACKAGE ${pkg.package_number}</div>
        <div class="pkg-dims">
          ${dimStr ? `<span><strong>Dimensions:</strong> ${dimStr} cm</span>` : ""}
          <span><strong>Net Weight:</strong> ${pkg.net_weight ? Number(pkg.net_weight).toFixed(3) + " kg" : "—"}</span>
          <span><strong>Gross Weight:</strong> ${pkg.gross_weight ? Number(pkg.gross_weight).toFixed(3) + " kg" : "—"}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Image</th><th>Type</th><th>Order Code</th>
              <th>Description</th><th>Qty</th><th>Unit</th><th>Weight</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="8" style="text-align:center;color:#aaa;padding:14px;">No items in this package</td></tr>'}
          </tbody>
        </table>
      </div>`);
    }

    const addrParts = [pl.address_line1, pl.address_line2, pl.city, pl.state, pl.addr_country, pl.addr_pincode]
      .filter(Boolean).join(", ");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 32px; }
  h1 { font-size: 22px; color: #C6AF4B; letter-spacing: 2px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #C6AF4B; padding-bottom: 16px; }
  .pl-meta { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
  .meta-box { background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 6px; padding: 10px; }
  .meta-box .label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 1px; }
  .meta-box .value { font-size: 13px; font-weight: 600; margin-top: 2px; }
  .pkg-section { margin-bottom: 28px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
  .pkg-header { background: #3B3F5C; color: #fff; padding: 8px 14px; font-size: 13px; font-weight: 700; letter-spacing: 1px; }
  .pkg-dims { padding: 8px 14px; background: #f5f5f5; border-bottom: 1px solid #e0e0e0; display: flex; gap: 24px; font-size: 11px; color: #444; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #555; color: #fff; padding: 7px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
  tr:nth-child(even) td { background: #fafafa; }
  .totals { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 28px; }
  .total-box { background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 6px; padding: 10px; }
  .total-box .label { font-size: 10px; text-transform: uppercase; color: #888; }
  .total-box .value { font-size: 16px; font-weight: 700; color: #3B3F5C; margin-top: 2px; }
  .sig { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; }
  .sig-box { padding-top: 48px; border-top: 1px solid #999; font-size: 11px; color: #555; }
  .footer { margin-top: 16px; font-size: 10px; color: #aaa; display: flex; justify-content: space-between; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>ZARI EMBROIDERIES</h1>
    <div style="font-size:10px;letter-spacing:2px;color:#888;margin-top:2px;">PACKING LIST</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:20px;font-weight:700;color:#3B3F5C;">${pl.pl_number}</div>
    <div style="font-size:11px;color:#888;">${pl.created_at ? new Date(pl.created_at).toLocaleDateString("en-IN") : ""}</div>
  </div>
</div>

<div class="pl-meta">
  <div class="meta-box">
    <div class="label">Client</div>
    <div class="value">${pl.client_name}</div>
  </div>
  <div class="meta-box">
    <div class="label">Delivery Address</div>
    <div class="value">${pl.delivery_address_label ?? "—"}</div>
    <div style="font-size:10px;color:#555;margin-top:2px;">${addrParts || "—"}</div>
  </div>
  <div class="meta-box">
    <div class="label">Shipment</div>
    <div class="value">${pl.shipment_tracking ?? "—"}</div>
    <div style="font-size:10px;color:#555;margin-top:2px;">${pl.shipment_date ? new Date(pl.shipment_date).toLocaleDateString("en-IN") : ""}</div>
  </div>
  <div class="meta-box">
    <div class="label">Destination</div>
    <div class="value">${pl.destination_country ?? "—"}</div>
  </div>
</div>

<div class="totals">
  <div class="total-box"><div class="label">Total Packages</div><div class="value">${pkgs.rows.length}</div></div>
  <div class="total-box"><div class="label">Total Items</div><div class="value">${totalItems}</div></div>
  <div class="total-box"><div class="label">Total Net Weight</div><div class="value">${totalNetWeight.toFixed(3)} kg</div></div>
  <div class="total-box"><div class="label">Total Gross Weight</div><div class="value">${totalGrossWeight.toFixed(3)} kg</div></div>
</div>

${pl.remarks ? `<p style="margin-bottom:20px;font-size:12px;"><strong>Remarks:</strong> ${pl.remarks}</p>` : ""}

${packagesHtml.join("\n") || '<p style="color:#aaa;text-align:center;padding:20px;">No packages added</p>'}

<div class="sig">
  <div class="sig-box">Packed By</div>
  <div class="sig-box">Authorized Signatory</div>
</div>

<div class="footer">
  <span>ZARI EMBROIDERIES — Packing List ${pl.pl_number}</span>
  <span>Generated ${new Date().toLocaleString("en-IN")}</span>
</div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    return res.send(html);
  } catch (e) { return err(res, e, "Failed to generate PDF"); }
});

export default router;
