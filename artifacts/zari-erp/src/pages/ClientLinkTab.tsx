import { useState } from "react";
import {
  Link2, Copy, Check, ExternalLink, Eye, EyeOff, RefreshCw,
  Globe, GlobeLock, ChevronLeft, ChevronRight, CheckCircle, RotateCcw,
  MessageSquare, CheckCheck, Loader2, ZoomIn
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useClientLink, useClientFeedback, useUpdateClientLink,
  useRegenerateLink, useUpdateFeedback,
  type HiddenImage, type ClientFeedbackRecord
} from "@/hooks/useClientLink";
import { useArtworkList } from "@/hooks/useArtworks";

interface FileAttachment { name: string; type: string; data: string; size: number }

function Lightbox({ images, startIndex, onClose }: { images: FileAttachment[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const img = images[idx];
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <div className="relative w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
        {idx > 0 && (
          <button onClick={() => setIdx(i => i - 1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors z-10">
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
        )}
        <img src={img.data} alt={img.name} className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg shadow-2xl" />
        {idx < images.length - 1 && (
          <button onClick={() => setIdx(i => i + 1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors z-10">
            <ChevronRight className="h-6 w-6 text-white" />
          </button>
        )}
        <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl font-light">✕</button>
        <div className="absolute bottom-4 text-white/60 text-sm">{img.name} · {idx + 1} / {images.length}</div>
      </div>
    </div>
  );
}

function FeedbackCard({ fb, onResolve, onNoteChange }: {
  fb: ClientFeedbackRecord;
  onResolve: (id: number, resolved: boolean) => void;
  onNoteChange: (id: number, note: string) => void;
}) {
  const [note, setNote] = useState(fb.internalNote ?? "");
  const [noteEditing, setNoteEditing] = useState(false);
  const updateFb = useUpdateFeedback();

  function saveNote() {
    onNoteChange(fb.id, note);
    updateFb.mutate({ id: fb.id, data: { internalNote: note } });
    setNoteEditing(false);
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${fb.isResolved ? "bg-gray-50 border-gray-200 opacity-70" : "bg-white border-gray-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold ${
          fb.decision === "Approve" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
          {fb.decision === "Approve" ? <CheckCircle className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{fb.artworkName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              fb.decision === "Approve" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
              {fb.decision}
            </span>
            {fb.isResolved && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium flex items-center gap-1">
                <CheckCheck className="h-3 w-3" /> Resolved
              </span>
            )}
          </div>
          {fb.comment && <p className="text-sm text-gray-600 mt-1 italic">"{fb.comment}"</p>}
          <p className="text-xs text-gray-400 mt-1">{new Date(fb.createdAt).toLocaleString()}</p>
        </div>
      </div>

      {/* Internal note */}
      {noteEditing ? (
        <div className="flex gap-2">
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="Internal note or reply to client…"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none" />
          <div className="flex flex-col gap-1">
            <button onClick={saveNote} className="px-3 py-1.5 text-xs bg-gray-900 text-[#C9B45C] rounded-lg font-medium hover:bg-black transition-colors">Save</button>
            <button onClick={() => setNoteEditing(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          {fb.internalNote && <p className="flex-1 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">{fb.internalNote}</p>}
          <button onClick={() => setNoteEditing(true)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors shrink-0">
            <MessageSquare className="h-3.5 w-3.5" />
            {fb.internalNote ? "Edit note" : "Add note"}
          </button>
        </div>
      )}

      {/* Actions */}
      {!fb.isResolved && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onResolve(fb.id, true)}
            disabled={updateFb.isPending}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-[#C9B45C] font-medium hover:bg-black transition-colors disabled:opacity-60">
            <CheckCheck className="h-3.5 w-3.5" />
            {fb.decision === "Approve" ? "Mark as Approved & Done" : "Mark as Done (Rework Applied)"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ClientLinkTab({ swatchOrderId }: { swatchOrderId: number }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState<{ artworkId: number; type: "wip" | "final"; idx: number } | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const { data: link, isLoading: linkLoading } = useClientLink(swatchOrderId);
  const { data: artworks, isLoading: artworksLoading } = useArtworkList(swatchOrderId);
  const { data: feedback } = useClientFeedback(link?.id ?? null);

  const updateLink = useUpdateClientLink();
  const regenLink = useRegenerateLink();
  const updateFb = useUpdateFeedback();

  const portalUrl = link
    ? `${window.location.origin}${import.meta.env.BASE_URL}client/${link.token}`
    : "";

  function copyLink() {
    void navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function togglePublish() {
    if (!link) return;
    updateLink.mutate({ id: link.id, data: { isPublished: !link.isPublished } }, {
      onSuccess: () => toast({ title: link.isPublished ? "Link unpublished" : "Link published! Clients can now access it." }),
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  }

  function toggleImage(artworkId: number, imageType: "wip" | "final", imageIndex: number) {
    if (!link) return;
    const hidden = link.hiddenImages ?? [];
    const exists = hidden.some(h => h.artworkId === artworkId && h.imageType === imageType && h.imageIndex === imageIndex);
    const updated: HiddenImage[] = exists
      ? hidden.filter(h => !(h.artworkId === artworkId && h.imageType === imageType && h.imageIndex === imageIndex))
      : [...hidden, { artworkId, imageType, imageIndex }];
    updateLink.mutate({ id: link.id, data: { hiddenImages: updated } });
  }

  function isHidden(artworkId: number, imageType: "wip" | "final", imageIndex: number) {
    return (link?.hiddenImages ?? []).some(h => h.artworkId === artworkId && h.imageType === imageType && h.imageIndex === imageIndex);
  }

  function handleRegenerate() {
    if (!link) return;
    regenLink.mutate({ id: link.id, swatchOrderId: link.swatchOrderId }, {
      onSuccess: () => {
        setConfirmRegen(false);
        toast({ title: "Link regenerated", description: "Old link is now invalid" });
      },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  }

  function handleResolveFeedback(id: number, resolved: boolean) {
    updateFb.mutate({ id, data: { isResolved: resolved } }, {
      onSuccess: (fb) => {
        if (resolved && fb.decision === "Approve") {
          toast({ title: "Artwork marked as Approved", description: `${fb.artworkName} status updated` });
        } else {
          toast({ title: "Marked as done" });
        }
      },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  }

  if (linkLoading || artworksLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const artworkList = (artworks?.data ?? []) as Array<{
    id: number; artworkCode: string; artworkName: string; feedbackStatus: string;
    wipImages: FileAttachment[]; finalImages: FileAttachment[];
  }>;

  const pendingFb = (feedback ?? []).filter(f => !f.isResolved);
  const resolvedFb = (feedback ?? []).filter(f => f.isResolved);

  return (
    <div className="space-y-5">

      {/* ── Link Management ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gray-900">
            <Link2 className="h-4 w-4 text-[#C9B45C]" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900">Shareable Client Link</h2>
            <p className="text-xs text-gray-400">Share this link with the client to collect their feedback</p>
          </div>
          {link && (
            <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold ${
              link.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
              {link.isPublished ? <><Globe className="h-3 w-3" /> Published</> : <><GlobeLock className="h-3 w-3" /> Draft</>}
            </span>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* URL row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className="text-xs text-gray-400 font-mono break-all truncate">{portalUrl}</span>
            </div>
            <button onClick={copyLink}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shrink-0">
              {copied ? <><Check className="h-4 w-4 text-green-600" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy</>}
            </button>
            <a href={portalUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shrink-0">
              <ExternalLink className="h-4 w-4" /> Preview
            </a>
          </div>

          {/* Publish / Regenerate */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePublish}
              disabled={updateLink.isPending}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 shadow-sm ${
                link?.isPublished
                  ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                  : "bg-gray-900 text-[#C9B45C] hover:bg-black"}`}>
              {updateLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : link?.isPublished ? <GlobeLock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              {link?.isPublished ? "Unpublish" : "Publish Link"}
            </button>

            {!confirmRegen ? (
              <button onClick={() => setConfirmRegen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <RefreshCw className="h-4 w-4" /> Regenerate
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Old link will stop working!</span>
                <button onClick={handleRegenerate} disabled={regenLink.isPending}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-60">
                  {regenLink.isPending ? "…" : "Confirm"}
                </button>
                <button onClick={() => setConfirmRegen(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Preview (what client sees) ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gray-900">
            <Eye className="h-4 w-4 text-[#C9B45C]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Client View Preview</h2>
            <p className="text-xs text-gray-400">Toggle the eye icon to hide/show specific images from the client</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {artworkList.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-6">No artworks linked to this order yet.</p>
          ) : (
            artworkList.map(aw => {
              const wipImgs = (aw.wipImages ?? []) as FileAttachment[];
              const finalImgs = (aw.finalImages ?? []) as FileAttachment[];
              const hasAny = wipImgs.length > 0 || finalImgs.length > 0;

              return (
                <div key={aw.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">{aw.artworkCode}</span>
                    <span className="text-sm font-semibold text-gray-900">{aw.artworkName}</span>
                  </div>
                  {!hasAny && <p className="text-xs text-gray-400 italic">No images uploaded yet</p>}
                  {wipImgs.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 font-medium mb-2">WIP Images</p>
                      <div className="flex flex-wrap gap-2">
                        {wipImgs.map((img, i) => {
                          const hidden = isHidden(aw.id, "wip", i);
                          return (
                            <div key={i} className="relative group">
                              <button onClick={() => setLightbox({ artworkId: aw.id, type: "wip", idx: i })}
                                className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${hidden ? "border-red-200 opacity-40" : "border-gray-200 hover:border-[#C9B45C]"}`}>
                                <img src={img.data} alt={img.name} className="w-full h-full object-cover" />
                              </button>
                              <button onClick={() => toggleImage(aw.id, "wip", i)}
                                title={hidden ? "Show to client" : "Hide from client"}
                                className={`absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full border-2 border-white flex items-center justify-center shadow-sm transition-colors ${hidden ? "bg-red-500 text-white" : "bg-white text-gray-600 hover:bg-red-100"}`}>
                                {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {finalImgs.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 font-medium mb-2">Final Images</p>
                      <div className="flex flex-wrap gap-2">
                        {finalImgs.map((img, i) => {
                          const hidden = isHidden(aw.id, "final", i);
                          return (
                            <div key={i} className="relative group">
                              <button onClick={() => setLightbox({ artworkId: aw.id, type: "final", idx: i })}
                                className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${hidden ? "border-red-200 opacity-40" : "border-gray-200 hover:border-[#C9B45C]"}`}>
                                <img src={img.data} alt={img.name} className="w-full h-full object-cover" />
                              </button>
                              <button onClick={() => toggleImage(aw.id, "final", i)}
                                title={hidden ? "Show to client" : "Hide from client"}
                                className={`absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full border-2 border-white flex items-center justify-center shadow-sm transition-colors ${hidden ? "bg-red-500 text-white" : "bg-white text-gray-600 hover:bg-red-100"}`}>
                                {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Feedback ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gray-900">
            <MessageSquare className="h-4 w-4 text-[#C9B45C]" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900">Client Feedback</h2>
            <p className="text-xs text-gray-400">
              {feedback?.length
                ? `${pendingFb.length} pending · ${resolvedFb.length} resolved`
                : "No feedback received yet"}
            </p>
          </div>
          {pendingFb.length > 0 && (
            <span className="flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-orange-500 text-white text-xs font-bold">
              {pendingFb.length}
            </span>
          )}
        </div>

        <div className="px-6 py-5 space-y-3">
          {(!feedback || feedback.length === 0) ? (
            <div className="text-center py-8 text-sm text-gray-400 italic">
              {link?.isPublished
                ? "Waiting for client to submit feedback…"
                : "Publish the link first so clients can access it."}
            </div>
          ) : (
            <>
              {pendingFb.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pending Action</p>
                  {pendingFb.map(fb => (
                    <FeedbackCard key={fb.id} fb={fb} onResolve={handleResolveFeedback} onNoteChange={() => {}} />
                  ))}
                </div>
              )}
              {resolvedFb.length > 0 && (
                <div className="space-y-3 mt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Resolved</p>
                  {resolvedFb.map(fb => (
                    <FeedbackCard key={fb.id} fb={fb} onResolve={handleResolveFeedback} onNoteChange={() => {}} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (() => {
        const aw = artworkList.find(a => a.id === lightbox.artworkId);
        if (!aw) return null;
        const imgs = lightbox.type === "wip" ? (aw.wipImages as FileAttachment[]) : (aw.finalImages as FileAttachment[]);
        return <Lightbox images={imgs} startIndex={lightbox.idx} onClose={() => setLightbox(null)} />;
      })()}
    </div>
  );
}
