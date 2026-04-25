import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface WarehouseLocation {
  id: number;
  name: string;
  code: string;
  city: string | null;
  isActive: boolean;
}

export function useWarehouseLocations() {
  return useQuery<WarehouseLocation[]>({
    queryKey: ["warehouse-locations"],
    queryFn: async () => {
      const res = await customFetch("/api/settings/warehouses");
      return Array.isArray(res) ? res : (res?.data ?? []);
    },
    staleTime: 1000 * 60 * 5,
  });
}
