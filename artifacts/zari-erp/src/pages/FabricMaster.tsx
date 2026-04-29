import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, ImagePlus, X as XIcon, ZoomIn, ArrowLeft, Save, FileDown, FileUp, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

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
  useFabricList,
  useCreateFabric,
  useUpdateFabric,
  useToggleFabricStatus,
  useDeleteFabric,
  useImportFabrics,
  fetchAllFabricsForExport,
  type FabricRecord,
  type FabricFormData,
  type FabricImportRow,
  type FabricImportResult,
  type MasterImage,
  type StatusFilter,
} from "@/hooks/useFabrics";
import { useWidthUnitTypes, useCreateWidthUnitType, useFabricTypes, useCreateFabricType } from "@/hooks/useLookups";
import { useHSNList, useCreateHSN, type HsnFormData } from "@/hooks/useHSN";
import { useAllVendors } from "@/hooks/useVendors";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";

const NAMED_COLORS = [
  { name: "Black", r: 0, g: 0, b: 0 }, { name: "White", r: 255, g: 255, b: 255 },
  { name: "Red", r: 220, g: 38, b: 38 }, { name: "Dark Red", r: 139, g: 0, b: 0 },
  { name: "Crimson", r: 185, g: 28, b: 28 }, { name: "Rose", r: 244, g: 63, b: 94 },
  { name: "Pink", r: 236, g: 72, b: 153 }, { name: "Hot Pink", r: 255, g: 105, b: 180 },
  { name: "Magenta", r: 217, g: 70, b: 239 }, { name: "Purple", r: 147, g: 51, b: 234 },
  { name: "Deep Purple", r: 88, g: 28, b: 135 }, { name: "Indigo", r: 67, g: 56, b: 202 },
  { name: "Navy Blue", r: 30, g: 27, b: 75 }, { name: "Blue", r: 37, g: 99, b: 235 },
  { name: "Royal Blue", r: 29, g: 78, b: 216 }, { name: "Sky Blue", r: 56, g: 189, b: 248 },
  { name: "Cyan", r: 6, g: 182, b: 212 }, { name: "Teal", r: 13, g: 148, b: 136 },
  { name: "Emerald", r: 16, g: 185, b: 129 }, { name: "Green", r: 22, g: 163, b: 74 },
  { name: "Dark Green", r: 20, g: 83, b: 45 }, { name: "Lime", r: 132, g: 204, b: 22 },
  { name: "Yellow Green", r: 101, g: 163, b: 13 }, { name: "Yellow", r: 234, g: 179, b: 8 },
  { name: "Amber", r: 245, g: 158, b: 11 }, { name: "Orange", r: 249, g: 115, b: 22 },
  { name: "Dark Orange", r: 194, g: 65, b: 12 }, { name: "Brown", r: 120, g: 53, b: 15 },
  { name: "Chocolate", r: 92, g: 45, b: 10 }, { name: "Tan", r: 210, g: 180, b: 140 },
  { name: "Beige", r: 245, g: 245, b: 220 }, { name: "Ivory", r: 255, g: 255, b: 240 },
  { name: "Cream", r: 255, g: 253, b: 208 }, { name: "Gold", r: 198, g: 175, b: 75 },
  { name: "Silver", r: 192, g: 192, b: 192 }, { name: "Gray", r: 107, g: 114, b: 128 },
  { name: "Light Gray", r: 209, g: 213, b: 219 }, { name: "Dark Gray", r: 55, g: 65, b: 81 },
  { name: "Charcoal", r: 30, g: 41, b: 59 }, { name: "Slate", r: 71, g: 85, b: 105 },
  { name: "Turquoise", r: 45, g: 212, b: 191 }, { name: "Lavender", r: 167, g: 139, b: 250 },
  { name: "Violet", r: 124, g: 58, b: 237 }, { name: "Maroon", r: 128, g: 0, b: 0 },
  { name: "Coral", r: 249, g: 115, b: 22 }, { name: "Salmon", r: 252, g: 165, b: 165 },
  { name: "Peach", r: 253, g: 186, b: 116 }, { name: "Mint", r: 167, g: 243, b: 208 },
  { name: "Olive", r: 107, g: 114, b: 0 }, { name: "Khaki", r: 189, g: 183, b: 107 },
];

function hexToColorName(hex: string): string {
  if (!hex || hex.length < 7) return "";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  let closest = ""; let minDist = Infinity;
  for (const c of NAMED_COLORS) {
    const d = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
    if (d < minDist) { minDist = d; closest = c.name; }
  }
  return closest;
}

const EMPTY_FORM: FabricFormData = {
  fabricType: "", quality: "", color: "#c9b45c", hexCode: "#c9b45c",
  colorName: "", width: "", height: "", widthUnitType: "", pricePerMeter: "",
  unitType: "", currentStock: "", hsnCode: "", gstPercent: "",
  vendor: "", location: "", locationStocks: [], isActive: true, images: [],
  reorderLevel: "", minimumLevel: "", maximumLevel: "",
};

type FormErrors = Partial<Record<keyof FabricFormData, string>>;
const EMPTY_HSN_FORM: HsnFormData = { hsnCode: "", gstPercentage: "", govtDescription: "", isActive: true };
type HsnErrors = Partial<Record<keyof HsnFormData, string>>;

const GST_OPTIONS = [
  { value: "0", label: "0%" }, { value: "5", label: "5%" },
  { value: "12", label: "12%" }, { value: "18", label: "18%" }, { value: "28", label: "28%" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" },
];

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

export default function FabricMaster() {
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
  const [fabricTypeFilter, setFabricTypeFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [hsnCodeFilter, setHsnCodeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  useEffect(() => { const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);

  const hasFilters = statusFilter !== "all" || fabricTypeFilter || vendorFilter || hsnCodeFilter;

  const { data, isLoading } = useFabricList({
    search: debouncedSearch, status: statusFilter,
    fabricType: fabricTypeFilter, vendor: vendorFilter, hsnCode: hsnCodeFilter,
    page, limit,
  });
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const createMutation = useCreateFabric();
  const updateMutation = useUpdateFabric();
  const toggleMutation = useToggleFabricStatus();
  const deleteMutation = useDeleteFabric();
  const importMutation = useImportFabrics();

  const { data: fabricTypes = [] } = useFabricTypes();
  const { data: widthUnitTypes = [] } = useWidthUnitTypes();
  const createFabricType = useCreateFabricType();
  const createWidthUnitType = useCreateWidthUnitType();
  const createHSN = useCreateHSN();

  const { data: hsnData } = useHSNList({ search: "", status: "active", page: 1, limit: 200 });
  const { data: allVendors = [] } = useAllVendors();
  const { data: rawWarehouses } = useWarehouseLocations();
  const warehouseLocations = Array.isArray(rawWarehouses) ? rawWarehouses : [];
  const hsnOptions = hsnData?.data ?? [];
  const locationOptions = [
    "Out-house",
    ...warehouseLocations.filter(w => w.isActive).map(w => w.name),
  ];

  const [viewMode, setViewMode] = useState<"list" | "form">("list");
  const [editRecord, setEditRecord] = useState<FabricRecord | null>(null);
  const [form, setForm] = useState<FabricFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<FabricRecord | null>(null);
  const [confirmToggleTarget, setConfirmToggleTarget] = useState<FabricRecord | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [vendorPickerOpen, setVendorPickerOpen] = useState(false);
  const [vendorPickerSearch, setVendorPickerSearch] = useState("");
  const imgInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const vendorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setImportMenuOpen(false);
      }
      if (vendorPickerRef.current && !vendorPickerRef.current.contains(e.target as Node)) {
        setVendorPickerOpen(false);
        setVendorPickerSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [addFabricTypeOpen, setAddFabricTypeOpen] = useState(false);
  const [newFabricTypeName, setNewFabricTypeName] = useState("");
  const [addWidthUnitTypeOpen, setAddWidthUnitTypeOpen] = useState(false);
  const [newWidthUnitTypeName, setNewWidthUnitTypeName] = useState("");
  const [addHSNOpen, setAddHSNOpen] = useState(false);
  const [hsnForm, setHsnForm] = useState<HsnFormData>(EMPTY_HSN_FORM);
  const [hsnErrors, setHsnErrors] = useState<HsnErrors>({});

  const openAdd = () => { setEditRecord(null); setForm(EMPTY_FORM); setErrors({}); setViewMode("form"); };
  const openEdit = (r: FabricRecord) => {
    setEditRecord(r);
    const existingStocks = r.locationStocks?.length
      ? r.locationStocks
      : r.currentStock ? [{ location: r.location ?? "Out-house", stock: r.currentStock }] : [];
    setForm({ fabricType: r.fabricType, quality: r.quality, color: r.color ?? "#c9b45c",
      hexCode: r.hexCode ?? "#c9b45c", colorName: r.colorName, width: r.width, height: r.height ?? "",
      widthUnitType: r.widthUnitType, pricePerMeter: r.pricePerMeter, unitType: r.unitType,
      currentStock: r.currentStock, hsnCode: r.hsnCode, gstPercent: r.gstPercent,
      vendor: r.vendor ?? "", location: r.location ?? "", locationStocks: existingStocks,
      isActive: r.isActive, images: r.images ?? [],
      reorderLevel: r.reorderLevel ?? "", minimumLevel: r.minimumLevel ?? "", maximumLevel: r.maximumLevel ?? "" });
    setErrors({});
    setViewMode("form");
  };

  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = 5 - form.images.length;
    const toAdd = Array.from(files).slice(0, remaining);
    toAdd.forEach(file => {
      if (file.size > 3 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds 3MB`, variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result as string;
        const img: MasterImage = { id: Math.random().toString(36).slice(2), name: file.name, data, size: file.size };
        setForm(f => ({ ...f, images: [...f.images, img] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (id: string) => {
    setForm(f => ({ ...f, images: f.images.filter(img => img.id !== id) }));
  };

  const addLocationStock = () => {
    setForm(f => ({ ...f, locationStocks: [...f.locationStocks, { location: "", stock: "" }] }));
  };
  const removeLocationStock = (idx: number) => {
    setForm(f => ({ ...f, locationStocks: f.locationStocks.filter((_, i) => i !== idx) }));
  };
  const updateLocationStock = (idx: number, field: "location" | "stock", value: string) => {
    setForm(f => ({
      ...f,
      locationStocks: f.locationStocks.map((ls, i) => i === idx ? { ...ls, [field]: value } : ls),
    }));
  };
  const totalStock = form.locationStocks.reduce((sum, ls) => sum + (parseFloat(ls.stock) || 0), 0);

  const NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
  const NUMERIC_REGEX = /^[0-9]+(\.[0-9]{1,2})?$/;

  const validate = (): boolean => {
    const e: FormErrors = {};
    const ft = form.fabricType.trim();
    const q = form.quality.trim();
    const cn = form.colorName.trim();
    const w = form.width.trim();
    const pm = form.pricePerMeter.trim();

    if (!ft) e.fabricType = "Fabric Type is required.";
    else if (!NAME_REGEX.test(ft) || ft.length > 100) e.fabricType = "Fabric Type must contain only letters and spaces (max 100 characters).";
    if (!q) e.quality = "Quality is required.";
    else if (!NAME_REGEX.test(q) || q.length > 100) e.quality = "Quality must contain only letters and spaces (max 100 characters).";
    if (!cn) e.colorName = "Color Name is required.";
    else if (!NAME_REGEX.test(cn) || cn.length > 100) e.colorName = "Color Name must contain only letters and spaces (max 100 characters).";
    if (!w) e.width = "Width is required.";
    else if (!NUMERIC_REGEX.test(w) || parseFloat(w) <= 0) e.width = "Width must be a positive numeric value.";
    if (!form.widthUnitType) e.widthUnitType = "Width Unit Type is required.";
    if (!pm) e.pricePerMeter = "Price Per Meter is required.";
    else if (!NUMERIC_REGEX.test(pm) || parseFloat(pm) <= 0) e.pricePerMeter = "Price must be a positive numeric value.";
    if (!form.hsnCode) e.hsnCode = "HSN Code is required.";
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
    const computedStock = String(totalStock);
    const computedLocation = form.locationStocks.map(ls => ls.location).filter(Boolean).join(", ") || undefined;
    const submitData: FabricFormData = {
      ...form,
      fabricType: form.fabricType.trim(),
      quality: form.quality.trim(),
      colorName: form.colorName.trim(),
      width: form.width.trim(),
      pricePerMeter: form.pricePerMeter.trim(),
      currentStock: computedStock || "0",
      location: computedLocation,
    };
    try {
      if (editRecord) {
        await updateMutation.mutateAsync({ id: editRecord.id, data: submitData });
        toast({ title: "Updated", description: `Fabric ${editRecord.fabricCode} updated successfully.` });
      } else {
        await createMutation.mutateAsync(submitData);
        toast({ title: "Created", description: "Fabric created successfully." });
      }
      setViewMode("list");
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "An error occurred.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleToggleConfirmed = async () => {
    if (!confirmToggleTarget) return;
    try {
      await toggleMutation.mutateAsync(confirmToggleTarget.id);
      toast({ title: "Status Updated", description: `${confirmToggleTarget.fabricCode} is now ${confirmToggleTarget.isActive ? "Inactive" : "Active"}.` });
      setConfirmToggleTarget(null);
    } catch { toast({ title: "Error", description: "Failed to update status.", variant: "destructive" }); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({ title: "Deleted", description: `Fabric ${deleteTarget.fabricCode} deleted.` });
      setDeleteTarget(null);
    } catch { toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }); }
  };

  const handleAddFabricType = async () => {
    const val = newFabricTypeName.trim();
    if (!val) { toast({ title: "Validation Error", description: "Fabric Type cannot be empty.", variant: "destructive" }); return; }
    if (!NAME_REGEX.test(val) || val.length > 100) { toast({ title: "Validation Error", description: "Fabric Type must contain only letters and spaces (max 100 characters).", variant: "destructive" }); return; }
    try {
      await createFabricType.mutateAsync({ name: val, isActive: true });
      setForm((f) => ({ ...f, fabricType: val }));
      setNewFabricTypeName(""); setAddFabricTypeOpen(false);
    } catch { toast({ title: "Error", description: "Failed to add fabric type.", variant: "destructive" }); }
  };

  const handleAddWidthUnitType = async () => {
    const val = newWidthUnitTypeName.trim();
    if (!val) { toast({ title: "Validation Error", description: "Width Unit Type cannot be empty.", variant: "destructive" }); return; }
    if (!NAME_REGEX.test(val) || val.length > 50) { toast({ title: "Validation Error", description: "Width Unit Type must contain only letters (max 50 characters).", variant: "destructive" }); return; }
    try {
      await createWidthUnitType.mutateAsync({ name: val, isActive: true });
      setForm((f) => ({ ...f, widthUnitType: val }));
      setNewWidthUnitTypeName(""); setAddWidthUnitTypeOpen(false);
    } catch { toast({ title: "Error", description: "Failed to add width unit type.", variant: "destructive" }); }
  };

  const downloadSample = () => {
    const sampleRows = [
      { "Fabric Type": "Cotton", "Quality": "Super Fine", "Color Name": "Ivory White", "Color Hex": "#FFFFF0", "Width": "44", "Height": "", "Width Unit Type": "Inch", "Unit Type": "Meter", "Price Per Meter": "180.00", "HSN Code": "52081100", "GST %": "5", "Vendor": "" },
      { "Fabric Type": "Silk", "Quality": "Premium", "Color Name": "Royal Blue", "Color Hex": "#4169E1", "Width": "36", "Height": "", "Width Unit Type": "Inch", "Unit Type": "Meter", "Price Per Meter": "650.00", "HSN Code": "50072000", "GST %": "5", "Vendor": "" },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fabrics");
    XLSX.writeFile(wb, "Fabric_Import_Sample.xlsx");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const rows: FabricImportRow[] = raw.map((r) => ({
        fabricType: String(r["Fabric Type"] ?? "").trim(),
        quality: String(r["Quality"] ?? "").trim(),
        colorName: String(r["Color Name"] ?? "").trim(),
        hexCode: String(r["Color Hex"] ?? "").trim() || undefined,
        width: String(r["Width"] ?? "").trim(),
        height: String(r["Height"] ?? "").trim() || undefined,
        widthUnitType: String(r["Width Unit Type"] ?? "").trim(),
        unitType: String(r["Unit Type"] ?? "").trim() || undefined,
        pricePerMeter: String(r["Price Per Meter"] ?? "").trim(),
        hsnCode: String(r["HSN Code"] ?? "").trim(),
        gstPercent: String(r["GST %"] ?? "").trim() || undefined,
        vendor: String(r["Vendor"] ?? "").trim() || undefined,
      }));
      if (rows.length === 0) { toast({ title: "Empty File", description: "No data rows found in the file.", variant: "destructive" }); return; }
      const importRaw = await importMutation.mutateAsync(rows);
      const result = (importRaw as unknown) as FabricImportResult;
      const hasErrors = result.errors.length > 0;
      toast({
        title: hasErrors ? `Imported with errors` : "Import Successful",
        description: `${result.imported} imported, ${result.skipped} skipped.${hasErrors ? " Check console for row errors." : ""}`,
        variant: hasErrors ? "destructive" : "default",
      });
      if (hasErrors) console.warn("Import row errors:", result.errors);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Import failed.";
      toast({ title: "Import Error", description: msg, variant: "destructive" });
    } finally {
      setImportLoading(false);
      setImportMenuOpen(false);
    }
  };

  const handleExportAll = async () => {
    setExportLoading(true);
    try {
      const result = await fetchAllFabricsForExport({
        search: debouncedSearch, status: statusFilter,
        fabricType: fabricTypeFilter, vendor: vendorFilter, hsnCode: hsnCodeFilter,
      });
      const exRows = result.data.map((r) => ({
        Code: r.fabricCode, Type: r.fabricType, Quality: r.quality,
        "Color Name": r.colorName, "Hex Code": r.hexCode ?? "",
        Width: r.width, "Width Unit": r.widthUnitType,
        "Price/Meter": r.pricePerMeter, "Unit Type": r.unitType,
        "Current Stock": r.currentStock, "HSN Code": r.hsnCode,
        "GST %": r.gstPercent, Vendor: r.vendor ?? "", Location: r.location ?? "",
        Status: r.isActive ? "Active" : "Inactive",
        "Created By": r.createdBy, "Created At": formatDate(r.createdAt),
        "Updated By": r.updatedBy ?? "", "Updated At": formatDate(r.updatedAt),
      }));
      const ws = XLSX.utils.json_to_sheet(exRows);
      const wb2 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb2, ws, "Fabrics");
      XLSX.writeFile(wb2, "Fabric_Master.xlsx");
    } catch {
      toast({ title: "Export Error", description: "Failed to export fabrics.", variant: "destructive" });
    } finally {
      setExportLoading(false);
    }
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
      setHsnForm(EMPTY_HSN_FORM); setHsnErrors({}); setAddHSNOpen(false);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to add HSN.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const asFab = (r: TableRow) => r as unknown as FabricRecord;
  const fabricTypeOptions = fabricTypes.filter((t) => t.isActive).map((t) => ({ value: t.name, label: t.name }));
  const widthUnitTypeOptions = widthUnitTypes.filter((t) => t.isActive).map((t) => ({ value: t.name, label: t.name }));
  const hsnDropdownOptions = hsnOptions.map((h) => ({ value: h.hsnCode, label: `${h.hsnCode} (${h.gstPercentage}%)` }));

  const columns: Column[] = [
    {
      key: "srNo", label: "Sr No", className: "w-14 text-center",
      render: (r) => {
        const idx = rows.findIndex((row) => row.id === asFab(r).id);
        return <span className="text-gray-400 text-xs font-medium">{(page - 1) * limit + (idx === -1 ? 0 : idx) + 1}</span>;
      },
    },
    {
      key: "image", label: "Image", className: "w-14",
      render: (r) => {
        const imgs = asFab(r).images ?? [];
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
            {imgs.length > 1 && (
              <span className="absolute bottom-0 right-0 text-[9px] font-bold bg-black/60 text-white px-0.5 rounded-tl-md">+{imgs.length - 1}</span>
            )}
          </button>
        );
      },
    },
    { key: "fabricCode", label: "Code", render: (r) => <span className="font-mono font-semibold text-gray-900">{asFab(r).fabricCode}</span> },
    { key: "fabricType", label: "Type", render: (r) => <span className="text-gray-700">{asFab(r).fabricType}</span> },
    { key: "quality", label: "Quality", render: (r) => <span className="text-gray-700">{asFab(r).quality}</span> },
    {
      key: "colorName", label: "Color Name",
      render: (r) => (
        <div className="flex items-center gap-2">
          {asFab(r).hexCode && (
            <span className="h-4 w-4 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: asFab(r).hexCode ?? undefined }} />
          )}
          <span className="text-gray-700">{asFab(r).colorName}</span>
        </div>
      ),
    },
    { key: "pricePerMeter", label: "Price/Meter", render: (r) => <span className="font-medium">₹{asFab(r).pricePerMeter}</span> },
    { key: "unitType", label: "Unit Type", render: (r) => <span className="text-gray-500">{asFab(r).unitType}</span> },
    { key: "hsnCode", label: "HSN Code", render: (r) => <span className="font-mono text-gray-700">{asFab(r).hsnCode}</span> },
    { key: "gstPercent", label: "GST %", render: (r) => <span>{asFab(r).gstPercent}%</span> },
    { key: "currentStock", label: "Current Stock", render: (r) => <span className="font-medium">{asFab(r).currentStock}</span> },
    {
      key: "isActive", label: "Status",
      render: (r) => <StatusToggle isActive={asFab(r).isActive} onToggle={() => setConfirmToggleTarget(asFab(r))} loading={toggleMutation.isPending && confirmToggleTarget?.id === asFab(r).id} />,
    },
    { key: "createdBy", label: "Created By", render: (r) => <span className="text-gray-500">{asFab(r).createdBy}</span> },
    { key: "createdAt", label: "Created At", render: (r) => <span className="text-gray-500 whitespace-nowrap">{formatDate(asFab(r).createdAt)}</span> },
    { key: "updatedBy", label: "Updated By", render: (r) => <span className="text-gray-500">{asFab(r).updatedBy ?? "—"}</span> },
    { key: "updatedAt", label: "Updated At", render: (r) => <span className="text-gray-500 whitespace-nowrap">{formatDate(asFab(r).updatedAt)}</span> },
    {
      key: "actions", label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEdit(asFab(r))} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteTarget(asFab(r))} disabled={deleteMutation.isPending} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];


  const submitting = createMutation.isPending || updateMutation.isPending;
  if (!user) return null;

  const sectionLabel = (title: string) => (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C6AF4B]">{title}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>

      {/* ══════════════ LIST VIEW ══════════════ */}
      {viewMode === "list" && (
        <div className="max-w-screen-xl mx-auto space-y-5">
          <MasterHeader title="Fabric Master" onAdd={openAdd} addLabel="Add Fabric" />

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by code, type, quality, color, HSN..." />
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
                      onClick={() => { downloadSample(); setImportMenuOpen(false); }}
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
              <select value={fabricTypeFilter} onChange={(e) => { setFabricTypeFilter(e.target.value); setPage(1); }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
                <option value="">All Fabric Types</option>
                {fabricTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
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
              {hasFilters && (
                <button onClick={() => { setStatusFilter("all"); setFabricTypeFilter(""); setVendorFilter(""); setHsnCodeFilter(""); setPage(1); }}
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
            rowKey={(r) => asFab(r).id}
            emptyText="No fabric records found. Click 'Add Fabric' to create one."
            pagination={{ page, limit, total, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }}
          />
        </div>
      )}

      {/* ══════════════ FORM VIEW ══════════════ */}
      {viewMode === "form" && (
        <div className="max-w-screen-xl mx-auto pb-12">

          {/* Page header bar */}
          <div className="flex items-center justify-between py-4 mb-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("list")}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                Fabric Master
              </button>
              <span className="text-gray-300 select-none">/</span>
              <h1 className="text-base font-semibold text-gray-900">
                {editRecord ? `Edit Fabric — ${editRecord.fabricCode}` : "Add Fabric"}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode("list")}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: "#C6AF4B" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#b89d3e")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#C6AF4B")}
              >
                <Save className="h-4 w-4" />
                {submitting ? "Saving…" : editRecord ? "Update Fabric" : "Create Fabric"}
              </button>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-3 gap-6">

            {/* ── Left column: main fields ── */}
            <div className="col-span-2 space-y-5">

              {/* Basic Info */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                {sectionLabel("Basic Info")}
                <div className="grid grid-cols-2 gap-4">
                  <AddableSelect
                    label="Fabric Type" required value={form.fabricType}
                    onChange={(v) => setForm((f) => ({ ...f, fabricType: v }))}
                    onAdd={() => { setNewFabricTypeName(""); setAddFabricTypeOpen(true); }}
                    addLabel="+ Add Type"
                    options={fabricTypeOptions} placeholder="Select Fabric Type" error={errors.fabricType}
                  />
                  <InputField label="Quality" required placeholder="e.g. Premium, Standard" value={form.quality}
                    onChange={(e) => setForm((f) => ({ ...f, quality: e.target.value }))} error={errors.quality} />
                </div>
              </div>

              {/* Color */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                {sectionLabel("Color")}
                <div className="flex gap-5 items-start">
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <label className="text-sm font-medium text-gray-700">Color Picker</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={form.hexCode || "#c9b45c"}
                        onChange={(e) => setForm((f) => ({ ...f, hexCode: e.target.value, color: e.target.value, colorName: hexToColorName(e.target.value) }))}
                        className="h-[42px] w-14 rounded-lg border border-gray-300 cursor-pointer p-0.5 shrink-0"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Hex</span>
                        <span className="font-mono text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1 min-w-[88px]">
                          {form.hexCode || "#c9b45c"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Color Name <span className="text-red-500">*</span>
                      <span className="text-[10px] text-gray-400 font-normal ml-1">(auto-filled — edit to customise)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ivory White, Dark Red"
                      value={form.colorName}
                      onChange={(e) => setForm((f) => ({ ...f, colorName: e.target.value }))}
                      className={`rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-gray-900/10 ${errors.colorName ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-gray-900"}`}
                    />
                    {errors.colorName && <p className="text-xs text-red-500">{errors.colorName}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <label className="text-sm font-medium text-gray-700 invisible">Preview</label>
                    <div className="flex items-center gap-2">
                      <div className="h-[42px] w-[42px] rounded-xl border border-gray-200 shadow-sm" style={{ backgroundColor: form.hexCode || "#c9b45c" }} />
                      <div className="h-[42px] w-[42px] rounded-xl border border-gray-200 shadow-sm opacity-60" style={{ backgroundColor: form.hexCode || "#c9b45c", filter: "brightness(1.35)" }} />
                      <div className="h-[42px] w-[42px] rounded-xl border border-gray-200 shadow-sm opacity-40" style={{ backgroundColor: form.hexCode || "#c9b45c", filter: "brightness(1.7)" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dimensions & Unit */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                {sectionLabel("Dimensions & Unit")}
                <div className="grid grid-cols-4 gap-4">
                  <InputField label="Width" required placeholder="e.g. 1.5" type="number" value={form.width}
                    onChange={(e) => setForm((f) => ({ ...f, width: e.target.value }))} error={errors.width} />
                  <InputField label="Height" placeholder="e.g. 2.0" type="number" value={form.height ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))} />
                  <AddableSelect
                    label="Width Unit Type" required value={form.widthUnitType}
                    onChange={(v) => setForm((f) => ({ ...f, widthUnitType: v }))}
                    onAdd={() => { setNewWidthUnitTypeName(""); setAddWidthUnitTypeOpen(true); }}
                    addLabel="+ Add Unit"
                    options={widthUnitTypeOptions} placeholder="Select Unit" error={errors.widthUnitType}
                  />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Unit Type</label>
                    <input
                      type="text"
                      placeholder="e.g. Meters, Yards"
                      value={form.unitType ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, unitType: e.target.value }))}
                      className="rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing & Tax */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                {sectionLabel("Pricing & Tax")}
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Price Per Meter (₹)" required placeholder="e.g. 350" type="text" value={form.pricePerMeter}
                    maxLength={12}
                    onChange={(e) => setForm((f) => ({ ...f, pricePerMeter: e.target.value }))} error={errors.pricePerMeter} />
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
                    <div className="relative">
                      <input type="text" readOnly value={form.gstPercent ? `${form.gstPercent}%` : ""}
                        placeholder="Auto-filled from HSN"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500 outline-none cursor-default" />
                      {form.gstPercent && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">AUTO</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sourcing */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                {sectionLabel("Sourcing")}
                {(() => {
                  const selectedVendors = (form.vendor ?? "").split(",").map(v => v.trim()).filter(Boolean);
                  const availableVendors: string[] = (allVendors.map(v => v.brandName) as string[])
                    .filter((n: string) => !selectedVendors.includes(n))
                    .filter((n: string) => !vendorPickerSearch || n.toLowerCase().includes(vendorPickerSearch.toLowerCase()));
                  const addVendor = (name: string) => {
                    const next = [...selectedVendors, name].join(", ");
                    setForm(f => ({ ...f, vendor: next }));
                  };
                  const removeVendor = (name: string) => {
                    const next = selectedVendors.filter(v => v !== name).join(", ");
                    setForm(f => ({ ...f, vendor: next || undefined }));
                  };
                  return (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-gray-700">Preferred Vendors</label>

                      {/* Selected chips */}
                      {selectedVendors.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          {selectedVendors.map(name => (
                            <span key={name} className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-[#C9B45C]/40 px-2.5 py-1 text-xs font-medium text-gray-700">
                              {name}
                              <button type="button" onClick={() => removeVendor(name)}
                                className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors leading-none">
                                <XIcon className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Dropdown trigger */}
                      <div className="relative" ref={vendorPickerRef}>
                        <button type="button"
                          onClick={() => { setVendorPickerOpen(v => !v); setVendorPickerSearch(""); }}
                          className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-500 shadow-sm outline-none transition hover:border-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                        >
                          <span>{selectedVendors.length === 0 ? "Select vendors…" : `${selectedVendors.length} selected`}</span>
                          <svg className={`h-4 w-4 text-gray-400 transition-transform ${vendorPickerOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>

                        {vendorPickerOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border border-gray-100 bg-white shadow-lg overflow-hidden">
                            {/* Search */}
                            <div className="px-3 pt-2.5 pb-1.5 border-b border-gray-100">
                              <input
                                autoFocus
                                value={vendorPickerSearch}
                                onChange={e => setVendorPickerSearch(e.target.value)}
                                placeholder="Search vendors…"
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-gray-400"
                              />
                            </div>
                            {/* List */}
                            <div className="max-h-48 overflow-y-auto py-1">
                              {availableVendors.length === 0 ? (
                                <p className="px-4 py-3 text-sm text-gray-400 text-center">
                                  {vendorPickerSearch ? "No vendors match your search" : "All vendors selected"}
                                </p>
                              ) : (
                                availableVendors.map(name => (
                                  <button key={name} type="button"
                                    onClick={() => { addVendor(name); setVendorPickerSearch(""); }}
                                    className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-amber-50/60 hover:text-gray-900 transition-colors text-left"
                                  >
                                    {name}
                                  </button>
                                ))
                              )}
                            </div>
                            {/* Clear all */}
                            {selectedVendors.length > 0 && (
                              <div className="border-t border-gray-100 px-3 py-2">
                                <button type="button" onClick={() => { setForm(f => ({ ...f, vendor: undefined })); setVendorPickerOpen(false); }}
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
                        · Total: <span className="font-semibold text-gray-800">{totalStock} {form.widthUnitType || "units"}</span>
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
                        <input
                          list={`loc-list-${idx}`}
                          value={ls.location}
                          onChange={e => updateLocationStock(idx, "location", e.target.value)}
                          placeholder="Type or select location"
                          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                        <datalist id={`loc-list-${idx}`}>
                          {locationOptions.map(l => <option key={l} value={l} />)}
                        </datalist>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-gray-500 whitespace-nowrap">Stock:</span>
                          <input type="number" min="0" placeholder="0" value={ls.stock}
                            onChange={e => updateLocationStock(idx, "stock", e.target.value)}
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
                        Total Stock: <span className="text-indigo-700">{totalStock} {form.widthUnitType || "units"}</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Right column: images · controls · status ── */}
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
                  <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => handleImageFiles(e.target.files)} />
                </div>
                {form.images.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center py-10 gap-2 cursor-pointer hover:border-[#C6AF4B]/50 transition-colors"
                    onClick={() => imgInputRef.current?.click()}>
                    <ImagePlus className="h-8 w-8 text-gray-300" />
                    <p className="text-xs text-gray-400 text-center">Click to add images<br />(JPG, PNG, WebP · max 3 MB)</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {form.images.map(img => (
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
                      onChange={(e) => setForm(f => ({ ...f, minimumLevel: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900" />
                    {errors.minimumLevel && <p className="text-xs text-red-500">{errors.minimumLevel}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Reorder Level</label>
                    <input type="number" min="0" placeholder="0" value={form.reorderLevel ?? ""}
                      onChange={(e) => setForm(f => ({ ...f, reorderLevel: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900" />
                    {errors.reorderLevel && <p className="text-xs text-red-500">{errors.reorderLevel}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Maximum Level</label>
                    <input type="number" min="0" placeholder="0" value={form.maximumLevel ?? ""}
                      onChange={(e) => setForm(f => ({ ...f, maximumLevel: e.target.value }))}
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
          ? `Are you sure you want to set fabric "${confirmToggleTarget.fabricCode}" to ${confirmToggleTarget.isActive ? "Inactive" : "Active"}?`
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
        title="Delete Fabric"
        message={deleteTarget ? `Are you sure you want to delete fabric "${deleteTarget.fabricCode}"? This action cannot be undone.` : ""}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />

      {/* ══ Add Fabric Type mini-modal ══ */}
      <MasterFormModal open={addFabricTypeOpen} title="Add Fabric Type" onClose={() => setAddFabricTypeOpen(false)}
        onSubmit={handleAddFabricType} submitting={createFabricType.isPending} submitLabel="Add">
        <InputField label="Fabric Type Name" required placeholder="e.g. Cotton, Silk, Velvet" value={newFabricTypeName}
          onChange={(e) => setNewFabricTypeName(e.target.value)} />
      </MasterFormModal>

      {/* ══ Add Width Unit Type mini-modal ══ */}
      <MasterFormModal open={addWidthUnitTypeOpen} title="Add Width Unit Type" onClose={() => setAddWidthUnitTypeOpen(false)}
        onSubmit={handleAddWidthUnitType} submitting={createWidthUnitType.isPending} submitLabel="Add">
        <InputField label="Width Unit Type Name" required placeholder="e.g. cm, inches" value={newWidthUnitTypeName}
          maxLength={50}
          onChange={(e) => setNewWidthUnitTypeName(e.target.value.replace(/[^A-Za-z ]/g, ""))} />
      </MasterFormModal>

      {/* ══ Add HSN mini-modal ══ */}
      <MasterFormModal open={addHSNOpen} title="Add HSN Code" onClose={() => setAddHSNOpen(false)}
        onSubmit={handleAddHSN} submitting={createHSN.isPending} submitLabel="Add">
        <InputField label="HSN Code" required placeholder="e.g. 63019090" value={hsnForm.hsnCode}
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-3xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
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
