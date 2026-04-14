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

import {
  useSwatchList, useCreateSwatch, useUpdateSwatch, useToggleSwatchStatus, useDeleteSwatch,
  type SwatchRecord, type SwatchFormData, type StatusFilter,
} from "@/hooks/useSwatches";
import { useFabricList } from "@/hooks/useFabrics";
import { useUnitTypes } from "@/hooks/useLookups";
import { useAllClients, type ClientRecord } from "@/hooks/useClients";

const EMPTY_FORM: SwatchFormData = {
  swatchName: "", fabric: "", colorName: "", hexCode: "#ffffff", width: "",
  unitType: "", finishType: "", gsm: "", client: "", approvalStatus: "Pending", remarks: "", isActive: true,
};
type FormErrors = Partial<Record<keyof SwatchFormData, string>>;

const APPROVAL_OPTIONS = ["Pending", "Approved", "Rejected"];
const FINISH_TYPES = ["Matte", "Glossy", "Satin", "Natural", "Washed", "Mercerized", "Embossed"];

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const asSwatch = (r: TableRow) => r as unknown as SwatchRecord;

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" },
];

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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<SwatchRecord | null>(null);
  const [form, setForm] = useState<SwatchFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useSwatchList({ search, status, page, limit });
  const { data: fabricsData } = useFabricList({ search: "", status: "active", page: 1, limit: 100 });
  const { data: unitTypesData } = useUnitTypes();
  const { data: clientsData } = useAllClients();

  const createMutation = useCreateSwatch();
  const updateMutation = useUpdateSwatch();
  const toggleStatus = useToggleSwatchStatus();
  const deleteMutation = useDeleteSwatch();

  function openCreate() { setEditRecord(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true); }
  function openEdit(r: SwatchRecord) {
    setEditRecord(r);
    setForm({
      swatchName: r.swatchName, fabric: r.fabric ?? "", colorName: r.colorName ?? "",
      hexCode: r.hexCode ?? "#ffffff", width: r.width ?? "", unitType: r.unitType ?? "",
      finishType: r.finishType ?? "", gsm: r.gsm ?? "", client: r.client ?? "",
      approvalStatus: r.approvalStatus, remarks: r.remarks ?? "", isActive: r.isActive,
    });
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

  const rows: TableRow[] = ((data?.data ?? []) as SwatchRecord[]).map((r, i) => ({ ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1 }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No" },
    { key: "swatchCode", label: "Swatch Code", render: (r) => asSwatch(r).swatchCode },
    { key: "swatchName", label: "Swatch Name", render: (r) => asSwatch(r).swatchName },
    { key: "fabric", label: "Fabric", render: (r) => asSwatch(r).fabric || "—" },
    {
      key: "color", label: "Color", render: (r) => {
        const rec = asSwatch(r);
        return (
          <div className="flex items-center gap-2">
            {rec.hexCode && <span className="w-4 h-4 rounded-sm border border-gray-200 inline-block shrink-0" style={{ background: rec.hexCode }} />}
            <span>{rec.colorName || "—"}</span>
          </div>
        );
      },
    },
    {
      key: "approvalStatus", label: "Approval", render: (r) => {
        const s = asSwatch(r).approvalStatus;
        const cls = s === "Approved" ? "text-green-700 bg-green-50" : s === "Rejected" ? "text-red-700 bg-red-50" : "text-yellow-700 bg-yellow-50";
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{s}</span>;
      },
    },
    { key: "isActive", label: "Status", render: (r) => <StatusToggle isActive={asSwatch(r).isActive} onToggle={() => toggleStatus.mutate(asSwatch(r).id)} /> },
    { key: "createdBy", label: "Created By", render: (r) => asSwatch(r).createdBy },
    { key: "createdAt", label: "Created At", render: (r) => formatDate(asSwatch(r).createdAt) },
    { key: "updatedBy", label: "Updated By", render: (r) => asSwatch(r).updatedBy || "—" },
    { key: "updatedAt", label: "Updated At", render: (r) => formatDate(asSwatch(r).updatedAt) },
    {
      key: "actions", label: "Actions", render: (r) => {
        const rec = asSwatch(r);
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
    { key: "swatchCode", label: "Swatch Code" },
    { key: "swatchName", label: "Swatch Name" },
    { key: "fabric", label: "Fabric" },
    { key: "colorName", label: "Color Name" },
    { key: "hexCode", label: "Hex Code" },
    { key: "approvalStatus", label: "Approval Status" },
    { key: "createdBy", label: "Created By" },
    { key: "createdAt", label: "Created At" },
  ];

  const fabricOptions = (fabricsData?.data ?? []).map(f => ({ value: `${f.fabricType} ${f.quality}`.trim(), label: `${f.fabricType} – ${f.quality}` }));
  const unitOptions = (unitTypesData ?? []).filter(u => u.isActive).map(u => ({ value: u.name, label: u.name }));
  const clientOptions = ((clientsData ?? []) as ClientRecord[]).map(c => ({ value: c.brandName, label: c.brandName }));

  function SF({ label, field, options, placeholder }: { label: string; field: keyof SwatchFormData; options: { value: string; label: string }[]; placeholder?: string }) {
    return (
      <div className="flex flex-col gap-1 py-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <select value={String(form[field] ?? "")} onChange={(e) => setForm(f => ({ ...f, [field]: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900">
          <option value="">{placeholder ?? `Select ${label}`}</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Swatch Master" onAdd={openCreate} addLabel="Add Swatch" />

        <div className="flex flex-wrap items-center gap-3">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search swatches…" />
          <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="ml-auto">
            <ExportExcelButton data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={exportColumns} filename="swatches" />
          </div>
        </div>

        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={(row) => (row as unknown as { id: number }).id}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }} />

        <MasterFormModal open={modalOpen} onClose={() => setModalOpen(false)} size="xl"
          title={editRecord ? "Edit Swatch" : "Add Swatch"}
          onSubmit={handleSubmit} submitting={createMutation.isPending || updateMutation.isPending}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0">
            <InputField label="Swatch Name" value={form.swatchName} onChange={(e) => setForm(f => ({ ...f, swatchName: e.target.value }))}
              error={errors.swatchName} required placeholder="Swatch name" />
            <SF label="Fabric" field="fabric" options={fabricOptions} placeholder="Select fabric" />
            <InputField label="Color Name" value={form.colorName} onChange={(e) => setForm(f => ({ ...f, colorName: e.target.value }))} placeholder="e.g. Ivory White" />
            <div className="flex flex-col gap-1 py-2">
              <label className="text-sm font-medium text-gray-700">Hex Code</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.hexCode} onChange={(e) => setForm(f => ({ ...f, hexCode: e.target.value }))}
                  className="h-9 w-12 rounded border border-gray-300 cursor-pointer p-0.5" />
                <input type="text" value={form.hexCode} onChange={(e) => setForm(f => ({ ...f, hexCode: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="#ffffff" />
              </div>
            </div>
            <InputField label="Width" value={form.width} onChange={(e) => setForm(f => ({ ...f, width: e.target.value }))} placeholder="e.g. 60" />
            <SF label="Unit Type" field="unitType" options={unitOptions} placeholder="Select unit" />
            <SF label="Finish Type" field="finishType" options={FINISH_TYPES.map(t => ({ value: t, label: t }))} placeholder="Select finish" />
            <InputField label="GSM" value={form.gsm} onChange={(e) => setForm(f => ({ ...f, gsm: e.target.value }))} placeholder="e.g. 200" />
            <SF label="Client (Optional)" field="client" options={clientOptions} placeholder="Select client" />
            <SF label="Approval Status" field="approvalStatus" options={APPROVAL_OPTIONS.map(a => ({ value: a, label: a }))} />
          </div>
          <InputField label="Remarks" value={form.remarks} onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Additional remarks" />
          <div className="flex items-center gap-3 pt-2">
            <label className="text-sm font-medium text-gray-700">Active</label>
            <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </MasterFormModal>

        <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
          title="Delete Swatch" message="Are you sure you want to delete this swatch?" />
      </div>
    </AppLayout>
  );
}
