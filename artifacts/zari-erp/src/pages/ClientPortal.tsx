import { useState, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, ZoomIn, Send, Paperclip, X,
  CheckCheck, Loader2, ChevronDown, CheckCircle,
  RotateCcw, Clock, Sparkles, Search, MessageSquare, Layers, Calendar, User, Tag, Download, Eye
} from "lucide-react";

// --- Types ---
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
  styleName: string;
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
  link: { id: number; token: string; portalTitle: string | null; orderType: "swatch" | "style" };
  order: PortalOrder;
  artworks: PortalArtwork[];
  messages: PortalMessage[];
}

interface ReferenceOrder {
  id: number;
  orderCode: string;
  orderName: string;
  token: string;
  portalTitle: string | null;
}

const downloadImage = (dataUrl: string, fileName: string) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName || "download";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- Lightbox Modal ---
function Lightbox({ images, startIndex, onClose }: { images: FileAttachment[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const img = images[idx];

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6 md:p-10" onClick={onClose}>
      <div className="flex items-center justify-between z-20 w-full" onClick={e => e.stopPropagation()}>
        <span className="text-white/70 text-xs sm:text-sm font-mono font-medium truncate max-w-[200px] sm:max-w-md">
          {img.name}
        </span>
        
        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Download Button */}
          <button
            onClick={() => downloadImage(img.data, img.name)}
            title="Download Image"
            className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 sm:p-2.5 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-medium"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 sm:p-2.5 transition-all active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center my-auto overflow-hidden" onClick={e => e.stopPropagation()}>
        {idx > 0 && (
          <button
            onClick={() => setIdx(i => i - 1)}
            className="absolute left-1 sm:left-4 md:left-8 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2.5 sm:p-3 z-10 border border-white/10 active:scale-90 hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        )}

        <img
          src={img.data}
          alt={img.name}
          className="max-h-[70vh] sm:max-h-[75vh] md:max-h-[82vh] max-w-full object-contain rounded-lg shadow-2xl transition-all"
        />

        {idx < images.length - 1 && (
          <button
            onClick={() => setIdx(i => i + 1)}
            className="absolute right-1 sm:right-4 md:right-8 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2.5 sm:p-3 z-10 border border-white/10 active:scale-90 hover:bg-black/70 transition-colors"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        )}
      </div>

      <div className="text-center pb-2 z-20" onClick={e => e.stopPropagation()}>
        <span className="bg-white/10 text-white/90 text-[11px] sm:text-xs font-semibold px-3 py-1 rounded-full border border-white/10">
          {idx + 1} of {images.length}
        </span>
      </div>
    </div>
  );
}

// --- Image Grid Component ---
function ImageStrip({ images, label }: { images: FileAttachment[]; label: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  if (!images.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] sm:text-[11px] font-bold text-[#a8922e] uppercase tracking-wider">{label}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-2.5">
        {images.map((img, i) => (
          <div
            key={i}
            className="group relative aspect-square w-full rounded-xl overflow-hidden border border-[#e8dfc0] bg-stone-100 hover:border-[#C6AF4B] transition-all"
          >
            <img src={img.data} alt={img.name} className="w-full h-full object-cover" />

            {/* Action Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
              <button
                onClick={() => setLightbox(i)}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-xs transition"
                title="Preview Image"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadImage(img.data, img.name);
                }}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-xs transition"
                title="Download Image"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {lightbox !== null && <Lightbox images={images} startIndex={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// --- Chat Bubble Component ---
function ChatBubble({ msg }: { msg: PortalMessage }) {
  const isTeam = msg.sender === "team";
  const [chatLightbox, setChatLightbox] = useState(false);

  return (
    <div className={`flex items-end gap-1.5 sm:gap-2 ${isTeam ? "justify-start" : "justify-end"}`}>
      {isTeam && (
        <div
          className="h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center shrink-0 text-[9px] sm:text-[10px] font-extrabold text-[#C6AF4B] mb-1"
          style={{ background: "linear-gradient(135deg, #111, #333)" }}
        >
          Z
        </div>
      )}
      <div className={`max-w-[88%] sm:max-w-[75%] md:max-w-[65%] space-y-1 ${isTeam ? "items-start" : "items-end"}`}>
        <div
          className={`rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm shadow-2xs ${
            isTeam
              ? "bg-white text-stone-900 rounded-bl-xs border border-stone-200/80"
              : "text-white rounded-br-xs"
          }`}
          style={!isTeam ? { background: "linear-gradient(135deg, #C6AF4B, #a8922e)" } : {}}
        >
          {msg.message && <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>}

          {msg.attachment && (
            <div className={`mt-1.5 rounded-lg overflow-hidden border ${isTeam ? "border-stone-200" : "border-white/20"}`}>
              {msg.attachment.type.startsWith("image/") ? (
                <div className="relative group">
                  <img src={msg.attachment.data} alt={msg.attachment.name} className="max-w-full max-h-40 sm:max-h-56 object-cover rounded" />
                  
                  {/* Hover Overlay for Chat Attachment Preview & Download */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                    <button
                      onClick={() => setChatLightbox(true)}
                      className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-xs"
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => downloadImage(msg.attachment!.data, msg.attachment!.name)}
                      className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-xs"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>

                  {chatLightbox && (
                    <Lightbox images={[msg.attachment]} startIndex={0} onClose={() => setChatLightbox(false)} />
                  )}
                </div>
              ) : (
                <a
                  href={msg.attachment.data}
                  download={msg.attachment.name}
                  className={`flex items-center gap-1.5 p-1.5 text-[11px] sm:text-xs font-medium hover:underline ${isTeam ? "text-[#a8922e]" : "text-white"}`}
                >
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{msg.attachment.name}</span>
                </a>
              )}
            </div>
          )}
        </div>

        <p className={`text-[9px] sm:text-[10px] font-medium px-1 ${isTeam ? "text-stone-400" : "text-stone-400 text-right"}`}>
          {isTeam ? "ZARI Team" : "You"} &bull; {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {!isTeam && (
        <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-stone-200 flex items-center justify-center shrink-0 text-[8px] sm:text-[9px] font-bold text-stone-600 mb-1">
          YOU
        </div>
      )}
    </div>
  );
}

// --- Active Focused Artwork Card Component ---
function ActiveArtworkCard({
  artwork,
  messages,
  token,
  onRefetch,
  onNext
}: {
  artwork: PortalArtwork;
  messages: PortalMessage[];
  token: string;
  onRefetch: () => void;
  onNext: () => void;
}) {
  const [text, setText] = useState("");
  const [attachFile, setAttachFile] = useState<FileAttachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasImages = artwork.wipImages.length > 0 || artwork.finalImages.length > 0;

  const sendMsg = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/client-portal/${token}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkId: artwork.id,
          artworkName: artwork.artworkName,
          message: text.trim() || undefined,
          attachment: attachFile ?? undefined
        }),
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
        body: JSON.stringify({ artworkId: artwork.id, artworkName: artwork.artworkName, decision }),
      });
      if (!r.ok) { const j = await r.json() as { error?: string }; throw new Error(j.error ?? "Failed"); }
    },
    onSuccess: () => { 
      onRefetch();
      onNext();
    },
  });

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setAttachFile({ name: file.name, type: file.type, data: ev.target?.result as string, size: file.size });
    reader.readAsDataURL(file);
  }

  return (
    <div className={`rounded-2xl sm:rounded-3xl border transition-all overflow-hidden ${
      artwork.isClosed
        ? "border-emerald-200/80 bg-emerald-50/20"
        : "border-[#e8dfc0] bg-white shadow-xs"
    }`}>
      {/* Header */}
      <div className="p-3.5 sm:p-5 md:p-6 flex items-center justify-between border-b border-[#f0e8d0]">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center shrink-0 ${
            artwork.isClosed ? "bg-emerald-100 text-emerald-600" : "bg-[#f5edcc] text-[#a8922e]"
          }`}>
            {artwork.isClosed ? <CheckCheck className="h-4 w-4 sm:h-5 sm:w-5" /> : <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className={`text-sm sm:text-base md:text-lg font-bold truncate ${artwork.isClosed ? "text-stone-400 line-through" : "text-stone-900"}`}>
                {artwork.artworkName}
              </h3>
              <span className="text-[9px] sm:text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200/60">
                {artwork.artworkCode}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {artwork.isClosed ? (
                <span className="text-[11px] sm:text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Approved
                </span>
              ) : artwork.decision === "Rework" ? (
                <span className="text-[11px] sm:text-xs font-bold text-amber-600 flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" /> Rework Requested
                </span>
              ) : (
                <span className="text-[11px] sm:text-xs font-bold text-[#a8922e] flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Awaiting Feedback
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body: Work in progress images */}
      {hasImages && (
        <div className="p-3.5 sm:p-5 md:p-6 space-y-3 sm:space-y-4 bg-stone-50/60 border-b border-[#f0e8d0] max-h-72 sm:max-h-80 lg:max-h-96 overflow-y-auto custom-scrollbar">
          <ImageStrip images={artwork.wipImages} label="Work in Progress" />
          <ImageStrip images={artwork.finalImages} label="Final Artwork" />
        </div>
      )}

      {/* Chat log */}
      <div className="p-3.5 sm:p-5 md:p-6">
        <p className="text-[10px] sm:text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2">Discussion & Comments</p>
        <div className="max-h-72 sm:max-h-80 lg:max-h-96 overflow-y-auto space-y-2.5 sm:space-y-3 pr-2 custom-scrollbar">
          {messages.length === 0 && !artwork.isClosed && (
            <p className="text-xs sm:text-sm text-stone-400 italic text-center py-4 bg-stone-50/50 rounded-xl border border-dashed border-stone-200">
              No comments yet for this artwork.
            </p>
          )}

          {messages.map((m) => (
            <ChatBubble key={m.id} msg={m} />
          ))}
        </div>
      </div>

      {/* Inputs & Actions */}
      {artwork.isClosed ? (
        <div className="m-3.5 sm:m-5 md:m-6 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center gap-2.5">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-xs sm:text-sm font-bold text-emerald-800">This artwork has been approved.</p>
        </div>
      ) : (
        <div className="p-3.5 sm:p-5 md:p-6 space-y-3 bg-stone-50/30 border-t border-stone-100">

          {/* Input Area */}
          <div className="space-y-1.5">
            {attachFile && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#fdf6e0] border border-[#e8dfc0] text-[11px] sm:text-xs text-[#a8922e]">
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[150px] sm:max-w-[220px]">{attachFile.name}</span>
                <button onClick={() => setAttachFile(null)} className="p-0.5 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="flex items-end gap-1.5 sm:gap-2">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Send a comment..."
                rows={1}
                className="flex-1 text-xs sm:text-sm text-stone-900 border border-stone-200 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 focus:outline-none focus:ring-1 focus:ring-[#C6AF4B] focus:border-[#C6AF4B] resize-none placeholder:text-stone-400 bg-white"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-stone-200 text-stone-500 bg-white active:bg-stone-100 hover:bg-stone-50 shrink-0"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => sendMsg.mutate()}
                disabled={sendMsg.isPending || (!text.trim() && !attachFile)}
                style={{ background: "linear-gradient(135deg, #C6AF4B, #a8922e)" }}
                className="flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-xl text-white disabled:opacity-40 shrink-0 active:scale-95 transition-transform"
              >
                {sendMsg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
              <input ref={fileRef} type="file" className="hidden" onChange={pickFile} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-stone-200/60 space-y-1.5">
            <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:max-w-md">
              <button
                onClick={() => submitDecision.mutate("Approve")}
                disabled={submitDecision.isPending}
                style={{ background: "linear-gradient(135deg, #C6AF4B, #a8922e)" }}
                className="flex items-center justify-center gap-1.5 py-2.5 sm:py-3 rounded-xl text-white text-xs sm:text-sm font-bold shadow-xs active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {submitDecision.isPending && submitDecision.variables === "Approve" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5" />
                )}
                Approve
              </button>

              <button
                onClick={() => submitDecision.mutate("Rework")}
                disabled={submitDecision.isPending}
                className="flex items-center justify-center gap-1.5 py-2.5 sm:py-3 rounded-xl border border-stone-300 bg-white text-stone-700 text-xs sm:text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-60 hover:bg-stone-50"
              >
                {submitDecision.isPending && submitDecision.variables === "Rework" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Request Rework
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientPortal() {
  const [referenceSearch, setReferenceSearch] = useState("");
  const [referenceType, setReferenceType] = useState<"swatch" | "style">("swatch");
  const [searchInput, setSearchInput] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);
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

  const { data: referenceOrders = [], isFetching: referenceLoading } = useQuery<ReferenceOrder[]>({
    queryKey: ["client-reference-orders", token, referenceType, referenceSearch],
    enabled: !!token,
    queryFn: async () => {
      const queryParams = new URLSearchParams({ type: referenceType });
      if (referenceSearch.trim()) queryParams.set("search", referenceSearch);

      const r = await fetch(`/api/client-portal/${token}/reference-orders?${queryParams}`);
      if (!r.ok) throw new Error("Failed");
      const j = await r.json();
      return j.data;
    },
  });

  function changeTab(type: "swatch" | "style") {
    setReferenceType(type);
    setReferenceSearch("");
    setSearchInput("");
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setReferenceSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    pillRefs.current[currentIndex]?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [currentIndex]);

  function refetch() { void qc.invalidateQueries({ queryKey: ["client-portal", token] }); }

  if (!token) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8F6F0]">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-black text-[#C6AF4B] shadow-md"
            style={{ background: "linear-gradient(135deg, #111, #222)" }}
          >
            Z
          </div>
          <Loader2 className="h-5 w-5 text-[#C6AF4B] animate-spin" />
        </div>
      </div>
    );
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : "Something went wrong";
    const notPublished = msg === "This link is not yet published";
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8F6F0]">
        <div className="text-center max-w-xs sm:max-w-sm bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-md space-y-2">
          <div className="text-3xl sm:text-4xl">{notPublished ? "⏳" : "🔒"}</div>
          <h1 className="text-base sm:text-lg font-bold text-stone-900">{notPublished ? "Not Active Yet" : "Invalid Link"}</h1>
          <p className="text-xs sm:text-sm text-stone-500 leading-relaxed">
            {notPublished
              ? "This portal link hasn't been activated by the team yet."
              : "This review link is invalid or expired."}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { order, artworks, messages = [] } = data;
  const totalArtworks = artworks.length;
  const currentArtwork = artworks[currentIndex] ?? artworks[0];

  const pendingCount = artworks.filter(a => !a.isClosed && !a.decision).length;
  const approvedCount = artworks.filter(a => a.isClosed).length;
  const reworkCount = artworks.filter(a => !a.isClosed && a.decision === "Rework").length;
  const allApproved = totalArtworks > 0 && approvedCount === totalArtworks;

  const handleNext = () => {
    if (currentIndex < totalArtworks - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  return (
    <div className="min-h-screen pb-10 bg-[#F8F6F0]">

      {/* Sticky Header */}
      <header className="sticky top-0 z-30 shadow-xs backdrop-blur-md bg-stone-950/95 border-b border-stone-800">
        <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center text-xs sm:text-sm font-black text-stone-900 shrink-0"
              style={{ background: "linear-gradient(135deg, #C6AF4B, #a8922e)" }}
            >
              Z
            </div>
            <div className="min-w-0">
              <p className="text-[8px] sm:text-[9px] text-stone-400 uppercase tracking-widest font-semibold leading-none">Review Portal</p>
              <h2 className="text-xs sm:text-sm md:text-base font-bold text-white truncate max-w-[140px] sm:max-w-xs md:max-w-sm mt-0.5">
                {data.link.portalTitle ?? "ZARI Embroideries"}
              </h2>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[8px] sm:text-[9px] text-stone-400 uppercase tracking-wider font-semibold leading-none">Order Code</p>
            <p className="text-xs sm:text-sm font-mono font-bold text-[#C6AF4B] mt-0.5">{order.orderCode}</p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">

          {/* Sidebar: Order Specs & Reference Orders */}
          <div className="lg:col-span-4 lg:sticky lg:top-[88px] space-y-3.5 sm:space-y-4">

            {/* Order Card */}
            <div className="rounded-2xl border border-[#e8dfc0] bg-white shadow-xs p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-[#a8922e] uppercase tracking-wider">
                    {data.link.orderType === "style" ? "Style Order" : "Swatch Order"}
                  </span>
                  <h1 className="text-base sm:text-xl font-extrabold text-stone-900 leading-tight mt-0.5">
                    {data.link.orderType === "style" ? order.styleName : order.swatchName}
                  </h1>
                </div>
                <span className={`shrink-0 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  order.orderStatus === "Completed" ? "bg-emerald-100 text-emerald-800" :
                  order.orderStatus === "In Artwork" ? "bg-sky-100 text-sky-800" :
                  order.orderStatus === "Pending Approval" ? "bg-amber-100 text-amber-800" :
                  "bg-stone-100 text-stone-700"
                }`}>
                  {order.orderStatus}
                </span>
              </div>

              {/* Specs */}
              <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible no-scrollbar pt-2 border-t border-stone-100 text-xs">
                {order.clientName && (
                  <div className="bg-stone-50 border border-stone-100 px-2.5 py-1.5 rounded-xl shrink-0 flex items-center gap-1.5">
                    <User className="h-3 w-3 text-stone-400" />
                    <span className="text-[11px] sm:text-xs font-medium text-stone-700">{order.clientName}</span>
                  </div>
                )}
                {order.fabricName && (
                  <div className="bg-stone-50 border border-stone-100 px-2.5 py-1.5 rounded-xl shrink-0 flex items-center gap-1.5">
                    <Layers className="h-3 w-3 text-stone-400" />
                    <span className="text-[11px] sm:text-xs font-medium text-stone-700">{order.fabricName}</span>
                  </div>
                )}
                {order.quantity && (
                  <div className="bg-stone-50 border border-stone-100 px-2.5 py-1.5 rounded-xl shrink-0 flex items-center gap-1.5">
                    <Tag className="h-3 w-3 text-stone-400" />
                    <span className="text-[11px] sm:text-xs font-medium text-stone-700">Qty: {order.quantity}</span>
                  </div>
                )}
                {order.deliveryDate && (
                  <div className="bg-stone-50 border border-stone-100 px-2.5 py-1.5 rounded-xl shrink-0 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-stone-400" />
                    <span className="text-[11px] sm:text-xs font-medium text-stone-700">
                      {new Date(order.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                )}
              </div>

              {allApproved && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  <p className="text-xs sm:text-sm font-bold text-emerald-900">All artworks approved!</p>
                </div>
              )}
            </div>

            {/* Description */}
            {order.description && (
              <div className="bg-white rounded-2xl border border-[#e8dfc0] p-3.5 sm:p-4 shadow-xs space-y-1">
                <p className="text-[9px] sm:text-[10px] font-bold text-[#a8922e] uppercase tracking-wider">Description</p>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">{order.description}</p>
              </div>
            )}

            {/* Reference Orders Search */}
            <div className="bg-white rounded-2xl border border-[#e8dfc0] p-3.5 sm:p-4 shadow-xs space-y-2.5">
              <p className="text-[9px] sm:text-[10px] font-bold text-stone-400 uppercase tracking-wider">Orders</p>

              <div className="flex bg-stone-100 p-0.5 rounded-lg">
                <button
                  onClick={() => changeTab("swatch")}
                  className={`flex-1 py-1 sm:py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all ${
                    referenceType === "swatch" ? "bg-white text-stone-900 shadow-2xs" : "text-stone-500"
                  }`}
                >
                  Swatches
                </button>
                <button
                  onClick={() => changeTab("style")}
                  className={`flex-1 py-1 sm:py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all ${
                    referenceType === "style" ? "bg-white text-stone-900 shadow-2xs" : "text-stone-500"
                  }`}
                >
                  Styles
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 sm:top-2.5 h-3.5 w-3.5 text-stone-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search related..."
                  className="w-full text-xs sm:text-sm rounded-lg border border-stone-200 pl-8 pr-2.5 py-1.5 sm:py-2 focus:outline-none focus:ring-1 focus:ring-[#C6AF4B]"
                />
              </div>

              <div className="max-h-40 sm:max-h-52 lg:max-h-64 overflow-y-auto divide-y divide-stone-100 rounded-lg border border-stone-100">
                {referenceLoading ? (
                  <div className="p-3 flex justify-center">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                  </div>
                ) : referenceOrders.length === 0 ? (
                  <div className="p-3 text-center text-xs sm:text-sm text-stone-400">
                    No related orders
                  </div>
                ) : (
                  referenceOrders.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { window.location.href = `/client/${item.token}`; }}
                      className="w-full p-2 sm:p-2.5 text-left hover:bg-stone-50 transition flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] sm:text-xs font-bold text-stone-900">{item.orderCode}</p>
                        <p className="text-[11px] sm:text-xs text-stone-500 truncate">{item.orderName}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-stone-300 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Stepper / Wizard Artwork Focus Area */}
          <div className="lg:col-span-8 mt-3.5 lg:mt-0 space-y-3.5 sm:space-y-4">

            {totalArtworks === 0 ? (
              <div className="bg-white rounded-2xl border border-[#e8dfc0] p-6 sm:p-8 text-center shadow-xs space-y-1">
                <div className="text-xl sm:text-2xl">🎨</div>
                <p className="text-xs sm:text-sm font-bold text-stone-700">No Artworks Shared Yet</p>
                <p className="text-[11px] sm:text-xs text-stone-400">Artworks will appear here once ready.</p>
              </div>
            ) : (
              <>
                {/* Stepper Top Bar & Pagination Controls */}
                <div className="bg-white rounded-2xl border border-[#e8dfc0] p-3 sm:p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-stone-900">
                        Artwork {currentIndex + 1} of {totalArtworks}
                      </span>
                      {pendingCount > 0 && (
                        <span className="text-[10px] sm:text-xs font-bold text-[#a8922e] bg-[#fdf6e0] px-2 py-0.5 rounded-full border border-[#e8dfc0]">
                          {pendingCount} Pending
                        </span>
                      )}
                    </div>

                    {/* Prev / Next Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="p-1.5 sm:p-2 rounded-xl border border-stone-200 text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-stone-50 active:scale-95 transition"
                        title="Previous Artwork"
                      >
                        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                      <button
                        onClick={handleNext}
                        disabled={currentIndex === totalArtworks - 1}
                        className="p-1.5 sm:p-2 rounded-xl border border-stone-200 text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-stone-50 active:scale-95 transition"
                        title="Next Artwork"
                      >
                        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Scrollable Jump Strip */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 pb-0.5">
                    {artworks.map((aw, idx) => {
                      const isActive = idx === currentIndex;
                      return (
                        <button
                          key={aw.id}
                          ref={(el) => { pillRefs.current[idx] = el; }}
                          onClick={() => setCurrentIndex(idx)}
                          className={`shrink-0 text-[10px] sm:text-xs px-2.5 py-1 rounded-xl font-mono font-bold transition-all flex items-center gap-1 border ${
                            isActive
                              ? "bg-stone-900 text-white border-stone-900 ring-2 ring-[#C6AF4B]/50"
                              : aw.isClosed
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : aw.decision === "Rework"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200"
                          }`}
                        >
                          {aw.isClosed ? "✓" : aw.decision === "Rework" ? "⟲" : "•"} {aw.artworkCode}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Focused Artwork Card */}
                {currentArtwork && (
                  <ActiveArtworkCard
                    key={currentArtwork.id}
                    artwork={currentArtwork}
                    messages={messages.filter(m => m.artworkId === currentArtwork.id)}
                    token={token}
                    onRefetch={refetch}
                    onNext={handleNext}
                  />
                )}
              </>
            )}

          </div>
        </div>

        {/* Footer */}
        <footer className="pt-6 sm:pt-8 pb-2 text-center space-y-1">
          <p className="text-[10px] sm:text-xs font-bold text-stone-500 tracking-wide">ZARI EMBROIDERIES</p>
          <p className="text-[9px] sm:text-[10px] text-stone-400">Powered by ZARI ERP</p>
        </footer>

      </main>
    </div>
  );
}