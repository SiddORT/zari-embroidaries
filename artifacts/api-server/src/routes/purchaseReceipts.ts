import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { AuthRequest } from "../middlewares/requireAuth";

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

async function generatePrNumber(client: typeof pool): Promise<string> {
  const today = new Date();
  const ymd = today.toISOString().slice(0, 10).replace(/-/g, "");
  const r = await client.query(
    `SELECT COUNT(*) FROM inv_receipts WHERE pr_number LIKE $1`,
    [`PR-${ymd}-%`]
  );
  const seq = (parseInt(r.rows[0].count) + 1).toString().padStart(4, "0");
  return `PR-${ymd}-${seq}`;
}

async function applyInventoryUpdate(
  client: { query: typeof pool.query },
  prId: number,
  prNumber: string,
  items: Array<{ inventory_item_id: number; quantity: number; unit_price: number; warehouse_location?: string; remarks?: string }>,
  userName: string
) {
  for (const item of items) {
    const inv = await client.query(
      `SELECT id, item_name, item_code, current_stock, average_price, style_reserved_qty, swatch_reserved_qty
       FROM inventory_items WHERE id = $1`,
      [item.inventory_item_id]
    );
    if (!inv.rows.length) throw new Error(`Inventory item ${item.inventory_item_id} not found`);
    const row = inv.rows[0];

    const prevStock = parseFloat(row.current_stock ?? "0");
    const prevAvg   = parseFloat(row.average_price ?? "0");
    const newStock  = prevStock + item.quantity;

    const newAvg = newStock > 0
      ? ((prevStock * prevAvg) + (item.quantity * item.unit_price)) / newStock
      : item.unit_price;

    const styleRes  = parseFloat(row.style_reserved_qty ?? "0");
    const swatchRes = parseFloat(row.swatch_reserved_qty ?? "0");
    const newAvail  = Math.max(0, newStock - styleRes - swatchRes);

    await client.query(
      `UPDATE inventory_items SET
         current_stock       = $1,
         available_stock     = $2,
         average_price       = $3,
         last_purchase_price = $4,
         last_updated_at     = NOW()
       WHERE id = $5`,
      [newStock.toFixed(3), newAvail.toFixed(3), newAvg.toFixed(2), item.unit_price.toFixed(2), item.inventory_item_id]
    );

    await client.query(
      `INSERT INTO stock_ledger
         (item_id, transaction_type, reference_number, reference_type, in_quantity, out_quantity, balance_quantity, remarks, created_by, created_at)
       VALUES ($1,'purchase_receipt',$2,'PR',$3,0,$4,$5,$6,NOW())`,
      [
        item.inventory_item_id,
        prNumber,
        item.quantity.toFixed(3),
        newStock.toFixed(3),
        item.remarks ? `PR ${prNumber}: ${item.remarks}` : `Purchase Receipt ${prNumber}`,
        userName,
      ]
    );

    await client.query(
      `INSERT INTO inventory_stock_logs
         (inventory_item_id, action_type, quantity_before, quantity_after, quantity_delta, reference_type, reference_id, notes, created_by_name, created_at)
       VALUES ($1,'receipt',$2,$3,$4,'PR',$5,$6,$7,NOW())`,
      [item.inventory_item_id, prevStock.toFixed(3), newStock.toFixed(3), item.quantity.toFixed(3), prId,
       `PR ${prNumber}`, userName]
    ).catch(e => console.error("[StockLog] PR log failed:", e));
  }
}

async function reverseInventoryUpdate(
  client: { query: typeof pool.query },
  prId: number,
  prNumber: string,
  userName: string
) {
  const itemsRes = await client.query(
    `SELECT inventory_item_id, quantity::numeric AS qty, unit_price::numeric AS price FROM inv_receipt_items WHERE pr_id = $1`,
    [prId]
  );
  for (const item of itemsRes.rows) {
    const qty = parseFloat(item.qty);
    const inv = await client.query(
      `SELECT id, current_stock, average_price, style_reserved_qty, swatch_reserved_qty FROM inventory_items WHERE id = $1`,
      [item.inventory_item_id]
    );
    if (!inv.rows.length) continue;
    const row = inv.rows[0];
    const prevStock = parseFloat(row.current_stock ?? "0");
    const newStock  = Math.max(0, prevStock - qty);
    const styleRes  = parseFloat(row.style_reserved_qty ?? "0");
    const swatchRes = parseFloat(row.swatch_reserved_qty ?? "0");
    const newAvail  = Math.max(0, newStock - styleRes - swatchRes);

    await client.query(
      `UPDATE inventory_items SET current_stock = $1, available_stock = $2, last_updated_at = NOW() WHERE id = $3`,
      [newStock.toFixed(3), newAvail.toFixed(3), item.inventory_item_id]
    );

    await client.query(
      `INSERT INTO stock_ledger
         (item_id, transaction_type, reference_number, reference_type, in_quantity, out_quantity, balance_quantity, remarks, created_by, created_at)
       VALUES ($1,'reservation_release',$2,'PR',0,$3,$4,$5,$6,NOW())`,
      [item.inventory_item_id, prNumber, qty.toFixed(3), newStock.toFixed(3),
       `PR ${prNumber} cancelled / reversed`, userName]
    );

    await client.query(
      `DELETE FROM stock_ledger WHERE reference_number = $1 AND item_id = $2 AND transaction_type = 'purchase_receipt'`,
      [prNumber, item.inventory_item_id]
    );
  }
}

// ── LIST ─────────────────────────────────────────────────────────────────────

router.get("/purchase-receipts", requireAuth, async (req, res) => {
  try {
    const {
      search = "", status = "all",
      fromDate = "", toDate = "",
      page = "1", limit = "10", sort = "newest",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    // Build outer WHERE conditions on the combined CTE
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(c.pr_number ILIKE $${params.length} OR c.vendor_name ILIKE $${params.length})`);
    }
    if (status !== "all") {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }
    if (fromDate) { params.push(fromDate); conditions.push(`c.pr_date >= $${params.length}`); }
    if (toDate)   { params.push(toDate);   conditions.push(`c.pr_date <= $${params.length}`); }

    const outerWhere = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderBy = sort === "oldest" ? "c.created_at ASC" : "c.created_at DESC";

    // UNION of standalone inventory PRs and costing/PO-linked PRs
    const cte = `
      WITH combined AS (
        SELECT
          ir.id,
          ir.pr_number,
          COALESCE(ir.vendor_name, '') AS vendor_name,
          ir.pr_date::text AS pr_date,
          ir.status,
          ir.total_amount::numeric AS total_amount,
          (SELECT COUNT(*) FROM inv_receipt_items WHERE pr_id = ir.id)::int AS item_count,
          ir.created_by,
          ir.created_at,
          'inventory' AS source,
          NULL::integer AS po_id,
          NULL::integer AS swatch_order_id,
          NULL::integer AS style_order_id
        FROM inv_receipts ir
        WHERE ir.is_deleted = false

        UNION ALL

        SELECT
          pr.id,
          pr.pr_number,
          COALESCE(pr.vendor_name, '') AS vendor_name,
          (pr.received_date AT TIME ZONE 'UTC')::date::text AS pr_date,
          CASE pr.status
            WHEN 'Open'      THEN 'draft'
            WHEN 'Received'  THEN 'confirmed'
            WHEN 'Cancelled' THEN 'cancelled'
            ELSE LOWER(pr.status)
          END AS status,
          CASE
            WHEN pr.received_qty  ~ E'^[0-9]+(\\\\.[0-9]+)?$'
             AND pr.actual_price  ~ E'^[0-9]+(\\\\.[0-9]+)?$'
            THEN pr.received_qty::numeric * pr.actual_price::numeric
            ELSE 0
          END AS total_amount,
          1 AS item_count,
          pr.created_by,
          pr.created_at,
          'costing' AS source,
          pr.po_id,
          pr.swatch_order_id,
          pr.style_order_id
        FROM purchase_receipts pr
      )`;

    const [rows, totalRes] = await Promise.all([
      pool.query(
        `${cte} SELECT c.* FROM combined c ${outerWhere} ORDER BY ${orderBy}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limitNum, offset]
      ),
      pool.query(`${cte} SELECT COUNT(*) FROM combined c ${outerWhere}`, params),
    ]);

    res.json({ data: rows.rows, total: parseInt(totalRes.rows[0].count), page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load purchase receipts" });
  }
});

// ── GET SINGLE ───────────────────────────────────────────────────────────────

router.get("/purchase-receipts/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [prRes, itemsRes] = await Promise.all([
      pool.query(`SELECT * FROM inv_receipts WHERE id = $1 AND is_deleted = false`, [id]),
      pool.query(
        `SELECT pri.*, ii.unit_type, ii.warehouse_location AS default_location, ii.available_stock
         FROM inv_receipt_items pri
         JOIN inventory_items ii ON ii.id = pri.inventory_item_id
         WHERE pri.pr_id = $1 ORDER BY pri.id`,
        [id]
      ),
    ]);
    if (!prRes.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ ...prRes.rows[0], items: itemsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load purchase receipt" });
  }
});

// ── CREATE ───────────────────────────────────────────────────────────────────

router.post("/purchase-receipts", requireAuth, async (req: AuthRequest, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");

    const userName = (req.user as { name?: string; email?: string } | undefined)?.name
      || (req.user as { name?: string; email?: string } | undefined)?.email
      || "Admin";

    const { vendorId, vendorName, prDate, remarks, items = [], confirmNow = false } = req.body;

    if (!prDate) return res.status(400).json({ error: "PR date is required" });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "At least one item is required" });

    for (const it of items) {
      if (!it.inventoryItemId) return res.status(400).json({ error: "Each item must have an inventory item selected" });
      if (!it.quantity || parseFloat(it.quantity) <= 0) return res.status(400).json({ error: "Each item must have a positive quantity" });
    }

    const prNumber = await generatePrNumber(client);
    const totalAmount = items.reduce((sum: number, it: { quantity: string; unitPrice: string }) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);

    const prRes = await client.query(
      `INSERT INTO inv_receipts (pr_number, vendor_id, vendor_name, pr_date, status, total_amount, remarks, created_by)
       VALUES ($1,$2,$3,$4,'draft',$5,$6,$7) RETURNING *`,
      [prNumber, vendorId ?? null, vendorName ?? null, prDate, totalAmount.toFixed(2), remarks ?? null, userName]
    );
    const pr = prRes.rows[0];

    for (const it of items) {
      await client.query(
        `INSERT INTO inv_receipt_items (pr_id, inventory_item_id, item_name, item_code, quantity, unit_price, warehouse_location, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [pr.id, it.inventoryItemId, it.itemName, it.itemCode,
         parseFloat(it.quantity).toFixed(3), parseFloat(it.unitPrice || 0).toFixed(2),
         it.warehouseLocation ?? null, it.remarks ?? null]
      );
    }

    if (confirmNow) {
      const mappedItems = items.map((it: { inventoryItemId: number; quantity: string; unitPrice: string; warehouseLocation?: string; remarks?: string }) => ({
        inventory_item_id: it.inventoryItemId,
        quantity: parseFloat(it.quantity),
        unit_price: parseFloat(it.unitPrice || "0"),
        warehouse_location: it.warehouseLocation,
        remarks: it.remarks,
      }));
      await applyInventoryUpdate(client, pr.id, prNumber, mappedItems, userName);
      await client.query(`UPDATE inv_receipts SET status = 'confirmed', updated_at = NOW() WHERE id = $1`, [pr.id]);
      pr.status = "confirmed";
    }

    await client.query("COMMIT");
    res.status(201).json({ ...pr, message: confirmNow ? "Purchase Receipt confirmed. Inventory updated successfully." : "Purchase Receipt saved as draft." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: (err as Error).message ?? "Failed to create purchase receipt" });
  } finally {
    client.release();
  }
});

// ── UPDATE (draft only) ───────────────────────────────────────────────────────

router.put("/purchase-receipts/:id", requireAuth, async (req: AuthRequest, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const id = parseInt(String(req.params.id));
    const prRes = await client.query(`SELECT * FROM inv_receipts WHERE id = $1 AND is_deleted = false`, [id]);
    if (!prRes.rows.length) return res.status(404).json({ error: "Not found" });

    const pr = prRes.rows[0];
    if (pr.status === "confirmed") return res.status(422).json({ error: "Confirmed PRs cannot be edited. Cancel it first." });

    const { vendorId, vendorName, prDate, remarks, items = [] } = req.body;

    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "At least one item is required" });

    const totalAmount = items.reduce((sum: number, it: { quantity: string; unitPrice: string }) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);

    await client.query(
      `UPDATE inv_receipts SET vendor_id=$1, vendor_name=$2, pr_date=$3, remarks=$4, total_amount=$5, updated_at=NOW() WHERE id=$6`,
      [vendorId ?? null, vendorName ?? null, prDate ?? pr.pr_date, remarks ?? null, totalAmount.toFixed(2), id]
    );

    await client.query(`DELETE FROM inv_receipt_items WHERE pr_id = $1`, [id]);
    for (const it of items) {
      await client.query(
        `INSERT INTO inv_receipt_items (pr_id, inventory_item_id, item_name, item_code, quantity, unit_price, warehouse_location, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, it.inventoryItemId, it.itemName, it.itemCode,
         parseFloat(it.quantity).toFixed(3), parseFloat(it.unitPrice || 0).toFixed(2),
         it.warehouseLocation ?? null, it.remarks ?? null]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Purchase Receipt updated successfully." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to update purchase receipt" });
  } finally {
    client.release();
  }
});

// ── CONFIRM ──────────────────────────────────────────────────────────────────

router.post("/purchase-receipts/:id/confirm", requireAuth, async (req: AuthRequest, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const id = parseInt(String(req.params.id));
    const prRes = await client.query(`SELECT * FROM inv_receipts WHERE id = $1 AND is_deleted = false`, [id]);
    if (!prRes.rows.length) return res.status(404).json({ error: "Not found" });

    const pr = prRes.rows[0];
    if (pr.status !== "draft") return res.status(422).json({ error: `PR is already ${pr.status}` });

    const itemsRes = await client.query(
      `SELECT inventory_item_id, quantity::numeric AS qty, unit_price::numeric AS price, warehouse_location, remarks FROM inv_receipt_items WHERE pr_id = $1`,
      [id]
    );
    if (!itemsRes.rows.length) return res.status(422).json({ error: "No items found on this PR" });

    const userName = (req.user as { name?: string; email?: string } | undefined)?.name
      || (req.user as { name?: string; email?: string } | undefined)?.email
      || "Admin";

    const mappedItems = itemsRes.rows.map((r: { inventory_item_id: number; qty: string; price: string; warehouse_location?: string; remarks?: string }) => ({
      inventory_item_id: r.inventory_item_id,
      quantity: parseFloat(r.qty),
      unit_price: parseFloat(r.price),
      warehouse_location: r.warehouse_location,
      remarks: r.remarks,
    }));

    await applyInventoryUpdate(client, id, pr.pr_number, mappedItems, userName);
    await client.query(`UPDATE inv_receipts SET status = 'confirmed', updated_at = NOW() WHERE id = $1`, [id]);

    await client.query("COMMIT");
    res.json({ message: "Purchase Receipt confirmed. Inventory updated successfully." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: (err as Error).message ?? "Failed to confirm purchase receipt" });
  } finally {
    client.release();
  }
});

// ── CANCEL ───────────────────────────────────────────────────────────────────

router.post("/purchase-receipts/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const id = parseInt(String(req.params.id));
    const prRes = await client.query(`SELECT * FROM inv_receipts WHERE id = $1 AND is_deleted = false`, [id]);
    if (!prRes.rows.length) return res.status(404).json({ error: "Not found" });

    const pr = prRes.rows[0];
    if (pr.status === "cancelled") return res.status(422).json({ error: "PR is already cancelled" });

    const userName = (req.user as { name?: string; email?: string } | undefined)?.name
      || (req.user as { name?: string; email?: string } | undefined)?.email
      || "Admin";

    if (pr.status === "confirmed") {
      await reverseInventoryUpdate(client, id, pr.pr_number, userName);
    }

    await client.query(`UPDATE inv_receipts SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);
    await client.query("COMMIT");
    res.json({ message: pr.status === "confirmed" ? "PR cancelled. Inventory changes reversed." : "PR cancelled." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to cancel purchase receipt" });
  } finally {
    client.release();
  }
});

// ── DELETE ───────────────────────────────────────────────────────────────────

router.delete("/purchase-receipts/:id", requireAuth, async (req: AuthRequest, res) => {
  const client = await (pool as any).connect();
  try {
    if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
    await client.query("BEGIN");
    const id = parseInt(String(req.params.id));
    const prRes = await client.query(`SELECT * FROM inv_receipts WHERE id = $1 AND is_deleted = false`, [id]);
    if (!prRes.rows.length) return res.status(404).json({ error: "Not found" });

    const pr = prRes.rows[0];
    const userName = (req.user as { name?: string; email?: string } | undefined)?.name
      || (req.user as { name?: string; email?: string } | undefined)?.email
      || "Admin";

    if (pr.status === "confirmed") {
      await reverseInventoryUpdate(client, id, pr.pr_number, userName);
    }

    await client.query(`UPDATE inv_receipts SET is_deleted = true, updated_at = NOW() WHERE id = $1`, [id]);
    await client.query("COMMIT");
    res.json({ deleted: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to delete purchase receipt" });
  } finally {
    client.release();
  }
});

// ── VENDOR SEARCH ─────────────────────────────────────────────────────────────

router.get("/purchase-receipts/vendors/search", requireAuth, async (req, res) => {
  try {
    const { q = "" } = req.query as Record<string, string>;
    const r = await pool.query(
      `SELECT id, vendor_code, brand_name FROM vendors WHERE (brand_name ILIKE $1 OR vendor_code ILIKE $1) AND is_deleted = false ORDER BY brand_name LIMIT 20`,
      [`%${q}%`]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to search vendors" });
  }
});

export default router;
