import ZariButton from "@/components/ui/ZariButton";
import { Plus } from "lucide-react";
import { useMyPermissions } from "@/hooks/useMyPermissions";

interface MasterHeaderProps {
  title: string;
  onAdd: () => void;
  addLabel?: string;
  addPermission?: string; // e.g. "masters:vendors:add_edit"
}

export default function MasterHeader({ title, onAdd, addLabel = "Add", addPermission }: MasterHeaderProps) {
  const { can } = useMyPermissions();

  const showAdd = addPermission ? can(addPermission) : true;

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage {title.toLowerCase()} records</p>
      </div>
      {showAdd && (
        <ZariButton onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {addLabel}
        </ZariButton>
      )}
    </div>
  );
}
