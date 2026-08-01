import { useMyPermissions } from "@/hooks/useMyPermissions";

export function useFormAccess(basePermission: string) {
  const { can } = useMyPermissions();

  const canEdit   = can(`${basePermission}:add_edit`);
  const canDelete = can(`${basePermission}:delete`);
  const canView   = can(`${basePermission}:view`);

  return { canEdit, canDelete, canView };
}