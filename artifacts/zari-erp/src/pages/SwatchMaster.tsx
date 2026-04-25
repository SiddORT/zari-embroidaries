import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Paperclip, X } from "lucide-react";
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
  useSwatchList, useCreateSwatch, useUpdateSwatch, useToggleSwatchStatus, useDeleteSwatch,
  type SwatchRecord, type SwatchFormData, type SwatchAttachment, type StatusFilter, type MediaItem,
} from "@/hooks/useSwatches";
import MediaUploadSection from "@/components/ui/MediaUploadSection";
import { useAllFabrics } from "@/hooks/useFabrics";
import { useUnitTypes, useSwatchCategories, useCreateSwatchCategory, useCreateUnitType } from "@/hooks/useLookups";
import { useAllClients, type ClientRecord } from "@/hooks/useClients";

const LOCATION_OPTIONS = ["Inhouse", "Client"];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const EMPTY_FORM: SwatchFormData = {
  client: "", swatchName: "", swatchCategory: "", fabric: "",
  location: "", swatchDate: "", length: "", width: "", unitType: "",
  hours: "", attachments: [], isActive: true,
};

type FormErrors = Partial<Record<keyof SwatchFormData, string>>;

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const asSwatch = (r: TableRow) => r as unknown as SwatchRecord;

interface AddCategoryModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string) => Promise<void>;
  adding: boolean;
}

function AddCategoryModal({ open, onClose, onAdd, adding }: AddCategoryModalProps) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setName(""); setErr(""); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Category name is required"); return; }
    try { await onAdd(name.trim()); setName(""); onClose(); }
    catch { setErr("Category already exists or failed to add"); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Add Swatch Category</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category Name <span className="text-red-500">*</span></label>
            <input ref={inputRef} type="text" value={name} onChange={(e) => { setName(e.target.value); setErr(""); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="e.g. Thread, Fabric" />
            {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={adding}
              className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-gray-800 disabled:opacity-60">
              {adding ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AddUnitTypeModalProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => Promise<void>;
  adding: boolean;
}

function AddUnitTypeModal({ open, onClose, value, onChange, onSubmit, adding }: AddUnitTypeModalProps) {
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setErr(""); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) { setErr("Unit type name is required"); return; }
    try { await onSubmit(); }
    catch { setErr("Unit type already exists or failed to add"); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Add Unit Type</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Type Name <span className="text-red-500">*</span></label>
            <input ref={inputRef} type="text" value={value} onChange={(e) => { onChange(e.target.value); setErr(""); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="e.g. Meters, Yards" />
            {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={adding}
              className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-[#C9B45C] hover:bg-gray-800 disabled:opacity-60">
              {adding ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SwatchMaster() {
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
  const [clientFilter, setClientFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [swatchCategoryFilter, setSwatchCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<SwatchRecord | null>(null);
  const [form, setForm] = useState<SwatchFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [wipMedia, setWipMedia] = useState<MediaItem[]>([]);
  const [finalMedia, setFinalMedia] = useState<MediaItem[]>([]);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [addUnitTypeOpen, setAddUnitTypeOpen] = useState(false);
  const [newUnitTypeName, setNewUnitTypeName] = useState("");

  const { data, isLoading } = useSwatchList({ search, status, client: clientFilter, location: locationFilter, swatchCategory: swatchCategoryFilter, page, limit });
  const { data: fabricsData } = useAllFabrics();
  const { data: unitTypesData } = useUnitTypes();
  const { data: clientsData } = useAllClients();
  const { data: swatchCatsData } = useSwatchCategories();

  const createMutation = useCreateSwatch();
  const updateMutation = useUpdateSwatch();
  const toggleStatus = useToggleSwatchStatus();
  const deleteMutation = useDeleteSwatch();
  const createCatMutation = useCreateSwatchCategory();
  const createUnitType = useCreateUnitType();

  const fabricOptions = (fabricsData ?? []).map(f => { const v = `${f.fabricType} – ${f.quality}`.trim(); return { value: v, label: v }; });
  const unitOptions = (unitTypesData ?? []).filter(u => u.isActive).map(u => u.name);
  const clientOptions = ((clientsData ?? []) as ClientRecord[]).map(c => c.brandName);
  const swatchCatOptions = (swatchCatsData ?? []).filter(c => c.isActive).map(c => ({ value: c.name, label: c.name }));

  function openCreate() {
    setEditRecord(null); setForm(EMPTY_FORM); setErrors({});
    setWipMedia([]); setFinalMedia([]);
    setModalOpen(true);
  }
  function openEdit(r: SwatchRecord) {
    setEditRecord(r);
    setForm({
      client: r.client ?? "", swatchName: r.swatchName,
      swatchCategory: r.swatchCategory ?? "", fabric: r.fabric ?? "",
      location: r.location ?? "", swatchDate: r.swatchDate ?? "",
      length: r.length ?? "", width: r.width ?? "",
      unitType: r.unitType ?? "", hours: r.hours ?? "",
      attachments: (r.attachments as SwatchAttachment[]) ?? [], isActive: r.isActive,
    });
    setWipMedia((r.wipMedia as MediaItem[]) ?? []);
    setFinalMedia((r.finalMedia as MediaItem[]) ?? []);
    setErrors({}); setModalOpen(true);
  }

  function validate() {
    const e: FormErrors = {};
    if (!form.swatchName.trim()) e.swatchName = "Swatch Name is required";
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      if (editRecord) { await updateMutation.mutateAsync({ id: editRecord.id, data: form }); toast({ title: "Swatch updated" }); }
      else { await createMutation.mutateAsync(form); toast({ title: "Swatch created" }); }
      setModalOpen(false);
    } catch (err: unknown) { toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" }); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId); setDeleteId(null); toast({ title: "Swatch deleted" });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = (ev.target?.result as string).split(",")[1] ?? "";
        const attachment: SwatchAttachment = { name: file.name, type: file.type, data, size: file.size };
        setForm(f => ({ ...f, attachments: [...f.attachments, attachment] }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removeAttachment(idx: number) {
    setForm(f => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }));
  }

  async function handleAddCategory(name: string) {
    const record = await createCatMutation.mutateAsync({ name, isActive: true }) as { name: string };
    setForm(f => ({ ...f, swatchCategory: record.name }));
  }

  async function handleAddUnitType() {
    if (!newUnitTypeName.trim()) return;
    try {
      const record = await createUnitType.mutateAsync({ name: newUnitTypeName.trim(), isActive: true }) as { name: string };
      setForm(f => ({ ...f, unitType: record.name }));
      setNewUnitTypeName(""); setAddUnitTypeOpen(false);
    } catch { toast({ title: "Error", description: "Failed to add unit type.", variant: "destructive" }); }
  }

  const rows: TableRow[] = ((data?.data ?? []) as SwatchRecord[]).map((r, i) => ({ ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1 }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No" },
    { key: "swatchCode", label: "Swatch No", render: (r) => asSwatch(r).swatchCode },
    { key: "swatchName", label: "Swatch Name", render: (r) => asSwatch(r).swatchName },
    { key: "client", label: "Client", render: (r) => asSwatch(r).client || "—" },
    { key: "swatchCategory", label: "Category", render: (r) => asSwatch(r).swatchCategory || "—" },
    { key: "fabric", label: "Base Fabric", render: (r) => asSwatch(r).fabric || "—" },
    { key: "location", label: "Location", render: (r) => {
      const loc = asSwatch(r).location;
      if (!loc) return "—";
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${loc === "Inhouse" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>{loc}</span>;
    }},
    { key: "swatchDate", label: "Date", render: (r) => formatDate(asSwatch(r).swatchDate) },
    { key: "width", label: "Width", render: (r) => asSwatch(r).width || "—" },
    { key: "isActive", label: "Status", render: (r) => <StatusToggle isActive={asSwatch(r).isActive} onToggle={() => toggleStatus.mutate(asSwatch(r).id)} /> },
    { key: "createdBy", label: "Created By", render: (r) => asSwatch(r).createdBy },
    { key: "createdAt", label: "Created At", render: (r) => formatDate(asSwatch(r).createdAt) },
    { key: "actions", label: "Actions", render: (r) => {
      const rec = asSwatch(r);
      return (
        <div className="flex gap-2">
          <button onClick={() => openEdit(rec)} className="p-1 rounded hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
          <button onClick={() => setDeleteId(rec.id)} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
        </div>
      );
    }},
  ];

  const exportColumns: ExportColumn[] = [
    { key: "swatchCode", label: "Swatch No" }, { key: "swatchName", label: "Swatch Name" },
    { key: "client", label: "Client" }, { key: "swatchCategory", label: "Category" },
    { key: "fabric", label: "Base Fabric" }, { key: "location", label: "Location" },
    { key: "swatchDate", label: "Date" }, { key: "length", label: "Length" },
    { key: "width", label: "Width" }, { key: "unitType", label: "Unit Type" },
    { key: "hours", label: "Hours" }, { key: "createdBy", label: "Created By" },
    { key: "createdAt", label: "Created At" },
  ];

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Swatch Master" onAdd={openCreate} addLabel="Add Swatch" />

        <div className="space-y-3">
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search swatches…" />
            </div>
            <ExportExcelButton data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={exportColumns} filename="swatches" />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={clientFilter} onChange={(e) => { setClientFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
              <option value="">All Clients</option>
              {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
              <option value="">All Locations</option>
              {LOCATION_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={swatchCategoryFilter} onChange={(e) => { setSwatchCategoryFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
              <option value="">All Categories</option>
              {swatchCatOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={(row) => (row as unknown as { id: number }).id}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }} />

        <MasterFormModal open={modalOpen} onClose={() => setModalOpen(false)} size="2xl"
          title={editRecord ? `Edit Swatch — ${editRecord.swatchCode}` : "Add Swatch"}
          onSubmit={handleSubmit} submitting={createMutation.isPending || updateMutation.isPending}>

          <div className="grid grid-cols-2 gap-x-5 gap-y-1">
            <SearchableSelect label="Client" value={form.client} onChange={(v) => setForm(f => ({ ...f, client: v }))}
              options={clientOptions} placeholder="Select client" clearable />
            <InputField label="Swatch Name" value={form.swatchName} onChange={(e) => setForm(f => ({ ...f, swatchName: e.target.value }))}
              error={errors.swatchName} required placeholder="Enter swatch name" />

            <div className="py-2">
              <AddableSelect label="Swatch Category" value={form.swatchCategory}
                onChange={(v) => setForm(f => ({ ...f, swatchCategory: v }))}
                onAdd={() => setAddCatOpen(true)} addLabel="+ Add New Category"
                options={swatchCatOptions} placeholder="Select category" />
            </div>

            <SearchableSelect label="Base Fabric" value={form.fabric}
              onChange={(v) => setForm(f => ({ ...f, fabric: v }))}
              options={fabricOptions.map(o => o.value)}
              placeholder="Select fabric" clearable />

            <SearchableSelect label="Location" value={form.location}
              onChange={(v) => setForm(f => ({ ...f, location: v }))}
              options={LOCATION_OPTIONS} placeholder="Select location" clearable />

            <div className="flex flex-col gap-1 py-2">
              <label className="text-sm font-medium text-gray-700">Date</label>
              <input type="date" value={form.swatchDate} onChange={(e) => setForm(f => ({ ...f, swatchDate: e.target.value }))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>

            <InputField label="Length" value={form.length} onChange={(e) => setForm(f => ({ ...f, length: e.target.value }))} placeholder="e.g. 120" />
            <InputField label="Width" value={form.width} onChange={(e) => setForm(f => ({ ...f, width: e.target.value }))} placeholder="e.g. 60" />

            <AddableSelect label="Unit Type" value={form.unitType}
              onChange={(v) => setForm(f => ({ ...f, unitType: v }))}
              onAdd={() => { setNewUnitTypeName(""); setAddUnitTypeOpen(true); }}
              addLabel="+ Add Unit Type"
              options={unitOptions.map(u => ({ value: u, label: u }))}
              placeholder="Select unit" />
            <InputField label="Hours" value={form.hours} onChange={(e) => setForm(f => ({ ...f, hours: e.target.value }))} placeholder="e.g. 4.5" />
          </div>

          <div className="py-2 space-y-2">
            <label className="text-sm font-medium text-gray-700 block">Attachments</label>
            <label className="flex items-center gap-2 cursor-pointer w-fit rounded-lg border border-dashed border-gray-400 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
              <Paperclip size={14} />
              Upload Files
              <input type="file" multiple className="hidden" onChange={handleFileChange} />
            </label>
            {form.attachments.length > 0 && (
              <ul className="space-y-1 mt-1">
                {form.attachments.map((att, idx) => (
                  <li key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 text-sm text-gray-700">
                    <Paperclip size={13} className="text-gray-400 shrink-0" />
                    <span className="flex-1 truncate">{att.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{(att.size / 1024).toFixed(1)} KB</span>
                    <button type="button" onClick={() => removeAttachment(idx)} className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><X size={13} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <label className="text-sm font-medium text-gray-700">Active</label>
            <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {editRecord ? (
            <MediaUploadSection
              entityType="swatches"
              entityId={editRecord.id}
              wipMedia={wipMedia}
              finalMedia={finalMedia}
              onUpdate={({ wipMedia: wip, finalMedia: fin }) => {
                setWipMedia(wip); setFinalMedia(fin);
              }}
            />
          ) : (
            <p className="text-xs text-gray-400 italic border-t border-gray-100 pt-3">
              Save this swatch first, then edit it to upload WIP &amp; final media.
            </p>
          )}
        </MasterFormModal>

        <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
          title="Delete Swatch" message="Are you sure you want to delete this swatch?" />

        <AddCategoryModal open={addCatOpen} onClose={() => setAddCatOpen(false)}
          onAdd={handleAddCategory} adding={createCatMutation.isPending} />

        <AddUnitTypeModal open={addUnitTypeOpen} onClose={() => setAddUnitTypeOpen(false)}
          value={newUnitTypeName} onChange={setNewUnitTypeName}
          onSubmit={handleAddUnitType} adding={createUnitType.isPending} />
      </div>
    </AppLayout>
  );
}
