import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, ImagePlus, X as XIcon, ZoomIn } from "lucide-react";
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
import AddableSelect from "@/components/ui/AddableSelect";
import SearchableSelect from "@/components/ui/SearchableSelect";

import {
  useFabricList,
  useCreateFabric,
  useUpdateFabric,
  useToggleFabricStatus,
  useDeleteFabric,
  type FabricRecord,
  type FabricFormData,
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<FabricRecord | null>(null);
  const [form, setForm] = useState<FabricFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<FabricRecord | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [addFabricTypeOpen, setAddFabricTypeOpen] = useState(false);
  const [newFabricTypeName, setNewFabricTypeName] = useState("");
  const [addWidthUnitTypeOpen, setAddWidthUnitTypeOpen] = useState(false);
  const [newWidthUnitTypeName, setNewWidthUnitTypeName] = useState("");
  const [addHSNOpen, setAddHSNOpen] = useState(false);
  const [hsnForm, setHsnForm] = useState<HsnFormData>(EMPTY_HSN_FORM);
  const [hsnErrors, setHsnErrors] = useState<HsnErrors>({});

  const openAdd = () => { setEditRecord(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true); };
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
    setModalOpen(true);
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

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.fabricType.trim()) e.fabricType = "Fabric Type is required";
    if (!form.quality.trim()) e.quality = "Quality is required";
    if (!form.colorName.trim()) e.colorName = "Color Name is required";
    if (!form.width.trim()) e.width = "Width is required";
    if (!form.widthUnitType) e.widthUnitType = "Width Unit Type is required";
    if (!form.pricePerMeter.trim()) e.pricePerMeter = "Price Per Meter is required";
    if (!form.hsnCode) e.hsnCode = "HSN Code is required";
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
      currentStock: computedStock || "0",
      location: computedLocation,
    };
    try {
      if (editRecord) {
        await updateMutation.mutateAsync({ id: editRecord.id, data: submitData });
        toast({ title: "Updated", description: `Fabric ${editRecord.fabricCode} updated.` });
      } else {
        await createMutation.mutateAsync(submitData);
        toast({ title: "Created", description: "New fabric created successfully." });
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "An error occurred.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleToggle = async (r: FabricRecord) => {
    try {
      await toggleMutation.mutateAsync(r.id);
      toast({ title: "Status Updated", description: `${r.fabricCode} is now ${r.isActive ? "Inactive" : "Active"}.` });
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
    if (!newFabricTypeName.trim()) return;
    try {
      await createFabricType.mutateAsync({ name: newFabricTypeName.trim(), isActive: true });
      setForm((f) => ({ ...f, fabricType: newFabricTypeName.trim() }));
      setNewFabricTypeName(""); setAddFabricTypeOpen(false);
    } catch { toast({ title: "Error", description: "Failed to add fabric type.", variant: "destructive" }); }
  };

  const handleAddWidthUnitType = async () => {
    if (!newWidthUnitTypeName.trim()) return;
    try {
      await createWidthUnitType.mutateAsync({ name: newWidthUnitTypeName.trim(), isActive: true });
      setForm((f) => ({ ...f, widthUnitType: newWidthUnitTypeName.trim() }));
      setNewWidthUnitTypeName(""); setAddWidthUnitTypeOpen(false);
    } catch { toast({ title: "Error", description: "Failed to add width unit type.", variant: "destructive" }); }
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
      render: (r) => <StatusToggle isActive={asFab(r).isActive} onToggle={() => handleToggle(asFab(r))} loading={toggleMutation.isPending} />,
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

  const exportColumns: ExportColumn[] = [
    { key: "fabricCode", label: "Code" }, { key: "fabricType", label: "Type" }, { key: "quality", label: "Quality" },
    { key: "colorName", label: "Color Name" }, { key: "hexCode", label: "Hex Code" },
    { key: "width", label: "Width" }, { key: "widthUnitType", label: "Width Unit" },
    { key: "pricePerMeter", label: "Price/Meter" }, { key: "unitType", label: "Unit Type" },
    { key: "currentStock", label: "Current Stock" }, { key: "hsnCode", label: "HSN Code" },
    { key: "gstPercent", label: "GST %" }, { key: "vendor", label: "Vendor" }, { key: "location", label: "Location" },
    { key: "isActive", label: "Status" }, { key: "createdBy", label: "Created By" }, { key: "createdAt", label: "Created At" },
    { key: "updatedBy", label: "Updated By" }, { key: "updatedAt", label: "Updated At" },
  ];

  const submitting = createMutation.isPending || updateMutation.isPending;
  if (!user) return null;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Fabric Master" onAdd={openAdd} addLabel="Add Fabric" />

        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by code, type, quality, color, HSN..." />
            </div>
            <ExportExcelButton data={rows as Record<string, unknown>[]} filename="Fabric_Master" columns={exportColumns} disabled={isLoading} />
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

      {/* Add / Edit Modal */}
      <MasterFormModal
        open={modalOpen}
        title={editRecord ? `Edit Fabric — ${editRecord.fabricCode}` : "Add Fabric"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editRecord ? "Update" : "Create"}
        size="xl"
      >
        <div className="grid grid-cols-2 gap-4">
          <AddableSelect
            label="Fabric Type" required value={form.fabricType}
            onChange={(v) => setForm((f) => ({ ...f, fabricType: v }))}
            onAdd={() => { setNewFabricTypeName(""); setAddFabricTypeOpen(true); }}
            addLabel="+ Add Type"
            options={fabricTypeOptions} placeholder="Select Fabric Type" error={errors.fabricType}
          />
          <InputField label="Quality" required placeholder="e.g. Premium" value={form.quality}
            onChange={(e) => setForm((f) => ({ ...f, quality: e.target.value }))} error={errors.quality} />

          {/* Color picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Color</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={form.hexCode || "#c9b45c"}
                onChange={(e) => setForm((f) => ({ ...f, hexCode: e.target.value, color: e.target.value, colorName: hexToColorName(e.target.value) }))}
                className="h-10 w-14 rounded-lg border border-gray-300 cursor-pointer p-0.5 shrink-0"
              />
              <input type="text" value={form.hexCode || ""} readOnly
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500"
                placeholder="#000000" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Color Name <span className="text-red-500">*</span> <span className="text-[10px] text-gray-400 font-normal">(auto-filled from color picker)</span></label>
            <input
              type="text"
              placeholder="e.g. Ivory White"
              value={form.colorName}
              onChange={(e) => setForm((f) => ({ ...f, colorName: e.target.value }))}
              className={`rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 focus:ring-gray-900/10 ${errors.colorName ? "border-red-400 focus:border-red-400" : "border-gray-300 focus:border-gray-900"}`}
            />
            {errors.colorName && <p className="text-xs text-red-500">{errors.colorName}</p>}
          </div>

          <InputField label="Width" required placeholder="e.g. 1.5" type="number" value={form.width}
            onChange={(e) => setForm((f) => ({ ...f, width: e.target.value }))} error={errors.width} />
          <InputField label="Height" placeholder="e.g. 2.0" type="number" value={form.height ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))} />
          <AddableSelect
            label="Width Unit Type" required value={form.widthUnitType}
            onChange={(v) => setForm((f) => ({ ...f, widthUnitType: v }))}
            onAdd={() => { setNewWidthUnitTypeName(""); setAddWidthUnitTypeOpen(true); }}
            addLabel="+ Add Width Unit"
            options={widthUnitTypeOptions} placeholder="Select Width Unit" error={errors.widthUnitType}
          />

          <InputField label="Price Per Meter (₹)" required placeholder="e.g. 350" type="number" value={form.pricePerMeter}
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

          <SearchableSelect label="Vendor" value={form.vendor ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, vendor: v }))}
            options={allVendors.map(v => v.brandName)}
            placeholder="Select vendor" clearable />

          {/* Per-Warehouse Stock Section */}
          <div className="col-span-2 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700">Stock by Location</p>
                {form.locationStocks.length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Total: <span className="font-semibold text-gray-800">{totalStock} {form.widthUnitType || "units"}</span>
                  </p>
                )}
              </div>
              <button type="button" onClick={addLocationStock}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors">
                + Add Location
              </button>
            </div>
            {form.locationStocks.length === 0 ? (
              <div className="border-2 border-dashed border-indigo-100 rounded-lg py-5 text-center cursor-pointer hover:border-indigo-200 transition-colors" onClick={addLocationStock}>
                <p className="text-xs text-gray-400">No locations added. Click "Add Location" to track stock per warehouse.</p>
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
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                    <datalist id={`loc-list-${idx}`}>
                      {locationOptions.map(l => <option key={l} value={l} />)}
                    </datalist>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-gray-500 whitespace-nowrap">Stock:</span>
                      <input
                        type="number" min="0" placeholder="0"
                        value={ls.stock}
                        onChange={e => updateLocationStock(idx, "stock", e.target.value)}
                        className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
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

          {/* Images */}
          <div className="col-span-2 pt-1">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Item Images <span className="text-xs font-normal text-gray-400">({form.images.length}/5, max 3 MB each)</span>
              </label>
              {form.images.length < 5 && (
                <button type="button" onClick={() => imgInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-[#C6AF4B] text-[#8a7a2e] hover:bg-[#C6AF4B]/10 transition-colors">
                  <ImagePlus className="h-3.5 w-3.5" /> Add Image
                </button>
              )}
              <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => handleImageFiles(e.target.files)} />
            </div>
            {form.images.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center py-6 gap-2 cursor-pointer hover:border-[#C6AF4B]/50 transition-colors"
                onClick={() => imgInputRef.current?.click()}>
                <ImagePlus className="h-7 w-7 text-gray-300" />
                <p className="text-xs text-gray-400">Click to add item images (JPG, PNG, WebP)</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {form.images.map(img => (
                  <div key={img.id} className="relative group w-20 h-20 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
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
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-[#C6AF4B]/50 transition-colors">
                    <ImagePlus className="h-5 w-5 text-gray-300" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="col-span-2 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: "#B8A240" }}>
                Stock Control Settings
              </p>
              <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">(Optional)</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Minimum Level</label>
                <input type="number" min="0" placeholder="0" value={form.minimumLevel ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, minimumLevel: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                {errors.minimumLevel && <p className="text-xs text-red-500">{errors.minimumLevel}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Reorder Level</label>
                <input type="number" min="0" placeholder="0" value={form.reorderLevel ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, reorderLevel: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                {errors.reorderLevel && <p className="text-xs text-red-500">{errors.reorderLevel}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Maximum Level</label>
                <input type="number" min="0" placeholder="0" value={form.maximumLevel ?? ""}
                  onChange={(e) => setForm(f => ({ ...f, maximumLevel: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                {errors.maximumLevel && <p className="text-xs text-red-500">{errors.maximumLevel}</p>}
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">
              When stock falls at or below the reorder level, a Low Stock alert will be triggered.
            </p>
          </div>

          <div className="col-span-2 flex items-center gap-3 pt-3">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <button type="button" onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}
              role="switch" aria-checked={form.isActive}>
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${form.isActive ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className={`text-sm ${form.isActive ? "text-emerald-600 font-medium" : "text-gray-400"}`}>{form.isActive ? "Active" : "Inactive"}</span>
          </div>
        </div>
      </MasterFormModal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Fabric"
        message={deleteTarget ? `Are you sure you want to delete fabric "${deleteTarget.fabricCode}"? This action cannot be undone.` : ""}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />

      {/* Add Fabric Type mini-modal */}
      <MasterFormModal open={addFabricTypeOpen} title="Add Fabric Type" onClose={() => setAddFabricTypeOpen(false)}
        onSubmit={handleAddFabricType} submitting={createFabricType.isPending} submitLabel="Add">
        <InputField label="Fabric Type Name" required placeholder="e.g. Cotton, Silk, Velvet" value={newFabricTypeName}
          onChange={(e) => setNewFabricTypeName(e.target.value)} />
      </MasterFormModal>

      {/* Add Width Unit Type mini-modal */}
      <MasterFormModal open={addWidthUnitTypeOpen} title="Add Width Unit Type" onClose={() => setAddWidthUnitTypeOpen(false)}
        onSubmit={handleAddWidthUnitType} submitting={createWidthUnitType.isPending} submitLabel="Add">
        <InputField label="Width Unit Type Name" required placeholder="e.g. cm, inches" value={newWidthUnitTypeName}
          onChange={(e) => setNewWidthUnitTypeName(e.target.value)} />
      </MasterFormModal>

      {/* Add HSN mini-modal */}
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

      {/* Lightbox */}
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
