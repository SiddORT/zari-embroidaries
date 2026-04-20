import { Package } from "lucide-react";

export default function PackingLists() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-blue-50">
        <Package className="h-8 w-8 text-blue-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Packing Lists</h1>
      <p className="text-gray-500 max-w-sm">
        Packing list management is coming soon. You'll be able to create and track packing lists for shipments here.
      </p>
    </div>
  );
}
