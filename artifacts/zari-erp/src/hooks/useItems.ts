import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface ItemImage {
  id: string;
  name: string;
  data: string;
  size: number;
}

export interface ItemLocationStock {
  location: string;
  stock: string;
}

export interface ItemRecord {
  id: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  description: string | null;
  unitType: string;
  unitPrice: string;
  hsnCode: string | null;
  gstPercent: string | null;
  currentStock: string;
  locationStocks: ItemLocationStock[];
  images: ItemImage[];
  reorderLevel: string | null;
  minimumLevel: string | null;
  maximumLevel: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface ItemFormData {
  itemName: string;
  itemType: string;
  description: string;
  unitType: string;
  unitPrice: string;
  hsnCode: string;
  gstPercent: string;
  currentStock: string;
  locationStocks: ItemLocationStock[];
  images: ItemImage[];
  reorderLevel: string;
  minimumLevel: string;
  maximumLevel: string;
  isActive: boolean;
}

export interface ItemImportResult {
  succeeded: number;
  failed: number;
  results: { row: number; status: "success" | "error"; itemCode?: string; errors?: string[] }[];
}

export type StatusFilter = "all" | "active" | "inactive";

interface ItemListResponse {
  data: ItemRecord[];
  total: number;
  page: number;
  limit: number;
}

const BASE = "/api/items";
const QK = "items-master";

export function useItemList(p: { search: string; status: StatusFilter; page: number; limit: number }) {
  return useQuery({
    queryKey: [QK, p],
    queryFn: () => customFetch<ItemListResponse>(
      `${BASE}?search=${encodeURIComponent(p.search)}&status=${p.status}&page=${p.page}&limit=${p.limit}`
    ),
    placeholderData: (prev) => prev,
  });
}

export async function fetchAllItemsForExport(params: { search: string; status: string }): Promise<ItemRecord[]> {
  const qs = new URLSearchParams({ search: params.search, status: params.status }).toString();
  return customFetch<ItemRecord[]>(`${BASE}/export-all?${qs}`);
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ItemFormData) =>
      customFetch<ItemRecord>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ItemFormData> }) =>
      customFetch<ItemRecord>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useToggleItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<ItemRecord>(`${BASE}/${id}/status`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useImportItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, unknown>[]) =>
      customFetch<ItemImportResult>(`${BASE}/import`, { method: "POST", body: JSON.stringify({ rows }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
