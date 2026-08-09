import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { AuthRequest } from "../middlewares/requireAuth";
import { uploadMiddleware, uploadFile, deleteUpload } from "../utils/uploadHelper";
import { nextSequenceNumber } from "../utils/sequence";
import { checkPermission } from "../middlewares/checkPermission";
import { STOCK_PURCHASE_ORDERS, STOCK_PURCHASE_RECEIPTS } from "../constants/permissions";

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
  const seq = (await nextSequenceNumber("purchase_orders", "po_number", `PO/${fy}/%`, client))
    .toString().padStart(4, "0");
  return `PO/${fy}/${seq}`;
}

async function nextPrNumber(client: typeof pool): Promise<string> {
  const fy = financialYear();
  const seq = (await nextSequenceNumber("purchase_receipts", "pr_number", `PR/${fy}/%`, client))
    .toString().padStart(4, "0");
  return `PR/${fy}/${seq}`;
}

async function recalcPoStatus(client: { query: typeof pool.query }, poId: number) {
  const items = await client.query(
    `SELECT ordered_quantity, received_quantity FROM purchase_order_items WHERE po_id = $1 AND is_deleted = false`,
    [poId]
  );
  if (!items.rows.length) return;

  const totalOrdered  = items.rows.reduce((s: number, r: any) => s + parseFloat(r.ordered_quantity), 0);
  const totalReceived = items.rows.reduce((s: number, r: any) => s + parseFloat(r.received_quantity), 0);

  let newStatus: string;
  if (totalReceived <= 0) {
    newStatus = "Approved";
  } else if (totalReceived + 0.001 >= totalOrdered) {
    // Fully received — auto-close
    newStatus = "Closed";
  } else {
    newStatus = "Partially Received";
  }
  // Do not overwrite a Cancelled / Draft PO, and do not downgrade an already-Closed
  // PO (e.g. if a PR is later edited to reduce qty, leave it Closed unless user reopens).
  await client.query(
    `UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2 AND status NOT IN ('Draft','Cancelled','Closed')`,
    [newStatus, poId]
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PURCHASE ORDERS
// ═══════════════════════════════════════════════════════════════════════════════

// LIST
router.get("/procurement/purchase-orders", requireAuth, 
  checkPermission({ any: [STOCK_PURCHASE_ORDERS.VIEW] }), 
  async (req, res) => {
  try {
    const {
      search = "", status = "all", referenceType = "all",
      page = "1", limit = "10", sort = "newest",
    } = req.query as Record<string, string>;

    const conditions: string[] = ["po.is_deleted = false"];
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
           (SELECT COUNT(*) FROM purchase_order_items WHERE po_id = po.id AND is_deleted = false)::int AS item_count,
           (SELECT COALESCE(SUM(poi.ordered_quantity),0)  FROM purchase_order_items poi WHERE poi.po_id = po.id AND poi.is_deleted = false) AS total_ordered_qty,
           (SELECT COALESCE(SUM(poi.received_quantity),0) FROM purchase_order_items poi WHERE poi.po_id = po.id AND poi.is_deleted = false) AS total_received_qty,
           sw.order_code AS swatch_order_code,
           so.order_code AS style_order_code
         FROM purchase_orders po
         LEFT JOIN swatch_orders sw ON po.reference_type = 'Swatch' AND sw.id = po.swatch_order_id AND sw.is_deleted = false
         LEFT JOIN style_orders  so ON po.reference_type = 'Style'  AND so.id = po.style_order_id AND so.is_deleted = false
         ${where} ORDER BY ${orderBy}
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
router.get("/procurement/purchase-orders/:id", requireAuth, 
  checkPermission({ any: [STOCK_PURCHASE_ORDERS.VIEW] }), 
  async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [poRes, itemsRes, prsRes] = await Promise.all([
      pool.query(`SELECT * FROM purchase_orders WHERE id = $1 AND is_deleted = false`, [id]),
      pool.query(
        `SELECT poi.*,
           ii.unit_type, ii.available_stock, ii.current_stock, ii.average_price,
           (poi.ordered_quantity - poi.received_quantity) AS pending_quantity
         FROM purchase_order_items poi
         LEFT JOIN inventory_items ii ON ii.id = poi.inventory_item_id AND ii.is_deleted = false
         WHERE poi.po_id = $1 AND poi.is_deleted = false ORDER BY poi.id`,
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
         LEFT JOIN purchase_receipt_items pri ON pri.pr_id = pr.id AND pri.is_deleted = false
         WHERE pr.po_id = $1 AND pr.status != 'Cancelled' AND pr.is_deleted = false
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
router.post("/procurement/purchase-orders", requireAuth, 
  checkPermission({ any: [STOCK_PURCHASE_ORDERS.ADD_EDIT] }), 
  async (req: AuthRequest, res) => {
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
      items: {
        inventoryItemId: number;
        itemName: string;
        itemCode: string;
        orderedQuantity: number;
        unitPrice: number;
        warehouseLocation?: string;
        remarks?: string;
        itemImage?: string | null;
      }[];
    };

    if (!vendorId) { res.status(400).json({ error: "Vendor is required" }); return; }
    if (!items.length) { res.status(400).json({ error: "At least one item is required" }); return; }

    const vendorMode = "header";
    const isSwatchOrStyle = referenceType === "Swatch" || referenceType === "Style";
    const effectiveReferenceId = referenceId ?? null;

    // ─── RESOLVE BOM ROW IDs for Swatch/Style POs ──────────────────────────
    let bomRowIds: number[] = [];
    let bomItems: any[] = [];

    if (isSwatchOrStyle && effectiveReferenceId) {
      const inventoryItemIds = items.map(i => i.inventoryItemId);

      const invRes = await client.query(
        `SELECT id, item_code, item_name, source_type, source_id
         FROM inventory_items
         WHERE id = ANY($1) AND is_deleted = false`,
        [inventoryItemIds]
      );

      const invMap = new Map<number, { source_type: string; source_id: string; item_code: string; item_name: string }>();
      for (const row of invRes.rows) {
        invMap.set(row.id, {
          source_type: row.source_type,
          source_id: String(row.source_id),
          item_code: row.item_code,
          item_name: row.item_name,
        });
      }

      const orderIdColumn = referenceType === "Swatch" ? "swatch_order_id" : "style_order_id";

      for (const item of items) {
        const inv = invMap.get(item.inventoryItemId);
        if (!inv) continue;

        // Only select columns that exist in swatch_bom table
        const bomRes = await client.query(
          `SELECT id, unit_type, avg_unit_price
           FROM swatch_bom
           WHERE ${orderIdColumn} = $1
             AND material_type = $2
             AND material_id::text = $3
             AND material_code = $4
             AND is_deleted = false
           LIMIT 1`,
          [effectiveReferenceId, inv.source_type, inv.source_id, item.itemCode]
        );

        if (bomRes.rows.length) {
          const bomRow = bomRes.rows[0];
          const bomRowId = bomRow.id;

          bomRowIds.push(bomRowId);
          bomItems.push({
            bomRowId: bomRowId,
            materialCode: item.itemCode,
            materialName: item.itemName,
            unitType: bomRow.unit_type ?? "",
            targetPrice: String(item.unitPrice ?? bomRow.avg_unit_price),
            quantity: String(item.orderedQuantity),
            targetVendorId: vendorId,
            targetVendorName: vendorName,
          });
        }
      }
    }

    const poNumber = await nextPoNumber(client);
    // ─── INSERT PO HEADER ──────────────────────────────────────────────────
    const poRes = await client.query(
      `INSERT INTO purchase_orders
         (po_number, vendor_id, vendor_name, vendor_mode, po_date, status, notes,
          reference_type, reference_id, swatch_order_id, style_order_id,
          bom_row_ids, bom_items, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, NOW())
       RETURNING *`,
      [
        poNumber,
        vendorId,
        vendorName,
        vendorMode,
        poDate ? new Date(poDate).toISOString() : new Date().toISOString(),
        "Draft",
        notes ?? null,
        referenceType,
        effectiveReferenceId,
        referenceType === "Swatch" ? effectiveReferenceId : null,
        referenceType === "Style" ? effectiveReferenceId : null,
        JSON.stringify(bomRowIds),
        JSON.stringify(bomItems),
        userName,
      ]
    );
    const po = poRes.rows[0];

    // ─── INSERT PO ITEMS with resolved bomRowId ────────────────────────────
    for (const item of items) {
      let itemBomRowId: number | null = null;

      if (isSwatchOrStyle && effectiveReferenceId) {
        const invRes = await client.query(
          `SELECT source_type, source_id FROM inventory_items WHERE id = $1 AND is_deleted = false`,
          [item.inventoryItemId]
        );
        if (invRes.rows.length) {
          const inv = invRes.rows[0];
          const orderIdColumn = referenceType === "Swatch" ? "swatch_order_id" : "style_order_id";

          const bomRes = await client.query(
            `SELECT id FROM swatch_bom
             WHERE ${orderIdColumn} = $1
               AND material_type = $2
               AND material_id::text = $3
               AND material_code = $4
               AND is_deleted = false
             LIMIT 1`,
            [effectiveReferenceId, inv.source_type, String(inv.source_id), item.itemCode]
          );
          if (bomRes.rows.length) {
            itemBomRowId = bomRes.rows[0].id;
          }
        }
      }

      await client.query(
        `INSERT INTO purchase_order_items
           (po_id, inventory_item_id, item_name, item_code,
            ordered_quantity, received_quantity, unit_price,
            warehouse_location, remarks, item_image)
         VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8,$9)`,
        [
          po.id,
          item.inventoryItemId,
          item.itemName,
          item.itemCode,
          item.orderedQuantity,
          item.unitPrice,
          item.warehouseLocation ?? null,
          item.remarks ?? null,
          item.itemImage ?? null,
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
router.patch("/procurement/purchase-orders/:id/status", requireAuth, 
  checkPermission({ any: [STOCK_PURCHASE_ORDERS.ADD_EDIT] }), 
  async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const userName = (req.user as any)?.name || (req.user as any)?.email || "Admin";
    const { status, notes } = req.body as { status: string; notes?: string };

    const allowed = ["Draft", "Approved", "Cancelled", "Closed"];
    if (!allowed.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }

    // Guard: Closed is only meaningful from Approved / Partially Received / Closed (idempotent).
    if (status === "Closed") {
      const cur = await pool.query(`SELECT status FROM purchase_orders WHERE id = $1 AND is_deleted = false`, [id]);
      if (!cur.rows.length) { res.status(404).json({ error: "PO not found" }); return; }
      const curStatus = cur.rows[0].status;
      if (!["Approved", "Partially Received", "Closed"].includes(curStatus)) {
        res.status(400).json({ error: `Cannot close a ${curStatus} PO` }); return;
      }
    }

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
      `UPDATE purchase_orders SET ${updates.join(", ")} WHERE id = $3 AND is_deleted = false RETURNING *`,
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
router.delete("/procurement/purchase-orders/:id", requireAuth, 
  checkPermission({ any: [STOCK_PURCHASE_ORDERS.DELETE] }), 
  async (req, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const id = parseInt(String(req.params.id));
    const deletedByUser = (req.user as any)?.email ?? "system";
    const po = await client.query(`SELECT status FROM purchase_orders WHERE id = $1 AND is_deleted = false`, [id]);
    if (!po.rows.length) { await client.query("ROLLBACK"); res.status(404).json({ error: "PO not found" }); return; }
    if (po.rows[0].status !== "Draft") { await client.query("ROLLBACK"); res.status(400).json({ error: "Only Draft POs can be deleted" }); return; }
    await client.query(`UPDATE purchase_order_items SET is_deleted = true, updated_at = NOW(), deleted_by = $2, deleted_at = now() WHERE po_id = $1 AND is_deleted = false`, [id, deletedByUser]);
    await client.query(`UPDATE purchase_orders SET is_deleted = true, updated_at = NOW(), deleted_by = $2, deleted_at = now() WHERE id = $1 AND is_deleted = false`, [id, deletedByUser]);
    await client.query("COMMIT");
    res.json({ message: "Purchase Order deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to delete purchase order" });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PURCHASE RECEIPTS
// ═══════════════════════════════════════════════════════════════════════════════

// LIST (all PRs from purchase_receipts — covers both Inventory and Costing sources)
router.get("/procurement/purchase-receipts", requireAuth, 
  checkPermission({ any: [STOCK_PURCHASE_RECEIPTS.VIEW] }), 
  async (req, res) => {
  try {
    const {
      search = "", status = "all", referenceType = "all",
      fromDate = "", toDate = "", poNumber = "",
      page = "1", limit = "10", sort = "newest",
    } = req.query as Record<string, string>;

    const conditions: string[] = ["pr.is_deleted = false"];
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
           (SELECT COUNT(*) FROM purchase_receipt_items WHERE pr_id = pr.id AND is_deleted = false)::int AS item_count,
           (SELECT COALESCE(SUM(quantity),0) FROM purchase_receipt_items WHERE pr_id = pr.id AND is_deleted = false) AS total_qty
         FROM purchase_receipts pr
         LEFT JOIN purchase_orders po ON po.id = pr.po_id AND po.is_deleted = false
         ${where} ORDER BY ${orderBy}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limitNum, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM purchase_receipts pr LEFT JOIN purchase_orders po ON po.id = pr.po_id AND po.is_deleted = false ${where}`,
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
router.get("/procurement/purchase-receipts/:id", requireAuth, 
  checkPermission({ any: [STOCK_PURCHASE_RECEIPTS.VIEW] }), 
  async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [prRes, itemsRes] = await Promise.all([
      pool.query(
        `SELECT pr.*, po.po_number, po.reference_type, po.vendor_name AS po_vendor_name,
                vil.currency_code AS vendor_invoice_currency_code,
                vil.exchange_rate_snapshot AS vendor_invoice_exchange_rate
         FROM purchase_receipts pr
         LEFT JOIN purchase_orders po ON po.id = pr.po_id AND po.is_deleted = false
         LEFT JOIN vendor_invoice_ledger vil ON vil.purchase_receipt_id = pr.id AND vil.is_deleted = false
         WHERE pr.id = $1 AND pr.is_deleted = false`,
        [id]
      ),
      pool.query(
        `SELECT pri.*, poi.ordered_quantity AS po_ordered_qty, poi.received_quantity AS po_received_qty,
           ii.unit_type, ii.available_stock, ii.current_stock
         FROM purchase_receipt_items pri
         LEFT JOIN purchase_order_items poi ON poi.id = pri.po_item_id AND poi.is_deleted = false
         LEFT JOIN inventory_items ii ON ii.id = pri.inventory_item_id AND ii.is_deleted = false
         WHERE pri.pr_id = $1 AND pri.is_deleted = false ORDER BY pri.id`,
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
router.post("/procurement/purchase-receipts", requireAuth, 
  checkPermission({ any: [STOCK_PURCHASE_RECEIPTS.ADD_EDIT] }), 
  async (req: AuthRequest, res) => {
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
      `SELECT po.*, v.id AS vid FROM purchase_orders po LEFT JOIN vendors v ON v.id = po.vendor_id AND v.is_deleted = false WHERE po.id = $1 AND po.is_deleted = false`,
      [poId]
    );
    if (!poRes.rows.length) { res.status(400).json({ error: "PO not found" }); return; }
    const po = poRes.rows[0];
    if (!["Approved", "Partially Received", "In Process"].includes(po.status)) {
      res.status(400).json({ error: `PO must be Approved before creating a receipt. Current status: ${po.status}` }); return;
    }

    const isSwatchOrStyle = po.reference_type === 'Swatch' || po.reference_type === 'Style';
    const bomRowId = po.bom_row_ids && po.bom_row_ids.length === 1 ? po.bom_row_ids[0] : null;
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
        `SELECT ordered_quantity, received_quantity FROM purchase_order_items WHERE id = $1 AND po_id = $2 AND is_deleted = false`,
        [item.poItemId, poId]
      );
      if (!poItem.rows.length) { res.status(400).json({ error: `PO item ${item.poItemId} not found` }); return; }
      // const pending = Math.max( 0, parseFloat(poItem.rows[0].ordered_quantity) - parseFloat(poItem.rows[0].received_quantity));
      // if (item.quantity > pending + 0.001) {
      //   res.status(400).json({ error: `Received quantity (${item.quantity}) exceeds pending (${pending.toFixed(3)}) for item ${item.itemName}` }); return;
      // }
    }

    const prNumber = await nextPrNumber(client);
    const status = confirmNow ? "Received" : "Open";

    // PR header
    const headerVendorName = po.vendor_mode === 'header' ? po.vendor_name : null;
    const totalReceivedQty = items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
    const totalActualPrice = items?.reduce((sum, item) => sum + (item.unitPrice || 0), 0) || 0;
    
    const prRes = await client.query(
      `INSERT INTO purchase_receipts
        (pr_number, po_id, vendor_name, received_date, 
          received_qty, actual_price,
          warehouse_location, status, 
          swatch_order_id, style_order_id, bom_row_id,
          created_by, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
      RETURNING *`,
      [
        prNumber, 
        poId, 
        headerVendorName,
        receivedDate ? new Date(receivedDate).toISOString() : new Date().toISOString(),
        isSwatchOrStyle ? totalReceivedQty : 0,   // Real qty for Swatch/Style, 0 otherwise
        isSwatchOrStyle ? totalActualPrice : 0,   // Real price for Swatch/Style, 0 otherwise
        '',
        status,
        po.swatch_order_id ?? null, 
        po.style_order_id ?? null,
        bomRowId || null,
        userName,
      ]
    );
    const pr = prRes.rows[0];

    // Fetch all PO item vendors in one query
    const poItemIds = items.map(i => i.poItemId);
    const poItemsRes = await client.query(
      `SELECT id, vendor_id, vendor_name FROM purchase_order_items 
       WHERE id = ANY($1) AND po_id = $2 AND is_deleted = false`,
      [poItemIds, poId]
    );
    interface VendorInfo {
      vendorId: number | null;
      vendorName: string | null;
    }

    const vendorMap = new Map<number, VendorInfo>(
        poItemsRes.rows.map((r: { id: number; vendor_id: number | null; vendor_name: string | null }) => [
            r.id,
            { vendorId: r.vendor_id, vendorName: r.vendor_name }
        ])
    );

    // PR items
    for (const item of items) {
      const vendor = vendorMap.get(item.poItemId);
      await client.query(
        `INSERT INTO purchase_receipt_items
           (pr_id, po_item_id, inventory_item_id, item_name, item_code,
            quantity, unit_price, warehouse_location, remarks, item_image,vendor_id, vendor_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          pr.id, item.poItemId, item.inventoryItemId,
          item.itemName, item.itemCode, item.quantity, item.unitPrice,
          item.warehouseLocation ?? null, item.remarks ?? null, (item as any).itemImage ?? null,
          vendor?.vendorId ?? null,
          vendor?.vendorName ?? null,
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
router.post("/procurement/purchase-receipts/:id/confirm", requireAuth, 
  checkPermission({ any: [STOCK_PURCHASE_RECEIPTS.ADD_EDIT] }), 
  async (req: AuthRequest, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const userName = (req.user as any)?.name || (req.user as any)?.email || "Admin";
    const id = parseInt(String(req.params.id));

    const prRes = await client.query(`SELECT * FROM purchase_receipts WHERE id = $1 AND is_deleted = false`, [id]);
    if (!prRes.rows.length) { res.status(404).json({ error: "PR not found" }); return; }
    const pr = prRes.rows[0];
    if (pr.status !== "Open") {
      res.status(400).json({ error: `Cannot confirm a PR with status "${pr.status}"` }); return;
    }

    const itemsRes = await client.query(
      `SELECT * FROM purchase_receipt_items WHERE pr_id = $1 AND is_deleted = false`,
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
router.put("/procurement/purchase-receipts/:id", requireAuth, 
  checkPermission({ any: [STOCK_PURCHASE_RECEIPTS.ADD_EDIT] }), 
  async (req: AuthRequest, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const id = parseInt(String(req.params.id));
    const deletedByUser = (req.user as any)?.email ?? "system";
    const { receivedDate, items = [] } = req.body as {
      receivedDate?: string;
      items: { poItemId: number; inventoryItemId: number; itemName: string; itemCode: string; quantity: number; unitPrice: number; warehouseLocation?: string; remarks?: string }[];
    };

    const prRes = await client.query(`SELECT * FROM purchase_receipts WHERE id = $1 AND is_deleted = false`, [id]);
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
        `SELECT quantity FROM purchase_receipt_items WHERE pr_id = $1 AND po_item_id = $2 AND is_deleted = false`,
        [id, item.poItemId]
      );
      const existingQty = existingItem.rows.length ? parseFloat(existingItem.rows[0].quantity) : 0;

      const poItem = await client.query(
        `SELECT ordered_quantity, received_quantity FROM purchase_order_items WHERE id = $1 AND po_id = $2 AND is_deleted = false`,
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

    // Replace items: soft-delete all existing, insert new
    await client.query(`UPDATE purchase_receipt_items SET is_deleted = true, deleted_by = $2, deleted_at = now() WHERE pr_id = $1 AND is_deleted = false`, [id, deletedByUser]);
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
router.post("/procurement/purchase-receipts/:id/cancel", requireAuth, 
  checkPermission({ any: [STOCK_PURCHASE_RECEIPTS.ADD_EDIT] }), 
  async (req: AuthRequest, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const userName = (req.user as any)?.name || (req.user as any)?.email || "Admin";
    const id = parseInt(String(req.params.id));

    const prRes = await client.query(`SELECT * FROM purchase_receipts WHERE id = $1 AND is_deleted = false`, [id]);
    if (!prRes.rows.length) { res.status(404).json({ error: "PR not found" }); return; }
    const pr = prRes.rows[0];
    if (pr.status === "Cancelled") {
      res.status(400).json({ error: "PR is already cancelled" }); return;
    }

    if (pr.status === "Received") {
      // Reverse inventory changes (with avg price recalculation)
      const itemsRes = await client.query(`SELECT * FROM purchase_receipt_items WHERE pr_id = $1 AND is_deleted = false`, [id]);
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
          `UPDATE stock_ledger SET is_deleted = true, deleted_by = $3, deleted_at = now() WHERE reference_number = $1 AND item_id = $2 AND transaction_type = 'purchase_receipt' AND is_deleted = false`,
          [pr.pr_number, item.inventory_item_id, userName]
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
router.delete("/procurement/purchase-receipts/:id", requireAuth, 
  checkPermission({ any: [STOCK_PURCHASE_RECEIPTS.DELETE] }), 
  async (req, res) => {
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const id = parseInt(String(req.params.id));
    const deletedByUser = (req.user as any)?.email ?? "system";
    const prRes = await client.query(`SELECT * FROM purchase_receipts WHERE id = $1 AND is_deleted = false`, [id]);
    if (!prRes.rows.length) { res.status(404).json({ error: "PR not found" }); return; }
    const pr = prRes.rows[0];

    if (pr.status === "Received") {
      // Reverse inventory if confirmed (with avg price recalculation)
      const itemsRes = await client.query(`SELECT * FROM purchase_receipt_items WHERE pr_id = $1 AND is_deleted = false`, [id]);
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
          `UPDATE stock_ledger SET is_deleted = true, deleted_by = $3, deleted_at = now() WHERE reference_number = $1 AND item_id = $2 AND transaction_type = 'purchase_receipt' AND is_deleted = false`,
          [pr.pr_number, item.inventory_item_id, deletedByUser]
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

    await client.query(`UPDATE purchase_receipt_items SET is_deleted = true, deleted_by = $2, deleted_at = now() WHERE pr_id = $1 AND is_deleted = false`, [id, deletedByUser]);
    await client.query(`UPDATE purchase_receipts SET is_deleted = true, updated_at = NOW(), deleted_by = $2, deleted_at = now() WHERE id = $1 AND is_deleted = false`, [id, deletedByUser]);
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
       JOIN purchase_orders po ON po.id = poi.po_id AND po.status NOT IN ('Draft','Cancelled') AND po.is_deleted = false
       WHERE poi.inventory_item_id = ANY($1) AND poi.is_deleted = false
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
//  PO NUMBERS LIST (for PR list filter dropdown)
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/procurement/po-numbers", requireAuth, async (_req, res) => {
  try {
    const rows = await pool.query(
      `SELECT DISTINCT po_number FROM purchase_orders WHERE is_deleted = false ORDER BY po_number DESC LIMIT 200`
    );
    res.json(rows.rows.map((r: { po_number: string }) => r.po_number));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  APPROVED POs LIST (for PR creation dropdown)
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/procurement/approved-pos", requireAuth, async (req, res) => {
  try {
    const { search = "" } = req.query as { search?: string };
    const conditions = [
      "po.is_deleted = false",
      "po.status IN ('Approved','Partially Received','In Process')",
      "EXISTS (SELECT 1 FROM purchase_order_items WHERE po_id = po.id AND (ordered_quantity - received_quantity) > 0 AND is_deleted = false)",
    ];
    const params: string[] = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(po.po_number ILIKE $1 OR po.vendor_name ILIKE $1)`);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const rows = await pool.query(
      `SELECT po.id, po.po_number, po.vendor_name, po.reference_type, po.status,
         (SELECT COUNT(*) FROM purchase_order_items WHERE po_id = po.id AND (ordered_quantity - received_quantity) > 0 AND is_deleted = false)::int AS pending_items
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
  items: Array<{
    inventoryItemId: number;
    itemName?: string;
    itemCode?: string;
    quantity: number;
    unitPrice: number;
    poItemId?: number;
    warehouseLocation?: string;
  }>,
  userName: string
) {
  for (const item of items) {
    // ── 1. Lock and fetch inventory_items row (FOR UPDATE) ──────────────────
    const inv = await client.query(
      `SELECT id, item_name, item_code, current_stock, average_price,
              style_reserved_qty, swatch_reserved_qty,
              source_type, source_id
       FROM inventory_items WHERE id = $1 AND is_deleted = false
       FOR UPDATE`,
      [item.inventoryItemId]
    );

    if (!inv.rows.length) {
      console.warn(`[applyInventoryUpdate] Inventory item ${item.inventoryItemId} not found, skipping.`);
      continue;
    }

    const row = inv.rows[0];
    const prevStock = parseFloat(row.current_stock ?? "0");
    const prevAvg   = parseFloat(row.average_price ?? "0");
    const qty       = item.quantity;
    const price     = item.unitPrice;

    const newStock = prevStock + qty;
    const newAvg   = newStock > 0
      ? (prevStock * prevAvg + qty * price) / newStock
      : price;

    const newAvailable = Math.max(0, newStock
      - parseFloat(row.style_reserved_qty ?? "0")
      - parseFloat(row.swatch_reserved_qty ?? "0"));

    // ── 2. Update inventory_items ─────────────────────────────────────────
    await client.query(
      `UPDATE inventory_items
       SET current_stock = $1,
           average_price = $2,
           available_stock = $3,
           last_purchase_price = $4,
           last_updated_at = NOW()
       WHERE id = $5`,
      [
        newStock.toFixed(3),
        newAvg.toFixed(2),
        newAvailable.toFixed(3),
        price.toFixed(2),
        item.inventoryItemId
      ]
    );

    // Keep swatch_bom current_stock in sync
    if (item.itemCode) {
      await client.query( 
        `UPDATE swatch_bom
        SET current_stock = $1,
            updated_at = NOW()
        WHERE material_code = $2
          AND is_deleted = false`,
        [
          newStock.toFixed(3),
          item.itemCode
        ]
      );
    }
    // ── 3. Insert stock_ledger entry ──────────────────────────────────────
    await client.query(
      `INSERT INTO stock_ledger
         (item_id, transaction_type, reference_number, reference_type,
          in_quantity, out_quantity, balance_quantity, remarks, created_by, created_at)
       VALUES ($1, 'purchase_receipt', $2, 'PR', $3, 0, $4, $5, $6, NOW())`,
      [
        item.inventoryItemId,
        prNumber,
        qty.toFixed(3),
        newStock.toFixed(3),
        `PR ${prNumber}${item.itemName ? " - " + item.itemName : ""}`,
        userName
      ]
    );

    // ── 4. Insert inventory_stock_logs (non-critical, catch and log) ────────
    try {
      await client.query(
        `INSERT INTO inventory_stock_logs
           (inventory_item_id, action_type, quantity_before, quantity_after, quantity_delta,
            reference_type, reference_id, notes, created_by_name, created_at)
         VALUES ($1, 'receipt', $2, $3, $4, 'PR', $5, $6, $7, NOW())`,
        [
          item.inventoryItemId,
          prevStock.toFixed(3),
          newStock.toFixed(3),
          qty.toFixed(3),
          prId,
          `PR ${prNumber}${item.itemName ? " - " + item.itemName : ""}`,
          userName
        ]
      );
    } catch (logError) {
      console.error(`[StockLog] PR ${prNumber} inventory_stock_logs failed (non-critical):`, logError);
    }

    // ── 5. Lock and update material/fabric master (FOR UPDATE) ─────────────
    const materialType = row.source_type;
    const materialId = row.source_id ? parseInt(row.source_id, 10) : null;

    if (materialType && materialId) {
      const masterTable = materialType === "fabric" ? "fabrics" : "materials";

      const masterRes = await client.query(
        `SELECT current_stock, location_stocks
         FROM ${masterTable}
         WHERE id = $1 AND is_deleted = false
         FOR UPDATE`,
        [materialId]
      );

      if (masterRes.rows.length) {
        const masterRow = masterRes.rows[0];
        const masterNewStock = parseFloat(masterRow.current_stock ?? "0") + qty;

        const resolvedLocation = item.warehouseLocation?.trim() || "Unallocated";
        const locStocks: Array<{ location: string; stock: string }> =
          masterRow.location_stocks ?? [];

        const locIdx = locStocks.findIndex((l: any) => l.location === resolvedLocation);
        if (locIdx >= 0) {
          locStocks[locIdx].stock = (
            parseFloat(locStocks[locIdx].stock ?? "0") + qty
          ).toFixed(3);
        } else {
          locStocks.push({
            location: resolvedLocation,
            stock: qty.toFixed(3),
          });
        }

        await client.query(
          `UPDATE ${masterTable}
           SET current_stock = $1,
               location_stocks = $2
           WHERE id = $3`,
          [
            masterNewStock.toFixed(3),
            JSON.stringify(locStocks),
            materialId
          ]
        );
      }
    }
  }
}

// ── VENDOR INVOICE UPLOAD ──────────────────────────────────────────────────

router.post(
  "/procurement/purchase-receipts/:id/vendor-invoice",
  requireAuth,
  uploadMiddleware.single("invoice_file"),
  async (req: AuthRequest, res) => {
    const prId = parseInt(String(req.params.id));
    if (isNaN(prId)) { res.status(400).json({ error: "Invalid PR id" }); return; }

    const { invoice_number, invoice_date, invoice_amount, currency_code, exchange_rate_snapshot } = req.body as Record<string, string>;
    if (!invoice_number?.trim()) { res.status(400).json({ error: "Invoice number is required" }); return; }
    if (!invoice_amount || isNaN(parseFloat(invoice_amount))) { res.status(400).json({ error: "Invoice amount is required" }); return; }
    const billCurrency = currency_code?.trim().toUpperCase() || "INR";
    let billRate: number;
    if (billCurrency === "INR") {
      billRate = 1;
    } else {
      billRate = Number(exchange_rate_snapshot);
      if (!isFinite(billRate) || billRate <= 0) {
        res.status(400).json({ error: `A positive exchange rate is required for ${billCurrency} invoices` }); return;
      }
    }

    const userName = (req.user as any)?.name || (req.user as any)?.email || "Admin";

    const client = await (pool as any).connect();
    try {
      await client.query("BEGIN");

      const prRes = await client.query(
        `SELECT pr.*, po.vendor_id AS po_vendor_id, po.vendor_name AS po_vendor_name
         FROM purchase_receipts pr
         LEFT JOIN purchase_orders po ON po.id = pr.po_id AND po.is_deleted = false
         WHERE pr.id = $1 AND pr.is_deleted = false`,
        [prId]
      );
      if (!prRes.rows.length) { await client.query("ROLLBACK"); res.status(404).json({ error: "PR not found" }); return; }
      const pr = prRes.rows[0];

      if (pr.vendor_invoice_number) {
        if (pr.vendor_invoice_file) {
          await deleteUpload(pr.vendor_invoice_file);
        }
        await client.query(
          `UPDATE vendor_invoice_ledger SET is_deleted = true, updated_at = NOW(), deleted_by = $2, deleted_at = now() WHERE purchase_receipt_id = $1 AND is_deleted = false`,
          [prId, userName]
        );
      }

      const filePath = req.file
        ? await uploadFile(req.file, { entity: "procurement", id: prId, category: "invoices" })
        : null;

      await client.query(
        `UPDATE purchase_receipts
         SET vendor_invoice_number = $1,
             vendor_invoice_date   = $2,
             vendor_invoice_amount = $3,
             vendor_invoice_file   = $4,
             vendor_invoice_uploaded_at = NOW()
         WHERE id = $5`,
        [invoice_number.trim(), invoice_date || null, parseFloat(invoice_amount), filePath, prId]
      );

      const vendorId: number | null = pr.po_vendor_id ?? null;
      const vendorName: string = pr.vendor_name || pr.po_vendor_name || "";

      if (vendorId) {
        const billAmount = parseFloat(invoice_amount);
        const billBase = parseFloat((billAmount * billRate).toFixed(2));
        await client.query(
          `INSERT INTO vendor_invoice_ledger
             (vendor_id, vendor_name, purchase_receipt_id, pr_number,
              vendor_invoice_number, vendor_invoice_date, vendor_invoice_amount,
              currency_code, exchange_rate_snapshot, base_currency_amount,
              entry_type, status, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Vendor Invoice','Unpaid',$11)`,
          [vendorId, vendorName, prId, pr.pr_number,
           invoice_number.trim(), invoice_date || null, billAmount,
           billCurrency, billRate, billBase, userName]
        );
      }

      await client.query("COMMIT");
      res.json({ success: true, file_path: filePath });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Failed to upload vendor invoice" });
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/procurement/purchase-receipts/:id/vendor-invoice",
  requireAuth,
  async (req: AuthRequest, res) => {
    if ((req.user as any)?.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
    const prId = parseInt(String(req.params.id));

    const client = await (pool as any).connect();
    try {
      await client.query("BEGIN");
      const deletedByUser = (req.user as any)?.email ?? "system";
      const prRes = await client.query(
        `SELECT vendor_invoice_file FROM purchase_receipts WHERE id = $1 AND is_deleted = false`,
        [prId]
      );
      if (!prRes.rows.length) { await client.query("ROLLBACK"); res.status(404).json({ error: "PR not found" }); return; }

      const filePath = prRes.rows[0].vendor_invoice_file;
      if (filePath) {
        await deleteUpload(filePath);
      }

      await client.query(
        `UPDATE purchase_receipts
         SET vendor_invoice_number = NULL, vendor_invoice_date = NULL,
             vendor_invoice_amount = NULL, vendor_invoice_file = NULL,
             vendor_invoice_uploaded_at = NULL
         WHERE id = $1`,
        [prId]
      );
      await client.query(`UPDATE vendor_invoice_ledger SET is_deleted = true, updated_at = NOW(), deleted_by = $2, deleted_at = now() WHERE purchase_receipt_id = $1 AND is_deleted = false`, [prId, deletedByUser]);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Failed to delete vendor invoice" });
    } finally {
      client.release();
    }
  }
);

export default router;
