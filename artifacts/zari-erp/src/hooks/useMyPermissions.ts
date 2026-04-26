import { useMemo } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useRoles } from "./useUserManagement";

const SUPERUSER_EMAIL = "admin@zarierp";

export function useMyPermissions() {
  const { data: meData } = useGetMe();
  const { data: rolesData } = useRoles();

  const me = (meData as any)?.data ?? meData;
  const myRole: string = me?.role ?? "";
  const myEmail: string = me?.email ?? "";
  const isAdmin = myRole === "admin" || myEmail.startsWith(SUPERUSER_EMAIL);

  const myPermSet = useMemo<Set<string> | null>(() => {
    if (isAdmin) return null;
    const role = rolesData?.data?.find((r) => r.name === myRole);
    return role ? new Set(role.permissions) : new Set<string>();
  }, [isAdmin, myRole, rolesData?.data]);

  function hasTabPermission(tabKey: string): boolean {
    if (isAdmin || myPermSet === null) return true;
    const prefix = tabKey.replace(/:tab:.*$/, "");
    const hasAnyTabPerm = Array.from(myPermSet).some((p) =>
      p.startsWith(`${prefix}:tab:`)
    );
    if (!hasAnyTabPerm) return true;
    return myPermSet.has(tabKey);
  }

  return { hasTabPermission, isAdmin };
}
