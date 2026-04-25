import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import path from "path";
import fs from "fs";
import { uploadMiddleware, uploadFile, deleteUpload, resolveUploadAbsPath } from "../utils/uploadHelper";

type AuthRequest = Request & { user?: { userId: number; email: string; name?: string; role: string } };

const router = Router();

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

router.delete("/delivery-addresses/:id", requireAuth, async (req, res) => {
  try {
    const inUse = await pool.query(`SELECT id FROM packing_lists WHERE delivery_address_id = $1 LIMIT 1`, [req.params.id]);
    if (inUse.rows.length) return res.status(400).json({ error: "Address is used by a packing list and cannot be deleted" });
    await pool.query(`DELETE FROM delivery_addresses WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (e) { err(res, e, "Failed to delete delivery address"); }
});

// ═══════════════════════════════════════════════════════════════
// ELIGIBLE ORDERS (by client + delivery address, no PL required)
// ═══════════════════════════════════════════════════════════════

router.get("/eligible-orders-for-packing", requireAuth, async (req, res) => {
  try {
    const { client_id, delivery_address_id } = req.query;
    if (!client_id) return res.status(400).json({ error: "client_id is required" });

    const daCondition = delivery_address_id
      ? `AND o.delivery_address_id = ${parseInt(delivery_address_id as string)}`
      : "";

    const [swatches, styles] = await Promise.all([
      pool.query(
        `SELECT id, order_code, swatch_name AS name, client_name, delivery_address_id, order_status, quantity
         FROM swatch_orders o
         WHERE client_id::text = $1::text ${daCondition} AND is_deleted = FALSE
           AND order_status NOT IN ('Shipped','Cancelled')
         ORDER BY order_code DESC LIMIT 300`,
        [client_id]
      ),
      pool.query(
        `SELECT id, order_code, style_name AS name, client_name, delivery_address_id, order_status, quantity
         FROM style_orders o
         WHERE client_id::text = $1::text ${daCondition} AND is_deleted = FALSE
           AND order_status NOT IN ('Shipped','Cancelled')
         ORDER BY order_code DESC LIMIT 300`,
        [client_id]
      ),
    ]);

    res.json({ swatches: swatches.rows, styles: styles.rows });
  } catch (e) { err(res, e, "Failed to fetch eligible orders"); }
});

// ═══════════════════════════════════════════════════════════════
// PACKING LISTS — LIST + DETAIL + CREATE + UPDATE + DELETE
// ═══════════════════════════════════════════════════════════════

// GET /api/packing-lists
router.get("/packing-lists", requireAuth, async (req, res) => {
  try {
    const { client_id, shipment_id, status, page = "1", limit = "25" } = req.query;
    const conditions: string[] = [];
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
                (SELECT COUNT(*) FROM packing_packages pp WHERE pp.packing_list_id = pl.id) AS total_packages,
                (SELECT COALESCE(SUM(pp.net_weight),0)   FROM packing_packages pp WHERE pp.packing_list_id = pl.id) AS total_net_weight,
                (SELECT COALESCE(SUM(pp.gross_weight),0) FROM packing_packages pp WHERE pp.packing_list_id = pl.id) AS total_gross_weight,
                (SELECT COUNT(*) FROM packing_packages pp
                   JOIN packing_package_items ppi ON ppi.package_id = pp.id
                   WHERE pp.packing_list_id = pl.id) AS total_items
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

// GET /api/packing-lists/:id
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

    // Load packages with their items
    const pkgs = await pool.query(
      `SELECT pp.*,
              (SELECT COUNT(*) FROM packing_package_items ppi WHERE ppi.package_id = pp.id) AS item_count
       FROM packing_packages pp
       WHERE pp.packing_list_id = $1
       ORDER BY pp.package_number`,
      [req.params.id]
    );

    const packagesWithItems: any[] = [];
    for (const pkg of pkgs.rows) {
      const items = await pool.query(
        `SELECT * FROM packing_package_items WHERE package_id = $1 ORDER BY id`,
        [pkg.id]
      );
      packagesWithItems.push({ ...pkg, items: items.rows });
    }

    res.json({ data: { ...r.rows[0], packages: packagesWithItems } });
  } catch (e) { err(res, e, "Failed to fetch packing list"); }
});

// POST /api/packing-lists
router.post("/packing-lists", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      client_id, delivery_address_id, shipment_id,
      destination_country, remarks, status = "Draft",
      packages = [],
    } = req.body;

    if (!client_id) return res.status(400).json({ error: "client_id is required" });
    if (!delivery_address_id) return res.status(400).json({ error: "delivery_address_id is required" });

    const addrCheck = await pool.query(
      `SELECT id FROM delivery_addresses WHERE id = $1 AND client_id = $2`,
      [delivery_address_id, client_id]
    );
    if (!addrCheck.rows.length)
      return res.status(400).json({ error: "Delivery address does not belong to selected client" });

    // Validate: no shipped orders
    for (const pkg of packages) {
      for (const item of (pkg.items ?? [])) {
        const tbl = item.order_type === "Swatch" ? "swatch_orders" : "style_orders";
        const chk = await pool.query(`SELECT order_status FROM ${tbl} WHERE id = $1`, [item.order_id]);
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
        await pool.query(
          `INSERT INTO packing_package_items (package_id, order_type, order_id, order_code, description, quantity, unit, item_weight)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [pkgId, item.order_type, item.order_id, item.order_code || null,
           item.description || null, item.quantity || null, item.unit || null, item.item_weight || null]
        );
      }
    }

    res.status(201).json({
      data: pl.rows[0],
      message: "Packing list created successfully with package details",
    });
  } catch (e) { err(res, e, "Failed to create packing list"); }
});

// PUT /api/packing-lists/:id  (header + packages full replace)
router.put("/packing-lists/:id", requireAuth, async (req, res) => {
  try {
    const existing = await pool.query(`SELECT * FROM packing_lists WHERE id = $1`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: "Not found" });
    const ex = existing.rows[0];

    const { delivery_address_id, shipment_id, destination_country, status, remarks, packages } = req.body;

    if (delivery_address_id && delivery_address_id !== ex.delivery_address_id) {
      const addrCheck = await pool.query(
        `SELECT id FROM delivery_addresses WHERE id = $1 AND client_id = $2`,
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
      // Delete all existing packages (cascades to items via FK)
      await pool.query(`DELETE FROM packing_packages WHERE packing_list_id = $1`, [req.params.id]);

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
          await pool.query(
            `INSERT INTO packing_package_items (package_id, order_type, order_id, order_code, description, quantity, unit, item_weight)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [pkgId, item.order_type, item.order_id, item.order_code || null,
             item.description || null, item.quantity || null, item.unit || null, item.item_weight || null]
          );
        }
      }
    }

    res.json({ data: r.rows[0] });
  } catch (e) { err(res, e, "Failed to update packing list"); }
});

// DELETE /api/packing-lists/:id
router.delete("/packing-lists/:id", requireAuth, async (req, res) => {
  try {
    // Cascade via FK: packing_packages → packing_package_items
    await pool.query(`DELETE FROM packing_list_items WHERE packing_list_id = $1`, [req.params.id]);
    await pool.query(`DELETE FROM packing_lists WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (e) { err(res, e, "Failed to delete packing list"); }
});

// ═══════════════════════════════════════════════════════════════
// PACKAGES — CREATE / UPDATE / DELETE
// ═══════════════════════════════════════════════════════════════

// POST /api/packing-lists/:id/packages
router.post("/packing-lists/:id/packages", requireAuth, async (req, res) => {
  try {
    const pl = await pool.query(`SELECT * FROM packing_lists WHERE id = $1`, [req.params.id]);
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
    res.status(201).json({ data: { ...r.rows[0], items: [] } });
  } catch (e) { err(res, e, "Failed to create package"); }
});

// PUT /api/packing-lists/:id/packages/:pkgId
router.put("/packing-lists/:id/packages/:pkgId", requireAuth, async (req, res) => {
  try {
    const { length, width, height, net_weight, gross_weight, shipment_id } = req.body;
    const r = await pool.query(
      `UPDATE packing_packages SET
         length = COALESCE($1, length), width = COALESCE($2, width), height = COALESCE($3, height),
         net_weight = COALESCE($4, net_weight), gross_weight = COALESCE($5, gross_weight),
         shipment_id = COALESCE($6, shipment_id)
       WHERE id = $7 AND packing_list_id = $8 RETURNING *`,
      [length ?? null, width ?? null, height ?? null, net_weight ?? null, gross_weight ?? null,
       shipment_id ?? null, req.params.pkgId, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Package not found" });

    // Return with items
    const items = await pool.query(`SELECT * FROM packing_package_items WHERE package_id = $1 ORDER BY id`, [req.params.pkgId]);
    res.json({ data: { ...r.rows[0], items: items.rows } });
  } catch (e) { err(res, e, "Failed to update package"); }
});

// DELETE /api/packing-lists/:id/packages/:pkgId
router.delete("/packing-lists/:id/packages/:pkgId", requireAuth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM packing_packages WHERE id = $1 AND packing_list_id = $2`, [req.params.pkgId, req.params.id]);
    res.json({ success: true });
  } catch (e) { err(res, e, "Failed to delete package"); }
});

// ═══════════════════════════════════════════════════════════════
// PACKAGE ITEMS — ADD / REMOVE
// ═══════════════════════════════════════════════════════════════

// POST /api/packing-lists/:id/packages/:pkgId/items
router.post("/packing-lists/:id/packages/:pkgId/items", requireAuth, async (req, res) => {
  try {
    const pkg = await pool.query(
      `SELECT pp.*, pl.client_id, pl.delivery_address_id FROM packing_packages pp
       JOIN packing_lists pl ON pl.id = pp.packing_list_id
       WHERE pp.id = $1 AND pp.packing_list_id = $2`,
      [req.params.pkgId, req.params.id]
    );
    if (!pkg.rows.length) return res.status(404).json({ error: "Package not found" });

    const { order_type, order_id, order_code, description, quantity, unit, item_weight } = req.body;
    const { client_id, delivery_address_id } = pkg.rows[0];

    // Prevent duplicate order across all packages in this packing list
    const dup = await pool.query(
      `SELECT ppi.id FROM packing_package_items ppi
       JOIN packing_packages pp ON pp.id = ppi.package_id
       WHERE pp.packing_list_id = $1 AND ppi.order_type = $2 AND ppi.order_id = $3`,
      [req.params.id, order_type, order_id]
    );
    if (dup.rows.length)
      return res.status(400).json({ error: "This order is already packed in another package of this packing list" });

    // Validate order is not shipped
    const tbl = order_type === "Swatch" ? "swatch_orders" : "style_orders";
    const orderRow = await pool.query(`SELECT order_status FROM ${tbl} WHERE id = $1`, [order_id]);
    if (orderRow.rows[0]?.order_status === "Shipped")
      return res.status(400).json({ error: "Cannot add a shipped order to a packing list" });

    // Validate delivery address match
    if (delivery_address_id) {
      const chk = await pool.query(
        `SELECT id FROM ${tbl} WHERE id = $1 AND client_id::text = $2::text AND delivery_address_id = $3`,
        [order_id, client_id, delivery_address_id]
      );
      if (!chk.rows.length)
        return res.status(400).json({ error: "Order delivery address does not match this packing list. Selection blocked." });
    }

    const r = await pool.query(
      `INSERT INTO packing_package_items (package_id, order_type, order_id, order_code, description, quantity, unit, item_weight)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.pkgId, order_type, order_id, order_code || null,
       description || null, quantity || null, unit || null, item_weight || null]
    );
    res.status(201).json({ data: r.rows[0] });
  } catch (e) { err(res, e, "Failed to add item to package"); }
});

// PATCH /api/packing-lists/:id/packages/:pkgId/items/:itemId
router.patch("/packing-lists/:id/packages/:pkgId/items/:itemId", requireAuth, async (req, res) => {
  try {
    const { quantity, unit, item_weight, description } = req.body;
    const r = await pool.query(
      `UPDATE packing_package_items SET
         quantity    = COALESCE($1, quantity),
         unit        = COALESCE($2, unit),
         item_weight = COALESCE($3, item_weight),
         description = COALESCE($4, description)
       WHERE id = $5 AND package_id = $6 RETURNING *`,
      [quantity ?? null, unit ?? null, item_weight ?? null, description ?? null, req.params.itemId, req.params.pkgId]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Item not found" });
    res.json({ data: r.rows[0] });
  } catch (e) { err(res, e, "Failed to update package item"); }
});

// DELETE /api/packing-lists/:id/packages/:pkgId/items/:itemId
router.delete("/packing-lists/:id/packages/:pkgId/items/:itemId", requireAuth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM packing_package_items WHERE id = $1 AND package_id = $2`, [req.params.itemId, req.params.pkgId]);
    res.json({ success: true });
  } catch (e) { err(res, e, "Failed to remove item from package"); }
});

// ═══════════════════════════════════════════════════════════════
// ITEM IMAGE UPLOAD (on package items)
// ═══════════════════════════════════════════════════════════════

router.get("/packing-lists/item-images/:filename", async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(process.cwd(), "uploads", "packing-list-items", filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Image not found" });
    res.sendFile(filePath);
  } catch (e) { err(res, e, "Failed to serve image"); }
});

router.get("/packing-lists/order-artwork-image", requireAuth, async (req, res) => {
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
    res.json({ data: first ?? null });
  } catch (e) { err(res, e, "Failed to fetch order artwork image"); }
});

router.post(
  "/packing-lists/:id/packages/:pkgId/items/:itemId/image",
  requireAuth,
  uploadMiddleware.single("image"),
  async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const old = await pool.query(`SELECT item_image_url FROM packing_package_items WHERE id = $1 AND package_id = $2`, [req.params.itemId, req.params.pkgId]);
      if (old.rows[0]?.item_image_url) {
        await deleteUpload(old.rows[0].item_image_url);
      }

      const imageUrl = await uploadFile(req.file, {
        entity: "packing-lists",
        id: req.params.id,
        category: "images",
      });

      const r = await pool.query(
        `UPDATE packing_package_items SET item_image_url = $1 WHERE id = $2 AND package_id = $3 RETURNING *`,
        [imageUrl, req.params.itemId, req.params.pkgId]
      );
      if (!r.rows.length) return res.status(404).json({ error: "Item not found" });
      res.json({ data: r.rows[0] });
    } catch (e) { err(res, e, "Failed to upload image"); }
  }
);

router.delete("/packing-lists/:id/packages/:pkgId/items/:itemId/image", requireAuth, async (req, res) => {
  try {
    const old = await pool.query(`SELECT item_image_url FROM packing_package_items WHERE id = $1 AND package_id = $2`, [req.params.itemId, req.params.pkgId]);
    if (old.rows[0]?.item_image_url) {
      await deleteUpload(old.rows[0].item_image_url);
    }
    const r = await pool.query(
      `UPDATE packing_package_items SET item_image_url = NULL WHERE id = $1 AND package_id = $2 RETURNING *`,
      [req.params.itemId, req.params.pkgId]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Item not found" });
    res.json({ data: r.rows[0] });
  } catch (e) { err(res, e, "Failed to remove image"); }
});

// ═══════════════════════════════════════════════════════════════
// ELIGIBLE ORDERS FOR EXISTING PACKING LIST
// ═══════════════════════════════════════════════════════════════

router.get("/packing-lists/:id/eligible-orders", requireAuth, async (req, res) => {
  try {
    const pl = await pool.query(`SELECT * FROM packing_lists WHERE id = $1`, [req.params.id]);
    if (!pl.rows.length) return res.status(404).json({ error: "Not found" });
    const { client_id, delivery_address_id } = pl.rows[0];

    // Already packed in this packing list
    const packed = await pool.query(
      `SELECT ppi.order_type, ppi.order_id FROM packing_package_items ppi
       JOIN packing_packages pp ON pp.id = ppi.package_id
       WHERE pp.packing_list_id = $1`,
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

    res.json({
      swatches: swatches.rows.map(r => ({ ...r, already_added: packedSwatch.has(r.id) })),
      styles:   styles.rows.map(r => ({ ...r, already_added: packedStyle.has(r.id) })),
    });
  } catch (e) { err(res, e, "Failed to fetch eligible orders"); }
});

// ═══════════════════════════════════════════════════════════════
// PDF HTML — Per-package layout
// ═══════════════════════════════════════════════════════════════

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
    const pl = r.rows[0];

    const pkgs = await pool.query(
      `SELECT * FROM packing_packages WHERE packing_list_id = $1 ORDER BY package_number`,
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
        `SELECT * FROM packing_package_items WHERE package_id = $1 ORDER BY id`,
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
    res.send(html);
  } catch (e) { err(res, e, "Failed to generate PDF"); }
});

export default router;
