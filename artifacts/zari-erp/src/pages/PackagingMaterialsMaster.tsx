import { useState, useEffect, useRef } from "react";
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
import SearchableSelect from "@/components/ui/SearchableSelect";
import AddableSelect from "@/components/ui/AddableSelect";

import {
  usePackagingMaterialList, useCreatePackagingMaterial, useUpdatePackagingMaterial,
  useTogglePackagingMaterialStatus, useDeletePackagingMaterial,
  useDepartments, useAddDepartment,
  type PackagingMaterialRecord, type PackagingMaterialFormData, type StatusFilter,
} from "@/hooks/usePackagingMaterials";
import { useUnitTypes } from "@/hooks/useLookups";
import { useAllVendors, type VendorRecord } from "@/hooks/useVendors";

const ITEM_TYPE_OPTIONS = ["Packaging Material", "Asset Inventory", "Stationary"];
const LOCATION_OPTIONS = ["In-house", "Outsource"];
const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];
const EMPTY_FORM: PackagingMaterialFormData = {
  itemType: "", itemName: "", department: "", size: "", unitType: "",
  unitPrice: "", vendor: "", location: "", isActive: true,
};
type FormErrors = Partial<Record<keyof PackagingMaterialFormData, string>>;
const asPM = (r: TableRow) => r as unknown as PackagingMaterialRecord;

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const SELECT_CLS = "border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900";

interface AddDeptModalProps { open: boolean; onClose: () => void; onAdd: (name: string) => Promise<void>; adding: boolean; }

function AddDeptModal({ open, onClose, onAdd, adding }: AddDeptModalProps) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setName(""); setErr(""); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);
  if (!open) return null;
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Department name is required"); return; }
    try { await onAdd(name.trim()); setName(""); onClose(); }
    catch { setErr("Department already exists or failed to add"); }
  }
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Add Department</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Department name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 mb-1" />
          {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={adding}
              className="px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: "#C9B45C" }}>
              {adding ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PackagingMaterialsMaster() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ enabled: !!token });
  useEffect(() => { if (!token || (!loadingUser && !user)) setLocation("/login"); }, [token, user, loadingUser, setLocation]);
  const logoutMutation = useLogout();
  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync({}); } finally {
      localStorage.removeItem("zarierp_token");
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/login");
    }
  };

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [filterItemType, setFilterItemType] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<PackagingMaterialRecord | null>(null);
  const [form, setForm] = useState<PackagingMaterialFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [addDeptOpen, setAddDeptOpen] = useState(false);

  const { data, isLoading } = usePackagingMaterialList({
    search, status, itemType: filterItemType, department: filterDept, vendor: filterVendor, location: filterLocation, page, limit,
  });
  const { data: deptData } = useDepartments();
  const { data: unitTypesData } = useUnitTypes();
  const { data: vendorsData } = useAllVendors();

  const createMutation = useCreatePackagingMaterial();
  const updateMutation = useUpdatePackagingMaterial();
  const toggleStatus = useTogglePackagingMaterialStatus();
  const deleteMutation = useDeletePackagingMaterial();
  const addDeptMutation = useAddDepartment();

  function openCreate() { setEditRecord(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true); }
  function openEdit(r: PackagingMaterialRecord) {
    setEditRecord(r);
    setForm({
      itemType: r.itemType ?? "", itemName: r.itemName, department: r.department ?? "", size: r.size ?? "",
      unitType: r.unitType ?? "", unitPrice: r.unitPrice ?? "",
      vendor: r.vendor ?? "", location: r.location ?? "", isActive: r.isActive,
    });
    setErrors({}); setModalOpen(true);
  }
  function validate() {
    const e: FormErrors = {};
    if (!form.itemName.trim()) e.itemName = "Item Name is required";
    setErrors(e); return Object.keys(e).length === 0;
  }
  async function handleSubmit() {
    if (!validate()) return;
    try {
      if (editRecord) { await updateMutation.mutateAsync({ id: editRecord.id, data: form }); toast({ title: "Item updated" }); }
      else { await createMutation.mutateAsync(form); toast({ title: "Item created" }); }
      setModalOpen(false);
    } catch (err: unknown) { toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" }); }
  }
  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId); setDeleteId(null); toast({ title: "Item deleted" });
  }
  async function handleAddDept(name: string) {
    await addDeptMutation.mutateAsync(name);
    setForm(f => ({ ...f, department: name }));
  }

  const rows: TableRow[] = ((data?.data ?? []) as PackagingMaterialRecord[]).map((r, i) => ({
    ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1,
  }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No" },
    { key: "itemCode", label: "Item Code", render: (r) => <span className="font-mono text-xs font-semibold text-gray-700">{asPM(r).itemCode}</span> },
    { key: "itemType", label: "Item Type", render: (r) => asPM(r).itemType || "—" },
    { key: "itemName", label: "Item Name", render: (r) => asPM(r).itemName },
    { key: "department", label: "Department", render: (r) => asPM(r).department || "—" },
    { key: "size", label: "Size", render: (r) => asPM(r).size || "—" },
    { key: "unitType", label: "Unit Type", render: (r) => asPM(r).unitType || "—" },
    { key: "unitPrice", label: "Unit Price", render: (r) => asPM(r).unitPrice ? `₹${asPM(r).unitPrice}` : "—" },
    { key: "vendor", label: "Vendor", render: (r) => asPM(r).vendor || "—" },
    { key: "location", label: "Location", render: (r) => asPM(r).location || "—" },
    { key: "isActive", label: "Status", render: (r) => <StatusToggle isActive={asPM(r).isActive} onToggle={() => toggleStatus.mutate(asPM(r).id)} /> },
    { key: "createdBy", label: "Created By", render: (r) => asPM(r).createdBy },
    { key: "createdAt", label: "Created At", render: (r) => formatDate(asPM(r).createdAt) },
    { key: "updatedBy", label: "Updated By", render: (r) => asPM(r).updatedBy || "—" },
    { key: "updatedAt", label: "Updated At", render: (r) => formatDate(asPM(r).updatedAt) },
    {
      key: "actions", label: "Actions", render: (r) => {
        const rec = asPM(r);
        return (
          <div className="flex gap-2">
            <button onClick={() => openEdit(rec)} className="p-1 rounded hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
            <button onClick={() => setDeleteId(rec.id)} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
          </div>
        );
      },
    },
  ];

  const exportColumns: ExportColumn[] = [
    { key: "itemCode", label: "Item Code" },
    { key: "itemType", label: "Item Type" },
    { key: "itemName", label: "Item Name" },
    { key: "department", label: "Department" },
    { key: "size", label: "Size" },
    { key: "unitType", label: "Unit Type" },
    { key: "unitPrice", label: "Unit Price" },
    { key: "vendor", label: "Vendor" },
    { key: "location", label: "Location" },
    { key: "createdBy", label: "Created By" },
    { key: "createdAt", label: "Created At" },
  ];

  const deptOptions = (deptData ?? []).map(d => ({ value: d.name, label: d.name }));
  const unitTypeOptions = (unitTypesData ?? []).map(u => u.name);
  const vendorOptions = ((vendorsData ?? []) as VendorRecord[]).map(v => v.brandName);

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Item Master" onAdd={openCreate} addLabel="Add Item" />

        {/* Row 1: search + export */}
        <div className="flex items-center gap-3">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by item name or code…" className="flex-1" />
          <ExportExcelButton data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={exportColumns} filename="item-master" />
        </div>

        {/* Row 2: filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filterItemType} onChange={(e) => { setFilterItemType(e.target.value); setPage(1); }} className={SELECT_CLS}>
            <option value="">All Item Types</option>
            {ITEM_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setPage(1); }} className={SELECT_CLS}>
            <option value="">All Departments</option>
            {deptOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filterVendor} onChange={(e) => { setFilterVendor(e.target.value); setPage(1); }} className={SELECT_CLS}>
            <option value="">All Vendors</option>
            {vendorOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={filterLocation} onChange={(e) => { setFilterLocation(e.target.value); setPage(1); }} className={SELECT_CLS}>
            <option value="">All Locations</option>
            {LOCATION_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }} className={SELECT_CLS}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={(row) => (row as unknown as { id: number }).id}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }} />

        <MasterFormModal open={modalOpen} onClose={() => setModalOpen(false)} size="xl"
          title={editRecord ? "Edit Item" : "Add Item"}
          onSubmit={handleSubmit} submitting={createMutation.isPending || updateMutation.isPending}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0">
            {/* Item Code — read only */}
            <div className="flex flex-col gap-1 py-2">
              <label className="text-sm font-medium text-gray-700">Item Code</label>
              <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 font-mono">
                {editRecord ? editRecord.itemCode : "Auto-generated"}
              </div>
            </div>
            <div className="flex flex-col gap-1 py-2">
              <label className="text-sm font-medium text-gray-700">Item Type</label>
              <select value={form.itemType} onChange={(e) => setForm(f => ({ ...f, itemType: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Select item type</option>
                {ITEM_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <InputField label="Item Name" value={form.itemName} onChange={(e) => setForm(f => ({ ...f, itemName: e.target.value }))}
              error={errors.itemName} required placeholder="e.g. Box 10x10" />
            <div className="py-2">
              <AddableSelect label="Department" value={form.department}
                onChange={(v) => setForm(f => ({ ...f, department: v }))}
                options={deptOptions} placeholder="Select department"
                onAdd={() => setAddDeptOpen(true)} addLabel="+ Add Department" />
            </div>
            <InputField label="Size" value={form.size} onChange={(e) => setForm(f => ({ ...f, size: e.target.value }))} placeholder="e.g. 10x10 cm" />
            <div className="py-2">
              <SearchableSelect label="Unit Type" value={form.unitType} onChange={(v) => setForm(f => ({ ...f, unitType: v }))}
                options={unitTypeOptions} placeholder="Select unit type" />
            </div>
            <InputField label="Unit Price" value={form.unitPrice} onChange={(e) => setForm(f => ({ ...f, unitPrice: e.target.value }))} placeholder="0.00" type="number" />
            <div className="py-2">
              <SearchableSelect label="Vendor" value={form.vendor} onChange={(v) => setForm(f => ({ ...f, vendor: v }))}
                options={vendorOptions} placeholder="Select vendor" />
            </div>
            <div className="flex flex-col gap-1 py-2">
              <label className="text-sm font-medium text-gray-700">Location</label>
              <select value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Select location</option>
                {LOCATION_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <label className="text-sm font-medium text-gray-700">Active</label>
            <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </MasterFormModal>

        <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
          title="Delete Item" message="Are you sure you want to delete this item?" />

        <AddDeptModal open={addDeptOpen} onClose={() => setAddDeptOpen(false)}
          onAdd={handleAddDept} adding={addDeptMutation.isPending} />
      </div>
    </AppLayout>
  );
}
