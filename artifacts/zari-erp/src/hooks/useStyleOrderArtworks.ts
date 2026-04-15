import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type FileAttachment = { name: string; type: string; data: string; size: number };

export type StyleOrderArtworkRecord = {
  id: number;
  artworkCode: string;
  styleOrderId: number;
  styleOrderProductId: number | null;
  styleOrderProductName: string | null;
  artworkName: string;
  unitLength: string | null;
  unitWidth: string | null;
  unitType: string | null;
  artworkCreated: string;
  workHours: string | null;
  hourlyRate: string | null;
  totalCost: string | null;
  outsourceVendorId: string | null;
  outsourceVendorName: string | null;
  outsourcePaymentDate: string | null;
  outsourcePaymentAmount: string | null;
  outsourcePaymentMode: string | null;
  outsourceTransactionId: string | null;
  outsourcePaymentStatus: string | null;
  toileMakingCost: string | null;
  toileVendorId: string | null;
  toileVendorName: string | null;
  toileCost: string | null;
  toilePaymentDate: string | null;
  toilePaymentMode: string | null;
  toilePaymentStatus: string | null;
  toileTransactionId: string | null;
  toileImages: FileAttachment[];
  patternType: string | null;
  patternMakingCost: string | null;
  patternDoc: FileAttachment[];
  patternOuthouseDoc: FileAttachment[];
  feedbackStatus: string;
  files: FileAttachment[];
  refImages: FileAttachment[];
  wipImages: FileAttachment[];
  finalImages: FileAttachment[];
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
};

const BASE = "/api/style-order-artworks";
const QK   = "style-order-artworks";

export function useStyleOrderArtworks(styleOrderId: number | null) {
  return useQuery<{ data: StyleOrderArtworkRecord[] }>({
    queryKey: [QK, styleOrderId],
    queryFn: () => customFetch(`${BASE}?styleOrderId=${styleOrderId}`),
    enabled: !!styleOrderId,
  });
}

export function useStyleOrderArtwork(id: number | null) {
  return useQuery<{ data: StyleOrderArtworkRecord }>({
    queryKey: [QK, "single", id],
    queryFn: () => customFetch(`${BASE}/${id}`),
    enabled: !!id,
  });
}

export function useCreateStyleOrderArtwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<StyleOrderArtworkRecord>) =>
      customFetch<{ data: StyleOrderArtworkRecord }>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: [QK, (vars as Record<string, unknown>).styleOrderId] }),
  });
}

export function useUpdateStyleOrderArtwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<StyleOrderArtworkRecord> }) =>
      customFetch<{ data: StyleOrderArtworkRecord }>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (res) => qc.invalidateQueries({ queryKey: [QK, res.data.styleOrderId] }),
  });
}

export function useDeleteStyleOrderArtwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, styleOrderId }: { id: number; styleOrderId: number }) =>
      customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }).then(r => ({ ...r, styleOrderId })),
    onSuccess: (res) => qc.invalidateQueries({ queryKey: [QK, (res as Record<string, unknown>).styleOrderId] }),
  });
}
