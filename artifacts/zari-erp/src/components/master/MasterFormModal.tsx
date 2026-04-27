import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import ZariButton from "@/components/ui/ZariButton";

interface MasterFormModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  submitLabel?: string;
  submitDisabled?: boolean;
  size?: "md" | "xl" | "2xl";
  children: ReactNode;
}

export default function MasterFormModal({
  open,
  title,
  onClose,
  onSubmit,
  submitting = false,
  submitLabel = "Save",
  submitDisabled = false,
  size = "md",
  children,
}: MasterFormModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={`bg-white rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh] ${size === "2xl" ? "max-w-4xl" : size === "xl" ? "max-w-2xl" : "max-w-lg"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {children}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <ZariButton variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </ZariButton>
          <ZariButton onClick={onSubmit} loading={submitting} disabled={submitting || submitDisabled}>
            {submitting ? "Saving..." : submitLabel}
          </ZariButton>
        </div>
      </div>
    </div>
  );
}
