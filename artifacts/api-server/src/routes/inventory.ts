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
           END AS source_label
         FROM inventory_items ii
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
         END AS source_label
       FROM inventory_items ii WHERE ii.id = $1`,
      [id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to load item" });
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
    } = req.body;

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
    res.json({ message: `Synced ${result.synced} new item(s) from masters`, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sync failed" });
  }
});

export default router;
