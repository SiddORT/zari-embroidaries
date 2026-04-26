import { useState, useRef } from "react";
import {
  Plus, X, Pencil, Trash2, Scissors, CalendarDays, FileText,
  ImageIcon, Loader2, Package, ArrowLeft, Info, Copy, Layout,
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
import { useAllVendors, type VendorRecord } from "@/hooks/useVendors";

// ── Constants ──────────────────────────────────────────────────────────────────
const PRODUCT_STATUSES = ["Draft", "In Progress", "Completed", "On Hold", "Cancelled"];
const PAYMENT_MODES    = ["Cash", "Bank Transfer", "Cheque", "UPI", "Card", "Other"];
const PAYMENT_STATUSES = ["Pending", "Partial", "Paid"];

const STATUS_BADGE: Record<string, string> = {
  Draft:         "bg-gray-100 text-gray-600 border-gray-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  Completed:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Hold":     "bg-amber-50 text-amber-700 border-amber-200",
  Cancelled:     "bg-red-50 text-red-600 border-red-200",
};

// ── Shared style tokens ────────────────────────────────────────────────────────
const inputCls  = "w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 placeholder:text-gray-400";
const selectCls = "w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 appearance-none cursor-pointer";

// ── Helpers defined OUTSIDE the page component (prevents focus-loss on re-render) ──

function fileToAttachment(file: File): Promise<FileAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result as string, size: file.size });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── SectionCard ───────────────────────────────────────────────────────────────
function SectionCard({
  icon, accentColor, title, subtitle, children,
}: {
  icon: React.ReactNode; accentColor: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${accentColor}`}>
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ── Field wrapper ──────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1.5">
        {label}
        {hint && (
          <span className="group relative cursor-pointer">
            <Info className="h-3.5 w-3.5 text-gray-400" />
            <span className="absolute left-5 top-0 w-44 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 hidden group-hover:block z-10 shadow-lg">{hint}</span>
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

// ── File Upload Zone ───────────────────────────────────────────────────────────
function FileUploadZone({
  files, onChange, accept, icon, label,
}: {
  files: FileAttachment[];
  onChange: (files: FileAttachment[]) => void;
  accept: string;
  icon: React.ReactNode;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    const added = await Promise.all(Array.from(list).map(fileToAttachment));
    onChange([...files, ...added]);
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">{icon}</div>
          <p className="text-xs font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-400">Click or drag & drop</p>
        </div>
        <input
          ref={inputRef} type="file" multiple accept={accept} className="hidden"
          onChange={e => { void handleFiles(e.target.files); e.target.value = ""; }}
        />
      </div>
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
              {f.type.startsWith("image/") ? (
                <img src={f.data} alt={f.name} className="h-12 w-12 rounded-lg object-cover border border-gray-200 shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{f.name}</p>
                <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Toggle switch (lining) ─────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${checked ? "bg-gray-900" : "bg-gray-200"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full shadow transform transition-transform ${checked ? "translate-x-6 bg-[#C9B45C]" : "translate-x-1 bg-white"}`} />
    </button>
  );
}

// ── Form state type ────────────────────────────────────────────────────────────
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
  patternType: "Inhouse" | "Outhouse" | "";
  patternMakingCost: string;
  patternDoc: FileAttachment[];
  patternOuthouseDoc: FileAttachment[];
  patternVendorId: string;
  patternVendorName: string;
  patternPaymentType: string;
  patternPaymentMode: string;
  patternPaymentStatus: string;
  patternPaymentAmount: string;
  patternTransactionId: string;
  patternPaymentDate: string;
  patternRemarks: string;
};

const EMPTY_FORM: ProductForm = {
  productName: "", styleCategoryId: "", styleCategoryName: "", productStatus: "Draft",
  fabricId: "", fabricName: "", hasLining: false, liningFabricId: "", liningFabricName: "",
  unitLength: "", unitWidth: "", unitType: "",
  orderIssueDate: "", deliveryDate: "", targetHours: "", issuedTo: "", department: "",
  refDocs: [], refImages: [],
  patternType: "", patternMakingCost: "", patternDoc: [], patternOuthouseDoc: [],
  patternVendorId: "", patternVendorName: "", patternPaymentType: "",
  patternPaymentMode: "", patternPaymentStatus: "Pending", patternPaymentAmount: "",
  patternTransactionId: "", patternPaymentDate: "", patternRemarks: "",
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
    patternType: (r.patternType ?? "") as "Inhouse" | "Outhouse" | "",
    patternMakingCost: r.patternMakingCost ?? "",
    patternDoc: r.patternDoc ?? [],
    patternOuthouseDoc: r.patternOuthouseDoc ?? [],
    patternVendorId: r.patternVendorId ?? "",
    patternVendorName: r.patternVendorName ?? "",
    patternPaymentType: r.patternPaymentType ?? "",
    patternPaymentMode: r.patternPaymentMode ?? "",
    patternPaymentStatus: r.patternPaymentStatus ?? "Pending",
    patternPaymentAmount: r.patternPaymentAmount ?? "",
    patternTransactionId: r.patternTransactionId ?? "",
    patternPaymentDate: r.patternPaymentDate ?? "",
    patternRemarks: r.patternRemarks ?? "",
  };
}

// ── Types for local type assertions ───────────────────────────────────────────
type StyleCatRecord = { id: number; categoryName: string; isActive: boolean; isDeleted: boolean; createdBy: string; createdAt: string; updatedBy: string | null; updatedAt: string | null };
type FabricRec = { id: number; fabricCode: string; fabricType: string; quality: string };
type LookupRec = { id: number; name: string; isActive: boolean };

// ── ProductsTab ────────────────────────────────────────────────────────────────
export default function ProductsTab({
  styleOrderId,
  isNew,
}: {
  styleOrderId: number | null;
  isNew: boolean;
}) {
  const { toast } = useToast();

  // Data hooks
  const { data: productsData, isLoading } = useStyleOrderProducts(styleOrderId);
  const createProduct = useCreateStyleOrderProduct();
  const updateProduct = useUpdateStyleOrderProduct();
  const deleteProduct = useDeleteStyleOrderProduct();

  const { data: fabricsData } = useAllFabrics();
  const { data: unitTypesData } = useUnitTypes();
  const { data: categoriesData } = useAllStyleCategories();
  const { data: deptsData } = useDepartments();

  const createUnitType  = useCreateUnitType();
  const createCategory  = useCreateStyleCategory();
  const createDept      = useCreateDepartment();

  const { data: vendorData } = useAllVendors();
  const vendors: VendorRecord[] = (vendorData as VendorRecord[] | undefined) ?? [];
  const vendorOptions = vendors.map(v => ({ value: String(v.id), label: v.brandName }));

  const fabrics    = (fabricsData as FabricRec[] | undefined) ?? [];
  const unitTypes  = (unitTypesData as LookupRec[] | undefined) ?? [];
  const categories = (categoriesData as StyleCatRecord[] | undefined) ?? [];
  const depts      = (deptsData as LookupRec[] | undefined) ?? [];

  const fabricOptions   = fabrics.map(f => ({ value: String(f.id), label: `${f.fabricCode} — ${f.fabricType} ${f.quality}` }));
  const unitTypeOptions = unitTypes.filter(t => t.isActive).map(t => ({ value: t.name, label: t.name }));
  const categoryOptions = categories.filter(c => c.isActive && !c.isDeleted).map(c => ({ value: String(c.id), label: c.categoryName }));
  const deptOptions     = depts.map(d => ({ value: String(d.id), label: d.name }));

  // View state: "list" | "form"
  const [view, setView] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Add-new modals state
  const [addCatOpen, setAddCatOpen]   = useState(false);
  const [newCatName, setNewCatName]   = useState("");
  const [catError, setCatError]       = useState("");

  const [addUTOpen, setAddUTOpen]     = useState(false);
  const [newUTName, setNewUTName]     = useState("");
  const [utError, setUTError]         = useState("");

  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [deptError, setDeptError]     = useState("");

  function set<K extends keyof ProductForm>(k: K, v: ProductForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setView("form");
  }

  function openEdit(r: StyleOrderProductRecord) {
    setEditingId(r.id);
    setForm(recordToForm(r));
    setView("form");
  }

  function cancelForm() {
    setView("list");
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
      setView("list");
      setEditingId(null);
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

  async function handleCopy(p: StyleOrderProductRecord) {
    const nn = <T,>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);
    try {
      await createProduct.mutateAsync({
        styleOrderId: styleOrderId!,
        productName: `Copy of ${p.productName}`,
        styleCategoryId: nn(p.styleCategoryId),
        styleCategoryName: nn(p.styleCategoryName),
        productStatus: "Draft",
        fabricId: nn(p.fabricId),
        fabricName: nn(p.fabricName),
        hasLining: p.hasLining,
        liningFabricId: nn(p.liningFabricId),
        liningFabricName: nn(p.liningFabricName),
        unitLength: nn(p.unitLength),
        unitWidth: nn(p.unitWidth),
        unitType: nn(p.unitType),
        targetHours: nn(p.targetHours),
        issuedTo: nn(p.issuedTo),
        department: nn(p.department),
        refDocs: [],
        refImages: [],
      });
      toast({ title: "Product duplicated" });
    } catch {
      toast({ title: "Failed to duplicate product", variant: "destructive" });
    }
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
      set("department", String((r as Record<string, unknown>).id));
      setAddDeptOpen(false); setNewDeptName(""); setDeptError("");
    } catch { setDeptError("Already exists or failed"); }
  }

  const products = productsData?.data ?? [];

  // ── isNew guard ─────────────────────────────────────────────────────────────
  if (isNew) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
        <Package className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-500">Save the style order first to add products.</p>
      </div>
    );
  }

  // ── Form view (on-page, stacked section cards) ──────────────────────────────
  if (view === "form") {
    return (
      <div className="space-y-5">
        {/* Form header bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={cancelForm}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Products
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={cancelForm}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { void handleSave(); }}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 shadow-sm"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : editingId ? "Update Product" : "Add Product"}
            </button>
          </div>
        </div>

        {/* ── Card 1: Identity ─────────────────────────────────────────────── */}
        <SectionCard
          icon={<Package className="h-4 w-4 text-[#C9B45C]" />}
          accentColor="bg-gray-900"
          title="Product Identity"
          subtitle="Name, category and current status"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <Field label="Product Name *">
                <input
                  className={inputCls}
                  placeholder="e.g. Front Panel Embroidery"
                  value={form.productName}
                  onChange={e => set("productName", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Style Category">
              <AddableSelect
                value={form.styleCategoryId}
                onChange={v => {
                  const c = categories.find(c => String(c.id) === v);
                  set("styleCategoryId", v);
                  set("styleCategoryName", c?.categoryName ?? "");
                }}
                onAdd={() => { setNewCatName(""); setCatError(""); setAddCatOpen(true); }}
                options={categoryOptions}
                placeholder="— Select category —"
              />
            </Field>
            <Field label="Status">
              <select
                className={selectCls}
                value={form.productStatus}
                onChange={e => set("productStatus", e.target.value)}
              >
                {PRODUCT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        </SectionCard>

        {/* ── Card 2: Material ─────────────────────────────────────────────── */}
        <SectionCard
          icon={<Scissors className="h-4 w-4 text-[#C9B45C]" />}
          accentColor="bg-gray-900"
          title="Material"
          subtitle="Fabric, lining and unit dimensions"
        >
          <div className="space-y-5">
            <Field label="Fabric">
              <AddableSelect
                value={form.fabricId}
                onChange={v => {
                  const f = fabrics.find(f => String(f.id) === v);
                  set("fabricId", v);
                  set("fabricName", f ? `${f.fabricType} – ${f.quality}` : "");
                }}
                options={fabricOptions}
                placeholder="— Select fabric —"
              />
            </Field>

            {/* Lining toggle row */}
            <div className="flex items-center gap-4 py-1">
              <Toggle checked={form.hasLining} onChange={v => set("hasLining", v)} />
              <span className={`text-sm font-medium ${form.hasLining ? "text-gray-900" : "text-gray-400"}`}>
                {form.hasLining ? "Has Lining" : "No Lining"}
              </span>
            </div>

            {form.hasLining && (
              <Field label="Lining Fabric">
                <AddableSelect
                  value={form.liningFabricId}
                  onChange={v => {
                    const f = fabrics.find(f => String(f.id) === v);
                    set("liningFabricId", v);
                    set("liningFabricName", f ? `${f.fabricType} – ${f.quality}` : "");
                  }}
                  options={fabricOptions}
                  placeholder="— Select lining fabric —"
                />
              </Field>
            )}

            {/* Dimensions */}
            <div className="grid grid-cols-3 gap-4">
              <Field label="Length">
                <input
                  className={inputCls} type="number" min="0" placeholder="0"
                  value={form.unitLength} onChange={e => set("unitLength", e.target.value)}
                />
              </Field>
              <Field label="Width">
                <input
                  className={inputCls} type="number" min="0" placeholder="0"
                  value={form.unitWidth} onChange={e => set("unitWidth", e.target.value)}
                />
              </Field>
              <Field label="Unit Type">
                <AddableSelect
                  value={form.unitType}
                  onChange={v => set("unitType", v)}
                  onAdd={() => { setNewUTName(""); setUTError(""); setAddUTOpen(true); }}
                  options={unitTypeOptions}
                  placeholder="— Select —"
                />
              </Field>
            </div>
          </div>
        </SectionCard>

        {/* ── Card 3: Planning ─────────────────────────────────────────────── */}
        <SectionCard
          icon={<CalendarDays className="h-4 w-4 text-[#C9B45C]" />}
          accentColor="bg-gray-900"
          title="Planning"
          subtitle="Dates, assignment and department"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Order Issue Date">
              <input type="date" className={inputCls} value={form.orderIssueDate} onChange={e => set("orderIssueDate", e.target.value)} />
            </Field>
            <Field label="Delivery Date">
              <input type="date" className={inputCls} value={form.deliveryDate} onChange={e => set("deliveryDate", e.target.value)} />
            </Field>
            <Field label="Target Hours" hint="Estimated hours to complete this product">
              <input
                type="number" min="0" step="0.5" className={inputCls} placeholder="e.g. 12"
                value={form.targetHours} onChange={e => set("targetHours", e.target.value)}
              />
            </Field>
            <Field label="Issued To">
              <input
                className={inputCls} placeholder="Person or team name"
                value={form.issuedTo} onChange={e => set("issuedTo", e.target.value)}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Department">
                <AddableSelect
                  value={form.department}
                  onChange={v => set("department", v)}
                  onAdd={() => { setNewDeptName(""); setDeptError(""); setAddDeptOpen(true); }}
                  options={deptOptions}
                  placeholder="— Select department —"
                />
              </Field>
            </div>
          </div>
        </SectionCard>

        {/* ── Card 4: Pattern ──────────────────────────────────────────────── */}
        <SectionCard
          icon={<Layout className="h-4 w-4 text-[#C9B45C]" />}
          accentColor="bg-gray-900"
          title="Pattern"
          subtitle="Pattern making details and documents"
        >
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1.5">Pattern Making</label>
              <div className="flex gap-2">
                {(["Inhouse", "Outhouse"] as const).map(opt => (
                  <button key={opt} type="button"
                    onClick={() => set("patternType", form.patternType === opt ? "" : opt)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold ring-1 transition-all ${
                      form.patternType === opt
                        ? "bg-gray-900 text-[#C9B45C] ring-gray-900"
                        : "bg-white text-gray-500 ring-gray-200 hover:ring-gray-400"
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {form.patternType === "Inhouse" && (
              <div className="space-y-4">
                <Field label="Pattern Making Cost">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                    <input type="number" min="0" step="0.01" placeholder="0.00"
                      className={`${inputCls} pl-7`}
                      value={form.patternMakingCost}
                      onChange={e => set("patternMakingCost", e.target.value)} />
                  </div>
                </Field>
                <Field label="Pattern Document">
                  <FileUploadZone files={form.patternDoc} onChange={f => set("patternDoc", f)}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
                    icon={<FileText className="h-5 w-5" />} label="Upload Pattern Doc" />
                </Field>
              </div>
            )}

            {form.patternType === "Outhouse" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Vendor">
                    <AddableSelect options={vendorOptions} value={form.patternVendorId}
                      onChange={v => {
                        const vd = vendors.find(x => String(x.id) === v);
                        set("patternVendorId", v ?? "");
                        set("patternVendorName", vd?.brandName ?? "");
                      }}
                      placeholder="Select vendor…" />
                  </Field>
                  <Field label="Payment Type">
                    <select className={selectCls} value={form.patternPaymentType}
                      onChange={e => set("patternPaymentType", e.target.value)}>
                      <option value="">Select type…</option>
                      {["Advance", "Partial", "Full"].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Payment Amount">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                      <input type="number" min="0" step="0.01" placeholder="0.00"
                        className={`${inputCls} pl-7`}
                        value={form.patternPaymentAmount}
                        onChange={e => set("patternPaymentAmount", e.target.value)} />
                    </div>
                  </Field>
                  <Field label="Payment Date">
                    <input type="date" className={inputCls} value={form.patternPaymentDate}
                      onChange={e => set("patternPaymentDate", e.target.value)} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Payment Mode">
                    <select className={selectCls} value={form.patternPaymentMode}
                      onChange={e => set("patternPaymentMode", e.target.value)}>
                      <option value="">Select mode…</option>
                      {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Transaction ID">
                    <input type="text" placeholder="e.g. TXN123" className={inputCls}
                      value={form.patternTransactionId}
                      onChange={e => set("patternTransactionId", e.target.value)} />
                  </Field>
                </div>
                <Field label="Payment Status">
                  <div className="flex gap-2 mt-1">
                    {PAYMENT_STATUSES.map(s => (
                      <button key={s} type="button"
                        onClick={() => set("patternPaymentStatus", s)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold ring-1 transition-all ${
                          form.patternPaymentStatus === s
                            ? s === "Paid" ? "bg-green-600 text-white ring-green-600"
                              : s === "Partial" ? "bg-amber-500 text-white ring-amber-500"
                              : "bg-red-500 text-white ring-red-500"
                            : "bg-white text-gray-500 ring-gray-200 hover:ring-gray-400"
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Remarks">
                  <input type="text" placeholder="Payment remarks or notes" className={inputCls}
                    value={form.patternRemarks}
                    onChange={e => set("patternRemarks", e.target.value)} />
                </Field>
                <Field label="Upload Document">
                  <FileUploadZone files={form.patternOuthouseDoc} onChange={f => set("patternOuthouseDoc", f)}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
                    icon={<FileText className="h-5 w-5" />} label="Upload Document" />
                </Field>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Card 5: Attachments ──────────────────────────────────────────── */}
        <SectionCard
          icon={<FileText className="h-4 w-4 text-[#C9B45C]" />}
          accentColor="bg-gray-900"
          title="Attachments"
          subtitle="Reference documents and images for this product"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Reference Documents">
              <FileUploadZone
                files={form.refDocs}
                onChange={f => set("refDocs", f)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                icon={<FileText className="h-4 w-4" />}
                label="Upload Documents"
              />
            </Field>
            <Field label="Reference Images">
              <FileUploadZone
                files={form.refImages}
                onChange={f => set("refImages", f)}
                accept="image/*"
                icon={<ImageIcon className="h-4 w-4" />}
                label="Upload Images"
              />
            </Field>
          </div>
        </SectionCard>

        {/* Bottom save bar */}
        <div className="flex justify-end gap-3 pt-1 pb-4">
          <button
            onClick={cancelForm}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { void handleSave(); }}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60 shadow-sm"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : editingId ? "Update Product" : "Add Product"}
          </button>
        </div>

        {/* ── Add Category modal ────────────────────────────────────────────── */}
        {addCatOpen && (
          <MiniModal
            title="Add Style Category"
            value={newCatName}
            onChange={v => { setNewCatName(v); setCatError(""); }}
            error={catError}
            onCancel={() => setAddCatOpen(false)}
            onConfirm={() => { void handleAddCategory(); }}
            loading={createCategory.isPending}
            placeholder="Category name…"
          />
        )}

        {/* ── Add Unit Type modal ───────────────────────────────────────────── */}
        {addUTOpen && (
          <MiniModal
            title="Add Unit Type"
            value={newUTName}
            onChange={v => { setNewUTName(v); setUTError(""); }}
            error={utError}
            onCancel={() => setAddUTOpen(false)}
            onConfirm={() => { void handleAddUnitType(); }}
            loading={createUnitType.isPending}
            placeholder="Unit type name…"
          />
        )}

        {/* ── Add Department modal ──────────────────────────────────────────── */}
        {addDeptOpen && (
          <MiniModal
            title="Add Department"
            value={newDeptName}
            onChange={v => { setNewDeptName(v); setDeptError(""); }}
            error={deptError}
            onCancel={() => setAddDeptOpen(false)}
            onConfirm={() => { void handleAddDept(); }}
            loading={createDept.isPending}
            placeholder="Department name…"
          />
        )}
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <>
      <SectionCard
        icon={<Package className="h-4 w-4 text-[#C9B45C]" />}
        accentColor="bg-gray-900"
        title="Products"
        subtitle={`${products.length} product${products.length !== 1 ? "s" : ""} linked to this style order`}
      >
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
            </div>
          ) : products.length === 0 ? (
            <div className="text-xs text-gray-400 py-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
              No products yet — click "Add Product" to begin.
            </div>
          ) : (
            products.map(p => <ProductCard key={p.id} product={p} onEdit={openEdit} onDelete={setDeleteConfirmId} onCopy={handleCopy} />)
          )}

          {/* Add Product button */}
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-900 hover:text-gray-900 transition-colors w-full justify-center font-medium"
          >
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </SectionCard>

      {/* ── Delete confirm modal ──────────────────────────────────────────── */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Remove Product</h3>
            <p className="text-sm text-gray-500 mb-5">This product will be permanently removed from the order.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { void handleDelete(deleteConfirmId); }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── ProductCard (defined outside to prevent focus-loss) ───────────────────────
function ProductCard({
  product: p,
  onEdit,
  onDelete,
  onCopy,
}: {
  product: StyleOrderProductRecord;
  onEdit: (r: StyleOrderProductRecord) => void;
  onDelete: (id: number) => void;
  onCopy: (r: StyleOrderProductRecord) => void;
}) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-white transition-all">
      {/* Row 1: identity + badges + actions */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        {/* Icon */}
        <div className="h-8 w-8 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
          <Package className="h-4 w-4 text-[#C9B45C]" />
        </div>
        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{p.productName}</p>
          {p.styleCategoryName && (
            <p className="text-xs text-gray-400">{p.styleCategoryName}</p>
          )}
        </div>
        {/* Badges */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_BADGE[p.productStatus] ?? STATUS_BADGE.Draft}`}>
            {p.productStatus}
          </span>
          {p.deliveryDate && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
              Due {p.deliveryDate}
            </span>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1 ml-1 shrink-0">
          <button
            onClick={() => onCopy(p)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#8a7a30] hover:bg-[#fdf9ec] transition-colors"
            title="Duplicate product"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onEdit(p)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
            title="Edit product"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(p.id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Remove product"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2: meta strip */}
      {(p.fabricName || p.issuedTo || p.department || (p.refImages?.length ?? 0) > 0) && (
        <div className="flex items-start gap-4 px-4 pb-3 border-t border-gray-100 pt-2">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 flex-1">
            {p.fabricName  && <span>🧵 {p.fabricName}</span>}
            {p.issuedTo    && <span>👤 {p.issuedTo}</span>}
            {p.department  && <span>🏢 {p.department}</span>}
            {(p.refImages?.length ?? 0) + (p.refDocs?.length ?? 0) > 0 && (
              <span>📎 {(p.refImages?.length ?? 0) + (p.refDocs?.length ?? 0)} attachment{((p.refImages?.length ?? 0) + (p.refDocs?.length ?? 0)) !== 1 ? "s" : ""}</span>
            )}
          </div>
          {/* Image thumbnails */}
          {(p.refImages?.length ?? 0) > 0 && (
            <div className="flex gap-1 shrink-0">
              {p.refImages.slice(0, 4).map((img, i) => (
                <img key={i} src={img.data} alt={img.name}
                  className="h-9 w-9 rounded-lg object-cover border border-gray-200" />
              ))}
              {p.refImages.length > 4 && (
                <div className="h-9 w-9 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-medium">
                  +{p.refImages.length - 4}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mini add-new modal ─────────────────────────────────────────────────────────
function MiniModal({
  title, value, onChange, error, onCancel, onConfirm, loading, placeholder,
}: {
  title: string; value: string; onChange: (v: string) => void; error: string;
  onCancel: () => void; onConfirm: () => void; loading: boolean; placeholder: string;
}) {
  const inputCls2 = "w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 placeholder:text-gray-400";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
        <input
          autoFocus
          className={inputCls2}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onConfirm(); }}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-medium hover:bg-black transition-colors disabled:opacity-60"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
