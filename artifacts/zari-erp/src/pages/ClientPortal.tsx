import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle, RotateCcw, Send, ChevronLeft, ChevronRight,
  ZoomIn, Package, User, CalendarDays, Layers,
} from "lucide-react";

interface FileAttachment { name: string; type: string; data: string; size: number }

interface PortalArtwork {
  id: number;
  artworkCode: string;
  artworkName: string;
  feedbackStatus: string;
  wipImages: FileAttachment[];
  finalImages: FileAttachment[];
}

interface PortalOrder {
  id: number;
  orderCode: string;
  swatchName: string;
  clientName: string | null;
  description: string | null;
  quantity: string | null;
  fabricName: string | null;
  deliveryDate: string | null;
  orderStatus: string;
  priority: string;
  isChargeable: boolean;
  department: string | null;
}

interface PortalData {
  link: { id: number; token: string; portalTitle: string | null };
  order: PortalOrder;
  artworks: PortalArtwork[];
  existingFeedback: Array<{
    id: number; artworkId: number; artworkName: string;
    decision: string; comment: string | null; createdAt: string;
  }>;
}

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

function ImageStrip({ images, label }: { images: FileAttachment[]; label: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  if (!images.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {images.map((img, i) => (
          <button key={i} onClick={() => setLightbox(i)}
            className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-gray-200 hover:border-[#C9B45C] transition-colors group shadow-sm">
            <img src={img.data} alt={img.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <ZoomIn className="h-5 w-5 text-white drop-shadow" />
            </div>
          </button>
        ))}
      </div>
      {lightbox !== null && <Lightbox images={images} startIndex={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function ArtworkCard({ artwork, existingFeedback, token, onFeedbackSubmitted }: {
  artwork: PortalArtwork;
  existingFeedback: PortalData["existingFeedback"];
  token: string;
  onFeedbackSubmitted: () => void;
}) {
  const prevFb = existingFeedback.find(f => f.artworkId === artwork.id);
  const [decision, setDecision] = useState<"Approve" | "Rework" | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/client-portal/${token}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artworkId: artwork.id, artworkName: artwork.artworkName, decision, comment }),
      });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      setSubmitted(true);
      onFeedbackSubmitted();
    },
  });

  const hasImages = artwork.wipImages.length > 0 || artwork.finalImages.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Artwork header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 border-b border-gray-100">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{artwork.artworkCode}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              artwork.feedbackStatus === "Approved" ? "bg-green-100 text-green-700" :
              artwork.feedbackStatus === "Rework" ? "bg-orange-100 text-orange-700" :
              "bg-blue-100 text-blue-700"}`}>
              {artwork.feedbackStatus}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mt-0.5">{artwork.artworkName}</h3>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Images */}
        {hasImages ? (
          <>
            <ImageStrip images={artwork.wipImages} label="Work in Progress" />
            <ImageStrip images={artwork.finalImages} label="Final" />
          </>
        ) : (
          <p className="text-sm text-gray-400 italic text-center py-4">No images shared yet for this artwork.</p>
        )}

        {/* Feedback section */}
        <div className="pt-3 border-t border-gray-100">
          {prevFb ? (
            <div className={`flex items-start gap-3 p-4 rounded-xl ${prevFb.decision === "Approve" ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"}`}>
              {prevFb.decision === "Approve"
                ? <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                : <RotateCcw className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  You marked: <span className={prevFb.decision === "Approve" ? "text-green-700" : "text-orange-700"}>{prevFb.decision}</span>
                </p>
                {prevFb.comment && <p className="text-sm text-gray-600 mt-0.5">"{prevFb.comment}"</p>}
                <p className="text-xs text-gray-400 mt-1">Submitted {new Date(prevFb.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ) : submitted ? (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-green-50 border border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm font-semibold text-green-700">Feedback submitted!</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Feedback</p>
              <div className="flex gap-3">
                <button onClick={() => setDecision("Approve")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${decision === "Approve" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-green-300"}`}>
                  <CheckCircle className="h-4 w-4" /> Approve
                </button>
                <button onClick={() => setDecision("Rework")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${decision === "Rework" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600 hover:border-orange-300"}`}>
                  <RotateCcw className="h-4 w-4" /> Request Rework
                </button>
              </div>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Add comments or rework instructions (optional)…"
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none placeholder:text-gray-400" />
              <button
                disabled={!decision || submit.isPending}
                onClick={() => submit.mutate()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-50 shadow-sm">
                <Send className="h-4 w-4" />
                {submit.isPending ? "Submitting…" : "Submit Feedback"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClientPortal() {
  const [, params] = useRoute("/client/:token");
  const token = params?.token ?? "";
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery<PortalData>({
    queryKey: ["client-portal", token],
    enabled: !!token,
    queryFn: async () => {
      const r = await fetch(`/api/client-portal/${token}`);
      if (!r.ok) {
        const json = await r.json() as { error?: string };
        throw new Error(json.error ?? "Failed");
      }
      const json = await r.json() as { data: PortalData };
      return json.data;
    },
  });

  function refetchFeedback() {
    void qc.invalidateQueries({ queryKey: ["client-portal", token] });
  }

  if (!token) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-500">
          <div className="h-10 w-10 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
          <p className="text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : "Something went wrong";
    const notPublished = msg === "This link is not yet published";
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">{notPublished ? "⏳" : "🔒"}</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {notPublished ? "Not Yet Active" : "Link Not Found"}
          </h1>
          <p className="text-sm text-gray-500">
            {notPublished
              ? "This review link hasn't been published yet. Please contact the team."
              : "This link may be invalid or has expired. Please contact the team for a new link."}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { order, artworks, existingFeedback } = data;
  const totalFeedback = existingFeedback.length;
  const pendingCount = artworks.filter(aw => !existingFeedback.find(f => f.artworkId === aw.id)).length;

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#C9B45C] flex items-center justify-center">
              <span className="text-gray-900 font-bold text-sm">Z</span>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 leading-none">Client Review Portal</p>
              <p className="text-xs font-semibold text-white leading-tight mt-0.5">
                {data.link.portalTitle ?? "ZARI Embroideries"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400">Order</p>
            <p className="text-xs font-mono font-bold text-[#C9B45C]">{order.orderCode}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── Swatch Name + Status ── */}
        <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Swatch Order</p>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{order.swatchName}</h1>
            </div>
            <span className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold mt-1 ${
              order.orderStatus === "Completed" ? "bg-green-100 text-green-700" :
              order.orderStatus === "In Artwork" ? "bg-blue-100 text-blue-700" :
              order.orderStatus === "Pending Approval" ? "bg-amber-100 text-amber-700" :
              "bg-gray-100 text-gray-600"
            }`}>{order.orderStatus}</span>
          </div>
        </div>

        {/* ── Client Details + Swatch Details side-by-side ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Client Details */}
          <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-gray-900 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-[#C9B45C]" />
              </div>
              <p className="text-xs font-semibold text-gray-700">Client Details</p>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-gray-400">Client</p>
                <p className="text-sm font-semibold text-gray-900">{order.clientName ?? "—"}</p>
              </div>
              {order.department && (
                <div>
                  <p className="text-[10px] text-gray-400">Department</p>
                  <p className="text-sm text-gray-700">{order.department}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-gray-400">Chargeable</p>
                <p className="text-sm text-gray-700">{order.isChargeable ? "Yes" : "No"}</p>
              </div>
            </div>
          </div>

          {/* Swatch Details */}
          <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-gray-900 flex items-center justify-center">
                <Package className="h-3.5 w-3.5 text-[#C9B45C]" />
              </div>
              <p className="text-xs font-semibold text-gray-700">Swatch Details</p>
            </div>
            <div className="space-y-2">
              {order.fabricName && (
                <div>
                  <p className="text-[10px] text-gray-400">Fabric</p>
                  <p className="text-sm text-gray-700">{order.fabricName}</p>
                </div>
              )}
              {order.quantity && (
                <div>
                  <p className="text-[10px] text-gray-400">Quantity</p>
                  <p className="text-sm text-gray-700">{order.quantity}</p>
                </div>
              )}
              {order.deliveryDate && (
                <div>
                  <p className="text-[10px] text-gray-400">Delivery Date</p>
                  <p className="text-sm text-gray-700">{new Date(order.deliveryDate).toLocaleDateString()}</p>
                </div>
              )}
              {order.priority && (
                <div>
                  <p className="text-[10px] text-gray-400">Priority</p>
                  <p className="text-sm text-gray-700">{order.priority}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {order.description && (
          <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Description</p>
            <p className="text-sm text-gray-700 leading-relaxed">{order.description}</p>
          </div>
        )}

        {/* ── Artworks ── */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Artworks for Review
            </p>
            <p className="text-xs text-gray-400">
              {totalFeedback}/{artworks.length} reviewed
              {pendingCount > 0 && <span className="ml-1.5 text-orange-500 font-semibold">{pendingCount} pending</span>}
            </p>
          </div>
        </div>

        {artworks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 px-5 py-12 text-center shadow-sm">
            <p className="text-sm text-gray-400 italic">No artworks shared yet.</p>
          </div>
        ) : (
          artworks.map(aw => (
            <ArtworkCard
              key={aw.id}
              artwork={aw}
              existingFeedback={existingFeedback}
              token={token}
              onFeedbackSubmitted={refetchFeedback}
            />
          ))
        )}

        <p className="text-center text-xs text-gray-400 py-4">
          Powered by ZARI ERP · Zari Embroideries
        </p>
      </div>
    </div>
  );
}
