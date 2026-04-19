import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { AuthRequest } from "../middlewares/requireAuth";

const router = Router();

// ── helpers ───────────────────────────────────────────────────────────────────

/** Returns Indian financial year string e.g. "2026-27" for any date in Apr 2026–Mar 2027 */
function financialYear(): string {
  const now = new Date();
  const yr  = now.getFullYear();
  const mo  = now.getMonth() + 1; // 1-based
  const startYr = mo >= 4 ? yr : yr - 1;
  return `${startYr}-${String(startYr + 1).slice(2)}`;
}

async function nextPoNumber(client: typeof pool): Promise<string> {
  const fy = financialYear();
  const r = await client.query(
    `SELECT COUNT(*) FROM purchase_orders WHERE po_number LIKE $1`,
    [`PO/${fy}/%`]
  );
  const seq = (parseInt(r.rows[0].count) + 1).toString().padStart(4, "0");
  return `PO/${fy}/${seq}`;
}

async function nextPrNumber(client: typeof pool): Promise<string> {
  const fy = financialYear();
  const r = await client.query(
    `SELECT COUNT(*) FROM purchase_receipts WHERE pr_number LIKE $1`,
    [`PR/${fy}/%`]
  );
  const seq = (parseInt(r.rows[0].count) + 1).toString().padStart(4, "0");
  return `PR/${fy}/${seq}`;
}

async function recalcPoStatus(client: { query: typeof pool.query }, poId: number) {
  const items = await client.query(
    `SELECT ordered_quantity, received_quantity FROM purchase_order_items WHERE po_id = $1`,
    [poId]
  );
  if (!items.rows.length) return;

  const totalOrdered  = items.rows.reduce((s: number, r: any) => s + parseFloat(r.ordered_quantity), 0);
  const totalReceived = items.rows.reduce((s: number, r: any) => s + parseFloat(r.received_quantity), 0);

  let newStatus: string;
  if (totalReceived <= 0) {
    newStatus = "Approved";
  } else if (totalReceived >= totalOrdered) {
    newStatus = "Closed";
  } else {
    newStatus = "Partially Received";
  }
  await client.query(
    `UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2 AND status NOT IN ('Draft','Cancelled')`,
    [newStatus, poId]
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PURCHASE ORDERS
// ═══════════════════════════════════════════════════════════════════════════════

// LIST
router.get("/procurement/purchase-orders", requireAuth, async (req, res) => {
  try {
    const {
      search = "", status = "all", referenceType = "all",
      page = "1", limit = "10", sort = "newest",
    } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(po.po_number ILIKE $${params.length} OR po.vendor_name ILIKE $${params.length})`);
    }
    if (status !== "all") { params.push(status); conditions.push(`po.status = $${params.length}`); }
    if (referenceType !== "all") { params.push(referenceType); conditions.push(`po.reference_type = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderBy = sort === "oldest" ? "po.created_at ASC" : "po.created_at DESC";
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const [rows, total] = await Promise.all([
      pool.query(
        `SELECT po.*,
           (SELECT COUNT(*) FROM purchase_order_items WHERE po_id = po.id)::int AS item_count,
           (SELECT COALESCE(SUM(poi.ordered_quantity),0)  FROM purchase_order_items poi WHERE poi.po_id = po.id) AS total_ordered_qty,
           (SELECT COALESCE(SUM(poi.received_quantity),0) FROM purchase_order_items poi WHERE poi.po_id = po.id) AS total_received_qty
         FROM purchase_orders po ${where} ORDER BY ${orderBy}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limitNum, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM purchase_orders po ${where}`, params),
    ]);

    res.json({ data: rows.rows, total: parseInt(total.rows[0].count), page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load purchase orders" });
  }
});

// GET SINGLE
router.get("/procurement/purchase-orders/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [poRes, itemsRes, prsRes] = await Promise.all([
      pool.query(`SELECT * FROM purchase_orders WHERE id = $1`, [id]),
      pool.query(
        `SELECT poi.*,
           ii.unit_type, ii.available_stock, ii.current_stock, ii.average_price,
           (poi.ordered_quantity - poi.received_quantity) AS pending_quantity
         FROM purchase_order_items poi
         LEFT JOIN inventory_items ii ON ii.id = poi.inventory_item_id
         WHERE poi.po_id = $1 ORDER BY poi.id`,
        [id]
      ),
      pool.query(
        `SELECT pr.id, pr.pr_number, pr.status, pr.received_date, pr.vendor_name,
           json_agg(json_build_object(
             'item_name', pri.item_name, 'item_code', pri.item_code,
             'quantity', pri.quantity, 'unit_price', pri.unit_price,
             'warehouse_location', pri.warehouse_location
           ) ORDER BY pri.id) AS items
         FROM purchase_receipts pr
         LEFT JOIN purchase_receipt_items pri ON pri.pr_id = pr.id
         WHERE pr.po_id = $1 AND pr.status != 'Cancelled'
         GROUP BY pr.id ORDER BY pr.received_date ASC`,
        [id]
      ),
    ]);
    if (!poRes.rows.length) { res.status(404).json({ error: "PO not found" }); return; }
    res.json({ ...poRes.rows[0], items: itemsRes.rows, receipts: prsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load purchase order" });
  }
});

// CREATE PO (Inventory or Manual)
router.post("/procurement/purchase-orders", requireAuth, async (req: AuthRequest, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const userName = (req.user as any)?.name || (req.user as any)?.email || "Admin";
    const {
      vendorId, vendorName, poDate, referenceType = "Manual", referenceId = null,
      notes, items = [],
    } = req.body as {
      vendorId: number;
      vendorName: string;
      poDate?: string;
      referenceType?: string;
      referenceId?: number | null;
      notes?: string;
      items: { inventoryItemId: number; itemName: string; itemCode: string; orderedQuantity: number; unitPrice: number; warehouseLocation?: string; remarks?: string }[];
    };

    if (!vendorId) { res.status(400).json({ error: "Vendor is required" }); return; }
    if (!items.length) { res.status(400).json({ error: "At least one item is required" }); return; }

    const poNumber = await nextPoNumber(client);
    const poRes = await client.query(
      `INSERT INTO purchase_orders
         (po_number, vendor_id, vendor_name, po_date, status, notes,
          reference_type, reference_id, swatch_order_id, style_order_id,
          bom_row_ids, bom_items, created_by, created_at)
       VALUES ($1,$2,$3,$4,'Draft',$5,$6,$7,$8,$9,'[]','[]',$10,NOW())
       RETURNING *`,
      [
        poNumber, vendorId, vendorName,
        poDate ? new Date(poDate).toISOString() : new Date().toISOString(),
        notes ?? null, referenceType, referenceId ?? null,
        referenceType === "Swatch" ? referenceId : null,
        referenceType === "Style"  ? referenceId : null,
        userName,
      ]
    );
    const po = poRes.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_order_items
           (po_id, inventory_item_id, item_name, item_code,
            ordered_quantity, received_quantity, unit_price, warehouse_location, remarks)
         VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8)`,
        [
          po.id, item.inventoryItemId, item.itemName, item.itemCode,
          item.orderedQuantity, item.unitPrice,
          item.warehouseLocation ?? null, item.remarks ?? null,
        ]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ data: po });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create purchase order" });
  } finally {
    client.release();
  }
});

// UPDATE PO STATUS
router.patch("/procurement/purchase-orders/:id/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const userName = (req.user as any)?.name || (req.user as any)?.email || "Admin";
    const { status, notes } = req.body as { status: string; notes?: string };

    const allowed = ["Draft", "Approved", "Cancelled"];
    if (!allowed.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }

    const updates: string[] = ["status = $1", "updated_at = NOW()", "updated_by = $2"];
    const params: (string | number)[] = [status, userName, id];

    if (status === "Approved") {
      updates.push("approved_by = $4", "approved_at = NOW()");
      params.push(userName);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${params.length + 1}`);
      params.push(notes);
    }

    const r = await pool.query(
      `UPDATE purchase_orders SET ${updates.join(", ")} WHERE id = $3 RETURNING *`,
      params
    );
    if (!r.rows.length) { res.status(404).json({ error: "PO not found" }); return; }
    res.json({ data: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update PO status" });
  }
});

// DELETE PO (admin, draft only)
router.delete("/procurement/purchase-orders/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const po = await pool.query(`SELECT status FROM purchase_orders WHERE id = $1`, [id]);
    if (!po.rows.length) { res.status(404).json({ error: "PO not found" }); return; }
    if (po.rows[0].status !== "Draft") { res.status(400).json({ error: "Only Draft POs can be deleted" }); return; }
    await pool.query(`DELETE FROM purchase_orders WHERE id = $1`, [id]);
    res.json({ message: "Purchase Order deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete purchase order" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PURCHASE RECEIPTS
// ═══════════════════════════════════════════════════════════════════════════════

// LIST (all PRs from purchase_receipts — covers both Inventory and Costing sources)
router.get("/procurement/purchase-receipts", requireAuth, async (req, res) => {
  try {
    const {
      search = "", status = "all", referenceType = "all",
      fromDate = "", toDate = "", poNumber = "",
      page = "1", limit = "10", sort = "newest",
    } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(pr.pr_number ILIKE $${params.length} OR pr.vendor_name ILIKE $${params.length} OR po.po_number ILIKE $${params.length})`);
    }
    if (poNumber) {
      params.push(`%${poNumber}%`);
      conditions.push(`po.po_number ILIKE $${params.length}`);
    }
    if (status !== "all") { params.push(status); conditions.push(`pr.status = $${params.length}`); }
    if (fromDate) { params.push(fromDate); conditions.push(`pr.received_date::date >= $${params.length}`); }
    if (toDate)   { params.push(toDate);   conditions.push(`pr.received_date::date <= $${params.length}`); }
    if (referenceType !== "all") {
      params.push(referenceType);
      conditions.push(`po.reference_type = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderBy = sort === "oldest" ? "pr.created_at ASC" : "pr.created_at DESC";
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset   = (pageNum - 1) * limitNum;

    const [rows, total] = await Promise.all([
      pool.query(
        `SELECT pr.*,
           po.po_number, po.reference_type, po.reference_id,
           po.swatch_order_id AS po_swatch_id, po.style_order_id AS po_style_id,
           (SELECT COUNT(*) FROM purchase_receipt_items WHERE pr_id = pr.id)::int AS item_count,
           (SELECT COALESCE(SUM(quantity),0) FROM purchase_receipt_items WHERE pr_id = pr.id) AS total_qty
         FROM purchase_receipts pr
         LEFT JOIN purchase_orders po ON po.id = pr.po_id
         ${where} ORDER BY ${orderBy}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limitNum, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM purchase_receipts pr LEFT JOIN purchase_orders po ON po.id = pr.po_id ${where}`,
        params
      ),
    ]);

    res.json({ data: rows.rows, total: parseInt(total.rows[0].count), page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load purchase receipts" });
  }
});

// GET SINGLE PR
router.get("/procurement/purchase-receipts/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [prRes, itemsRes] = await Promise.all([
      pool.query(
        `SELECT pr.*, po.po_number, po.reference_type, po.vendor_name AS po_vendor_name
         FROM purchase_receipts pr
         LEFT JOIN purchase_orders po ON po.id = pr.po_id
         WHERE pr.id = $1`,
        [id]
      ),
      pool.query(
        `SELECT pri.*, poi.ordered_quantity AS po_ordered_qty, poi.received_quantity AS po_received_qty,
           ii.unit_type, ii.available_stock, ii.current_stock
         FROM purchase_receipt_items pri
         LEFT JOIN purchase_order_items poi ON poi.id = pri.po_item_id
         LEFT JOIN inventory_items ii ON ii.id = pri.inventory_item_id
         WHERE pri.pr_id = $1 ORDER BY pri.id`,
        [id]
      ),
    ]);
    if (!prRes.rows.length) { res.status(404).json({ error: "PR not found" }); return; }
    res.json({ ...prRes.rows[0], items: itemsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load purchase receipt" });
  }
});

// CREATE PR (draft, linked to PO)
router.post("/procurement/purchase-receipts", requireAuth, async (req: AuthRequest, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const userName = (req.user as any)?.name || (req.user as any)?.email || "Admin";

    const { poId, receivedDate, remarks, items = [], confirmNow = false } = req.body as {
      poId: number;
      receivedDate?: string;
      remarks?: string;
      confirmNow?: boolean;
      items: { poItemId: number; inventoryItemId: number; itemName: string; itemCode: string; quantity: number; unitPrice: number; warehouseLocation?: string; remarks?: string }[];
    };

    if (!poId) { res.status(400).json({ error: "PO is required" }); return; }
    if (!items.length) { res.status(400).json({ error: "At least one item is required" }); return; }

    const poRes = await client.query(
      `SELECT po.*, v.id AS vid FROM purchase_orders po LEFT JOIN vendors v ON v.id = po.vendor_id WHERE po.id = $1`,
      [poId]
    );
    if (!poRes.rows.length) { res.status(400).json({ error: "PO not found" }); return; }
    const po = poRes.rows[0];
    if (!["Approved", "Partially Received"].includes(po.status)) {
      res.status(400).json({ error: `PO must be Approved before creating a receipt. Current status: ${po.status}` }); return;
    }

    // Validate quantities against pending on each PO item
    for (const item of items) {
      if (!item.poItemId) { res.status(400).json({ error: "Each item must reference a PO line item" }); return; }
      if (!item.quantity || item.quantity <= 0) {
        res.status(400).json({ error: `Received quantity must be greater than zero for item ${item.itemName}` }); return;
      }
      if (!item.inventoryItemId) {
        res.status(400).json({ error: `Missing inventory item reference for ${item.itemName}` }); return;
      }
      const poItem = await client.query(
        `SELECT ordered_quantity, received_quantity FROM purchase_order_items WHERE id = $1 AND po_id = $2`,
        [item.poItemId, poId]
      );
      if (!poItem.rows.length) { res.status(400).json({ error: `PO item ${item.poItemId} not found` }); return; }
      const pending = parseFloat(poItem.rows[0].ordered_quantity) - parseFloat(poItem.rows[0].received_quantity);
      if (item.quantity > pending + 0.001) {
        res.status(400).json({ error: `Received quantity (${item.quantity}) exceeds pending (${pending.toFixed(3)}) for item ${item.itemName}` }); return;
      }
    }

    const prNumber = await nextPrNumber(client);
    const status = confirmNow ? "Received" : "Open";

    // PR header
    const prRes = await client.query(
      `INSERT INTO purchase_receipts
         (pr_number, po_id, vendor_name, received_date, received_qty, actual_price,
          warehouse_location, status, swatch_order_id, style_order_id, bom_row_id,
          created_by, created_at)
       VALUES ($1,$2,$3,$4,'0','0','',$5,$6,$7,NULL,$8,NOW())
       RETURNING *`,
      [
        prNumber, poId, po.vendor_name,
        receivedDate ? new Date(receivedDate).toISOString() : new Date().toISOString(),
        status,
        po.swatch_order_id ?? null, po.style_order_id ?? null,
        userName,
      ]
    );
    const pr = prRes.rows[0];

    // PR items
    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_receipt_items
           (pr_id, po_item_id, inventory_item_id, item_name, item_code,
            quantity, unit_price, warehouse_location, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          pr.id, item.poItemId, item.inventoryItemId,
          item.itemName, item.itemCode, item.quantity, item.unitPrice,
          item.warehouseLocation ?? null, item.remarks ?? null,
        ]
      );
    }

    if (confirmNow) {
      await applyInventoryUpdate(client, pr.id, prNumber, items, userName);
      // Update po_item received quantities
      for (const item of items) {
        await client.query(
          `UPDATE purchase_order_items SET received_quantity = received_quantity + $1, updated_at = NOW() WHERE id = $2`,
          [item.quantity, item.poItemId]
        );
      }
      await recalcPoStatus(client, poId);
    }

    await client.query("COMMIT");
    res.status(201).json({ data: { ...pr, pr_number: prNumber } });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create purchase receipt" });
  } finally {
    client.release();
  }
});

// CONFIRM PR
router.post("/procurement/purchase-receipts/:id/confirm", requireAuth, async (req: AuthRequest, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const userName = (req.user as any)?.name || (req.user as any)?.email || "Admin";
    const id = parseInt(req.params.id);

    const prRes = await client.query(`SELECT * FROM purchase_receipts WHERE id = $1`, [id]);
    if (!prRes.rows.length) { res.status(404).json({ error: "PR not found" }); return; }
    const pr = prRes.rows[0];
    if (pr.status !== "Open") {
      res.status(400).json({ error: `Cannot confirm a PR with status "${pr.status}"` }); return;
    }

    const itemsRes = await client.query(
      `SELECT * FROM purchase_receipt_items WHERE pr_id = $1`,
      [id]
    );
    const items = itemsRes.rows.map((r: any) => ({
      poItemId: r.po_item_id,
      inventoryItemId: r.inventory_item_id,
      itemName: r.item_name,
      itemCode: r.item_code,
      quantity: parseFloat(r.quantity),
      unitPrice: parseFloat(r.unit_price),
      warehouseLocation: r.warehouse_location,
    }));

    await applyInventoryUpdate(client, id, pr.pr_number, items, userName);

    // Update po_item received quantities
    for (const item of items) {
      if (item.poItemId) {
        await client.query(
          `UPDATE purchase_order_items SET received_quantity = received_quantity + $1, updated_at = NOW() WHERE id = $2`,
          [item.quantity, item.poItemId]
        );
      }
    }

    await client.query(
      `UPDATE purchase_receipts SET status = 'Received', updated_by = $1, updated_at = NOW() WHERE id = $2`,
      [userName, id]
    );

    await recalcPoStatus(client, pr.po_id);
    await client.query("COMMIT");
    res.json({ message: "Purchase receipt confirmed and inventory updated" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to confirm purchase receipt" });
  } finally {
    client.release();
  }
});

// UPDATE Open PR items (edit quantities/prices before confirming)
router.put("/procurement/purchase-receipts/:id", requireAuth, async (req: AuthRequest, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const id = parseInt(req.params.id);
    const { receivedDate, items = [] } = req.body as {
      receivedDate?: string;
      items: { poItemId: number; inventoryItemId: number; itemName: string; itemCode: string; quantity: number; unitPrice: number; warehouseLocation?: string; remarks?: string }[];
    };

    const prRes = await client.query(`SELECT * FROM purchase_receipts WHERE id = $1`, [id]);
    if (!prRes.rows.length) { res.status(404).json({ error: "PR not found" }); return; }
    const pr = prRes.rows[0];
    if (pr.status !== "Open") {
      res.status(400).json({ error: `Only Open receipts can be edited. Current status: ${pr.status}` }); return;
    }

    // Validate items
    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        res.status(400).json({ error: `Received quantity must be greater than zero for item ${item.itemName}` }); return;
      }
      if (!item.poItemId) {
        res.status(400).json({ error: `Each item must reference a PO line item` }); return;
      }
      // Get current PR item's saved quantity to exclude it from pending calculation
      const existingItem = await client.query(
        `SELECT quantity FROM purchase_receipt_items WHERE pr_id = $1 AND po_item_id = $2`,
        [id, item.poItemId]
      );
      const existingQty = existingItem.rows.length ? parseFloat(existingItem.rows[0].quantity) : 0;

      const poItem = await client.query(
        `SELECT ordered_quantity, received_quantity FROM purchase_order_items WHERE id = $1 AND po_id = $2`,
        [item.poItemId, pr.po_id]
      );
      if (!poItem.rows.length) { res.status(400).json({ error: `PO item ${item.poItemId} not found` }); return; }
      // Pending = ordered - received + what this draft PR already has (since it's Open, not yet deducted)
      const pending = parseFloat(poItem.rows[0].ordered_quantity) - parseFloat(poItem.rows[0].received_quantity) + existingQty;
      if (item.quantity > pending + 0.001) {
        res.status(400).json({ error: `Received quantity (${item.quantity}) exceeds pending (${pending.toFixed(3)}) for item ${item.itemName}` }); return;
      }
    }

    // Update PR header date if provided
    if (receivedDate) {
      await client.query(
        `UPDATE purchase_receipts SET received_date = $1, updated_at = NOW() WHERE id = $2`,
        [new Date(receivedDate).toISOString(), id]
      );
    }

    // Replace items: delete all existing, insert new
    await client.query(`DELETE FROM purchase_receipt_items WHERE pr_id = $1`, [id]);
    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_receipt_items
           (pr_id, po_item_id, inventory_item_id, item_name, item_code,
            quantity, unit_price, warehouse_location, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          id, item.poItemId, item.inventoryItemId,
          item.itemName, item.itemCode, item.quantity, item.unitPrice,
          item.warehouseLocation ?? null, item.remarks ?? null,
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Purchase receipt updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to update purchase receipt" });
  } finally {
    client.release();
  }
});

// CANCEL PR
router.post("/procurement/purchase-receipts/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const userName = (req.user as any)?.name || (req.user as any)?.email || "Admin";
    const id = parseInt(req.params.id);

    const prRes = await client.query(`SELECT * FROM purchase_receipts WHERE id = $1`, [id]);
    if (!prRes.rows.length) { res.status(404).json({ error: "PR not found" }); return; }
    const pr = prRes.rows[0];
    if (pr.status === "Cancelled") {
      res.status(400).json({ error: "PR is already cancelled" }); return;
    }

    if (pr.status === "Received") {
      // Reverse inventory changes (with avg price recalculation)
      const itemsRes = await client.query(`SELECT * FROM purchase_receipt_items WHERE pr_id = $1`, [id]);
      for (const item of itemsRes.rows) {
        const qty       = parseFloat(item.quantity);
        const unitPrice = parseFloat(item.unit_price) || 0;
        const invRes = await client.query(
          `SELECT current_stock, average_price, style_reserved_qty, swatch_reserved_qty FROM inventory_items WHERE id = $1 FOR UPDATE`,
          [item.inventory_item_id]
        );
        if (invRes.rows.length) {
          const currStock = parseFloat(invRes.rows[0].current_stock);
          const currAvg   = parseFloat(invRes.rows[0].average_price);
          const newStock  = Math.max(0, currStock - qty);
          // Reverse weighted average: undo the addition of qty @ unitPrice
          const newAvg = newStock > 0
            ? Math.max(0, (currStock * currAvg - qty * unitPrice) / newStock)
            : currAvg;
          const newAvailable = newStock
            - parseFloat(invRes.rows[0].style_reserved_qty || "0")
            - parseFloat(invRes.rows[0].swatch_reserved_qty || "0");
          await client.query(
            `UPDATE inventory_items
             SET current_stock = $1, average_price = $2,
                 available_stock = GREATEST(0, $3),
                 last_updated_at = NOW()
             WHERE id = $4`,
            [newStock, newAvg, newAvailable, item.inventory_item_id]
          );
        }
        // Delete ledger entry for this PR
        await client.query(
          `DELETE FROM stock_ledger WHERE reference_number = $1 AND item_id = $2 AND transaction_type = 'purchase_receipt'`,
          [pr.pr_number, item.inventory_item_id]
        );
        // Reverse PO item received quantity
        if (item.po_item_id) {
          await client.query(
            `UPDATE purchase_order_items SET received_quantity = GREATEST(0, received_quantity - $1), updated_at = NOW() WHERE id = $2`,
            [qty, item.po_item_id]
          );
        }
      }
    }

    await client.query(
      `UPDATE purchase_receipts SET status = 'Cancelled', updated_by = $1, updated_at = NOW() WHERE id = $2`,
      [userName, id]
    );
    await recalcPoStatus(client, pr.po_id);
    await client.query("COMMIT");
    res.json({ message: "Purchase receipt cancelled" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to cancel purchase receipt" });
  } finally {
    client.release();
  }
});

// DELETE PR (admin)
router.delete("/procurement/purchase-receipts/:id", requireAuth, async (req, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const id = parseInt(req.params.id);
    const prRes = await client.query(`SELECT * FROM purchase_receipts WHERE id = $1`, [id]);
    if (!prRes.rows.length) { res.status(404).json({ error: "PR not found" }); return; }
    const pr = prRes.rows[0];

    if (pr.status === "Received") {
      // Reverse inventory if confirmed (with avg price recalculation)
      const itemsRes = await client.query(`SELECT * FROM purchase_receipt_items WHERE pr_id = $1`, [id]);
      for (const item of itemsRes.rows) {
        const qty       = parseFloat(item.quantity);
        const unitPrice = parseFloat(item.unit_price) || 0;
        const invRes = await client.query(
          `SELECT current_stock, average_price, style_reserved_qty, swatch_reserved_qty FROM inventory_items WHERE id = $1 FOR UPDATE`,
          [item.inventory_item_id]
        );
        if (invRes.rows.length) {
          const currStock = parseFloat(invRes.rows[0].current_stock);
          const currAvg   = parseFloat(invRes.rows[0].average_price);
          const newStock  = Math.max(0, currStock - qty);
          const newAvg    = newStock > 0
            ? Math.max(0, (currStock * currAvg - qty * unitPrice) / newStock)
            : currAvg;
          const newAvailable = newStock
            - parseFloat(invRes.rows[0].style_reserved_qty || "0")
            - parseFloat(invRes.rows[0].swatch_reserved_qty || "0");
          await client.query(
            `UPDATE inventory_items
             SET current_stock = $1, average_price = $2,
                 available_stock = GREATEST(0, $3),
                 last_updated_at = NOW()
             WHERE id = $4`,
            [newStock, newAvg, newAvailable, item.inventory_item_id]
          );
        }
        await client.query(
          `DELETE FROM stock_ledger WHERE reference_number = $1 AND item_id = $2 AND transaction_type = 'purchase_receipt'`,
          [pr.pr_number, item.inventory_item_id]
        );
        if (item.po_item_id) {
          await client.query(
            `UPDATE purchase_order_items SET received_quantity = GREATEST(0, received_quantity - $1), updated_at = NOW() WHERE id = $2`,
            [qty, item.po_item_id]
          );
        }
      }
      await recalcPoStatus(client, pr.po_id);
    }

    await client.query(`DELETE FROM purchase_receipt_items WHERE pr_id = $1`, [id]);
    await client.query(`DELETE FROM purchase_receipts WHERE id = $1`, [id]);
    await client.query("COMMIT");
    res.json({ message: "Purchase receipt deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to delete purchase receipt" });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  INVENTORY PROCUREMENT TRACKING (for stock list)
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/procurement/item-tracking", requireAuth, async (req, res) => {
  try {
    const { itemIds = "" } = req.query as { itemIds?: string };
    const ids = itemIds.split(",").map(Number).filter(Boolean);
    if (!ids.length) { res.json({}); return; }

    const r = await pool.query(
      `SELECT
         poi.inventory_item_id AS item_id,
         COALESCE(SUM(poi.ordered_quantity), 0) AS total_ordered,
         COALESCE(SUM(poi.received_quantity), 0) AS total_received,
         COALESCE(SUM(poi.ordered_quantity - poi.received_quantity), 0) AS total_pending
       FROM purchase_order_items poi
       JOIN purchase_orders po ON po.id = poi.po_id AND po.status NOT IN ('Draft','Cancelled')
       WHERE poi.inventory_item_id = ANY($1)
       GROUP BY poi.inventory_item_id`,
      [ids]
    );

    const map: Record<number, { total_ordered: string; total_received: string; total_pending: string }> = {};
    for (const row of r.rows) map[row.item_id] = row;
    res.json(map);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load tracking" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  APPROVED POs LIST (for PR creation dropdown)
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/procurement/approved-pos", requireAuth, async (req, res) => {
  try {
    const { search = "" } = req.query as { search?: string };
    const conditions = [
      "po.status IN ('Approved','Partially Received')",
      "EXISTS (SELECT 1 FROM purchase_order_items WHERE po_id = po.id AND pending_quantity::numeric > 0)",
    ];
    const params: string[] = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(po.po_number ILIKE $1 OR po.vendor_name ILIKE $1)`);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const rows = await pool.query(
      `SELECT po.id, po.po_number, po.vendor_name, po.reference_type, po.status,
         (SELECT COUNT(*) FROM purchase_order_items WHERE po_id = po.id AND pending_quantity::numeric > 0)::int AS pending_items
       FROM purchase_orders po ${where} ORDER BY po.created_at DESC LIMIT 100`,
      params
    );
    res.json(rows.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load approved POs" });
  }
});

// ── internal inventory update helper ─────────────────────────────────────────

async function applyInventoryUpdate(
  client: { query: typeof pool.query },
  prId: number,
  prNumber: string,
  items: Array<{ inventoryItemId: number; itemName?: string; itemCode?: string; quantity: number; unitPrice: number; poItemId?: number; warehouseLocation?: string }>,
  userName: string
) {
  for (const item of items) {
    const inv = await client.query(
      `SELECT id, item_name, item_code, current_stock, average_price,
              style_reserved_qty, swatch_reserved_qty
       FROM inventory_items WHERE id = $1 FOR UPDATE`,
      [item.inventoryItemId]
    );
    if (!inv.rows.length) continue;
    const row = inv.rows[0];
    const prevStock = parseFloat(row.current_stock);
    const prevAvg   = parseFloat(row.average_price);
    const qty       = item.quantity;
    const price     = item.unitPrice;

    const newStock = prevStock + qty;
    const newAvg   = newStock > 0
      ? (prevStock * prevAvg + qty * price) / newStock
      : price;
    const newAvailable = newStock
      - parseFloat(row.style_reserved_qty)
      - parseFloat(row.swatch_reserved_qty);

    await client.query(
      `UPDATE inventory_items
       SET current_stock = $1, average_price = $2, available_stock = GREATEST(0,$3),
           last_purchase_price = $4, last_updated_at = NOW()
       WHERE id = $5`,
      [newStock, newAvg, newAvailable, price, item.inventoryItemId]
    );

    await client.query(
      `INSERT INTO stock_ledger
         (item_id, transaction_type, reference_number, reference_type,
          in_quantity, out_quantity, balance_quantity, remarks, created_by, created_at)
       VALUES ($1,'purchase_receipt',$2,'PR',$3,0,$4,$5,$6,NOW())`,
      [item.inventoryItemId, prNumber, qty, newStock, `PR ${prNumber}`, userName]
    );
  }
}

export default router;
