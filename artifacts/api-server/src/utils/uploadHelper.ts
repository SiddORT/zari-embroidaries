/**
 * uploadHelper — Storage-driver-agnostic file upload utility.
 *
 * Usage in routes:
 *
 *   import { uploadMiddleware, uploadFile, deleteUpload } from "../utils/uploadHelper";
 *
 *   router.post("/my-route", requireAuth, uploadMiddleware.single("file"), async (req, res) => {
 *     const path = await uploadFile(req.file!, {
 *       entity: "orders",
 *       id: orderId,
 *       category: "artwork",
 *     });
 *     // path = "/uploads/orders/<orderId>/artwork/<timestamp>_<filename>"
 *   });
 *
 * Switching to S3 later:
 *   Set STORAGE_PROVIDER=s3 in environment — no route changes needed.
 */

import path from "path";
import crypto from "crypto";
import multer from "multer";
import { storage } from "../storage";

// ─── Multer shared middleware ──────────────────────────────────────────────────
// Uses memory storage so the helper controls where files are written.

const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, PNG, or WebP files are allowed"));
    }
  },
});

// ─── Upload options ────────────────────────────────────────────────────────────

export interface UploadOptions {
  /** Top-level folder: "procurement" | "expenses" | "packing-lists" | "orders" | "materials" | "fabrics" */
  entity: string;
  /** Entity identifier (PR id, expense number, order id, etc.) */
  id?: string | number;
  /** Sub-folder within entity: "invoices" | "artwork" | "wip" | "final" | "pattern" | "toile" | "images" */
  category?: string;
}

// ─── Path builders ─────────────────────────────────────────────────────────────

function buildTargetDir(opts: UploadOptions): string {
  const parts: string[] = [process.cwd(), "uploads", opts.entity];
  if (opts.id != null) {
    parts.push(String(opts.id).replace(/\//g, "-").replace(/\s/g, "_"));
  }
  if (opts.category) {
    parts.push(opts.category);
  }
  return path.join(...parts);
}

function buildRelativeUrl(dir: string, filename: string): string {
  const rel = dir.replace(process.cwd(), "").replace(/\\/g, "/");
  return `${rel}/${filename}`;
}

/**
 * Resolve a stored URL or relative path back to an absolute filesystem path.
 * Handles both legacy formats and new `/uploads/...` URLs.
 *
 * Legacy packing-list images: "/api/packing-lists/item-images/<filename>"
 * New format:                  "/uploads/packing-lists/<id>/images/<filename>"
 */
export function resolveUploadAbsPath(urlOrPath: string): string {
  if (!urlOrPath) return "";

  // Legacy packing-list image URL
  if (urlOrPath.startsWith("/api/packing-lists/item-images/")) {
    const filename = path.basename(urlOrPath);
    return path.join(process.cwd(), "uploads", "packing-list-items", filename);
  }

  // New /uploads/... URL or relative path starting with /uploads/
  if (urlOrPath.startsWith("/uploads/")) {
    return path.join(process.cwd(), urlOrPath.slice(1));
  }

  // Already an absolute path
  if (path.isAbsolute(urlOrPath)) return urlOrPath;

  // Fallback — treat as relative to cwd
  return path.join(process.cwd(), urlOrPath);
}

// ─── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Save an uploaded file to the configured storage backend.
 * Returns the relative URL used to access the file (e.g. "/uploads/orders/123/artwork/...").
 */
export async function uploadFile(
  file: Express.Multer.File,
  opts: UploadOptions
): Promise<string> {
  const ext = path.extname(file.originalname) || "";
  const uid = crypto.randomBytes(8).toString("hex");
  const baseName = path.basename(file.originalname, ext)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 60);
  const filename = `${uid}_${baseName}${ext}`;

  const dir = buildTargetDir(opts);
  await storage.saveFile(file.buffer, { dir, filename });
  return buildRelativeUrl(dir, filename);
}

/**
 * Delete a previously uploaded file from the configured storage backend.
 * Accepts either a relative URL ("/uploads/...") or an absolute path.
 * No-ops silently if the file does not exist.
 */
export async function deleteUpload(urlOrPath: string): Promise<void> {
  if (!urlOrPath) return;
  const absPath = resolveUploadAbsPath(urlOrPath);
  await storage.deleteFile(absPath);
}
