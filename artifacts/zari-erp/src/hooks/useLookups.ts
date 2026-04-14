import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface LookupRecord {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
}

function lookupKey(type: string) {
  return ["lookups", type] as const;
}

function useLookupList(type: string) {
  return useQuery<LookupRecord[]>({
    queryKey: lookupKey(type),
    queryFn: () => customFetch<LookupRecord[]>(`/api/lookups/${type}`),
    staleTime: 30_000,
  });
}

function useCreateLookup(type: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; isActive: boolean }) =>
      customFetch<LookupRecord>(`/api/lookups/${type}`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: lookupKey(type) }),
  });
}

export function useItemTypes() { return useLookupList("item-types"); }
export function useUnitTypes() { return useLookupList("unit-types"); }
export function useWidthUnitTypes() { return useLookupList("width-unit-types"); }

export function useCreateItemType() { return useCreateLookup("item-types"); }
export function useCreateUnitType() { return useCreateLookup("unit-types"); }
export function useCreateWidthUnitType() { return useCreateLookup("width-unit-types"); }
