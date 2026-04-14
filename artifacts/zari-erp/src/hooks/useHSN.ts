import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface HsnRecord {
  id: number;
  hsnCode: string;
  gstPercentage: string;
  govtDescription: string;
  remarks: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

interface HsnListResponse {
  data: HsnRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface HsnFormData {
  hsnCode: string;
  gstPercentage: string;
  govtDescription: string;
  remarks?: string;
  isActive: boolean;
}

function hsnKey(params: { search: string; page: number; limit: number }) {
  return ["hsn", params] as const;
}

export function useHSNList(params: { search: string; page: number; limit: number }) {
  return useQuery<HsnListResponse>({
    queryKey: hsnKey(params),
    queryFn: () => {
      const qs = new URLSearchParams({
        search: params.search,
        page: String(params.page),
        limit: String(params.limit),
      }).toString();
      return customFetch<HsnListResponse>(`/api/hsn?${qs}`);
    },
    placeholderData: (prev) => prev,
  });
}

export function useCreateHSN() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: HsnFormData) =>
      customFetch<HsnRecord>("/api/hsn", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hsn"] }),
  });
}

export function useUpdateHSN() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<HsnFormData> }) =>
      customFetch<HsnRecord>(`/api/hsn/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hsn"] }),
  });
}

export function useToggleHSNStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<HsnRecord>(`/api/hsn/${id}/status`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hsn"] }),
  });
}

export function useDeleteHSN() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ message: string; record: HsnRecord }>(`/api/hsn/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hsn"] }),
  });
}
