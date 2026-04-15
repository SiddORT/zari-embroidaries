import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, clientLinksTable, clientFeedbackTable, artworksTable, swatchOrdersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/client-links/swatch/:swatchOrderId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.swatchOrderId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  let [link] = await db.select().from(clientLinksTable).where(eq(clientLinksTable.swatchOrderId, id));
  if (!link) {
    const token = randomBytes(16).toString("hex");
    const [created] = await db.insert(clientLinksTable).values({ swatchOrderId: id, token }).returning();
    link = created;
  }
  res.json({ data: link });
});

router.patch("/client-links/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { isPublished, hiddenImages, portalTitle } = req.body as {
    isPublished?: boolean;
    hiddenImages?: Array<{ artworkId: number; imageType: "wip" | "final"; imageIndex: number }>;
    portalTitle?: string;
  };

  const [updated] = await db
    .update(clientLinksTable)
    .set({
      ...(isPublished !== undefined && { isPublished }),
      ...(hiddenImages !== undefined && { hiddenImages }),
      ...(portalTitle !== undefined && { portalTitle }),
      updatedAt: new Date(),
    })
    .where(eq(clientLinksTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: updated });
});

router.post("/client-links/:id/regenerate", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
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

router.get("/client-links/:id/feedback", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db
    .select()
    .from(clientFeedbackTable)
    .where(eq(clientFeedbackTable.clientLinkId, id))
    .orderBy(desc(clientFeedbackTable.createdAt));
  res.json({ data: rows });
});

router.patch("/client-links/feedback/:feedbackId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.feedbackId);
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
    await db
      .update(artworksTable)
      .set({ feedbackStatus: "Approved" })
      .where(eq(artworksTable.id, updated.artworkId));
  }

  res.json({ data: updated });
});

export default router;
