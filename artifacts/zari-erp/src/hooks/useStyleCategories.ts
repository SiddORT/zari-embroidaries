import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type StyleCategoryRecord = {
  id: number; categoryName: string; isActive: boolean; isDeleted: boolean;
  createdBy: string; createdAt: string; updatedBy: string | null; updatedAt: string | null;
};

export type StyleCategoryFormData = { categoryName: string; isActive: boolean };
export type StatusFilter = "all" | "active" | "inactive";

export interface CategoryImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; name: string; error: string }[];
}

const BASE = "/api/style-categories";
const QK = "style-categories";

export function useStyleCategoryList(p: { search: string; status: StatusFilter; page: number; limit: number }) {
  return useQuery({
    queryKey: [QK, p],
    queryFn: () => customFetch<{ data: StyleCategoryRecord[]; total: number; page: number; limit: number }>(
      `${BASE}?search=${encodeURIComponent(p.search)}&status=${p.status}&page=${p.page}&limit=${p.limit}`),
    placeholderData: (prev) => prev,
  });
}

export function useAllStyleCategories() {
  return useQuery({ queryKey: [QK, "all"], queryFn: () => customFetch<StyleCategoryRecord[]>(`${BASE}/all`) });
}

export async function fetchAllStyleCategoriesForExport(search: string, status: StatusFilter): Promise<StyleCategoryRecord[]> {
  const qs = new URLSearchParams({ search, status }).toString();
  const result = await customFetch<{ data: StyleCategoryRecord[] }>(`${BASE}/export-all?${qs}`);
  return result.data;
}

export function useCreateStyleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StyleCategoryFormData) => customFetch<StyleCategoryRecord>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateStyleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<StyleCategoryFormData> }) =>
      customFetch<StyleCategoryRecord>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useToggleStyleCategoryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<StyleCategoryRecord>(`${BASE}/${id}/status`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeleteStyleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useImportStyleCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: { categoryName: string }[]) =>
      customFetch<CategoryImportResult>(`${BASE}/import`, { method: "POST", body: JSON.stringify(rows) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
