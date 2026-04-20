import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import multer from "multer";
import path from "path";
import fs from "fs";

const plItemStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), "uploads", "packing-list-items");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `item-${Date.now()}${ext}`);
  },
});
const plItemUpload = multer({ storage: plItemStorage, limits: { fileSize: 10 * 1024 * 1024 } });

type AuthRequest = Request & { user?: { userId: number; email: string; name?: string; role: string } };

const router = Router();

// ─── helpers ────────────────────────────────────────────────────────────────
function err(res: Response, e: unknown, msg = "Server error") {
  console.error(`[packing-lists] ${msg}:`, e);
  res.status(500).json({ error: msg });
}

async function nextPLNumber(): Promise<string> {
  const r = await pool.query(`SELECT COUNT(*) AS cnt FROM packing_lists`);
  const n = parseInt(r.rows[0].cnt, 10) + 1;
  const year = new Date().getFullYear();
  return `PL-${year}-${String(n).padStart(4, "0")}`;
}

// ═══════════════════════════════════════════════════════════════
// DELIVERY ADDRESSES
// ═══════════════════════════════════════════════════════════════

// GET /api/delivery-addresses?client_id=X
router.get("/delivery-addresses", requireAuth, async (req, res) => {
  try {
    const { client_id } = req.query;
    const where = client_id ? "WHERE da.client_id = $1" : "";
    const params = client_id ? [client_id] : [];
    const r = await pool.query(
      `SELECT da.*, c.brand_name AS client_name
       FROM delivery_addresses da
       JOIN clients c ON c.id = da.client_id
       ${where}
       ORDER BY da.is_default DESC, da.label`,
      params
    );
    res.json({ data: r.rows });
  } catch (e) { err(res, e, "Failed to fetch delivery addresses"); }
});

// POST /api/delivery-addresses
router.post("/delivery-addresses", requireAuth, async (req, res) => {
  try {
    const { client_id, label, address_line1, address_line2, city, state, country, pincode, is_default } = req.body;
    if (!client_id) return res.status(400).json({ error: "client_id is required" });

    if (is_default) {
      await pool.query(`UPDATE delivery_addresses SET is_default = FALSE WHERE client_id = $1`, [client_id]);
    }

    const r = await pool.query(
      `INSERT INTO delivery_addresses (client_id, label, address_line1, address_line2, city, state, country, pincode, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [client_id, label || "Default", address_line1 || null, address_line2 || null,
       city || null, state || null, country || null, pincode || null, !!is_default]
    );
    res.status(201).json({ data: r.rows[0] });
  } catch (e) { err(res, e, "Failed to create delivery address"); }
});

// PUT /api/delivery-addresses/:id
router.put("/delivery-addresses/:id", requireAuth, async (req, res) => {
  try {
    const { label, address_line1, address_line2, city, state, country, pincode, is_default } = req.body;
    const existing = await pool.query(`SELECT * FROM delivery_addresses WHERE id = $1`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: "Not found" });

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
    res.json({ data: r.rows[0] });
  } catch (e) { err(res, e, "Failed to update delivery address"); }
});

// DELETE /api/delivery-addresses/:id
router.delete("/delivery-addresses/:id", requireAuth, async (req, res) => {
  try {
    const inUse = await pool.query(`SELECT id FROM packing_lists WHERE delivery_address_id = $1 LIMIT 1`, [req.params.id]);
    if (inUse.rows.length) return res.status(400).json({ error: "Address is used by a packing list and cannot be deleted" });
    await pool.query(`DELETE FROM delivery_addresses WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (e) { err(res, e, "Failed to delete delivery address"); }
});

// ═══════════════════════════════════════════════════════════════
// PACKING LISTS
// ═══════════════════════════════════════════════════════════════

// GET /api/packing-lists  (list)
router.get("/packing-lists", requireAuth, async (req, res) => {
  try {
    const { client_id, shipment_id, status, page = "1", limit = "25" } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (client_id) { conditions.push(`pl.client_id = $${p++}`); params.push(client_id); }
    if (shipment_id) { conditions.push(`pl.shipment_id = $${p++}`); params.push(shipment_id); }
    if (status) { conditions.push(`pl.status = $${p++}`); params.push(status); }

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
                (SELECT COUNT(*) FROM packing_list_items pli WHERE pli.packing_list_id = pl.id) AS item_count
         FROM packing_lists pl
         JOIN clients c ON c.id = pl.client_id
         LEFT JOIN delivery_addresses da ON da.id = pl.delivery_address_id
         LEFT JOIN order_shipping_details osd ON osd.id = pl.shipment_id
         ${where}
         ORDER BY pl.created_at DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        [...params, parseInt(limit as string), offset]
      ),
      pool.query(`SELECT COUNT(*) FROM packing_lists pl ${where}`, params),
    ]);

    res.json({ data: data.rows, total: parseInt(total.rows[0].count), page: parseInt(page as string) });
  } catch (e) { err(res, e, "Failed to fetch packing lists"); }
});

// GET /api/packing-lists/:id  (detail)
router.get("/packing-lists/:id", requireAuth, async (req, res) => {
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
       JOIN clients c ON c.id = pl.client_id
       LEFT JOIN delivery_addresses da ON da.id = pl.delivery_address_id
       LEFT JOIN order_shipping_details osd ON osd.id = pl.shipment_id
       LEFT JOIN shipping_vendors sv ON sv.id = osd.shipping_vendor_id
       WHERE pl.id = $1`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Packing list not found" });

    const items = await pool.query(
      `SELECT * FROM packing_list_items WHERE packing_list_id = $1 ORDER BY id`,
      [req.params.id]
    );

    res.json({ data: { ...r.rows[0], items: items.rows } });
  } catch (e) { err(res, e, "Failed to fetch packing list"); }
});

// POST /api/packing-lists
router.post("/packing-lists", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      client_id, delivery_address_id, shipment_id,
      destination_country, package_count, package_type,
      dimensions, net_weight, gross_weight, remarks, items = [],
    } = req.body;

    if (!client_id) return res.status(400).json({ error: "client_id is required" });
    if (!delivery_address_id) return res.status(400).json({ error: "delivery_address_id is required" });

    // Validate delivery address belongs to client
    const addrCheck = await pool.query(
      `SELECT id FROM delivery_addresses WHERE id = $1 AND client_id = $2`,
      [delivery_address_id, client_id]
    );
    if (!addrCheck.rows.length) return res.status(400).json({ error: "Delivery address does not belong to selected client" });

    const pl_number = await nextPLNumber();
    const created_by = req.user?.name || req.user?.email || "system";

    const pl = await pool.query(
      `INSERT INTO packing_lists
         (pl_number, client_id, delivery_address_id, shipment_id, destination_country, package_count,
          package_type, dimensions, net_weight, gross_weight, remarks, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [pl_number, client_id, delivery_address_id, shipment_id || null,
       destination_country || null, package_count || null, package_type || null,
       dimensions || null, net_weight || null, gross_weight || null, remarks || null, created_by]
    );

    const plId = pl.rows[0].id;

    // Validate and insert items
    for (const item of items) {
      const { item_type, item_id, order_code, description, qty, unit } = item;

      // Validate item belongs to same client + delivery address
      if (item_type === "Swatch") {
        const check = await pool.query(
          `SELECT id FROM swatch_orders WHERE id = $1 AND client_id::text = $2::text AND delivery_address_id = $3`,
          [item_id, client_id, delivery_address_id]
        );
        if (!check.rows.length) continue; // skip mismatched items
      } else if (item_type === "Style") {
        const check = await pool.query(
          `SELECT id FROM style_orders WHERE id = $1 AND client_id::text = $2::text AND delivery_address_id = $3`,
          [item_id, client_id, delivery_address_id]
        );
        if (!check.rows.length) continue;
      }

      await pool.query(
        `INSERT INTO packing_list_items (packing_list_id, item_type, item_id, order_code, description, qty, unit)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [plId, item_type, item_id, order_code || null, description || null, qty || null, unit || null]
      );
    }

    res.status(201).json({
      data: pl.rows[0],
      message: "Packing list created for selected delivery address successfully",
    });
  } catch (e) { err(res, e, "Failed to create packing list"); }
});

// PUT /api/packing-lists/:id
router.put("/packing-lists/:id", requireAuth, async (req, res) => {
  try {
    const existing = await pool.query(`SELECT * FROM packing_lists WHERE id = $1`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: "Not found" });
    const ex = existing.rows[0];

    const {
      delivery_address_id, shipment_id, destination_country, package_count,
      package_type, dimensions, net_weight, gross_weight, status, remarks,
    } = req.body;

    // Validate delivery address if changing
    if (delivery_address_id && delivery_address_id !== ex.delivery_address_id) {
      const addrCheck = await pool.query(
        `SELECT id FROM delivery_addresses WHERE id = $1 AND client_id = $2`,
        [delivery_address_id, ex.client_id]
      );
      if (!addrCheck.rows.length) return res.status(400).json({ error: "Delivery address does not belong to this client" });
    }

    const r = await pool.query(
      `UPDATE packing_lists SET
         delivery_address_id = $1, shipment_id = $2, destination_country = $3,
         package_count = $4, package_type = $5, dimensions = $6,
         net_weight = $7, gross_weight = $8, status = $9, remarks = $10, updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [
        delivery_address_id ?? ex.delivery_address_id,
        shipment_id !== undefined ? (shipment_id || null) : ex.shipment_id,
        destination_country ?? ex.destination_country,
        package_count ?? ex.package_count,
        package_type ?? ex.package_type,
        dimensions ?? ex.dimensions,
        net_weight ?? ex.net_weight,
        gross_weight ?? ex.gross_weight,
        status ?? ex.status,
        remarks ?? ex.remarks,
        req.params.id,
      ]
    );
    res.json({ data: r.rows[0] });
  } catch (e) { err(res, e, "Failed to update packing list"); }
});

// DELETE /api/packing-lists/:id
router.delete("/packing-lists/:id", requireAuth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM packing_list_items WHERE packing_list_id = $1`, [req.params.id]);
    await pool.query(`DELETE FROM packing_lists WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (e) { err(res, e, "Failed to delete packing list"); }
});

// ─── ITEMS ──────────────────────────────────────────────────────────────────

// POST /api/packing-lists/:id/items  (add item)
router.post("/packing-lists/:id/items", requireAuth, async (req, res) => {
  try {
    const pl = await pool.query(`SELECT * FROM packing_lists WHERE id = $1`, [req.params.id]);
    if (!pl.rows.length) return res.status(404).json({ error: "Packing list not found" });

    const { item_type, item_id, order_code, description, qty, unit, weight_kg } = req.body;
    const { client_id, delivery_address_id } = pl.rows[0];

    // Duplicate check
    const dup = await pool.query(
      `SELECT id FROM packing_list_items WHERE packing_list_id = $1 AND item_type = $2 AND item_id = $3`,
      [req.params.id, item_type, item_id]
    );
    if (dup.rows.length) return res.status(400).json({ error: "This order is already in the packing list" });

    // Validate item matches client + delivery address
    if (delivery_address_id) {
      const table = item_type === "Swatch" ? "swatch_orders" : "style_orders";
      const check = await pool.query(
        `SELECT id FROM ${table} WHERE id = $1 AND client_id::text = $2::text AND delivery_address_id = $3`,
        [item_id, client_id, delivery_address_id]
      );
      if (!check.rows.length) {
        return res.status(400).json({
          error: "Order client or delivery address does not match this packing list. Selection blocked.",
        });
      }
    } else {
      // At minimum validate client matches
      const table = item_type === "Swatch" ? "swatch_orders" : "style_orders";
      const check = await pool.query(
        `SELECT id FROM ${table} WHERE id = $1 AND client_id::text = $2::text`,
        [item_id, client_id]
      );
      if (!check.rows.length) {
        return res.status(400).json({ error: "Order client does not match this packing list" });
      }
    }

    const r = await pool.query(
      `INSERT INTO packing_list_items (packing_list_id, item_type, item_id, order_code, description, qty, unit, weight_kg)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, item_type, item_id, order_code || null, description || null, qty || null, unit || null, weight_kg || null]
    );
    res.status(201).json({ data: r.rows[0] });
  } catch (e) { err(res, e, "Failed to add item"); }
});

// PATCH /api/packing-lists/:id/items/:itemId — update weight
router.patch("/packing-lists/:id/items/:itemId", requireAuth, async (req, res) => {
  try {
    const { weight_kg } = req.body;
    const r = await pool.query(
      `UPDATE packing_list_items SET weight_kg = $1 WHERE id = $2 AND packing_list_id = $3 RETURNING *`,
      [weight_kg ?? null, req.params.itemId, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Item not found" });
    res.json({ data: r.rows[0] });
  } catch (e) { err(res, e, "Failed to update item"); }
});

// POST /api/packing-lists/:id/items/:itemId/image — upload item image
router.post("/packing-lists/:id/items/:itemId/image", requireAuth, plItemUpload.single("image"), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const imageUrl = `/uploads/packing-list-items/${req.file.filename}`;

    // Delete old image file if exists
    const old = await pool.query(`SELECT item_image_url FROM packing_list_items WHERE id = $1 AND packing_list_id = $2`, [req.params.itemId, req.params.id]);
    if (old.rows[0]?.item_image_url) {
      const oldPath = path.join(process.cwd(), old.rows[0].item_image_url);
      fs.unlink(oldPath, () => {});
    }

    const r = await pool.query(
      `UPDATE packing_list_items SET item_image_url = $1 WHERE id = $2 AND packing_list_id = $3 RETURNING *`,
      [imageUrl, req.params.itemId, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Item not found" });
    res.json({ data: r.rows[0] });
  } catch (e) { err(res, e, "Failed to upload image"); }
});

// DELETE /api/packing-lists/:id/items/:itemId/image — remove item image
router.delete("/packing-lists/:id/items/:itemId/image", requireAuth, async (req, res) => {
  try {
    const old = await pool.query(`SELECT item_image_url FROM packing_list_items WHERE id = $1 AND packing_list_id = $2`, [req.params.itemId, req.params.id]);
    if (old.rows[0]?.item_image_url) {
      const oldPath = path.join(process.cwd(), old.rows[0].item_image_url);
      fs.unlink(oldPath, () => {});
    }
    const r = await pool.query(
      `UPDATE packing_list_items SET item_image_url = NULL WHERE id = $1 AND packing_list_id = $2 RETURNING *`,
      [req.params.itemId, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Item not found" });
    res.json({ data: r.rows[0] });
  } catch (e) { err(res, e, "Failed to delete image"); }
});

// DELETE /api/packing-lists/:id/items/:itemId
router.delete("/packing-lists/:id/items/:itemId", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM packing_list_items WHERE id = $1 AND packing_list_id = $2`,
      [req.params.itemId, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { err(res, e, "Failed to delete item"); }
});

// ─── AUTO GROUP ─────────────────────────────────────────────────────────────
// GET /api/packing-lists/auto-group?shipment_id=X
// Groups orders tied to a shipment by delivery_address_id, returns grouping suggestion
router.get("/packing-lists/auto-group", requireAuth, async (req, res) => {
  try {
    const { shipment_id } = req.query;
    if (!shipment_id) return res.status(400).json({ error: "shipment_id is required" });

    // Get shipment
    const shipment = await pool.query(
      `SELECT osd.*, sv.vendor_name FROM order_shipping_details osd
       LEFT JOIN shipping_vendors sv ON sv.id = osd.shipping_vendor_id
       WHERE osd.id = $1`,
      [shipment_id]
    );
    if (!shipment.rows.length) return res.status(404).json({ error: "Shipment not found" });

    const { reference_type, reference_id, client_name } = shipment.rows[0];
    const table = reference_type === "Swatch" ? "swatch_orders" : "style_orders";

    // Get all orders for this reference, grouped by delivery_address_id
    const orders = await pool.query(
      `SELECT o.id, o.order_code, o.client_id, o.client_name, o.delivery_address_id,
              da.label AS addr_label, da.address_line1, da.city, da.country AS addr_country,
              c.id AS cid
       FROM ${table} o
       LEFT JOIN delivery_addresses da ON da.id = o.delivery_address_id
       LEFT JOIN clients c ON c.client_code::text = o.client_id::text OR c.id::text = o.client_id::text
       WHERE o.id = $1 AND o.is_deleted = FALSE`,
      [reference_id]
    );

    // Group by delivery_address_id (null = "No Address")
    const groups: Record<string, { delivery_address_id: number | null; label: string; orders: unknown[] }> = {};
    for (const row of orders.rows) {
      const key = row.delivery_address_id ?? "none";
      if (!groups[key]) {
        groups[key] = {
          delivery_address_id: row.delivery_address_id,
          label: row.addr_label ?? "No Delivery Address",
          orders: [],
        };
      }
      groups[key].orders.push(row);
    }

    res.json({
      shipment: shipment.rows[0],
      groups: Object.values(groups),
      suggested_count: Object.keys(groups).length,
    });
  } catch (e) { err(res, e, "Failed to auto-group"); }
});

// ─── PDF HTML ────────────────────────────────────────────────────────────────
// GET /api/packing-lists/:id/pdf-html
router.get("/packing-lists/:id/pdf-html", requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT pl.*,
              c.brand_name AS client_name, c.address1 AS client_address, c.country AS client_country,
              da.label AS delivery_address_label, da.address_line1, da.address_line2,
              da.city, da.state, da.country AS addr_country, da.pincode AS addr_pincode,
              osd.tracking_number AS shipment_tracking, osd.shipment_date
       FROM packing_lists pl
       JOIN clients c ON c.id = pl.client_id
       LEFT JOIN delivery_addresses da ON da.id = pl.delivery_address_id
       LEFT JOIN order_shipping_details osd ON osd.id = pl.shipment_id
       WHERE pl.id = $1`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Packing list not found" });

    const items = await pool.query(
      `SELECT * FROM packing_list_items WHERE packing_list_id = $1 ORDER BY id`,
      [req.params.id]
    );

    const pl = r.rows[0];
    const addrParts = [pl.address_line1, pl.address_line2, pl.city, pl.state, pl.addr_country, pl.addr_pincode]
      .filter(Boolean).join(", ");

    // Build base64-embedded image tags for PDF items
    const rowsHtml = items.rows.map((item, i) => {
      let imgTag = "";
      if (item.item_image_url) {
        try {
          const filePath = path.join(process.cwd(), item.item_image_url);
          const buf = fs.readFileSync(filePath);
          const ext = path.extname(item.item_image_url).slice(1).toLowerCase() || "jpeg";
          const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
          imgTag = `<img src="data:${mime};base64,${buf.toString("base64")}" style="max-width:72px;max-height:72px;border-radius:4px;object-fit:cover;display:block;" />`;
        } catch {}
      }
      return `
      <tr>
        <td>${i + 1}</td>
        <td style="text-align:center;">${imgTag || '<span style="color:#ccc;font-size:10px;">—</span>'}</td>
        <td>${item.item_type}</td>
        <td>${item.order_code ?? ""}</td>
        <td>${item.description ?? ""}</td>
        <td>${item.qty ?? ""}</td>
        <td>${item.unit ?? ""}</td>
        <td>${item.weight_kg != null ? Number(item.weight_kg).toFixed(3) + " kg" : "—"}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 32px; }
  h1 { font-size: 22px; color: #C6AF4B; letter-spacing: 2px; }
  h2 { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #C6AF4B; padding-bottom: 16px; }
  .pl-meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .meta-box { background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 6px; padding: 10px; }
  .meta-box .label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 1px; }
  .meta-box .value { font-size: 13px; font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #3B3F5C; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
  tr:nth-child(even) td { background: #fafafa; }
  .footer { margin-top: 32px; border-top: 1px solid #eee; padding-top: 12px; font-size: 10px; color: #888; display: flex; justify-content: space-between; }
  .pkg-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .pkg-box { background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 6px; padding: 10px; }
  .pkg-box .label { font-size: 10px; text-transform: uppercase; color: #888; }
  .pkg-box .value { font-size: 14px; font-weight: 700; margin-top: 2px; }
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
    <div style="font-size:11px;color:#555;margin-top:3px;">${addrParts || "—"}</div>
  </div>
  <div class="meta-box">
    <div class="label">Shipment Number</div>
    <div class="value">${pl.shipment_tracking ?? "—"}</div>
    <div style="font-size:11px;color:#555;margin-top:3px;">${pl.shipment_date ? new Date(pl.shipment_date).toLocaleDateString("en-IN") : ""}</div>
  </div>
  <div class="meta-box">
    <div class="label">Destination Country</div>
    <div class="value">${pl.destination_country ?? "—"}</div>
  </div>
  <div class="meta-box">
    <div class="label">Status</div>
    <div class="value">${pl.status}</div>
  </div>
</div>

<div class="pkg-grid">
  <div class="pkg-box"><div class="label">Packages</div><div class="value">${pl.package_count ?? "—"}</div></div>
  <div class="pkg-box"><div class="label">Package Type</div><div class="value">${pl.package_type ?? "—"}</div></div>
  <div class="pkg-box"><div class="label">Net Weight</div><div class="value">${pl.net_weight ? pl.net_weight + " kg" : "—"}</div></div>
  <div class="pkg-box"><div class="label">Gross Weight</div><div class="value">${pl.gross_weight ? pl.gross_weight + " kg" : "—"}</div></div>
</div>
${pl.dimensions ? `<p style="margin-bottom:16px;font-size:12px;"><strong>Dimensions:</strong> ${pl.dimensions}</p>` : ""}
${pl.remarks ? `<p style="margin-bottom:16px;font-size:12px;"><strong>Remarks:</strong> ${pl.remarks}</p>` : ""}

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Image</th>
      <th>Type</th>
      <th>Order Code</th>
      <th>Description</th>
      <th>Qty</th>
      <th>Unit</th>
      <th>Weight</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml || '<tr><td colspan="8" style="text-align:center;color:#aaa;padding:20px;">No items added</td></tr>'}
  </tbody>
</table>

<div class="footer">
  <span>ZARI EMBROIDERIES — Packing List ${pl.pl_number}</span>
  <span>Generated ${new Date().toLocaleString("en-IN")}</span>
</div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (e) { err(res, e, "Failed to generate PDF"); }
});

// ─── ELIGIBLE ORDERS FOR A PACKING LIST ────────────────────────────────────
// GET /api/packing-lists/:id/eligible-orders
// Returns swatch + style orders matching client + delivery address of the PL
router.get("/packing-lists/:id/eligible-orders", requireAuth, async (req, res) => {
  try {
    const pl = await pool.query(`SELECT * FROM packing_lists WHERE id = $1`, [req.params.id]);
    if (!pl.rows.length) return res.status(404).json({ error: "Not found" });

    const { client_id, delivery_address_id } = pl.rows[0];

    // Get already-added item ids per type
    const added = await pool.query(
      `SELECT item_type, item_id FROM packing_list_items WHERE packing_list_id = $1`,
      [req.params.id]
    );
    const addedSwatch = new Set(added.rows.filter(r => r.item_type === "Swatch").map(r => r.item_id));
    const addedStyle  = new Set(added.rows.filter(r => r.item_type === "Style").map(r => r.item_id));

    const daCondition = delivery_address_id
      ? `AND o.delivery_address_id = ${parseInt(delivery_address_id)}`
      : "";

    const [swatches, styles] = await Promise.all([
      pool.query(
        `SELECT id, order_code, swatch_name AS name, client_name, delivery_address_id, order_status, quantity
         FROM swatch_orders o
         WHERE client_id::text = $1::text ${daCondition} AND is_deleted = FALSE
         ORDER BY order_code DESC LIMIT 200`,
        [client_id]
      ),
      pool.query(
        `SELECT id, order_code, style_name AS name, client_name, delivery_address_id, order_status, quantity
         FROM style_orders o
         WHERE client_id::text = $1::text ${daCondition} AND is_deleted = FALSE
         ORDER BY order_code DESC LIMIT 200`,
        [client_id]
      ),
    ]);

    res.json({
      swatches: swatches.rows.map(r => ({ ...r, already_added: addedSwatch.has(r.id) })),
      styles: styles.rows.map(r => ({ ...r, already_added: addedStyle.has(r.id) })),
    });
  } catch (e) { err(res, e, "Failed to fetch eligible orders"); }
});

export default router;
