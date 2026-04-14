import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type SwatchRecord = {
  id: number; swatchCode: string; swatchName: string; fabric: string | null; colorName: string | null;
  hexCode: string | null; width: string | null; unitType: string | null; finishType: string | null;
  gsm: string | null; client: string | null; approvalStatus: string; remarks: string | null;
  isActive: boolean; isDeleted: boolean; createdBy: string; createdAt: string;
  updatedBy: string | null; updatedAt: string | null;
};

export type SwatchFormData = {
  swatchName: string; fabric: string; colorName: string; hexCode: string; width: string;
  unitType: string; finishType: string; gsm: string; client: string;
  approvalStatus: string; remarks: string; isActive: boolean;
};

export type StatusFilter = "all" | "active" | "inactive";

const BASE = "/api/swatches";
const QK = "swatches";

export function useSwatchList(p: { search: string; status: StatusFilter; page: number; limit: number }) {
  return useQuery({
    queryKey: [QK, p],
    queryFn: () => customFetch<{ data: SwatchRecord[]; total: number; page: number; limit: number }>(
      `${BASE}?search=${encodeURIComponent(p.search)}&status=${p.status}&page=${p.page}&limit=${p.limit}`),
    placeholderData: (prev) => prev,
  });
}

export function useAllSwatches() {
  return useQuery({ queryKey: [QK, "all"], queryFn: () => customFetch<SwatchRecord[]>(`${BASE}/all`) });
}

export function useCreateSwatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SwatchFormData) => customFetch<SwatchRecord>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateSwatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SwatchFormData> }) =>
      customFetch<SwatchRecord>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useToggleSwatchStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<SwatchRecord>(`${BASE}/${id}/status`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeleteSwatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
