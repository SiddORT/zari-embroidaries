import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface WarehouseLocation {
  id: number;
  name: string;
  code: string;
  city: string | null;
  isActive: boolean;
}

function normalizeWarehouse(r: any): WarehouseLocation {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    city: r.city ?? null,
    isActive: r.isActive ?? r.is_active ?? true,
  };
}

export function useWarehouseLocations() {
  return useQuery({
    queryKey: ["warehouse-locations"],
    queryFn: async () => {
      const res = await customFetch("/api/settings/warehouses") as any;
      return Array.isArray(res) ? res : (res?.data ?? []);
    },
    select: (rows: any[]): WarehouseLocation[] => rows.map(normalizeWarehouse),
    staleTime: 1000 * 60 * 5,
  });
}
