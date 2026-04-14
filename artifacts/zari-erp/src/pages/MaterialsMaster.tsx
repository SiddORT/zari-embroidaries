import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import AppLayout from "@/components/layout/AppLayout";
import MasterHeader from "@/components/master/MasterHeader";
import SearchBar from "@/components/master/SearchBar";
import MasterTable, { type Column, type TableRow } from "@/components/master/MasterTable";
import MasterFormModal from "@/components/master/MasterFormModal";
import StatusToggle from "@/components/master/StatusToggle";
import ExportExcelButton, { type ExportColumn } from "@/components/master/ExportExcelButton";
import InputField from "@/components/ui/InputField";
import ConfirmModal from "@/components/ui/ConfirmModal";
import AddableSelect from "@/components/ui/AddableSelect";
import SearchableSelect from "@/components/ui/SearchableSelect";

import {
  useMaterialList,
  useCreateMaterial,
  useUpdateMaterial,
  useToggleMaterialStatus,
  useDeleteMaterial,
  type MaterialRecord,
  type MaterialFormData,
  type StatusFilter,
} from "@/hooks/useMaterials";
import { useItemTypes, useUnitTypes, useCreateItemType, useCreateUnitType } from "@/hooks/useLookups";
import { useHSNList, useCreateHSN, type HsnFormData } from "@/hooks/useHSN";
import { useAllVendors } from "@/hooks/useVendors";

const EMPTY_FORM: MaterialFormData = {
  itemType: "", quality: "", type: "", color: "#c9b45c", hexCode: "#c9b45c",
  colorName: "", size: "", unitPrice: "", unitType: "", currentStock: "",
  hsnCode: "", gstPercent: "", vendor: "", location: "", isActive: true,
};

type FormErrors = Partial<Record<keyof MaterialFormData, string>>;

const EMPTY_HSN_FORM: HsnFormData = { hsnCode: "", gstPercentage: "", govtDescription: "", isActive: true };
type HsnErrors = Partial<Record<keyof HsnFormData, string>>;

const GST_OPTIONS = [
  { value: "0", label: "0%" }, { value: "5", label: "5%" },
  { value: "12", label: "12%" }, { value: "18", label: "18%" },
  { value: "28", label: "28%" },
];

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" },
];

const LOCATION_OPTIONS = ["In-house", "Outhouse"];

export default function MaterialsMaster() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ enabled: !!token });
  useEffect(() => { if (!token || (!loadingUser && !user)) setLocation("/login"); }, [token, user, loadingUser, setLocation]);

  const logoutMutation = useLogout();
  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync({}); } finally {
      localStorage.removeItem("zarierp_token");
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/login");
    }
  };

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [hsnCodeFilter, setHsnCodeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  useEffect(() => { const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);
  const { data, isLoading } = useMaterialList({ search: debouncedSearch, status: statusFilter, hsnCode: hsnCodeFilter, type: typeFilter, vendor: vendorFilter, page, limit });
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const createMutation = useCreateMaterial();
  const updateMutation = useUpdateMaterial();
  const toggleMutation = useToggleMaterialStatus();
  const deleteMutation = useDeleteMaterial();

  const { data: itemTypes = [] } = useItemTypes();
  const { data: unitTypes = [] } = useUnitTypes();
  const createItemType = useCreateItemType();
  const createUnitType = useCreateUnitType();
  const createHSN = useCreateHSN();

  const { data: hsnData } = useHSNList({ search: "", status: "active", page: 1, limit: 200 });
  const { data: allVendors = [] } = useAllVendors();
  const hsnOptions = hsnData?.data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<MaterialRecord | null>(null);
  const [form, setForm] = useState<MaterialFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<MaterialRecord | null>(null);

  const [addItemTypeOpen, setAddItemTypeOpen] = useState(false);
  const [newItemTypeName, setNewItemTypeName] = useState("");
  const [addUnitTypeOpen, setAddUnitTypeOpen] = useState(false);
  const [newUnitTypeName, setNewUnitTypeName] = useState("");
  const [addHSNOpen, setAddHSNOpen] = useState(false);
  const [hsnForm, setHsnForm] = useState<HsnFormData>(EMPTY_HSN_FORM);
  const [hsnErrors, setHsnErrors] = useState<HsnErrors>({});

  const openAdd = () => { setEditRecord(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true); };
  const openEdit = (r: MaterialRecord) => {
    setEditRecord(r);
    setForm({ itemType: r.itemType, quality: r.quality, type: r.type ?? "", color: r.color ?? "#c9b45c",
      hexCode: r.hexCode ?? "#c9b45c", colorName: r.colorName, size: r.size, unitPrice: r.unitPrice,
      unitType: r.unitType, currentStock: r.currentStock, hsnCode: r.hsnCode, gstPercent: r.gstPercent,
      vendor: r.vendor ?? "", location: r.location ?? "", isActive: r.isActive });
    setErrors({});
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.itemType) e.itemType = "Item Type is required";
    if (!form.quality.trim()) e.quality = "Quality is required";
    if (!form.colorName.trim()) e.colorName = "Color Name is required";
    if (!form.size.trim()) e.size = "Size is required";
    if (!form.unitPrice.trim()) e.unitPrice = "Unit Price is required";
    if (!form.unitType) e.unitType = "Unit Type is required";
    if (!form.currentStock.trim()) e.currentStock = "Current Stock is required";
    if (!form.hsnCode) e.hsnCode = "HSN Code is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      if (editRecord) {
        await updateMutation.mutateAsync({ id: editRecord.id, data: form });
        toast({ title: "Updated", description: `Material ${editRecord.materialCode} updated.` });
      } else {
        await createMutation.mutateAsync(form);
        toast({ title: "Created", description: "New material created successfully." });
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "An error occurred.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleToggle = async (r: MaterialRecord) => {
    try {
      await toggleMutation.mutateAsync(r.id);
      toast({ title: "Status Updated", description: `${r.materialCode} is now ${r.isActive ? "Inactive" : "Active"}.` });
    } catch { toast({ title: "Error", description: "Failed to update status.", variant: "destructive" }); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({ title: "Deleted", description: `Material ${deleteTarget.materialCode} deleted.` });
      setDeleteTarget(null);
    } catch { toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }); }
  };

  const handleAddItemType = async () => {
    if (!newItemTypeName.trim()) return;
    try {
      await createItemType.mutateAsync({ name: newItemTypeName.trim(), isActive: true });
      setForm((f) => ({ ...f, itemType: newItemTypeName.trim() }));
      setNewItemTypeName("");
      setAddItemTypeOpen(false);
    } catch { toast({ title: "Error", description: "Failed to add item type.", variant: "destructive" }); }
  };

  const handleAddUnitType = async () => {
    if (!newUnitTypeName.trim()) return;
    try {
      await createUnitType.mutateAsync({ name: newUnitTypeName.trim(), isActive: true });
      setForm((f) => ({ ...f, unitType: newUnitTypeName.trim() }));
      setNewUnitTypeName("");
      setAddUnitTypeOpen(false);
    } catch { toast({ title: "Error", description: "Failed to add unit type.", variant: "destructive" }); }
  };

  const validateHSN = (): boolean => {
    const e: HsnErrors = {};
    if (!hsnForm.hsnCode.trim()) e.hsnCode = "HSN Code is required";
    if (!hsnForm.gstPercentage) e.gstPercentage = "GST % is required";
    if (!hsnForm.govtDescription.trim()) e.govtDescription = "Description is required";
    setHsnErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAddHSN = async () => {
    if (!validateHSN()) return;
    try {
      const created = await createHSN.mutateAsync(hsnForm);
      setForm((f) => ({ ...f, hsnCode: created.hsnCode, gstPercent: created.gstPercentage }));
      setHsnForm(EMPTY_HSN_FORM);
      setHsnErrors({});
      setAddHSNOpen(false);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to add HSN.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const asMat = (r: TableRow) => r as unknown as MaterialRecord;
  const itemTypeOptions = itemTypes.filter((t) => t.isActive).map((t) => ({ value: t.name, label: t.name }));
  const unitTypeOptions = unitTypes.filter((t) => t.isActive).map((t) => ({ value: t.name, label: t.name }));
  const hsnDropdownOptions = hsnOptions.map((h) => ({ value: h.hsnCode, label: `${h.hsnCode} (${h.gstPercentage}%)` }));

  const columns: Column[] = [
    {
      key: "srNo", label: "Sr No", className: "w-14 text-center",
      render: (r) => {
        const idx = rows.findIndex((row) => row.id === asMat(r).id);
        return <span className="text-gray-400 text-xs font-medium">{(page - 1) * limit + (idx === -1 ? 0 : idx) + 1}</span>;
      },
    },
    { key: "materialCode", label: "Code", render: (r) => <span className="font-mono font-semibold text-gray-900">{asMat(r).materialCode}</span> },
    { key: "itemType", label: "Type", render: (r) => <span className="text-gray-700">{asMat(r).itemType}</span> },
    { key: "quality", label: "Quality", render: (r) => <span className="text-gray-700">{asMat(r).quality}</span> },
    {
      key: "colorName", label: "Color Name",
      render: (r) => (
        <div className="flex items-center gap-2">
          {asMat(r).hexCode && (
            <span className="h-4 w-4 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: asMat(r).hexCode ?? undefined }} />
          )}
          <span className="text-gray-700">{asMat(r).colorName}</span>
        </div>
      ),
    },
    { key: "unitPrice", label: "Unit Price", render: (r) => <span className="font-medium">₹{asMat(r).unitPrice}</span> },
    { key: "unitType", label: "Unit Type", render: (r) => <span className="text-gray-500">{asMat(r).unitType}</span> },
    { key: "hsnCode", label: "HSN Code", render: (r) => <span className="font-mono text-gray-700">{asMat(r).hsnCode}</span> },
    { key: "gstPercent", label: "GST %", render: (r) => <span>{asMat(r).gstPercent}%</span> },
    { key: "currentStock", label: "Current Stock", render: (r) => <span className="font-medium">{asMat(r).currentStock}</span> },
    {
      key: "isActive", label: "Status",
      render: (r) => <StatusToggle isActive={asMat(r).isActive} onToggle={() => handleToggle(asMat(r))} loading={toggleMutation.isPending} />,
    },
    { key: "createdBy", label: "Created By", render: (r) => <span className="text-gray-500">{asMat(r).createdBy}</span> },
    { key: "createdAt", label: "Created At", render: (r) => <span className="text-gray-500 whitespace-nowrap">{formatDate(asMat(r).createdAt)}</span> },
    { key: "updatedBy", label: "Updated By", render: (r) => <span className="text-gray-500">{asMat(r).updatedBy ?? "—"}</span> },
    { key: "updatedAt", label: "Updated At", render: (r) => <span className="text-gray-500 whitespace-nowrap">{formatDate(asMat(r).updatedAt)}</span> },
    {
      key: "actions", label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEdit(asMat(r))} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteTarget(asMat(r))} disabled={deleteMutation.isPending} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const exportColumns: ExportColumn[] = [
    { key: "materialCode", label: "Code" }, { key: "itemType", label: "Type" }, { key: "quality", label: "Quality" },
    { key: "colorName", label: "Color Name" }, { key: "hexCode", label: "Hex Code" }, { key: "size", label: "Size" },
    { key: "unitPrice", label: "Unit Price" }, { key: "unitType", label: "Unit Type" },
    { key: "currentStock", label: "Current Stock" }, { key: "hsnCode", label: "HSN Code" },
    { key: "gstPercent", label: "GST %" }, { key: "vendor", label: "Vendor" }, { key: "location", label: "Location" },
    { key: "isActive", label: "Status" }, { key: "createdBy", label: "Created By" }, { key: "createdAt", label: "Created At" },
    { key: "updatedBy", label: "Updated By" }, { key: "updatedAt", label: "Updated At" },
  ];

  const submitting = createMutation.isPending || updateMutation.isPending;
  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Materials Master" onAdd={openAdd} addLabel="Add Material" />

        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by code, type, quality, color, HSN, vendor..." />
            </div>
            <ExportExcelButton data={rows as Record<string, unknown>[]} filename="Materials_Master" columns={exportColumns} disabled={isLoading} />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
              {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
              <option value="">All Types</option>
              {itemTypes.filter((t) => t.isActive).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
            <select value={hsnCodeFilter} onChange={(e) => { setHsnCodeFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
              <option value="">All HSN Codes</option>
              {hsnOptions.map((h) => <option key={h.hsnCode} value={h.hsnCode}>{h.hsnCode}</option>)}
            </select>
            <select value={vendorFilter} onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
              <option value="">All Vendors</option>
              {allVendors.map((v) => <option key={v.id} value={v.brandName}>{v.brandName}</option>)}
            </select>
            {(typeFilter || hsnCodeFilter || vendorFilter || statusFilter !== "all") && (
              <button
                onClick={() => { setTypeFilter(""); setHsnCodeFilter(""); setVendorFilter(""); setStatusFilter("all"); setPage(1); }}
                className="px-3 py-2 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <MasterTable
          columns={columns}
          rows={rows as unknown as TableRow[]}
          loading={isLoading}
          rowKey={(r) => asMat(r).id}
          emptyText="No materials found. Click 'Add Material' to create one."
          pagination={{ page, limit, total, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }}
        />
      </div>

      {/* Add / Edit Modal */}
      <MasterFormModal
        open={modalOpen}
        title={editRecord ? `Edit Material — ${editRecord.materialCode}` : "Add Material"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editRecord ? "Update" : "Create"}
        size="xl"
      >
        <div className="grid grid-cols-2 gap-4">
          <AddableSelect
            label="Item Type" required value={form.itemType}
            onChange={(v) => setForm((f) => ({ ...f, itemType: v }))}
            onAdd={() => { setNewItemTypeName(""); setAddItemTypeOpen(true); }}
            addLabel="+ Add Item Type"
            options={itemTypeOptions} placeholder="Select Item Type" error={errors.itemType}
          />
          <InputField label="Quality" required placeholder="e.g. Premium" value={form.quality}
            onChange={(e) => setForm((f) => ({ ...f, quality: e.target.value }))} error={errors.quality} />

          <InputField label="Type" placeholder="e.g. Raw Material" value={form.type ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} />

          {/* Color picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Color</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={form.hexCode || "#c9b45c"}
                onChange={(e) => setForm((f) => ({ ...f, hexCode: e.target.value, color: e.target.value }))}
                className="h-10 w-14 rounded-lg border border-gray-300 cursor-pointer p-0.5 shrink-0"
              />
              <input
                type="text"
                value={form.hexCode || ""}
                readOnly
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500"
                placeholder="#000000"
              />
            </div>
          </div>

          <InputField label="Color Name" required placeholder="e.g. Royal Blue" value={form.colorName}
            onChange={(e) => setForm((f) => ({ ...f, colorName: e.target.value }))} error={errors.colorName} />
          <InputField label="Size" required placeholder="e.g. 5x5 cm" value={form.size}
            onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} error={errors.size} />

          <InputField label="Unit Price (₹)" required placeholder="e.g. 250" type="number" value={form.unitPrice}
            onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} error={errors.unitPrice} />
          <AddableSelect
            label="Unit Type" required value={form.unitType}
            onChange={(v) => setForm((f) => ({ ...f, unitType: v }))}
            onAdd={() => { setNewUnitTypeName(""); setAddUnitTypeOpen(true); }}
            addLabel="+ Add Unit Type"
            options={unitTypeOptions} placeholder="Select Unit Type" error={errors.unitType}
          />

          <InputField label="Current Stock" required placeholder="e.g. 100" type="number" value={form.currentStock}
            onChange={(e) => setForm((f) => ({ ...f, currentStock: e.target.value }))} error={errors.currentStock} />
          <AddableSelect
            label="HSN Code" required value={form.hsnCode}
            onChange={(v) => {
              const hsn = hsnOptions.find((h) => h.hsnCode === v);
              setForm((f) => ({ ...f, hsnCode: v, gstPercent: hsn?.gstPercentage ?? f.gstPercent }));
            }}
            onAdd={() => { setHsnForm(EMPTY_HSN_FORM); setHsnErrors({}); setAddHSNOpen(true); }}
            addLabel="+ Add HSN"
            options={hsnDropdownOptions} placeholder="Select HSN" error={errors.hsnCode}
          />

          <SearchableSelect label="Vendor" value={form.vendor ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, vendor: v }))}
            options={allVendors.map(v => v.brandName)}
            placeholder="Select vendor" clearable />

          <SearchableSelect label="Location" value={form.location ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, location: v }))}
            options={LOCATION_OPTIONS} placeholder="Select location" clearable />

          <div className="flex items-center gap-3 pt-3">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <button type="button" onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}
              role="switch" aria-checked={form.isActive}>
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${form.isActive ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className={`text-sm ${form.isActive ? "text-emerald-600 font-medium" : "text-gray-400"}`}>{form.isActive ? "Active" : "Inactive"}</span>
          </div>
        </div>
      </MasterFormModal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Material"
        message={deleteTarget ? `Are you sure you want to delete material "${deleteTarget.materialCode}"? This action cannot be undone.` : ""}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />

      {/* Add Item Type mini-modal */}
      <MasterFormModal
        open={addItemTypeOpen}
        title="Add Item Type"
        onClose={() => setAddItemTypeOpen(false)}
        onSubmit={handleAddItemType}
        submitting={createItemType.isPending}
        submitLabel="Add"
      >
        <InputField label="Item Type Name" required placeholder="e.g. Thread" value={newItemTypeName}
          onChange={(e) => setNewItemTypeName(e.target.value)} />
      </MasterFormModal>

      {/* Add Unit Type mini-modal */}
      <MasterFormModal
        open={addUnitTypeOpen}
        title="Add Unit Type"
        onClose={() => setAddUnitTypeOpen(false)}
        onSubmit={handleAddUnitType}
        submitting={createUnitType.isPending}
        submitLabel="Add"
      >
        <InputField label="Unit Type Name" required placeholder="e.g. Meters" value={newUnitTypeName}
          onChange={(e) => setNewUnitTypeName(e.target.value)} />
      </MasterFormModal>

      {/* Add HSN mini-modal */}
      <MasterFormModal
        open={addHSNOpen}
        title="Add HSN Code"
        onClose={() => setAddHSNOpen(false)}
        onSubmit={handleAddHSN}
        submitting={createHSN.isPending}
        submitLabel="Add"
      >
        <InputField label="HSN Code" required placeholder="e.g. 63019090" value={hsnForm.hsnCode}
          onChange={(e) => setHsnForm((f) => ({ ...f, hsnCode: e.target.value }))} error={hsnErrors.hsnCode} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">GST Percentage<span className="text-red-500 ml-0.5">*</span></label>
          <div className="relative">
            <select value={hsnForm.gstPercentage}
              onChange={(e) => setHsnForm((f) => ({ ...f, gstPercentage: e.target.value }))}
              className={`w-full appearance-none rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 ${hsnErrors.gstPercentage ? "border-red-400" : ""}`}>
              <option value="">Select GST %</option>
              {GST_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {hsnErrors.gstPercentage && <p className="text-xs text-red-500">{hsnErrors.gstPercentage}</p>}
        </div>
        <InputField label="Government Description" required placeholder="Official description..." value={hsnForm.govtDescription}
          onChange={(e) => setHsnForm((f) => ({ ...f, govtDescription: e.target.value }))} error={hsnErrors.govtDescription} />
      </MasterFormModal>

    </AppLayout>
  );
}
