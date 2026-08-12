import { useMemo } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useRoles } from "./useUserManagement";

const SUPERUSER_EMAIL = "admin@zarierp";

export function useMyPermissions() {
  const { data: meData, isLoading: isLoadingMe } = useGetMe();
  const { data: rolesData, isLoading: isLoadingRoles } = useRoles();

  const me = (meData as any)?.data ?? meData;
  const myRole: string = me?.role ?? "";
  const myEmail: string = me?.email ?? "";
  const isAdmin = myRole === "admin" || (Boolean(myEmail) && myEmail.startsWith(SUPERUSER_EMAIL));

  const myPermSet = useMemo<Set<string> | null>(() => {
    if (isAdmin) return null;
    if (!rolesData?.data) return null;
    const role = rolesData.data.find((r) => r.name === myRole);
    return role ? new Set(role.permissions ?? []) : new Set<string>();
  }, [isAdmin, myRole, rolesData?.data]);

  const isLoading = isLoadingMe || isLoadingRoles;

  function can(permKey: string): boolean {
    if (isAdmin) return true;
    if (!myPermSet) return false;
    if (myPermSet.has(permKey)) return true;

    // If permKey has action suffix (e.g., "masters:materials:view"), check base key "masters:materials"
    const baseKey = permKey.replace(/:(view|add_edit|delete|download)$/, "");
    if (baseKey !== permKey && myPermSet.has(baseKey)) return true;

    // If permKey is base key (e.g., "masters:materials"), check if user has any action permission under it
    const hasAnyChildPerm = Array.from(myPermSet).some((p) =>
      p === permKey || p.startsWith(`${permKey}:`)
    );
    if (hasAnyChildPerm) return true;

    return false;
  }

  function hasTabPermission(tabKey: string): boolean {
    if (isAdmin) return true;
    if (!myPermSet) return false;
    const prefix = tabKey.replace(/:tab:.*$/, "");
    const hasAnyTabPerm = Array.from(myPermSet).some((p) =>
      p.startsWith(`${prefix}:tab:`)
    );
    if (!hasAnyTabPerm) return false;
    return myPermSet.has(tabKey);
  }

  function getModuleAccess(basePermission?: string) {
    if (!basePermission) {
      return {
        canView: true,
        canEdit: true,
        canDelete: true,
        canDownload: true,
      };
    }

    return {
      canView: can(`${basePermission}:view`),
      canEdit: can(`${basePermission}:add_edit`),
      canDelete: can(`${basePermission}:delete`),
      canDownload: can(`${basePermission}:download`),
    };
  }

  return { hasTabPermission, can, isAdmin, isLoading, getModuleAccess };
}
