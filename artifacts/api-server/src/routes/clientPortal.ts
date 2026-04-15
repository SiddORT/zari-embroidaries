import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import {
  db, clientLinksTable, clientMessagesTable, clientFeedbackTable,
  artworksTable, swatchOrdersTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/client-portal/:token", async (req, res): Promise<void> => {
  const { token } = req.params;

  const [link] = await db.select().from(clientLinksTable).where(eq(clientLinksTable.token, token));
  if (!link) { res.status(404).json({ error: "Link not found" }); return; }
  if (!link.isPublished) { res.status(403).json({ error: "This link is not yet published" }); return; }

  const [order] = await db.select().from(swatchOrdersTable).where(eq(swatchOrdersTable.id, link.swatchOrderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const artworks = await db
    .select()
    .from(artworksTable)
    .where(and(eq(artworksTable.swatchOrderId, link.swatchOrderId), eq(artworksTable.isDeleted, false)));

  const feedbackRows = await db
    .select()
    .from(clientFeedbackTable)
    .where(eq(clientFeedbackTable.clientLinkId, link.id))
    .orderBy(asc(clientFeedbackTable.createdAt));

  const hidden = (link.hiddenImages as Array<{ artworkId: number; imageType: string; imageIndex: number }>) || [];
  const closedThreads = (link.closedThreads as number[]) || [];

  const filteredArtworks = artworks.map(aw => {
    const wipImages = ((aw.wipImages as Array<unknown>) || []).filter((_img, idx) =>
      !hidden.some(h => h.artworkId === aw.id && h.imageType === "wip" && h.imageIndex === idx)
    );
    const finalImages = ((aw.finalImages as Array<unknown>) || []).filter((_img, idx) =>
      !hidden.some(h => h.artworkId === aw.id && h.imageType === "final" && h.imageIndex === idx)
    );
    const awFeedback = feedbackRows.filter(f => f.artworkId === aw.id);
    const latestFeedback = awFeedback[awFeedback.length - 1] ?? null;
    return {
      id: aw.id,
      artworkCode: aw.artworkCode,
      artworkName: aw.artworkName,
      feedbackStatus: aw.feedbackStatus,
      wipImages,
      finalImages,
      isClosed: closedThreads.includes(aw.id),
      decision: latestFeedback?.decision ?? null,
    };
  });

  const messages = await db
    .select()
    .from(clientMessagesTable)
    .where(eq(clientMessagesTable.clientLinkId, link.id))
    .orderBy(asc(clientMessagesTable.createdAt));

  res.json({
    data: {
      link: { id: link.id, token: link.token, portalTitle: link.portalTitle },
      order: {
        id: order.id,
        orderCode: order.orderCode,
        swatchName: order.swatchName,
        clientName: order.clientName,
        description: order.description,
        quantity: order.quantity,
        fabricName: order.fabricName,
        deliveryDate: order.deliveryDate,
        orderStatus: order.orderStatus,
        priority: order.priority,
        isChargeable: order.isChargeable,
        department: order.department,
      },
      artworks: filteredArtworks,
      messages,
    },
  });
});

router.post("/client-portal/:token/message", async (req, res): Promise<void> => {
  const { token } = req.params;

  const [link] = await db.select().from(clientLinksTable).where(eq(clientLinksTable.token, token));
  if (!link) { res.status(404).json({ error: "Link not found" }); return; }
  if (!link.isPublished) { res.status(403).json({ error: "Link not published" }); return; }

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

  const closedThreads = (link.closedThreads as number[]) || [];
  if (closedThreads.includes(artworkId)) {
    res.status(403).json({ error: "This thread has been closed" });
    return;
  }

  const [created] = await db
    .insert(clientMessagesTable)
    .values({ clientLinkId: link.id, artworkId, artworkName, sender: "client", message: message ?? null, attachment: attachment ?? null })
    .returning();

  res.status(201).json({ data: created });
});

router.post("/client-portal/:token/feedback", async (req, res): Promise<void> => {
  const { token } = req.params;

  const [link] = await db.select().from(clientLinksTable).where(eq(clientLinksTable.token, token));
  if (!link) { res.status(404).json({ error: "Link not found" }); return; }
  if (!link.isPublished) { res.status(403).json({ error: "Link not published" }); return; }

  const { artworkId, artworkName, decision, comment } = req.body as {
    artworkId: number;
    artworkName: string;
    decision: "Approve" | "Rework";
    comment?: string;
  };

  if (!artworkId || !decision) { res.status(400).json({ error: "artworkId and decision required" }); return; }
  if (!["Approve", "Rework"].includes(decision)) { res.status(400).json({ error: "Invalid decision" }); return; }

  const closedThreads = (link.closedThreads as number[]) || [];
  if (closedThreads.includes(artworkId) && decision === "Rework") {
    res.status(403).json({ error: "Thread is closed" });
    return;
  }

  const [created] = await db
    .insert(clientFeedbackTable)
    .values({ clientLinkId: link.id, artworkId, artworkName, decision, comment: comment ?? null })
    .returning();

  if (decision === "Approve") {
    const updated = [...new Set([...closedThreads, artworkId])];
    await db.update(clientLinksTable).set({ closedThreads: updated, updatedAt: new Date() }).where(eq(clientLinksTable.id, link.id));
    await db.update(artworksTable).set({ feedbackStatus: "Approved" }).where(eq(artworksTable.id, artworkId));
  }

  res.status(201).json({ data: created });
});

export default router;
