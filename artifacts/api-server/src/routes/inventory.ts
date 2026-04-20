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
      params.push(transactionType.toLowerCase());
      conditions.push(`LOWER(REPLACE(sl.transaction_type, ' ', '_')) = $${params.length}`);
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
        `SELECT sl.*, ii.item_name, ii.item_code, ii.unit_type,
                sw.order_code AS swatch_order_code,
                so.order_code AS style_order_code,
                so.style_no   AS style_order_style_no
         FROM stock_ledger sl
         JOIN inventory_items ii ON ii.id = sl.item_id
         LEFT JOIN swatch_orders sw ON sl.reference_type = 'Swatch'
                AND sl.reference_number ~ '^[0-9]+$'
                AND sw.id = (CASE WHEN sl.reference_number ~ '^[0-9]+$' THEN sl.reference_number::bigint ELSE NULL END)
         LEFT JOIN style_orders so ON sl.reference_type = 'Style'
                AND sl.reference_number ~ '^[0-9]+$'
                AND so.id = (CASE WHEN sl.reference_number ~ '^[0-9]+$' THEN sl.reference_number::bigint ELSE NULL END)
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

// ═══════════════════════════════════════════════════════════════════════════════
//  RESERVATION ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

async function recalcAvailable(client: typeof pool, inventoryId: number) {
  await client.query(`
    UPDATE inventory_items
    SET available_stock = current_stock - style_reserved_qty - swatch_reserved_qty,
        last_updated_at = NOW()
    WHERE id = $1
  `, [inventoryId]);
}

router.get("/inventory/reservations", requireAuth, async (req, res) => {
  try {
    const {
      search = "", reservationType = "all", status = "all",
      fromDate = "", toDate = "", page = "1", limit = "20",
    } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let pi = 1;
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(ii.item_name ILIKE $${pi} OR ii.item_code ILIKE $${pi})`);
      pi++;
    }
    if (reservationType !== "all") {
      params.push(reservationType);
      conditions.push(`mr.reservation_type = $${pi++}`);
    }
    if (status !== "all") {
      params.push(status);
      conditions.push(`mr.status = $${pi++}`);
    }
    if (fromDate) {
      params.push(fromDate);
      conditions.push(`mr.reservation_date >= $${pi++}`);
    }
    if (toDate) {
      params.push(toDate);
      conditions.push(`mr.reservation_date <= $${pi++}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countR = await pool.query(
      `SELECT COUNT(*) FROM material_reservations mr
       JOIN inventory_items ii ON ii.id = mr.inventory_id ${where}`,
      params
    );
    const total = parseInt(countR.rows[0].count);

    params.push(parseInt(limit)); const limitIdx = pi++;
    params.push(offset);         const offsetIdx = pi++;
    const rows = await pool.query(
      `SELECT mr.*,
              ii.item_name, ii.item_code, ii.unit_type, ii.available_stock,
              COALESCE(so.order_code, sw.order_code) AS reference_code,
              COALESCE(so.style_name, sw.swatch_name) AS reference_name
       FROM material_reservations mr
       JOIN inventory_items ii ON ii.id = mr.inventory_id
       LEFT JOIN style_orders  so ON mr.reservation_type = 'Style'  AND so.id = mr.reference_id
       LEFT JOIN swatch_orders sw ON mr.reservation_type = 'Swatch' AND sw.id = mr.reference_id
       ${where}
       ORDER BY mr.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );
    res.json({ rows: rows.rows, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load reservations" });
  }
});

router.post("/inventory/reservations", requireAuth, async (req, res) => {
  const auth = req as AuthRequest;
  try {
    const { inventoryId, reservationType, referenceId, reservedQuantity, remarks, reservationDate } = req.body;
    if (!inventoryId || !reservationType || !referenceId || !reservedQuantity || !reservationDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!["Style", "Swatch"].includes(reservationType)) {
      return res.status(400).json({ error: "Invalid reservation type" });
    }

    const itemRow = await pool.query(
      `SELECT id, available_stock, style_reserved_qty, swatch_reserved_qty, current_stock
       FROM inventory_items WHERE id = $1`,
      [inventoryId]
    );
    if (!itemRow.rows.length) return res.status(404).json({ error: "Inventory item not found" });
    const item = itemRow.rows[0];
    const qty = parseFloat(reservedQuantity);
    if (qty <= 0) return res.status(400).json({ error: "Quantity must be greater than 0" });
    if (qty > parseFloat(item.available_stock)) {
      return res.status(400).json({ error: `Cannot reserve ${qty} — only ${parseFloat(item.available_stock).toFixed(3)} available` });
    }

    const client = await (pool as any).connect();
    try {
      await client.query("BEGIN");
      const ins = await client.query(
        `INSERT INTO material_reservations
           (item_id, inventory_id, reservation_type, reference_id, reserved_quantity, status, remarks, reserved_by, reservation_date)
         VALUES ($1,$2,$3,$4,$5,'Active',$6,$7,$8) RETURNING *`,
        [inventoryId, inventoryId, reservationType, referenceId, qty,
         remarks || null, auth.user?.name || auth.user?.email || "System", reservationDate]
      );
      const resv = ins.rows[0];

      const col = reservationType === "Style" ? "style_reserved_qty" : "swatch_reserved_qty";
      await client.query(
        `UPDATE inventory_items SET ${col} = ${col}::numeric + $1 WHERE id = $2`,
        [qty, inventoryId]
      );
      await recalcAvailable(client, inventoryId);

      const balR = await client.query(`SELECT current_stock FROM inventory_items WHERE id = $1`, [inventoryId]);
      await client.query(
        `INSERT INTO stock_ledger (item_id, transaction_type, reference_number, reference_type, in_quantity, out_quantity, balance_quantity, remarks, created_by)
         VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8)`,
        [inventoryId, `${reservationType.toLowerCase()}_reservation`, String(referenceId), reservationType,
         qty, balR.rows[0].current_stock, `Reserved ${qty} for ${reservationType} #${referenceId}${remarks ? ` — ${remarks}` : ""}`,
         auth.user?.name || auth.user?.email || "System"]
      );
      await client.query("COMMIT");
      res.status(201).json(resv);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to create reservation" });
  }
});

router.patch("/inventory/reservations/:id/release", requireAuth, async (req, res) => {
  const auth = req as AuthRequest;
  try {
    const { id } = req.params;
    const r = await pool.query(`SELECT * FROM material_reservations WHERE id = $1`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    const resv = r.rows[0];
    if (resv.status !== "Active") return res.status(400).json({ error: "Only Active reservations can be released" });

    const client = await (pool as any).connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE material_reservations SET status = 'Released' WHERE id = $1`, [id]);
      const col = resv.reservation_type === "Style" ? "style_reserved_qty" : "swatch_reserved_qty";
      await client.query(
        `UPDATE inventory_items SET ${col} = GREATEST(0, ${col}::numeric - $1) WHERE id = $2`,
        [resv.reserved_quantity, resv.inventory_id]
      );
      await recalcAvailable(client, resv.inventory_id);
      const balR = await client.query(`SELECT current_stock FROM inventory_items WHERE id = $1`, [resv.inventory_id]);
      await client.query(
        `INSERT INTO stock_ledger (item_id, transaction_type, reference_number, reference_type, in_quantity, out_quantity, balance_quantity, remarks, created_by)
         VALUES ($1,'reservation_release',$2,$3,$4,0,$5,$6,$7)`,
        [resv.inventory_id, String(resv.reference_id), resv.reservation_type, resv.reserved_quantity,
         balR.rows[0].current_stock, `Released ${resv.reserved_quantity} reserved for ${resv.reservation_type} #${resv.reference_id}`,
         auth.user?.name || auth.user?.email || "System"]
      );
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to release reservation" });
  }
});

router.patch("/inventory/reservations/:id/cancel", requireAuth, async (req, res) => {
  const auth = req as AuthRequest;
  try {
    const { id } = req.params;
    const r = await pool.query(`SELECT * FROM material_reservations WHERE id = $1`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    const resv = r.rows[0];
    if (resv.status !== "Active") return res.status(400).json({ error: "Only Active reservations can be cancelled" });

    const client = await (pool as any).connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE material_reservations SET status = 'Cancelled' WHERE id = $1`, [id]);
      const col = resv.reservation_type === "Style" ? "style_reserved_qty" : "swatch_reserved_qty";
      await client.query(
        `UPDATE inventory_items SET ${col} = GREATEST(0, ${col}::numeric - $1) WHERE id = $2`,
        [resv.reserved_quantity, resv.inventory_id]
      );
      await recalcAvailable(client, resv.inventory_id);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to cancel reservation" });
  }
});

router.patch("/inventory/reservations/:id/convert", requireAuth, async (req, res) => {
  const auth = req as AuthRequest;
  try {
    const { id } = req.params;
    const r = await pool.query(
      `SELECT mr.*,
         COALESCE(sw.order_code, so.order_code) AS order_code
       FROM material_reservations mr
       LEFT JOIN swatch_orders sw ON mr.reservation_type = 'Swatch' AND sw.id = mr.reference_id
       LEFT JOIN style_orders  so ON mr.reservation_type = 'Style'  AND so.id = mr.reference_id
       WHERE mr.id = $1`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    const resv = r.rows[0];
    const orderRef = resv.order_code ?? `#${resv.reference_id}`;
    if (resv.status !== "Active") return res.status(400).json({ error: "Only Active reservations can be converted" });

    const reserved = parseFloat(resv.reserved_quantity);
    // Accept split quantities from body; default = all consumed
    const body = req.body as { consumedQty?: number; releasedQty?: number; wastageQty?: number };
    const consumedQty  = body.consumedQty  !== undefined ? Number(body.consumedQty)  : reserved;
    const releasedQty  = body.releasedQty  !== undefined ? Number(body.releasedQty)  : 0;
    const wastageQty   = body.wastageQty   !== undefined ? Number(body.wastageQty)   : 0;

    if (consumedQty < 0 || releasedQty < 0 || wastageQty < 0) {
      return res.status(400).json({ error: "Quantities cannot be negative" });
    }
    if (Math.abs(consumedQty + releasedQty + wastageQty - reserved) > 0.001) {
      return res.status(400).json({ error: `Consumed + Released + Wastage must equal reserved quantity (${reserved})` });
    }

    const col = resv.reservation_type === "Style" ? "style_reserved_qty" : "swatch_reserved_qty";
    const actor = auth.user?.name || auth.user?.email || "System";

    const client = await (pool as any).connect();
    try {
      await client.query("BEGIN");

      // Mark reservation as Converted
      await client.query(`UPDATE material_reservations SET status = 'Converted' WHERE id = $1`, [id]);

      // Remove the full reserved qty from the reservation bucket
      await client.query(
        `UPDATE inventory_items SET ${col} = GREATEST(0, ${col}::numeric - $1) WHERE id = $2`,
        [reserved, resv.inventory_id]
      );

      // Wastage: physically gone — deduct from current_stock
      if (wastageQty > 0) {
        await client.query(
          `UPDATE inventory_items SET current_stock = GREATEST(0, current_stock::numeric - $1) WHERE id = $2`,
          [wastageQty, resv.inventory_id]
        );
      }

      await recalcAvailable(client, resv.inventory_id);

      const balR = await client.query(`SELECT current_stock FROM inventory_items WHERE id = $1`, [resv.inventory_id]);
      const bal = balR.rows[0].current_stock;

      // Stock ledger entries for each non-zero segment
      if (consumedQty > 0) {
        await client.query(
          `INSERT INTO stock_ledger (item_id, transaction_type, reference_number, reference_type, in_quantity, out_quantity, balance_quantity, remarks, created_by)
           VALUES ($1,'consumption',  $2,$3, 0,$4,$5,$6,$7)`,
          [resv.inventory_id, orderRef, resv.reservation_type,
           consumedQty, bal,
           `Consumed ${consumedQty} for ${resv.reservation_type} ${orderRef}`, actor]
        );
      }
      if (releasedQty > 0) {
        await client.query(
          `INSERT INTO stock_ledger (item_id, transaction_type, reference_number, reference_type, in_quantity, out_quantity, balance_quantity, remarks, created_by)
           VALUES ($1,'reservation_release',$2,$3,$4,0,$5,$6,$7)`,
          [resv.inventory_id, orderRef, resv.reservation_type,
           releasedQty, bal,
           `Released ${releasedQty} back to stock from ${resv.reservation_type} ${orderRef}`, actor]
        );
      }
      if (wastageQty > 0) {
        await client.query(
          `INSERT INTO stock_ledger (item_id, transaction_type, reference_number, reference_type, in_quantity, out_quantity, balance_quantity, remarks, created_by)
           VALUES ($1,'wastage',$2,$3,0,$4,$5,$6,$7)`,
          [resv.inventory_id, orderRef, resv.reservation_type,
           wastageQty, bal,
           `Wastage ${wastageQty} from ${resv.reservation_type} ${orderRef}`, actor]
        );
      }

      await client.query("COMMIT");
      res.json({ success: true, consumedQty, releasedQty, wastageQty });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to convert reservation" });
  }
});

router.delete("/inventory/reservations/:id", requireAuth, async (req, res) => {
  const auth = req as AuthRequest;
  if ((auth.user as any)?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  try {
    const { id } = req.params;
    const r = await pool.query(`SELECT * FROM material_reservations WHERE id = $1`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    const resv = r.rows[0];

    const client = await (pool as any).connect();
    try {
      await client.query("BEGIN");
      if (resv.status === "Active") {
        const col = resv.reservation_type === "Style" ? "style_reserved_qty" : "swatch_reserved_qty";
        await client.query(
          `UPDATE inventory_items SET ${col} = GREATEST(0, ${col}::numeric - $1) WHERE id = $2`,
          [resv.reserved_quantity, resv.inventory_id]
        );
        await recalcAvailable(client, resv.inventory_id);
      }
      await client.query(`DELETE FROM material_reservations WHERE id = $1`, [id]);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to delete reservation" });
  }
});

// ─── STOCK ADJUSTMENTS ──────────────────────────────────────────────────────

const LOSS_TYPES = new Set(["Damage", "Loss", "Audit Correction"]);

router.get("/inventory/adjustments/summary", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN adjustment_type='Damage'           AND adjustment_direction='Decrease' AND adjustment_date >= date_trunc('month', CURRENT_DATE)::text THEN revenue_loss_amount::numeric ELSE 0 END),0)::text AS damage_loss_month,
        COALESCE(SUM(CASE WHEN adjustment_type='Loss'             AND adjustment_direction='Decrease' AND adjustment_date >= date_trunc('month', CURRENT_DATE)::text THEN revenue_loss_amount::numeric ELSE 0 END),0)::text AS loss_amount_month,
        COUNT(CASE WHEN adjustment_type='Damage'           AND adjustment_date >= date_trunc('month', CURRENT_DATE)::text THEN 1 END)::int AS damage_count_month,
        COUNT(CASE WHEN adjustment_type='Loss'             AND adjustment_date >= date_trunc('month', CURRENT_DATE)::text THEN 1 END)::int AS loss_count_month,
        COUNT(CASE WHEN adjustment_type='Audit Correction' AND adjustment_date >= date_trunc('month', CURRENT_DATE)::text THEN 1 END)::int AS audit_count_month,
        COUNT(CASE WHEN adjustment_type='Manual Correction' THEN 1 END)::int AS manual_count_total,
        COUNT(CASE WHEN adjustment_type='Opening Correction' THEN 1 END)::int AS opening_count_total,
        COALESCE(SUM(revenue_loss_amount::numeric),0)::text AS total_revenue_loss
      FROM stock_adjustments
    `);
    res.json({ data: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load adjustment summary" });
  }
});

router.get("/inventory/adjustments", requireAuth, async (req, res) => {
  try {
    const {
      search = "", adjustmentType = "all", adjustmentDirection = "all",
      referenceType = "all", adjustedBy = "", fromDate = "", toDate = "",
      minLoss = "", maxLoss = "",
      page = "1", limit = "20", sort = "newest",
    } = req.query as Record<string, string>;

    const conditions: string[] = ["1=1"];
    const params: (string | number)[] = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(ii.item_name ILIKE $${params.length} OR ii.item_code ILIKE $${params.length} OR sa.reason ILIKE $${params.length})`);
    }
    if (adjustmentType !== "all") { params.push(adjustmentType); conditions.push(`sa.adjustment_type = $${params.length}`); }
    if (adjustmentDirection !== "all") { params.push(adjustmentDirection); conditions.push(`sa.adjustment_direction = $${params.length}`); }
    if (referenceType !== "all") { params.push(referenceType); conditions.push(`sa.reference_type = $${params.length}`); }
    if (adjustedBy) { params.push(`%${adjustedBy}%`); conditions.push(`sa.adjusted_by ILIKE $${params.length}`); }
    if (fromDate) { params.push(fromDate); conditions.push(`sa.adjustment_date >= $${params.length}`); }
    if (toDate)   { params.push(toDate);   conditions.push(`sa.adjustment_date <= $${params.length}`); }
    if (minLoss)  { params.push(minLoss);  conditions.push(`sa.revenue_loss_amount::numeric >= $${params.length}`); }
    if (maxLoss)  { params.push(maxLoss);  conditions.push(`sa.revenue_loss_amount::numeric <= $${params.length}`); }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const orderBy = sort === "oldest" ? "sa.created_at ASC" : "sa.created_at DESC";
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const [rows, total] = await Promise.all([
      pool.query(
        `SELECT sa.*, ii.item_name, ii.item_code, ii.unit_type
         FROM stock_adjustments sa
         JOIN inventory_items ii ON ii.id = sa.inventory_id
         ${where} ORDER BY ${orderBy}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limitNum, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM stock_adjustments sa JOIN inventory_items ii ON ii.id = sa.inventory_id ${where}`,
        params
      ),
    ]);

    res.json({ data: rows.rows, total: parseInt(total.rows[0].count), page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load adjustments" });
  }
});

router.post("/inventory/adjustments", requireAuth, async (req: AuthRequest, res) => {
  const auth = req;
  const actor = auth.user?.name || auth.user?.email || "System";
  try {
    const {
      inventoryId, adjustmentType, adjustmentDirection, adjustmentQuantity,
      referenceType = "Manual", referenceId, reason, remarks, adjustmentDate,
    } = req.body as {
      inventoryId: number; adjustmentType: string; adjustmentDirection: string;
      adjustmentQuantity: number; referenceType?: string; referenceId?: string;
      reason?: string; remarks?: string; adjustmentDate: string;
    };

    const qty = Number(adjustmentQuantity);
    if (!qty || qty <= 0) return res.status(400).json({ error: "Adjustment quantity must be positive" });

    const itemR = await pool.query(
      `SELECT id, item_code, current_stock, available_stock, average_price, style_reserved_qty, swatch_reserved_qty, unit_type, source_id
       FROM inventory_items WHERE id = $1 AND is_active = true`, [inventoryId]);
    if (!itemR.rows.length) return res.status(404).json({ error: "Inventory item not found" });
    const item = itemR.rows[0];

    if (adjustmentDirection === "Decrease") {
      const available = parseFloat(item.available_stock);
      if (qty > available) {
        return res.status(400).json({
          error: `Cannot reduce stock below reserved quantity. Available: ${available.toFixed(3)}, Requested: ${qty.toFixed(3)}`
        });
      }
    }

    const avgPrice = parseFloat(item.average_price) || 0;
    const revenueLoss = (adjustmentDirection === "Decrease" && LOSS_TYPES.has(adjustmentType))
      ? qty * avgPrice : 0;

    const client = await (pool as any).connect();
    try {
      await client.query("BEGIN");

      const stockDelta = adjustmentDirection === "Increase" ? qty : -qty;
      const newStock = parseFloat(item.current_stock) + stockDelta;
      const newAvailable = newStock - parseFloat(item.style_reserved_qty) - parseFloat(item.swatch_reserved_qty);

      await client.query(
        `UPDATE inventory_items
         SET current_stock = $1, available_stock = GREATEST(0, $2), last_updated_at = NOW()
         WHERE id = $3`,
        [newStock, newAvailable, inventoryId]
      );

      const adjR = await client.query(
        `INSERT INTO stock_adjustments
           (item_id, inventory_id, adjustment_type, adjustment_direction, adjustment_quantity,
            unit, average_price_at_adjustment, revenue_loss_amount,
            reference_type, reference_id, reason, remarks, adjusted_by, adjustment_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id`,
        [item.source_id, inventoryId, adjustmentType, adjustmentDirection, qty,
         item.unit_type, avgPrice, revenueLoss,
         referenceType, referenceId || null, reason || null, remarks || null,
         actor, adjustmentDate]
      );
      const adjId = adjR.rows[0].id;

      const inQty  = adjustmentDirection === "Increase" ? qty : 0;
      const outQty = adjustmentDirection === "Decrease" ? qty : 0;
      await client.query(
        `INSERT INTO stock_ledger
           (item_id, transaction_type, reference_number, reference_type, in_quantity, out_quantity, balance_quantity, remarks, created_by)
         VALUES ($1,'adjustment',$2,$3,$4,$5,$6,$7,$8)`,
        [inventoryId, String(adjId), adjustmentType,
         inQty, outQty, newStock,
         `${adjustmentType} adjustment (${adjustmentDirection}) — ${reason || remarks || ""}`,
         actor]
      );

      await client.query("COMMIT");
      res.json({ data: { id: adjId, revenueLoss }, message: "Stock adjustment applied successfully and inventory updated" });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to save adjustment" });
  }
});

router.put("/inventory/adjustments/:id", requireAuth, async (req: AuthRequest, res) => {
  const auth = req;
  const actor = auth.user?.name || auth.user?.email || "System";
  try {
    const { id } = req.params;
    const {
      adjustmentType, adjustmentDirection, adjustmentQuantity,
      referenceType, referenceId, reason, remarks, adjustmentDate,
    } = req.body as {
      adjustmentType: string; adjustmentDirection: string; adjustmentQuantity: number;
      referenceType?: string; referenceId?: string; reason?: string; remarks?: string; adjustmentDate: string;
    };

    const adjR = await pool.query(`SELECT * FROM stock_adjustments WHERE id = $1`, [id]);
    if (!adjR.rows.length) return res.status(404).json({ error: "Adjustment not found" });
    const old = adjR.rows[0];

    const itemR = await pool.query(
      `SELECT id, current_stock, available_stock, average_price, style_reserved_qty, swatch_reserved_qty, unit_type, source_id
       FROM inventory_items WHERE id = $1`, [old.inventory_id]);
    if (!itemR.rows.length) return res.status(404).json({ error: "Inventory item not found" });
    const item = itemR.rows[0];

    const oldDelta = old.adjustment_direction === "Increase" ? parseFloat(old.adjustment_quantity) : -parseFloat(old.adjustment_quantity);
    const stockAfterReversal = parseFloat(item.current_stock) - oldDelta;

    const newQty = Number(adjustmentQuantity);
    if (!newQty || newQty <= 0) return res.status(400).json({ error: "Adjustment quantity must be positive" });
    const newDelta = adjustmentDirection === "Increase" ? newQty : -newQty;
    const newStock = stockAfterReversal + newDelta;
    const newAvailable = newStock - parseFloat(item.style_reserved_qty) - parseFloat(item.swatch_reserved_qty);

    if (adjustmentDirection === "Decrease") {
      const availAfterReversal = stockAfterReversal - parseFloat(item.style_reserved_qty) - parseFloat(item.swatch_reserved_qty);
      if (newQty > availAfterReversal) {
        return res.status(400).json({
          error: `Cannot reduce stock below reserved quantity. Available after reversal: ${availAfterReversal.toFixed(3)}`
        });
      }
    }

    const avgPrice = parseFloat(item.average_price) || 0;
    const revenueLoss = (adjustmentDirection === "Decrease" && LOSS_TYPES.has(adjustmentType))
      ? newQty * avgPrice : 0;

    const client = await (pool as any).connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE inventory_items SET current_stock = $1, available_stock = GREATEST(0, $2), last_updated_at = NOW() WHERE id = $3`,
        [newStock, newAvailable, old.inventory_id]
      );

      await client.query(
        `UPDATE stock_adjustments
         SET adjustment_type=$1, adjustment_direction=$2, adjustment_quantity=$3,
             average_price_at_adjustment=$4, revenue_loss_amount=$5,
             reference_type=COALESCE($6, reference_type), reference_id=$7,
             reason=$8, remarks=$9, adjustment_date=$10, updated_at=NOW()
         WHERE id=$11`,
        [adjustmentType, adjustmentDirection, newQty,
         avgPrice, revenueLoss,
         referenceType || null, referenceId || null,
         reason || null, remarks || null, adjustmentDate, id]
      );

      await client.query(
        `UPDATE stock_ledger
         SET transaction_type='adjustment', reference_type=$1,
             in_quantity=$2, out_quantity=$3, balance_quantity=$4,
             remarks=$5
         WHERE reference_number=$6 AND transaction_type='adjustment'`,
        [adjustmentType,
         adjustmentDirection === "Increase" ? newQty : 0,
         adjustmentDirection === "Decrease" ? newQty : 0,
         newStock,
         `${adjustmentType} adjustment (${adjustmentDirection}) — ${reason || remarks || ""}`,
         String(id)]
      );

      await client.query("COMMIT");
      res.json({ data: { revenueLoss }, message: "Adjustment updated successfully" });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to update adjustment" });
  }
});

router.delete("/inventory/adjustments/:id", requireAuth, async (req: AuthRequest, res) => {
  const auth = req;
  if ((auth.user as any)?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  try {
    const { id } = req.params;
    const adjR = await pool.query(`SELECT * FROM stock_adjustments WHERE id = $1`, [id]);
    if (!adjR.rows.length) return res.status(404).json({ error: "Adjustment not found" });
    const old = adjR.rows[0];

    const itemR = await pool.query(
      `SELECT current_stock, style_reserved_qty, swatch_reserved_qty FROM inventory_items WHERE id = $1`,
      [old.inventory_id]);
    if (!itemR.rows.length) return res.status(404).json({ error: "Inventory item not found" });
    const item = itemR.rows[0];

    const reversalDelta = old.adjustment_direction === "Increase"
      ? -parseFloat(old.adjustment_quantity) : parseFloat(old.adjustment_quantity);
    const newStock = parseFloat(item.current_stock) + reversalDelta;
    const newAvailable = newStock - parseFloat(item.style_reserved_qty) - parseFloat(item.swatch_reserved_qty);

    const client = await (pool as any).connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE inventory_items SET current_stock=$1, available_stock=GREATEST(0,$2), last_updated_at=NOW() WHERE id=$3`,
        [newStock, newAvailable, old.inventory_id]
      );
      await client.query(`DELETE FROM stock_ledger WHERE reference_number=$1 AND transaction_type='adjustment'`, [String(id)]);
      await client.query(`DELETE FROM stock_adjustments WHERE id=$1`, [id]);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to delete adjustment" });
  }
});

router.get("/inventory/dashboard", requireAuth, async (req, res) => {
  try {
    const { dateFrom, dateTo, category = "all", department = "all" } = req.query as Record<string, string>;

    const now = new Date();
    const dfrom = dateFrom || new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10);
    const dto   = dateTo   || now.toISOString().slice(0, 10);

    const VALID_CATS  = ["fabric", "material", "packaging"];
    const safeCategory   = VALID_CATS.includes(category)   ? category   : null;
    const safeDepartment = department !== "all" && /^[\w\s-]+$/.test(department) ? department : null;

    const itemWhere   = [
      "is_active = true",
      safeCategory   ? "source_type = $1" : null,
      safeDepartment ? `department = $${safeCategory ? 2 : 1}` : null,
    ].filter(Boolean).join(" AND ");
    const itemParams: string[] = [safeCategory, safeDepartment].filter(Boolean) as string[];

    const [summary, reservations, procurement] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                                                                AS total_items,
          COUNT(*) FILTER (WHERE current_stock::numeric <= 0)                                    AS out_of_stock,
          COUNT(*) FILTER (WHERE current_stock::numeric > 0 AND reorder_level::numeric > 0
            AND current_stock::numeric <= reorder_level::numeric)                                AS low_stock,
          COUNT(*) FILTER (WHERE current_stock::numeric > 0
            AND (reorder_level::numeric = 0 OR current_stock::numeric > reorder_level::numeric)) AS in_stock,
          COALESCE(SUM(available_stock::numeric * average_price::numeric), 0)                    AS total_stock_value,
          COUNT(*) FILTER (WHERE source_type = 'fabric')                                         AS fabric_count,
          COUNT(*) FILTER (WHERE source_type = 'material')                                       AS material_count,
          COUNT(*) FILTER (WHERE source_type = 'packaging')                                      AS packaging_count
        FROM inventory_items WHERE ${itemWhere}
      `, itemParams),
      pool.query(`
        SELECT
          COALESCE(SUM(swatch_reserved_qty::numeric), 0) AS total_swatch_reserved,
          COALESCE(SUM(style_reserved_qty::numeric),  0) AS total_style_reserved,
          COALESCE(SUM(available_stock::numeric),      0) AS total_available
        FROM inventory_items WHERE ${itemWhere}
      `, itemParams),
      pool.query(`
        SELECT
          (SELECT COUNT(DISTINCT po.id) FROM purchase_orders po WHERE po.status NOT IN ('Cancelled','Closed'))                 AS active_pos,
          (SELECT COUNT(DISTINCT poi.id) FROM purchase_order_items poi JOIN purchase_orders po ON po.id = poi.po_id
            WHERE po.status NOT IN ('Cancelled','Closed'))                                                                      AS active_po_items,
          (SELECT COALESCE(SUM(poi.ordered_quantity - poi.received_quantity),0) FROM purchase_order_items poi
            JOIN purchase_orders po ON po.id = poi.po_id WHERE po.status NOT IN ('Cancelled','Closed'))                        AS pending_qty,
          (SELECT COUNT(DISTINCT pr.id) FROM purchase_receipts pr)                                                             AS total_receipts
      `),
    ]);

    const ledgerCatClause  = safeCategory   ? "AND ii.source_type = $3" : "";
    const ledgerDeptClause = safeDepartment ? `AND ii.department = $${safeCategory ? 4 : 3}` : "";
    const ledgerParams = [dfrom, dto, safeCategory, safeDepartment].filter(Boolean) as string[];

    const [stockTrend, topConsumed, totalConsumedR] = await Promise.all([
      pool.query(`
        SELECT
          to_char(date_trunc('week', sl.created_at), 'DD Mon') AS period,
          COALESCE(SUM(CASE WHEN sl.transaction_type IN ('purchase_receipt','adjustment_in') THEN sl.in_quantity  ELSE 0 END), 0) AS added,
          COALESCE(SUM(CASE WHEN sl.transaction_type ILIKE '%consumption%' THEN sl.out_quantity ELSE 0 END), 0)                   AS consumed,
          COALESCE(SUM(CASE WHEN sl.transaction_type ILIKE '%wastage%' THEN sl.out_quantity ELSE 0 END), 0)                       AS wasted
        FROM stock_ledger sl
        JOIN inventory_items ii ON ii.id = sl.item_id
        WHERE sl.created_at BETWEEN $1 AND $2::date + interval '1 day'
          ${ledgerCatClause} ${ledgerDeptClause}
        GROUP BY date_trunc('week', sl.created_at)
        ORDER BY date_trunc('week', sl.created_at)
        LIMIT 16
      `, ledgerParams),
      pool.query(`
        SELECT ii.item_name, ii.unit_type, ii.department,
               COALESCE(SUM(sl.out_quantity), 0) AS total_consumed
        FROM stock_ledger sl
        JOIN inventory_items ii ON ii.id = sl.item_id
        WHERE sl.transaction_type ILIKE '%consumption%'
          AND sl.created_at BETWEEN $1 AND $2::date + interval '1 day'
          ${ledgerCatClause} ${ledgerDeptClause}
        GROUP BY ii.id, ii.item_name, ii.unit_type, ii.department
        ORDER BY total_consumed DESC
        LIMIT 5
      `, ledgerParams),
      pool.query(`
        SELECT COALESCE(SUM(sl.out_quantity), 0) AS total
        FROM stock_ledger sl
        JOIN inventory_items ii ON ii.id = sl.item_id
        WHERE sl.transaction_type ILIKE '%consumption%'
          AND sl.created_at BETWEEN $1 AND $2::date + interval '1 day'
          ${ledgerCatClause} ${ledgerDeptClause}
      `, ledgerParams),
    ]);

    res.json({
      summary:       summary.rows[0],
      reservations:  reservations.rows[0],
      procurement:   procurement.rows[0],
      totalConsumed: parseFloat(totalConsumedR.rows[0]?.total ?? "0"),
      topConsumed:   topConsumed.rows,
      stockTrend:    stockTrend.rows,
    });
  } catch (err) {
    console.error("[dashboard]", err);
    res.status(500).json({ error: "Failed to load inventory dashboard" });
  }
});

router.get("/inventory/low-stock-alerts", requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, item_name, item_code, current_stock, available_stock,
             reorder_level, minimum_level, maximum_level, unit_type, source_type,
             average_price, images
      FROM inventory_items
      WHERE is_active = true
        AND (
          current_stock::numeric <= 0
          OR (reorder_level::numeric > 0 AND current_stock::numeric <= reorder_level::numeric)
        )
      ORDER BY
        CASE WHEN current_stock::numeric <= 0 THEN 0 ELSE 1 END ASC,
        item_name ASC
      LIMIT 20
    `);
    res.json({ data: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch low-stock alerts" });
  }
});

export default router;
