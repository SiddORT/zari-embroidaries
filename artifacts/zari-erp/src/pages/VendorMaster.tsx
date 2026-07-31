import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, FileInput, FileDown, FileUp, FileSpreadsheet, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import AppLayout from "@/components/layout/AppLayout";
import MasterHeader from "@/components/master/MasterHeader";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { MASTERS_VENDORS } from "@/constants/permissions";
import SearchBar from "@/components/master/SearchBar";
import MasterTable, { type Column, type TableRow } from "@/components/master/MasterTable";
import StatusToggle from "@/components/master/StatusToggle";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ImportResultModal, { normalizeImportResult, type NormalizedImportResult } from "@/components/ui/ImportResultModal";

import {
  useVendorList, useToggleVendorStatus, useDeleteVendor, useImportVendors,
  fetchAllVendorsForExport,
  type VendorRecord, type StatusFilter,
} from "@/hooks/useVendors";

function formatDateExport(val: string | null | undefined) {
  if (!val) return "";
  try {
    const d = new Date(val);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy} ${hh}:${mi}:${ss}`;
  } catch { return String(val); }
}

function formatDateTable(val: string | null | undefined) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(val); }
}

const asVendor = (r: TableRow) => r as unknown as VendorRecord;

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function VendorMaster() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({ query: { enabled: !!token } as any });
  useEffect(() => { if (!token || (!loadingUser && !user)) setLocation("/login"); }, [token, user, loadingUser, setLocation]);

  const logoutMutation = useLogout();
  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync(); } finally {
      localStorage.removeItem("zarierp_token");
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/login");
    }
  };

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [toggleTarget, setToggleTarget] = useState<VendorRecord | null>(null);

  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<NormalizedImportResult | null>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) setImportMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const { data, isLoading } = useVendorList({ search, status, page, limit });
  const toggleStatus = useToggleVendorStatus();
  const deleteMutation = useDeleteVendor();
  const importMutation = useImportVendors();
  const { can } = useMyPermissions();

  async function handleToggleConfirm() {
    if (!toggleTarget) return;
    try {
      await toggleStatus.mutateAsync(toggleTarget.id);
      toast({ description: `Vendor "${toggleTarget.brandName}" is now ${toggleTarget.isActive ? "Inactive" : "Active"}. Vendor status updated successfully.` });
    } catch {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    } finally {
      setToggleTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
    toast({ title: "Vendor deleted" });
  }

  async function handleExportAll() {
    setExportLoading(true);
    try {
      const allRows = await fetchAllVendorsForExport(search, status);
      const exportData = allRows.map((v) => ({
        "Vendor Code": v.vendorCode,
        "Brand / Vendor Name": v.brandName,
        "Contact Name": v.contactName,
        "Email": v.email ?? "",
        "Contact No": v.contactNo ?? "",
        "Country": v.country ?? "",
        "GST Registered": v.hasGst ? "Yes" : "No",
        "GST No": v.gstNo ?? "",
        "Status": v.isActive ? "Active" : "Inactive",
        "Created By": v.createdBy,
        "Created At": formatDateExport(v.createdAt),
        "Updated By": v.updatedBy ?? "",
        "Updated At": formatDateExport(v.updatedAt),
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 12 }, { wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 15 },
        { wch: 15 }, { wch: 14 }, { wch: 20 }, { wch: 10 },
        { wch: 25 }, { wch: 22 }, { wch: 25 }, { wch: 22 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vendors");
      XLSX.writeFile(wb, "Vendors.xlsx");
      toast({ title: "Export Complete", description: `${allRows.length} record(s) exported.` });
    } catch {
      toast({ title: "Export Failed", description: "Could not fetch records for export.", variant: "destructive" });
    } finally {
      setExportLoading(false);
    }
  }

  function downloadSample() {
    setImportMenuOpen(false);

    const sampleData = [
      {
        "Brand / Vendor Name": "Sunrise Textiles",
        "Contact Name": "Raj Kumar",
        "Email": "raj@sunrise.com",
        "Alternate Email": "",
        "Contact No": "9876543210",
        "Alternate Contact No": "",
        "Country (General)": "India",
        "Has GST (Yes/No)": "Yes",
        "GST No": "27AABCS1234A1Z5",

        "Address Type": "Warehouse",
        "Address Contact Person": "Raj Kumar",
        "Address Contact Number": "9876543210",
        "Address Line 1": "Shop 12, Surat Textile Market",
        "Address Line 2": "Ring Road",
        "Pincode": "395002",
        "City": "Surat",
        "State": "Gujarat",
        "Address Country": "India",

        "Bank Name": "HDFC Bank",
        "Account No": "50100123456789",
        "IFSC Code": "HDFC0001234",
      },
      {
        "Brand / Vendor Name": "Golden Thread Co",
        "Contact Name": "Priya Sharma",
        "Email": "priya@goldenthread.com",
        "Alternate Email": "",
        "Contact No": "9123456780",
        "Alternate Contact No": "",
        "Country (General)": "India",
        "Has GST (Yes/No)": "Yes",
        "GST No": "09AABCG5678B2Z3",

        "Address Type": "Office",
        "Address Contact Person": "Priya Sharma",
        "Address Contact Number": "9123456780",
        "Address Line 1": "Plot 44, Embroidery Zone",
        "Address Line 2": "",
        "Pincode": "110006",
        "City": "Delhi",
        "State": "Delhi",
        "Address Country": "India",

        "Bank Name": "SBI",
        "Account No": "30218765432100",
        "IFSC Code": "SBIN0001234",
      },
      {
        "Brand / Vendor Name": "Royal Fabrics",
        "Contact Name": "Amit Singh",
        "Email": "",
        "Alternate Email": "",
        "Contact No": "9000011122",
        "Alternate Contact No": "",
        "Country (General)": "India",
        "Has GST (Yes/No)": "No",
        "GST No": "",

        "Address Type": "Factory",
        "Address Contact Person": "Amit Singh",
        "Address Contact Number": "9000011122",
        "Address Line 1": "Industrial Area, Sector 5",
        "Address Line 2": "",
        "Pincode": "302020",
        "City": "Jaipur",
        "State": "Rajasthan",
        "Address Country": "India",

        "Bank Name": "ICICI Bank",
        "Account No": "123456789012",
        "IFSC Code": "ICIC0001234",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);

    ws["!cols"] = [
      { wch: 28 }, // Brand / Vendor Name
      { wch: 22 }, // Contact Name
      { wch: 30 }, // Email
      { wch: 30 }, // Alternate Email
      { wch: 18 }, // Contact No
      { wch: 20 }, // Alternate Contact No
      { wch: 18 }, // Country
      { wch: 16 }, // Has GST
      { wch: 22 }, // GST No
      { wch: 18 }, // Address Type
      { wch: 24 }, // Address Contact Person
      { wch: 22 }, // Address Contact Number
      { wch: 35 }, // Address Line 1
      { wch: 30 }, // Address Line 2
      { wch: 12 }, // Pincode
      { wch: 18 }, // City
      { wch: 18 }, // State
      { wch: 18 }, // Address Country
      { wch: 24 }, // Bank Name
      { wch: 22 }, // Account No
      { wch: 18 }, // IFSC Code
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendor Import Template");

    XLSX.writeFile(wb, "Vendor_Import_Sample.xlsx");

    toast({
      title: "Sample Downloaded",
      description: "Fill in the template and upload it to import.",
    });
  }

  function excelValue(value: unknown): string {
    if (value == null) return "";

    const str = String(value).trim();

    // Not scientific notation
    if (!/[eE]/.test(str)) {
      return str;
    }

    // Convert scientific notation to plain string
    const match = str.match(/^(\d+)(?:\.(\d+))?[eE]\+(\d+)$/);

    if (!match) {
      return str;
    }

    const [, intPart, fracPart = "", exponentStr] = match;
    const exponent = parseInt(exponentStr, 10);

    const digits = intPart + fracPart;

    if (digits.length >= exponent + 1) {
      return digits;
    }

    return digits.padEnd(exponent + 1, "0");
  }

  function formatPhoneNumber(phone: string, country: string): string {
    const value = excelValue(phone).trim();
    const countryName = country.trim().toLowerCase();

    // Already has a country code
    if (value.startsWith("+")) {
      return value;
    }

    // Remove all non-digit characters
    const digits = value.replace(/\D/g, "");

    // Valid Indian mobile number (starts with 6-9 and is exactly 10 digits)
    if (countryName === "india" && /^[6-9]\d{9}$/.test(digits)) {
      return `+91 ${digits}`;
    }

    // Otherwise leave as-is
    return value;
  }


  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportMenuOpen(false);
    setImportLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
        raw: false,
        defval: "",
      });
      if (jsonRows.length === 0) {
        toast({ title: "Empty File", description: "No data rows found.", variant: "destructive" });
        return;
      }
      const records = jsonRows.map((row) => {
      const cell = (key: string) => excelValue(row[key]);

      // Vendor Details
      const brandName = cell("Brand / Vendor Name");
      const contactName = cell("Contact Name");
      const email = cell("Email");
      const altEmail = cell("Alternate Email");
      const country = cell("Country (General)");

      const contactNo = formatPhoneNumber(cell("Contact No"),country);
      const altContactNo = formatPhoneNumber(cell("Alternate Contact No"),country);

      // GST
      const hasGstRaw = cell("Has GST (Yes/No)").toLowerCase();
      const hasGst =
        hasGstRaw === "yes" ||
        hasGstRaw === "y" ||
        hasGstRaw === "true";

      const gstNo = hasGst ? cell("GST No") : undefined;

      // Address
      const addrType = cell("Address Type") || "Office";
      const addrLine1 = cell("Address Line 1");
      const addrLine2 = cell("Address Line 2");
      const addrPincode = cell("Pincode");
      const addrCity = cell("City");
      const addrState = cell("State");
      const addrCountry = cell("Address Country");

      const hasAddr = !!(addrLine1 || addrLine2 || addrPincode || addrCity || addrState);

      const addressContactPerson = cell("Address Contact Person") || contactName;
      const addressContactNumber = formatPhoneNumber(cell("Address Contact Number"), addrCountry) || contactNo;

      // Bank
      const bankName = cell("Bank Name");
      const accountNo = cell("Account No");
      const ifscCode = cell("IFSC Code");

      const hasBank = !!(bankName || accountNo || ifscCode);

      return {
        brandName,
        contactName,
        email: email || undefined,
        altEmail: altEmail || undefined,
        contactNo: contactNo || undefined,
        altContactNo: altContactNo || undefined,
        country: country || undefined,
        hasGst,
        gstNo,

        addresses: hasAddr
          ? [
              {
                id: Math.random().toString(36).slice(2, 10),
                type: addrType,
                name: addressContactPerson,
                contactNo: addressContactNumber,
                address1: addrLine1,
                address2: addrLine2,
                pincode: addrPincode,
                city: addrCity,
                state: addrState,
                country: addrCountry,
                isBillingDefault: true,
              },
            ]
          : undefined,

        bankAccounts: hasBank
          ? [
              {
                bankName,
                accountNo,
                ifscCode,
              },
            ]
          : undefined,
      };
    });
      const importRaw = await importMutation.mutateAsync(records);
      setImportResult(normalizeImportResult(importRaw));
      setImportResultOpen(true);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to import file.";
      toast({ title: "Import Failed", description: msg, variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  }

  const rows: TableRow[] = ((data?.data ?? []) as VendorRecord[]).map((r, i) => ({
    ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1,
  }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No", className: "w-14 text-center" },
    { key: "vendorCode", label: "Vendor Code", render: (r) => <span className="font-mono text-xs font-semibold text-gray-700">{asVendor(r).vendorCode}</span> },
    { key: "brandName", label: "Brand / Vendor Name", render: (r) => <span className="font-medium text-gray-900">{asVendor(r).brandName}</span> },
    { key: "contactName", label: "Contact", render: (r) => <span className="text-gray-600">{asVendor(r).contactName}</span> },
    { key: "contactNo", label: "Contact No", render: (r) => <span className="text-gray-500">{asVendor(r).contactNo || "—"}</span> },
    { key: "country", label: "Country", render: (r) => <span className="text-gray-500">{asVendor(r).country || "—"}</span> },
    { key: "hasGst", label: "GST", render: (r) => asVendor(r).hasGst ? <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Yes</span> : <span className="text-xs text-gray-400">No</span> },
    {
      key: "addresses", label: "Addresses", render: (r) => {
        const count = asVendor(r).addresses?.length ?? 0;
        return count > 0
          ? <span className="text-xs text-gray-500">{count} addr{count !== 1 ? "s" : ""}</span>
          : <span className="text-xs text-gray-300">—</span>;
      }
    },
    {
      key: "isActive", label: "Status", render: (r) =>
        can(MASTERS_VENDORS.ADD_EDIT) ? (
          <StatusToggle isActive={asVendor(r).isActive} onToggle={() => setToggleTarget(asVendor(r))}
            loading={toggleStatus.isPending && toggleTarget?.id === asVendor(r).id} />
        ) : (
          <span className={`text-xs font-medium ${asVendor(r).isActive ? "text-emerald-600" : "text-gray-400"}`}>
            {asVendor(r).isActive ? "Active" : "Inactive"}
          </span>
        )
    },
    { key: "createdBy", label: "Created By", render: (r) => <span className="text-gray-500">{asVendor(r).createdBy}</span> },
    { key: "createdAt", label: "Created At", render: (r) => <span className="text-gray-500 whitespace-nowrap">{formatDateTable(asVendor(r).createdAt)}</span> },
    { key: "updatedBy", label: "Updated By", render: (r) => <span className="text-gray-500">{asVendor(r).updatedBy || "—"}</span> },
    { key: "updatedAt", label: "Updated At", render: (r) => <span className="text-gray-500 whitespace-nowrap">{formatDateTable(asVendor(r).updatedAt)}</span> },
    {
      key: "actions", label: "Actions", render: (r) => {
        const rec = asVendor(r);
        return (
          <div className="flex gap-2">
            {can(MASTERS_VENDORS.ADD_EDIT) && (
              <button onClick={() => setLocation(`/masters/vendors/${rec.id}`)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Edit"><Pencil size={15} /></button>
            )}
            {can(MASTERS_VENDORS.DELETE) && (
              <button onClick={() => setDeleteId(rec.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 size={15} /></button>
            )}
          </div>
        );
      },
    },
  ];

  if (!user) return null;
  // permission checks
  const canAdd = can(MASTERS_VENDORS.ADD_EDIT);
  const canExport = can(MASTERS_VENDORS.DOWNLOAD);
  const canImport = canAdd;
  const canDelete = can(MASTERS_VENDORS.DELETE);
  const showActions = canAdd || canDelete;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Vendor Master" onAdd={() => setLocation("/masters/vendors/new")} addLabel="Add Vendor" addPermission={MASTERS_VENDORS.ADD_EDIT} />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search vendors…" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {canExport && (
            <button onClick={handleExportAll} disabled={exportLoading || isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <FileDown className="h-4 w-4" />
              {exportLoading ? "Exporting…" : "Export to Excel"}
            </button>
          )}

          {canImport && (
            <div className="relative" ref={importMenuRef}>
              <button onClick={() => setImportMenuOpen(v => !v)} disabled={importLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#C9B45C]/50 bg-white text-sm font-medium text-gray-700 shadow-sm hover:border-[#C9B45C] hover:bg-amber-50/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <FileInput className="h-4 w-4 text-[#C6AF4B]" />
                {importLoading ? "Importing…" : "Import Data"}
                <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${importMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {importMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
                  <button onClick={downloadSample} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div><p className="font-medium">Download Sample</p><p className="text-xs text-gray-400">Get the Excel template</p></div>
                  </button>
                  <div className="border-t border-gray-100" />
                  <button onClick={() => { setImportMenuOpen(false); importFileRef.current?.click(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
                    <FileUp className="h-4 w-4 text-blue-600 shrink-0" />
                    <div><p className="font-medium">Upload Excel File</p><p className="text-xs text-gray-400">Import records from file</p></div>
                  </button>
                </div>
              )}
              <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
            </div>
          )}
        </div>

        <MasterTable columns={columns} rows={rows} loading={isLoading}
          rowKey={(row) => (row as unknown as { id: number }).id}
          showActions={showActions}
          pagination={{ page, limit, total: data?.total ?? 0, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }} />
      </div>

      <ConfirmModal
        open={!!toggleTarget}
        title="Change Vendor Status"
        message={toggleTarget ? `Are you sure you want to change the status of "${toggleTarget.brandName}" to ${toggleTarget.isActive ? "Inactive" : "Active"}?` : ""}
        confirmLabel="Yes, Change"
        onConfirm={() => { void handleToggleConfirm(); }}
        onCancel={() => setToggleTarget(null)}
        loading={toggleStatus.isPending}
      />

      <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
        title="Delete Vendor" message="Are you sure you want to delete this vendor? This action cannot be undone."
        loading={deleteMutation.isPending} />

      <ImportResultModal
        open={importResultOpen}
        result={importResult}
        entityName="Vendors"
        onClose={() => setImportResultOpen(false)}
      />
    </AppLayout>
  );
}
