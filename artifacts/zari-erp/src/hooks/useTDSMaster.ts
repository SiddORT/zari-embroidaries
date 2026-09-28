import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
// import { stringify } from "csv-stringify/sync";

// ----- Types -----
export interface TDSMasterRecord {
  id: number;
  serviceName: string;
  paymentNature: string;
  sectionCode: string;
  ratePercent: string;          // stored as string, e.g. "10.00"
  thresholdAmount: string;      // e.g. "50000.00"
  effectiveFrom: string;        // ISO date string
  effectiveTo: string | null;
  remarks: string | null;
  status: boolean;              // (not isActive)
  isDeleted: boolean;
  deletedBy: number | null;
  deletedAt: string | null;
  createdBy: number;            // user ID (number)
  createdAt: string;
  updatedBy: number | null;     // user ID or null
  updatedAt: string | null;

  // Nested user objects (for display)
  createdByUser: {
    id: number;
    username: string;
    email: string;
  };
  updatedByUser: {
    id: number;
    username: string;
    email: string;
  } | null;
  deletedByUser: {
    id: number;
    username: string;
    email: string;
  } | null;
}

interface TDSMasterListResponse {
  data: TDSMasterRecord[];
  totalRecords: number;
  totalPages: number;
  page: number;
  limit: number;
}

export interface TDSMasterFormData {
  serviceName: string;
  paymentNature: string;
  sectionCode: string;
  ratePercent: string;        // string from input (e.g. "10.00")
  thresholdAmount: string;    // string from input (e.g. "50000.00")
  effectiveFrom: string;      // YYYY-MM-DD
  effectiveTo: string | null;
  remarks: string;
  status: boolean;
}

export interface TDSMasterImportRow {
  serviceName: string;
  paymentNature: string;
  sectionCode: string;
  ratePercent: string | number;
  thresholdAmount: string | number;
  effectiveFrom: string;    
  effectiveTo?: string | null;
  remarks?: string | null;
  status?: boolean;        
}

export interface TDSMasterImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; serviceName: string; error: string }[];
}

export type StatusFilter = "all" | "active" | "inactive";

// ----- Query Key Factory -----
function tdsMasterKey(params: { search: string; status: StatusFilter; page: number; limit: number }) {
  return ["tdsMaster", params] as const;
}

// ----- List Hook -----
export function useTDSMasterList(params: {
  search: string;
  status: StatusFilter;
  page: number;
  limit: number;
}) {
  return useQuery<TDSMasterListResponse>({
    queryKey: tdsMasterKey(params),
    queryFn: () => {
      const qs = new URLSearchParams({
        search: params.search,
        status: params.status,
        page: String(params.page),
        limit: String(params.limit),
      }).toString();
      return customFetch<TDSMasterListResponse>(`/api/tds-master?${qs}`);
    },
    placeholderData: (prev) => prev,
  });
}

// ----- Export All (for Excel) -----
export async function fetchAllTDSMasterForExport(
  search: string,
  status: StatusFilter
): Promise<TDSMasterRecord[]> {
  const qs = new URLSearchParams({ search, status }).toString();
  const result = await customFetch<{ data: TDSMasterRecord[] }>(
    `/api/tds-master/export-all?${qs}`
  );
  return result.data;
}

// ----- Create -----
export function useCreateTDSMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TDSMasterFormData) =>
      customFetch<TDSMasterRecord>("/api/tds-master", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tdsMaster"] }),
  });
}

// ----- Update -----
export function useUpdateTDSMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TDSMasterFormData> }) =>
      customFetch<TDSMasterRecord>(`/api/tds-master/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tdsMaster"] }),
  });
}

// ----- Toggle Status -----
export function useToggleTDSMasterStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<TDSMasterRecord>(`/api/tds-master/${id}/status`, {
        method: "PATCH",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tdsMaster"] }),
  });
}

// ----- Delete -----
export function useDeleteTDSMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ message: string; record: TDSMasterRecord }>(
        `/api/tds-master/${id}`,
        { method: "DELETE" }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tdsMaster"] }),
  });
}

export async function fetchAllTDSForExport(
  search: string,
  status: StatusFilter
): Promise<TDSMasterRecord[]> {
  const qs = new URLSearchParams({ search, status }).toString();
  const result = await customFetch<{ data: TDSMasterRecord[] }>(
    `/api/tds-master/export?${qs}`
  );
  return result.data;
}

export function useImportTDSMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: TDSMasterImportRow[]) =>
      customFetch<TDSMasterImportResult>("/api/tds-master/import", {
        method: "POST",
        body: JSON.stringify(rows),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tdsMaster"] }),
  });
}
