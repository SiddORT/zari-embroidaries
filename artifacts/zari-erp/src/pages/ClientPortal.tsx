import { useState, useRef } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, ZoomIn, Package, User, Layers,
  Send, Paperclip, X, CheckCheck, LockKeyhole, Loader2,
  ChevronDown, ChevronUp, CheckCircle, RotateCcw,
} from "lucide-react";

interface FileAttachment { name: string; type: string; data: string; size: number }

interface PortalMessage {
  id: number;
  artworkId: number;
  sender: "client" | "team";
  message: string | null;
  attachment: FileAttachment | null;
  createdAt: string;
}

interface PortalArtwork {
  id: number;
  artworkCode: string;
  artworkName: string;
  feedbackStatus: string;
  wipImages: FileAttachment[];
  finalImages: FileAttachment[];
  isClosed: boolean;
  decision: "Approve" | "Rework" | null;
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
  messages: PortalMessage[];
}

function Lightbox({ images, startIndex, onClose }: { images: FileAttachment[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const img = images[idx];
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <div className="relative w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
        {idx > 0 && (
          <button onClick={() => setIdx(i => i - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-3 z-10">
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
        )}
        <img src={img.data} alt={img.name} className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg shadow-2xl" />
        {idx < images.length - 1 && (
          <button onClick={() => setIdx(i => i + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full p-3 z-10">
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

function ChatBubble({ msg }: { msg: PortalMessage }) {
  const isTeam = msg.sender === "team";
  return (
    <div className={`flex gap-2 ${isTeam ? "justify-start" : "justify-end"}`}>
      {isTeam && (
        <div className="h-7 w-7 rounded-full bg-gray-900 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-[#C9B45C]">Z</div>
      )}
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 space-y-1.5 ${isTeam ? "bg-gray-100 text-gray-900 rounded-tl-sm" : "bg-gray-900 text-white rounded-tr-sm"}`}>
        {msg.message && <p className="text-sm leading-snug">{msg.message}</p>}
        {msg.attachment && (
          <div className={`rounded-xl overflow-hidden border ${isTeam ? "border-gray-200" : "border-white/10"}`}>
            {msg.attachment.type.startsWith("image/") ? (
              <img src={msg.attachment.data} alt={msg.attachment.name} className="max-w-[180px] object-cover" />
            ) : (
              <a href={msg.attachment.data} download={msg.attachment.name}
                className={`flex items-center gap-2 px-3 py-2 text-xs hover:underline ${isTeam ? "text-blue-600" : "text-[#C9B45C]"}`}>
                <Paperclip className="h-3.5 w-3.5" />{msg.attachment.name}
              </a>
            )}
          </div>
        )}
        <p className={`text-[10px] ${isTeam ? "text-gray-400" : "text-white/40 text-right"}`}>
          {isTeam ? "ZARI Team" : "You"} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      {!isTeam && (
        <div className="h-7 w-7 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold text-white">YOU</div>
      )}
    </div>
  );
}

function ArtworkThread({ artwork, messages, token, onRefetch }: {
  artwork: PortalArtwork;
  messages: PortalMessage[];
  token: string;
  onRefetch: () => void;
}) {
  const [open, setOpen] = useState(!artwork.isClosed);
  const [text, setText] = useState("");
  const [attachFile, setAttachFile] = useState<FileAttachment | null>(null);
  const [decisionPick, setDecisionPick] = useState<"Approve" | "Rework" | null>(null);
  const [decisionComment, setDecisionComment] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const hasImages = artwork.wipImages.length > 0 || artwork.finalImages.length > 0;

  const sendMsg = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/client-portal/${token}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artworkId: artwork.id, artworkName: artwork.artworkName, message: text.trim() || undefined, attachment: attachFile ?? undefined }),
      });
      if (!r.ok) { const j = await r.json() as { error?: string }; throw new Error(j.error ?? "Failed"); }
    },
    onSuccess: () => { setText(""); setAttachFile(null); onRefetch(); },
  });

  const submitDecision = useMutation({
    mutationFn: async (decision: "Approve" | "Rework") => {
      const r = await fetch(`/api/client-portal/${token}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artworkId: artwork.id, artworkName: artwork.artworkName, decision, comment: decisionComment.trim() || undefined }),
      });
      if (!r.ok) { const j = await r.json() as { error?: string }; throw new Error(j.error ?? "Failed"); }
    },
    onSuccess: () => { setDecisionPick(null); setDecisionComment(""); onRefetch(); },
  });

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setAttachFile({ name: file.name, type: file.type, data: ev.target?.result as string, size: file.size });
    reader.readAsDataURL(file);
  }

  const decisionBadge = artwork.isClosed
    ? { label: "Approved", cls: "bg-green-100 text-green-700" }
    : artwork.decision === "Rework"
    ? { label: "Rework Requested", cls: "bg-orange-100 text-orange-700" }
    : null;

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-sm ${artwork.isClosed ? "border-gray-100 bg-gray-50/50" : "bg-white border-gray-200"}`}>
      {/* Header */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-gray-400 shrink-0">{artwork.artworkCode}</span>
          <h3 className={`text-sm font-semibold truncate ${artwork.isClosed ? "text-gray-400" : "text-gray-900"}`}>{artwork.artworkName}</h3>
          {decisionBadge && (
            <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${decisionBadge.cls}`}>
              {artwork.isClosed ? <CheckCheck className="h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}
              {decisionBadge.label}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 shrink-0">{messages.length} msg{messages.length !== 1 ? "s" : ""}</span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* Images */}
          {hasImages && (
            <div className="px-5 py-4 space-y-3 border-b border-gray-50">
              <ImageStrip images={artwork.wipImages} label="Work in Progress" />
              <ImageStrip images={artwork.finalImages} label="Final" />
            </div>
          )}

          {/* Chat thread */}
          <div className="px-5 py-4 space-y-3 min-h-[60px]">
            {messages.length === 0 && !artwork.isClosed && (
              <p className="text-sm text-gray-400 italic text-center py-2">No messages yet. Use the chat below or submit your decision.</p>
            )}
            {messages.map(m => <ChatBubble key={m.id} msg={m} />)}
          </div>

          {artwork.isClosed ? (
            /* Thread closed — Approved */
            <div className="mx-5 mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-sm font-semibold text-green-700">You approved this artwork.</p>
            </div>
          ) : (
            <div className="px-5 pb-5 space-y-4">
              {/* ── Chat input ── */}
              <div className="space-y-2">
                {attachFile && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
                    <Paperclip className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate flex-1">{attachFile.name}</span>
                    <button onClick={() => setAttachFile(null)} className="shrink-0 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg.mutate(); } }}
                    placeholder="Type a message or comment…"
                    rows={2}
                    className="flex-1 text-sm text-gray-900 border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none placeholder:text-gray-400"
                  />
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={() => fileRef.current?.click()}
                      className="flex items-center justify-center h-9 w-9 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => sendMsg.mutate()}
                      disabled={sendMsg.isPending || (!text.trim() && !attachFile)}
                      className="flex items-center justify-center h-9 w-9 rounded-xl bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors disabled:opacity-50">
                      {sendMsg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                  <input ref={fileRef} type="file" className="hidden" onChange={pickFile} />
                </div>
              </div>

              {/* ── Decision section ── */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Submit Decision</p>

                {/* Decision buttons */}
                {decisionPick === null ? (
                  <div className="flex gap-3">
                    <button onClick={() => setDecisionPick("Approve")}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 text-sm font-semibold hover:bg-green-100 hover:border-green-400 transition-all">
                      <CheckCircle className="h-4 w-4" /> Approve
                    </button>
                    <button onClick={() => setDecisionPick("Rework")}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-orange-200 bg-orange-50 text-orange-700 text-sm font-semibold hover:bg-orange-100 hover:border-orange-400 transition-all">
                      <RotateCcw className="h-4 w-4" /> Request Rework
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${decisionPick === "Approve" ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"}`}>
                      {decisionPick === "Approve"
                        ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                        : <RotateCcw className="h-4 w-4 text-orange-600 shrink-0" />}
                      <span className={`text-sm font-semibold ${decisionPick === "Approve" ? "text-green-700" : "text-orange-700"}`}>
                        {decisionPick === "Approve" ? "Approve this artwork" : "Request Rework"}
                      </span>
                      <button onClick={() => setDecisionPick(null)} className="ml-auto text-gray-400 hover:text-gray-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea
                      value={decisionComment}
                      onChange={e => setDecisionComment(e.target.value)}
                      placeholder={decisionPick === "Rework" ? "Describe what changes are needed…" : "Add a note (optional)…"}
                      rows={3}
                      className="w-full text-sm text-gray-900 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none placeholder:text-gray-400"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => submitDecision.mutate(decisionPick)}
                        disabled={submitDecision.isPending}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm ${
                          decisionPick === "Approve"
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "bg-orange-500 text-white hover:bg-orange-600"}`}>
                        {submitDecision.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : decisionPick === "Approve" ? <CheckCircle className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                        {submitDecision.isPending ? "Submitting…" : `Confirm ${decisionPick === "Approve" ? "Approval" : "Rework Request"}`}
                      </button>
                      <button onClick={() => { setDecisionPick(null); setDecisionComment(""); }}
                        className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                    {decisionPick === "Approve" && (
                      <p className="text-xs text-gray-400">Approving will close this thread and lock further messages.</p>
                    )}
                  </div>
                )}

                {/* Current decision status */}
                {artwork.decision === "Rework" && decisionPick === null && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-100 text-xs text-orange-700">
                    <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                    <span>Rework requested — continue chatting or approve when ready.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
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
      if (!r.ok) { const j = await r.json() as { error?: string }; throw new Error(j.error ?? "Failed"); }
      const j = await r.json() as { data: PortalData };
      return j.data;
    },
  });

  function refetch() { void qc.invalidateQueries({ queryKey: ["client-portal", token] }); }

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
          <h1 className="text-xl font-semibold text-gray-900 mb-2">{notPublished ? "Not Yet Active" : "Link Not Found"}</h1>
          <p className="text-sm text-gray-500">
            {notPublished ? "This review link hasn't been published yet. Please contact the team." : "This link may be invalid or has expired."}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { order, artworks, messages = [] } = data;
  const openArtworks = artworks.filter(a => !a.isClosed);
  const closedArtworks = artworks.filter(a => a.isClosed);
  const sortedArtworks = [...openArtworks, ...closedArtworks];
  const pendingCount = openArtworks.filter(a => !a.decision).length;

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
              <p className="text-xs font-semibold text-white leading-tight mt-0.5">{data.link.portalTitle ?? "ZARI Embroideries"}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400">Order</p>
            <p className="text-xs font-mono font-bold text-[#C9B45C]">{order.orderCode}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Swatch name + status */}
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
              "bg-gray-100 text-gray-600"}`}>{order.orderStatus}</span>
          </div>
        </div>

        {/* Client + Swatch details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-gray-900 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-[#C9B45C]" />
              </div>
              <p className="text-xs font-semibold text-gray-700">Client Details</p>
            </div>
            <div className="space-y-2">
              <div><p className="text-[10px] text-gray-400">Client</p><p className="text-sm font-semibold text-gray-900">{order.clientName ?? "—"}</p></div>
              {order.department && <div><p className="text-[10px] text-gray-400">Department</p><p className="text-sm text-gray-700">{order.department}</p></div>}
              <div><p className="text-[10px] text-gray-400">Chargeable</p><p className="text-sm text-gray-700">{order.isChargeable ? "Yes" : "No"}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-gray-900 flex items-center justify-center">
                <Package className="h-3.5 w-3.5 text-[#C9B45C]" />
              </div>
              <p className="text-xs font-semibold text-gray-700">Swatch Details</p>
            </div>
            <div className="space-y-2">
              {order.fabricName && <div><p className="text-[10px] text-gray-400">Fabric</p><p className="text-sm text-gray-700">{order.fabricName}</p></div>}
              {order.quantity && <div><p className="text-[10px] text-gray-400">Quantity</p><p className="text-sm text-gray-700">{order.quantity}</p></div>}
              {order.deliveryDate && <div><p className="text-[10px] text-gray-400">Delivery</p><p className="text-sm text-gray-700">{new Date(order.deliveryDate).toLocaleDateString()}</p></div>}
              {order.priority && <div><p className="text-[10px] text-gray-400">Priority</p><p className="text-sm text-gray-700">{order.priority}</p></div>}
            </div>
          </div>
        </div>

        {order.description && (
          <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Description</p>
            <p className="text-sm text-gray-700 leading-relaxed">{order.description}</p>
          </div>
        )}

        {/* Artworks header */}
        <div className="flex items-center gap-2 px-1">
          <Layers className="h-3.5 w-3.5 text-gray-400" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-1">Artworks for Review</p>
          {pendingCount > 0
            ? <span className="text-xs font-semibold text-orange-500">{pendingCount} awaiting decision</span>
            : <span className="text-xs text-gray-400">{closedArtworks.length}/{artworks.length} approved</span>
          }
        </div>

        {artworks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 px-5 py-12 text-center shadow-sm">
            <p className="text-sm text-gray-400 italic">No artworks shared yet.</p>
          </div>
        ) : (
          sortedArtworks.map(aw => (
            <ArtworkThread
              key={aw.id}
              artwork={aw}
              messages={messages.filter(m => m.artworkId === aw.id)}
              token={token}
              onRefetch={refetch}
            />
          ))
        )}

        <p className="text-center text-xs text-gray-400 py-4">Powered by ZARI ERP · Zari Embroideries</p>
      </div>
    </div>
  );
}
