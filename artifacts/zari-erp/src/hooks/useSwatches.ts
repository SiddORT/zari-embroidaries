import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type SwatchAttachment = { name: string; type: string; data: string; size: number };
export type MediaItem = { url: string; type: "image" | "video"; name: string; };

export type SwatchRecord = {
  id: number; swatchCode: string; swatchName: string;
  client: string | null; swatchCategory: string | null;
  fabric: string | null; location: string | null; swatchDate: string | null;
  length: string | null; width: string | null; unitType: string | null;
  hours: string | null; attachments: SwatchAttachment[] | null;
  wipMedia: MediaItem[] | null; finalMedia: MediaItem[] | null;
  colorName: string | null; hexCode: string | null; finishType: string | null;
  gsm: string | null; approvalStatus: string; remarks: string | null;
  isActive: boolean; isDeleted: boolean; createdBy: string; createdAt: string;
  updatedBy: string | null; updatedAt: string | null;
};

export type SwatchFormData = {
  client: string;
  swatchName: string;
  swatchCategory: string;
  fabric: string;
  location: string;
  swatchDate: string;
  length: string;
  width: string;
  unitType: string;
  hours: string;
  attachments: SwatchAttachment[];
  isActive: boolean;
};

export type SwatchImportResult = {
  succeeded: number;
  failed: number;
  results: { row: number; status: "success" | "error"; swatchCode?: string; errors?: string[] }[];
};

export type StatusFilter = "all" | "active" | "inactive";

const BASE = "/api/swatches";
const QK = "swatches";

export function useSwatchList(p: {
  search: string; status: StatusFilter;
  client: string; location: string; swatchCategory: string;
  page: number; limit: number;
}) {
  return useQuery({
    queryKey: [QK, p],
    queryFn: () => {
      const qs = new URLSearchParams({
        search: p.search, status: p.status,
        client: p.client, location: p.location, swatchCategory: p.swatchCategory,
        page: String(p.page), limit: String(p.limit),
      }).toString();
      return customFetch<{ data: SwatchRecord[]; total: number; page: number; limit: number }>(`${BASE}?${qs}`);
    },
    placeholderData: (prev) => prev,
  });
}

export function useAllSwatches() {
  return useQuery({ queryKey: [QK, "all"], queryFn: () => customFetch<SwatchRecord[]>(`${BASE}/all`) });
}

export type SwatchRefOption = {
  id: string;
  code: string;
  name: string;
  client: string;
  source: "master" | "order";
};

export function useSwatchesForReference() {
  return useQuery({
    queryKey: [QK, "for-reference"],
    queryFn: () => customFetch<SwatchRefOption[]>(`${BASE}/for-reference`),
    staleTime: 30_000,
  });
}

export function useSwatch(id: number | null) {
  return useQuery({
    queryKey: [QK, "detail", id],
    queryFn: () => customFetch<SwatchRecord>(`${BASE}/${id}`),
    enabled: id !== null,
  });
}

export async function fetchAllSwatchesForExport(params: {
  search: string; status: string; client: string; location: string; swatchCategory: string;
}): Promise<SwatchRecord[]> {
  const qs = new URLSearchParams(params).toString();
  return customFetch<SwatchRecord[]>(`${BASE}/export-all?${qs}`);
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

export function useImportSwatches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, unknown>[]) =>
      customFetch<SwatchImportResult>(`${BASE}/import`, { method: "POST", body: JSON.stringify(rows) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
