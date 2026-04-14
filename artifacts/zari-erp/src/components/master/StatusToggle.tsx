interface StatusToggleProps {
  isActive: boolean;
  onToggle: () => void;
  loading?: boolean;
}

export default function StatusToggle({ isActive, onToggle, loading = false }: StatusToggleProps) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      title={isActive ? "Click to deactivate" : "Click to activate"}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-60 ${
        isActive
          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-gray-400"}`}
      />
      {isActive ? "Active" : "Inactive"}
    </button>
  );
}
