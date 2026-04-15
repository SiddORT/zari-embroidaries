import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle, RotateCcw, Send, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

interface FileAttachment { name: string; type: string; data: string; size: number }

interface PortalArtwork {
  id: number;
  artworkCode: string;
  artworkName: string;
  feedbackStatus: string;
  wipImages: FileAttachment[];
  finalImages: FileAttachment[];
}

interface PortalData {
  link: { id: number; token: string; portalTitle: string | null };
  order: { id: number; orderCode: string; swatchName: string; clientName: string | null };
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
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center" onClick={onClose}>
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
            className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-gray-200 hover:border-[#C9B45C] transition-colors group shadow-sm">
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

function ArtworkCard({ artwork, existingFeedback, token }: {
  artwork: PortalArtwork;
  existingFeedback: PortalData["existingFeedback"];
  token: string;
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
    onSuccess: () => setSubmitted(true),
  });

  const hasImages = artwork.wipImages.length > 0 || artwork.finalImages.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 bg-gray-50 border-b border-gray-100">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">{artwork.artworkCode}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              artwork.feedbackStatus === "Approved" ? "bg-green-100 text-green-700" :
              artwork.feedbackStatus === "Rework" ? "bg-orange-100 text-orange-700" :
              "bg-blue-100 text-blue-700"}`}>
              {artwork.feedbackStatus}
            </span>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mt-0.5">{artwork.artworkName}</h3>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {hasImages ? (
          <>
            <ImageStrip images={artwork.wipImages} label="Work in Progress" />
            <ImageStrip images={artwork.finalImages} label="Final Images" />
          </>
        ) : (
          <p className="text-sm text-gray-400 italic">No images shared for this artwork yet.</p>
        )}

        {/* Feedback */}
        <div className="pt-4 border-t border-gray-100">
          {prevFb ? (
            <div className={`flex items-start gap-3 p-4 rounded-xl ${prevFb.decision === "Approve" ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"}`}>
              {prevFb.decision === "Approve"
                ? <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                : <RotateCcw className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold text-gray-800">You marked: <span className={prevFb.decision === "Approve" ? "text-green-700" : "text-orange-700"}>{prevFb.decision}</span></p>
                {prevFb.comment && <p className="text-sm text-gray-600 mt-0.5">"{prevFb.comment}"</p>}
                <p className="text-xs text-gray-400 mt-1">Submitted on {new Date(prevFb.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ) : submitted ? (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-green-50 border border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm font-semibold text-green-700">Feedback submitted successfully!</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">Your feedback</p>
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
                placeholder="Add a comment or rework instructions (optional)…"
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
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {msg === "This link is not yet published" ? "Link Not Yet Active" : "Link Not Found"}
          </h1>
          <p className="text-sm text-gray-500">
            {msg === "This link is not yet published"
              ? "This review link hasn't been published yet. Please contact the team."
              : "This link may be invalid or has expired. Please contact the team for a new link."}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#C9B45C] flex items-center justify-center">
              <span className="text-gray-900 font-bold text-sm">Z</span>
            </div>
            <div>
              <p className="text-xs text-gray-400">Client Review Portal</p>
              <p className="text-sm font-semibold text-white">{data.link.portalTitle ?? "ZARI Embroideries"}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Order</p>
            <p className="text-sm font-mono font-semibold text-[#C9B45C]">{data.order.orderCode}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {/* Order info */}
        <div className="bg-white rounded-2xl border border-gray-200 px-6 py-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">Swatch Order</p>
          <h1 className="text-lg font-bold text-gray-900">{data.order.swatchName}</h1>
          {data.order.clientName && <p className="text-sm text-gray-500 mt-0.5">For: {data.order.clientName}</p>}
          <p className="text-xs text-gray-400 mt-2">
            {data.artworks.length} artwork{data.artworks.length !== 1 ? "s" : ""} for review
          </p>
        </div>

        {/* Artworks */}
        {data.artworks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 px-6 py-12 text-center shadow-sm">
            <p className="text-gray-400 text-sm">No artworks have been shared yet.</p>
          </div>
        ) : (
          data.artworks.map(aw => (
            <ArtworkCard key={aw.id} artwork={aw} existingFeedback={data.existingFeedback} token={token} />
          ))
        )}

        <p className="text-center text-xs text-gray-400 py-4">
          Powered by ZARI ERP · Zari Embroideries
        </p>
      </div>
    </div>
  );
}
