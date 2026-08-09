import { Router, type IRouter } from "express";
import { db, swatchOrdersTable,clientsTable, eq, and, ilike, or, desc, sql, exists, entityTagsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { checkPermission } from "../middlewares/checkPermission";
import { SWATCH_ORDERS, STOCK_ADJUSTMENTS, STOCK_PURCHASE_RECEIPTS, STOCK_PURCHASE_ORDERS } from "../constants/permissions";
import { logger } from "../lib/logger";
import { generateOrderCode } from "../services/orderCodeService";

const router: IRouter = Router();

router.get("/swatch-orders", requireAuth, 
  checkPermission({any : [SWATCH_ORDERS.VIEW, STOCK_ADJUSTMENTS.VIEW, STOCK_PURCHASE_ORDERS.VIEW]}), 
  async (req, res): Promise<void> => {
  const { search = "", status = "all", priority = "all", chargeable = "all",   tag = "", page = "1", limit = "20" } = req.query as Record<string, string>;
  const pg = Math.max(1, parseInt(page));
  const lim = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pg - 1) * lim;

  const conditions = [eq(swatchOrdersTable.isDeleted, false)];
  const q = search.trim();
  if (q) {
    conditions.push(
      or(
        ilike(swatchOrdersTable.swatchName, `%${q}%`),
        ilike(swatchOrdersTable.clientName, `%${q}%`),
        ilike(swatchOrdersTable.orderCode, `%${q}%`),
        exists(
          db
            .select({ one: sql`1` })
            .from(entityTagsTable)
            .where(
              and(
                eq(entityTagsTable.entityType, "swatch_order"),
                eq(entityTagsTable.entityId, swatchOrdersTable.id),
                ilike(entityTagsTable.tag, `%${q}%`)
              )
            )
        )
      )!,
    );
  }
  if (status !== "all") conditions.push(eq(swatchOrdersTable.orderStatus, status));
  if (priority !== "all") conditions.push(eq(swatchOrdersTable.priority, priority));
  if (chargeable === "yes") conditions.push(eq(swatchOrdersTable.isChargeable, true));
  if (chargeable === "no") conditions.push(eq(swatchOrdersTable.isChargeable, false));
  const { inhouse = "all" } = req.query as Record<string, string>;
  if (inhouse === "yes") conditions.push(eq(swatchOrdersTable.isInhouse, true));
  if (inhouse === "no") conditions.push(eq(swatchOrdersTable.isInhouse, false));
  if (tag.trim()) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(entityTagsTable)
          .where(
            and(
              eq(entityTagsTable.entityType, "swatch_order"),
              eq(entityTagsTable.entityId, swatchOrdersTable.id),
              ilike(entityTagsTable.tag, `%${tag.trim()}%`)
            )
          )
      )
    );
  }

  const where = and(...conditions);
  const [rows, countRow] = await Promise.all([
    db.select().from(swatchOrdersTable).where(where).orderBy(desc(swatchOrdersTable.createdAt)).limit(lim).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(swatchOrdersTable).where(where),
  ]);

  res.json({ data: rows, total: Number(countRow[0]?.count ?? 0), page: pg, limit: lim });
});

router.get("/swatch-orders/:id", requireAuth, checkPermission(SWATCH_ORDERS.VIEW), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(swatchOrdersTable).where(
    and(eq(swatchOrdersTable.id, id), eq(swatchOrdersTable.isDeleted, false))
  );
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  const tags = await db
    .select({ tag: entityTagsTable.tag })
    .from(entityTagsTable)
    .where(
      and(
        eq(entityTagsTable.entityType, "swatch_order"),
        eq(entityTagsTable.entityId, id)
      )
    );

  res.json({
    data: {
      ...row,
      tags: tags.map(t => t.tag),
    },
  });

});

router.post("/swatch-orders", requireAuth, checkPermission(SWATCH_ORDERS.ADD_EDIT), async (req, res): Promise<void> => {
  const user = (req as typeof req & { user?: { email: string } }).user;
  const body = req.body as Record<string, unknown>;

  if (!body.swatchName || typeof body.swatchName !== "string" || !body.swatchName.trim()) {
    res.status(400).json({ error: "Swatch Name is required" });
    return;
  }

  if(!body.clientId){
    res.status(400).json({ error: "Client is required" });
    return;
  }
  const clientId = Number(body.clientId);

  const orderCode = await generateOrderCode(
    clientId,
    "swatch_orders",
    "order_code"
  );

  const tags = Array.isArray(body.tags)
  ? [
      ...new Set(
        body.tags
          .filter((t): t is string => typeof t === "string")
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
      ),
    ]
  : [];

  try {
    const row = await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(swatchOrdersTable)
        .values({
          orderCode,
          swatchName: body.swatchName as string,
          clientId: (body.clientId as string) || null,
          clientName: (body.clientName as string) || null,
          isChargeable: Boolean(body.isChargeable),
          isInhouse: Boolean(body.isInhouse),
          quantity: (body.quantity as string) || null,
          priority: (body.priority as string) || "Medium",
          orderStatus: (body.orderStatus as string) || "Draft",
          styleReferences: (body.styleReferences as object[]) || [],
          swatchReferences: (body.swatchReferences as object[]) || [],
          fabricId: (body.fabricId as string) || null,
          fabricName: (body.fabricName as string) || null,
          hasLining: Boolean(body.hasLining),
          liningFabricId: (body.liningFabricId as string) || null,
          liningFabricName: (body.liningFabricName as string) || null,
          unitLength: (body.unitLength as string) || null,
          unitWidth: (body.unitWidth as string) || null,
          unitType: (body.unitType as string) || null,
          orderIssueDate: (body.orderIssueDate as string) || null,
          deliveryDate: (body.deliveryDate as string) || null,
          targetHours: (body.targetHours as string) || null,
          issuedTo: (body.issuedTo as string) || null,
          department: (body.department as string) || null,
          description: (body.description as string) || null,
          internalNotes: (body.internalNotes as string) || null,
          clientInstructions: (body.clientInstructions as string) || null,
          refDocs: (body.refDocs as object[]) || [],
          refImages: (body.refImages as object[]) || [],
          wipImages: (body.wipImages as object[]) || [],
          finalImages: (body.finalImages as object[]) || [],
          wipVideos: (body.wipVideos as object[]) || [],
          finalVideos: (body.finalVideos as object[]) || [],
          estimate: (body.estimate as object[]) || [],
          actualStartDate: (body.actualStartDate as string) || null,
          actualStartTime: (body.actualStartTime as string) || null,
          tentativeDeliveryDate: (body.tentativeDeliveryDate as string) || null,
          actualCompletionDate: (body.actualCompletionDate as string) || null,
          actualCompletionTime: (body.actualCompletionTime as string) || null,
          delayReason: (body.delayReason as string) || null,
          approvalDate: (body.approvalDate as string) || null,
          revisionCount: Number(body.revisionCount) || 0,
          createdBy: user?.email ?? "system",
        })
        .returning();

      if (tags.length > 0) {
        await tx.insert(entityTagsTable).values(
          tags.map(tag => ({
            entityType: "swatch_order",
            entityId: order.id,
            tag,
          }))
        );
      }

      return order;
    });

    res.status(201).json({ data: row });

  } catch (error) {
    logger.error(error, "Failed to create swatch order");
    res.status(500).json({ error: "Failed to create swatch order" });
  }
});

router.put("/swatch-orders/:id", requireAuth, checkPermission(SWATCH_ORDERS.ADD_EDIT), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const user = (req as typeof req & { user?: { email: string } }).user;
  const body = req.body as Record<string, unknown>;

  const tags = Array.isArray(body.tags)
  ? [
      ...new Set(
        body.tags
          .filter((t): t is string => typeof t === "string")
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
      ),
    ]
  : [];

  try {
    const row = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: swatchOrdersTable.id })
        .from(swatchOrdersTable)
        .where(
          and(
            eq(swatchOrdersTable.id, id),
            eq(swatchOrdersTable.isDeleted, false)
          )
        );

      if (!existing) { res.status(404).json({ error: "Not found" }); return; }

      const [updated] = await tx
        .update(swatchOrdersTable)
        .set({
          swatchName: body.swatchName as string || undefined,
          clientId: (body.clientId as string) ?? null,
          clientName: (body.clientName as string) ?? null,
          isChargeable: body.isChargeable !== undefined ? Boolean(body.isChargeable) : undefined,
          isInhouse: body.isInhouse !== undefined ? Boolean(body.isInhouse) : undefined,
          quantity: (body.quantity as string) ?? null,
          priority: (body.priority as string) || undefined,
          orderStatus: (body.orderStatus as string) || undefined,
          styleReferences: (body.styleReferences as object[]) ?? undefined,
          swatchReferences: (body.swatchReferences as object[]) ?? undefined,
          fabricId: (body.fabricId as string) ?? null,
          fabricName: (body.fabricName as string) ?? null,
          hasLining: body.hasLining !== undefined ? Boolean(body.hasLining) : undefined,
          liningFabricId: (body.liningFabricId as string) ?? null,
          liningFabricName: (body.liningFabricName as string) ?? null,
          unitLength: (body.unitLength as string) ?? null,
          unitWidth: (body.unitWidth as string) ?? null,
          unitType: (body.unitType as string) ?? null,
          orderIssueDate: (body.orderIssueDate as string) ?? null,
          deliveryDate: (body.deliveryDate as string) ?? null,
          targetHours: (body.targetHours as string) ?? null,
          issuedTo: (body.issuedTo as string) ?? null,
          department: (body.department as string) ?? null,
          description: (body.description as string) ?? null,
          internalNotes: (body.internalNotes as string) ?? null,
          clientInstructions: (body.clientInstructions as string) ?? null,
          refDocs: (body.refDocs as object[]) ?? undefined,
          refImages: (body.refImages as object[]) ?? undefined,
          wipImages: (body.wipImages as object[]) ?? undefined,
          finalImages: (body.finalImages as object[]) ?? undefined,
          wipVideos: (body.wipVideos as object[]) ?? undefined,
          finalVideos: (body.finalVideos as object[]) ?? undefined,
          estimate: (body.estimate as object[]) ?? undefined,
          actualStartDate: (body.actualStartDate as string) ?? null,
          actualStartTime: (body.actualStartTime as string) ?? null,
          tentativeDeliveryDate: (body.tentativeDeliveryDate as string) ?? null,
          actualCompletionDate: (body.actualCompletionDate as string) ?? null,
          actualCompletionTime: (body.actualCompletionTime as string) ?? null,
          delayReason: (body.delayReason as string) ?? null,
          approvalDate: (body.approvalDate as string) ?? null,
          revisionCount: body.revisionCount !== undefined ? Number(body.revisionCount) : undefined,
          updatedBy: user?.email ?? "system",
          updatedAt: new Date(),
        })
        .where(eq(swatchOrdersTable.id, id))
        .returning();

      // Remove existing tags
      await tx
        .delete(entityTagsTable)
        .where(
          and(
            eq(entityTagsTable.entityType, "swatch_order"),
            eq(entityTagsTable.entityId, id)
          )
        );

      // Insert new tags
      if (tags.length > 0) {
        await tx.insert(entityTagsTable).values(
          tags.map(tag => ({
            entityType: "swatch_order",
            entityId: id,
            tag,
          }))
        );
      }

      return updated;
    });

    res.json({ data: row });

  } catch (error) {
    if (error instanceof Error && error.message === "SWATCH_ORDER_NOT_FOUND") {
      res.status(404).json({ error: "Not found" });
      return;
    }

    logger.error(error, "Failed to update swatch order");
    res.status(500).json({ error: "Failed to update swatch order" });
  }
});

router.patch("/swatch-orders/:id/status", requireAuth, checkPermission(SWATCH_ORDERS.ADD_EDIT), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const user = (req as typeof req & { user?: { email: string } }).user;
  const { orderStatus, priority, cancelReason } = req.body as { orderStatus?: string; priority?: string; cancelReason?: string };

  const updates: Partial<typeof swatchOrdersTable.$inferInsert> = {
    updatedBy: user?.email ?? "system",
    updatedAt: new Date(),
  };
  if (orderStatus) updates.orderStatus = orderStatus;
  if (priority) updates.priority = priority;
  if (cancelReason !== undefined) updates.cancelReason = cancelReason;

  const [row] = await db.update(swatchOrdersTable).set(updates).where(eq(swatchOrdersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: row });
});

router.delete("/swatch-orders/:id", requireAuth, checkPermission(SWATCH_ORDERS.DELETE), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db.select({ orderStatus: swatchOrdersTable.orderStatus })
    .from(swatchOrdersTable).where(eq(swatchOrdersTable.id, id));
  if (!order) { res.status(404).json({ error: "Not found" }); return; }

  if (order.orderStatus !== "Draft") {
    res.status(409).json({ error: `Cannot delete an order in "${order.orderStatus}" status. Use "Cancel Order" to deactivate it instead.` });
    return;
  }

  const linked = await db.execute(sql`
    SELECT COUNT(*) AS total
    FROM consumption_log
    WHERE swatch_order_id = ${id}
  `);
  if (Number((linked.rows?.[0] as Record<string, unknown>)?.total ?? 0) > 0) {
    res.status(409).json({ error: "This order has linked artworks or stock consumptions. Use 'Cancel Order' to deactivate it instead." });
    return;
  }

  const user = (req as typeof req & { user?: { email: string } }).user;
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(swatchOrdersTable)
        .set({
          isDeleted: true,
          updatedBy:user?.email ?? "system",
          updatedAt: new Date(),
          deletedBy: user?.email ?? "system",
          deletedAt: new Date(),
        })
        .where(eq(swatchOrdersTable.id, id));

      await tx
        .delete(entityTagsTable)
        .where(
          and(
            eq(entityTagsTable.entityType, "swatch_order"),
            eq(entityTagsTable.entityId, id)
          )
        );
    });

    res.json({ message: "Deleted" });
  } catch (error) {
    logger.error(error, "Failed to delete swatch order");
    res.status(500).json({ error: "Failed to delete swatch order" });
  }

  res.json({ message: "Deleted" });
});

export default router;
