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
import SearchableSelect from "@/components/ui/SearchableSelect";

import {
  useStyleList, useCreateStyle, useUpdateStyle, useToggleStyleStatus, useDeleteStyle,
  type StyleRecord, type StyleFormData, type StatusFilter, type MediaItem,
} from "@/hooks/useStyles";
import MediaUploadSection from "@/components/ui/MediaUploadSection";
import { useAllClients, type ClientRecord } from "@/hooks/useClients";

const EMPTY_FORM: StyleFormData = {
  client: "", styleNo: "", invoiceNo: "", description: "", attachLink: "",
  placeOfIssue: "", vendorPoNo: "", shippingDate: "", isActive: true,
};
type FormErrors = Partial<Record<keyof StyleFormData, string>>;

const PLACE_OPTIONS = ["In-house", "Out-house"];

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const asStyle = (r: TableRow) => r as unknown as StyleRecord;

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" },
];

const SELECT_CLS = "border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900";

export default function StyleMaster() {
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
  const [filterClient, setFilterClient] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<StyleRecord | null>(null);
  const [form, setForm] = useState<StyleFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [wipMedia, setWipMedia] = useState<MediaItem[]>([]);
  const [finalMedia, setFinalMedia] = useState<MediaItem[]>([]);

  const { data, isLoading } = useStyleList({ search, status, client: filterClient, location: filterLocation, page, limit });
  const { data: clientsData } = useAllClients();

  const createMutation = useCreateStyle();
  const updateMutation = useUpdateStyle();
  const toggleStatus = useToggleStyleStatus();
  const deleteMutation = useDeleteStyle();

  function openCreate() {
    setEditRecord(null); setForm(EMPTY_FORM); setErrors({});
    setWipMedia([]); setFinalMedia([]);
    setModalOpen(true);
  }
  function openEdit(r: StyleRecord) {
    setEditRecord(r);
    setForm({
      client: r.client, styleNo: r.styleNo, invoiceNo: r.invoiceNo ?? "",
      description: r.description ?? "", attachLink: r.attachLink ?? "",
      placeOfIssue: r.placeOfIssue ?? "", vendorPoNo: r.vendorPoNo ?? "",
      shippingDate: r.shippingDate ?? "", isActive: r.isActive,
    });
    setWipMedia((r.wipMedia as MediaItem[]) ?? []);
    setFinalMedia((r.finalMedia as MediaItem[]) ?? []);
    setErrors({}); setModalOpen(true);
  }
  function validate() {
    const e: FormErrors = {};
    if (!form.client.trim()) e.client = "Client is required";
    setErrors(e); return Object.keys(e).length === 0;
  }
  async function handleSubmit() {
    if (!validate()) return;
    try {
      if (editRecord) { await updateMutation.mutateAsync({ id: editRecord.id, data: form }); toast({ title: "Style updated" }); }
      else { await createMutation.mutateAsync(form); toast({ title: "Style created" }); }
      setModalOpen(false);
    } catch (err: unknown) { toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" }); }
  }
  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId); setDeleteId(null); toast({ title: "Style deleted" });
  }

  const rows: TableRow[] = ((data?.data ?? []) as StyleRecord[]).map((r, i) => ({ ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1 }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No" },
    { key: "client", label: "Client", render: (r) => asStyle(r).client },
    { key: "styleNo", label: "Style No", render: (r) => asStyle(r).styleNo },
    { key: "description", label: "Description", render: (r) => asStyle(r).description || "—" },
    { key: "placeOfIssue", label: "Location", render: (r) => asStyle(r).placeOfIssue || "—" },
    { key: "shippingDate", label: "Shipping Date", render: (r) => asStyle(r).shippingDate || "—" },
    { key: "isActive", label: "Status", render: (r) => <StatusToggle isActive={asStyle(r).isActive} onToggle={() => toggleStatus.mutate(asStyle(r).id)} /> },
    { key: "createdBy", label: "Created By", render: (r) => asStyle(r).createdBy },
    { key: "createdAt", label: "Created At", render: (r) => formatDate(asStyle(r).createdAt) },
    { key: "updatedBy", label: "Updated By", render: (r) => asStyle(r).updatedBy || "—" },
    { key: "updatedAt", label: "Updated At", render: (r) => formatDate(asStyle(r).updatedAt) },
    {
      key: "actions", label: "Actions", render: (r) => {
        const rec = asStyle(r);
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
    { key: "client", label: "Client" },
    { key: "styleNo", label: "Style No" },
    { key: "invoiceNo", label: "Invoice No" },
    { key: "description", label: "Description" },
    { key: "placeOfIssue", label: "Location" },
    { key: "shippingDate", label: "Shipping Date" },
    { key: "createdBy", label: "Created By" },
    { key: "createdAt", label: "Created At" },
  ];

  const clientOptions = ((clientsData ?? []) as ClientRecord[]).map(c => ({ value: c.brandName, label: c.brandName }));

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Style Master" onAdd={openCreate} addLabel="Add Style" />

        <div className="flex items-center gap-3">
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search styles…" className="flex-1" />
          <select value={filterClient} onChange={(e) => { setFilterClient(e.target.value); setPage(1); }} className={SELECT_CLS}>
            <option value="">All Clients</option>
            {clientOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filterLocation} onChange={(e) => { setFilterLocation(e.target.value); setPage(1); }} className={SELECT_CLS}>
            <option value="">All Locations</option>
            {PLACE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }} className={SELECT_CLS}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ExportExcelButton data={(data?.data ?? []) as unknown as Record<string, unknown>[]} columns={exportColumns} filename="styles" />
        </div>

        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={(row) => (row as unknown as { id: number }).id}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }} />

        <MasterFormModal open={modalOpen} onClose={() => setModalOpen(false)} size="xl"
          title={editRecord ? "Edit Style" : "Add Style"}
          onSubmit={handleSubmit} submitting={createMutation.isPending || updateMutation.isPending}>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <SearchableSelect label="Client" value={form.client}
              onChange={(v) => setForm(f => ({ ...f, client: v }))}
              options={clientOptions.map(o => o.value)}
              placeholder="Select client" required error={errors.client} clearable />
            {editRecord ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Style No</label>
                <div className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-500 font-mono">
                  {editRecord.styleNo}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Style No</label>
                <div className="px-3 py-2 text-sm bg-gray-50 border border-dashed border-gray-300 rounded-lg text-gray-400 italic">
                  Auto-generated (ST-0001)
                </div>
              </div>
            )}
            <InputField label="Invoice No (Optional)" value={form.invoiceNo} onChange={(e) => setForm(f => ({ ...f, invoiceNo: e.target.value }))} placeholder="Invoice number" />
            <InputField label="Description (Style Name)" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Style description" />
            <SearchableSelect label="Place of Issue" value={form.placeOfIssue}
              onChange={(v) => setForm(f => ({ ...f, placeOfIssue: v }))}
              options={PLACE_OPTIONS} placeholder="Select place" clearable />
            <InputField label="Vendor PO No" value={form.vendorPoNo} onChange={(e) => setForm(f => ({ ...f, vendorPoNo: e.target.value }))} placeholder="Vendor PO number" />
            <InputField label="Shipping Date" value={form.shippingDate} onChange={(e) => setForm(f => ({ ...f, shippingDate: e.target.value }))} placeholder="DD/MM/YYYY" type="date" />
            <InputField label="Attach Link" value={form.attachLink} onChange={(e) => setForm(f => ({ ...f, attachLink: e.target.value }))} placeholder="https://…" />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <label className="text-sm font-medium text-gray-700">Active</label>
            <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {editRecord ? (
            <MediaUploadSection
              entityType="styles"
              entityId={editRecord.id}
              wipMedia={wipMedia}
              finalMedia={finalMedia}
              onUpdate={({ wipMedia: wip, finalMedia: fin }) => {
                setWipMedia(wip); setFinalMedia(fin);
              }}
            />
          ) : (
            <p className="text-xs text-gray-400 italic border-t border-gray-100 pt-3">
              Save this style first, then edit it to upload WIP &amp; final media.
            </p>
          )}
        </MasterFormModal>

        <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
          title="Delete Style" message="Are you sure you want to delete this style?" />
      </div>
    </AppLayout>
  );
}
