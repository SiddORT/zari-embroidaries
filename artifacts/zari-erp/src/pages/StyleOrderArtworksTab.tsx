import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Plus, Trash2, Pencil, Palette, ExternalLink, Package, Loader2 } from "lucide-react";
import ImageLightbox from "@/components/ui/ImageLightbox";
import {
  useStyleOrderArtworks,
  useDeleteStyleOrderArtwork,
  useUpdateStyleOrderArtwork,
  type StyleOrderArtworkRecord,
  type FileAttachment,
} from "@/hooks/useStyleOrderArtworks";
import { useStyleOrderProducts, type StyleOrderProductRecord } from "@/hooks/useStyleOrderProducts";
import { useToast } from "@/hooks/use-toast";

// ── Helpers (outside component to prevent focus-loss) ─────────────────────────

const FEEDBACK_COLORS: Record<string, string> = {
  Pending:             "bg-gray-100 text-gray-600 border-gray-200",
  "In Review":         "bg-sky-50 text-sky-700 border-sky-200",
  Approved:            "bg-gray-900 text-[#C9B45C] border-gray-900",
  "Revision Required": "bg-amber-50 text-amber-700 border-amber-200",
  Rejected:            "bg-red-50 text-red-700 border-red-200",
};

function SectionCard({
  icon, accentColor, title, subtitle, children,
}: {
  icon: React.ReactNode; accentColor: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${accentColor}`}>{icon}</div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function ArtworkRow({
  art,
  styleOrderId,
  onDelete,
  onPreview,
  onAddWip,
  onAddFinal,
}: {
  art: StyleOrderArtworkRecord;
  styleOrderId: number;
  onDelete: (id: number) => void;
  onPreview: (images: FileAttachment[], index: number) => void;
  onAddWip: (artId: number) => void;
  onAddFinal: (artId: number) => void;
}) {
  const [, setLocation] = useLocation();
  const isApproved = art.feedbackStatus === "Approved";

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-white transition-all">
      {/* Row 1: identity + badges + actions */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        {/* Thumbnail or icon */}
        {isApproved && (art.finalImages ?? []).length > 0 ? (
          <img
            src={art.finalImages[0].data}
            alt="Final"
            className="h-10 w-10 rounded-lg object-cover border border-gray-200 shrink-0 cursor-pointer hover:scale-105 transition-transform"
            onClick={() => onPreview(art.finalImages ?? [], 0)}
          />
        ) : (
          <div className="h-8 w-8 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
            <Palette className="h-4 w-4 text-[#C9B45C]" />
          </div>
        )}
        {/* Name & code */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{art.artworkName}</p>
          <p className="text-xs text-gray-400 font-mono">{art.artworkCode}</p>
        </div>
        {/* Badges */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${FEEDBACK_COLORS[art.feedbackStatus] ?? FEEDBACK_COLORS.Pending}`}>
            {art.feedbackStatus}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
            {art.artworkCreated}
          </span>
          {art.totalCost && (
            <span className="text-xs font-medium text-gray-700">₹{Number(art.totalCost).toLocaleString()}</span>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1 ml-1 shrink-0">
          {isApproved ? (
            <button
              onClick={() => setLocation(`/style-orders/${styleOrderId}/artworks/${art.id}`)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> View
            </button>
          ) : (
            <button
              onClick={() => setLocation(`/style-orders/${styleOrderId}/artworks/${art.id}`)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
              title="Edit artwork"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => onDelete(art.id)}
            disabled={isApproved}
            title={isApproved ? "Cannot delete an approved artwork" : "Delete artwork"}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2: WIP + Final image strips — always shown */}
      <div className="flex items-start gap-4 px-4 pb-3 border-t border-gray-100 pt-2">
        {/* WIP */}
        <div className="flex-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">WIP Images</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(art.wipImages ?? []).map((img, idx) => (
              <img key={idx} src={img.data} alt={img.name}
                className="h-10 w-10 rounded-lg object-cover border border-gray-200 cursor-pointer hover:scale-105 transition-transform"
                title={img.name}
                onClick={e => { e.stopPropagation(); onPreview(art.wipImages ?? [], idx); }}
              />
            ))}
            {!isApproved && (
              <button
                onClick={e => { e.stopPropagation(); onAddWip(art.id); }}
                title="Add WIP image"
                className="h-10 w-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-600 transition-colors shrink-0"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="w-px bg-gray-200 self-stretch" />
        {/* Final */}
        <div className="flex-1">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Final Images</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(art.finalImages ?? []).map((img, idx) => (
              <img key={idx} src={img.data} alt={img.name}
                className="h-10 w-10 rounded-lg object-cover border border-gray-200 cursor-pointer hover:scale-105 transition-transform"
                title={img.name}
                onClick={e => { e.stopPropagation(); onPreview(art.finalImages ?? [], idx); }}
              />
            ))}
            {!isApproved && (
              <button
                onClick={e => { e.stopPropagation(); onAddFinal(art.id); }}
                title="Add final image"
                className="h-10 w-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-600 transition-colors shrink-0"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductSection({
  product,
  artworks,
  styleOrderId,
  onDelete,
  onPreview,
  onAddWip,
  onAddFinal,
}: {
  product: StyleOrderProductRecord | null;
  artworks: StyleOrderArtworkRecord[];
  styleOrderId: number;
  onDelete: (id: number) => void;
  onPreview: (images: FileAttachment[], index: number) => void;
  onAddWip: (artId: number) => void;
  onAddFinal: (artId: number) => void;
}) {
  const [, setLocation] = useLocation();
  const productId   = product?.id ?? null;
  const productName = product?.productName ?? "Unassigned";

  return (
    <div className="space-y-2">
      {/* Product header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-gray-900 flex items-center justify-center">
            <Package className="h-3 w-3 text-[#C9B45C]" />
          </div>
          <span className="text-xs font-semibold text-gray-800">{productName}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
            {artworks.length} artwork{artworks.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => {
            const qp = productId ? `?productId=${productId}&productName=${encodeURIComponent(productName)}` : "";
            setLocation(`/style-orders/${styleOrderId}/artworks/new${qp}`);
          }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-gray-900 hover:text-gray-900 transition-colors font-medium"
        >
          <Plus className="h-3 w-3" /> Add Artwork
        </button>
      </div>

      {/* Artwork rows */}
      {artworks.length === 0 ? (
        <div className="text-xs text-gray-400 py-4 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 ml-8">
          No artworks yet for this product.
        </div>
      ) : (
        <div className="space-y-2 ml-8">
          {artworks.map(art => (
            <ArtworkRow
              key={art.id}
              art={art}
              styleOrderId={styleOrderId}
              onDelete={onDelete}
              onPreview={onPreview}
              onAddWip={onAddWip}
              onAddFinal={onAddFinal}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function StyleOrderArtworksTab({
  styleOrderId,
  isNew,
}: {
  styleOrderId: number | null;
  isNew: boolean;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: artworksData, isLoading: artLoading } = useStyleOrderArtworks(styleOrderId);
  const { data: productsData } = useStyleOrderProducts(styleOrderId);
  const deleteArtwork = useDeleteStyleOrderArtwork();
  const updateArtwork = useUpdateStyleOrderArtwork();

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<{ images: FileAttachment[]; index: number } | null>(null);
  const [imgUploadTarget, setImgUploadTarget] = useState<{ artId: number; type: "wip" | "final" } | null>(null);
  const artImgInputRef = useRef<HTMLInputElement>(null);

  const products   = productsData?.data ?? [];
  const allArtworks = artworksData?.data ?? [];

  if (isNew) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
        <Palette className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-500">Save the style order first to add artworks.</p>
      </div>
    );
  }

  // Group artworks by product
  const byProduct = new Map<number | null, StyleOrderArtworkRecord[]>();
  for (const p of products) byProduct.set(p.id, []);
  for (const art of allArtworks) {
    const key = art.styleOrderProductId ?? null;
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key)!.push(art);
  }

  async function confirmDelete() {
    if (deleteConfirmId === null) return;
    await deleteArtwork.mutateAsync({ id: deleteConfirmId, styleOrderId: styleOrderId! });
    setDeleteConfirmId(null);
    toast({ title: "Artwork removed" });
  }

  function handleAddWip(artId: number) {
    setImgUploadTarget({ artId, type: "wip" });
    setTimeout(() => artImgInputRef.current?.click(), 0);
  }

  function handleAddFinal(artId: number) {
    setImgUploadTarget({ artId, type: "final" });
    setTimeout(() => artImgInputRef.current?.click(), 0);
  }

  function handleArtworkImageFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!imgUploadTarget || !e.target.files) return;
    const { artId, type } = imgUploadTarget;
    const art = allArtworks.find(a => a.id === artId);
    if (!art) return;
    const files = Array.from(e.target.files);
    const readers = files.map(file =>
      new Promise<FileAttachment>(resolve => {
        const reader = new FileReader();
        reader.onload = ev => resolve({
          name: file.name, type: file.type,
          data: ev.target!.result as string,
          size: file.size,
        });
        reader.readAsDataURL(file);
      })
    );
    Promise.all(readers).then(newFiles => {
      const existing = type === "wip" ? (art.wipImages ?? []) : (art.finalImages ?? []);
      const merged   = [...existing, ...newFiles];
      updateArtwork.mutate({
        id: artId,
        data: {
          styleOrderId:        art.styleOrderId,
          artworkName:         art.artworkName,
          artworkCreated:      art.artworkCreated,
          feedbackStatus:      art.feedbackStatus,
          wipImages:           type === "wip"   ? merged : (art.wipImages   ?? []),
          finalImages:         type === "final" ? merged : (art.finalImages ?? []),
          files:               art.files   ?? [],
          refImages:           art.refImages ?? [],
        },
      });
      if (artImgInputRef.current) artImgInputRef.current.value = "";
      setImgUploadTarget(null);
    });
  }

  const totalCount = allArtworks.length;

  return (
    <>
      <SectionCard
        icon={<Palette className="h-4 w-4 text-[#C9B45C]" />}
        accentColor="bg-gray-900"
        title="Artworks"
        subtitle={`${totalCount} artwork${totalCount !== 1 ? "s" : ""} across ${products.length} product${products.length !== 1 ? "s" : ""}`}
      >
        {artLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : products.length === 0 ? (
          <div className="space-y-3">
            <div className="text-xs text-gray-400 py-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
              Add products first, then attach artworks to each product.
            </div>
            <button
              onClick={() => setLocation(`/style-orders/${styleOrderId}/artworks/new`)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-900 hover:text-gray-900 transition-colors w-full justify-center font-medium"
            >
              <Plus className="h-4 w-4" /> New Artwork (Unassigned)
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {products.map(p => (
              <ProductSection
                key={p.id}
                product={p}
                artworks={byProduct.get(p.id) ?? []}
                styleOrderId={styleOrderId!}
                onDelete={setDeleteConfirmId}
                onPreview={(imgs, idx) => setLightbox({ images: imgs, index: idx })}
                onAddWip={handleAddWip}
                onAddFinal={handleAddFinal}
              />
            ))}
            {(byProduct.get(null) ?? []).length > 0 && (
              <ProductSection
                product={null}
                artworks={byProduct.get(null) ?? []}
                styleOrderId={styleOrderId!}
                onDelete={setDeleteConfirmId}
                onPreview={(imgs, idx) => setLightbox({ images: imgs, index: idx })}
                onAddWip={handleAddWip}
                onAddFinal={handleAddFinal}
              />
            )}
          </div>
        )}
      </SectionCard>

      {/* Delete confirm */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Remove Artwork</h3>
            <p className="text-sm text-gray-500 mb-5">This artwork will be permanently removed from the order.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button onClick={() => { void confirmDelete(); }} disabled={deleteArtwork.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60">
                {deleteArtwork.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Hidden file input for artwork WIP/Final image upload */}
      <input
        ref={artImgInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleArtworkImageFiles}
      />
    </>
  );
}
