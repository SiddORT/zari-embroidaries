import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface LightboxImage {
  data: string;
  name: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  startIndex?: number;
  onClose: () => void;
}

export default function ImageLightbox({ images, startIndex = 0, onClose }: ImageLightboxProps) {
  const [current, setCurrent] = useState(startIndex);

  useEffect(() => {
    setCurrent(startIndex);
  }, [startIndex]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setCurrent(c => Math.max(0, c - 1));
      if (e.key === "ArrowRight") setCurrent(c => Math.min(images.length - 1, c + 1));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [images.length, onClose]);

  if (images.length === 0) return null;

  const img = images[current];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/92 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-white/10">
        <p className="text-sm text-white/60 truncate max-w-sm font-mono">{img.name}</p>
        <div className="flex items-center gap-4 shrink-0">
          {images.length > 1 && (
            <span className="text-xs text-white/40 font-medium">{current + 1} / {images.length}</span>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main image + nav */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 px-4 py-4">
        {images.length > 1 && (
          <button
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/25 transition-all disabled:opacity-20 disabled:cursor-default shrink-0"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        <img
          key={current}
          src={img.data}
          alt={img.name}
          className="max-h-full max-w-full object-contain rounded-xl shadow-2xl select-none"
          style={{ maxHeight: "calc(100vh - 160px)" }}
        />

        {images.length > 1 && (
          <button
            onClick={() => setCurrent(c => Math.min(images.length - 1, c + 1))}
            disabled={current === images.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/25 transition-all disabled:opacity-20 disabled:cursor-default shrink-0"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-2 px-6 py-3 shrink-0 border-t border-white/10 overflow-x-auto">
          {images.map((thumb, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={`h-14 w-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                idx === current
                  ? "border-[#C9B45C] scale-110 shadow-lg"
                  : "border-white/15 opacity-50 hover:opacity-90 hover:border-white/40"
              }`}
            >
              <img src={thumb.data} alt={thumb.name} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
