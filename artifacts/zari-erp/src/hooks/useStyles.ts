import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type MediaItem = { url: string; type: "image" | "video"; name: string; };

export type StyleRecord = {
  id: number; client: string; styleNo: string; invoiceNo: string | null;
  description: string | null; attachLink: string | null; placeOfIssue: string | null;
  vendorPoNo: string | null; shippingDate: string | null; styleCategory: string;
  referenceSwatchId: string | null;
  wipMedia: MediaItem[] | null; finalMedia: MediaItem[] | null;
  isActive: boolean; isDeleted: boolean;
  createdBy: string; createdAt: string; updatedBy: string | null; updatedAt: string | null;
};

export type StyleFormData = {
  client: string; styleNo: string; invoiceNo: string; description: string;
  attachLink: string; placeOfIssue: string; vendorPoNo: string; shippingDate: string;
  isActive: boolean;
};

export type StatusFilter = "all" | "active" | "inactive";

const BASE = "/api/styles";
const QK = "styles";

export function useStyleList(p: { search: string; status: StatusFilter; client: string; location: string; page: number; limit: number }) {
  return useQuery({
    queryKey: [QK, p],
    queryFn: () => customFetch<{ data: StyleRecord[]; total: number; page: number; limit: number }>(
      `${BASE}?search=${encodeURIComponent(p.search)}&status=${p.status}&client=${encodeURIComponent(p.client)}&location=${encodeURIComponent(p.location)}&page=${p.page}&limit=${p.limit}`),
    placeholderData: (prev) => prev,
  });
}

export type StyleRefOption = {
  id: string;       // plain numeric string for masters; "sto:<n>" for style orders
  code: string;     // styleNo or orderCode
  name: string;     // description or styleName
  client: string;
  source: "master" | "order";
};

export function useStylesForReference() {
  return useQuery({
    queryKey: [QK, "for-reference"],
    queryFn: () => customFetch<StyleRefOption[]>(`${BASE}/for-reference`),
    staleTime: 30_000,
  });
}

export function useCreateStyle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StyleFormData) => customFetch<StyleRecord>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateStyle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<StyleFormData> }) =>
      customFetch<StyleRecord>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useToggleStyleStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<StyleRecord>(`${BASE}/${id}/status`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeleteStyle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
