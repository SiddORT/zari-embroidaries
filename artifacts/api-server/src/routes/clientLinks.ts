import { Router, type IRouter } from "express";
import { eq, asc, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, clientLinksTable, clientFeedbackTable, clientMessagesTable, artworksTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/client-links/swatch/:swatchOrderId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.swatchOrderId));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  let [link] = await db.select().from(clientLinksTable).where(eq(clientLinksTable.swatchOrderId, id));
  if (!link) {
    const token = randomBytes(16).toString("hex");
    const [created] = await db.insert(clientLinksTable).values({ swatchOrderId: id, token }).returning();
    link = created;
  }
  res.json({ data: link });
});

router.get("/client-links/style/:styleOrderId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.styleOrderId));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  let [link] = await db.select().from(clientLinksTable).where(eq(clientLinksTable.styleOrderId, id));
  if (!link) {
    const token = randomBytes(16).toString("hex");
    const [created] = await db.insert(clientLinksTable).values({ styleOrderId: id, token }).returning();
    link = created;
  }
  res.json({ data: link });
});

router.patch("/client-links/:id", requireAuth, async (req, res): Promise<void> => {
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
  res.json({ data: updated });
});

router.post("/client-links/:id/regenerate", requireAuth, async (req, res): Promise<void> => {
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

router.get("/client-links/:id/feedback", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db
    .select()
    .from(clientFeedbackTable)
    .where(eq(clientFeedbackTable.clientLinkId, id))
    .orderBy(desc(clientFeedbackTable.createdAt));
  res.json({ data: rows });
});

router.patch("/client-links/feedback/:feedbackId", requireAuth, async (req, res): Promise<void> => {
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

router.get("/client-links/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db
    .select()
    .from(clientMessagesTable)
    .where(eq(clientMessagesTable.clientLinkId, id))
    .orderBy(asc(clientMessagesTable.createdAt));

  res.json({ data: rows });
});

router.post("/client-links/:id/messages", requireAuth, async (req, res): Promise<void> => {
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

router.patch("/client-links/:id/threads/toggle", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { artworkId, closed } = req.body as { artworkId: number; closed: boolean };

  const [link] = await db.select().from(clientLinksTable).where(eq(clientLinksTable.id, id));
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
