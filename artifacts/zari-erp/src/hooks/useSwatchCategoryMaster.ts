import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type SwatchCategoryRecord = {
  id: number; name: string; isActive: boolean; isDeleted: boolean;
  createdBy: string; createdAt: string; updatedBy: string | null; updatedAt: string | null;
};

export type SwatchCategoryFormData = { name: string; isActive: boolean };
export type StatusFilter = "all" | "active" | "inactive";

const BASE = "/api/swatch-categories";
const QK = "swatch-categories-master";

export function useSwatchCategoryMasterList(p: { search: string; status: StatusFilter; page: number; limit: number }) {
  return useQuery({
    queryKey: [QK, p],
    queryFn: () => customFetch<{ data: SwatchCategoryRecord[]; total: number; page: number; limit: number }>(
      `${BASE}?search=${encodeURIComponent(p.search)}&status=${p.status}&page=${p.page}&limit=${p.limit}`),
    placeholderData: (prev) => prev,
  });
}

export function useCreateSwatchCategoryMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SwatchCategoryFormData) => customFetch<SwatchCategoryRecord>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); qc.invalidateQueries({ queryKey: ["lookups", "swatch-categories"] }); },
  });
}

export function useUpdateSwatchCategoryMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SwatchCategoryFormData> }) =>
      customFetch<SwatchCategoryRecord>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); qc.invalidateQueries({ queryKey: ["lookups", "swatch-categories"] }); },
  });
}

export function useToggleSwatchCategoryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<SwatchCategoryRecord>(`${BASE}/${id}/status`, { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); qc.invalidateQueries({ queryKey: ["lookups", "swatch-categories"] }); },
  });
}

export function useDeleteSwatchCategoryMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); qc.invalidateQueries({ queryKey: ["lookups", "swatch-categories"] }); },
  });
}
