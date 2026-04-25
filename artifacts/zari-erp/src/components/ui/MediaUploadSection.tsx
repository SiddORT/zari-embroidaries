import { useRef, useState } from "react";
import { Upload, Trash2, Image, Film, Loader2, ZoomIn, X } from "lucide-react";

export type MediaItem = { url: string; type: "image" | "video"; name: string; };

interface Props {
  entityType: "styles" | "swatches";
  entityId: number;
  wipMedia: MediaItem[];
  finalMedia: MediaItem[];
  onUpdate: (updated: { wipMedia: MediaItem[]; finalMedia: MediaItem[] }) => void;
}

function mediaUrl(url: string) {
  if (url.startsWith("/uploads/")) return `/api${url}`;
  return url;
}

interface LightboxProps {
  item: MediaItem;
  onClose: () => void;
}

function Lightbox({ item, onClose }: LightboxProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2"
      >
        <X size={20} />
      </button>
      <div className="max-w-5xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
        {item.type === "image" ? (
          <img
            src={mediaUrl(item.url)}
            alt={item.name}
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <video
            src={mediaUrl(item.url)}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
          >
            Your browser does not support the video tag.
          </video>
        )}
        <p className="text-white/70 text-sm text-center mt-3 truncate">{item.name}</p>
      </div>
    </div>
  );
}

interface MediaGridProps {
  items: MediaItem[];
  category: "wip" | "final";
  onDelete: (url: string, category: "wip" | "final") => Promise<void>;
  deleting: string | null;
  onPreview: (item: MediaItem) => void;
}

function MediaGrid({ items, category, onDelete, deleting, onPreview }: MediaGridProps) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic py-2">No files uploaded yet.</p>
    );
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
      {items.map((item) => (
        <div
          key={item.url}
          className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-square flex items-center justify-center"
        >
          {item.type === "image" ? (
            <img
              src={mediaUrl(item.url)}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex flex-col items-center gap-1 p-2 text-center">
              <Film size={28} className="text-gray-400" />
              <span className="text-[10px] text-gray-500 truncate w-full leading-tight">{item.name}</span>
            </div>
          )}

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onPreview(item)}
              className="p-1.5 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow"
              title="Preview"
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.url, category)}
              disabled={deleting === item.url}
              className="p-1.5 rounded-full bg-white/90 text-red-500 hover:bg-white shadow disabled:opacity-50"
              title="Delete"
            >
              {deleting === item.url ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MediaUploadSection({ entityType, entityId, wipMedia, finalMedia, onUpdate }: Props) {
  const wipInputRef = useRef<HTMLInputElement>(null);
  const finalInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"wip" | "final" | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem("zarierp_token");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, category: "wip" | "final") {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError(null);
    setUploading(category);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      const res = await fetch(`/api/${entityType}/${entityId}/media`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Upload failed");
      }

      const record = await res.json() as { wipMedia: MediaItem[]; finalMedia: MediaItem[] };
      onUpdate({ wipMedia: record.wipMedia ?? [], finalMedia: record.finalMedia ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(url: string, category: "wip" | "final") {
    setError(null);
    setDeleting(url);
    try {
      const res = await fetch(`/api/${entityType}/${entityId}/media`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url, category }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Delete failed");
      }
      const record = await res.json() as { wipMedia: MediaItem[]; finalMedia: MediaItem[] };
      onUpdate({ wipMedia: record.wipMedia ?? [], finalMedia: record.finalMedia ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-2">
        <Image size={15} className="text-gray-400" />
        <span className="text-sm font-semibold text-gray-700">Media</span>
        <span className="text-xs text-gray-400">(images &amp; videos)</span>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded px-3 py-1.5">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-x-6">
        {(["wip", "final"] as const).map((cat) => {
          const items = cat === "wip" ? wipMedia : finalMedia;
          const inputRef = cat === "wip" ? wipInputRef : finalInputRef;
          const label = cat === "wip" ? "WIP" : "Final";
          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
                <label className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:bg-gray-50 hover:border-gray-400 transition">
                  {uploading === cat ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Upload size={12} />
                  )}
                  {uploading === cat ? "Uploading…" : "Upload"}
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                    className="hidden"
                    disabled={uploading !== null}
                    onChange={(e) => handleUpload(e, cat)}
                  />
                </label>
              </div>
              <MediaGrid
                items={items}
                category={cat}
                onDelete={handleDelete}
                deleting={deleting}
                onPreview={setPreview}
              />
            </div>
          );
        })}
      </div>

      {preview && <Lightbox item={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
