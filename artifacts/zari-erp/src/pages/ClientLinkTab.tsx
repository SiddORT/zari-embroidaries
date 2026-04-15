import { useState, useRef } from "react";
import {
  Link2, Copy, Check, ExternalLink, Eye, EyeOff, RefreshCw,
  Globe, GlobeLock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Loader2, Send, Paperclip, X, CheckCheck, LockKeyhole, UnlockKeyhole,
  MessageSquare, RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useClientLink, useClientMessages, useClientFeedback, useUpdateClientLink,
  useRegenerateLink, useSendTeamMessage, useToggleThread,
  type ClientMessageRecord,
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

function ChatBubble({ msg }: { msg: ClientMessageRecord }) {
  const isTeam = msg.sender === "team";
  return (
    <div className={`flex gap-2 ${isTeam ? "justify-end" : "justify-start"}`}>
      {!isTeam && (
        <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-gray-500">C</div>
      )}
      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 space-y-1.5 ${isTeam ? "bg-gray-900 text-white rounded-tr-sm" : "bg-gray-100 text-gray-900 rounded-tl-sm"}`}>
        {msg.message && <p className="text-sm leading-snug">{msg.message}</p>}
        {msg.attachment && (
          <div className={`rounded-xl overflow-hidden border ${isTeam ? "border-white/10" : "border-gray-200"}`}>
            {msg.attachment.type.startsWith("image/") ? (
              <img src={msg.attachment.data} alt={msg.attachment.name} className="max-w-[200px] object-cover" />
            ) : (
              <a href={msg.attachment.data} download={msg.attachment.name}
                className={`flex items-center gap-2 px-3 py-2 text-xs hover:underline ${isTeam ? "text-[#C9B45C]" : "text-blue-600"}`}>
                <Paperclip className="h-3.5 w-3.5" />{msg.attachment.name}
              </a>
            )}
          </div>
        )}
        <p className={`text-[10px] ${isTeam ? "text-white/40 text-right" : "text-gray-400"}`}>
          {isTeam ? "ZARI" : "Client"} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {" "}{new Date(msg.createdAt).toLocaleDateString()}
        </p>
      </div>
      {isTeam && (
        <div className="h-7 w-7 rounded-full bg-gray-900 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-[#C9B45C]">Z</div>
      )}
    </div>
  );
}

function ArtworkAccordion({ aw, messages, isClosed, decision, linkId, swatchOrderId, onLightbox }: {
  aw: { id: number; artworkCode: string; artworkName: string; wipImages: FileAttachment[]; finalImages: FileAttachment[] };
  messages: ClientMessageRecord[];
  isClosed: boolean;
  decision: "Approve" | "Rework" | null;
  linkId: number;
  swatchOrderId: number;
  onLightbox: (artworkId: number, type: "wip" | "final", idx: number) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(!isClosed);
  const [text, setText] = useState("");
  const [attachFile, setAttachFile] = useState<FileAttachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sendMsg = useSendTeamMessage();
  const toggleThread = useToggleThread();
  const updateLink = useUpdateClientLink();

  const unread = messages.filter(m => m.sender === "client").length;
  const hasImages = aw.wipImages.length > 0 || aw.finalImages.length > 0;

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setAttachFile({ name: file.name, type: file.type, data: ev.target?.result as string, size: file.size });
    };
    reader.readAsDataURL(file);
  }

  function handleSend() {
    if (!text.trim() && !attachFile) return;
    sendMsg.mutate({
      linkId, artworkId: aw.id, artworkName: aw.artworkName,
      message: text.trim() || undefined,
      attachment: attachFile ?? undefined,
    }, {
      onSuccess: () => { setText(""); setAttachFile(null); },
      onError: () => toast({ title: "Failed to send", variant: "destructive" }),
    });
  }

  function handleToggleClose() {
    toggleThread.mutate({ linkId, swatchOrderId, artworkId: aw.id, closed: !isClosed }, {
      onSuccess: () => toast({ title: isClosed ? "Thread reopened" : "Thread marked Done" }),
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  }

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${isClosed ? "border-gray-100 bg-gray-50/50" : "border-gray-200 bg-white"}`}>
      {/* Accordion header */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-gray-400 shrink-0">{aw.artworkCode}</span>
          <span className={`text-sm font-semibold truncate ${isClosed ? "text-gray-400" : "text-gray-900"}`}>{aw.artworkName}</span>
          {isClosed ? (
            <span className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              <CheckCheck className="h-3 w-3" /> Approved
            </span>
          ) : decision === "Rework" ? (
            <span className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
              <RotateCcw className="h-3 w-3" /> Rework Requested
            </span>
          ) : decision === "Approve" ? (
            <span className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              <CheckCheck className="h-3 w-3" /> Approved
            </span>
          ) : null}
          {!isClosed && unread > 0 && (
            <span className="shrink-0 flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
              {unread}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 shrink-0">{messages.length} msg{messages.length !== 1 ? "s" : ""}</span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* Image controls */}
          {hasImages && (
            <div className="px-5 py-4 space-y-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Images Shared with Client</p>
              {aw.wipImages.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">WIP</p>
                  <div className="flex flex-wrap gap-2">
                    {aw.wipImages.map((img, i) => (
                      <button key={i} onClick={() => onLightbox(aw.id, "wip", i)}
                        className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-[#C9B45C] transition-colors">
                        <img src={img.data} alt={img.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {aw.finalImages.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Final</p>
                  <div className="flex flex-wrap gap-2">
                    {aw.finalImages.map((img, i) => (
                      <button key={i} onClick={() => onLightbox(aw.id, "final", i)}
                        className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-[#C9B45C] transition-colors">
                        <img src={img.data} alt={img.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chat thread */}
          <div className="px-5 py-4 space-y-3 min-h-[80px]">
            {messages.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-400">
                <MessageSquare className="h-4 w-4" />
                <p className="text-sm italic">No messages yet. Client will see your replies here.</p>
              </div>
            ) : (
              messages.map(m => <ChatBubble key={m.id} msg={m} />)
            )}
          </div>

          {/* Input area */}
          {isClosed ? (
            <div className="mx-5 mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
              <CheckCheck className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-xs text-green-700 font-medium">Thread is marked Done — client can no longer send messages.</p>
              <button onClick={handleToggleClose} disabled={toggleThread.isPending}
                className="ml-auto shrink-0 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-60">
                <UnlockKeyhole className="h-3.5 w-3.5" /> Reopen
              </button>
            </div>
          ) : (
            <div className="px-5 pb-4 space-y-2">
              {/* Attachment preview */}
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
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Reply to client…"
                  rows={2}
                  className="flex-1 text-sm text-gray-900 border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none placeholder:text-gray-400"
                />
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center justify-center h-9 w-9 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sendMsg.isPending || (!text.trim() && !attachFile)}
                    className="flex items-center justify-center h-9 w-9 rounded-xl bg-gray-900 text-[#C9B45C] hover:bg-black transition-colors disabled:opacity-50">
                    {sendMsg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <input ref={fileRef} type="file" className="hidden" onChange={pickFile} />
              </div>
              {/* Mark done */}
              <div className="flex justify-end">
                <button onClick={handleToggleClose} disabled={toggleThread.isPending}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-[#C9B45C] font-medium hover:bg-black transition-colors disabled:opacity-60">
                  {toggleThread.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <LockKeyhole className="h-3 w-3" />}
                  Mark Thread Done
                </button>
              </div>
            </div>
          )}
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
  const [showImageControls, setShowImageControls] = useState(false);

  const { data: link, isLoading: linkLoading } = useClientLink(swatchOrderId);
  const { data: artworks, isLoading: artworksLoading } = useArtworkList(swatchOrderId);
  const { data: messages } = useClientMessages(link?.id ?? null);
  const { data: feedbackList } = useClientFeedback(link?.id ?? null);

  const updateLink = useUpdateClientLink();
  const regenLink = useRegenerateLink();

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
      onSuccess: () => toast({ title: link.isPublished ? "Link unpublished" : "Link published!" }),
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  }

  function toggleImage(artworkId: number, imageType: "wip" | "final", imageIndex: number) {
    if (!link) return;
    const hidden = link.hiddenImages ?? [];
    const exists = hidden.some(h => h.artworkId === artworkId && h.imageType === imageType && h.imageIndex === imageIndex);
    const updated = exists
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
      onSuccess: () => { setConfirmRegen(false); toast({ title: "Link regenerated" }); },
      onError: () => toast({ title: "Failed", variant: "destructive" }),
    });
  }

  if (linkLoading || artworksLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  type ArtworkRow = {
    id: number; artworkCode: string; artworkName: string; feedbackStatus: string;
    wipImages: FileAttachment[]; finalImages: FileAttachment[];
  };

  const artworkList = (artworks?.data ?? []) as ArtworkRow[];
  const closedThreads = link?.closedThreads ?? [];

  const openArtworks = artworkList.filter(a => !closedThreads.includes(a.id));
  const closedArtworks = artworkList.filter(a => closedThreads.includes(a.id));
  const sortedArtworks = [...openArtworks, ...closedArtworks];

  const totalUnread = (messages ?? []).filter(m => m.sender === "client").length;

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
            <p className="text-xs text-gray-400">Share this link with the client to collect their messages</p>
          </div>
          {link && (
            <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold ${link.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
              {link.isPublished ? <><Globe className="h-3 w-3" /> Published</> : <><GlobeLock className="h-3 w-3" /> Draft</>}
            </span>
          )}
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
              <span className="text-xs text-gray-500 font-mono break-all">{portalUrl}</span>
            </div>
            <button onClick={copyLink} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shrink-0">
              {copied ? <><Check className="h-4 w-4 text-green-600" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy</>}
            </button>
            <a href={portalUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shrink-0">
              <ExternalLink className="h-4 w-4" /> Preview
            </a>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={togglePublish} disabled={updateLink.isPending}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 shadow-sm ${link?.isPublished ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" : "bg-gray-900 text-[#C9B45C] hover:bg-black"}`}>
              {updateLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : link?.isPublished ? <GlobeLock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              {link?.isPublished ? "Unpublish" : "Publish Link"}
            </button>
            {!confirmRegen ? (
              <button onClick={() => setConfirmRegen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <RefreshCw className="h-4 w-4" /> Regenerate
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Old link will stop working!</span>
                <button onClick={handleRegenerate} disabled={regenLink.isPending} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-60">
                  {regenLink.isPending ? "…" : "Confirm"}
                </button>
                <button onClick={() => setConfirmRegen(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Image Visibility Controls (collapsible) ── */}
      {artworkList.some(a => a.wipImages.length > 0 || a.finalImages.length > 0) && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <button onClick={() => setShowImageControls(o => !o)}
            className="w-full flex items-center gap-3 px-6 py-4 bg-gray-50/50 hover:bg-gray-100/50 transition-colors">
            <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gray-900">
              <Eye className="h-4 w-4 text-[#C9B45C]" />
            </div>
            <div className="flex-1 text-left">
              <h2 className="text-sm font-semibold text-gray-900">Image Visibility</h2>
              <p className="text-xs text-gray-400">Toggle which images are visible to the client</p>
            </div>
            {showImageControls ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>
          {showImageControls && (
            <div className="px-6 py-5 divide-y divide-gray-50 space-y-0">
              {artworkList.map(aw => {
                const wipImgs = aw.wipImages ?? [];
                const finalImgs = aw.finalImages ?? [];
                if (!wipImgs.length && !finalImgs.length) return null;
                return (
                  <div key={aw.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                    <p className="text-xs font-semibold text-gray-700">{aw.artworkCode} · {aw.artworkName}</p>
                    {wipImgs.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-2">WIP</p>
                        <div className="flex flex-wrap gap-2">
                          {wipImgs.map((img, i) => {
                            const hidden = isHidden(aw.id, "wip", i);
                            return (
                              <div key={i} className="relative">
                                <button onClick={() => setLightbox({ artworkId: aw.id, type: "wip", idx: i })}
                                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${hidden ? "border-red-200 opacity-40" : "border-gray-200 hover:border-[#C9B45C]"}`}>
                                  <img src={img.data} alt={img.name} className="w-full h-full object-cover" />
                                </button>
                                <button onClick={() => toggleImage(aw.id, "wip", i)} title={hidden ? "Show" : "Hide"}
                                  className={`absolute -top-1 -right-1 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm text-[10px] transition-colors ${hidden ? "bg-red-500 text-white" : "bg-white text-gray-500 hover:bg-red-100"}`}>
                                  {hidden ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {finalImgs.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Final</p>
                        <div className="flex flex-wrap gap-2">
                          {finalImgs.map((img, i) => {
                            const hidden = isHidden(aw.id, "final", i);
                            return (
                              <div key={i} className="relative">
                                <button onClick={() => setLightbox({ artworkId: aw.id, type: "final", idx: i })}
                                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${hidden ? "border-red-200 opacity-40" : "border-gray-200 hover:border-[#C9B45C]"}`}>
                                  <img src={img.data} alt={img.name} className="w-full h-full object-cover" />
                                </button>
                                <button onClick={() => toggleImage(aw.id, "final", i)} title={hidden ? "Show" : "Hide"}
                                  className={`absolute -top-1 -right-1 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center shadow-sm text-[10px] transition-colors ${hidden ? "bg-red-500 text-white" : "bg-white text-gray-500 hover:bg-red-100"}`}>
                                  {hidden ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Artwork Chat Threads ── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Artwork Threads</p>
          {totalUnread > 0 && (
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-orange-500 text-white font-semibold">
              {totalUnread} client message{totalUnread !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {artworkList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 px-6 py-12 text-center">
            <p className="text-sm text-gray-400 italic">No artworks linked to this order yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedArtworks.map(aw => {
              const awFeedback = (feedbackList ?? []).filter(f => f.artworkId === aw.id);
              const latestDecision = awFeedback[awFeedback.length - 1]?.decision ?? null;
              return (
                <ArtworkAccordion
                  key={aw.id}
                  aw={aw}
                  messages={(messages ?? []).filter(m => m.artworkId === aw.id)}
                  isClosed={closedThreads.includes(aw.id)}
                  decision={latestDecision as "Approve" | "Rework" | null}
                  linkId={link!.id}
                  swatchOrderId={swatchOrderId}
                  onLightbox={(artworkId, type, idx) => setLightbox({ artworkId, type, idx })}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (() => {
        const aw = artworkList.find(a => a.id === lightbox.artworkId);
        if (!aw) return null;
        const imgs = lightbox.type === "wip" ? aw.wipImages : aw.finalImages;
        return <Lightbox images={imgs} startIndex={lightbox.idx} onClose={() => setLightbox(null)} />;
      })()}
    </div>
  );
}
