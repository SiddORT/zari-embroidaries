import { pool } from "@workspace/db";

export type InventorySourceType = "fabric" | "material" | "packaging";

export interface InventoryAutoCreateData {
  itemName: string;
  itemCode: string;
  category?: string | null;
  department?: string | null;
  warehouseLocation?: string | null;
  unitType?: string | null;
  averagePrice?: string | number | null;
  preferredVendor?: string | null;
}

export async function ensureInventoryRecord(
  sourceType: InventorySourceType,
  sourceId: number,
  data: InventoryAutoCreateData
): Promise<void> {
  try {
    const avgPrice = data.averagePrice ? (parseFloat(String(data.averagePrice)) || 0) : 0;
    await pool.query(
      `INSERT INTO inventory_items (
         source_type, source_id, item_name, item_code, category, department,
         warehouse_location, unit_type, current_stock, style_reserved_qty,
         swatch_reserved_qty, available_stock, average_price, last_purchase_price,
         preferred_vendor, last_updated_at, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,0,0,0,$9,0,$10,NOW(),NOW())
       ON CONFLICT (source_type, source_id) DO NOTHING`,
      [
        sourceType,
        sourceId,
        data.itemName,
        data.itemCode,
        data.category ?? null,
        data.department ?? null,
        data.warehouseLocation ?? null,
        data.unitType ?? null,
        avgPrice,
        data.preferredVendor ?? null,
      ]
    );
  } catch (err) {
    console.error("[InventoryService] Failed to create inventory record:", err);
  }
}

export async function syncAllFromMasters(): Promise<{ synced: number }> {
  try {
    const [f, m, p] = await Promise.all([
      pool.query(`
        INSERT INTO inventory_items
          (source_type, source_id, item_name, item_code, category, unit_type,
           warehouse_location, average_price, last_purchase_price, preferred_vendor,
           last_updated_at, created_at)
        SELECT
          'fabric', f.id,
          TRIM(CONCAT(f.fabric_type, ' - ', f.quality, ' - ', f.color_name)),
          f.fabric_code, f.fabric_type, f.unit_type,
          f.location,
          COALESCE(NULLIF(TRIM(f.price_per_meter),'')::numeric, 0),
          COALESCE(NULLIF(TRIM(f.price_per_meter),'')::numeric, 0),
          f.vendor, NOW(), NOW()
        FROM fabrics f
        WHERE f.is_deleted = false
        ON CONFLICT (source_type, source_id) DO NOTHING
        RETURNING id
      `),
      pool.query(`
        INSERT INTO inventory_items
          (source_type, source_id, item_name, item_code, category, unit_type,
           warehouse_location, average_price, last_purchase_price, preferred_vendor,
           last_updated_at, created_at)
        SELECT
          'material', m.id,
          TRIM(CONCAT(m.item_type, ' - ', m.quality, ' - ', m.color_name)),
          m.material_code, m.item_type, m.unit_type,
          m.location,
          COALESCE(NULLIF(TRIM(m.unit_price),'')::numeric, 0),
          COALESCE(NULLIF(TRIM(m.unit_price),'')::numeric, 0),
          m.vendor, NOW(), NOW()
        FROM materials m
        WHERE m.is_deleted = false
        ON CONFLICT (source_type, source_id) DO NOTHING
        RETURNING id
      `),
      pool.query(`
        INSERT INTO inventory_items
          (source_type, source_id, item_name, item_code, category, unit_type,
           warehouse_location, average_price, last_purchase_price, preferred_vendor,
           last_updated_at, created_at)
        SELECT
          'packaging', p.id,
          p.item_name,
          p.item_code, p.item_type, p.unit_type,
          p.location,
          COALESCE(p.unit_price, 0),
          COALESCE(p.unit_price, 0),
          p.vendor, NOW(), NOW()
        FROM packaging_materials p
        WHERE p.is_deleted = false
        ON CONFLICT (source_type, source_id) DO NOTHING
        RETURNING id
      `),
    ]);
    return { synced: (f.rowCount ?? 0) + (m.rowCount ?? 0) + (p.rowCount ?? 0) };
  } catch (err) {
    console.error("[InventoryService] Sync failed:", err);
    throw err;
  }
}
