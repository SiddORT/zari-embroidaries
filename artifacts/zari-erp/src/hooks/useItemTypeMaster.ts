import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type ItemTypeMasterRecord = {
  id: number;
  name: string;
  isActive: boolean;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type ItemTypeMasterFormData = { name: string; isActive: boolean };
export type StatusFilter = "all" | "active" | "inactive";

export interface ItemTypeImportResult {
  succeeded: number;
  failed: number;
  results: { row: number; status: "success" | "error"; name?: string; errors?: string[] }[];
}

const BASE = "/api/item-types";
const QK = "item-types-master";

export function useItemTypeMasterList(p: { search: string; status: StatusFilter; page: number; limit: number }) {
  return useQuery({
    queryKey: [QK, p],
    queryFn: () => customFetch<{ data: ItemTypeMasterRecord[]; total: number; page: number; limit: number }>(
      `${BASE}?search=${encodeURIComponent(p.search)}&status=${p.status}&page=${p.page}&limit=${p.limit}`),
    placeholderData: (prev) => prev,
  });
}

export async function fetchAllItemTypesForExport(params: { search: string; status: string }): Promise<ItemTypeMasterRecord[]> {
  const qs = new URLSearchParams({ search: params.search, status: params.status }).toString();
  return customFetch<ItemTypeMasterRecord[]>(`${BASE}/export-all?${qs}`);
}

export function useCreateItemType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ItemTypeMasterFormData) => customFetch<ItemTypeMasterRecord>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      qc.invalidateQueries({ queryKey: ["lookups", "item-types"] });
    },
  });
}

export function useUpdateItemType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ItemTypeMasterFormData> }) =>
      customFetch<ItemTypeMasterRecord>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      qc.invalidateQueries({ queryKey: ["lookups", "item-types"] });
    },
  });
}

export function useToggleItemTypeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<ItemTypeMasterRecord>(`${BASE}/${id}/status`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      qc.invalidateQueries({ queryKey: ["lookups", "item-types"] });
    },
  });
}

export function useDeleteItemType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      qc.invalidateQueries({ queryKey: ["lookups", "item-types"] });
    },
  });
}

export function useImportItemTypes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, unknown>[]) =>
      customFetch<ItemTypeImportResult>(`${BASE}/import`, { method: "POST", body: JSON.stringify({ rows }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      qc.invalidateQueries({ queryKey: ["lookups", "item-types"] });
    },
  });
}
