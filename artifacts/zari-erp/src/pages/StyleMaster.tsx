import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, X, Link2, Loader2 } from "lucide-react";
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
import MediaUploadSection from "@/components/ui/MediaUploadSection";

import {
  useStyleList, useCreateStyle, useUpdateStyle, useToggleStyleStatus, useDeleteStyle,
  type StyleRecord, type StyleFormData, type StatusFilter, type MediaItem,
} from "@/hooks/useStyles";
import {
  useSwatchesForReference, useCreateSwatch,
  type SwatchRefOption,
} from "@/hooks/useSwatches";
import { useSwatchCategories } from "@/hooks/useLookups";
import { useAllClients, type ClientRecord } from "@/hooks/useClients";

// ─── Mini Create-Swatch Modal ──────────────────────────────────────────────────

interface CreateSwatchMiniModalProps {
  open: boolean;
  onClose: () => void;
  prefillClient?: string;
  onCreated: (swatchCode: string, swatchName: string) => void;
}

function CreateSwatchMiniModal({ open, onClose, prefillClient, onCreated }: CreateSwatchMiniModalProps) {
  const [name, setName] = useState("");
  const [client, setClient] = useState(prefillClient ?? "");
  const [category, setCategory] = useState("");
  const [err, setErr] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const { data: clientsData } = useAllClients();
  const { data: swatchCatsData } = useSwatchCategories();
  const createSwatch = useCreateSwatch();

  const clientOptions = ((clientsData ?? []) as ClientRecord[]).map(c => c.brandName);
  const catOptions = (swatchCatsData ?? []).filter(c => c.isActive).map(c => c.name);

  useEffect(() => {
    if (open) {
      setName(""); setErr("");
      setClient(prefillClient ?? "");
      setCategory("");
      setTimeout(() => nameRef.current?.focus(), 60);
    }
  }, [open, prefillClient]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Swatch Name is required"); return; }
    try {
      const record = await createSwatch.mutateAsync({
        swatchName: name.trim(),
        client: client || undefined,
        swatchCategory: category || undefined,
        attachments: [],
        isActive: true,
      } as Parameters<typeof createSwatch.mutateAsync>[0]);
      onCreated(record.swatchCode, record.swatchName);
      onClose();
    } catch {
      setErr("Failed to create swatch. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Link2 size={15} className="text-[#C6AF4B]" />
            <h3 className="text-sm font-semibold text-gray-900">Create &amp; Link New Swatch</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Swatch Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErr(""); }}
              placeholder="Enter swatch name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="">— None —</option>
              {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="">— None —</option>
              {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <p className="text-xs text-gray-400">
            A swatch code will be auto-generated. You can add more details from Swatch Master later.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createSwatch.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gray-900 text-[#C6AF4B] hover:bg-gray-800 disabled:opacity-60"
            >
              {createSwatch.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {createSwatch.isPending ? "Creating…" : "Create &amp; Link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const EMPTY_FORM: StyleFormData = {
  client: "", styleNo: "", invoiceNo: "", description: "", attachLink: "",
  placeOfIssue: "", vendorPoNo: "", shippingDate: "", referenceSwatchId: "", isActive: true,
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
  const [createSwatchOpen, setCreateSwatchOpen] = useState(false);

  const { data, isLoading } = useStyleList({ search, status, client: filterClient, location: filterLocation, page, limit });
  const { data: clientsData } = useAllClients();
  const { data: swatchRefs } = useSwatchesForReference();

  const createMutation = useCreateStyle();
  const updateMutation = useUpdateStyle();
  const toggleStatus = useToggleStyleStatus();
  const deleteMutation = useDeleteStyle();

  // Only master swatches in the reference selector
  const swatchOptions = ((swatchRefs ?? []) as SwatchRefOption[])
    .filter(s => s.source === "master")
    .map(s => ({ value: s.code, label: `${s.code}${s.name ? ` – ${s.name}` : ""}${s.client ? ` (${s.client})` : ""}` }));

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
      shippingDate: r.shippingDate ?? "", referenceSwatchId: r.referenceSwatchId ?? "",
      isActive: r.isActive,
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
    { key: "referenceSwatchId", label: "Linked Swatch", render: (r) => asStyle(r).referenceSwatchId
      ? <span className="font-mono text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{asStyle(r).referenceSwatchId}</span>
      : "—" },
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
    { key: "referenceSwatchId", label: "Linked Swatch" },
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

          {/* Reference Swatch */}
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Link2 size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Reference Swatch</span>
              <span className="text-xs text-gray-400">(optional)</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <SearchableSelect
                  value={form.referenceSwatchId}
                  onChange={(v) => setForm(f => ({ ...f, referenceSwatchId: v }))}
                  options={swatchOptions.map(o => o.value)}
                  placeholder="Search and select a swatch…"
                  clearable
                />
                {form.referenceSwatchId && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <Link2 size={11} />
                    Linked to swatch <span className="font-mono font-semibold">{form.referenceSwatchId}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCreateSwatchOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-dashed border-[#C6AF4B] text-[#C6AF4B] hover:bg-amber-50 transition whitespace-nowrap"
              >
                <Plus size={13} />
                New Swatch
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-3">
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

        <CreateSwatchMiniModal
          open={createSwatchOpen}
          onClose={() => setCreateSwatchOpen(false)}
          prefillClient={form.client}
          onCreated={(swatchCode, swatchName) => {
            setForm(f => ({ ...f, referenceSwatchId: swatchCode }));
            toast({ title: "Swatch created & linked", description: `${swatchCode} – ${swatchName}` });
          }}
        />
      </div>
    </AppLayout>
  );
}
