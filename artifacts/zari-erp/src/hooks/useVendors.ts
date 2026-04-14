import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type VendorRecord = {
  id: number; vendorCode: string; brandName: string; contactName: string;
  email: string | null; altEmail: string | null; contactNo: string | null; altContactNo: string | null;
  hasGst: boolean; gstNo: string | null; bankName: string | null; accountNo: string | null; ifscCode: string | null;
  address1: string | null; address2: string | null; country: string | null; state: string | null;
  city: string | null; pincode: string | null; isActive: boolean; isDeleted: boolean;
  createdBy: string; createdAt: string; updatedBy: string | null; updatedAt: string | null;
};

export type VendorFormData = {
  brandName: string; contactName: string; email: string; altEmail: string; contactNo: string;
  altContactNo: string; hasGst: boolean; gstNo: string; bankName: string; accountNo: string; ifscCode: string;
  address1: string; address2: string; country: string; state: string; city: string; pincode: string; isActive: boolean;
};

export type StatusFilter = "all" | "active" | "inactive";

const BASE = "/api/vendors";
const QK = "vendors";

export function useVendorList(p: { search: string; status: StatusFilter; page: number; limit: number }) {
  return useQuery({
    queryKey: [QK, p],
    queryFn: () => customFetch<{ data: VendorRecord[]; total: number; page: number; limit: number }>(
      `${BASE}?search=${encodeURIComponent(p.search)}&status=${p.status}&page=${p.page}&limit=${p.limit}`),
    placeholderData: (prev) => prev,
  });
}

export function useAllVendors() {
  return useQuery({ queryKey: [QK, "all"], queryFn: () => customFetch<VendorRecord[]>(`${BASE}/all`) });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: VendorFormData) => customFetch<VendorRecord>(BASE, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<VendorFormData> }) =>
      customFetch<VendorRecord>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useToggleVendorStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<VendorRecord>(`${BASE}/${id}/status`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeleteVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
