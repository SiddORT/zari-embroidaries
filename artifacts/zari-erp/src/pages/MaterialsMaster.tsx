import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, ImagePlus, X as XIcon, ZoomIn, FileDown, FileUp, FileSpreadsheet } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

import AppLayout from "@/components/layout/AppLayout";
import MasterHeader from "@/components/master/MasterHeader";
import SearchBar from "@/components/master/SearchBar";
import MasterTable, { type Column, type TableRow } from "@/components/master/MasterTable";
import MasterFormModal from "@/components/master/MasterFormModal";
import StatusToggle from "@/components/master/StatusToggle";
import InputField from "@/components/ui/InputField";
import ConfirmModal from "@/components/ui/ConfirmModal";
import AddableSelect from "@/components/ui/AddableSelect";

import {
  useMaterialList,
  useCreateMaterial,
  useUpdateMaterial,
  useToggleMaterialStatus,
  useDeleteMaterial,
  useImportMaterials,
  fetchAllMaterialsForExport,
  type MaterialRecord,
  type MaterialFormData,
  type MaterialImportResult,
  type LocationStock,
  type MasterImage,
  type StatusFilter,
} from "@/hooks/useMaterials";
import { useItemTypes, useUnitTypes, useCreateUnitType, useCreateItemType } from "@/hooks/useLookups";
import { useHSNList, useCreateHSN, type HsnFormData } from "@/hooks/useHSN";
import { useAllVendors } from "@/hooks/useVendors";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";

const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
const NUMERIC_REGEX = /^[0-9]+(\.[0-9]{1,2})?$/;

const EMPTY_FORM: MaterialFormData = {
  materialName: "", itemType: "", quality: "", type: "",
  color: "#c9b45c", hexCode: "#c9b45c", colorName: "",
  size: "", unitPrice: "", unitType: "", currentStock: "",
  locationStocks: [],
  hsnCode: "", gstPercent: "", vendor: "",
  location: "", isActive: true, images: [],
  reorderLevel: "", minimumLevel: "", maximumLevel: "",
};

type FormErrors = Partial<Record<keyof MaterialFormData | "form", string>>;

const EMPTY_HSN_FORM: HsnFormData = { hsnCode: "", gstPercentage: "", govtDescription: "", isActive: true };
type HsnErrors = Partial<Record<keyof HsnFormData, string>>;

const GST_OPTIONS = [
  { value: "0", label: "0%" }, { value: "5", label: "5%" },
  { value: "12", label: "12%" }, { value: "18", label: "18%" },
  { value: "28", label: "28%" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" },
];

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

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

  const [viewMode, setViewMode] = useState<"list" | "form">("list");
  const [editRecord, setEditRecord] = useState<MaterialRecord | null>(null);

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
  const importMutation = useImportMaterials();

  const { data: itemTypes = [] } = useItemTypes();
  const { data: unitTypes = [] } = useUnitTypes();
  const createUnitType = useCreateUnitType();
  const createItemType = useCreateItemType();
  const createHSN = useCreateHSN();
  const { data: hsnData } = useHSNList({ search: "", status: "active", page: 1, limit: 200 });
  const { data: allVendors = [] } = useAllVendors();
  const { data: warehouseLocations = [] } = useWarehouseLocations();
  const hsnOptions = hsnData?.data ?? [];

  const [form, setForm] = useState<MaterialFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<MaterialRecord | null>(null);
  const [confirmToggleTarget, setConfirmToggleTarget] = useState<MaterialRecord | null>(null);
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

  const [vendorPickerOpen, setVendorPickerOpen] = useState(false);
  const [vendorPickerSearch, setVendorPickerSearch] = useState("");
  const vendorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) setImportMenuOpen(false);
      if (vendorPickerRef.current && !vendorPickerRef.current.contains(e.target as Node)) setVendorPickerOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const openAdd = () => {
    setEditRecord(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setVendorPickerOpen(false);
    setVendorPickerSearch("");
    setViewMode("form");
  };

  const openEdit = (r: MaterialRecord) => {
    setEditRecord(r);
    setForm({
      materialName: r.materialName ?? "",
      itemType: r.itemType,
      quality: r.quality,
      type: r.type ?? "",
      color: r.color ?? "#c9b45c",
      hexCode: r.hexCode ?? "#c9b45c",
      colorName: r.colorName,
      size: r.size,
      unitPrice: r.unitPrice,
      unitType: r.unitType,
      currentStock: r.currentStock,
      locationStocks: (r.locationStocks ?? []).map((ls) => ({ location: ls.location, stock: ls.stock })),
      hsnCode: r.hsnCode,
      gstPercent: r.gstPercent,
      vendor: r.vendor ?? "",
      location: r.location ?? "",
      isActive: r.isActive,
      images: r.images ?? [],
      reorderLevel: r.reorderLevel ?? "",
      minimumLevel: r.minimumLevel ?? "",
      maximumLevel: r.maximumLevel ?? "",
    });
    setErrors({});
    setVendorPickerOpen(false);
    setVendorPickerSearch("");
    setViewMode("form");
  };

  const cancelForm = () => {
    setViewMode("list");
    setEditRecord(null);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = 5 - form.images.length;
    Array.from(files).slice(0, remaining).forEach((file) => {
      if (file.size > 3 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds 3MB`, variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const imgData = e.target?.result as string;
        const img: MasterImage = { id: Math.random().toString(36).slice(2), name: file.name, data: imgData, size: file.size };
        setForm((f) => ({ ...f, images: [...f.images, img] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (id: string) => setForm((f) => ({ ...f, images: f.images.filter((img) => img.id !== id) }));

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

  const locationOptions = warehouseLocations.filter((l) => l.isActive).map((l) => l.name);

  const selectedVendors = (form.vendor ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  const vendorNames = allVendors.map((v) => v.brandName);
  const availableVendors = vendorNames
    .filter((n) => !selectedVendors.includes(n))
    .filter((n) => n.toLowerCase().includes(vendorPickerSearch.toLowerCase()));

  const addVendor = (name: string) => {
    const next = [...selectedVendors, name].join(", ");
    setForm((f) => ({ ...f, vendor: next }));
  };
  const removeVendor = (name: string) => {
    const next = selectedVendors.filter((v) => v !== name).join(", ");
    setForm((f) => ({ ...f, vendor: next || undefined }));
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    const q = form.quality.trim();
    if (!q) e.quality = "Quality is required";
    else if (!NAME_REGEX.test(q)) e.quality = "Quality must contain only letters and spaces.";
    const cn = form.colorName.trim();
    if (!cn) e.colorName = "Color Name is required";
    else if (!NAME_REGEX.test(cn)) e.colorName = "Color Name must contain only letters and spaces.";
    const sz = form.size.trim();
    if (!sz) e.size = "Size is required";
    else if (!NUMERIC_REGEX.test(sz)) e.size = "Size must be a positive numeric value.";
    const up = form.unitPrice.trim();
    if (!up) e.unitPrice = "Unit Price is required";
    else if (!NUMERIC_REGEX.test(up)) e.unitPrice = "Unit Price must be a positive numeric value.";
    if (!form.unitType) e.unitType = "Unit Type is required";
    else if (!NAME_REGEX.test(form.unitType)) e.unitType = "Unit Type must contain only letters.";
    if (form.locationStocks.length === 0) {
      const cs = form.currentStock.trim();
      if (!cs) e.currentStock = "Current Stock is required";
      else if (!NUMERIC_REGEX.test(cs)) e.currentStock = "Current Stock must be a positive numeric value.";
    }
    if (!form.hsnCode) e.hsnCode = "HSN Code is required";
    if (form.itemType && !NAME_REGEX.test(form.itemType.trim())) e.itemType = "Item Type must contain only letters and spaces.";
    if (form.type && !NAME_REGEX.test(form.type.trim())) e.type = "Type must contain only letters and spaces.";
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

  const handleSubmit = async () => {
    if (!validate()) return;
    const payload: MaterialFormData = {
      ...form,
      quality: form.quality.trim(),
      colorName: form.colorName.trim(),
      size: form.size.trim(),
      unitPrice: form.unitPrice.trim(),
      unitType: form.unitType.trim(),
      itemType: form.itemType.trim(),
      type: form.type?.trim(),
      materialName: form.materialName?.trim(),
      currentStock: form.locationStocks.length > 0 ? String(totalStock) : form.currentStock.trim(),
    };
    try {
      if (editRecord) {
        await updateMutation.mutateAsync({ id: editRecord.id, data: payload });
        toast({ title: "Updated", description: `Material ${editRecord.materialCode} updated successfully.` });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: "Created", description: "Material created successfully." });
      }
      setViewMode("list");
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "An error occurred.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleToggleClick = (r: MaterialRecord) => setConfirmToggleTarget(r);
  const handleToggleConfirmed = async () => {
    if (!confirmToggleTarget) return;
    try {
      await toggleMutation.mutateAsync(confirmToggleTarget.id);
      toast({ title: "Status Updated", description: `${confirmToggleTarget.materialCode} is now ${confirmToggleTarget.isActive ? "Inactive" : "Active"}.` });
    } catch { toast({ title: "Error", description: "Failed to update status.", variant: "destructive" }); }
    finally { setConfirmToggleTarget(null); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({ title: "Deleted", description: `Material ${deleteTarget.materialCode} deleted.` });
      setDeleteTarget(null);
    } catch { toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }); }
  };

  const handleAddUnitType = async () => {
    const name = newUnitTypeName.trim();
    if (!name) return;
    if (!NAME_REGEX.test(name)) { toast({ title: "Invalid", description: "Unit Type must contain only letters and spaces.", variant: "destructive" }); return; }
    try {
      await createUnitType.mutateAsync({ name, isActive: true });
      setForm((f) => ({ ...f, unitType: name }));
      setNewUnitTypeName("");
      setAddUnitTypeOpen(false);
    } catch { toast({ title: "Error", description: "Failed to add unit type.", variant: "destructive" }); }
  };

  const handleAddItemType = async () => {
    const name = newItemTypeName.trim();
    if (!name) return;
    if (!NAME_REGEX.test(name)) { toast({ title: "Invalid", description: "Item Type must contain only letters and spaces.", variant: "destructive" }); return; }
    try {
      await createItemType.mutateAsync({ name, isActive: true });
      setForm((f) => ({ ...f, itemType: name }));
      setNewItemTypeName("");
      setAddItemTypeOpen(false);
    } catch { toast({ title: "Error", description: "Failed to add item type.", variant: "destructive" }); }
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

  const handleExportAll = async () => {
    setExportLoading(true);
    try {
      const allRows = await fetchAllMaterialsForExport({ search: debouncedSearch, status: statusFilter, hsnCode: hsnCodeFilter, type: typeFilter, vendor: vendorFilter });
      const wsData = allRows.map((r) => ({
        "Code": r.materialCode,
        "Material Name": r.materialName ?? "",
        "Item Type": r.itemType,
        "Quality": r.quality,
        "Type": r.type ?? "",
        "Color Name": r.colorName,
        "Hex Code": r.hexCode ?? "",
        "Size": r.size,
        "Unit Price": r.unitPrice,
        "Unit Type": r.unitType,
        "Current Stock": r.currentStock,
        "HSN Code": r.hsnCode,
        "GST %": r.gstPercent,
        "Preferred Vendors": r.vendor ?? "",
        "Status": r.isActive ? "Active" : "Inactive",
        "Created By": r.createdBy,
        "Created At": formatDate(r.createdAt),
        "Updated By": r.updatedBy ?? "",
        "Updated At": formatDate(r.updatedAt),
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsData), "Materials");
      XLSX.writeFile(wb, "Materials_Export.xlsx");
    } catch { toast({ title: "Export Failed", description: "Could not export materials.", variant: "destructive" }); }
    finally { setExportLoading(false); }
  };

  const handleDownloadSample = () => {
    const sample = [{
      "Material Name": "Silk Thread", "Item Type": "Thread", "Quality": "Premium", "Type": "Natural",
      "Color Name": "Royal Blue", "Hex Code": "#4169E1", "Size": "5", "Unit Price": "250",
      "Unit Type": "Meter", "Current Stock": "100", "HSN Code": "5402", "GST %": "5",
      "Preferred Vendors": "", "Status": "Active",
    }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sample), "Template");
    XLSX.writeFile(wb, "Materials_Import_Template.xlsx");
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
        const result = (importRaw as unknown) as MaterialImportResult;
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
      } finally {
        setImportLoading(false);
        setImportMenuOpen(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const asMat = (r: TableRow) => r as unknown as MaterialRecord;
  const unitTypeOptions = unitTypes.filter((t) => t.isActive).map((t) => ({ value: t.name, label: t.name }));
  const itemTypeOptions = itemTypes.filter((t) => t.isActive).map((t) => ({ value: t.name, label: t.name }));
  const hsnDropdownOptions = hsnOptions.map((h) => ({ value: h.hsnCode, label: `${h.hsnCode} (${h.gstPercentage}%)` }));
  const submitting = createMutation.isPending || updateMutation.isPending;

  const columns: Column[] = [
    {
      key: "srNo", label: "Sr No", className: "w-14 text-center",
      render: (r) => {
        const idx = rows.findIndex((row) => row.id === asMat(r).id);
        return <span className="text-gray-400 text-xs font-medium">{(page - 1) * limit + (idx === -1 ? 0 : idx) + 1}</span>;
      },
    },
    {
      key: "image", label: "Image", className: "w-14",
      render: (r) => {
        const imgs = asMat(r).images ?? [];
        if (!imgs.length) return (
          <div className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18a.75.75 0 00.75-.75V5.25A.75.75 0 0021 4.5H3A.75.75 0 002.25 5.25v14.25c0 .414.336.75.75.75zM12 10.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
          </div>
        );
        return (
          <button type="button" onClick={() => setLightboxUrl(imgs[0].data)}
            className="w-9 h-9 rounded-lg overflow-hidden border border-gray-200 hover:border-[#C6AF4B] transition-colors relative group">
            <img src={imgs[0].data} alt="" className="w-full h-full object-cover" />
            {imgs.length > 1 && <span className="absolute bottom-0 right-0 text-[9px] font-bold bg-black/60 text-white px-0.5 rounded-tl-md">+{imgs.length - 1}</span>}
          </button>
        );
      },
    },
    { key: "materialCode", label: "Code", render: (r) => <span className="font-mono font-semibold text-gray-900" title="Material Code is auto-generated.">{asMat(r).materialCode}</span> },
    { key: "itemType", label: "Item Type", render: (r) => <span className="text-gray-700">{asMat(r).itemType}</span> },
    { key: "quality", label: "Quality", render: (r) => <span className="text-gray-700">{asMat(r).quality}</span> },
    {
      key: "colorName", label: "Color Name",
      render: (r) => (
        <div className="flex items-center gap-2">
          {asMat(r).hexCode && <span className="h-4 w-4 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: asMat(r).hexCode ?? undefined }} />}
          <span className="text-gray-700">{asMat(r).colorName}</span>
        </div>
      ),
    },
    { key: "size", label: "Size", render: (r) => <span className="text-gray-700">{asMat(r).size}</span> },
    { key: "unitPrice", label: "Unit Price", render: (r) => <span className="font-medium">₹{asMat(r).unitPrice}</span> },
    { key: "unitType", label: "Unit Type", render: (r) => <span className="text-gray-500">{asMat(r).unitType}</span> },
    { key: "currentStock", label: "Stock", render: (r) => <span className="font-medium">{asMat(r).currentStock}</span> },
    { key: "hsnCode", label: "HSN Code", render: (r) => <span className="font-mono text-gray-700">{asMat(r).hsnCode}</span> },
    { key: "gstPercent", label: "GST %", render: (r) => <span>{asMat(r).gstPercent}%</span> },
    {
      key: "vendor", label: "Preferred Vendors",
      render: (r) => {
        const vendors = (asMat(r).vendor ?? "").split(",").map((v) => v.trim()).filter(Boolean);
        if (!vendors.length) return <span className="text-gray-400">—</span>;
        return (
          <span className="truncate max-w-[160px] inline-block text-gray-700" title={vendors.join(", ")}>
            {vendors.join(", ")}
          </span>
        );
      },
    },
    {
      key: "isActive", label: "Status",
      render: (r) => <StatusToggle isActive={asMat(r).isActive} onToggle={() => handleToggleClick(asMat(r))} loading={toggleMutation.isPending} />,
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

  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      {viewMode === "list" && (
        <div className="max-w-screen-xl mx-auto space-y-5">
          <MasterHeader title="Materials Master" onAdd={openAdd} addLabel="Add Material" />

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by code, type, quality, color, HSN, vendor..." />
              </div>
              {/* Export All */}
              <button
                onClick={handleExportAll}
                disabled={exportLoading || isLoading}
                className="flex items-center gap-2 rounded-lg border border-[#C9B45C]/50 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#C9B45C] hover:bg-amber-50/40 disabled:opacity-50"
                title="Export all matching records to Excel"
              >
                <FileDown className="h-4 w-4 text-[#C9B45C]" />
                {exportLoading ? "Exporting…" : "Export"}
              </button>
              {/* Import dropdown */}
              <div className="relative" ref={importMenuRef}>
                <button
                  onClick={() => setImportMenuOpen((v) => !v)}
                  disabled={importLoading}
                  className="flex items-center gap-2 rounded-lg border border-[#C9B45C]/50 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#C9B45C] hover:bg-amber-50/40 disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-4 w-4 text-[#C9B45C]" />
                  {importLoading ? "Importing…" : "Import"}
                </button>
                {importMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-30 w-48 rounded-xl border border-gray-100 bg-white shadow-lg py-1">
                    <button
                      onClick={() => { handleDownloadSample(); setImportMenuOpen(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <FileDown className="h-4 w-4 text-gray-400" />
                      Download Sample
                    </button>
                    <button
                      onClick={() => { importInputRef.current?.click(); setImportMenuOpen(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <FileUp className="h-4 w-4 text-gray-400" />
                      Upload Excel
                    </button>
                  </div>
                )}
                <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
                {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
                <option value="">All Item Types</option>
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
                <button onClick={() => { setTypeFilter(""); setHsnCodeFilter(""); setVendorFilter(""); setStatusFilter("all"); setPage(1); }}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors">
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
      )}

      {viewMode === "form" && (
        <div className="max-w-screen-xl mx-auto space-y-5">
          {/* ── Header ── */}
          <div className="flex items-center justify-between">
            <div>
              <button type="button" onClick={cancelForm}
                className="mb-1 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors">
                ← Back to list
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                {editRecord ? `Edit Material — ${editRecord.materialCode}` : "Add Material"}
              </h1>
              {editRecord && <p className="text-xs text-gray-400 mt-0.5" title="Material Code is auto-generated.">{editRecord.materialCode}</p>}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={cancelForm}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm">
                {submitting ? (editRecord ? "Saving…" : "Creating…") : (editRecord ? "Save Changes" : "Create Material")}
              </button>
            </div>
          </div>

          {/* ── Two column grid ── */}
          <div className="grid grid-cols-[1fr_380px] gap-5 items-start">
            {/* ── Left column ── */}
            <div className="space-y-5">

              {/* Basic Info */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C6AF4B] mb-4">Basic Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Material Name" placeholder="e.g. Silk Thread"
                    maxLength={100}
                    value={form.materialName ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, materialName: e.target.value }))} />
                  <AddableSelect
                    label="Item Type" value={form.itemType}
                    onChange={(v) => setForm((f) => ({ ...f, itemType: v }))}
                    onAdd={() => { setNewItemTypeName(""); setAddItemTypeOpen(true); }}
                    addLabel="+ Add Item Type"
                    options={itemTypeOptions} placeholder="Select Item Type" error={errors.itemType}
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Quality<span className="text-red-500 ml-0.5">*</span></label>
                    <input value={form.quality} maxLength={50}
                      onChange={(e) => setForm((f) => ({ ...f, quality: e.target.value.replace(/[^A-Za-z ]/g, "") }))}
                      placeholder="e.g. Premium"
                      className={`rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 ${errors.quality ? "border-red-400 bg-red-50/30" : "border-gray-300 bg-white"}`} />
                    {errors.quality ? <p className="text-xs text-red-500">{errors.quality}</p> : <p className="text-[10px] text-gray-400">{form.quality.length} / 50 characters used</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Type</label>
                    <input value={form.type ?? ""} maxLength={50}
                      onChange={(e) => setForm((f) => ({ ...f, type: e.target.value.replace(/[^A-Za-z ]/g, "") }))}
                      placeholder="e.g. Natural"
                      className={`rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 ${errors.type ? "border-red-400 bg-red-50/30" : "border-gray-300 bg-white"}`} />
                    {errors.type ? <p className="text-xs text-red-500">{errors.type}</p> : <p className="text-[10px] text-gray-400">{(form.type ?? "").length} / 50 characters used</p>}
                  </div>
                </div>
              </div>

              {/* Color */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C6AF4B] mb-4">Color</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Color Picker</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={form.hexCode || "#c9b45c"}
                        onChange={(e) => setForm((f) => ({ ...f, hexCode: e.target.value, color: e.target.value }))}
                        className="h-10 w-14 rounded-lg border border-gray-300 cursor-pointer p-0.5 shrink-0" />
                      <input type="text" value={form.hexCode || ""} readOnly
                        className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500" placeholder="#000000" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Color Name<span className="text-red-500 ml-0.5">*</span></label>
                    <input value={form.colorName} maxLength={50}
                      onChange={(e) => setForm((f) => ({ ...f, colorName: e.target.value.replace(/[^A-Za-z ]/g, "") }))}
                      placeholder="e.g. Royal Blue"
                      className={`rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 ${errors.colorName ? "border-red-400 bg-red-50/30" : "border-gray-300 bg-white"}`} />
                    {errors.colorName ? <p className="text-xs text-red-500">{errors.colorName}</p> : <p className="text-[10px] text-gray-400">{form.colorName.length} / 50 characters used</p>}
                  </div>
                </div>
              </div>

              {/* Sizing & Pricing */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C6AF4B] mb-4">Sizing & Pricing</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Size<span className="text-red-500 ml-0.5">*</span></label>
                    <input value={form.size} maxLength={6}
                      onKeyDown={(e) => { if (e.key === "e" || e.key === "E" || e.key === "-" || e.key === "+") e.preventDefault(); }}
                      onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
                      placeholder="e.g. 5"
                      className={`rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 ${errors.size ? "border-red-400 bg-red-50/30" : "border-gray-300 bg-white"}`} />
                    {errors.size && <p className="text-xs text-red-500">{errors.size}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Unit Price (₹)<span className="text-red-500 ml-0.5">*</span></label>
                    <input value={form.unitPrice} maxLength={10}
                      onKeyDown={(e) => { if (e.key === "e" || e.key === "E" || e.key === "-" || e.key === "+") e.preventDefault(); }}
                      onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                      placeholder="e.g. 250"
                      className={`rounded-lg border px-3.5 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 ${errors.unitPrice ? "border-red-400 bg-red-50/30" : "border-gray-300 bg-white"}`} />
                    {errors.unitPrice && <p className="text-xs text-red-500">{errors.unitPrice}</p>}
                  </div>
                  <AddableSelect
                    label="Unit Type" required value={form.unitType}
                    onChange={(v) => setForm((f) => ({ ...f, unitType: v }))}
                    onAdd={() => { setNewUnitTypeName(""); setAddUnitTypeOpen(true); }}
                    addLabel="+ Add Unit Type"
                    options={unitTypeOptions} placeholder="Select Unit Type" error={errors.unitType}
                  />
                </div>
              </div>

              {/* HSN & Tax */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C6AF4B] mb-4">HSN & Tax</p>
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">GST %</label>
                    <input type="text" readOnly value={form.gstPercent ? `${form.gstPercent}%` : ""}
                      placeholder="Auto-filled from HSN"
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500" />
                  </div>
                </div>
              </div>

              {/* Sourcing — Preferred Vendors */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C6AF4B] mb-4">Sourcing</p>
                {(() => {
                  return (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-gray-700">Preferred Vendors</label>
                      {selectedVendors.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          {selectedVendors.map((name) => (
                            <span key={name} className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-[#C9B45C]/40 px-2.5 py-1 text-xs font-medium text-gray-700 max-w-[200px]" title={name}>
                              <span className="truncate">{name}</span>
                              <button type="button" onClick={() => removeVendor(name)}
                                className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors leading-none shrink-0">
                                <XIcon className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="relative" ref={vendorPickerRef}>
                        <button type="button"
                          onClick={() => { setVendorPickerOpen((v) => !v); setVendorPickerSearch(""); }}
                          className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-500 shadow-sm outline-none transition hover:border-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
                          <span>{selectedVendors.length === 0 ? "Select vendors…" : `${selectedVendors.length} selected`}</span>
                          <svg className={`h-4 w-4 text-gray-400 transition-transform ${vendorPickerOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        {vendorPickerOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border border-gray-100 bg-white shadow-lg overflow-hidden">
                            <div className="px-3 pt-2.5 pb-1.5 border-b border-gray-100">
                              <input autoFocus value={vendorPickerSearch}
                                onChange={(e) => setVendorPickerSearch(e.target.value)}
                                placeholder="Search vendors…"
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-gray-400" />
                            </div>
                            <div className="max-h-48 overflow-y-auto py-1">
                              {availableVendors.length === 0 ? (
                                <p className="px-4 py-3 text-sm text-gray-400 text-center">
                                  {vendorPickerSearch ? "No vendors match your search" : "All vendors selected"}
                                </p>
                              ) : (
                                availableVendors.map((name) => (
                                  <button key={name} type="button"
                                    onClick={() => { addVendor(name); setVendorPickerSearch(""); }}
                                    className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-amber-50/60 hover:text-gray-900 transition-colors text-left truncate"
                                    title={name}>
                                    {name}
                                  </button>
                                ))
                              )}
                            </div>
                            {selectedVendors.length > 0 && (
                              <div className="border-t border-gray-100 px-3 py-2">
                                <button type="button" onClick={() => { setForm((f) => ({ ...f, vendor: undefined })); setVendorPickerOpen(false); }}
                                  className="text-xs text-red-400 hover:text-red-600 transition-colors">
                                  Clear all
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
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
                        <input list={`mat-loc-list-${idx}`} value={ls.location}
                          onChange={(e) => updateLocationStock(idx, "location", e.target.value)}
                          placeholder="Type or select location"
                          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                        <datalist id={`mat-loc-list-${idx}`}>
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
                    <label className="text-sm font-medium text-gray-700">Current Stock<span className="text-red-500 ml-0.5">*</span></label>
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

            {/* ── Right column ── */}
            <div className="space-y-5">

              {/* Item Images */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C6AF4B]">Item Images</span>
                    <span className="text-[10px] text-gray-400">{form.images.length}/5</span>
                  </div>
                  {form.images.length < 5 && (
                    <button type="button" onClick={() => imgInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-[#C6AF4B] text-[#8a7a2e] hover:bg-[#C6AF4B]/10 transition-colors">
                      <ImagePlus className="h-3.5 w-3.5" /> Add
                    </button>
                  )}
                  <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageFiles(e.target.files)} />
                </div>
                {form.images.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center py-10 gap-2 cursor-pointer hover:border-[#C6AF4B]/50 transition-colors"
                    onClick={() => imgInputRef.current?.click()}>
                    <ImagePlus className="h-8 w-8 text-gray-300" />
                    <p className="text-xs text-gray-400 text-center">Click to add images<br />(JPG, PNG, WebP · max 3 MB)</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {form.images.map((img) => (
                      <div key={img.id} className="relative group aspect-square rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                        <img src={img.data} alt={img.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                          <button type="button" onClick={() => setLightboxUrl(img.data)}
                            className="p-1 rounded-full bg-white/90 hover:bg-white transition-colors">
                            <ZoomIn className="h-3 w-3 text-gray-700" />
                          </button>
                          <button type="button" onClick={() => removeImage(img.id)}
                            className="p-1 rounded-full bg-white/90 hover:bg-white transition-colors">
                            <XIcon className="h-3 w-3 text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {form.images.length < 5 && (
                      <button type="button" onClick={() => imgInputRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-[#C6AF4B]/50 transition-colors">
                        <ImagePlus className="h-5 w-5 text-gray-300" />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-2">Max 3 MB per image</p>
              </div>

              {/* Stock Control Thresholds */}
              <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: "#B8A240" }}>Stock Control</p>
                  <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">(Optional)</span>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Minimum Level</label>
                    <input type="number" min="0" placeholder="0" value={form.minimumLevel ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, minimumLevel: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900" />
                    {errors.minimumLevel && <p className="text-xs text-red-500">{errors.minimumLevel}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Reorder Level</label>
                    <input type="number" min="0" placeholder="0" value={form.reorderLevel ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, reorderLevel: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900" />
                    {errors.reorderLevel && <p className="text-xs text-red-500">{errors.reorderLevel}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Maximum Level</label>
                    <input type="number" min="0" placeholder="0" value={form.maximumLevel ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, maximumLevel: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900" />
                    {errors.maximumLevel && <p className="text-xs text-red-500">{errors.maximumLevel}</p>}
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-3">Low Stock alert triggers when stock ≤ Reorder Level.</p>
              </div>

              {/* Status */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">Status</p>
                    <p className="text-xs text-gray-400 mt-0.5">{form.isActive ? "Visible and active in the system" : "Hidden from active lists"}</p>
                  </div>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}
                    role="switch" aria-checked={form.isActive}>
                    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                  <span className={`text-sm font-medium min-w-[48px] ${form.isActive ? "text-emerald-600" : "text-gray-400"}`}>
                    {form.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ══ Status Toggle Confirm ══ */}
      <ConfirmModal
        open={!!confirmToggleTarget}
        title="Change Status"
        message={confirmToggleTarget
          ? `Are you sure you want to set material "${confirmToggleTarget.materialCode}" to ${confirmToggleTarget.isActive ? "Inactive" : "Active"}?`
          : ""}
        confirmLabel="Yes, Change"
        cancelLabel="Cancel"
        danger={false}
        onConfirm={handleToggleConfirmed}
        onCancel={() => setConfirmToggleTarget(null)}
        loading={toggleMutation.isPending}
      />

      {/* ══ Delete Confirm ══ */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Material"
        message={deleteTarget ? `Are you sure you want to delete material "${deleteTarget.materialCode}"? This action cannot be undone.` : ""}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />

      {/* ══ Add Item Type mini-modal ══ */}
      <MasterFormModal open={addItemTypeOpen} title="Add Item Type" onClose={() => setAddItemTypeOpen(false)}
        onSubmit={handleAddItemType} submitting={createItemType.isPending} submitLabel="Add">
        <InputField label="Item Type Name" required placeholder="e.g. Thread, Fabric, Button"
          maxLength={50}
          value={newItemTypeName}
          onChange={(e) => setNewItemTypeName(e.target.value.replace(/[^A-Za-z ]/g, ""))} />
      </MasterFormModal>

      {/* ══ Add Unit Type mini-modal ══ */}
      <MasterFormModal open={addUnitTypeOpen} title="Add Unit Type" onClose={() => setAddUnitTypeOpen(false)}
        onSubmit={handleAddUnitType} submitting={createUnitType.isPending} submitLabel="Add">
        <InputField label="Unit Type Name" required placeholder="e.g. Meter, Kg, Piece"
          maxLength={50}
          value={newUnitTypeName}
          onChange={(e) => setNewUnitTypeName(e.target.value.replace(/[^A-Za-z ]/g, ""))} />
      </MasterFormModal>

      {/* ══ Add HSN mini-modal ══ */}
      <MasterFormModal open={addHSNOpen} title="Add HSN Code" onClose={() => setAddHSNOpen(false)}
        onSubmit={handleAddHSN} submitting={createHSN.isPending} submitLabel="Add">
        <InputField label="HSN Code" required placeholder="e.g. 5402" value={hsnForm.hsnCode}
          onChange={(e) => setHsnForm((f) => ({ ...f, hsnCode: e.target.value }))} error={hsnErrors.hsnCode} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">GST Percentage<span className="text-red-500 ml-0.5">*</span></label>
          <select value={hsnForm.gstPercentage} onChange={(e) => setHsnForm((f) => ({ ...f, gstPercentage: e.target.value }))}
            className={`w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-900 ${hsnErrors.gstPercentage ? "border-red-400" : ""}`}>
            <option value="">Select GST %</option>
            {GST_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {hsnErrors.gstPercentage && <p className="text-xs text-red-500">{hsnErrors.gstPercentage}</p>}
        </div>
        <InputField label="Government Description" required placeholder="Official description..." value={hsnForm.govtDescription}
          onChange={(e) => setHsnForm((f) => ({ ...f, govtDescription: e.target.value }))} error={hsnErrors.govtDescription} />
      </MasterFormModal>

      {/* ══ Lightbox ══ */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4" onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxUrl} alt="Preview" className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain" />
            <button onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors">
              <XIcon className="h-4 w-4 text-gray-700" />
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
