import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { syncAllFromMasters } from "../services/inventoryService";
import type { AuthRequest } from "../middlewares/requireAuth";

const router = Router();

router.get("/inventory/summary", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*)                                               AS total_items,
        COUNT(*) FILTER (WHERE available_stock::numeric > 0)  AS in_stock,
        COUNT(*) FILTER (WHERE available_stock::numeric <= 0) AS out_of_stock,
        COUNT(*) FILTER (WHERE
          available_stock::numeric > 0
          AND reorder_level::numeric > 0
          AND available_stock::numeric <= reorder_level::numeric
        )                                                      AS low_stock,
        COALESCE(SUM(current_stock::numeric),0)                AS total_current_stock,
        COALESCE(SUM(available_stock::numeric),0)              AS total_available_stock,
        COUNT(*) FILTER (WHERE source_type = 'fabric')         AS fabric_count,
        COUNT(*) FILTER (WHERE source_type = 'material')       AS material_count,
        COUNT(*) FILTER (WHERE source_type = 'packaging')      AS packaging_count
      FROM inventory_items
      WHERE is_active = true
    `);
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

router.get("/inventory/items", requireAuth, async (req, res) => {
  try {
    const {
      search = "",
      category = "all",
      department = "all",
      location = "all",
      stockLevel = "all",
      sourceType = "all",
      fromDate = "",
      toDate = "",
      page = "1",
      limit = "50",
      sort = "item_name",
      order = "asc",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = ["ii.is_active = true"];
    const params: (string | number)[] = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(ii.item_name ILIKE $${params.length} OR ii.item_code ILIKE $${params.length})`);
    }
    if (category !== "all") {
      params.push(category);
      conditions.push(`ii.category = $${params.length}`);
    }
    if (department !== "all") {
      params.push(department);
      conditions.push(`ii.department = $${params.length}`);
    }
    if (location !== "all") {
      params.push(location);
      conditions.push(`ii.warehouse_location = $${params.length}`);
    }
    if (sourceType !== "all") {
      params.push(sourceType);
      conditions.push(`ii.source_type = $${params.length}`);
    }
    if (stockLevel === "in-stock") {
      conditions.push(`ii.available_stock::numeric > 0`);
    } else if (stockLevel === "low") {
      conditions.push(`ii.available_stock::numeric > 0 AND ii.reorder_level::numeric > 0 AND ii.available_stock::numeric <= ii.reorder_level::numeric`);
    } else if (stockLevel === "out") {
      conditions.push(`ii.available_stock::numeric <= 0`);
    }
    if (fromDate) {
      params.push(fromDate);
      conditions.push(`ii.last_updated_at >= $${params.length}::date`);
    }
    if (toDate) {
      params.push(toDate);
      conditions.push(`ii.last_updated_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const allowedSorts: Record<string, string> = {
      item_name: "ii.item_name",
      item_code: "ii.item_code",
      category: "ii.category",
      current_stock: "ii.current_stock::numeric",
      available_stock: "ii.available_stock::numeric",
      last_updated_at: "ii.last_updated_at",
    };
    const sortCol = allowedSorts[sort] ?? "ii.item_name";
    const sortDir = order === "desc" ? "DESC" : "ASC";

    const [rows, totalRes] = await Promise.all([
      pool.query(
        `SELECT ii.*,
           CASE ii.source_type
             WHEN 'fabric'    THEN 'Fabric'
             WHEN 'material'  THEN 'Material'
             WHEN 'packaging' THEN 'Item Master'
           END AS source_label,
           COALESCE(f.hsn_code, m.hsn_code) AS hsn_code,
           COALESCE(f.gst_percent::numeric, m.gst_percent::numeric)::text AS gst_percent
         FROM inventory_items ii
         LEFT JOIN fabrics   f ON ii.source_type = 'fabric'   AND f.id = ii.source_id
         LEFT JOIN materials m ON ii.source_type = 'material'  AND m.id = ii.source_id
         ${where}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limitNum, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM inventory_items ii ${where}`, params),
    ]);

    res.json({
      data: rows.rows,
      total: parseInt(totalRes.rows[0].count),
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load inventory items" });
  }
});

router.get("/inventory/items/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const r = await pool.query(
      `SELECT ii.*,
         CASE ii.source_type
           WHEN 'fabric'    THEN 'Fabric'
           WHEN 'material'  THEN 'Material'
           WHEN 'packaging' THEN 'Item Master'
         END AS source_label,
         COALESCE(f.hsn_code, m.hsn_code) AS hsn_code,
         COALESCE(f.gst_percent::numeric, m.gst_percent::numeric)::text AS gst_percent
       FROM inventory_items ii
       LEFT JOIN fabrics   f ON ii.source_type = 'fabric'   AND f.id = ii.source_id
       LEFT JOIN materials m ON ii.source_type = 'material'  AND m.id = ii.source_id
       WHERE ii.id = $1`,
      [id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to load item" });
  }
});

router.get("/inventory/items/:id/logs", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const r = await pool.query(
      `SELECT * FROM inventory_stock_logs
       WHERE inventory_item_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load stock logs" });
  }
});

router.get("/inventory/items/:id/reservations", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const itemRes = await pool.query(
      `SELECT source_type, source_id, item_name, style_reserved_qty, swatch_reserved_qty FROM inventory_items WHERE id = $1`,
      [id]
    );
    if (!itemRes.rows.length) return res.status(404).json({ error: "Not found" });
    const item = itemRes.rows[0];

    let swatchOrders: unknown[] = [];
    let styleOrders: unknown[] = [];

    if (item.source_type === "fabric") {
      const srcId = parseInt(item.source_id);
      const [sw, st] = await Promise.all([
        pool.query(
          `SELECT id, order_code, swatch_name, client_name, order_status, quantity, unit_type,
                  CASE WHEN fabric_id = $1 THEN 'Main Fabric' ELSE 'Lining Fabric' END AS fabric_role
           FROM swatch_orders
           WHERE (fabric_id = $1 OR lining_fabric_id = $1) AND is_deleted = false
           ORDER BY created_at DESC LIMIT 50`,
          [srcId]
        ),
        pool.query(
          `SELECT so.id, so.order_code, so.client_name, so.order_status
           FROM style_orders so
           WHERE so.is_deleted = false
           ORDER BY so.created_at DESC LIMIT 0`
        ),
      ]);
      swatchOrders = sw.rows;
      styleOrders = st.rows;
    }

    res.json({
      item_name: item.item_name,
      source_type: item.source_type,
      style_reserved_qty: item.style_reserved_qty,
      swatch_reserved_qty: item.swatch_reserved_qty,
      swatch_orders: swatchOrders,
      style_orders: styleOrders,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load reservations" });
  }
});

router.get("/inventory/filters", requireAuth, async (_req, res) => {
  try {
    const [cats, depts, locs] = await Promise.all([
      pool.query(`SELECT DISTINCT category FROM inventory_items WHERE category IS NOT NULL AND is_active=true ORDER BY category`),
      pool.query(`SELECT DISTINCT department FROM inventory_items WHERE department IS NOT NULL AND is_active=true ORDER BY department`),
      pool.query(`SELECT DISTINCT warehouse_location FROM inventory_items WHERE warehouse_location IS NOT NULL AND is_active=true ORDER BY warehouse_location`),
    ]);
    res.json({
      categories: cats.rows.map((r: { category: string }) => r.category),
      departments: depts.rows.map((r: { department: string }) => r.department),
      locations: locs.rows.map((r: { warehouse_location: string }) => r.warehouse_location),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load filters" });
  }
});

// ── Stock Ledger ────────────────────────────────────────────────────────────

router.get("/inventory/ledger", requireAuth, async (req, res) => {
  try {
    const {
      itemId = "",
      transactionType = "all",
      referenceType = "all",
      createdBy = "",
      fromDate = "",
      toDate = "",
      search = "",
      sort = "newest",
      page = "1",
      limit = "50",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (itemId) {
      params.push(parseInt(itemId));
      conditions.push(`sl.item_id = $${params.length}`);
    }
    if (transactionType !== "all") {
      params.push(transactionType);
      conditions.push(`sl.transaction_type = $${params.length}`);
    }
    if (referenceType !== "all") {
      params.push(referenceType);
      conditions.push(`sl.reference_type = $${params.length}`);
    }
    if (createdBy) {
      params.push(`%${createdBy}%`);
      conditions.push(`sl.created_by ILIKE $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`ii.item_name ILIKE $${params.length}`);
    }
    if (fromDate) {
      params.push(fromDate);
      conditions.push(`sl.created_at >= $${params.length}::date`);
    }
    if (toDate) {
      params.push(toDate);
      conditions.push(`sl.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    let orderBy = "sl.created_at DESC";
    if (sort === "oldest") orderBy = "sl.created_at ASC";
    else if (sort === "highest_in") orderBy = "sl.in_quantity::numeric DESC";
    else if (sort === "highest_out") orderBy = "sl.out_quantity::numeric DESC";

    const [rows, totalRes] = await Promise.all([
      pool.query(
        `SELECT sl.*, ii.item_name, ii.item_code, ii.unit_type
         FROM stock_ledger sl
         JOIN inventory_items ii ON ii.id = sl.item_id
         ${where}
         ORDER BY ${orderBy}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limitNum, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM stock_ledger sl JOIN inventory_items ii ON ii.id = sl.item_id ${where}`,
        params
      ),
    ]);

    res.json({ data: rows.rows, total: parseInt(totalRes.rows[0].count), page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load ledger" });
  }
});

router.post("/inventory/ledger/wastage", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });

    const { itemId, quantity, reason, referenceNumber } = req.body;
    if (!itemId || !quantity) return res.status(400).json({ error: "itemId and quantity are required" });

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: "Quantity must be a positive number" });

    const itemRes = await pool.query(
      `SELECT id, item_name, current_stock, style_reserved_qty, swatch_reserved_qty, available_stock FROM inventory_items WHERE id = $1 AND is_active = true`,
      [itemId]
    );
    if (!itemRes.rows.length) return res.status(404).json({ error: "Item not found" });

    const item = itemRes.rows[0];
    const avail = parseFloat(item.available_stock ?? "0");
    if (qty > avail) {
      return res.status(422).json({ error: `Wastage quantity (${qty}) exceeds available stock (${avail.toFixed(3)})` });
    }

    const newStock = Math.max(0, parseFloat(item.current_stock ?? "0") - qty);
    const newAvail = Math.max(0, newStock - parseFloat(item.style_reserved_qty ?? "0") - parseFloat(item.swatch_reserved_qty ?? "0"));
    const userName = (req.user as { name?: string; email?: string } | undefined)?.name
      || (req.user as { name?: string; email?: string } | undefined)?.email
      || "Admin";

    await pool.query(
      `UPDATE inventory_items SET current_stock = $1, available_stock = $2, last_updated_at = NOW() WHERE id = $3`,
      [newStock, newAvail, itemId]
    );

    const ledger = await pool.query(
      `INSERT INTO stock_ledger (item_id, transaction_type, reference_number, reference_type, in_quantity, out_quantity, balance_quantity, remarks, created_by, created_at)
       VALUES ($1,'wastage',$2,'manual_entry',0,$3,$4,$5,$6,NOW()) RETURNING *`,
      [itemId, referenceNumber ?? null, qty, newStock, reason ?? null, userName]
    );

    await pool.query(
      `INSERT INTO inventory_stock_logs (inventory_item_id, action_type, quantity_before, quantity_after, quantity_delta, reference_type, notes, created_by_name, created_at)
       VALUES ($1,'wastage',$2,$3,$4,'manual',$5,$6,NOW())`,
      [itemId, parseFloat(item.current_stock), newStock, -qty, reason ?? null, userName]
    ).catch(e => console.error("[StockLog] wastage log failed:", e));

    res.json(ledger.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record wastage" });
  }
});

router.delete("/inventory/ledger/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
    const id = parseInt(req.params.id);
    const r = await pool.query(`DELETE FROM stock_ledger WHERE id = $1 RETURNING id`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete ledger entry" });
  }
});

// ── Stock Update ─────────────────────────────────────────────────────────────

router.put("/inventory/items/:id/stock", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    const id = parseInt(req.params.id);
    const {
      warehouseLocation,
      currentStock,
      averagePrice,
      lastPurchasePrice,
      minimumLevel,
      reorderLevel,
      maximumLevel,
      department,
      notes,
    } = req.body;

    const prevRes = await pool.query(`SELECT current_stock FROM inventory_items WHERE id = $1`, [id]);
    if (!prevRes.rows.length) return res.status(404).json({ error: "Not found" });
    const prevStock = parseFloat(prevRes.rows[0].current_stock ?? "0");

    const stock = parseFloat(currentStock ?? "0") || 0;
    const styleRes = 0;
    const swatchRes = 0;
    const availableStock = Math.max(0, stock - styleRes - swatchRes);

    const r = await pool.query(
      `UPDATE inventory_items SET
         current_stock       = $1,
         available_stock     = $2,
         average_price       = COALESCE(NULLIF($3,'')::numeric, average_price),
         last_purchase_price = COALESCE(NULLIF($4,'')::numeric, last_purchase_price),
         minimum_level       = COALESCE(NULLIF($5,'')::numeric, minimum_level),
         reorder_level       = COALESCE(NULLIF($6,'')::numeric, reorder_level),
         maximum_level       = COALESCE(NULLIF($7,'')::numeric, maximum_level),
         warehouse_location  = COALESCE(NULLIF($8,''), warehouse_location),
         department          = COALESCE(NULLIF($9,''), department),
         last_updated_at     = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        stock,
        availableStock,
        String(averagePrice ?? ""),
        String(lastPurchasePrice ?? ""),
        String(minimumLevel ?? ""),
        String(reorderLevel ?? ""),
        String(maximumLevel ?? ""),
        warehouseLocation ?? "",
        department ?? "",
        id,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });

    const delta = stock - prevStock;
    const actionType = prevStock === 0 ? "opening" : delta >= 0 ? "adjustment_in" : "adjustment_out";
    const userName = (req.user as { name?: string; email?: string } | undefined)?.name
      || (req.user as { name?: string; email?: string } | undefined)?.email
      || "Admin";

    await pool.query(
      `INSERT INTO inventory_stock_logs
         (inventory_item_id, action_type, quantity_before, quantity_after, quantity_delta, reference_type, notes, created_by_name, created_at)
       VALUES ($1,$2,$3,$4,$5,'manual',$6,$7,NOW())`,
      [id, actionType, prevStock, stock, delta, notes ?? null, userName]
    ).catch(e => console.error("[StockLog] Failed to write log:", e));

    const ledgerType = prevStock === 0 ? "opening_stock" : delta >= 0 ? "adjustment_in" : "adjustment_out";
    const inQty  = delta > 0 ? delta : 0;
    const outQty = delta < 0 ? Math.abs(delta) : 0;
    await pool.query(
      `INSERT INTO stock_ledger (item_id, transaction_type, reference_number, reference_type, in_quantity, out_quantity, balance_quantity, remarks, created_by, created_at)
       VALUES ($1,$2,'Manual Entry','manual_entry',$3,$4,$5,$6,$7,NOW())`,
      [id, ledgerType, inQty, outQty, stock, notes ?? null, userName]
    ).catch(e => console.error("[Ledger] Failed to write ledger entry:", e));

    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update stock" });
  }
});

router.post("/inventory/sync", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    const result = await syncAllFromMasters();
    res.json({
      message: `Synced ${result.synced} new item(s), updated stock for ${result.updated} existing item(s) from masters`,
      ...result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sync failed" });
  }
});

export default router;
