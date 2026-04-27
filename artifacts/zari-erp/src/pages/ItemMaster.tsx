import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Pencil, Trash2, ImagePlus, X as XIcon, ZoomIn,
  FileDown, FileUp, FileSpreadsheet,
} from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

import AppLayout from "@/components/layout/AppLayout";
import MasterHeader from "@/components/master/MasterHeader";
import SearchBar from "@/components/master/SearchBar";
import MasterTable, { type Column, type TableRow } from "@/components/master/MasterTable";
import StatusToggle from "@/components/master/StatusToggle";
import InputField from "@/components/ui/InputField";
import ConfirmModal from "@/components/ui/ConfirmModal";
import AddableSelect from "@/components/ui/AddableSelect";

import {
  useItemList, useCreateItem, useUpdateItem, useToggleItemStatus,
  useDeleteItem, useImportItems, fetchAllItemsForExport,
  type ItemRecord, type ItemFormData, type ItemImage,
  type ItemLocationStock, type ItemImportResult, type StatusFilter,
} from "@/hooks/useItems";
import { useItemTypes, useUnitTypes, useCreateUnitType, useCreateItemType } from "@/hooks/useLookups";
import { useHSNList, useCreateHSN, type HsnFormData } from "@/hooks/useHSN";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";

const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const NUMERIC_REGEX = /^[0-9]+(\.[0-9]{1,2})?$/;

const GST_OPTIONS = [
  { value: "", label: "— Select GST —" },
  { value: "0", label: "0%" }, { value: "5", label: "5%" },
  { value: "12", label: "12%" }, { value: "18", label: "18%" },
  { value: "28", label: "28%" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const EMPTY_FORM: ItemFormData = {
  itemName: "", itemType: "", description: "",
  unitType: "", unitPrice: "", hsnCode: "", gstPercent: "",
  currentStock: "", locationStocks: [], images: [],
  reorderLevel: "", minimumLevel: "", maximumLevel: "",
  isActive: true,
};
const EMPTY_HSN_FORM: HsnFormData = { hsnCode: "", gstPercentage: "", govtDescription: "", isActive: true };

type FormErrors = Partial<Record<keyof ItemFormData | "form", string>>;
type HsnErrors = Partial<Record<keyof HsnFormData, string>>;

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const sectionTitle = "text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3";
const labelCls = "block text-sm font-medium text-gray-700 mb-1";
const inputCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10";
const inputErrCls = "border-red-400 focus:border-red-500 focus:ring-red-200";

export default function ItemMaster() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ enabled: !!token });
  useEffect(() => {
    if (!token || (!loadingUser && !user)) setLocation("/login");
  }, [token, user, loadingUser, setLocation]);

  const logoutMutation = useLogout();
  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync({}); } finally {
      localStorage.removeItem("zarierp_token");
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/login");
    }
  };

  /* ─── List state ─────────────────────────────────────────── */
  const [viewMode, setViewMode] = useState<"list" | "form">("list");
  const [editRecord, setEditRecord] = useState<ItemRecord | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useItemList({ search: debouncedSearch, status: statusFilter, page, limit });
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const createMutation = useCreateItem();
  const updateMutation = useUpdateItem();
  const toggleMutation = useToggleItemStatus();
  const deleteMutation = useDeleteItem();
  const importMutation = useImportItems();

  /* ─── Lookups ────────────────────────────────────────────── */
  const { data: itemTypes = [] } = useItemTypes();
  const { data: unitTypes = [] } = useUnitTypes();
  const createUnitType = useCreateUnitType();
  const createItemType = useCreateItemType();
  const createHSN = useCreateHSN();
  const { data: hsnData } = useHSNList({ search: "", status: "active", page: 1, limit: 200 });
  const { data: warehouseLocations = [] } = useWarehouseLocations();
  const hsnOptions = hsnData?.data ?? [];
  const locationOptions = warehouseLocations.filter((l) => l.isActive).map((l) => l.name);

  /* ─── Form state ─────────────────────────────────────────── */
  const [form, setForm] = useState<ItemFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<ItemRecord | null>(null);
  const [confirmToggleTarget, setConfirmToggleTarget] = useState<ItemRecord | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [addUnitTypeOpen, setAddUnitTypeOpen] = useState(false);
  const [newUnitTypeName, setNewUnitTypeName] = useState("");
  const [addItemTypeOpen, setAddItemTypeOpen] = useState(false);
  const [newItemTypeName, setNewItemTypeName] = useState("");
  const [addHSNOpen, setAddHSNOpen] = useState(false);
  const [hsnForm, setHsnForm] = useState<HsnFormData>(EMPTY_HSN_FORM);
  const [hsnErrors, setHsnErrors] = useState<HsnErrors>({});

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) setImportMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* ─── Form open/close ────────────────────────────────────── */
  const openAdd = () => { setEditRecord(null); setForm(EMPTY_FORM); setErrors({}); setViewMode("form"); };
  const openEdit = (r: ItemRecord) => {
    setEditRecord(r);
    setForm({
      itemName: r.itemName,
      itemType: r.itemType,
      description: r.description ?? "",
      unitType: r.unitType,
      unitPrice: r.unitPrice,
      hsnCode: r.hsnCode ?? "",
      gstPercent: r.gstPercent ?? "",
      currentStock: r.currentStock,
      locationStocks: (r.locationStocks ?? []).map((ls) => ({ location: ls.location, stock: ls.stock })),
      images: r.images ?? [],
      reorderLevel: r.reorderLevel ?? "",
      minimumLevel: r.minimumLevel ?? "",
      maximumLevel: r.maximumLevel ?? "",
      isActive: r.isActive,
    });
    setErrors({});
    setViewMode("form");
  };
  const cancelForm = () => { setViewMode("list"); setEditRecord(null); setForm(EMPTY_FORM); setErrors({}); };

  /* ─── Images ─────────────────────────────────────────────── */
  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = 5 - form.images.length;
    Array.from(files).slice(0, remaining).forEach((file) => {
      if (file.size > 3 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds 3 MB`, variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img: ItemImage = { id: Math.random().toString(36).slice(2), name: file.name, data: ev.target?.result as string, size: file.size };
        setForm((f) => ({ ...f, images: [...f.images, img] }));
      };
      reader.readAsDataURL(file);
    });
  };
  const removeImage = (id: string) => setForm((f) => ({ ...f, images: f.images.filter((i) => i.id !== id) }));

  /* ─── Location stocks ────────────────────────────────────── */
  const addLocationStock = () => setForm((f) => ({ ...f, locationStocks: [...f.locationStocks, { location: "", stock: "" }] }));
  const removeLocationStock = (idx: number) => setForm((f) => ({ ...f, locationStocks: f.locationStocks.filter((_, i) => i !== idx) }));
  const updateLocationStock = (idx: number, key: "location" | "stock", value: string) => {
    setForm((f) => {
      const arr = [...f.locationStocks];
      arr[idx] = { ...arr[idx], [key]: value };
      return { ...f, locationStocks: arr };
    });
  };
  const totalStock = form.locationStocks.reduce((sum, s) => sum + (parseFloat(s.stock) || 0), 0);

  /* ─── Validation ─────────────────────────────────────────── */
  const validate = (): boolean => {
    const e: FormErrors = {};
    const name = form.itemName.trim();
    if (!name) e.itemName = "Item Name is required";
    else if (name.length > 100) e.itemName = "Item Name must be at most 100 characters";
    else if (!NAME_REGEX.test(name)) e.itemName = "Item Name must contain only letters and spaces";

    if (form.itemType && !NAME_REGEX.test(form.itemType.trim())) e.itemType = "Item Type must contain only letters and spaces";

    const ut = form.unitType.trim();
    if (!ut) e.unitType = "Unit Type is required";
    else if (!NAME_REGEX.test(ut)) e.unitType = "Unit Type must contain only letters";

    const up = form.unitPrice.trim();
    if (!up) e.unitPrice = "Unit Price is required";
    else if (!NUMERIC_REGEX.test(up)) e.unitPrice = "Unit Price must be a positive numeric value";

    if (form.locationStocks.length === 0) {
      const cs = form.currentStock.trim();
      if (cs && !NUMERIC_REGEX.test(cs)) e.currentStock = "Current Stock must be a positive numeric value";
    } else {
      form.locationStocks.forEach((ls, i) => {
        if (!ls.location) e[`locationStocks_${i}_location` as keyof FormErrors] = "Location required";
        if (!ls.stock || !NUMERIC_REGEX.test(ls.stock)) e[`locationStocks_${i}_stock` as keyof FormErrors] = "Valid stock required";
      });
    }

    const rl = form.reorderLevel ? parseFloat(form.reorderLevel) : null;
    const mn = form.minimumLevel ? parseFloat(form.minimumLevel) : null;
    const mx = form.maximumLevel ? parseFloat(form.maximumLevel) : null;
    if (form.reorderLevel && isNaN(rl!)) e.reorderLevel = "Must be a number";
    else if (rl !== null && rl < 0) e.reorderLevel = "Cannot be negative";
    if (form.minimumLevel && isNaN(mn!)) e.minimumLevel = "Must be a number";
    else if (mn !== null && mn < 0) e.minimumLevel = "Cannot be negative";
    if (form.maximumLevel && isNaN(mx!)) e.maximumLevel = "Must be a number";
    else if (mx !== null && mx < 0) e.maximumLevel = "Cannot be negative";
    if (mn !== null && mx !== null && mn > mx) e.minimumLevel = "Min cannot exceed Max";
    if (rl !== null && mx !== null && rl > mx) e.reorderLevel = "Reorder Level cannot exceed Max";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ─── Submit ─────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!validate()) return;
    const payload: ItemFormData = {
      ...form,
      itemName: form.itemName.trim(),
      itemType: form.itemType.trim(),
      unitType: form.unitType.trim(),
      unitPrice: form.unitPrice.trim(),
      currentStock: form.locationStocks.length > 0 ? String(totalStock) : (form.currentStock.trim() || "0"),
    };
    try {
      if (editRecord) {
        await updateMutation.mutateAsync({ id: editRecord.id, data: payload });
        toast({ title: "Updated", description: "Item updated successfully." });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: "Created", description: "Item created successfully." });
      }
      cancelForm();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? (err instanceof Error ? err.message : "Error");
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  /* ─── Toggle / Delete ────────────────────────────────────── */
  const handleToggleConfirmed = async () => {
    if (!confirmToggleTarget) return;
    try {
      await toggleMutation.mutateAsync(confirmToggleTarget.id);
      toast({ title: "Status Updated", description: `"${confirmToggleTarget.itemName}" is now ${confirmToggleTarget.isActive ? "Inactive" : "Active"}.` });
    } catch { toast({ title: "Error", description: "Failed to update status.", variant: "destructive" }); }
    finally { setConfirmToggleTarget(null); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({ title: "Deleted", description: "Item deleted." });
    } catch { toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }); }
    finally { setDeleteTarget(null); }
  };

  /* ─── Export ─────────────────────────────────────────────── */
  const handleExportAll = async () => {
    setExportLoading(true);
    try {
      const allRows = await fetchAllItemsForExport({ search: debouncedSearch, status: statusFilter });
      const wsData = allRows.map((r) => ({
        "Item Code": r.itemCode,
        "Item Name": r.itemName,
        "Item Type": r.itemType,
        "Description": r.description ?? "",
        "Unit Type": r.unitType,
        "Unit Price": r.unitPrice,
        "HSN Code": r.hsnCode ?? "",
        "GST %": r.gstPercent ?? "",
        "Current Stock": r.currentStock,
        "Reorder Level": r.reorderLevel ?? "",
        "Min Level": r.minimumLevel ?? "",
        "Max Level": r.maximumLevel ?? "",
        "Status": r.isActive ? "Active" : "Inactive",
        "Created By": r.createdBy,
        "Created At": formatDate(r.createdAt),
        "Updated By": r.updatedBy ?? "",
        "Updated At": formatDate(r.updatedAt),
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsData), "Items");
      XLSX.writeFile(wb, "Items_Export.xlsx");
    } catch { toast({ title: "Export Failed", description: "Could not export items.", variant: "destructive" }); }
    finally { setExportLoading(false); }
  };

  const handleDownloadSample = () => {
    const sample = [{
      "Item Name": "Thread", "Item Type": "Raw Material",
      "Description": "Cotton thread", "Unit Type": "Meters",
      "Unit Price": "10.50", "HSN Code": "5204", "GST %": "5",
      "Current Stock": "500", "Status": "Active",
    }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sample), "Template");
    XLSX.writeFile(wb, "Items_Import_Template.xlsx");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        if (!jsonRows.length) { toast({ title: "Empty File", description: "No data rows found.", variant: "destructive" }); return; }
        const importRaw = await importMutation.mutateAsync(jsonRows);
        const result = (importRaw as unknown) as ItemImportResult;
        const hasErrors = result.failed > 0;
        toast({
          title: hasErrors ? "Imported with errors" : "Import Successful",
          description: `${result.succeeded} succeeded${hasErrors ? `, ${result.failed} failed` : ""}.`,
          variant: hasErrors ? "destructive" : "default",
        });
        if (hasErrors) console.warn("Import row errors:", result.results.filter((r) => r.status === "error"));
      } catch (err: unknown) {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? "Import failed.";
        toast({ title: "Import Error", description: msg, variant: "destructive" });
      } finally { setImportLoading(false); setImportMenuOpen(false); }
    };
    reader.readAsBinaryString(file);
  };

  /* ─── Table columns ──────────────────────────────────────── */
  const asItem = (r: TableRow) => r as unknown as ItemRecord;
  const columns: Column[] = [
    {
      key: "_srNo", label: "Sr No", className: "w-14 text-center",
      render: (r) => <span className="text-gray-400 text-xs font-medium">{(r as unknown as { _srNo: number })._srNo}</span>,
    },
    { key: "itemCode", label: "Item Code", render: (r) => <span className="font-mono text-xs text-[#C9B45C] font-semibold tracking-wide">{asItem(r).itemCode}</span> },
    {
      key: "itemName", label: "Item Name",
      render: (r) => {
        const rec = asItem(r);
        return (
          <div className="flex items-center gap-2">
            {rec.images?.[0] && (
              <img src={rec.images[0].data} alt={rec.itemName} className="h-8 w-8 rounded object-cover border border-gray-100 flex-shrink-0" />
            )}
            <span className="font-medium text-gray-900">{rec.itemName}</span>
          </div>
        );
      },
    },
    { key: "itemType", label: "Item Type", render: (r) => <span className="text-gray-600">{asItem(r).itemType || "—"}</span> },
    { key: "unitType", label: "Unit", render: (r) => <span className="text-gray-600">{asItem(r).unitType}</span> },
    { key: "unitPrice", label: "Unit Price", render: (r) => <span className="text-gray-700">₹{asItem(r).unitPrice}</span> },
    { key: "currentStock", label: "Stock", render: (r) => <span className="font-medium text-gray-800">{asItem(r).currentStock}</span> },
    {
      key: "isActive", label: "Status",
      render: (r) => <StatusToggle isActive={asItem(r).isActive} onToggle={() => setConfirmToggleTarget(asItem(r))} loading={toggleMutation.isPending} />,
    },
    { key: "createdAt", label: "Created At", render: (r) => <span className="text-gray-400 text-xs whitespace-nowrap">{formatDate(asItem(r).createdAt)}</span> },
    {
      key: "actions", label: "Actions",
      render: (r) => {
        const rec = asItem(r);
        return (
          <div className="flex gap-2">
            <button onClick={() => openEdit(rec)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Edit">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => setDeleteTarget(rec)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  const tableRows: TableRow[] = rows.map((r: ItemRecord, i: number) => ({ ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1 }));

  if (!user) return null;

  /* ========================================================= */
  /* FORM VIEW                                                   */
  /* ========================================================= */
  if (viewMode === "form") {
    const submitting = createMutation.isPending || updateMutation.isPending;

    return (
      <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
        <div className="max-w-screen-xl mx-auto space-y-5">

          {/* Header */}
          <div className="flex items-center gap-4">
            <button onClick={cancelForm} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1.5 transition-colors">
              ← Back to Items
            </button>
            <div className="h-4 w-px bg-gray-200" />
            <h1 className="text-xl font-bold text-gray-900">{editRecord ? "Edit Item" : "Add New Item"}</h1>
            {editRecord && (
              <span className="font-mono text-sm text-[#C9B45C] font-semibold">{editRecord.itemCode}</span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-5">

              {/* Basic Info */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <p className={sectionTitle}>Basic Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <InputField label="Item Name" required value={form.itemName}
                      onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))}
                      error={errors.itemName} placeholder="e.g. Cotton Thread" />
                    {!errors.itemName && <p className="text-[10px] text-gray-400 mt-0.5">{form.itemName.length}/100 chars</p>}
                  </div>

                  {/* Item Type */}
                  <div>
                    <AddableSelect
                      label="Item Type"
                      value={form.itemType}
                      options={itemTypes.filter((t) => t.isActive).map((t) => ({ value: t.name, label: t.name }))}
                      onChange={(v) => setForm((f) => ({ ...f, itemType: v }))}
                      onAdd={() => setAddItemTypeOpen(true)}
                      placeholder="Select or add…"
                      error={errors.itemType}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      rows={2}
                      placeholder="Optional description…"
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  {/* Unit Type */}
                  <div>
                    <AddableSelect
                      label="Unit Type"
                      required
                      value={form.unitType}
                      options={unitTypes.filter((t) => t.isActive).map((t) => ({ value: t.name, label: t.name }))}
                      onChange={(v) => setForm((f) => ({ ...f, unitType: v }))}
                      onAdd={() => setAddUnitTypeOpen(true)}
                      placeholder="Select or add…"
                      error={errors.unitType}
                    />
                  </div>

                  {/* Unit Price */}
                  <div>
                    <InputField label="Unit Price (₹)" required value={form.unitPrice}
                      onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                      error={errors.unitPrice} placeholder="0.00" />
                  </div>
                </div>
              </div>

              {/* Tax Info */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <p className={sectionTitle}>Tax Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <AddableSelect
                      label="HSN Code"
                      value={form.hsnCode}
                      options={hsnOptions.map((h) => ({ value: h.hsnCode, label: h.hsnCode }))}
                      onChange={(v) => {
                        setForm((f) => {
                          const found = hsnOptions.find((h) => h.hsnCode === v);
                          return { ...f, hsnCode: v, gstPercent: found ? String(found.gstPercentage) : f.gstPercent };
                        });
                      }}
                      onAdd={() => setAddHSNOpen(true)}
                      placeholder="Select HSN…"
                      error={errors.hsnCode}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>GST %</label>
                    <select value={form.gstPercent} onChange={(e) => setForm((f) => ({ ...f, gstPercent: e.target.value }))}
                      className={inputCls}>
                      {GST_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Stock Levels */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <p className={sectionTitle}>Stock Levels</p>
                <div className="grid grid-cols-3 gap-3">
                  <InputField label="Reorder Level" value={form.reorderLevel}
                    onChange={(e) => setForm((f) => ({ ...f, reorderLevel: e.target.value }))}
                    error={errors.reorderLevel} placeholder="0" />
                  <InputField label="Minimum Level" value={form.minimumLevel}
                    onChange={(e) => setForm((f) => ({ ...f, minimumLevel: e.target.value }))}
                    error={errors.minimumLevel} placeholder="0" />
                  <InputField label="Maximum Level" value={form.maximumLevel}
                    onChange={(e) => setForm((f) => ({ ...f, maximumLevel: e.target.value }))}
                    error={errors.maximumLevel} placeholder="0" />
                </div>
              </div>

              {/* Status */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className={sectionTitle}>Status</p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                  <span className={`text-sm font-medium ${form.isActive ? "text-emerald-600" : "text-gray-400"}`}>
                    {form.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-5">

              {/* Images */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className={sectionTitle}>Item Images</p>
                  <span className="text-xs text-gray-400">{form.images.length}/5 — max 3 MB each</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {form.images.map((img) => (
                    <div key={img.id} className="relative group h-20 w-20 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                      <img src={img.data} alt={img.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                        <button type="button" onClick={() => setLightboxUrl(img.data)} className="p-1 rounded-full bg-white/90 text-gray-700 hover:text-gray-900">
                          <ZoomIn className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => removeImage(img.id)} className="p-1 rounded-full bg-white/90 text-red-500 hover:text-red-700">
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {form.images.length < 5 && (
                    <button type="button" onClick={() => imgInputRef.current?.click()}
                      className="h-20 w-20 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#C9B45C] text-gray-400 hover:text-[#C9B45C] transition flex flex-col items-center justify-center gap-1 flex-shrink-0">
                      <ImagePlus className="h-5 w-5" />
                      <span className="text-[10px]">Add</span>
                    </button>
                  )}
                </div>
                <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageFiles(e.target.files)} />
              </div>

              {/* Stock by Location */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">Stock by Location</span>
                    {form.locationStocks.length > 0 && (
                      <span className="text-xs text-gray-500">
                        · Total: <span className="font-semibold text-gray-800">{totalStock} {form.unitType || "units"}</span>
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={addLocationStock}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors">
                    + Add Location
                  </button>
                </div>
                {form.locationStocks.length === 0 ? (
                  <div className="border-2 border-dashed border-indigo-100 rounded-xl py-7 text-center cursor-pointer hover:border-indigo-200 transition-colors" onClick={addLocationStock}>
                    <p className="text-xs text-gray-400">No locations added yet. Click "+ Add Location" to track stock per warehouse.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {form.locationStocks.map((ls, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input list={`item-loc-list-${idx}`} value={ls.location}
                          onChange={(e) => updateLocationStock(idx, "location", e.target.value)}
                          placeholder="Type or select location"
                          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                        <datalist id={`item-loc-list-${idx}`}>
                          {locationOptions.map((l) => <option key={l} value={l} />)}
                        </datalist>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-gray-500 whitespace-nowrap">Stock:</span>
                          <input type="number" min="0" placeholder="0" value={ls.stock}
                            onKeyDown={(e) => { if (e.key === "e" || e.key === "E" || e.key === "-") e.preventDefault(); }}
                            onChange={(e) => updateLocationStock(idx, "stock", e.target.value)}
                            className="w-28 rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                        </div>
                        <button type="button" onClick={() => removeLocationStock(idx)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <div className="border-t border-indigo-100 pt-2 flex justify-end">
                      <span className="text-sm font-semibold text-gray-700">
                        Total Stock: <span className="text-indigo-700">{totalStock} {form.unitType || "units"}</span>
                      </span>
                    </div>
                  </div>
                )}
                {form.locationStocks.length === 0 && (
                  <div className="mt-3">
                    <label className="text-sm font-medium text-gray-700">Current Stock</label>
                    <input value={form.currentStock} maxLength={10}
                      onKeyDown={(e) => { if (e.key === "e" || e.key === "E" || e.key === "-" || e.key === "+") e.preventDefault(); }}
                      onChange={(e) => setForm((f) => ({ ...f, currentStock: e.target.value }))}
                      placeholder="e.g. 100"
                      className={`mt-1 w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 ${errors.currentStock ? "border-red-400 bg-red-50/30" : "border-gray-300 bg-white"}`} />
                    {errors.currentStock && <p className="text-xs text-red-500 mt-1">{errors.currentStock}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-2 pb-6">
            <button type="button" onClick={cancelForm}
              className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gray-900 text-sm font-semibold text-white hover:bg-gray-800 shadow-sm transition-colors disabled:opacity-60">
              {submitting ? "Saving…" : editRecord ? "Update Item" : "Create Item"}
            </button>
          </div>
        </div>

        {/* Lightbox */}
        {lightboxUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setLightboxUrl(null)}>
            <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
              <img src={lightboxUrl} alt="Preview" className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl" />
              <button onClick={() => setLightboxUrl(null)} className="absolute -top-3 -right-3 bg-white rounded-full p-1.5 shadow-lg text-gray-600 hover:text-gray-900">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Inline Quick-Add modals ── */}
        {addItemTypeOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-96 rounded-2xl bg-white p-6 shadow-xl space-y-4">
              <h3 className="font-semibold text-gray-900">Add Item Type</h3>
              <input value={newItemTypeName} onChange={(e) => setNewItemTypeName(e.target.value)}
                placeholder="Item type name…" className={inputCls} />
              <div className="flex justify-end gap-3">
                <button onClick={() => { setAddItemTypeOpen(false); setNewItemTypeName(""); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={async () => {
                  if (!newItemTypeName.trim()) return;
                  await createItemType.mutateAsync({ name: newItemTypeName.trim(), isActive: true });
                  setForm((f) => ({ ...f, itemType: newItemTypeName.trim() }));
                  setNewItemTypeName(""); setAddItemTypeOpen(false);
                }} className="px-4 py-2 rounded-lg bg-gray-900 text-sm font-medium text-white hover:bg-gray-800">Add</button>
              </div>
            </div>
          </div>
        )}

        {addUnitTypeOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-96 rounded-2xl bg-white p-6 shadow-xl space-y-4">
              <h3 className="font-semibold text-gray-900">Add Unit Type</h3>
              <input value={newUnitTypeName} onChange={(e) => setNewUnitTypeName(e.target.value)}
                placeholder="Unit type name…" className={inputCls} />
              <div className="flex justify-end gap-3">
                <button onClick={() => { setAddUnitTypeOpen(false); setNewUnitTypeName(""); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={async () => {
                  if (!newUnitTypeName.trim()) return;
                  await createUnitType.mutateAsync({ name: newUnitTypeName.trim(), isActive: true });
                  setForm((f) => ({ ...f, unitType: newUnitTypeName.trim() }));
                  setNewUnitTypeName(""); setAddUnitTypeOpen(false);
                }} className="px-4 py-2 rounded-lg bg-gray-900 text-sm font-medium text-white hover:bg-gray-800">Add</button>
              </div>
            </div>
          </div>
        )}

        {addHSNOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-[480px] rounded-2xl bg-white p-6 shadow-xl space-y-4">
              <h3 className="font-semibold text-gray-900">Add HSN Code</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>HSN Code <span className="text-red-500">*</span></label>
                  <input value={hsnForm.hsnCode} onChange={(e) => setHsnForm((f) => ({ ...f, hsnCode: e.target.value }))}
                    placeholder="e.g. 5204" className={`${inputCls} ${hsnErrors.hsnCode ? inputErrCls : ""}`} />
                  {hsnErrors.hsnCode && <p className="text-xs text-red-500 mt-0.5">{hsnErrors.hsnCode}</p>}
                </div>
                <div>
                  <label className={labelCls}>GST % <span className="text-red-500">*</span></label>
                  <input value={hsnForm.gstPercentage} onChange={(e) => setHsnForm((f) => ({ ...f, gstPercentage: e.target.value }))}
                    placeholder="e.g. 5" className={`${inputCls} ${hsnErrors.gstPercentage ? inputErrCls : ""}`} />
                  {hsnErrors.gstPercentage && <p className="text-xs text-red-500 mt-0.5">{hsnErrors.gstPercentage}</p>}
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Description</label>
                  <input value={hsnForm.govtDescription ?? ""} onChange={(e) => setHsnForm((f) => ({ ...f, govtDescription: e.target.value }))}
                    placeholder="Optional…" className={inputCls} />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setAddHSNOpen(false); setHsnForm(EMPTY_HSN_FORM); setHsnErrors({}); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={async () => {
                  const he: HsnErrors = {};
                  if (!hsnForm.hsnCode) he.hsnCode = "Required";
                  if (!hsnForm.gstPercentage) he.gstPercentage = "Required";
                  setHsnErrors(he);
                  if (Object.keys(he).length) return;
                  await createHSN.mutateAsync(hsnForm);
                  setForm((f) => ({ ...f, hsnCode: hsnForm.hsnCode, gstPercent: hsnForm.gstPercentage }));
                  setHsnForm(EMPTY_HSN_FORM); setHsnErrors({}); setAddHSNOpen(false);
                }} className="px-4 py-2 rounded-lg bg-gray-900 text-sm font-medium text-white hover:bg-gray-800">Add HSN</button>
              </div>
            </div>
          </div>
        )}
      </AppLayout>
    );
  }

  /* ========================================================= */
  /* LIST VIEW                                                   */
  /* ========================================================= */
  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Item Master" onAdd={openAdd} addLabel="Add Item" />

        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search items…" />
          </div>

          {/* Export */}
          <button onClick={handleExportAll} disabled={exportLoading || isLoading}
            className="flex items-center gap-2 rounded-lg border border-[#C9B45C]/50 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#C9B45C] hover:bg-amber-50/40 disabled:opacity-50"
            title="Export all to Excel">
            <FileDown className="h-4 w-4 text-[#C9B45C]" />
            {exportLoading ? "Exporting…" : "Export"}
          </button>

          {/* Import */}
          <div className="relative" ref={importMenuRef}>
            <button onClick={() => setImportMenuOpen((v) => !v)} disabled={importLoading}
              className="flex items-center gap-2 rounded-lg border border-[#C9B45C]/50 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#C9B45C] hover:bg-amber-50/40 disabled:opacity-50">
              <FileSpreadsheet className="h-4 w-4 text-[#C9B45C]" />
              {importLoading ? "Importing…" : "Import"}
            </button>
            {importMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 w-48 rounded-xl border border-gray-100 bg-white shadow-lg py-1">
                <button onClick={() => { handleDownloadSample(); setImportMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <FileDown className="h-4 w-4 text-gray-400" />
                  Download Sample
                </button>
                <button onClick={() => { importInputRef.current?.click(); setImportMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <FileUp className="h-4 w-4 text-gray-400" />
                  Upload Excel
                </button>
              </div>
            )}
            <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
          </div>

          {/* Status filter */}
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
            {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <MasterTable
          columns={columns}
          rows={tableRows}
          loading={isLoading}
          rowKey={(r) => (r as unknown as { id: number }).id}
          emptyText="No items found. Click 'Add Item' to create one."
          pagination={{ page, limit, total, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }}
        />
      </div>

      {/* Status toggle confirmation */}
      <ConfirmModal
        open={!!confirmToggleTarget}
        title="Change Status"
        message={confirmToggleTarget
          ? `Set "${confirmToggleTarget.itemName}" to ${confirmToggleTarget.isActive ? "Inactive" : "Active"}?`
          : ""}
        confirmLabel="Yes, Change"
        cancelLabel="Cancel"
        danger={false}
        onConfirm={handleToggleConfirmed}
        onCancel={() => setConfirmToggleTarget(null)}
        loading={toggleMutation.isPending}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Item"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.itemName}"? This cannot be undone.` : ""}
        confirmLabel="Delete"
        onConfirm={() => { void handleDelete(); }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </AppLayout>
  );
}
