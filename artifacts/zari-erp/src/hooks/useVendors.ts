import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface BankAccount {
  bankName: string;
  accountNo: string;
  ifscCode: string;
}

export interface PaymentAttachment {
  name: string;
  type: string;
  data: string;
  size: number;
}

export interface VendorAddress {
  id: string;
  type: "Home" | "Warehouse" | "Office" | "Factory" | "Other";
  name: string;
  contactNo: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isBillingDefault: boolean;
}

export type VendorRecord = {
  id: number; vendorCode: string; brandName: string; contactName: string;
  email: string | null; altEmail: string | null; contactNo: string | null; altContactNo: string | null;
  country: string | null;
  hasGst: boolean; gstNo: string | null;
  bankName: string | null; accountNo: string | null; ifscCode: string | null;
  bankAccounts: BankAccount[] | null;
  address1: string | null; address2: string | null; pincode: string | null;
  state: string | null; city: string | null;
  addresses: VendorAddress[] | null;
  paymentAttachments: PaymentAttachment[] | null;
  isActive: boolean; isDeleted: boolean;
  createdBy: string; createdAt: string; updatedBy: string | null; updatedAt: string | null;
};

export type VendorFormData = {
  brandName: string;
  contactName: string;
  email: string;
  altEmail: string;
  contactNo: string;
  altContactNo: string;
  country: string;
  hasGst: boolean;
  gstNo: string;
  bankAccounts: BankAccount[];
  address1: string;
  address2: string;
  pincode: string;
  state: string;
  city: string;
  addresses: VendorAddress[];
  paymentAttachments: PaymentAttachment[];
  isActive: boolean;
};

export interface VendorImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; name: string; error: string }[];
}

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

export async function fetchAllVendorsForExport(search: string, status: StatusFilter): Promise<VendorRecord[]> {
  const qs = new URLSearchParams({ search, status }).toString();
  const result = await customFetch<{ data: VendorRecord[] }>(`${BASE}/export-all?${qs}`);
  return result.data;
}

export function useAllVendors() {
  return useQuery({ queryKey: [QK, "all"], queryFn: () => customFetch<VendorRecord[]>(`${BASE}/all`) });
}

export function useVendor(id: number | null) {
  return useQuery({
    queryKey: [QK, id],
    queryFn: () => customFetch<VendorRecord>(`${BASE}/${id}`),
    enabled: id !== null && id > 0,
  });
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

export function useImportVendors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: { brandName: string; contactName: string; email?: string; contactNo?: string; country?: string }[]) =>
      customFetch<VendorImportResult>(`${BASE}/import`, { method: "POST", body: JSON.stringify(rows) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
