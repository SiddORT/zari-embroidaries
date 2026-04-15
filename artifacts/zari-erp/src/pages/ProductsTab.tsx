import { useState, useRef } from "react";
import {
  Plus, X, Pencil, Trash2, Scissors, CalendarDays,
  FileText, ImageIcon, Loader2, Package,
} from "lucide-react";
import AddableSelect from "@/components/ui/AddableSelect";
import { useAllFabrics } from "@/hooks/useFabrics";
import { useUnitTypes, useCreateUnitType, useDepartments, useCreateDepartment } from "@/hooks/useLookups";
import { useAllStyleCategories, useCreateStyleCategory } from "@/hooks/useStyleCategories";
import {
  useStyleOrderProducts,
  useCreateStyleOrderProduct,
  useUpdateStyleOrderProduct,
  useDeleteStyleOrderProduct,
  type FileAttachment,
  type StyleOrderProductRecord,
} from "@/hooks/useStyleOrderProducts";
import { useToast } from "@/hooks/use-toast";

// ── Constants ──────────────────────────────────────────────────────────────────
const PRODUCT_STATUSES = ["Draft", "In Progress", "Completed", "On Hold", "Cancelled"];

const STATUS_BADGE: Record<string, string> = {
  Draft:        "bg-gray-100 text-gray-600 border-gray-200",
  "In Progress":"bg-blue-50 text-blue-700 border-blue-200",
  Completed:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Hold":    "bg-amber-50 text-amber-700 border-amber-200",
  Cancelled:    "bg-red-50 text-red-600 border-red-200",
};

// ── Shared helpers (outside component) ────────────────────────────────────────
const inputCls = "w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 placeholder:text-gray-400";

function fileToAttachment(file: File): Promise<FileAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result as string, size: file.size });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function UploadZone({ files, onChange, accept, icon, label }: {
  files: FileAttachment[];
  onChange: (f: FileAttachment[]) => void;
  accept: string;
  icon: React.ReactNode;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  async function handleFiles(list: FileList | null) {
    if (!list) return;
    const added = await Promise.all(Array.from(list).map(fileToAttachment));
    onChange([...files, ...added]);
  }
  return (
    <div>
      <div onClick={() => ref.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer">
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">{icon}</div>
          <p className="text-xs font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-400">Click or drag & drop</p>
        </div>
        <input ref={ref} type="file" multiple accept={accept} className="hidden"
          onChange={e => { void handleFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {files.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
              {f.type.startsWith("image/") && (
                <img src={f.data} alt={f.name} className="h-12 w-12 rounded-lg object-cover border border-gray-200 shrink-0" />
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                <span className="text-xs font-medium text-gray-700 truncate">{f.name}</span>
                <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
              </div>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-500 transition-colors mt-0.5 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-gray-100 mb-3">
      <span className="text-gray-500">{icon}</span>
      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</span>
    </div>
  );
}

function PanelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// ── Product form state ─────────────────────────────────────────────────────────
type ProductForm = {
  productName: string;
  styleCategoryId: string;
  styleCategoryName: string;
  productStatus: string;
  fabricId: string;
  fabricName: string;
  hasLining: boolean;
  liningFabricId: string;
  liningFabricName: string;
  unitLength: string;
  unitWidth: string;
  unitType: string;
  orderIssueDate: string;
  deliveryDate: string;
  targetHours: string;
  issuedTo: string;
  department: string;
  refDocs: FileAttachment[];
  refImages: FileAttachment[];
};

const EMPTY_FORM: ProductForm = {
  productName: "", styleCategoryId: "", styleCategoryName: "", productStatus: "Draft",
  fabricId: "", fabricName: "", hasLining: false, liningFabricId: "", liningFabricName: "",
  unitLength: "", unitWidth: "", unitType: "",
  orderIssueDate: "", deliveryDate: "", targetHours: "", issuedTo: "", department: "",
  refDocs: [], refImages: [],
};

function recordToForm(r: StyleOrderProductRecord): ProductForm {
  return {
    productName: r.productName,
    styleCategoryId: r.styleCategoryId ?? "",
    styleCategoryName: r.styleCategoryName ?? "",
    productStatus: r.productStatus,
    fabricId: r.fabricId ?? "",
    fabricName: r.fabricName ?? "",
    hasLining: r.hasLining,
    liningFabricId: r.liningFabricId ?? "",
    liningFabricName: r.liningFabricName ?? "",
    unitLength: r.unitLength ?? "",
    unitWidth: r.unitWidth ?? "",
    unitType: r.unitType ?? "",
    orderIssueDate: r.orderIssueDate ?? "",
    deliveryDate: r.deliveryDate ?? "",
    targetHours: r.targetHours ?? "",
    issuedTo: r.issuedTo ?? "",
    department: r.department ?? "",
    refDocs: r.refDocs ?? [],
    refImages: r.refImages ?? [],
  };
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function ProductsTab({ styleOrderId, isNew }: { styleOrderId: number | null; isNew: boolean }) {
  const { toast } = useToast();
  const { data: productsData, isLoading } = useStyleOrderProducts(styleOrderId);
  const createProduct = useCreateStyleOrderProduct();
  const updateProduct = useUpdateStyleOrderProduct();
  const deleteProduct = useDeleteStyleOrderProduct();

  const { data: fabricsData } = useAllFabrics();
  const { data: unitTypesData } = useUnitTypes();
  const { data: categoriesData } = useAllStyleCategories();
  const { data: deptsData } = useDepartments();

  const createUnitType = useCreateUnitType();
  const createCategory = useCreateStyleCategory();
  const createDept = useCreateDepartment();

  const fabrics = fabricsData ?? [];
  const unitTypes = unitTypesData ?? [];
  const categories = (categoriesData as StyleCategoryRecord[] | undefined) ?? [];
  const depts = deptsData ?? [];

  const fabricOptions = fabrics.map((f: FabricRecord) => ({ value: String(f.id), label: `${f.fabricCode} — ${f.fabricType} ${f.quality}` }));
  const unitTypeOptions = unitTypes.filter((t: LookupRecord) => t.isActive).map((t: LookupRecord) => ({ value: t.name, label: t.name }));
  const categoryOptions = categories.filter((c: StyleCategoryRecord) => c.isActive && !c.isDeleted).map((c: StyleCategoryRecord) => ({ value: String(c.id), label: c.categoryName }));
  const deptOptions = depts.map((d: LookupRecord) => ({ value: String(d.id), label: d.name }));

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Add-new modals
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catError, setCatError] = useState("");

  const [addUTOpen, setAddUTOpen] = useState(false);
  const [newUTName, setNewUTName] = useState("");
  const [utError, setUTError] = useState("");

  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [deptError, setDeptError] = useState("");

  function set<K extends keyof ProductForm>(k: K, v: ProductForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPanelOpen(true);
  }

  function openEdit(r: StyleOrderProductRecord) {
    setEditingId(r.id);
    setForm(recordToForm(r));
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setEditingId(null);
  }

  async function handleSave() {
    if (!form.productName.trim()) {
      toast({ title: "Product Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, styleOrderId: styleOrderId! };
      if (editingId) {
        await updateProduct.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Product updated" });
      } else {
        await createProduct.mutateAsync(payload);
        toast({ title: "Product added" });
      }
      closePanel();
    } catch {
      toast({ title: "Failed to save product", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await deleteProduct.mutateAsync({ id, styleOrderId: styleOrderId! });
    setDeleteConfirmId(null);
    toast({ title: "Product removed" });
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) { setCatError("Name is required"); return; }
    try {
      const r = await createCategory.mutateAsync({ categoryName: newCatName.trim(), isActive: true });
      set("styleCategoryId", String(r.id));
      set("styleCategoryName", r.categoryName);
      setAddCatOpen(false); setNewCatName(""); setCatError("");
    } catch { setCatError("Already exists or failed"); }
  }

  async function handleAddUnitType() {
    if (!newUTName.trim()) { setUTError("Name is required"); return; }
    try {
      await createUnitType.mutateAsync({ name: newUTName.trim(), isActive: true });
      set("unitType", newUTName.trim());
      setAddUTOpen(false); setNewUTName(""); setUTError("");
    } catch { setUTError("Already exists or failed"); }
  }

  async function handleAddDept() {
    if (!newDeptName.trim()) { setDeptError("Name is required"); return; }
    try {
      const r = await createDept.mutateAsync({ name: newDeptName.trim(), isActive: true });
      set("department", String((r as any).id));
      setAddDeptOpen(false); setNewDeptName(""); setDeptError("");
    } catch { setDeptError("Already exists or failed"); }
  }

  const products = productsData?.data ?? [];

  if (isNew) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
        <Package className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-500">Save the style order first to add products.</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Products</h2>
          <p className="text-xs text-gray-400">{products.length} product{products.length !== 1 ? "s" : ""} linked to this order</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors">
          <Plus className="h-4 w-4" /> Add Product
        </button>
      </div>

      {/* ── Product cards ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
          <Package className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No products yet</p>
          <p className="text-xs text-gray-400 mt-1">Click "Add Product" to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between px-5 py-4">
                {/* Left: info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{p.productName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[p.productStatus] ?? STATUS_BADGE.Draft}`}>
                      {p.productStatus}
                    </span>
                    {p.styleCategoryName && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                        {p.styleCategoryName}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                    {p.fabricName && <span>🧵 {p.fabricName}</span>}
                    {p.deliveryDate && <span>📅 Delivery: {p.deliveryDate}</span>}
                    {p.issuedTo && <span>👤 {p.issuedTo}</span>}
                    {p.department && <span>🏢 {p.department}</span>}
                    {(p.refImages?.length > 0 || p.refDocs?.length > 0) && (
                      <span>📎 {(p.refImages?.length ?? 0) + (p.refDocs?.length ?? 0)} attachment{(p.refImages?.length ?? 0) + (p.refDocs?.length ?? 0) !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                  {/* Image thumbnails */}
                  {p.refImages?.length > 0 && (
                    <div className="mt-2 flex gap-1.5">
                      {p.refImages.slice(0, 5).map((img, i) => (
                        <img key={i} src={img.data} alt={img.name}
                          className="h-10 w-10 rounded-lg object-cover border border-gray-200" />
                      ))}
                      {p.refImages.length > 5 && (
                        <div className="h-10 w-10 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                          +{p.refImages.length - 5}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <button onClick={() => openEdit(p)}
                    className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteConfirmId(p.id)}
                    className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Slide-over panel ─────────────────────────────────────────────── */}
      {panelOpen && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={closePanel} />
          {/* Panel */}
          <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{editingId ? "Edit Product" : "Add Product"}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Fill in the product details below</p>
              </div>
              <button onClick={closePanel} className="p-2 rounded-xl hover:bg-gray-200 text-gray-500 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* ── Identity ─────────────────────────────────────────────── */}
              <div className="space-y-4">
                <SectionLabel icon={<Package className="h-3.5 w-3.5" />} title="Product Identity" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <PanelField label="Product Name *">
                      <input className={inputCls} placeholder="e.g. Front Panel Embroidery"
                        value={form.productName} onChange={e => set("productName", e.target.value)} />
                    </PanelField>
                  </div>
                  <PanelField label="Style Category">
                    <AddableSelect
                      value={form.styleCategoryId}
                      onChange={v => {
                        const c = categories.find((c: StyleCategoryRecord) => String(c.id) === v);
                        set("styleCategoryId", v);
                        set("styleCategoryName", c?.categoryName ?? "");
                      }}
                      onAdd={() => { setNewCatName(""); setCatError(""); setAddCatOpen(true); }}
                      options={categoryOptions}
                      placeholder="— Select category —"
                    />
                  </PanelField>
                  <PanelField label="Status">
                    <select className={inputCls + " cursor-pointer"}
                      value={form.productStatus} onChange={e => set("productStatus", e.target.value)}>
                      {PRODUCT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </PanelField>
                </div>
              </div>

              {/* ── Material ─────────────────────────────────────────────── */}
              <div className="space-y-4">
                <SectionLabel icon={<Scissors className="h-3.5 w-3.5" />} title="Material" />
                <PanelField label="Fabric">
                  <AddableSelect
                    value={form.fabricId}
                    onChange={v => {
                      const f = fabrics.find((f: FabricRecord) => String(f.id) === v);
                      set("fabricId", v);
                      set("fabricName", f ? `${f.fabricType} – ${f.quality}` : "");
                    }}
                    options={fabricOptions}
                    placeholder="— Select fabric —"
                  />
                </PanelField>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <PanelField label="Lining">
                    <div className="flex items-center gap-3 pt-1.5">
                      <button type="button" onClick={() => set("hasLining", !form.hasLining)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.hasLining ? "bg-gray-900" : "bg-gray-200"}`}>
                        <span className={`inline-block h-4 w-4 rounded-full shadow transform transition-transform ${form.hasLining ? "translate-x-6 bg-[#C9B45C]" : "translate-x-1 bg-white"}`} />
                      </button>
                      <span className={`text-sm font-medium ${form.hasLining ? "text-gray-900" : "text-gray-400"}`}>
                        {form.hasLining ? "Yes" : "No"}
                      </span>
                    </div>
                  </PanelField>
                  <PanelField label="Lining Fabric">
                    <AddableSelect
                      value={form.liningFabricId}
                      disabled={!form.hasLining}
                      onChange={v => {
                        const f = fabrics.find((f: FabricRecord) => String(f.id) === v);
                        set("liningFabricId", v);
                        set("liningFabricName", f ? `${f.fabricType} – ${f.quality}` : "");
                      }}
                      options={fabricOptions}
                      placeholder="— Select fabric —"
                    />
                  </PanelField>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <PanelField label="Length">
                    <input className={inputCls} placeholder="Length" type="number" min="0"
                      value={form.unitLength} onChange={e => set("unitLength", e.target.value)} />
                  </PanelField>
                  <PanelField label="Width">
                    <input className={inputCls} placeholder="Width" type="number" min="0"
                      value={form.unitWidth} onChange={e => set("unitWidth", e.target.value)} />
                  </PanelField>
                  <PanelField label="Unit Type">
                    <AddableSelect
                      value={form.unitType}
                      onChange={v => set("unitType", v)}
                      onAdd={() => { setNewUTName(""); setUTError(""); setAddUTOpen(true); }}
                      options={unitTypeOptions}
                      placeholder="— Select —"
                    />
                  </PanelField>
                </div>
              </div>

              {/* ── Planning ─────────────────────────────────────────────── */}
              <div className="space-y-4">
                <SectionLabel icon={<CalendarDays className="h-3.5 w-3.5" />} title="Planning" />
                <div className="grid grid-cols-2 gap-3">
                  <PanelField label="Order Issue Date">
                    <input type="date" className={inputCls} value={form.orderIssueDate} onChange={e => set("orderIssueDate", e.target.value)} />
                  </PanelField>
                  <PanelField label="Delivery Date">
                    <input type="date" className={inputCls} value={form.deliveryDate} onChange={e => set("deliveryDate", e.target.value)} />
                  </PanelField>
                  <PanelField label="Target Hours">
                    <input type="number" min="0" step="0.5" className={inputCls} placeholder="e.g. 12"
                      value={form.targetHours} onChange={e => set("targetHours", e.target.value)} />
                  </PanelField>
                  <PanelField label="Issued To">
                    <input className={inputCls} placeholder="Person / team name"
                      value={form.issuedTo} onChange={e => set("issuedTo", e.target.value)} />
                  </PanelField>
                  <div className="col-span-2">
                    <PanelField label="Department">
                      <AddableSelect
                        value={form.department}
                        onChange={v => set("department", v)}
                        onAdd={() => { setNewDeptName(""); setDeptError(""); setAddDeptOpen(true); }}
                        options={deptOptions}
                        placeholder="— Select department —"
                      />
                    </PanelField>
                  </div>
                </div>
              </div>

              {/* ── Attachments ──────────────────────────────────────────── */}
              <div className="space-y-4">
                <SectionLabel icon={<FileText className="h-3.5 w-3.5" />} title="Attachments" />
                <div className="grid grid-cols-2 gap-4">
                  <PanelField label="Reference Documents">
                    <UploadZone files={form.refDocs} onChange={f => set("refDocs", f)}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                      icon={<FileText className="h-4 w-4" />} label="Upload Documents" />
                  </PanelField>
                  <PanelField label="Reference Images">
                    <UploadZone files={form.refImages} onChange={f => set("refImages", f)}
                      accept="image/*"
                      icon={<ImageIcon className="h-4 w-4" />} label="Upload Images" />
                  </PanelField>
                </div>
              </div>

            </div>

            {/* Panel footer */}
            <div className="shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button onClick={closePanel}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button onClick={() => { void handleSave(); }} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 shadow-sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Saving…" : (editingId ? "Update Product" : "Add Product")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ──────────────────────────────────────────── */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Remove Product</h3>
            <p className="text-sm text-gray-500 mb-5">This product will be permanently removed from the order.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button onClick={() => { void handleDelete(deleteConfirmId); }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Category Modal ────────────────────────────────────────────── */}
      {addCatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Add Style Category</h3>
            <input autoFocus className={inputCls} placeholder="Category name…"
              value={newCatName} onChange={e => { setNewCatName(e.target.value); setCatError(""); }}
              onKeyDown={e => { if (e.key === "Enter") void handleAddCategory(); }} />
            {catError && <p className="text-xs text-red-500 mt-1">{catError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAddCatOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={() => { void handleAddCategory(); }} disabled={createCategory.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60">
                {createCategory.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Unit Type Modal ───────────────────────────────────────────── */}
      {addUTOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Add Unit Type</h3>
            <input autoFocus className={inputCls} placeholder="Unit type name…"
              value={newUTName} onChange={e => { setNewUTName(e.target.value); setUTError(""); }}
              onKeyDown={e => { if (e.key === "Enter") void handleAddUnitType(); }} />
            {utError && <p className="text-xs text-red-500 mt-1">{utError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAddUTOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={() => { void handleAddUnitType(); }} disabled={createUnitType.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60">
                {createUnitType.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Department Modal ──────────────────────────────────────────── */}
      {addDeptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Add Department</h3>
            <input autoFocus className={inputCls} placeholder="Department name…"
              value={newDeptName} onChange={e => { setNewDeptName(e.target.value); setDeptError(""); }}
              onKeyDown={e => { if (e.key === "Enter") void handleAddDept(); }} />
            {deptError && <p className="text-xs text-red-500 mt-1">{deptError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAddDeptOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={() => { void handleAddDept(); }} disabled={createDept.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60">
                {createDept.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Type stubs (resolved by TS from actual hook types) ─────────────────────────
type StyleCategoryRecord = { id: number; categoryName: string; isActive: boolean; isDeleted: boolean; createdBy: string; createdAt: string; updatedBy: string | null; updatedAt: string | null };
type FabricRecord = { id: number; fabricCode: string; fabricType: string; quality: string };
type LookupRecord = { id: number; name: string; isActive: boolean };
