import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, clientLinksTable, clientFeedbackTable, artworksTable, swatchOrdersTable } from "@workspace/db";

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

  const hidden = (link.hiddenImages as Array<{ artworkId: number; imageType: string; imageIndex: number }>) || [];

  const filteredArtworks = artworks.map(aw => {
    const wipImages = ((aw.wipImages as Array<unknown>) || []).filter((_img, idx) =>
      !hidden.some(h => h.artworkId === aw.id && h.imageType === "wip" && h.imageIndex === idx)
    );
    const finalImages = ((aw.finalImages as Array<unknown>) || []).filter((_img, idx) =>
      !hidden.some(h => h.artworkId === aw.id && h.imageType === "final" && h.imageIndex === idx)
    );
    return {
      id: aw.id,
      artworkCode: aw.artworkCode,
      artworkName: aw.artworkName,
      feedbackStatus: aw.feedbackStatus,
      wipImages,
      finalImages,
    };
  });

  const existingFeedback = await db
    .select()
    .from(clientFeedbackTable)
    .where(eq(clientFeedbackTable.clientLinkId, link.id));

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
      existingFeedback,
    },
  });
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

  if (!artworkId || !decision) { res.status(400).json({ error: "artworkId and decision are required" }); return; }
  if (!["Approve", "Rework"].includes(decision)) { res.status(400).json({ error: "decision must be Approve or Rework" }); return; }

  const [created] = await db
    .insert(clientFeedbackTable)
    .values({ clientLinkId: link.id, artworkId, artworkName, decision, comment: comment ?? null })
    .returning();

  res.status(201).json({ data: created });
});

export default router;
