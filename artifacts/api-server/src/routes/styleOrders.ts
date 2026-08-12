import { Router } from "express";
import { db, styleOrdersTable, eq, and, ilike, or, desc, sql,  entityTagsTable, exists } from "@workspace/db";
// import { eq, and, ilike, or, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { checkPermission } from "../middlewares/checkPermission";
import { STYLE_ORDERS, STOCK_ADJUSTMENTS, STOCK_PURCHASE_ORDERS } from "../constants/permissions";
import { insertStyleOrderSchema, updateStyleOrderSchema, clientsTable } from "@workspace/db";
import { generateOrderCode } from "../services/orderCodeService";

const router = Router();

// List
router.get("/style-orders", requireAuth, 
  checkPermission({ any: [STYLE_ORDERS.VIEW, STOCK_ADJUSTMENTS.VIEW, STOCK_PURCHASE_ORDERS.VIEW] }), 
  async (req, res) => {
  const { search = "", status = "all", priority = "all", chargeable = "all",   tag = "", page = "1", limit = "24" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [eq(styleOrdersTable.isDeleted, false)];

  const q = search.trim();
  if (q) {
    conditions.push(
      or(
        ilike(styleOrdersTable.styleName, `%${q}%`),
        ilike(styleOrdersTable.styleNo, `%${q}%`),
        ilike(styleOrdersTable.clientName, `%${q}%`),
        ilike(styleOrdersTable.orderCode, `%${q}%`),
        exists(
          db
            .select({ one: sql`1` })
            .from(entityTagsTable)
            .where(
              and(
                eq(entityTagsTable.entityType, "style_order"),
                eq(entityTagsTable.entityId, styleOrdersTable.id),
                ilike(entityTagsTable.tag, `%${q}%`)
              )
            )
        )
      )!,
    );
  }
  if (status !== "all") conditions.push(eq(styleOrdersTable.orderStatus, status));
  if (priority !== "all") conditions.push(eq(styleOrdersTable.priority, priority));
  if (chargeable === "yes") conditions.push(eq(styleOrdersTable.isChargeable, true));
  if (chargeable === "no") conditions.push(eq(styleOrdersTable.isChargeable, false));
  const { inhouse = "all" } = req.query as Record<string, string>;
  if (inhouse === "yes") conditions.push(eq(styleOrdersTable.isInhouse, true));
  if (inhouse === "no") conditions.push(eq(styleOrdersTable.isInhouse, false));
  if (tag.trim()) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(entityTagsTable)
          .where(
            and(
              eq(entityTagsTable.entityType, "style_order"),
              eq(entityTagsTable.entityId, styleOrdersTable.id),
              ilike(entityTagsTable.tag, `%${tag.trim()}%`)
            )
          )
      )
    );
  }

  const where = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db.select().from(styleOrdersTable).where(where).orderBy(desc(styleOrdersTable.createdAt)).limit(limitNum).offset(offset),
    db.select({ id: styleOrdersTable.id }).from(styleOrdersTable).where(where),
  ]);

  return res.json({ data: rows, total: countRows.length, page: pageNum, limit: limitNum });
});

// Get one
router.get("/style-orders/:id", requireAuth, checkPermission(STYLE_ORDERS.VIEW), async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [row, tags] = await Promise.all([
    db.select().from(styleOrdersTable).where(eq(styleOrdersTable.id, id)),
    db
      .select({ tag: entityTagsTable.tag })
      .from(entityTagsTable)
      .where(
        and(
          eq(entityTagsTable.entityType, "style_order"),
          eq(entityTagsTable.entityId, id)
        )
      ),
  ]);

  if (!row.length || row[0].isDeleted)
    return res.status(404).json({ error: "Not found" });

  return res.json({
    data: {
      ...row[0],
      tags: tags.map(t => t.tag),
    },
  });

});

// Create
router.post("/style-orders", requireAuth, checkPermission(STYLE_ORDERS.ADD_EDIT), async (req, res) => {
  const parsed = insertStyleOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  if (!parsed.data.clientId) {
    return res.status(400).json({ error: "Client is required" });
  }
  const clientId = Number(parsed.data.clientId);
  const orderCode = await generateOrderCode(
    clientId,
    "style_orders",
    "order_code"
  );
  const user = (req as any).user;
  const tags = [
    ...new Set(
      parsed.data.tags
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
    ),
  ];

  const row = await db.transaction(async tx => {
    const [order] = await tx
      .insert(styleOrdersTable)
      .values({
        ...parsed.data,
        orderCode,
        createdBy: user?.username ?? "system",
      })
      .returning();

    if (tags.length) {
      await tx.insert(entityTagsTable).values(
        tags.map(tag => ({
          entityType: "style_order",
          entityId: order.id,
          tag,
        }))
      );
    }

    return order;
  });

  return res.status(201).json({ data: row });
});

// Update
router.put("/style-orders/:id", requireAuth, checkPermission(STYLE_ORDERS.ADD_EDIT), async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const parsed = updateStyleOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const user = (req as any).user;

  const tags = [
    ...new Set(
      (parsed.data.tags ?? [])
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
    ),
  ];

  try {
    const row = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(styleOrdersTable)
        .set({
          ...parsed.data,
          updatedBy: user?.username ?? "system",
          updatedAt: new Date(),
        })
        .where(eq(styleOrdersTable.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Not found" });
      }

      // Remove existing tags
      await tx
        .delete(entityTagsTable)
        .where(
          and(
            eq(entityTagsTable.entityType, "style_order"),
            eq(entityTagsTable.entityId, id)
          )
        );

      // Insert latest tags
      if (tags.length > 0) {
        await tx.insert(entityTagsTable).values(
          tags.map(tag => ({
            entityType: "style_order",
            entityId: id,
            tag,
          }))
        );
      }

      return updated;
    });

    return res.json({ data: row });

  } catch (error) {
    
    console.error(error);
    return res.status(500).json({ error: "Failed to update style order" });
  }

});

// Patch status (cancel / priority change)
router.patch("/style-orders/:id/status", requireAuth, checkPermission(STYLE_ORDERS.ADD_EDIT), async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { orderStatus, priority, cancelReason } = req.body as { orderStatus?: string; priority?: string; cancelReason?: string };
  const user = (req as typeof req & { user?: { email: string } }).user;
  const updates: Partial<typeof styleOrdersTable.$inferInsert> = {
    updatedBy: user?.email ?? "system",
    updatedAt: new Date(),
  };
  if (orderStatus) updates.orderStatus = orderStatus;
  if (priority) updates.priority = priority;
  if (cancelReason !== undefined) updates.cancelReason = cancelReason;
  const [row] = await db.update(styleOrdersTable).set(updates).where(eq(styleOrdersTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ data: row });
});

// Delete (soft) — only Draft orders with no linked records
router.delete("/style-orders/:id", requireAuth, checkPermission(STYLE_ORDERS.DELETE), async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [order] = await db.select({ orderStatus: styleOrdersTable.orderStatus })
    .from(styleOrdersTable).where(eq(styleOrdersTable.id, id));
  if (!order) return res.status(404).json({ error: "Not found" });

  if (order.orderStatus !== "Draft") {
    return res.status(409).json({ error: `Cannot delete an order in "${order.orderStatus}" status. Use "Cancel Order" to deactivate it instead.` });
  }

  const linked = await db.execute(sql`
    SELECT (
      SELECT COUNT(*) FROM style_order_artworks WHERE style_order_id = ${id}
    ) + (
      SELECT COUNT(*) FROM consumption_log WHERE style_order_id = ${id}
    ) AS total
  `);
  if (Number((linked.rows?.[0] as Record<string, unknown>)?.total ?? 0) > 0) {
    return res.status(409).json({ error: "This order has linked artworks or stock consumptions. Use 'Cancel Order' to deactivate it instead." });
  }

  const user = (req as any).user;
  await db.transaction(async tx => {
    await tx
      .update(styleOrdersTable)
      .set({
        isDeleted: true,
        deletedBy: user?.email ?? "system",
        deletedAt: new Date(),
      })
      .where(eq(styleOrdersTable.id, id));

    await tx
      .delete(entityTagsTable)
      .where(
        and(
          eq(entityTagsTable.entityType, "style_order"),
          eq(entityTagsTable.entityId, id)
        )
      );
  });
  return res.json({ message: "Deleted" });
});

export default router;
