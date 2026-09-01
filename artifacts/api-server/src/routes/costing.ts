import { Router, type Request, type Response } from "express";
import { db, pool, inArray  } from "@workspace/db";
import {
  swatchBomTable, purchaseOrdersTable, purchaseReceiptsTable, prPaymentsTable,
  consumptionLogTable, artisanTimesheetsTable, outsourceJobsTable, customChargesTable,
  materialsTable, fabricsTable, vendorsTable, hsnTable, inventoryItemsTable,
  bomChangeLogTable,purchaseReceiptItems
} from "@workspace/db/schema";
import { usersTable, eq, ilike, or, desc, and } from "@workspace/db";
// import { eq, ilike, or, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { sendPoApprovalRequestEmail } from "../lib/mailer";
import { persistAttachmentObject } from "../utils/uploadHelper";
import jwt from "jsonwebtoken";
import { checkPermission } from "../middlewares/checkPermission";
import { STYLE_ORDER_TABS, SWATCH_ORDER_TABS, SWATCH_ORDERS, STYLE_ORDERS } from "../constants/permissions";

const router = Router();

// ─── Shared Reservation Helper ───────────────────────────────────────────────
// Sections 1-4, 8-10 of the Reservation Engine spec.
// Upserts a reservation for a BOM row, validates available stock, updates
// reserved qty, recalculates available_stock, writes stock_ledger, and
// touches last_updated_at. Returns a status string for the API response.
async function autoReserveForBom(opts: {
  materialType: string;
  materialId: number;
  orderId: number;
  reservationType: "Style" | "Swatch";
  reqQty: number;
  bomRowId: number;
  materialName: string;
  actor: string;
}): Promise<{ status: "created" | "updated" | "skipped"; reason?: string; inventoryId?: number }> {
  const { materialType, materialId, orderId, reservationType, reqQty, bomRowId, materialName, actor } = opts;

  const invRows = await db
    .select({
      id: inventoryItemsTable.id,
      availableStock: inventoryItemsTable.availableStock,
    })
    .from(inventoryItemsTable)
    .where(and(eq(inventoryItemsTable.sourceType, materialType), eq(inventoryItemsTable.sourceId, materialId), eq(inventoryItemsTable.isDeleted, false)))
    .limit(1);

  if (!invRows.length) return { status: "skipped", reason: "No inventory record for this material" };

  const { id: inventoryId, availableStock } = invRows[0];
  const avail = parseFloat(availableStock ?? "0");

  // Section 9 — validate available stock
  if (reqQty > avail) {
    return {
      status: "skipped",
      reason: `Insufficient available stock — required ${reqQty}, available ${avail.toFixed(3)}`,
      inventoryId,
    };
  }

  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");

    // Section 8 — check for existing active reservation for same order + inventory
    const existR = await client.query(
      `SELECT id, reserved_quantity FROM material_reservations
       WHERE inventory_id = $1 AND reservation_type = $2 AND reference_id = $3 AND status = 'Active' AND is_deleted = false
       ORDER BY id DESC LIMIT 1`,
      [inventoryId, reservationType, orderId]
    );

    const col = reservationType === "Style" ? "style_reserved_qty" : "swatch_reserved_qty";
    let resultStatus: "created" | "updated";

    if (existR.rows.length > 0) {
      // Upsert: adjust the delta so reserved qty tracks correctly
      const existing = existR.rows[0];
      const oldQty = parseFloat(existing.reserved_quantity);
      const delta = reqQty - oldQty;
      await client.query(
        `UPDATE material_reservations SET reserved_quantity = $1, remarks = $2 WHERE id = $3`,
        [reqQty, `BOM row ${bomRowId} — ${materialName}`, existing.id]
      );
      if (delta !== 0) {
        await client.query(
          `UPDATE inventory_items SET ${col} = GREATEST(0, ${col}::numeric + $1) WHERE id = $2`,
          [delta, inventoryId]
        );
      }
      resultStatus = "updated";
    } else {
      const today = new Date().toISOString().slice(0, 10);
      await client.query(
        `INSERT INTO material_reservations
           (item_id, inventory_id, reservation_type, reference_id, reserved_quantity, status, remarks, reserved_by, reservation_date)
         VALUES ($1,$2,$3,$4,$5,'Active',$6,$7,$8)`,
        [inventoryId, inventoryId, reservationType, orderId, reqQty,
         `BOM row ${bomRowId} — ${materialName}`, actor, today]
      );
      await client.query(
        `UPDATE inventory_items SET ${col} = ${col}::numeric + $1 WHERE id = $2`,
        [reqQty, inventoryId]
      );
      resultStatus = "created";
    }

    // Recalculate available_stock and Section 10 — touch last_updated_at
    await client.query(
      `UPDATE inventory_items
       SET available_stock = GREATEST(0, current_stock::numeric - style_reserved_qty::numeric - swatch_reserved_qty::numeric),
           last_updated_at = NOW()
       WHERE id = $1`,
      [inventoryId]
    );

    // Section 4 — stock ledger entry (only for new reservations to avoid duplicates)
    if (resultStatus === "created") {
      const balR = await client.query(`SELECT current_stock FROM inventory_items WHERE id = $1 AND is_deleted = false`, [inventoryId]);
      await client.query(
        `INSERT INTO stock_ledger (item_id, transaction_type, reference_number, reference_type, in_quantity, out_quantity, balance_quantity, remarks, created_by)
         VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8)`,
        [inventoryId, `${reservationType.toLowerCase()}_reservation`, String(orderId), reservationType,
         reqQty, balR.rows[0].current_stock,
         `Reserved ${reqQty} for ${reservationType} Order #${orderId} (BOM row ${bomRowId})`, actor]
      );
    }

    await client.query("COMMIT");
    return { status: resultStatus, inventoryId };
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("autoReserveForBom failed:", e);
    return { status: "skipped", reason: "Transaction error" };
  } finally {
    client.release();
  }
}

// Cancels the active reservation for a deleted BOM row and restores stock.
async function autoCancelReservation(opts: {
  materialType: string;
  materialId: number;
  orderId: number;
  reservationType: "Style" | "Swatch";
  reqQty: number;
}): Promise<void> {
  const { materialType, materialId, orderId, reservationType, reqQty } = opts;

  const invRows = await db
    .select({ id: inventoryItemsTable.id })
    .from(inventoryItemsTable)
    .where(and(eq(inventoryItemsTable.sourceType, materialType), eq(inventoryItemsTable.sourceId, materialId), eq(inventoryItemsTable.isDeleted, false)))
    .limit(1);

  if (!invRows.length) return;

  const inventoryId = invRows[0].id;
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const rR = await client.query(
      `SELECT id, reserved_quantity FROM material_reservations
       WHERE inventory_id = $1 AND reservation_type = $2 AND reference_id = $3
         AND status = 'Active' AND reserved_quantity::numeric = $4 AND is_deleted = false
       ORDER BY id DESC LIMIT 1`,
      [inventoryId, reservationType, orderId, reqQty]
    );
    if (rR.rows.length > 0) {
      const resv = rR.rows[0];
      const col = reservationType === "Style" ? "style_reserved_qty" : "swatch_reserved_qty";
      await client.query(`UPDATE material_reservations SET status = 'Cancelled' WHERE id = $1`, [resv.id]);
      await client.query(
        `UPDATE inventory_items SET ${col} = GREATEST(0, ${col}::numeric - $1) WHERE id = $2`,
        [resv.reserved_quantity, inventoryId]
      );
      await client.query(
        `UPDATE inventory_items
         SET available_stock = GREATEST(0, current_stock::numeric - style_reserved_qty::numeric - swatch_reserved_qty::numeric),
             last_updated_at = NOW()
         WHERE id = $1`,
        [inventoryId]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("autoCancelReservation failed:", e);
  } finally {
    client.release();
  }
}

// ─── Costing PR Inventory Update ─────────────────────────────────────────────
// Called after every costing PR insert (swatch or style) to keep inventory_items,
// stock_ledger, inventory_stock_logs and the material/fabric master in sync.
async function applyCostingInventoryUpdate(opts: {
  client?: any; // <-- MADE OPTIONAL.
  prId: number;
  prNumber: string;
  bomRowId: number | null;
  poId: number;
  receivedQty: number;
  actualPrice: number;
  warehouseLocation: string;
  actor: string;
}): Promise<{ inventoryItemId: number } | null> {
  const {
    client, // May be undefined
    prId,
    prNumber,
    bomRowId,
    poId,
    receivedQty,
    actualPrice,
    warehouseLocation,
    actor
  } = opts;

  // --- DYNAMIC QUERY EXECUTOR (The Backward-Compatibility Engine) ---
  // If a transaction client is provided, use it. Otherwise, fallback to global pool.
  const q = async (text: string, params?: any[]) => {
    if (client) {
      return client.query(text, params);
    }
    // Fallback to your global pool (or 'db' if you use a different ORM)
    return pool.query(text, params);
  };

  // 1. Resolve materialType + materialId via the swatch_bom row
  let materialType: string | null = null;
  let materialId: number | null = null;

  let effectiveBomRowId = bomRowId;
  if (effectiveBomRowId == null) {
    const poRes = await q(
      `SELECT bom_items FROM purchase_orders WHERE id = $1 AND is_deleted = false`,
      [poId]
    );
    const bomItems: Array<{ bomRowId?: number }> = poRes.rows[0]?.bom_items ?? [];
    if (bomItems.length === 1) {
      effectiveBomRowId = bomItems[0].bomRowId ?? null;
    }
  }

  if (effectiveBomRowId != null) {
    const bomRes = await q(
      `SELECT material_type, material_id FROM swatch_bom WHERE id = $1 AND is_deleted = false`,
      [effectiveBomRowId]
    );
    if (bomRes.rows.length) {
      materialType = bomRes.rows[0].material_type as string;
      materialId = parseInt(bomRes.rows[0].material_id as string, 10);
    }
  }

  if (!materialType || !materialId) {
    return null; // No inventory item to update (existing behavior)
  }

  // --- Step 2: Lock and fetch inventory_items row (FOR UPDATE) ---
  const invRes = await q(
    `SELECT id, current_stock, average_price, style_reserved_qty, swatch_reserved_qty
     FROM inventory_items
     WHERE source_type = $1 AND source_id = $2 AND is_deleted = false
     FOR UPDATE`, // Safe in both transactional and auto-commit modes
    [materialType, materialId]
  );

  if (invRes.rows.length === 0) {
    throw new Error(`Inventory item not found for ${materialType}:${materialId}`);
  }

  const inv = invRes.rows[0];
  const inventoryId = inv.id;

  const prevStock = parseFloat(inv.current_stock ?? "0");
  const prevAvg = parseFloat(inv.average_price ?? "0");
  const newStock = prevStock + receivedQty;
  const newAvg = newStock > 0
    ? ((prevStock * prevAvg) + (receivedQty * actualPrice)) / newStock
    : actualPrice;

  const styleRes = parseFloat(inv.style_reserved_qty ?? "0");
  const swatchRes = parseFloat(inv.swatch_reserved_qty ?? "0");
  const newAvail = Math.max(0, newStock - styleRes - swatchRes);

  // --- Step 3: Update inventory_items ---
  await q(
    `UPDATE inventory_items
     SET current_stock = $1,
         available_stock = $2,
         average_price = $3,
         last_purchase_price = $4,
         last_updated_at = NOW()
     WHERE id = $5`,
    [
      newStock.toFixed(3),
      newAvail.toFixed(3),
      newAvg.toFixed(2),
      actualPrice.toFixed(2),
      inventoryId
    ]
  );

  // --- Step 3.5: Sync swatch_bom current_stock ---
  if (effectiveBomRowId != null) {
    await q(
      `UPDATE swatch_bom
      SET current_stock = $1,
          updated_at = NOW(),
          updated_by = $2
      WHERE id = $3
        AND is_deleted = false`,
      [
        newStock.toFixed(3),
        actor,
        effectiveBomRowId,
      ]
    );
  }

  // --- Step 4: Insert stock_ledger entry ---
  await q(
    `INSERT INTO stock_ledger
       (item_id, transaction_type, reference_number, reference_type,
        in_quantity, out_quantity, balance_quantity, remarks, created_by, created_at)
     VALUES ($1, 'purchase_receipt', $2, 'COSTING-PR', $3, 0, $4, $5, $6, NOW())`,
    [
      inventoryId,
      prNumber,
      receivedQty.toFixed(3),
      newStock.toFixed(3),
      `Costing PR ${prNumber}`,
      actor
    ]
  );

  // --- Step 5: Insert inventory_stock_logs (Non-critical - catches error) ---
  try {
    await q(
      `INSERT INTO inventory_stock_logs
         (inventory_item_id, action_type, quantity_before, quantity_after, quantity_delta,
          reference_type, reference_id, notes, created_by_name, created_at)
       VALUES ($1, 'receipt', $2, $3, $4, 'COSTING-PR', $5, $6, $7, NOW())`,
      [
        inventoryId,
        prevStock.toFixed(3),
        newStock.toFixed(3),
        receivedQty.toFixed(3),
        prId,
        `Costing PR ${prNumber}`,
        actor
      ]
    );
  } catch (logError) {
    // Log the error but do NOT throw; this is a non-critical audit log.
    console.error("[StockLog] Costing PR log failed (non-critical):", logError);
  }

  // --- Step 6: Lock and update material/fabric master (FOR UPDATE) ---
  const masterTable = materialType === "fabric" ? "fabrics" : "materials";

  const masterRes = await q(
    `SELECT current_stock, location_stocks
     FROM ${masterTable}
     WHERE id = $1 AND is_deleted = false
     FOR UPDATE`,
    [materialId]
  );

  if (masterRes.rows.length) {
    const masterRow = masterRes.rows[0];
    const masterNewStock = parseFloat(masterRow.current_stock ?? "0") + receivedQty;

    const resolvedLocation = warehouseLocation?.trim() || "Unallocated";
    const locStocks: Array<{ location: string; stock: string }> = masterRow.location_stocks ?? [];

    const locIdx = locStocks.findIndex(l => l.location === resolvedLocation);
    if (locIdx >= 0) {
      locStocks[locIdx].stock = (parseFloat(locStocks[locIdx].stock ?? "0") + receivedQty).toFixed(3);
    } else {
      locStocks.push({ location: resolvedLocation, stock: receivedQty.toFixed(3) });
    }

    await q(
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

  return { inventoryItemId: inventoryId };
}

/*
 * Creates a purchase_receipt_items row after inventory update.
 * Call this after applyCostingInventoryUpdate returns a result.
*/
async function createPurchaseReceiptItem(opts: {
  client: any; // Transactional pg client
  poId: number;
  prId: number;
  inventoryItemId: number;
  receivedQty: number;
  actualPrice: number;
  warehouseLocation: string;
  prRow: any;
}): Promise<void> {
  const {
    client,
    poId,
    prId,
    inventoryItemId,
    receivedQty,
    actualPrice,
    warehouseLocation,
    prRow
  } = opts;

  // Fetch the purchase_order_item for this inventory_item_id (No lock needed; PO is already locked)
  const poItemRes = await client.query(
    `SELECT 
       poi.id,
       poi.item_name,
       poi.item_code,
       poi.item_image,
       poi.vendor_id,
       poi.vendor_name
     FROM purchase_order_items poi
     WHERE poi.po_id = $1 AND poi.inventory_item_id = $2 AND poi.is_deleted = false
     LIMIT 1`,
    [poId, inventoryItemId]
  );

  const purchaseOrderItem = poItemRes.rows[0] as {
    id: number;
    item_name: string;
    item_code: string;
    item_image: string | null;
    vendor_id: number | null;
    vendor_name: string | null;
  } | undefined;

  // Insert into purchase_receipt_items
  await client.query(
    `INSERT INTO purchase_receipt_items
       (pr_id, inventory_item_id, item_name, item_code, quantity, unit_price,
        warehouse_location, po_item_id, item_image, vendor_id, vendor_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      prId,
      inventoryItemId,
      purchaseOrderItem?.item_name ?? "",
      purchaseOrderItem?.item_code ?? "",
      String(receivedQty),
      String(actualPrice),
      String(warehouseLocation ?? ""),
      purchaseOrderItem?.id ?? null,
      purchaseOrderItem?.item_image ?? null,
      purchaseOrderItem?.vendor_id ?? null,
      purchaseOrderItem?.vendor_name ?? null,
    ]
  );

  if (purchaseOrderItem?.id) {
    await client.query(
      `UPDATE purchase_order_items 
       SET received_quantity = received_quantity + $1, 
           updated_at = NOW() 
       WHERE id = $2`,
      [receivedQty, purchaseOrderItem.id]
    );
  }
  // If we found a vendor_name, update the parent purchase_receipts table
  if (purchaseOrderItem?.vendor_name && prRow) {
    await client.query(
      `UPDATE purchase_receipts SET vendor_name = $1 WHERE id = $2`,
      [purchaseOrderItem.vendor_name, prRow.id]
    );
  }
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
    newStatus = "In Process";
  }
  // Do not overwrite a Cancelled / Draft PO, and do not downgrade an already-Closed
  // PO (e.g. if a PR is later edited to reduce qty, leave it Closed unless user reopens).
  await client.query(
    `UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2 AND status NOT IN ('Draft','Cancelled')`,
    [newStatus, poId]
  );
}

// ─── Consumption Engine Helpers ───────────────────────────────────────────────
// Sections 2–4, 6–7, 10 of the Consumption Engine spec.
// Called after inserting a consumption_log entry to sync inventory, reservations,
// and stock_ledger. consumptionId is used as the ledger reference_number so the
// reversal helper can delete it precisely.
async function syncConsumptionWithInventory(opts: {
  bomRow: { materialType: string; materialId: number };
  orderId: number;
  reservationType: "Style" | "Swatch";
  consumedQty: number;
  consumptionId: number;
  actor: string;
  warehouseLocation?: string | null;
}): Promise<void> {
  const { bomRow, orderId, reservationType, consumedQty, consumptionId, actor, warehouseLocation } = opts;
  const col = reservationType === "Style" ? "style_reserved_qty" : "swatch_reserved_qty";

  // Find the inventory row
  const invRows = await db
    .select({ id: inventoryItemsTable.id })
    .from(inventoryItemsTable)
    .where(and(
      eq(inventoryItemsTable.sourceType, bomRow.materialType),
      eq(inventoryItemsTable.sourceId, bomRow.materialId),
      eq(inventoryItemsTable.isDeleted, false),
    ))
    .limit(1);

  if (!invRows.length) return;
  const inventoryId = invRows[0].id;

  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");

    // Section 2 — deduct current_stock
    await client.query(
      `UPDATE inventory_items SET current_stock = GREATEST(0, current_stock::numeric - $1) WHERE id = $2`,
      [consumedQty, inventoryId]
    );

    // Section 3 — adjust the matching active reservation
    const rR = await client.query(
      `SELECT id, reserved_quantity FROM material_reservations
       WHERE inventory_id = $1 AND reservation_type = $2 AND reference_id = $3 AND status = 'Active' AND is_deleted = false
       ORDER BY id DESC LIMIT 1`,
      [inventoryId, reservationType, orderId]
    );
    if (rR.rows.length > 0) {
      const resv = rR.rows[0];
      const oldQty = parseFloat(resv.reserved_quantity);
      const newQty = Math.max(0, oldQty - consumedQty);
      if (newQty <= 0) {
        // Fully consumed → Converted
        await client.query(
          `UPDATE material_reservations SET reserved_quantity = 0, status = 'Converted' WHERE id = $1`,
          [resv.id]
        );
        await client.query(
          `UPDATE inventory_items SET ${col} = GREATEST(0, ${col}::numeric - $1) WHERE id = $2`,
          [oldQty, inventoryId]
        );
      } else {
        // Partially consumed
        await client.query(
          `UPDATE material_reservations SET reserved_quantity = $1 WHERE id = $2`,
          [newQty, resv.id]
        );
        await client.query(
          `UPDATE inventory_items SET ${col} = GREATEST(0, ${col}::numeric - $1) WHERE id = $2`,
          [consumedQty, inventoryId]
        );
      }
    }

    // Section 2 — recalculate available_stock + Section 10 — touch last_updated_at
    await client.query(
      `UPDATE inventory_items
       SET available_stock = GREATEST(0, current_stock::numeric - style_reserved_qty::numeric - swatch_reserved_qty::numeric),
           last_updated_at = NOW()
       WHERE id = $1`,
      [inventoryId]
    );

    // Section 4 — stock ledger entry (reference_number = orderId so it joins to swatch/style orders)
    const balR = await client.query(`SELECT current_stock FROM inventory_items WHERE id = $1 AND is_deleted = false`, [inventoryId]);
    await client.query(
      `INSERT INTO stock_ledger (item_id, transaction_type, reference_number, reference_type, in_quantity, out_quantity, balance_quantity, remarks, created_by, consumption_log_id)
       VALUES ($1,'consumption',$2,$3,0,$4,$5,$6,$7,$8)`,
      [inventoryId, String(orderId), reservationType,
       consumedQty, balR.rows[0].current_stock,
       `Consumption from ${reservationType} Order #${orderId} (log #${consumptionId})`, actor, consumptionId]
    );

    // Update material/fabric master: current_stock and location_stocks
    const masterTable = bomRow.materialType === "fabric" ? "fabrics" : "materials";
    const masterRes = await client.query(
      `SELECT current_stock, location_stocks FROM ${masterTable} WHERE id = $1 AND is_deleted = false`,
      [bomRow.materialId]
    );
    if (masterRes.rows.length) {
      const masterRow = masterRes.rows[0] as { current_stock: string; location_stocks: Array<{location: string; stock: string}> };
      const newMasterStock = Math.max(0, parseFloat(masterRow.current_stock ?? "0") - consumedQty);
      const locStocks: Array<{location: string; stock: string}> = masterRow.location_stocks ?? [];
      if (warehouseLocation) {
        const locIdx = locStocks.findIndex(l => l.location === warehouseLocation);
        if (locIdx >= 0) {
          locStocks[locIdx].stock = Math.max(0, parseFloat(locStocks[locIdx].stock ?? "0") - consumedQty).toFixed(3);
        }
      }

      await client.query(
        `UPDATE ${masterTable} SET current_stock = $1, location_stocks = $2 WHERE id = $3`,
        [newMasterStock.toFixed(3), JSON.stringify(locStocks), bomRow.materialId]
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("syncConsumptionWithInventory failed:", e);
  } finally {
    client.release();
  }
}

// Reverses a consumption entry from inventory (Section 6).
async function reverseConsumptionFromInventory(opts: {
  entry: { id: number; swatchOrderId: number | null; styleOrderId: number | null; bomRowId: number; consumedQty: string; warehouseLocation?: string | null };
  materialType: string;
  materialId: number;
  actor: string;
}): Promise<void> {
  const { entry, materialType, materialId, actor } = opts;
  const consumedQty = parseFloat(entry.consumedQty) || 0;
  const orderId = entry.styleOrderId ?? entry.swatchOrderId;
  const reservationType: "Style" | "Swatch" = entry.styleOrderId ? "Style" : "Swatch";
  const col = reservationType === "Style" ? "style_reserved_qty" : "swatch_reserved_qty";

  const invRows = await db
    .select({ id: inventoryItemsTable.id })
    .from(inventoryItemsTable)
    .where(and(
      eq(inventoryItemsTable.sourceType, materialType),
      eq(inventoryItemsTable.sourceId, materialId),
      eq(inventoryItemsTable.isDeleted, false),
    ))
    .limit(1);

  if (!invRows.length) return;
  const inventoryId = invRows[0].id;

  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");

    // Restore current_stock
    await client.query(
      `UPDATE inventory_items SET current_stock = current_stock::numeric + $1 WHERE id = $2`,
      [consumedQty, inventoryId]
    );

    // Restore reservation — re-activate Converted or top-up Active
    const rR = await client.query(
      `SELECT id, reserved_quantity, status FROM material_reservations
       WHERE inventory_id = $1 AND reservation_type = $2 AND reference_id = $3 AND is_deleted = false
       ORDER BY id DESC LIMIT 1`,
      [inventoryId, reservationType, orderId]
    );
    if (rR.rows.length > 0) {
      const resv = rR.rows[0];
      const restored = parseFloat(resv.reserved_quantity) + consumedQty;
      await client.query(
        `UPDATE material_reservations SET reserved_quantity = $1, status = 'Active' WHERE id = $2`,
        [restored, resv.id]
      );
      await client.query(
        `UPDATE inventory_items SET ${col} = ${col}::numeric + $1 WHERE id = $2`,
        [consumedQty, inventoryId]
      );
    }

    // Recalculate available_stock + touch last_updated_at
    await client.query(
      `UPDATE inventory_items
       SET available_stock = GREATEST(0, current_stock::numeric - style_reserved_qty::numeric - swatch_reserved_qty::numeric),
           last_updated_at = NOW()
       WHERE id = $1`,
      [inventoryId]
    );

    // Remove ledger entry for this consumption log
    await client.query(
      `UPDATE stock_ledger SET is_deleted = true, deleted_by = $2, deleted_at = now() WHERE LOWER(REPLACE(transaction_type,' ','_')) = 'consumption' AND consumption_log_id = $1 AND is_deleted = false`,
      [String(entry.id), actor]
    );

    // Restore material/fabric master: current_stock and location_stocks
    const masterTable = materialType === "fabric" ? "fabrics" : "materials";
    const masterRes = await client.query(
      `SELECT current_stock, location_stocks FROM ${masterTable} WHERE id = $1 AND is_deleted = false`,
      [materialId]
    );
    if (masterRes.rows.length) {
      const masterRow = masterRes.rows[0] as { current_stock: string; location_stocks: Array<{location: string; stock: string}> };
      const newMasterStock = parseFloat(masterRow.current_stock ?? "0") + consumedQty;
      const locStocks: Array<{location: string; stock: string}> = masterRow.location_stocks ?? [];
      if (entry.warehouseLocation) {
        const locIdx = locStocks.findIndex(l => l.location === entry.warehouseLocation);
        if (locIdx >= 0) {
          locStocks[locIdx].stock = (parseFloat(locStocks[locIdx].stock ?? "0") + consumedQty).toFixed(3);
        } else {
          locStocks.push({ location: entry.warehouseLocation, stock: consumedQty.toFixed(3) });
        }
      }
      await client.query(
        `UPDATE ${masterTable} SET current_stock = $1, location_stocks = $2 WHERE id = $3`,
        [newMasterStock.toFixed(3), JSON.stringify(locStocks), materialId]
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("reverseConsumptionFromInventory failed:", e);
  } finally {
    client.release();
  }
}

// ─── Material Search (materials + fabrics combined) ───────────────────────────
router.get("/material-search", requireAuth, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const limit = 30;
  const [mats, fabs] = await Promise.all([
    db.select().from(materialsTable)
      .where(and(eq(materialsTable.isDeleted, false), q ? or(ilike(materialsTable.materialCode, `%${q}%`), ilike(materialsTable.colorName, `%${q}%`), ilike(materialsTable.type, `%${q}%`)) : undefined))
      .limit(limit),
    db.select().from(fabricsTable)
      .where(and(eq(fabricsTable.isDeleted, false), q ? or(ilike(fabricsTable.fabricCode, `%${q}%`), ilike(fabricsTable.colorName, `%${q}%`), ilike(fabricsTable.fabricType, `%${q}%`)) : undefined))
      .limit(limit),
  ]);
  const results = [
    ...mats.map(m => ({
      id: m.id, type: "material" as const,
      code: m.materialCode,
      name: `${m.type} — ${m.colorName}${m.size ? ` (${m.size})` : ""}`,
      currentStock: m.currentStock,
      avgUnitPrice: m.unitPrice,
      unitType: m.unitType,
      warehouseLocation: m.location ?? "",
    })),
    ...fabs.map(f => ({
      id: f.id, type: "fabric" as const,
      code: f.fabricCode,
      name: `${f.fabricType} — ${f.colorName}`,
      currentStock: f.currentStock,
      avgUnitPrice: f.pricePerMeter,
      unitType: f.unitType,
      warehouseLocation: f.location ?? "",
    })),
  ];
  return res.json({ data: results });
});

// ─── BOM ─────────────────────────────────────────────────────────────────────
router.get("/bom/:swatchOrderId", requireAuth, 
  checkPermission(STYLE_ORDER_TABS.COSTING),
  async (req, res) => {
  const swatchOrderId = Number(String(req.params.swatchOrderId));
  const rows = await db.select().from(swatchBomTable)
    .where(and(eq(swatchBomTable.swatchOrderId, swatchOrderId), eq(swatchBomTable.isDeleted, false)))
    .orderBy(swatchBomTable.createdAt);

  const enriched = await Promise.all(rows.map(async (r) => {
    const invRows = await db
      .select({ id: inventoryItemsTable.id, currentStock: inventoryItemsTable.currentStock, availableStock: inventoryItemsTable.availableStock, averagePrice: inventoryItemsTable.averagePrice })
      .from(inventoryItemsTable)
      .where(and(
        eq(inventoryItemsTable.sourceType, r.materialType ?? ""),
        eq(inventoryItemsTable.sourceId, r.materialId ?? 0),
        eq(inventoryItemsTable.isDeleted, false),
      ))
      .limit(1);
    const live = invRows[0] ?? null;

    // Fetch active reservation for this swatch order + inventory item
    let liveReservedQty: string | null = null;
    if (live) {
      const resvRows = await pool.query(
        `SELECT reserved_quantity FROM material_reservations
         WHERE inventory_id = $1 AND reservation_type = 'Swatch' AND reference_id = $2 AND status = 'Active' AND is_deleted = false
         ORDER BY id DESC LIMIT 1`,
        [live.id, swatchOrderId]
      );
      if (resvRows.rows.length > 0) liveReservedQty = resvRows.rows[0].reserved_quantity;
    }

    return {
      ...r,
      requiredQty: r.requiredQty || "0",    
      consumedQty: r.consumedQty || "0",       
      currentStock: r.currentStock || "0",     
      estimatedAmount: r.estimatedAmount || "0", 
      avgUnitPrice: live ? live.averagePrice : "0",     
      liveCurrentStock: live ? live.currentStock : null,
      liveAvailableStock: live ? live.availableStock : null,
      liveReservedQty,
    };
  }));

  return res.json({ data: enriched });
});

router.post("/bom", requireAuth,
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const { swatchOrderId, materialType, materialId, materialCode, materialName, currentStock, avgUnitPrice, unitType, warehouseLocation, requiredQty, targetVendorId, targetVendorName } = req.body as Record<string, string>;
  const reqQty = parseFloat(requiredQty) || 0;
  const price = parseFloat(avgUnitPrice) || 0;
  const estimatedAmount = (reqQty * price).toFixed(2);
  const matId = Number(materialId);
  const orderId = Number(swatchOrderId);
  const actor = user?.name || user?.email || "System";

  const [row] = await db.insert(swatchBomTable).values({
    swatchOrderId: orderId,
    materialType,
    materialId: matId,
    materialCode,
    materialName,
    currentStock,
    avgUnitPrice,
    unitType,
    warehouseLocation,
    requiredQty,
    estimatedAmount,
    targetVendorId: targetVendorId ? Number(targetVendorId) : null,
    targetVendorName: targetVendorName || null,
    createdBy: user.email,
  }).returning();

  // Commented as Reservation or Auto Reservation Feature is Excluded 
  // Section 1 — auto-reserve for Swatch BOM
  // let reservation: { status: string; reason?: string } = { status: "skipped" };
  // if (reqQty > 0) {
  //   reservation = await autoReserveForBom({
  //     materialType, materialId: matId, orderId, reservationType: "Swatch",
  //     reqQty, bomRowId: row.id, materialName, actor,
  //   });
  // }

  return res.status(201).json({ data: row});
});

router.patch("/bom/:id", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const { consumedQty } = req.body as { consumedQty?: string };
  const updates: Record<string, unknown> = { updatedBy: user.email, updatedAt: new Date() };
  if (consumedQty !== undefined) updates.consumedQty = consumedQty;
  const [row] = await db.update(swatchBomTable).set(updates).where(eq(swatchBomTable.id, Number(String(req.params.id)))).returning();
  return res.json({ data: row });
});

// ─── Edit BOM Required Qty (with reservation cascade + audit log) ─────────────
async function adjustBomQty(opts: {
  bomRowId: number;
  inventoryId: number;
  orderId: number;
  reservationType: "Style" | "Swatch";
  oldQty: number;
  newQty: number;
  materialCode: string;
  materialName: string;
  notes: string | null;
  actor: string;
}): Promise<{ success: boolean; error?: string }> {
  const { bomRowId, inventoryId, orderId, reservationType, oldQty, newQty, materialCode, materialName, notes, actor } = opts;
  const delta = newQty - oldQty;
  if (delta === 0) return { success: true };

  const col = reservationType === "Style" ? "style_reserved_qty" : "swatch_reserved_qty";
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");

    const existR = await client.query(
      `SELECT id, reserved_quantity FROM material_reservations
       WHERE inventory_id = $1 AND reservation_type = $2 AND reference_id = $3 AND status = 'Active' AND is_deleted = false
       ORDER BY id DESC LIMIT 1`,
      [inventoryId, reservationType, orderId]
    );

    let actualResDelta = delta;

    if (existR.rows.length > 0) {
      const existing = existR.rows[0];
      const oldReserved = parseFloat(existing.reserved_quantity);
      const newReserved = oldReserved + delta;

      if (newReserved < 0) {
        await client.query("ROLLBACK");
        return { success: false, error: `Cannot reduce reservation below 0. Currently reserved: ${oldReserved.toFixed(3)}` };
      }

      const consumedR = await client.query(
        `SELECT COALESCE(SUM(out_quantity::numeric), 0) AS total
         FROM stock_ledger
         WHERE item_id = $1 AND LOWER(REPLACE(transaction_type,' ','_')) = 'consumption'
           AND reference_number = $2::text AND reference_type = $3 AND is_deleted = false`,
        [inventoryId, String(orderId), reservationType]
      );
      const totalConsumed = parseFloat(consumedR.rows[0].total);
      if (newReserved < totalConsumed) {
        await client.query("ROLLBACK");
        return { success: false, error: `Cannot reduce reservation below already consumed qty (${totalConsumed.toFixed(3)})` };
      }

      await client.query(
        `UPDATE material_reservations SET reserved_quantity = $1 WHERE id = $2`,
        [newReserved.toFixed(4), existing.id]
      );
    } else if (delta > 0) {
      const availR = await client.query(`SELECT available_stock FROM inventory_items WHERE id = $1 AND is_deleted = false`, [inventoryId]);
      const avail = parseFloat(availR.rows[0]?.available_stock ?? "0");
      if (delta > avail) {
        await client.query("ROLLBACK");
        return { success: false, error: `Insufficient stock — need additional ${delta.toFixed(3)}, only ${avail.toFixed(3)} available` };
      }
      const today = new Date().toISOString().slice(0, 10);
      await client.query(
        `INSERT INTO material_reservations
           (item_id, inventory_id, reservation_type, reference_id, reserved_quantity, status, remarks, reserved_by, reservation_date)
         VALUES ($1,$2,$3,$4,$5,'Active',$6,$7,$8)`,
        [inventoryId, inventoryId, reservationType, orderId, delta.toFixed(4),
         `BOM row ${bomRowId} — ${materialName}`, actor, today]
      );
    } else {
      actualResDelta = 0;
    }

    if (actualResDelta !== 0) {
      await client.query(
        `UPDATE inventory_items SET ${col} = GREATEST(0, ${col}::numeric + $1) WHERE id = $2`,
        [actualResDelta, inventoryId]
      );
    }

    await client.query(
      `UPDATE inventory_items
       SET available_stock = GREATEST(0, current_stock::numeric - style_reserved_qty::numeric - swatch_reserved_qty::numeric),
           last_updated_at = NOW()
       WHERE id = $1`,
      [inventoryId]
    );

    if (actualResDelta !== 0) {
      const balR = await client.query(`SELECT current_stock FROM inventory_items WHERE id = $1 AND is_deleted = false`, [inventoryId]);
      const absDelta = Math.abs(actualResDelta);
      const txType = actualResDelta > 0 ? `${reservationType.toLowerCase()}_reservation` : "reservation_release";
      await client.query(
        `INSERT INTO stock_ledger (item_id, transaction_type, reference_number, reference_type, in_quantity, out_quantity, balance_quantity, remarks, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [inventoryId, txType, String(orderId), reservationType,
         actualResDelta > 0 ? 0 : absDelta,
         actualResDelta > 0 ? absDelta : 0,
         balR.rows[0].current_stock,
         `BOM qty edit for ${reservationType} Order #${orderId}: ${oldQty} → ${newQty} (reservation ${actualResDelta > 0 ? "+" : ""}${actualResDelta.toFixed(3)})`,
         actor]
      );
    }

    await client.query(
      `INSERT INTO bom_change_log
         (bom_row_id, bom_type, order_id, inventory_id, material_code, material_name, old_qty, new_qty, delta, reservation_delta, notes, changed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [bomRowId, reservationType, orderId, inventoryId, materialCode, materialName,
       oldQty.toFixed(4), newQty.toFixed(4), delta.toFixed(4), actualResDelta.toFixed(4), notes ?? null, actor]
    );

    await client.query("COMMIT");
    return { success: true };
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("adjustBomQty failed:", e);
    return { success: false, error: "Failed to adjust BOM quantity" };
  } finally {
    client.release();
  }
}

router.patch("/bom/:id/qty", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  try {
    const user = (req as any).user;
    const actor = user?.name || user?.email || "System";
    const bomId = Number(String(req.params.id));
    const { requiredQty, notes } = req.body as { requiredQty: string; notes?: string };

    const [bomRow] = await db.select().from(swatchBomTable).where(and(eq(swatchBomTable.id, bomId), eq(swatchBomTable.isDeleted, false))).limit(1);
    if (!bomRow) { res.status(404).json({ error: "BOM row not found" }); return; }

    const oldQty = parseFloat(bomRow.requiredQty);
    const newQty = parseFloat(requiredQty);
    if (isNaN(newQty) || newQty <= 0) { res.status(400).json({ error: "Required qty must be > 0" }); return; }
    if(isNaN(newQty) || newQty < Number(bomRow.consumedQty)) { res.status(400).json({ error: "Required qty must be greater or equal to consumed Quantity" }); return; }
    if (Math.abs(newQty - oldQty) < 0.0001) { res.json({ data: bomRow, changed: false }); return; }

    const orderId = (bomRow.styleOrderId ?? bomRow.swatchOrderId) as number;
    const reservationType: "Style" | "Swatch" = bomRow.styleOrderId ? "Style" : "Swatch";

    const invRows = await db.select({ id: inventoryItemsTable.id })
      .from(inventoryItemsTable)
      .where(and(eq(inventoryItemsTable.sourceType, bomRow.materialType), eq(inventoryItemsTable.sourceId, bomRow.materialId), eq(inventoryItemsTable.isDeleted, false)))
      .limit(1);

    if (!invRows.length) { res.status(400).json({ error: "No inventory record for this material" }); return; }

    const result = await adjustBomQty({
      bomRowId: bomId, inventoryId: invRows[0].id, orderId, reservationType,
      oldQty, newQty, materialCode: bomRow.materialCode, materialName: bomRow.materialName,
      notes: notes ?? null, actor,
    });

    if (!result.success) { res.status(400).json({ error: result.error }); return; }

    const estimatedAmount = (newQty * parseFloat(bomRow.avgUnitPrice || "0")).toFixed(2);
    const [updated] = await db.update(swatchBomTable)
      .set({ requiredQty: String(newQty), estimatedAmount, updatedBy: user.email, updatedAt: new Date() })
      .where(eq(swatchBomTable.id, bomId))
      .returning();

    return res.json({ data: updated, changed: true });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Failed to update BOM qty" });
  }
});

router.get("/bom/:id/log", requireAuth, 
  checkPermission({ any : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.VIEW] }), 
  async (req, res) => {
  try {
    const rows = await pool.query(
      `SELECT * FROM bom_change_log WHERE bom_row_id = $1 AND is_deleted = false ORDER BY changed_at DESC`,
      [Number(String(req.params.id))]
    );
    const data = rows.rows.map((row) => ({
      ...row,
      old_qty : isNaN(Number(row.old_qty)) ? "0" : row.old_qty,
      delta: isNaN(Number(row.delta)) ? "0" : row.delta,
    }));
    return res.json({ data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/bom/:id", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.DELETE] }), 
  async (req, res) => {
  const user = (req as any).user;
  const bomId = Number(String(req.params.id));
  const [bomRow] = await db.select().from(swatchBomTable).where(and(eq(swatchBomTable.id, bomId), eq(swatchBomTable.isDeleted, false))).limit(1);
  const [deleted] = await db.update(swatchBomTable)
    .set({ isDeleted: true, updatedBy: user.email, updatedAt: new Date(), deletedBy: user.email, deletedAt: new Date() })
    .where(and(eq(swatchBomTable.id, bomId), eq(swatchBomTable.isDeleted, false)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }

  if (bomRow && bomRow.materialId && bomRow.materialType && bomRow.requiredQty) {
    const reqQty = parseFloat(bomRow.requiredQty);
    if (reqQty > 0) {
      // Determine if this was a Swatch BOM row or a Style BOM row
      const reservationType: "Style" | "Swatch" = bomRow.styleOrderId ? "Style" : "Swatch";
      const orderId = (bomRow.styleOrderId ?? bomRow.swatchOrderId) as number;
      await autoCancelReservation({
        materialType: bomRow.materialType,
        materialId: bomRow.materialId,
        orderId,
        reservationType,
        reqQty,
      });
    }
  }

  return res.json({ success: true });
});

// ─── PO Number Generator (with transaction support) ─────────────────────
async function nextPoNumber(client?: any): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  let maxNum: number;

  if (client) {
    // Use the transaction client – sees uncommitted rows inside the same TX
    const res = await client.query(
      `SELECT MAX(CAST(SUBSTRING(po_number FROM '^PO-${year}-([0-9]{4})$') AS INTEGER)) AS max_num
       FROM purchase_orders
       WHERE po_number LIKE 'PO-${year}-%'`
    );
    maxNum = parseInt(res.rows[0]?.max_num ?? '0');
  } else {
    // Fallback: global connection (backward compatibility)
    const all = await db.select({ n: purchaseOrdersTable.poNumber }).from(purchaseOrdersTable);
    const nums = all.map(r => parseInt(r.n.split("-").pop() ?? "0")).filter(n => !isNaN(n));
    maxNum = nums.length ? Math.max(...nums) : 0;
  }

  const next = maxNum + 1;
  return `PO-${year}-${String(next).padStart(4, '0')}`;
}

async function nextPrNumber(): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const all = await db.select({ n: purchaseReceiptsTable.prNumber }).from(purchaseReceiptsTable);
  const nums = all.map(r => parseInt(r.n.split("-").pop() ?? "0")).filter(n => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `PR-${year}-${String(next).padStart(4, "0")}`;
}

// ─── PO ──────────────────────────────────────────────────────────────────────
router.get("/po/:swatchOrderId", requireAuth,
  checkPermission(STYLE_ORDER_TABS.COSTING),
  async (req, res) => {
  const rows = await db.select().from(purchaseOrdersTable)
    .where(and(eq(purchaseOrdersTable.swatchOrderId, Number(String(req.params.swatchOrderId))), eq(purchaseOrdersTable.isDeleted, false)))
    .orderBy(purchaseOrdersTable.createdAt);
  return res.json({ data: rows });
});

router.post("/po", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const { swatchOrderId, vendorId, notes, bomItems } = req.body as {
    swatchOrderId: number;
    vendorId?: number; // Kept for backward compatibility, but now ignored if items have their own vendors
    notes?: string;
    bomItems?: {
      bomRowId: number;
      materialCode: string;
      materialName: string;
      unitType: string;
      targetPrice: string;
      quantity: string;
      targetVendorId?: number;
      targetVendorName?: string;
    }[];
  };

  const items = bomItems ?? [];

  if (!items.length) {
    return res.status(400).json({ error: "At least one material is required" });
  }

  // ─── FETCH INVENTORY ITEM IDs BY MATERIAL CODE ───────────────────────────
  const materialCodes = [...new Set(items.map(i => i.materialCode))];
  const inventoryItems = materialCodes.length > 0
    ? await db.select({ id: inventoryItemsTable.id, code: inventoryItemsTable.itemCode })
        .from(inventoryItemsTable)
        .where(and(inArray(inventoryItemsTable.itemCode, materialCodes), eq(inventoryItemsTable.isDeleted, false)))
    : [];

  const inventoryMap = new Map(inventoryItems.map(i => [i.code, i.id]));

  // ─── START TRANSACTION ───────────────────────────────────────────────────
  const client = await (pool as any).connect();

  try {
    await client.query("BEGIN");

    const createdPOs: any[] = [];

    // ─── LOOP OVER EACH MATERIAL AND CREATE A SEPARATE PO ──────────────────
    for (const item of items) {
      // Determine vendor for this specific item
      let vendorIdForPO: number | null = null;
      let vendorNameForPO: string | null = null;

      if (item.targetVendorId) {
        // Item has its own vendor
        const [vendor] = await db
          .select({ id: vendorsTable.id, brandName: vendorsTable.brandName })
          .from(vendorsTable)
          .where(and(eq(vendorsTable.id, item.targetVendorId), eq(vendorsTable.isDeleted, false)));

        if (vendor) {
          vendorIdForPO = vendor.id;
          vendorNameForPO = vendor.brandName;
        } else {
          // If vendor not found, use the provided name as fallback
          vendorNameForPO = item.targetVendorName ?? null;
        }
      } else if (item.targetVendorName) {
        // Only vendor name provided (no ID)
        vendorNameForPO = item.targetVendorName;
      } else if (vendorId) {
        // Fallback to header-level vendor (legacy support)
        const [vendor] = await db
          .select({ id: vendorsTable.id, brandName: vendorsTable.brandName })
          .from(vendorsTable)
          .where(and(eq(vendorsTable.id, vendorId), eq(vendorsTable.isDeleted, false)));

        if (vendor) {
          vendorIdForPO = vendor.id;
          vendorNameForPO = vendor.brandName;
        }
      }

      // If still no vendor, set a placeholder
      if (!vendorNameForPO) {
        vendorNameForPO = "Unknown Vendor";
      }

      const inventoryItemId = inventoryMap.get(item.materialCode) ?? null;
      const poNumber = await nextPoNumber(client);

      // ─── INSERT PO HEADER (single vendor, single item) ──────────────────
      const poResult = await client.query(
        `INSERT INTO purchase_orders
          (po_number, swatch_order_id, reference_type, reference_id, vendor_mode,
            vendor_id, vendor_name, status, notes, bom_row_ids, bom_items, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING id, po_number, swatch_order_id, reference_type, reference_id, vendor_mode,
                  vendor_id, vendor_name, status, notes, bom_row_ids, bom_items, created_by,
                  created_at`,
        [
          poNumber,
          Number(swatchOrderId),
          "Swatch",
          Number(swatchOrderId),
          "header", // Each PO has a single vendor (header mode)
          vendorIdForPO,
          vendorNameForPO,
          "Draft",
          notes ?? null,
          JSON.stringify([item.bomRowId]), // Single BOM row ID
          JSON.stringify([item]), // Single BOM item
          user.email,
        ]
      );

      const po = poResult.rows[0];
      createdPOs.push(po);

      // ─── INSERT PO ITEM (single item per PO) ──────────────────────────
      await client.query(
        `INSERT INTO purchase_order_items
           (po_id, inventory_item_id, item_name, item_code,
            ordered_quantity, received_quantity, unit_price,
            warehouse_location, remarks, item_image,
            vendor_id, vendor_name)
         VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8,$9,$10,$11)`,
        [
          po.id,
          inventoryItemId,
          item.materialName || item.materialCode,
          item.materialCode,
          item.quantity,
          item.targetPrice,
          "",
          null,
          null,
          vendorIdForPO, // Same vendor as header
          vendorNameForPO, // Same vendor as header
        ]
      );
    }

    await client.query("COMMIT");

    // ─── EMAIL NOTIFICATION (outside transaction) ──────────────────────────
    // Send one email per created PO
    const adminUsers = await db.select({ email: usersTable.email }).from(usersTable).where(
      and(eq(usersTable.role, "admin"), eq(usersTable.isDeleted, false))
    );
    const adminEmails = adminUsers.map(u => u.email).filter(Boolean) as string[];

    if (adminEmails.length > 0 && createdPOs.length > 0) {
      const apiBase = process.env.API_BASE_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "zari-erp.replit.app"}`;
      const frontendUrl = process.env.FRONTEND_URL;
      const erpUrl = `${frontendUrl}/swatch-orders/${swatchOrderId}`;

      // Send email for each PO
      for (const po of createdPOs) {
        const approveToken = jwt.sign(
          { poId: po.id, action: "approve" },
          process.env.SESSION_SECRET ?? "secret",
          { expiresIn: "7d" }
        );
        const rejectToken = jwt.sign(
          { poId: po.id, action: "reject" },
          process.env.SESSION_SECRET ?? "secret",
          { expiresIn: "7d" }
        );

        sendPoApprovalRequestEmail({
          adminEmails,
          poNumber: po.po_number,
          vendorName: po.vendor_name ?? "Unknown Vendor",
          createdBy: user.email,
          referenceType: "Swatch",
          referenceId: swatchOrderId,
          itemCount: 1, // Each PO has exactly one item
          erpUrl,
          approveUrl: `${apiBase}/api/costing/po-action?token=${approveToken}`,
          rejectUrl: `${apiBase}/api/costing/po-action?token=${rejectToken}`,
        }).then(() => {
            console.log("Email sent successfully");
        })
        .catch((err) => {
            console.error("EMAIL FAILED");
            console.error(err);
        });
      }
    }

    return res.status(201).json({ 
      data: createdPOs, 
      message: `${createdPOs.length} purchase order(s) created successfully` 
    });

  } catch (error) {
    // ─── ROLLBACK ON ANY ERROR ─────────────────────────────────────────────
    await client.query("ROLLBACK").catch(() => {});
    console.error("PO creation failed:", error);
    return res.status(500).json({ error: "Failed to create purchase order(s)", detail: (error as Error).message });

  } finally {
    // ─── ALWAYS RELEASE CLIENT ───────────────────────────────────────────────
    client.release();
  }
});

router.patch("/po/:id", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const poId = Number(req.params.id);

  const {
    status,
    notes,
    bomItems,
  } = req.body as {
    status?: string;
    notes?: string;
    bomItems?: any[];
  };

  const updates: Record<string, unknown> = {
    updatedBy: user.email,
    updatedAt: new Date(),
  };

  if (status !== undefined) {
    updates.status = status;

    if (status === "Approved") {
      updates.approvedBy = user.email;
      updates.approvedAt = new Date();
    }
  }

  if (notes !== undefined) {
    updates.notes = notes;
  }

  if (bomItems !== undefined) {
    // Fetch existing PO items
    const { rows: poItems } = await pool.query(
      `
      SELECT
        item_code,
        received_quantity
      FROM purchase_order_items
      WHERE po_id = $1
        AND is_deleted = false
      `,
      [poId]
    );

    // Create lookup: item_code -> received_quantity
    const receivedMap = new Map(
      poItems.map((item: any) => [
        item.item_code,
        Number(item.received_quantity),
      ])
    );

    // Validate edited quantity
    for (const item of bomItems) {
      const receivedQty = receivedMap.get(item.materialCode) ?? 0;

      if (Number(item.quantity) < receivedQty) {
        return res.status(400).json({
          message: `${item.materialName} ordered quantity cannot be less than already received quantity (${receivedQty}).`,
        });
      }
    }

    // Update ordered quantity in purchase_order_items
    for (const item of bomItems) {
      await pool.query(
        `
        UPDATE purchase_order_items
        SET
          ordered_quantity = $1,
          updated_at = NOW()
        WHERE po_id = $2
          AND item_code = $3
          AND is_deleted = false
        `,
        [
          Number(item.quantity),
          poId,
          item.materialCode,
        ]
      );
    }

    // Update JSON snapshot
    updates.bomItems = bomItems;
    updates.bomRowIds = bomItems.map((i: any) => i.bomRowId);
  }

  const [row] = await db
    .update(purchaseOrdersTable)
    .set(updates)
    .where(eq(purchaseOrdersTable.id, poId))
    .returning();

  // Recalculate PO status if quantities changed
  if (bomItems !== undefined) {
    await recalcPoStatus(
      {
        query: pool.query.bind(pool),
      },
      poId
    );
  }

  return res.json({ data: row });
});

router.delete("/po/:id", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.DELETE] }), 
  async (req, res) => {
  const user = (req as any).user;
  const [row] = await db.update(purchaseOrdersTable)
    .set({ isDeleted: true, updatedBy: user.email, updatedAt: new Date(), deletedBy: user.email, deletedAt: new Date() })
    .where(and(eq(purchaseOrdersTable.id, Number(String(req.params.id))), eq(purchaseOrdersTable.isDeleted, false)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  return res.json({ success: true });
});

// ─── PR ──────────────────────────────────────────────────────────────────────
router.get("/pr/:swatchOrderId", requireAuth, 
  checkPermission({ any : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.VIEW] }), 
  async (req, res) => {
    try {
      const swatchOrderId = Number(String(req.params.swatchOrderId));

      const query = `
        WITH
        receipt_items AS (
          SELECT
            pr_id,
            SUM(quantity * unit_price) AS items_total
          FROM purchase_receipt_items
          WHERE is_deleted = false
          GROUP BY pr_id
        ),
        receipt_payments AS (
          SELECT
            pr_id,
            SUM(base_currency_amount) AS paid_amount
          FROM pr_payments
          WHERE is_deleted = false
          GROUP BY pr_id
        )
        SELECT
          pr.id,
          pr.pr_number AS "prNumber",
          pr.po_id AS "poId",
          pr.bom_row_id AS "bomRowId",
          pr.swatch_order_id AS "swatchOrderId",
          pr.style_order_id AS "styleOrderId",
          pr.vendor_name AS "vendorName",
          pr.received_date AS "receivedDate",
          pr.received_qty AS "receivedQty",
          pr.actual_price AS "actualPrice",
          pr.warehouse_location AS "warehouseLocation",
          pr.status,
          pr.vendor_invoice_number AS "vendorInvoiceNumber",
          pr.vendor_invoice_date AS "vendorInvoiceDate",
          pr.vendor_invoice_amount AS "vendorInvoiceAmount",
          pr.vendor_invoice_file AS "vendorInvoiceFile",
          pr.vendor_invoice_uploaded_at AS "vendorInvoiceUploadedAt",
          pr.vendor_invoice_currency_code AS "vendorInvoiceCurrencyCode",
          pr.vendor_invoice_exchange_rate AS "vendorInvoiceExchangeRate",
          pr.created_by AS "createdBy",
          pr.created_at AS "createdAt",
          pr.updated_by AS "updatedBy",
          pr.updated_at AS "updatedAt",
          pr.is_deleted AS "isDeleted",
          pr.deleted_by AS "deletedBy",
          pr.deleted_at AS "deletedAt",
          COALESCE(
            pr.vendor_invoice_amount,
            (pr.received_qty::numeric * pr.actual_price::numeric),
            ri.items_total,
            0
          ) AS "totalAmount",
          COALESCE(rp.paid_amount, 0) AS "paidAmount",
          COALESCE(
            pr.vendor_invoice_amount,
            (pr.received_qty::numeric * pr.actual_price::numeric),
            ri.items_total,
            0
          ) - COALESCE(rp.paid_amount, 0) AS "balance"
        FROM purchase_receipts pr
        LEFT JOIN receipt_items ri ON ri.pr_id = pr.id
        LEFT JOIN receipt_payments rp ON rp.pr_id = pr.id
        WHERE pr.swatch_order_id = $1
          AND pr.is_deleted = false
        ORDER BY pr.created_at ASC
      `;

      const result = await pool.query(query, [swatchOrderId]);
      return res.json({ data: result.rows });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch purchase receipts" });
    }
  }
);

router.post("/pr", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const { poId, swatchOrderId, bomRowId, receivedQty, actualPrice, warehouseLocation } = req.body as Record<string, string | number | null>;

  // Parse early for calculations
  const newQty = parseFloat(String(receivedQty)) || 0;
  const resolvedBomRowId = bomRowId != null ? Number(bomRowId) : null;

  // Get a dedicated client from the pool
  const client = await pool.connect();

  try {
    // 1. Start transaction and set timeouts to prevent deadlocks
    await client.query('BEGIN');
    await client.query('SET LOCAL lock_timeout = \'2s\'');      // Fail fast if locked
    await client.query('SET LOCAL statement_timeout = \'5s\''); // Kill slow queries

    // 2. Lock the Purchase Order (FOR UPDATE) - This is the critical guard
    const poResult = await client.query(
      `SELECT id, status, bom_items
       FROM purchase_orders
       WHERE id = $1 AND is_deleted = false
       FOR UPDATE`,
      [Number(poId)]
    );

    if (poResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "PO not found" });
    }

    const po = poResult.rows[0];
    const bomItems = po.bom_items ?? [];
    const isSingleItem = bomItems.length === 1;

    // 3. Re-validate PO status inside the transaction
    if (!["Approved", "In Process", "Partially Received"].includes(po.status)) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: `Purchase Receipt cannot be created: PO is currently in "${po.status}" status. An admin must approve it first.`
      });
    }

    // 4. Calculate "orderedQty" based on BOM (same logic as original)
    let orderedQty = 0;
    if (resolvedBomRowId != null) {
      const item = bomItems.find((i: any) => i.bomRowId === resolvedBomRowId);
      orderedQty = parseFloat(item?.quantity ?? "0") || 0;
    } else if (isSingleItem) {
      orderedQty = parseFloat(bomItems[0]?.quantity ?? "0") || 0;
    }

    // 5. Lock existing PRs for this PO and calculate "alreadyReceived" INSIDE the transaction
    const prResult = await client.query(
      `SELECT received_qty, bom_row_id
       FROM purchase_receipts
       WHERE po_id = $1 AND is_deleted = false
       FOR UPDATE`, // Prevents concurrent PR creation
      [Number(poId)]
    );

    const existingPrs = prResult.rows;
    const relevantPrs = resolvedBomRowId != null
      ? existingPrs.filter((pr: any) => pr.bom_row_id === resolvedBomRowId)
      : (isSingleItem ? existingPrs : existingPrs.filter((pr: any) => pr.bom_row_id == null));

    const alreadyReceived = relevantPrs.reduce((sum: number, pr: any) => sum + (parseFloat(pr.received_qty) || 0), 0);

    // 6. Validate received quantity against remaining (same logic, now race-condition-safe)
    if (orderedQty > 0) {
      if (alreadyReceived >= orderedQty) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `This item is already fully received (${alreadyReceived} / ${orderedQty}). No further PR is allowed.`
        });
      }
      // const remaining = orderedQty - alreadyReceived;
      const remaining = Math.max( 0, orderedQty - alreadyReceived );

      // if (newQty > remaining) {
      //   await client.query('ROLLBACK');
      //   return res.status(400).json({
      //     error: `Received quantity (${newQty}) exceeds remaining ordered quantity. Max allowed: ${remaining.toFixed(4)}`
      //   });
      // }
    }

    // 7. Generate PR number and insert the new Purchase Receipt
    const prNumber = await nextPrNumber(); // Ensure this uses a SEQUENCE to avoid conflicts
    const insertPrResult = await client.query(
      `INSERT INTO purchase_receipts
       (pr_number, po_id, bom_row_id, swatch_order_id, vendor_name, received_qty, actual_price, warehouse_location, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, pr_number`,
      [
        prNumber,
        Number(poId),
        resolvedBomRowId,
        Number(swatchOrderId),
        "", // vendorName is updated later by createPurchaseReceiptItem
        String(receivedQty),
        String(actualPrice),
        String(warehouseLocation ?? ""),
        "Open",
        user.email
      ]
    );

    const newPrRow = insertPrResult.rows[0];

    // 8. Call Inventory Update Helper (passing the transactional client)
    const inventoryResult = await applyCostingInventoryUpdate({
      client: client, // <-- Transactional client
      prId: newPrRow.id,
      prNumber: newPrRow.pr_number,
      bomRowId: resolvedBomRowId,
      poId: Number(poId),
      receivedQty: newQty,
      actualPrice: parseFloat(String(actualPrice)) || 0,
      warehouseLocation: String(warehouseLocation ?? ""),
      actor: user.email,
    });

    // 9. Call PR Items Helper (passing the transactional client)
    if (inventoryResult) {
      await createPurchaseReceiptItem({
        client: client, // <-- Transactional client
        poId: Number(poId),
        prId: newPrRow.id,
        inventoryItemId: inventoryResult.inventoryItemId,
        receivedQty: newQty,
        actualPrice: parseFloat(String(actualPrice)) || 0,
        warehouseLocation: String(warehouseLocation ?? ""),
        prRow: newPrRow
      });
    }

    // 10. Update PO status if it was "Approved"
    await recalcPoStatus(client, Number(poId));
    // 11. Commit the entire transaction atomically
    await client.query('COMMIT');

    return res.status(201).json({ data: newPrRow });

  } catch (error) {
    // Rollback on any exception
    await client.query('ROLLBACK');
    console.error("[PR Creation] Transaction failed:", error);
    return res.status(500).json({ error: "Internal server error during PR creation" });
  } finally {
    // Always release the client back to the pool
    client.release();
  }
});

router.patch("/pr/:id", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const { status, actualPrice, warehouseLocation, receivedDate } = req.body as {
    status?: string; actualPrice?: string | number; warehouseLocation?: string; receivedDate?: string;
  };
  const updates: Record<string, unknown> = { updatedBy: user.email, updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  if (actualPrice !== undefined) updates.actualPrice = String(actualPrice);
  if (warehouseLocation !== undefined) updates.warehouseLocation = String(warehouseLocation);
  if (receivedDate !== undefined) updates.receivedDate = new Date(String(receivedDate));
  const [row] = await db.update(purchaseReceiptsTable).set(updates).where(eq(purchaseReceiptsTable.id, Number(String(req.params.id)))).returning();
  return res.json({ data: row });
});

router.delete("/pr/:id", requireAuth,
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.DELETE] }), 
  async (req, res) => {
  const user = (req as any).user;
  const [row] = await db.update(purchaseReceiptsTable)
    .set({ isDeleted: true, updatedBy: user.email, updatedAt: new Date(), deletedBy: user.email, deletedAt: new Date() })
    .where(and(eq(purchaseReceiptsTable.id, Number(String(req.params.id))), eq(purchaseReceiptsTable.isDeleted, false)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  return res.json({ success: true });
});

// ─── Payments ─────────────────────────────────────────────────────────────────
router.get("/payments/:prId", requireAuth, 
  checkPermission({ any : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.VIEW] }), 
  async (req, res) => {
  const rows = await db.select().from(prPaymentsTable)
    .where(and(eq(prPaymentsTable.prId, Number(String(req.params.prId))), eq(prPaymentsTable.isDeleted, false)))
    .orderBy(prPaymentsTable.createdAt);
  return res.json({ data: rows });
});

router.post("/payments", requireAuth, 
  checkPermission({ any : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const { prId, paymentType, paymentDate, paymentMode, amount, currencyCode, exchangeRateSnapshot, transactionStatus, paymentStatus, attachment } = req.body as Record<string, unknown>;
  const savedAttachment = await persistAttachmentObject(attachment, { entity: "procurement", category: "pr-payments" });
  const payRate = parseFloat(String(exchangeRateSnapshot ?? "1")) || 1;        // pay ccy -> INR
  const baseAmt = (parseFloat(String(amount ?? "0")) * payRate).toFixed(2);    // INR anchor
  const [row] = await db.insert(prPaymentsTable).values({
    prId: Number(prId),
    paymentType: String(paymentType),
    paymentDate: paymentDate ? new Date(String(paymentDate)) : new Date(),
    paymentMode: String(paymentMode ?? ""),
    amount: String(amount),
    currencyCode: String(currencyCode ?? "INR"),
    exchangeRateSnapshot: String(payRate),
    baseCurrencyAmount: baseAmt,
    transactionStatus: String(transactionStatus ?? ""),
    paymentStatus: String(paymentStatus ?? "Pending"),
    attachment: savedAttachment,
    createdBy: user.email,
  }).returning();
  return res.status(201).json({ data: row });
});

router.delete("/payments/:id", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.DELETE] }), 
  async (req, res) => {
  const user = (req as any).user;
  const [row] = await db.update(prPaymentsTable)
    .set({ isDeleted: true, updatedBy: user.email, updatedAt: new Date(), deletedBy: user.email, deletedAt: new Date() })
    .where(and(eq(prPaymentsTable.id, Number(String(req.params.id))), eq(prPaymentsTable.isDeleted, false)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  return res.json({ success: true });
});

// ─── Consumption Log ───────────────────────────────────────────────────────────
router.get("/consumption/:swatchOrderId", requireAuth, 
  checkPermission({ any : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.VIEW] }), 
  async (req, res) => {
  const rows = await db.select().from(consumptionLogTable)
    .where(and(eq(consumptionLogTable.swatchOrderId, Number(String(req.params.swatchOrderId))), eq(consumptionLogTable.isDeleted, false)))
    .orderBy(consumptionLogTable.consumedAt);
  return res.json({ data: rows });
});

router.post("/consumption", requireAuth, 
  checkPermission({ any : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const { swatchOrderId, bomRowId, materialCode, materialName, materialType, unitType, consumedQty, notes, warehouseLocation } = req.body as Record<string, string | number>;

  const [bomRow] = await db.select().from(swatchBomTable).where(and(eq(swatchBomTable.id, Number(bomRowId)), eq(swatchBomTable.isDeleted, false)));
  if (!bomRow) { res.status(404).json({ error: "BOM item not found" }); return; }
  const newConsumedQty = parseFloat(String(consumedQty)) || 0;

  // Validate Consumed Quantity Should Always be less than or equal to Required Quantity
  const requiredQty = parseFloat(bomRow.requiredQty || "0");
  if (newConsumedQty > requiredQty) {
    return res.status(400).json({  error: `Consumed quantity (${newConsumedQty}) cannot exceed required quantity (${requiredQty}).`,});
  }

  // Validate stock available at selected warehouse location
  if (warehouseLocation) {
    const masterTable = bomRow.materialType === "fabric" ? "fabrics" : "materials";

    const locationRes = await pool.query(
      `SELECT location_stocks
      FROM ${masterTable}
      WHERE id = $1 AND is_deleted = false`,
      [bomRow.materialId]
    );

    if (locationRes.rows.length === 0) {
      return res.status(404).json({ error: "Material not found." });
    }

    const locationStocks: Array<{ location: string; stock: string }> =
      locationRes.rows[0].location_stocks ?? [];

    const selectedLocation = locationStocks.find(
      l =>
        l.location.trim().toLowerCase() ===
        String(warehouseLocation).trim().toLowerCase()
    );

    if (!selectedLocation) {
      return res.status(400).json({
        error: `Warehouse location '${warehouseLocation}' not found.`,
      });
    }

    const availableAtLocation = parseFloat(selectedLocation.stock || "0");

    if (newConsumedQty > availableAtLocation) {
      return res.status(400).json({
        error: `Cannot consume ${newConsumedQty}. Only ${availableAtLocation.toFixed(
          3
        )} available at '${warehouseLocation}'.`,
      });
    }
  }

  // Section 7 — prefer reservation-based validation, fall back to available stock
  const invR = await db
    .select({ id: inventoryItemsTable.id })
    .from(inventoryItemsTable)
    .where(and(eq(inventoryItemsTable.sourceType, bomRow.materialType ?? ""), eq(inventoryItemsTable.sourceId, bomRow.materialId ?? 0), eq(inventoryItemsTable.isDeleted, false)))
    .limit(1);
  if (invR.length > 0) {
    const invId = invR[0].id;
    const resvR = await pool.query(
      `SELECT reserved_quantity FROM material_reservations
       WHERE inventory_id = $1 AND reservation_type = 'Swatch' AND reference_id = $2 AND status = 'Active' AND is_deleted = false
       ORDER BY id DESC LIMIT 1`,
      [invId, Number(swatchOrderId)]
    );
    if (resvR.rows.length > 0) {
      const reserved = parseFloat(resvR.rows[0].reserved_quantity);
      if (newConsumedQty > reserved) {
        return res.status(400).json({ error: `Cannot consume ${newConsumedQty} — only ${reserved.toFixed(4)} is reserved for this order. Consume within the reserved quantity.` });
        return;
      }
    } else {
      // No reservation — fall back to available_stock check
      const currentStock = parseFloat(bomRow.currentStock || "0");
      const existingConsumed = parseFloat(bomRow.consumedQty || "0");
      const allPrsForRow = await db.select().from(purchaseReceiptsTable).where(and(eq(purchaseReceiptsTable.bomRowId, Number(bomRowId)), eq(purchaseReceiptsTable.isDeleted, false)));
      const totalPrReceived = allPrsForRow.reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0), 0);
      const available = currentStock + totalPrReceived - existingConsumed;
      if (newConsumedQty > available) {
        return res.status(400).json({ error: `Cannot consume ${newConsumedQty} — only ${available.toFixed(4)} available.` });
        return;
      }
    }
  }

  const [entry] = await db.insert(consumptionLogTable).values({
    swatchOrderId: Number(swatchOrderId),
    bomRowId: Number(bomRowId),
    materialCode: String(materialCode),
    materialName: String(materialName),
    materialType: String(materialType),
    unitType: String(unitType ?? ""),
    consumedQty: String(consumedQty),
    consumedBy: user.email,
    notes: notes ? String(notes) : null,
    warehouseLocation: warehouseLocation ? String(warehouseLocation) : null,
  }).returning();

  // Recompute total consumed qty for this BOM row and update it
  const allEntries = await db.select().from(consumptionLogTable)
    .where(and(eq(consumptionLogTable.bomRowId, Number(bomRowId)), eq(consumptionLogTable.isDeleted, false)));
  const totalConsumed = allEntries.reduce((s, e) => s + (parseFloat(e.consumedQty) || 0), 0);
  await db.update(swatchBomTable).set({ consumedQty: totalConsumed.toString(), updatedBy: user.email, updatedAt: new Date() })
    .where(eq(swatchBomTable.id, Number(bomRowId)));

  // Consumption Engine — sync to inventory, reservations, ledger
  await syncConsumptionWithInventory({
    bomRow: { materialType: bomRow.materialType, materialId: bomRow.materialId },
    orderId: Number(swatchOrderId),
    reservationType: "Swatch",
    consumedQty: newConsumedQty,
    consumptionId: entry.id,
    actor: user.email,
    warehouseLocation: warehouseLocation ? String(warehouseLocation) : null,
  });

  return res.status(201).json({ data: entry, inventoryUpdated: true });
});

router.put("/consumption/:id", requireAuth, 
  checkPermission({ any : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const id = Number(String(req.params.id));
  const { consumedQty, notes, warehouseLocation } = req.body as Record<string, string | number | null>;

  const [entry] = await db.select().from(consumptionLogTable).where(and(eq(consumptionLogTable.id, id), eq(consumptionLogTable.isDeleted, false)));
  if (!entry) { res.status(404).json({ error: "Consumption entry not found" }); return; }

  const [bomRow] = await db.select().from(swatchBomTable).where(and(eq(swatchBomTable.id, entry.bomRowId), eq(swatchBomTable.isDeleted, false))).limit(1);
  if (!bomRow) { res.status(404).json({ error: "BOM row not found" }); return; }

  const newQty = consumedQty !== undefined ? (parseFloat(String(consumedQty)) || 0) : (parseFloat(entry.consumedQty) || 0);
  const newLocation = warehouseLocation !== undefined ? (warehouseLocation === null ? null : String(warehouseLocation)) : entry.warehouseLocation;

  // Validate against reservation (allow up to reserved + already consumed by this entry)
  if (consumedQty !== undefined && newQty !== parseFloat(entry.consumedQty)) {
    const invR = await db.select({ id: inventoryItemsTable.id }).from(inventoryItemsTable)
      .where(and(eq(inventoryItemsTable.sourceType, bomRow.materialType ?? ""), eq(inventoryItemsTable.sourceId, bomRow.materialId ?? 0), eq(inventoryItemsTable.isDeleted, false))).limit(1);
    if (invR.length > 0) {
      const reservationType = entry.styleOrderId ? "Style" : "Swatch";
      const orderId = entry.styleOrderId ?? entry.swatchOrderId;
      const resvR = await pool.query(
        `SELECT reserved_quantity FROM material_reservations
         WHERE inventory_id = $1 AND reservation_type = $2 AND reference_id = $3 AND status IN ('Active','Converted') AND is_deleted = false
         ORDER BY id DESC LIMIT 1`,
        [invR[0].id, reservationType, orderId]
      );
      if (resvR.rows.length > 0) {
        const reserved = parseFloat(resvR.rows[0].reserved_quantity);
        const oldQty = parseFloat(entry.consumedQty) || 0;
        const headroom = reserved + oldQty;
        if (newQty > headroom) {
          return res.status(400).json({ error: `Cannot consume ${newQty} — only ${headroom.toFixed(4)} is available within the active reservation.` });
        }
      }
    }
  }

  // Reverse current entry effect on inventory
  await reverseConsumptionFromInventory({
    entry: { id: entry.id, swatchOrderId: entry.swatchOrderId, styleOrderId: entry.styleOrderId, bomRowId: entry.bomRowId, consumedQty: entry.consumedQty, warehouseLocation: entry.warehouseLocation },
    materialType: bomRow.materialType,
    materialId: bomRow.materialId,
    actor: user.email,
  });

  // Update the entry row
  const [updated] = await db.update(consumptionLogTable).set({
    consumedQty: String(newQty),
    notes: notes !== undefined ? (notes === null ? null : String(notes)) : entry.notes,
    warehouseLocation: newLocation,
  }).where(eq(consumptionLogTable.id, id)).returning();

  // Re-apply new effect on inventory
  const orderId = entry.styleOrderId ?? entry.swatchOrderId;
  const reservationType: "Style" | "Swatch" = entry.styleOrderId ? "Style" : "Swatch";
  if (orderId && newQty > 0) {
    await syncConsumptionWithInventory({
      bomRow: { materialType: bomRow.materialType, materialId: bomRow.materialId },
      orderId,
      reservationType,
      consumedQty: newQty,
      consumptionId: entry.id,
      actor: user.email,
      warehouseLocation: newLocation,
    });
  }

  // Recompute BOM consumed qty
  const allEntries = await db.select().from(consumptionLogTable).where(and(eq(consumptionLogTable.bomRowId, entry.bomRowId), eq(consumptionLogTable.isDeleted, false)));
  const totalConsumed = allEntries.reduce((s, e) => s + (parseFloat(e.consumedQty) || 0), 0);
  await db.update(swatchBomTable).set({ consumedQty: totalConsumed.toString(), updatedBy: user.email, updatedAt: new Date() })
    .where(eq(swatchBomTable.id, entry.bomRowId));

  return res.json({ data: updated, inventoryUpdated: true });
});

router.delete("/consumption/:id", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.DELETE] }), 
  async (req, res) => {
  const user = (req as any).user;
  const [entry] = await db.select().from(consumptionLogTable).where(and(eq(consumptionLogTable.id, Number(String(req.params.id))), eq(consumptionLogTable.isDeleted, false)));
  if (!entry) { res.status(404).json({ error: "Not found" }); return; }

  // Load BOM row before deletion so we have materialType + materialId for reversal
  const [bomRow] = await db.select().from(swatchBomTable).where(and(eq(swatchBomTable.id, entry.bomRowId), eq(swatchBomTable.isDeleted, false))).limit(1);

  await db.update(consumptionLogTable).set({ isDeleted: true, deletedBy: user.email, deletedAt: new Date() }).where(and(eq(consumptionLogTable.id, Number(String(req.params.id))), eq(consumptionLogTable.isDeleted, false)));

  // Recompute and update BOM consumed qty
  const remaining = await db.select().from(consumptionLogTable).where(and(eq(consumptionLogTable.bomRowId, entry.bomRowId), eq(consumptionLogTable.isDeleted, false)));
  const totalConsumed = remaining.reduce((s, e) => s + (parseFloat(e.consumedQty) || 0), 0);
  await db.update(swatchBomTable).set({ consumedQty: totalConsumed.toString(), updatedBy: user.email, updatedAt: new Date() })
    .where(eq(swatchBomTable.id, entry.bomRowId));

  // Consumption Engine — reverse inventory / reservation / ledger
  if (bomRow) {
    await reverseConsumptionFromInventory({
      entry: { id: entry.id, swatchOrderId: entry.swatchOrderId, styleOrderId: entry.styleOrderId, bomRowId: entry.bomRowId, consumedQty: entry.consumedQty, warehouseLocation: entry.warehouseLocation },
      materialType: bomRow.materialType,
      materialId: bomRow.materialId,
      actor: user.email,
    });
  }

  return res.json({ success: true, inventoryUpdated: true });
});

// ─── Vendor Search (for outsource jobs) ──────────────────────────────────────
router.get("/vendor-search", requireAuth, 
  checkPermission({ any : [SWATCH_ORDER_TABS.COSTING, STYLE_ORDER_TABS.COSTING] }), 
  async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const rows = await db.select({
    id: vendorsTable.id,
    brandName: vendorsTable.brandName,
    vendorCode: vendorsTable.vendorCode,
    contactName: vendorsTable.contactName,
  }).from(vendorsTable)
    .where(and(eq(vendorsTable.isDeleted, false), q
      ? or(ilike(vendorsTable.brandName, `%${q}%`), ilike(vendorsTable.vendorCode, `%${q}%`))
      : undefined))
    .limit(30);
  return res.json({ data: rows });
});

// ─── HSN Search (for outsource jobs) ─────────────────────────────────────────
router.get("/hsn-search", requireAuth, 
  checkPermission({ any : [SWATCH_ORDER_TABS.COSTING, STYLE_ORDER_TABS.COSTING] }), 
  async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const rows = await db.select({
    id: hsnTable.id,
    hsnCode: hsnTable.hsnCode,
    gstPercentage: hsnTable.gstPercentage,
    govtDescription: hsnTable.govtDescription,
  }).from(hsnTable)
    .where(and(eq(hsnTable.isDeleted, false), q
      ? or(ilike(hsnTable.hsnCode, `%${q}%`), ilike(hsnTable.govtDescription, `%${q}%`))
      : undefined))
    .limit(30);
  return res.json({ data: rows });
});

// ─── Artisan Timesheets ───────────────────────────────────────────────────────
router.get("/artisan-timesheets/:swatchOrderId", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.VIEW] }), 
  async (req, res) => {
    console.log("Artisan Timesheets");
  const rows = await db.select().from(artisanTimesheetsTable)
    .where(and(eq(artisanTimesheetsTable.swatchOrderId, Number(String(req.params.swatchOrderId))), eq(artisanTimesheetsTable.isDeleted, false)))
    .orderBy(desc(artisanTimesheetsTable.createdAt));
  return res.json({ data: rows });
});

router.post("/artisan-timesheets", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const { swatchOrderId, noOfArtisans, startDate, endDate, shiftType, totalHours, hourlyRate, notes } = req.body;
  if (!swatchOrderId || !startDate || !endDate || !shiftType) {
    return res.status(400).json({ error: "swatchOrderId, startDate, endDate and shiftType are required" }); return;
  }
  const totalHoursNum = parseFloat(totalHours) || 0;
  const hourlyRateNum = parseFloat(hourlyRate) || 0;
  const noOfArtisansNum = parseInt(noOfArtisans) || 1;
  const totalRate = (totalHoursNum * hourlyRateNum * noOfArtisansNum).toFixed(2);
  const [row] = await db.insert(artisanTimesheetsTable).values({
    swatchOrderId: Number(swatchOrderId),
    noOfArtisans: noOfArtisansNum,
    startDate: String(startDate),
    endDate: String(endDate),
    shiftType: String(shiftType),
    totalHours: String(totalHoursNum),
    hourlyRate: String(hourlyRateNum),
    totalRate,
    notes: notes ? String(notes) : null,
    createdBy: user.email,
  }).returning();
  return res.status(201).json({ data: row });
});

router.put("/artisan-timesheets/:id", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const id = Number(String(req.params.id));
  const { noOfArtisans, startDate, endDate, shiftType, totalHours, hourlyRate, notes } = req.body as Record<string, string | number | null>;
  const [existing] = await db.select().from(artisanTimesheetsTable).where(and(eq(artisanTimesheetsTable.id, id), eq(artisanTimesheetsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Timesheet entry not found" }); return; }
  const totalHoursNum = totalHours !== undefined ? (parseFloat(String(totalHours)) || 0) : parseFloat(existing.totalHours);
  const hourlyRateNum = hourlyRate !== undefined ? (parseFloat(String(hourlyRate)) || 0) : parseFloat(existing.hourlyRate);
  const noOfArtisansNum = noOfArtisans !== undefined ? (parseInt(String(noOfArtisans)) || 1) : existing.noOfArtisans;
  const totalRate = (totalHoursNum * hourlyRateNum * noOfArtisansNum).toFixed(2);
  const updates: Record<string, unknown> = {
    noOfArtisans: noOfArtisansNum,
    totalHours: String(totalHoursNum),
    hourlyRate: String(hourlyRateNum),
    totalRate,
    updatedBy: user.email,
    updatedAt: new Date(),
  };
  if (startDate !== undefined) updates.startDate = String(startDate);
  if (endDate !== undefined) updates.endDate = String(endDate);
  if (shiftType !== undefined) updates.shiftType = String(shiftType);
  if (notes !== undefined) updates.notes = notes === null ? null : String(notes);
  const [row] = await db.update(artisanTimesheetsTable).set(updates).where(eq(artisanTimesheetsTable.id, id)).returning();
  return res.json({ data: row });
});

router.delete("/artisan-timesheets/:id", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.DELETE] }), 
  async (req, res) => {
  const deletedByUser = (req.user as any)?.email ?? "system";
  const [row] = await db.update(artisanTimesheetsTable)
    .set({ isDeleted: true, deletedBy: deletedByUser, deletedAt: new Date() })
    .where(and(eq(artisanTimesheetsTable.id, Number(String(req.params.id))), eq(artisanTimesheetsTable.isDeleted, false)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  return res.json({ success: true });
});

// ─── Outsource Jobs ───────────────────────────────────────────────────────────
router.get("/outsource-jobs/:swatchOrderId", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.VIEW] }), 
  async (req, res) => {
  const rows = await db.select().from(outsourceJobsTable)
    .where(and(eq(outsourceJobsTable.swatchOrderId, Number(String(req.params.swatchOrderId))), eq(outsourceJobsTable.isDeleted, false)))
    .orderBy(desc(outsourceJobsTable.createdAt));
  return res.json({ data: rows });
});

router.post("/outsource-jobs", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const { swatchOrderId, vendorId, vendorName, hsnId, hsnCode, gstPercentage, issueDate, targetDate, deliveryDate, totalCost, notes } = req.body;
  if (!swatchOrderId || !vendorId || !hsnId || !issueDate) {
    return res.status(400).json({ error: "swatchOrderId, vendorId, hsnId and issueDate are required" }); return;
  }
  const [row] = await db.insert(outsourceJobsTable).values({
    swatchOrderId: Number(swatchOrderId),
    vendorId: Number(vendorId),
    vendorName: String(vendorName),
    hsnId: Number(hsnId),
    hsnCode: String(hsnCode),
    gstPercentage: String(gstPercentage || "5"),
    issueDate: String(issueDate),
    targetDate: targetDate ? String(targetDate) : null,
    deliveryDate: deliveryDate ? String(deliveryDate) : null,
    totalCost: String(parseFloat(totalCost) || 0),
    notes: notes ? String(notes) : null,
    createdBy: user.email,
  }).returning();
  return res.status(201).json({ data: row });
});

router.put("/outsource-jobs/:id", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const id = Number(String(req.params.id));
  const { vendorId, vendorName, hsnId, hsnCode, gstPercentage, issueDate, targetDate, deliveryDate, totalCost, notes } = req.body as Record<string, string | number | null>;
  const [existing] = await db.select().from(outsourceJobsTable).where(and(eq(outsourceJobsTable.id, id), eq(outsourceJobsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Outsource job not found" }); return; }
  const updates: Record<string, unknown> = { updatedBy: user.email, updatedAt: new Date() };
  if (vendorId !== undefined) updates.vendorId = Number(vendorId);
  if (vendorName !== undefined) updates.vendorName = String(vendorName);
  if (hsnId !== undefined) updates.hsnId = Number(hsnId);
  if (hsnCode !== undefined) updates.hsnCode = String(hsnCode);
  if (gstPercentage !== undefined) updates.gstPercentage = String(gstPercentage);
  if (issueDate !== undefined) updates.issueDate = String(issueDate);
  if (targetDate !== undefined) updates.targetDate = targetDate === null || targetDate === "" ? null : String(targetDate);
  if (deliveryDate !== undefined) updates.deliveryDate = deliveryDate === null || deliveryDate === "" ? null : String(deliveryDate);
  if (totalCost !== undefined) updates.totalCost = String(parseFloat(String(totalCost)) || 0);
  if (notes !== undefined) updates.notes = notes === null ? null : String(notes);
  const [row] = await db.update(outsourceJobsTable).set(updates).where(eq(outsourceJobsTable.id, id)).returning();
  return res.json({ data: row });
});

router.delete("/outsource-jobs/:id", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.DELETE] }), 
  async (req, res) => {
  const deletedByUser = (req.user as any)?.email ?? "system";
  const [row] = await db.update(outsourceJobsTable)
    .set({ isDeleted: true, deletedBy: deletedByUser, deletedAt: new Date() })
    .where(and(eq(outsourceJobsTable.id, Number(String(req.params.id))), eq(outsourceJobsTable.isDeleted, false)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  return res.json({ success: true });
});

// ─── Custom Charges ───────────────────────────────────────────────────────────
router.get("/custom-charges/:swatchOrderId", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.VIEW] }), 
  async (req, res) => {
  const rows = await db.select().from(customChargesTable)
    .where(and(eq(customChargesTable.swatchOrderId, Number(String(req.params.swatchOrderId))), eq(customChargesTable.isDeleted, false)))
    .orderBy(desc(customChargesTable.createdAt));
  return res.json({ data: rows });
});

router.post("/custom-charges", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const { swatchOrderId, vendorId, vendorName, hsnId, hsnCode, gstPercentage, description, unitPrice, quantity } = req.body;
  if (!swatchOrderId || !vendorId || !hsnId || !description) {
    return res.status(400).json({ error: "swatchOrderId, vendorId, hsnId and description are required" }); return;
  }
  const unitPriceNum = parseFloat(unitPrice) || 0;
  const quantityNum = parseFloat(quantity) || 1;
  const totalAmount = (unitPriceNum * quantityNum).toFixed(2);
  const [row] = await db.insert(customChargesTable).values({
    swatchOrderId: Number(swatchOrderId),
    vendorId: Number(vendorId),
    vendorName: String(vendorName),
    hsnId: Number(hsnId),
    hsnCode: String(hsnCode),
    gstPercentage: String(gstPercentage || "5"),
    description: String(description),
    unitPrice: String(unitPriceNum),
    quantity: String(quantityNum),
    totalAmount,
    createdBy: user.email,
  }).returning();
  return res.status(201).json({ data: row });
});

router.put("/custom-charges/:id", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res) => {
  const user = (req as any).user;
  const id = Number(String(req.params.id));
  const { vendorId, vendorName, hsnId, hsnCode, gstPercentage, description, unitPrice, quantity } = req.body as Record<string, string | number>;
  const [existing] = await db.select().from(customChargesTable).where(and(eq(customChargesTable.id, id), eq(customChargesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Custom charge not found" }); return; }
  const unitPriceNum = unitPrice !== undefined ? (parseFloat(String(unitPrice)) || 0) : parseFloat(existing.unitPrice);
  const quantityNum = quantity !== undefined ? (parseFloat(String(quantity)) || 1) : parseFloat(existing.quantity);
  const totalAmount = (unitPriceNum * quantityNum).toFixed(2);
  const updates: Record<string, unknown> = {
    unitPrice: String(unitPriceNum),
    quantity: String(quantityNum),
    totalAmount,
    updatedBy: user.email,
    updatedAt: new Date(),
  };
  if (vendorId !== undefined) updates.vendorId = Number(vendorId);
  if (vendorName !== undefined) updates.vendorName = String(vendorName);
  if (hsnId !== undefined) updates.hsnId = Number(hsnId);
  if (hsnCode !== undefined) updates.hsnCode = String(hsnCode);
  if (gstPercentage !== undefined) updates.gstPercentage = String(gstPercentage);
  if (description !== undefined) updates.description = String(description);
  const [row] = await db.update(customChargesTable).set(updates).where(eq(customChargesTable.id, id)).returning();
  return res.json({ data: row });
});

router.delete("/custom-charges/:id", requireAuth, 
  checkPermission({ all : [SWATCH_ORDER_TABS.COSTING, SWATCH_ORDERS.DELETE] }), 
  async (req, res) => {
  const deletedByUser = (req.user as any)?.email ?? "system";
  const [row] = await db.update(customChargesTable)
    .set({ isDeleted: true, deletedBy: deletedByUser, deletedAt: new Date() })
    .where(and(eq(customChargesTable.id, Number(String(req.params.id))), eq(customChargesTable.isDeleted, false)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  return res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE ORDER COSTING ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Style BOM ───────────────────────────────────────────────────────────────
router.get("/style-bom/:styleOrderId", requireAuth,
  checkPermission({ any: [STYLE_ORDER_TABS.COSTING, STYLE_ORDERS.VIEW] }),
  async (req, res) => {
  const styleOrderId = Number(String(req.params.styleOrderId));
  const rows = await db.select().from(swatchBomTable)
    .where(and(eq(swatchBomTable.styleOrderId, styleOrderId), eq(swatchBomTable.isDeleted, false)))
    .orderBy(swatchBomTable.createdAt);

  // Enrich each row with live stock figures and active reservation for this order
  const enriched = await Promise.all(rows.map(async (r) => {
    const invRows = await db
      .select({ id: inventoryItemsTable.id, currentStock: inventoryItemsTable.currentStock, availableStock: inventoryItemsTable.availableStock })
      .from(inventoryItemsTable)
      .where(and(
        eq(inventoryItemsTable.sourceType, r.materialType ?? ""),
        eq(inventoryItemsTable.sourceId, r.materialId ?? 0),
        eq(inventoryItemsTable.isDeleted, false),
      ))
      .limit(1);
    const live = invRows[0] ?? null;

    let liveReservedQty: string | null = null;
    if (live) {
      const resvRows = await pool.query(
        `SELECT reserved_quantity FROM material_reservations
         WHERE inventory_id = $1 AND reservation_type = 'Style' AND reference_id = $2 AND status = 'Active' AND is_deleted = false
         ORDER BY id DESC LIMIT 1`,
        [live.id, styleOrderId]
      );
      if (resvRows.rows.length > 0) liveReservedQty = resvRows.rows[0].reserved_quantity;
    }

    return {
      ...r,
      requiredQty: r.requiredQty || "0",    
      consumedQty: r.consumedQty || "0",       
      currentStock: r.currentStock || "0",     
      avgUnitPrice: r.avgUnitPrice || "0",     
      estimatedAmount: r.estimatedAmount || "0", 
      liveCurrentStock: live ? live.currentStock : null,
      liveAvailableStock: live ? live.availableStock : null,
      liveReservedQty,
    };
  }));

  return res.json({ data: enriched });
});

router.post("/style-bom", requireAuth,
  checkPermission({ all: [STYLE_ORDER_TABS.COSTING, STYLE_ORDERS.ADD_EDIT] }),
  async (req, res) => {
  const user = (req as any).user;
  const { styleOrderId, materialType, materialId, materialCode, materialName, currentStock, avgUnitPrice, unitType, warehouseLocation, requiredQty, targetVendorId, targetVendorName } = req.body as Record<string, string>;
  const reqQty = parseFloat(requiredQty) || 0;
  const price = parseFloat(avgUnitPrice) || 0;
  const estimatedAmount = (reqQty * price).toFixed(2);
  const matId = Number(materialId);
  const orderId = Number(styleOrderId);
  const actor = user?.name || user?.email || "System";

  const [row] = await db.insert(swatchBomTable).values({
    styleOrderId: orderId,
    materialType,
    materialId: matId,
    materialCode,
    materialName,
    currentStock,
    avgUnitPrice,
    unitType,
    warehouseLocation,
    requiredQty,
    estimatedAmount,
    targetVendorId: targetVendorId ? Number(targetVendorId) : null,
    targetVendorName: targetVendorName || null,
    createdBy: user.email,
  }).returning();

  // Section 2 — auto-reserve for Style BOM
  let reservation: { status: string; reason?: string } = { status: "skipped" };
  if (reqQty > 0) {
    reservation = await autoReserveForBom({
      materialType, materialId: matId, orderId, reservationType: "Style",
      reqQty, bomRowId: row.id, materialName, actor,
    });
  }

  return res.status(201).json({ data: row, reservation });
});

// ─── Style PO ─────────────────────────────────────────────────────────────────
router.get("/style-po/:styleOrderId", requireAuth,
  checkPermission({ any: [STYLE_ORDER_TABS.COSTING, STYLE_ORDERS.VIEW] }),
  async (req, res) => {
  const rows = await db.select().from(purchaseOrdersTable)
    .where(and(eq(purchaseOrdersTable.styleOrderId, Number(String(req.params.styleOrderId))), eq(purchaseOrdersTable.isDeleted, false)))
    .orderBy(purchaseOrdersTable.createdAt);
  return res.json({ data: rows });
});

router.post("/style-po", requireAuth,
  checkPermission({ all: [STYLE_ORDER_TABS.COSTING, STYLE_ORDERS.ADD_EDIT] }),
  async (req, res) => {
  const user = (req as any).user;

  const { styleOrderId, vendorId, notes, bomItems } = req.body as {
    styleOrderId: number;
    vendorId?: number;
    notes?: string;
    bomItems?: {
      bomRowId: number;
      materialCode: string;
      materialName: string;
      unitType: string;
      targetPrice: string;
      quantity: string;
      targetVendorId?: number;
      targetVendorName?: string;
    }[];
  };

  const items = bomItems ?? [];

  if (!items.length) {
    return res.status(400).json({
      error: "At least one material is required",
    });
  }

  // Fetch inventory ids
  const materialCodes = [...new Set(items.map(i => i.materialCode))];

  const inventoryItems =
    materialCodes.length > 0
      ? await db
          .select({
            id: inventoryItemsTable.id,
            code: inventoryItemsTable.itemCode,
          })
          .from(inventoryItemsTable)
          .where(
            and(
              inArray(inventoryItemsTable.itemCode, materialCodes),
              eq(inventoryItemsTable.isDeleted, false)
            )
          )
      : [];

  const inventoryMap = new Map(
    inventoryItems.map(i => [i.code, i.id])
  );

  const client = await (pool as any).connect();

  try {
    await client.query("BEGIN");

    const createdPOs: any[] = [];

    for (const item of items) {
      let vendorIdForPO: number | null = null;
      let vendorNameForPO: string | null = null;

      // Item level vendor
      if (item.targetVendorId) {
        const [vendor] = await db
          .select({
            id: vendorsTable.id,
            brandName: vendorsTable.brandName,
          })
          .from(vendorsTable)
          .where(
            and(
              eq(vendorsTable.id, item.targetVendorId),
              eq(vendorsTable.isDeleted, false)
            )
          );

        if (vendor) {
          vendorIdForPO = vendor.id;
          vendorNameForPO = vendor.brandName;
        } else {
          vendorNameForPO = item.targetVendorName ?? null;
        }
      }
      // Vendor name only
      else if (item.targetVendorName) {
        vendorNameForPO = item.targetVendorName;
      }
      // Header vendor (legacy)
      else if (vendorId) {
        const [vendor] = await db
          .select({
            id: vendorsTable.id,
            brandName: vendorsTable.brandName,
          })
          .from(vendorsTable)
          .where(
            and(
              eq(vendorsTable.id, vendorId),
              eq(vendorsTable.isDeleted, false)
            )
          );

        if (vendor) {
          vendorIdForPO = vendor.id;
          vendorNameForPO = vendor.brandName;
        }
      }

      if (!vendorNameForPO) {
        vendorNameForPO = "Unknown Vendor";
      }

      const inventoryItemId =
        inventoryMap.get(item.materialCode) ?? null;

      const poNumber = await nextPoNumber(client);
      // PO Header
      const poResult = await client.query(
        `INSERT INTO purchase_orders
          (
            po_number,
            style_order_id,
            reference_type,
            reference_id,
            vendor_mode,
            vendor_id,
            vendor_name,
            status,
            notes,
            bom_row_ids,
            bom_items,
            created_by
          )
         VALUES
          (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
          )
         RETURNING
            id,
            po_number,
            style_order_id,
            reference_type,
            reference_id,
            vendor_mode,
            vendor_id,
            vendor_name,
            status,
            notes,
            bom_row_ids,
            bom_items,
            created_by,
            created_at`,
        [
          poNumber,
          Number(styleOrderId),
          "Style",
          Number(styleOrderId),
          "header",
          vendorIdForPO,
          vendorNameForPO,
          "Draft",
          notes ?? null,
          JSON.stringify([item.bomRowId]),
          JSON.stringify([item]),
          user.email,
        ]
      );

      const po = poResult.rows[0];

      createdPOs.push(po);

      // PO Item
      await client.query(
        `INSERT INTO purchase_order_items
          (
            po_id,
            inventory_item_id,
            item_name,
            item_code,
            ordered_quantity,
            received_quantity,
            unit_price,
            warehouse_location,
            remarks,
            item_image,
            vendor_id,
            vendor_name
          )
         VALUES
          (
            $1,$2,$3,$4,$5,0,$6,$7,$8,$9,$10,$11
          )`,
        [
          po.id,
          inventoryItemId,
          item.materialName || item.materialCode,
          item.materialCode,
          item.quantity,
          item.targetPrice,
          "",
          null,
          null,
          vendorIdForPO,
          vendorNameForPO,
        ]
      );
    }

    await client.query("COMMIT");

    // Email notification
    const adminUsers = await db
      .select({
        email: usersTable.email,
      })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.role, "admin"),
          eq(usersTable.isDeleted, false)
        )
      );

    const adminEmails = adminUsers
      .map(u => u.email)
      .filter(Boolean) as string[];

    if (adminEmails.length > 0 && createdPOs.length > 0) {
      const apiBase =
        process.env.API_BASE_URL ??
        `https://${process.env.REPLIT_DEV_DOMAIN ?? "zari-erp.replit.app"}`;

      const erpUrl = `${apiBase}/costing`;

      for (const po of createdPOs) {
        const approveToken = jwt.sign(
          {
            poId: po.id,
            action: "approve",
          },
          process.env.SESSION_SECRET ?? "secret",
          {
            expiresIn: "7d",
          }
        );

        const rejectToken = jwt.sign(
          {
            poId: po.id,
            action: "reject",
          },
          process.env.SESSION_SECRET ?? "secret",
          {
            expiresIn: "7d",
          }
        );

        sendPoApprovalRequestEmail({
          adminEmails,
          poNumber: po.po_number,
          vendorName: po.vendor_name ?? "Unknown Vendor",
          createdBy: user.email,
          referenceType: "Style",
          referenceId: styleOrderId,
          itemCount: 1,
          erpUrl,
          approveUrl: `${apiBase}/api/costing/po-action?token=${approveToken}`,
          rejectUrl: `${apiBase}/api/costing/po-action?token=${rejectToken}`,
        }).catch(() => {});
      }
    }

    return res.status(201).json({
      data: createdPOs,
      message: `${createdPOs.length} purchase order(s) created successfully`,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error("Style PO creation failed:", error);

    return res.status(500).json({
      error: "Failed to create purchase order(s)",
      detail: (error as Error).message,
    });
  } finally {
    client.release();
  }
});

// ─── Style PR ─────────────────────────────────────────────────────────────────
router.get("/style-pr/:styleOrderId", requireAuth,
  checkPermission({ any: [STYLE_ORDER_TABS.COSTING, STYLE_ORDERS.VIEW] }),
  async (req, res) => {
  const rows = await db.select().from(purchaseReceiptsTable)
    .where(and(eq(purchaseReceiptsTable.styleOrderId, Number(String(req.params.styleOrderId))), eq(purchaseReceiptsTable.isDeleted, false)))
    .orderBy(purchaseReceiptsTable.createdAt);
  return res.json({ data: rows });
});

router.post("/style-pr", requireAuth,
  checkPermission({ all: [STYLE_ORDER_TABS.COSTING, STYLE_ORDERS.ADD_EDIT] }),
  async (req, res) => {
  const user = (req as any).user;
  const {
    poId,
    styleOrderId,
    bomRowId,
    receivedQty,
    actualPrice,
    warehouseLocation,
  } = req.body as Record<string, string | number | null>;

  const newQty = parseFloat(String(receivedQty)) || 0;
  const resolvedBomRowId = bomRowId != null ? Number(bomRowId) : null;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL statement_timeout = '5s'");

    // Lock PO
    const poResult = await client.query(
      `SELECT id, status, vendor_name, bom_items
       FROM purchase_orders
       WHERE id = $1
         AND is_deleted = false
       FOR UPDATE`,
      [Number(poId)]
    );

    if (poResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "PO not found" });
    }

    const po = poResult.rows[0];
    const bomItems = po.bom_items ?? [];
    const isSingleItem = bomItems.length === 1;

    if (!["Approved", "In Process", "Partially Received"].includes(po.status)) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: `Purchase Receipt cannot be created: PO is currently in "${po.status}" status. An admin must approve it first.`,
      });
    }

    // Ordered Qty
    let orderedQty = 0;

    if (resolvedBomRowId != null) {
      const item = bomItems.find((i: any) => i.bomRowId === resolvedBomRowId);
      orderedQty = parseFloat(item?.quantity ?? "0") || 0;
    } else if (isSingleItem) {
      orderedQty = parseFloat(bomItems[0]?.quantity ?? "0") || 0;
    }

    // Lock existing PRs
    const prResult = await client.query(
      `SELECT received_qty, bom_row_id
       FROM purchase_receipts
       WHERE po_id = $1
         AND is_deleted = false
       FOR UPDATE`,
      [Number(poId)]
    );

    const existingPrs = prResult.rows;

    const relevantPrs =
      resolvedBomRowId != null
        ? existingPrs.filter((pr: any) => pr.bom_row_id === resolvedBomRowId)
        : isSingleItem
        ? existingPrs
        : existingPrs.filter((pr: any) => pr.bom_row_id == null);

    const alreadyReceived = relevantPrs.reduce(
      (sum: number, pr: any) =>
        sum + (parseFloat(pr.received_qty) || 0),
      0
    );

    if (orderedQty > 0) {
      if (alreadyReceived >= orderedQty) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `This item is already fully received (${alreadyReceived} / ${orderedQty}). No further PR is allowed.`,
        });
      }

      const remaining = Math.max( 0, orderedQty - alreadyReceived );
      // if (newQty > remaining) {
      //   await client.query("ROLLBACK");
      //   return res.status(400).json({
      //     error: `Received quantity (${newQty}) exceeds remaining ordered quantity. Max allowed: ${remaining.toFixed(
      //       4
      //     )}`,
      //   });
      // }
    }

    // Generate PR Number
    const prNumber = await nextPrNumber();

    // Insert PR
    const insertResult = await client.query(
      `INSERT INTO purchase_receipts
        (pr_number,
         po_id,
         bom_row_id,
         style_order_id,
         vendor_name,
         received_qty,
         actual_price,
         warehouse_location,
         status,
         created_by)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, pr_number`,
      [
        prNumber,
        Number(poId),
        resolvedBomRowId,
        Number(styleOrderId),
        po.vendor_name ?? "",
        String(receivedQty),
        String(actualPrice),
        String(warehouseLocation ?? ""),
        "Open",
        user.email,
      ]
    );

    const newPrRow = insertResult.rows[0];

    // Inventory update
    const inventoryResult = await applyCostingInventoryUpdate({
      client,
      prId: newPrRow.id,
      prNumber: newPrRow.pr_number,
      bomRowId: resolvedBomRowId,
      poId: Number(poId),
      receivedQty: newQty,
      actualPrice: parseFloat(String(actualPrice)) || 0,
      warehouseLocation: String(warehouseLocation ?? ""),
      actor: user.email,
    });

    // Create PR Item
    if (inventoryResult) {
      await createPurchaseReceiptItem({
        client,
        poId: Number(poId),
        prId: newPrRow.id,
        inventoryItemId: inventoryResult.inventoryItemId,
        receivedQty: newQty,
        actualPrice: parseFloat(String(actualPrice)) || 0,
        warehouseLocation: String(warehouseLocation ?? ""),
        prRow: newPrRow,
      });
    }

    // Update PO Status
    await recalcPoStatus(client, Number(poId));

    await client.query("COMMIT");

    return res.status(201).json({
      data: newPrRow,
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Style PR Creation] Transaction failed:", error);

    return res.status(500).json({
      error: "Internal server error during PR creation",
    });
  } finally {
    client.release();
  }
});

// ─── Style Consumption ────────────────────────────────────────────────────────
router.get("/style-consumption/:styleOrderId", requireAuth,
  checkPermission({ any: [STYLE_ORDER_TABS.COSTING, STYLE_ORDERS.VIEW] }),
  async (req, res) => {
  const rows = await db.select().from(consumptionLogTable)
    .where(and(eq(consumptionLogTable.styleOrderId, Number(String(req.params.styleOrderId))), eq(consumptionLogTable.isDeleted, false)))
    .orderBy(consumptionLogTable.consumedAt);
  return res.json({ data: rows });
});

router.post("/style-consumption", requireAuth,
  checkPermission({ all: [STYLE_ORDER_TABS.COSTING, STYLE_ORDERS.ADD_EDIT] }),
  async (req, res) => {
  const user = (req as any).user;
  const { styleOrderId, styleOrderProductId, styleOrderProductName, bomRowId, materialCode, materialName, materialType, unitType, consumedQty, notes, warehouseLocation } = req.body as Record<string, string | number>;

  const [bomRow] = await db.select().from(swatchBomTable).where(and(eq(swatchBomTable.id, Number(bomRowId)), eq(swatchBomTable.isDeleted, false)));
  if (!bomRow) { res.status(404).json({ error: "BOM item not found" }); return; }
  const newConsumedQty = parseFloat(String(consumedQty)) || 0;

  // Prefer reservation-based validation, fall back to available stock
  const invRS = await db
    .select({ id: inventoryItemsTable.id })
    .from(inventoryItemsTable)
    .where(and(eq(inventoryItemsTable.sourceType, bomRow.materialType ?? ""), eq(inventoryItemsTable.sourceId, bomRow.materialId ?? 0), eq(inventoryItemsTable.isDeleted, false)))
    .limit(1);
  if (invRS.length > 0) {
    const invId = invRS[0].id;
    const resvRS = await pool.query(
      `SELECT reserved_quantity FROM material_reservations
       WHERE inventory_id = $1 AND reservation_type = 'Style' AND reference_id = $2 AND status = 'Active' AND is_deleted = false
       ORDER BY id DESC LIMIT 1`,
      [invId, Number(styleOrderId)]
    );
    if (resvRS.rows.length > 0) {
      const reserved = parseFloat(resvRS.rows[0].reserved_quantity);
      if (newConsumedQty > reserved) {
        return res.status(400).json({ error: `Cannot consume ${newConsumedQty} — only ${reserved.toFixed(4)} is reserved for this order. Consume within the reserved quantity.` });
        return;
      }
    } else {
      const currentStock = parseFloat(bomRow.currentStock || "0");
      const existingConsumed = parseFloat(bomRow.consumedQty || "0");
      const allPrsForRow = await db.select().from(purchaseReceiptsTable).where(and(eq(purchaseReceiptsTable.bomRowId, Number(bomRowId)), eq(purchaseReceiptsTable.isDeleted, false)));
      const totalPrReceived = allPrsForRow.reduce((s, pr) => s + (parseFloat(pr.receivedQty) || 0), 0);
      const available = currentStock + totalPrReceived - existingConsumed;
      if (newConsumedQty > available) {
        return res.status(400).json({ error: `Cannot consume ${newConsumedQty} — only ${available.toFixed(4)} available.` });
        return;
      }
    }
  }

  const [entry] = await db.insert(consumptionLogTable).values({
    styleOrderId: Number(styleOrderId),
    styleOrderProductId: styleOrderProductId ? Number(styleOrderProductId) : null,
    styleOrderProductName: styleOrderProductName ? String(styleOrderProductName) : null,
    bomRowId: Number(bomRowId),
    materialCode: String(materialCode),
    materialName: String(materialName),
    materialType: String(materialType),
    unitType: String(unitType ?? ""),
    consumedQty: String(consumedQty),
    consumedBy: user.email,
    notes: notes ? String(notes) : null,
    warehouseLocation: warehouseLocation ? String(warehouseLocation) : null,
  }).returning();

  const allEntries = await db.select().from(consumptionLogTable)
    .where(and(eq(consumptionLogTable.bomRowId, Number(bomRowId)), eq(consumptionLogTable.isDeleted, false)));
  const totalConsumed = allEntries.reduce((s, e) => s + (parseFloat(e.consumedQty) || 0), 0);
  await db.update(swatchBomTable).set({ consumedQty: totalConsumed.toString(), updatedBy: user.email, updatedAt: new Date() })
    .where(eq(swatchBomTable.id, Number(bomRowId)));

  // Consumption Engine — sync to inventory, reservations, ledger
  await syncConsumptionWithInventory({
    bomRow: { materialType: bomRow.materialType, materialId: bomRow.materialId },
    orderId: Number(styleOrderId),
    reservationType: "Style",
    consumedQty: newConsumedQty,
    consumptionId: entry.id,
    actor: user.email,
    warehouseLocation: warehouseLocation ? String(warehouseLocation) : null,
  });

  return res.status(201).json({ data: entry, inventoryUpdated: true });
});

// ─── Style Artisan Timesheets ─────────────────────────────────────────────────
router.get("/style-artisan-timesheets/:styleOrderId", requireAuth,
  checkPermission({ any: [STYLE_ORDER_TABS.COSTING, STYLE_ORDERS.VIEW] }),
  async (req, res) => {
  const rows = await db.select().from(artisanTimesheetsTable)
    .where(and(eq(artisanTimesheetsTable.styleOrderId, Number(String(req.params.styleOrderId))), eq(artisanTimesheetsTable.isDeleted, false)))
    .orderBy(desc(artisanTimesheetsTable.createdAt));
  return res.json({ data: rows });
});

router.post("/style-artisan-timesheets", requireAuth,
  checkPermission({ all: [STYLE_ORDER_TABS.COSTING, STYLE_ORDERS.ADD_EDIT] }),
  async (req, res) => {
  const user = (req as any).user;
  const { styleOrderId, styleOrderProductId, styleOrderProductName, noOfArtisans, startDate, endDate, shiftType, totalHours, hourlyRate, notes } = req.body;
  if (!styleOrderId || !startDate || !endDate || !shiftType) {
    return res.status(400).json({ error: "styleOrderId, startDate, endDate and shiftType are required" }); return;
  }
  const totalHoursNum = parseFloat(totalHours) || 0;
  const hourlyRateNum = parseFloat(hourlyRate) || 0;
  const noOfArtisansNum = parseInt(noOfArtisans) || 1;
  const totalRate = (totalHoursNum * hourlyRateNum * noOfArtisansNum).toFixed(2);
  const [row] = await db.insert(artisanTimesheetsTable).values({
    styleOrderId: Number(styleOrderId),
    styleOrderProductId: styleOrderProductId ? Number(styleOrderProductId) : null,
    styleOrderProductName: styleOrderProductName ? String(styleOrderProductName) : null,
    noOfArtisans: noOfArtisansNum,
    startDate: String(startDate),
    endDate: String(endDate),
    shiftType: String(shiftType),
    totalHours: String(totalHoursNum),
    hourlyRate: String(hourlyRateNum),
    totalRate,
    notes: notes ? String(notes) : null,
    createdBy: user.email,
  }).returning();
  return res.status(201).json({ data: row });
});

// ─── Style Outsource Jobs ─────────────────────────────────────────────────────
router.get("/style-outsource-jobs/:styleOrderId", requireAuth,
  checkPermission({ any: [STYLE_ORDER_TABS.COSTING, STYLE_ORDERS.VIEW] }),
  async (req, res) => {
  const rows = await db.select().from(outsourceJobsTable)
    .where(and(eq(outsourceJobsTable.styleOrderId, Number(String(req.params.styleOrderId))), eq(outsourceJobsTable.isDeleted, false)))
    .orderBy(desc(outsourceJobsTable.createdAt));
  return res.json({ data: rows });
});

router.post("/style-outsource-jobs", requireAuth,
  checkPermission({ all: [STYLE_ORDER_TABS.COSTING, STYLE_ORDERS.ADD_EDIT] }),
  async (req, res) => {
  const user = (req as any).user;
  const { styleOrderId, styleOrderProductId, styleOrderProductName, vendorId, vendorName, hsnId, hsnCode, gstPercentage, issueDate, targetDate, deliveryDate, totalCost, notes } = req.body;
  if (!styleOrderId || !vendorId || !hsnId || !issueDate) {
    return res.status(400).json({ error: "styleOrderId, vendorId, hsnId and issueDate are required" }); return;
  }
  const [row] = await db.insert(outsourceJobsTable).values({
    styleOrderId: Number(styleOrderId),
    styleOrderProductId: styleOrderProductId ? Number(styleOrderProductId) : null,
    styleOrderProductName: styleOrderProductName ? String(styleOrderProductName) : null,
    vendorId: Number(vendorId),
    vendorName: String(vendorName),
    hsnId: Number(hsnId),
    hsnCode: String(hsnCode),
    gstPercentage: String(gstPercentage || "5"),
    issueDate: String(issueDate),
    targetDate: targetDate ? String(targetDate) : null,
    deliveryDate: deliveryDate ? String(deliveryDate) : null,
    totalCost: String(parseFloat(totalCost) || 0),
    notes: notes ? String(notes) : null,
    createdBy: user.email,
  }).returning();
  return res.status(201).json({ data: row });
});

// ─── Style Custom Charges ─────────────────────────────────────────────────────
router.get("/style-custom-charges/:styleOrderId", requireAuth,
  checkPermission({ any: [STYLE_ORDER_TABS.COSTING, STYLE_ORDERS.VIEW] }),
  async (req, res) => {
  const rows = await db.select().from(customChargesTable)
    .where(and(eq(customChargesTable.styleOrderId, Number(String(req.params.styleOrderId))), eq(customChargesTable.isDeleted, false)))
    .orderBy(desc(customChargesTable.createdAt));
  return res.json({ data: rows });
});

router.post("/style-custom-charges", requireAuth,
  checkPermission({ all: [STYLE_ORDER_TABS.COSTING, STYLE_ORDERS.ADD_EDIT] }),
  async (req, res) => {
  const user = (req as any).user;
  const { styleOrderId, styleOrderProductId, styleOrderProductName, vendorId, vendorName, hsnId, hsnCode, gstPercentage, description, unitPrice, quantity } = req.body;
  if (!styleOrderId || !vendorId || !hsnId || !description) {
    return res.status(400).json({ error: "styleOrderId, vendorId, hsnId and description are required" }); return;
  }
  const unitPriceNum = parseFloat(unitPrice) || 0;
  const quantityNum = parseFloat(quantity) || 1;
  const totalAmount = (unitPriceNum * quantityNum).toFixed(2);
  const [row] = await db.insert(customChargesTable).values({
    styleOrderId: Number(styleOrderId),
    styleOrderProductId: styleOrderProductId ? Number(styleOrderProductId) : null,
    styleOrderProductName: styleOrderProductName ? String(styleOrderProductName) : null,
    vendorId: Number(vendorId),
    vendorName: String(vendorName),
    hsnId: Number(hsnId),
    hsnCode: String(hsnCode),
    gstPercentage: String(gstPercentage || "5"),
    description: String(description),
    unitPrice: String(unitPriceNum),
    quantity: String(quantityNum),
    totalAmount,
    createdBy: user.email,
  }).returning();
  return res.status(201).json({ data: row });
});

// ─── Invoice Items Aggregate ─────────────────────────────────────────────────
// GET /api/costing/invoice-items?type=Swatch&orderId=123
// Returns all cost-sheet components for an order as normalised invoice line items.
// BOM rows: uses consumedQty (not requiredQty) + weighted avg price from PRs + HSN from master.
router.get("/invoice-items", requireAuth, 
  checkPermission({ any: [STYLE_ORDERS.VIEW, SWATCH_ORDERS.VIEW] }),
  async (req, res) => {
  const type = String(req.query.type ?? "").trim();
  const orderId = Number(req.query.orderId);
  if (!orderId || (type !== "Swatch" && type !== "Style")) {
    return res.status(400).json({ error: "type (Swatch|Style) and orderId are required" }); return;
  }

  const isSwatch = type === "Swatch";

  // Fetch everything in parallel
  const [bomRows, artisanRows, outsourceRows, customRows, allMaterials, allFabrics, allPRs, shippingR, artworkRows] = await Promise.all([
    isSwatch
      ? db.select().from(swatchBomTable).where(and(eq(swatchBomTable.swatchOrderId, orderId), eq(swatchBomTable.isDeleted, false))).orderBy(swatchBomTable.createdAt)
      : db.select().from(swatchBomTable).where(and(eq(swatchBomTable.styleOrderId, orderId), eq(swatchBomTable.isDeleted, false))).orderBy(swatchBomTable.createdAt),

    isSwatch
      ? db.select().from(artisanTimesheetsTable).where(and(eq(artisanTimesheetsTable.swatchOrderId, orderId), eq(artisanTimesheetsTable.isDeleted, false)))
      : db.select().from(artisanTimesheetsTable).where(and(eq(artisanTimesheetsTable.styleOrderId, orderId), eq(artisanTimesheetsTable.isDeleted, false))),

    isSwatch
      ? db.select().from(outsourceJobsTable).where(and(eq(outsourceJobsTable.swatchOrderId, orderId), eq(outsourceJobsTable.isDeleted, false)))
      : db.select().from(outsourceJobsTable).where(and(eq(outsourceJobsTable.styleOrderId, orderId), eq(outsourceJobsTable.isDeleted, false))),

    isSwatch
      ? db.select().from(customChargesTable).where(and(eq(customChargesTable.swatchOrderId, orderId), eq(customChargesTable.isDeleted, false)))
      : db.select().from(customChargesTable).where(and(eq(customChargesTable.styleOrderId, orderId), eq(customChargesTable.isDeleted, false))),

    // Material + Fabric full master (for label format matching the dropdown)
    db.select({ materialCode: materialsTable.materialCode, itemType: materialsTable.type, quality: materialsTable.quality, colorName: materialsTable.colorName, hsnCode: materialsTable.hsnCode, gstPercent: materialsTable.gstPercent }).from(materialsTable).where(eq(materialsTable.isDeleted, false)),
    db.select({ fabricCode: fabricsTable.fabricCode, fabricType: fabricsTable.fabricType, quality: fabricsTable.quality, colorName: fabricsTable.colorName, hsnCode: fabricsTable.hsnCode, gstPercent: fabricsTable.gstPercent }).from(fabricsTable).where(eq(fabricsTable.isDeleted, false)),

    // PRs for weighted avg calculation
    isSwatch
      ? db.select().from(purchaseReceiptsTable).where(and(eq(purchaseReceiptsTable.swatchOrderId as any, orderId), eq(purchaseReceiptsTable.isDeleted, false))).catch(() => [] as any[])
      : db.select().from(purchaseReceiptsTable).where(and(eq(purchaseReceiptsTable.styleOrderId, orderId), eq(purchaseReceiptsTable.isDeleted, false))).catch(() => [] as any[]),

    pool.query(
      `SELECT final_shipping_amount FROM order_shipping_details WHERE reference_type = $1 AND reference_id = $2 AND is_deleted = false ORDER BY created_at DESC LIMIT 1`,
      [type, orderId]
    ).catch(() => ({ rows: [] as any[] })),

    // Artwork toile + pattern outhouse costs (Style orders only)
    isSwatch
      ? Promise.resolve([] as any[])
      : pool.query(
          `SELECT artwork_name, artwork_code, toile_making_cost, toile_vendor_name,
                  pattern_type, pattern_making_cost, pattern_payment_amount, pattern_vendor_name
           FROM style_order_artworks
           WHERE style_order_id = $1 AND is_deleted = false`,
          [orderId]
        ).then(r => r.rows).catch(() => [] as any[]),
  ]);

  // Build lookup maps — include label fields so descriptions match the frontend dropdown format
  const matMap = new Map(allMaterials.map(m => [m.materialCode, m]));
  const fabMap = new Map(allFabrics.map(f => [f.fabricCode, f]));

  // Build PR lookup for weighted avg: map bomRowId → list of {receivedQty, actualPrice}
  const prsByBomRow = new Map<number, { qty: number; price: number }[]>();
  for (const pr of (allPRs ?? [])) {
    if (pr.bomRowId == null) continue;
    const existing = prsByBomRow.get(pr.bomRowId) ?? [];
    existing.push({ qty: parseFloat(pr.receivedQty ?? "0"), price: parseFloat(pr.actualPrice ?? "0") });
    prsByBomRow.set(pr.bomRowId, existing);
  }

  const items: {
    description: string; category: string;
    quantity: number; unitPrice: number; total: number;
    hsnCode: string; hsnGstPct: string; unit: string; source: string;
  }[] = [];

  // BOM rows → Material or Fabric — use consumedQty + weighted avg price
  for (const r of bomRows) {
    const consumedQty = parseFloat(r.consumedQty ?? "0");
    if (consumedQty <= 0) continue;  // only include actually consumed items

    const isFabric = (r.materialType ?? "").toLowerCase() === "fabric";
    const stockNum = parseFloat(r.currentStock ?? "0");
    const avgPrice = parseFloat(r.avgUnitPrice ?? "0");

    // Compute weighted average price from PRs
    const prs = prsByBomRow.get(r.id) ?? [];
    const prTotal = prs.reduce((s, p) => s + p.qty * p.price, 0);
    const prQty = prs.reduce((s, p) => s + p.qty, 0);
    const weightedAvg = (stockNum + prQty) > 0
      ? (stockNum * avgPrice + prTotal) / (stockNum + prQty)
      : avgPrice;
    const rate = weightedAvg > 0 ? weightedAvg : avgPrice;
    const total = consumedQty * rate;

    // Build description in the same label format as the frontend dropdown
    const code = r.materialCode ?? "";
    let description: string;
    let hsnCode = "";
    let gstPercent = "0";
    if (isFabric) {
      const fab = fabMap.get(code);
      description = fab
        ? `${fab.fabricCode} · ${fab.fabricType} · ${fab.quality} · ${fab.colorName}`
        : `[${code}] ${r.materialName ?? ""}`.trim();
      hsnCode = fab?.hsnCode ?? "";
      gstPercent = fab?.gstPercent ?? "0";
    } else {
      const mat = matMap.get(code);
      description = mat
        ? `${mat.materialCode} · ${mat.itemType} · ${mat.quality} · ${mat.colorName}`
        : `[${code}] ${r.materialName ?? ""}`.trim();
      hsnCode = mat?.hsnCode ?? "";
      gstPercent = mat?.gstPercent ?? "0";
    }

    items.push({
      description,
      category: isFabric ? "Fabric" : "Material",
      quantity: consumedQty,
      unitPrice: parseFloat(rate.toFixed(4)),
      total: parseFloat(total.toFixed(2)),
      hsnCode,
      hsnGstPct: gstPercent,
      unit: r.unitType ?? "",
      source: "bom",
    });
  }

  // Artisan timesheets → Artisan
  for (const r of artisanRows) {
    const hrs = parseFloat(r.totalHours ?? "0") || 0;
    const n = Number(r.noOfArtisans) || 1;
    const rate = parseFloat(r.hourlyRate ?? "0") || 0;
    const total = parseFloat(r.totalRate ?? "0") || hrs * rate * n;
    items.push({
      description: `${r.shiftType} Labour — ${n} artisan${n !== 1 ? "s" : ""} (${r.startDate} to ${r.endDate})`,
      category: "Artisan",
      quantity: parseFloat((hrs * n).toFixed(2)),
      unitPrice: rate,
      total,
      hsnCode: "",
      hsnGstPct: "",
      unit: "hours",
      source: "artisan",
    });
  }

  // Outsource jobs → Outsource
  for (const r of outsourceRows) {
    const total = parseFloat(r.totalCost ?? "0") || 0;
    items.push({
      description: `Outsource: ${r.vendorName ?? ""}`,
      category: "Outsource",
      quantity: 1,
      unitPrice: total,
      total,
      hsnCode: r.hsnCode ?? "",
      hsnGstPct: r.gstPercentage ?? "",
      unit: "job",
      source: "outsource",
    });
  }

  // Custom charges → Custom
  for (const r of customRows) {
    const qty = parseFloat(r.quantity ?? "1") || 1;
    const rate = parseFloat(r.unitPrice ?? "0") || 0;
    const total = parseFloat(r.totalAmount ?? String(qty * rate)) || qty * rate;
    items.push({
      description: r.description ?? "Custom Charge",
      category: "Custom",
      quantity: qty,
      unitPrice: rate,
      total,
      hsnCode: r.hsnCode ?? "",
      hsnGstPct: r.gstPercentage ?? "",
      unit: "",
      source: "custom",
    });
  }

  // Artwork toile + pattern outhouse costs (Style orders only)
  for (const a of (artworkRows ?? [])) {
    const toileCost = parseFloat(a.toile_making_cost ?? "0") || 0;
    if (toileCost > 0) {
      const label = a.toile_vendor_name
        ? `Toile — ${a.artwork_name ?? a.artwork_code} (${a.toile_vendor_name})`
        : `Toile — ${a.artwork_name ?? a.artwork_code}`;
      items.push({
        description: label,
        category: "Artwork",
        quantity: 1,
        unitPrice: toileCost,
        total: toileCost,
        hsnCode: "",
        hsnGstPct: "",
        unit: "",
        source: "artwork_toile",
      });
    }
    const patternCost = a.pattern_type === "Outhouse"
      ? parseFloat(a.pattern_payment_amount ?? a.pattern_making_cost ?? "0") || 0
      : 0;
    if (patternCost > 0) {
      const label = a.pattern_vendor_name
        ? `Pattern (Outhouse) — ${a.artwork_name ?? a.artwork_code} (${a.pattern_vendor_name})`
        : `Pattern (Outhouse) — ${a.artwork_name ?? a.artwork_code}`;
      items.push({
        description: label,
        category: "Artwork",
        quantity: 1,
        unitPrice: patternCost,
        total: patternCost,
        hsnCode: "",
        hsnGstPct: "",
        unit: "",
        source: "artwork_pattern",
      });
    }
  }

  const shippingAmount = shippingR.rows.length > 0
    ? parseFloat(shippingR.rows[0].final_shipping_amount ?? "0") || 0
    : 0;

  return res.json({ data: items, shippingAmount, orderId, type });
});

// ──────────────────────────────────────────────────────────────────────────────
// COSTING PAYMENTS  (credits against outsource jobs / custom charges / artworks)
// ──────────────────────────────────────────────────────────────────────────────

// GET /costing/costing-payments-totals?referenceType=outsource_job&swatchOrderId=5
// Returns { referenceId: number, totalPaid: number }[] for all rows in an order
router.get("/costing-payments-totals", requireAuth, 
  checkPermission({ any: [STYLE_ORDERS.VIEW, SWATCH_ORDERS.VIEW] }),
  async (req, res) => {
  try {
    const { referenceType, swatchOrderId, styleOrderId } = req.query as Record<string, string>;
    if (!referenceType) return res.status(400).json({ error: "referenceType required" });
    const params: (string | number)[] = [referenceType];
    let where = "reference_type = $1 AND is_deleted = false";
    if (swatchOrderId) { params.push(parseInt(swatchOrderId)); where += ` AND swatch_order_id = $${params.length}`; }
    if (styleOrderId)  { params.push(parseInt(styleOrderId));  where += ` AND style_order_id = $${params.length}`; }
    const { rows } = await pool.query(
      `SELECT reference_id, COALESCE(SUM(base_currency_amount), 0) AS total_paid
       FROM costing_payments WHERE ${where}
       GROUP BY reference_id`,
      params
    );
    return res.json({ data: rows.map(r => ({ referenceId: Number(r.reference_id), totalPaid: parseFloat(r.total_paid) })) });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch payment totals" });
  }
});

// GET /costing/costing-payments?referenceType=outsource_job&referenceId=5
router.get("/costing-payments", requireAuth, 
  checkPermission({ any: [STYLE_ORDERS.VIEW, SWATCH_ORDERS.VIEW] }),
  async (req, res) => {
  try {
    const { referenceType, referenceId } = req.query as Record<string, string>;
    if (!referenceType || !referenceId) {
      return res.status(400).json({ error: "referenceType and referenceId are required" });
    }
    const { rows } = await pool.query(
      `SELECT * FROM costing_payments
       WHERE reference_type = $1 AND reference_id = $2 AND is_deleted = false
       ORDER BY created_at ASC`,
      [referenceType, parseInt(referenceId)]
    );
    return res.json({ data: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /costing/costing-payments — upsert by (reference_type, reference_id, transaction_id)
router.post(
  "/costing-payments",
  requireAuth,
  checkPermission({ any: [STYLE_ORDERS.ADD_EDIT, SWATCH_ORDERS.ADD_EDIT] }),
  async (req, res) => {
    const client = await pool.connect(); 
    try {
      const user = (req as any).user;
      const { vendorId, vendorName, referenceType, referenceId, swatchOrderId, styleOrderId, paymentType, paymentMode, paymentAmount, paymentStatus, transactionId, paymentDate, remarks, currencyCode, exchangeRateSnapshot, tdsMasterId, } = req.body;

      if (!vendorId || !referenceType || !referenceId || !paymentAmount) {
        await client.release();
        return res.status(400).json({
          error: "vendorId, referenceType, referenceId, paymentAmount are required",
        });
      }

      await client.query("BEGIN");

      const payCcy = currencyCode || "INR";
      const payRate = parseFloat(String(exchangeRateSnapshot ?? "1")) || 1;
      const baseAmt = (parseFloat(String(paymentAmount)) * payRate).toFixed(2);

      let resultRow: any;

      // Helper to upsert TDS (uses the same client)
      const upsertTds = async (
        paymentId: number,
        vendorIdNum: number,
        paymentDateVal: Date | string | null,
        tdsMasterIdVal: number | undefined,
        baseAmount: string,
        client: any, 
      ) => {
        if (!tdsMasterIdVal) return;

        // Fetch TDS master
       const masterRes = await client.query( `SELECT rate_percent, threshold_amount FROM tds_master WHERE id = $1 AND status = true AND is_deleted = false`, [tdsMasterIdVal] );
        if (masterRes.rows.length === 0) {
          throw new Error("Invalid TDS master selected");
        }
        const { rate_percent, threshold_amount } = masterRes.rows[0];

        const paidAmt = parseFloat(baseAmount);
        const tdsRate = parseFloat(rate_percent);
        const threshold = parseFloat(threshold_amount ?? "0");
        const tdsAmount = paidAmt > threshold ? (paidAmt * tdsRate) / 100 : 0;

        // Check if TDS record exists for this costing payment
       const existing = await client.query( `SELECT id FROM payment_tds WHERE payment_source_type = 'costing_payments' AND payment_source_id = $1`, [paymentId] );

        if (existing.rows.length > 0) {
          // Update existing record
          await client.query(
            `UPDATE payment_tds
             SET tds_master_id = $1,
                 paid_amount = $2,
                 tds_rate = $3,
                 tds_amount = $4,
                 updated_by = $5,
                 updated_at = NOW()
             WHERE id = $6`,
            [tdsMasterIdVal, paidAmt, tdsRate, tdsAmount, user?.username || "system", existing.rows[0].id]
          );
        } else {
          // Insert new TDS record
          await client.query(
            `INSERT INTO payment_tds
               (tds_master_id, payment_source_type, payment_source_id,
                payment_date, vendor_id,
                base_document_type, base_document_id,
                paid_amount, tds_rate, tds_amount,
                status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              tdsMasterIdVal,
              "costing_payments",
              paymentId,
              paymentDateVal || new Date(),
              vendorIdNum,
              referenceType || null,
              referenceId || null,
              paidAmt,
              tdsRate,
              tdsAmount,
              "DEDUCTED",
              user?.username || "system",
            ]
          );
        }
      };

      // Upsert by transaction_id (existing logic)
      if (transactionId) {
        const existing = await client.query(
          `SELECT id FROM costing_payments
           WHERE reference_type = $1 AND reference_id = $2 AND transaction_id = $3
           LIMIT 1`,
          [referenceType, parseInt(referenceId), transactionId]
        );
        if (existing.rows.length > 0) {
          const updateRes = await client.query(
            `UPDATE costing_payments SET
               vendor_id = $1, vendor_name = $2, payment_type = $3, payment_mode = $4,
               payment_amount = $5, payment_status = $6, payment_date = $7, remarks = $8,
               currency_code = $10, exchange_rate_snapshot = $11, base_currency_amount = $12
             WHERE id = $9
             RETURNING *`,
            [
              parseInt(vendorId),
              vendorName,
              paymentType,
              paymentMode,
              parseFloat(paymentAmount),
              paymentStatus,
              paymentDate ? new Date(paymentDate) : null,
              remarks,
              existing.rows[0].id,
              payCcy,
              payRate,
              baseAmt,
            ]
          );
          resultRow = updateRes.rows[0];

          // Update TDS record (if any)
          await upsertTds(
            resultRow.id,
            resultRow.vendor_id,
            resultRow.payment_date || new Date(),
            tdsMasterId,
            resultRow.base_currency_amount,
            client
          );

          await client.query("COMMIT");
          client.release();
          return res.json({ data: resultRow, updated: true });
        }
      }

      // Insert new payment
      const insertRes = await client.query(
        `INSERT INTO costing_payments
           (vendor_id, vendor_name, reference_type, reference_id, swatch_order_id, style_order_id,
            payment_type, payment_mode, payment_amount, currency_code, exchange_rate_snapshot, base_currency_amount,
            payment_status, transaction_id, payment_date, remarks, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [
          parseInt(vendorId),
          vendorName,
          referenceType,
          parseInt(referenceId),
          swatchOrderId ? parseInt(swatchOrderId) : null,
          styleOrderId ? parseInt(styleOrderId) : null,
          paymentType,
          paymentMode,
          parseFloat(paymentAmount),
          payCcy,
          payRate,
          baseAmt,
          paymentStatus || "Pending",
          transactionId || null,
          paymentDate ? new Date(paymentDate) : null,
          remarks || null,
          user?.username ?? "system",
        ]
      );
      resultRow = insertRes.rows[0];

      // Create TDS record
      await upsertTds(
        resultRow.id,
        resultRow.vendor_id,
        resultRow.payment_date || new Date(),
        tdsMasterId,
        resultRow.base_currency_amount,
        client
      );

      await client.query("COMMIT");
      client.release();
      return res.status(201).json({ data: resultRow });
    } catch (err: any) {
      await client.query("ROLLBACK");
      client.release();
      console.error("Error in /costing-payments:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// PATCH /costing/costing-payments/:id — update payment fields
router.patch("/costing-payments/:id", requireAuth,
  checkPermission({ any: [STYLE_ORDERS.ADD_EDIT, SWATCH_ORDERS.ADD_EDIT] }),
  async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const { paymentType, paymentMode, paymentAmount, paymentStatus, transactionId, paymentDate, remarks, currencyCode, exchangeRateSnapshot } = req.body;
    // Recompute the INR base anchor whenever EITHER amount or rate changes, deriving the
    // missing side from the existing row so base never goes stale on a partial update.
    const payRate = exchangeRateSnapshot != null ? (parseFloat(String(exchangeRateSnapshot)) || 1) : null;
    let baseAmt: string | null = null;
    if (paymentAmount != null || payRate != null) {
      const cur = await pool.query(
        `SELECT payment_amount, exchange_rate_snapshot FROM costing_payments WHERE id = $1`,
        [id],
      );
      if (cur.rows.length) {
        const effAmt = paymentAmount != null ? parseFloat(String(paymentAmount)) : parseFloat(cur.rows[0].payment_amount ?? "0");
        const effRate = payRate != null ? payRate : (parseFloat(cur.rows[0].exchange_rate_snapshot ?? "1") || 1);
        baseAmt = (effAmt * effRate).toFixed(2);
      }
    }
    const { rows } = await pool.query(
      `UPDATE costing_payments SET
         payment_type = COALESCE($1, payment_type),
         payment_mode = COALESCE($2, payment_mode),
         payment_amount = COALESCE($3, payment_amount),
         payment_status = COALESCE($4, payment_status),
         transaction_id = COALESCE($5, transaction_id),
         payment_date = COALESCE($6, payment_date),
         remarks = COALESCE($7, remarks),
         currency_code = COALESCE($9, currency_code),
         exchange_rate_snapshot = COALESCE($10, exchange_rate_snapshot),
         base_currency_amount = COALESCE($11, base_currency_amount)
       WHERE id = $8
       RETURNING *`,
      [
        paymentType ?? null, paymentMode ?? null,
        paymentAmount != null ? parseFloat(paymentAmount) : null,
        paymentStatus ?? null,
        transactionId ?? null,
        paymentDate ? new Date(paymentDate) : null,
        remarks ?? null,
        id,
        currencyCode ?? null,
        payRate,
        baseAmt,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    return res.json({ data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /costing/costing-payments/:id — admin only
router.delete("/costing-payments/:id", requireAuth, 
  checkPermission({ any: [STYLE_ORDERS.DELETE, SWATCH_ORDERS.DELETE] }),
  async (req, res) => {
  try {
    const user = (req as any).user;
    if (user?.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    const id = parseInt(String(req.params.id));
    const r = await pool.query("UPDATE costing_payments SET is_deleted = true, deleted_by = $2, deleted_at = now() WHERE id = $1 AND is_deleted = false RETURNING id", [id, user.email]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Public: one-click email approve / reject ─────────────────────────────────
router.get("/po-action", async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };

  const html = (title: string, icon: string, color: string, body: string) => `
    <!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>${title} — ZARI ERP</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:#f8f9fb;font-family:'Helvetica Neue',Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}
      .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.10);max-width:420px;width:100%;overflow:hidden;}
      .header{background:#111;padding:24px 32px;text-align:center;}
      .header-title{color:#C6AF4B;font-size:20px;font-weight:700;letter-spacing:1px;}
      .header-sub{color:#888;font-size:11px;margin-top:4px;letter-spacing:.5px;}
      .body{padding:36px 32px;text-align:center;}
      .icon{font-size:48px;margin-bottom:16px;}
      .title{font-size:20px;font-weight:700;color:${color};margin-bottom:10px;}
      .msg{font-size:14px;color:#4B5563;line-height:1.6;}
      .po{font-size:13px;font-weight:600;color:#111;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:8px 16px;display:inline-block;margin:14px 0;}
      .footer{padding:16px 32px;background:#F9FAFB;border-top:1px solid #F0F0F0;text-align:center;font-size:11px;color:#9CA3AF;}
    </style></head><body>
    <div class="card">
      <div class="header"><p class="header-title">ZARI ERP</p><p class="header-sub">ENTERPRISE RESOURCE PLANNING</p></div>
      <div class="body">
        <div class="icon">${icon}</div>
        <div class="title">${title}</div>
        ${body}
      </div>
      <div class="footer">ZARI Embroideries &copy; ${new Date().getFullYear()}</div>
    </div></body></html>`;

  if (!token) {
    return res.status(400).send(html("Invalid Link", "⚠️", "#D97706", `<p class="msg">No action token provided. This link may be malformed.</p>`));
  }

  let payload: { poId: number; action: string };
  try {
    payload = jwt.verify(token, process.env.SESSION_SECRET ?? "secret") as { poId: number; action: string };
  } catch {
    return res.status(400).send(html("Link Expired", "⏰", "#D97706", `<p class="msg">This approval link has expired or is invalid. Please log in to ZARI ERP to take action.</p>`));
  }

  const { poId, action } = payload;
  if (!["approve", "reject"].includes(action)) {
    return res.status(400).send(html("Invalid Action", "⚠️", "#D97706", `<p class="msg">Unknown action in token.</p>`));
  }

  const [po] = await db.select().from(purchaseOrdersTable).where(and(eq(purchaseOrdersTable.id, Number(poId)), eq(purchaseOrdersTable.isDeleted, false)));
  if (!po) {
    return res.status(404).send(html("PO Not Found", "🔍", "#DC2626", `<p class="msg">Purchase Order #${poId} could not be found.</p>`));
  }

  if (po.status === "Approved" && action === "approve") {
    return res.send(html("Already Approved", "✅", "#059669",
      `<div class="po">${po.poNumber}</div><p class="msg">This Purchase Order was already approved. No further action needed.</p>`));
  }
  if (po.status === "Cancelled" && action === "reject") {
    return res.send(html("Already Rejected", "❌", "#DC2626",
      `<div class="po">${po.poNumber}</div><p class="msg">This Purchase Order was already rejected.</p>`));
  }

  const newStatus = action === "approve" ? "Approved" : "Cancelled";
  const updates: Record<string, unknown> = {
    status: newStatus,
    updatedBy: "email-action",
    updatedAt: new Date(),
  };
  if (action === "approve") {
    updates.approvedBy = "email-action";
    updates.approvedAt = new Date();
  }
  await db.update(purchaseOrdersTable).set(updates).where(eq(purchaseOrdersTable.id, Number(poId)));

  if (action === "approve") {
    return res.send(html("Purchase Order Approved", "✅", "#059669",
      `<div class="po">${po.poNumber}</div><p class="msg">The Purchase Order has been <strong>approved</strong>. Purchase Receipts can now be created against this order.</p>`));
  } else {
    return res.send(html("Purchase Order Rejected", "❌", "#DC2626",
      `<div class="po">${po.poNumber}</div><p class="msg">The Purchase Order has been <strong>rejected</strong>. The status has been updated to Cancelled.</p>`));
  }
});

export default router;
