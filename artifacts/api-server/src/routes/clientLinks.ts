import { Router, type IRouter } from "express";
// import { eq, and, asc, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { eq, and, asc, desc ,db, clientLinksTable, clientFeedbackTable, clientMessagesTable, artworksTable, swatchOrdersTable, styleOrdersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { checkPermission } from "../middlewares/checkPermission";
import { STYLE_ORDERS, STYLE_ORDER_TABS, SWATCH_ORDERS, SWATCH_ORDER_TABS } from "../constants/permissions";

const SWATCH_PRE_APPROVAL_STATUSES = ["Draft", "Issued", "In Sampling", "In Artwork"];
const STYLE_PRE_APPROVAL_STATUSES  = ["Draft", "Issued", "In Production", "In Review"];

const router: IRouter = Router();

router.get("/client-links/swatch/:swatchOrderId", requireAuth, checkPermission(SWATCH_ORDER_TABS.CLIENT_LINK), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.swatchOrderId));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  let [link] = await db.select().from(clientLinksTable).where(and(eq(clientLinksTable.swatchOrderId, id), eq(clientLinksTable.isDeleted, false)));
  if (!link) {
    // Get client_id from swatch order
    const [swatchOrder] = await db
      .select({ clientId: swatchOrdersTable.clientId })
      .from(swatchOrdersTable)
      .where(eq(swatchOrdersTable.id, id));

    if (!swatchOrder) {
      res.status(404).json({ error: "Swatch order not found" });
      return;
    }
    const clientId = swatchOrder.clientId ? Number(swatchOrder.clientId) : null;
    const token = randomBytes(16).toString("hex");
    const [created] = await db.insert(clientLinksTable).values({ swatchOrderId: id, token, clientId }).returning();
    link = created;
  }
  res.json({ data: link });
});

router.get("/client-links/style/:styleOrderId", requireAuth, checkPermission(STYLE_ORDER_TABS.CLIENT_LINK), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.styleOrderId));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  let [link] = await db.select().from(clientLinksTable).where(and(eq(clientLinksTable.styleOrderId, id), eq(clientLinksTable.isDeleted, false)));
  if (!link) {
    const [styleOrder] = await db
      .select({ clientId: styleOrdersTable.clientId })
      .from(styleOrdersTable)
      .where(eq(styleOrdersTable.id, id));
    const clientId = styleOrder.clientId ? Number(styleOrder.clientId) : null;
    const token = randomBytes(16).toString("hex");
    const [created] = await db.insert(clientLinksTable).values({ styleOrderId: id, token, clientId }).returning();
    link = created;
  }
  res.json({ data: link });
});

router.patch("/client-links/:id", requireAuth, checkPermission({ any: [STYLE_ORDERS.ADD_EDIT, SWATCH_ORDERS.ADD_EDIT] }), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { isPublished, hiddenImages, portalTitle, closedThreads } = req.body as {
    isPublished?: boolean;
    hiddenImages?: Array<{ artworkId: number; imageType: "wip" | "final"; imageIndex: number }>;
    portalTitle?: string;
    closedThreads?: number[];
  };

  const [updated] = await db
    .update(clientLinksTable)
    .set({
      ...(isPublished !== undefined && { isPublished }),
      ...(hiddenImages !== undefined && { hiddenImages }),
      ...(portalTitle !== undefined && { portalTitle }),
      ...(closedThreads !== undefined && { closedThreads }),
      updatedAt: new Date(),
    })
    .where(eq(clientLinksTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  // Auto-advance order status when client link is published
  if (isPublished && updated.swatchOrderId) {
    try {
      const [order] = await db.select({ id: swatchOrdersTable.id, orderStatus: swatchOrdersTable.orderStatus })
        .from(swatchOrdersTable).where(and(eq(swatchOrdersTable.id, updated.swatchOrderId), eq(swatchOrdersTable.isDeleted, false)));
      if (order && SWATCH_PRE_APPROVAL_STATUSES.includes(order.orderStatus)) {
        await db.update(swatchOrdersTable).set({ orderStatus: "Pending Approval", updatedAt: new Date() })
          .where(eq(swatchOrdersTable.id, updated.swatchOrderId));
      }
    } catch (_e) { /* non-critical */ }
  }
  if (isPublished && updated.styleOrderId) {
    try {
      const [order] = await db.select({ id: styleOrdersTable.id, orderStatus: styleOrdersTable.orderStatus })
        .from(styleOrdersTable).where(and(eq(styleOrdersTable.id, updated.styleOrderId), eq(styleOrdersTable.isDeleted, false)));
      if (order && STYLE_PRE_APPROVAL_STATUSES.includes(order.orderStatus)) {
        await db.update(styleOrdersTable).set({ orderStatus: "Pending Approval", updatedAt: new Date() })
          .where(eq(styleOrdersTable.id, updated.styleOrderId));
      }
    } catch (_e) { /* non-critical */ }
  }

  res.json({ data: updated });
});

router.post("/client-links/:id/regenerate", requireAuth, checkPermission({ any: [STYLE_ORDERS.ADD_EDIT, SWATCH_ORDERS.ADD_EDIT] }), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const token = randomBytes(16).toString("hex");
  const [updated] = await db
    .update(clientLinksTable)
    .set({ token, isPublished: false, updatedAt: new Date() })
    .where(eq(clientLinksTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: updated });
});

router.get("/client-links/:id/feedback", requireAuth,
  checkPermission({ any: [STYLE_ORDER_TABS.CLIENT_LINK, SWATCH_ORDER_TABS.CLIENT_LINK] }),
  async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db
    .select()
    .from(clientFeedbackTable)
    .where(and(eq(clientFeedbackTable.clientLinkId, id), eq(clientFeedbackTable.isDeleted, false)))
    .orderBy(desc(clientFeedbackTable.createdAt));
  res.json({ data: rows });
});

router.patch("/client-links/feedback/:feedbackId", requireAuth,
  checkPermission({ any: [STYLE_ORDERS.ADD_EDIT, SWATCH_ORDERS.ADD_EDIT] }), 
  async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.feedbackId));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { isResolved, internalNote } = req.body as { isResolved?: boolean; internalNote?: string };

  const [updated] = await db
    .update(clientFeedbackTable)
    .set({
      ...(isResolved !== undefined && { isResolved, resolvedAt: isResolved ? new Date() : null }),
      ...(internalNote !== undefined && { internalNote }),
    })
    .where(eq(clientFeedbackTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  if (updated.isResolved && updated.decision === "Approve") {
    await db.update(artworksTable).set({ feedbackStatus: "Approved" }).where(eq(artworksTable.id, updated.artworkId));
  }

  res.json({ data: updated });
});

/* ── Chat messages ── */

router.get("/client-links/:id/messages", requireAuth,
  checkPermission({ any: [STYLE_ORDER_TABS.CLIENT_LINK, SWATCH_ORDER_TABS.CLIENT_LINK] }),
  async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db
    .select()
    .from(clientMessagesTable)
    .where(and(eq(clientMessagesTable.clientLinkId, id), eq(clientMessagesTable.isDeleted, false)))
    .orderBy(asc(clientMessagesTable.createdAt));

  res.json({ data: rows });
});

router.post("/client-links/:id/messages", requireAuth, 
  checkPermission({ any: [STYLE_ORDERS.ADD_EDIT, SWATCH_ORDERS.ADD_EDIT] }),
  async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { artworkId, artworkName, message, attachment } = req.body as {
    artworkId: number;
    artworkName: string;
    message?: string;
    attachment?: { name: string; type: string; data: string; size: number };
  };

  if (!artworkId || (!message && !attachment)) {
    res.status(400).json({ error: "artworkId and message or attachment required" });
    return;
  }

  const [created] = await db
    .insert(clientMessagesTable)
    .values({ clientLinkId: id, artworkId, artworkName, sender: "team", message: message ?? null, attachment: attachment ?? null })
    .returning();

  res.status(201).json({ data: created });
});

router.patch("/client-links/:id/threads/toggle", requireAuth, 
  checkPermission({ any: [STYLE_ORDERS.ADD_EDIT, SWATCH_ORDERS.ADD_EDIT] }),
  async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { artworkId, closed } = req.body as { artworkId: number; closed: boolean };

  const [link] = await db.select().from(clientLinksTable).where(and(eq(clientLinksTable.id, id), eq(clientLinksTable.isDeleted, false)));
  if (!link) { res.status(404).json({ error: "Not found" }); return; }

  const current = (link.closedThreads as number[]) ?? [];
  const updated = closed
    ? [...new Set([...current, artworkId])]
    : current.filter((a: number) => a !== artworkId);

  const [result] = await db
    .update(clientLinksTable)
    .set({ closedThreads: updated, updatedAt: new Date() })
    .where(eq(clientLinksTable.id, id))
    .returning();

  res.json({ data: result });
});

export default router;
