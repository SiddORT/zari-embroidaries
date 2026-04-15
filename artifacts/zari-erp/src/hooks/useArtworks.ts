import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type FileAttachment = { name: string; type: string; data: string; size: number };

export type ArtworkRecord = {
  id: number;
  artworkCode: string;
  swatchOrderId: number;
  artworkName: string;
  unitLength: string | null;
  unitWidth: string | null;
  unitType: string | null;
  artworkCreated: string;
  workHours: string | null;
  hourlyRate: string | null;
  totalCost: string | null;
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

export type ArtworkFormData = Omit<ArtworkRecord, "id" | "artworkCode" | "isDeleted" | "createdBy" | "createdAt" | "updatedBy" | "updatedAt">;

const BASE = "/api/artworks";
const QK = "artworks";

export function useArtworkList(swatchOrderId: number | null) {
  return useQuery({
    queryKey: [QK, { swatchOrderId }],
    queryFn: () =>
      customFetch<{ data: ArtworkRecord[] }>(`${BASE}?swatchOrderId=${swatchOrderId}`),
    enabled: swatchOrderId !== null && swatchOrderId > 0,
  });
}

export function useArtwork(id: number | null) {
  return useQuery({
    queryKey: [QK, id],
    queryFn: () => customFetch<{ data: ArtworkRecord }>(`${BASE}/${id}`),
    enabled: id !== null,
  });
}

export function useCreateArtwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ArtworkFormData>) =>
      customFetch<{ data: ArtworkRecord }>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateArtwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ArtworkFormData> }) =>
      customFetch<{ data: ArtworkRecord }>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeleteArtwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
