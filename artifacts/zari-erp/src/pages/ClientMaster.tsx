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
import { MASTERS_CLIENTS } from "@/constants/permissions";
import SearchBar from "@/components/master/SearchBar";
import MasterTable, { type Column, type TableRow } from "@/components/master/MasterTable";
import StatusToggle from "@/components/master/StatusToggle";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ImportResultModal, { normalizeImportResult, type NormalizedImportResult } from "@/components/ui/ImportResultModal";

import {
  useClientList, useToggleClientStatus, useDeleteClient, useImportClients,
  fetchAllClientsForExport,
  type ClientRecord, type ClientImportResult, type StatusFilter,
} from "@/hooks/useClients";

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

const asClient = (r: TableRow) => r as unknown as ClientRecord;

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function ClientMaster() {
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
  const [statusTarget, setStatusTarget] = useState<ClientRecord | null>(null);

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

  const { data, isLoading } = useClientList({ search, status, page, limit });
  const toggleStatus = useToggleClientStatus();
  const deleteMutation = useDeleteClient();
  const importMutation = useImportClients();
  const { can } = useMyPermissions();

  async function handleStatusConfirm() {
    if (!statusTarget) return;
    try {
      await toggleStatus.mutateAsync(statusTarget.id);
      toast({ description: "Client status updated successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    } finally {
      setStatusTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
    toast({ title: "Client deleted" });
  }

  async function handleExportAll() {
    setExportLoading(true);
    try {
      const allRows = await fetchAllClientsForExport(search, status);
      const exportData = allRows.map((c) => ({
        "Client Code": c.clientCode,
        "Brand / Client Name": c.brandName,
        "Contact Name": c.contactName,
        "Email": c.email ?? "",
        "Alternate Email": c.altEmail ?? "",
        "Contact No": c.contactNo ?? "",
        "Alternate Contact No": c.altContactNo ?? "",
        "Country": c.country ?? "",
        "Invoice Currency": c.invoiceCurrency ?? "",
        "Status": c.isActive ? "Active" : "Inactive",
        "Created By": c.createdBy,
        "Created At": formatDateExport(c.createdAt),
        "Updated By": c.updatedBy ?? "",
        "Updated At": formatDateExport(c.updatedAt),
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 12 }, { wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 28 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 10 },
        { wch: 25 }, { wch: 22 }, { wch: 25 }, { wch: 22 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clients");
      XLSX.writeFile(wb, "Clients.xlsx");
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
            // Client Info
            "Custom Client Code": "CL001",
            "Brand / Client Name": "Fusion Garments",
            "Contact Name": "Priya Sharma",
            "Email": "priya@fusiongarments.com",
            "Alternate Email": "",
            "Contact No": "9876543210",
            "Alternate Contact No": "",
            "Country": "India",
            "Invoice Currency": "INR",
            
            // Billing Address
            "Billing Address Contact Person": "Priya Sharma",
            "Billing Address Contact Number": "9876543210",
            "Billing Address Line 1": "12 MG Road",
            "Billing Address Line 2": "Bandra West",
            "Billing Pincode": "400050",
            "Billing City": "Mumbai",
            "Billing State": "Maharashtra",
            "Billing Country": "India",
            
            // Delivery Address 1 (Default)
            "Delivery 1 Address Contact Person": "Rahul Sharma",
            "Delivery 1 Address Contact Number": "9876543211",
            "Delivery 1 Address Line 1": "45 Andheri East",
            "Delivery 1 Address Line 2": "Near Metro Station",
            "Delivery 1 Pincode": "400069",
            "Delivery 1 City": "Mumbai",
            "Delivery 1 State": "Maharashtra",
            "Delivery 1 Country": "India",
            "Delivery 1 Is Default": "true",
            
            // Delivery Address 2
            "Delivery 2 Address Contact Person": "Neha Gupta",
            "Delivery 2 Address Contact Number": "9876543212",
            "Delivery 2 Address Line 1": "78 Borivali West",
            "Delivery 2 Address Line 2": "",
            "Delivery 2 Pincode": "400092",
            "Delivery 2 City": "Mumbai",
            "Delivery 2 State": "Maharashtra",
            "Delivery 2 Country": "India",
            "Delivery 2 Is Default": "false",
            
            // Delivery Address 3
            "Delivery 3 Address Contact Person": "Amit Patel",
            "Delivery 3 Address Contact Number": "9876543213",
            "Delivery 3 Address Line 1": "22 Dadar",
            "Delivery 3 Address Line 2": "",
            "Delivery 3 Pincode": "400014",
            "Delivery 3 City": "Mumbai",
            "Delivery 3 State": "Maharashtra",
            "Delivery 3 Country": "India",
            "Delivery 3 Is Default": "false",
        },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);

    // Column widths matching the new structure (44 columns total)
    ws["!cols"] = [
        // Client Info (9 columns)
        { wch: 12 }, // Custom Client Code
        { wch: 25 }, // Brand / Client Name
        { wch: 20 }, // Contact Name
        { wch: 30 }, // Email
        { wch: 30 }, // Alternate Email
        { wch: 15 }, // Contact No
        { wch: 15 }, // Alternate Contact No
        { wch: 20 }, // Country
        { wch: 16 }, // Invoice Currency
        
        // Billing Address (8 columns)
        { wch: 30 }, // Billing Address Contact Person
        { wch: 25 }, // Billing Address Contact Number
        { wch: 28 }, // Billing Address Line 1
        { wch: 22 }, // Billing Address Line 2
        { wch: 12 }, // Billing Pincode
        { wch: 16 }, // Billing City
        { wch: 16 }, // Billing State
        { wch: 18 }, // Billing Country
        
        // Delivery Address 1 (9 columns)
        { wch: 30 }, // Delivery 1 Address Contact Person
        { wch: 25 }, // Delivery 1 Address Contact Number
        { wch: 28 }, // Delivery 1 Address Line 1
        { wch: 22 }, // Delivery 1 Address Line 2
        { wch: 12 }, // Delivery 1 Pincode
        { wch: 16 }, // Delivery 1 City
        { wch: 16 }, // Delivery 1 State
        { wch: 18 }, // Delivery 1 Country
        { wch: 18 }, // Delivery 1 Is Default
        
        // Delivery Address 2 (9 columns)
        { wch: 30 }, // Delivery 2 Address Contact Person
        { wch: 25 }, // Delivery 2 Address Contact Number
        { wch: 28 }, // Delivery 2 Address Line 1
        { wch: 22 }, // Delivery 2 Address Line 2
        { wch: 12 }, // Delivery 2 Pincode
        { wch: 16 }, // Delivery 2 City
        { wch: 16 }, // Delivery 2 State
        { wch: 18 }, // Delivery 2 Country
        { wch: 18 }, // Delivery 2 Is Default
        
        // Delivery Address 3 (9 columns)
        { wch: 30 }, // Delivery 3 Address Contact Person
        { wch: 25 }, // Delivery 3 Address Contact Number
        { wch: 28 }, // Delivery 3 Address Line 1
        { wch: 22 }, // Delivery 3 Address Line 2
        { wch: 12 }, // Delivery 3 Pincode
        { wch: 16 }, // Delivery 3 City
        { wch: 16 }, // Delivery 3 State
        { wch: 18 }, // Delivery 3 Country
        { wch: 18 }, // Delivery 3 Is Default
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clients_Sample");
    XLSX.writeFile(wb, "Clients_Import_Sample.xlsx");
  }

  function formatPhoneNumber(phone: string, country: string): string {
    const value = phone.trim();
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
    setImportLoading(true);
    try {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        const mapped = rows.map((row) => {
            const contactName = String(row["Contact Name"] ?? row["contactName"] ?? "").trim();
            const contactNoRaw = String(row["Contact No"] ?? row["contactNo"] ?? "").trim();
            const country = String(row["Country"] ?? row["country"] ?? "").trim() || undefined;

            // Format primary contact number
            const contactNo = country ? formatPhoneNumber(contactNoRaw, country) : contactNoRaw;

            // Helper to read a field with fallback keys
            const get = (keys: string[]) => {
                for (const k of keys) {
                    const v = row[k];
                    if (v !== undefined && v !== null && v !== "") return String(v).trim();
                }
                return "";
            };

            // Build addresses array
            const addresses: Array<{
                id: string;
                type: string;
                name: string;
                contactNo: string;
                address1: string;
                address2: string;
                city: string;
                state: string;
                pincode: string;
                country: string;
                isBillingDefault: boolean;
                isDeliveryDefault: boolean;
            }> = [];

            // --- Billing Address (always present, always default) ---
            const billingAddr1 = get(["Billing Address Line 1", "billingAddressLine1"]);
            const billingAddr2 = get(["Billing Address Line 2", "billingAddressLine2"]);
            const billingPincode = get(["Billing Pincode", "billingPincode"]);
            const billingCity = get(["Billing City", "billingCity"]);
            const billingState = get(["Billing State", "billingState"]);
            const billingCountry = get(["Billing Country", "billingCountry"]) || country || "";

            const hasBilling = !!(billingAddr1 || billingAddr2 || billingCity || billingState || billingPincode);

            if (hasBilling) {
                const billingContactNoRaw = get(["Billing Address Contact Number", "billingAddressContactNumber"]) || contactNoRaw;
                const billingContactNo = country ? formatPhoneNumber(billingContactNoRaw, country) : billingContactNoRaw;

                addresses.push({
                    id: Math.random().toString(36).slice(2, 10),
                    type: "Billing Address",
                    name: get(["Billing Address Contact Person", "billingAddressContactPerson"]) || contactName,
                    contactNo: billingContactNo,
                    address1: billingAddr1,
                    address2: billingAddr2,
                    city: billingCity,
                    state: billingState,
                    pincode: billingPincode,
                    country: billingCountry,
                    isBillingDefault: true,
                    isDeliveryDefault: false,
                });
            }

            // --- Delivery Addresses 1, 2, 3 ---
            const deliveryAddresses: typeof addresses = [];

            for (let i = 1; i <= 3; i++) {
                const prefix = `Delivery ${i}`;
                const camelPrefix = `delivery${i}`;

                const dAddr1 = get([`${prefix} Address Line 1`, `${camelPrefix}AddressLine1`]);
                const dAddr2 = get([`${prefix} Address Line 2`, `${camelPrefix}AddressLine2`]);
                const dPincode = get([`${prefix} Pincode`, `${camelPrefix}Pincode`]);
                const dCity = get([`${prefix} City`, `${camelPrefix}City`]);
                const dState = get([`${prefix} State`, `${camelPrefix}State`]);
                const dCountry = get([`${prefix} Country`, `${camelPrefix}Country`]) || country || "";

                const hasDelivery = !!(dAddr1 || dAddr2 || dCity || dState || dPincode);

                if (hasDelivery) {
                    const isDefaultRaw = get([`${prefix} Is Default`, `${camelPrefix}IsDefault`]).toLowerCase();
                    const isDefault = isDefaultRaw === "true" || isDefaultRaw === "1" || isDefaultRaw === "yes";

                    const deliveryContactNoRaw = get([`${prefix} Address Contact Number`, `${camelPrefix}AddressContactNumber`]) || contactNoRaw;
                    const deliveryContactNo = country ? formatPhoneNumber(deliveryContactNoRaw, country) : deliveryContactNoRaw;

                    deliveryAddresses.push({
                        id: Math.random().toString(36).slice(2, 10),
                        type: "Delivery Address",
                        name: get([`${prefix} Address Contact Person`, `${camelPrefix}AddressContactPerson`]) || contactName,
                        contactNo: deliveryContactNo,
                        address1: dAddr1,
                        address2: dAddr2,
                        city: dCity,
                        state: dState,
                        pincode: dPincode,
                        country: dCountry,
                        isBillingDefault: false,
                        isDeliveryDefault: isDefault,
                    });
                }
            }

            // --- Enforce exactly ONE delivery default ---
            if (deliveryAddresses.length > 0) {
                const defaultCount = deliveryAddresses.filter((a) => a.isDeliveryDefault).length;

                if (defaultCount === 0) {
                    deliveryAddresses[0].isDeliveryDefault = true;
                } else if (defaultCount > 1) {
                    let foundFirst = false;
                    for (const addr of deliveryAddresses) {
                        if (addr.isDeliveryDefault) {
                            if (foundFirst) {
                                addr.isDeliveryDefault = false;
                            } else {
                                foundFirst = true;
                            }
                        }
                    }
                }
            }

            addresses.push(...deliveryAddresses);

            // --- Fallback: if only one address total, make it billing default ---
            if (addresses.length === 1 && addresses[0].type === "Delivery Address") {
                addresses[0].isBillingDefault = true;
                addresses[0].type = "Billing Address";
            }

            // Format alternate contact number if present
            const altContactNoRaw = String(row["Alternate Contact No"] ?? row["altContactNo"] ?? "").trim();
            const altContactNo = altContactNoRaw && country ? formatPhoneNumber(altContactNoRaw, country) : altContactNoRaw || undefined;

            return {
                customClientCode: get(["Custom Client Code", "customClientCode"]) || undefined,
                brandName: String(row["Brand / Client Name"] ?? row["brandName"] ?? "").trim(),
                contactName,
                email: String(row["Email"] ?? row["email"] ?? "").trim(),
                altEmail: String(row["Alternate Email"] ?? row["altEmail"] ?? "").trim() || undefined,
                contactNo,
                altContactNo,
                country,
                invoiceCurrency: String(row["Invoice Currency"] ?? row["invoiceCurrency"] ?? "").trim() || undefined,
                addresses: addresses.length > 0 ? addresses : undefined,
            };
        });

        const importRaw = await importMutation.mutateAsync(mapped);
        setImportResult(normalizeImportResult(importRaw));
        setImportResultOpen(true);
    } catch (err) {
        toast({
            title: "Import Failed",
            description: err instanceof Error ? err.message : "Could not import file.",
            variant: "destructive",
        });
    } finally {
        setImportLoading(false);
    }
  }

  const rows: TableRow[] = ((data?.data ?? []) as ClientRecord[]).map((r, i) => ({
    ...(r as unknown as TableRow), _srNo: (page - 1) * limit + i + 1,
  }));

  const columns: Column[] = [
    { key: "_srNo", label: "Sr No" },
    { key: "clientCode", label: "Client Code", render: (r) => asClient(r).clientCode },
    { key: "brandName", label: "Brand / Client Name", render: (r) => asClient(r).brandName },
    { key: "contactName", label: "Contact Name", render: (r) => asClient(r).contactName },
    { key: "email", label: "Email", render: (r) => asClient(r).email },
    { key: "contactNo", label: "Contact No", render: (r) => asClient(r).contactNo },
    { key: "country", label: "Country", render: (r) => asClient(r).country ?? asClient(r).countryOfOrigin ?? "—" },
    {
      key: "invoiceCurrency", label: "Invoice Currency", render: (r) => {
        const cur = asClient(r).invoiceCurrency;
        return cur ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{cur}</span> : <span className="text-gray-300">—</span>;
      }
    },
    {
      key: "addresses", label: "Addresses", render: (r) => {
        const count = asClient(r).addresses?.length ?? 0;
        return count > 0 ? <span className="text-xs text-gray-500">{count} address{count !== 1 ? "es" : ""}</span> : <span className="text-xs text-gray-300">—</span>;
      }
    },
    {
      key: "isActive", label: "Status", render: (r) => (
          can(MASTERS_CLIENTS.ADD_EDIT) ? (
            <StatusToggle isActive={asClient(r).isActive} onToggle={() => setStatusTarget(asClient(r))} />
          ) : (
            <span className={`text-xs font-medium ${asClient(r).isActive ? "text-emerald-600" : "text-gray-400"}`}>
              {asClient(r).isActive ? "Active" : "Inactive"}
            </span>
          )
        )
    },
    { key: "createdBy", label: "Created By", render: (r) => asClient(r).createdBy },
    { key: "createdAt", label: "Created At", render: (r) => formatDateTable(asClient(r).createdAt) },
    { key: "updatedBy", label: "Updated By", render: (r) => asClient(r).updatedBy || "—" },
    { key: "updatedAt", label: "Updated At", render: (r) => formatDateTable(asClient(r).updatedAt) },
    {
      key: "actions", label: "Actions", render: (r) => {
        const rec = asClient(r);
        return (
          <div className="flex gap-2">
            {can(MASTERS_CLIENTS.ADD_EDIT) && (
              <button onClick={() => setLocation(`/masters/clients/${rec.id}`)} className="p-1 rounded hover:bg-gray-100 text-gray-600"><Pencil size={15} /></button>
            )}
            {can(MASTERS_CLIENTS.DELETE) && (
              <button onClick={() => setDeleteId(rec.id)} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
            )}
          </div>
        );
      },
    },
  ];

  if (!user) return null;
  const { can: canCheck } = useMyPermissions();
  const canAdd = canCheck(MASTERS_CLIENTS.ADD_EDIT);
  const canExport = canCheck(MASTERS_CLIENTS.DOWNLOAD);
  const canImport = canAdd;
  const canDelete = canCheck(MASTERS_CLIENTS.DELETE);
  const showActions = canAdd || canDelete;

  return (
    <AppLayout username={user.username} role={user.role} onLogout={handleLogout} isLoggingOut={logoutMutation.isPending}>
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader title="Client Master" onAdd={() => setLocation("/masters/clients/new")} addLabel="Add Client" addPermission={MASTERS_CLIENTS.ADD_EDIT} />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search clients…" />
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

        {/* Status change confirmation */}
        <ConfirmModal
          open={statusTarget !== null}
          onCancel={() => setStatusTarget(null)}
          onConfirm={() => { void handleStatusConfirm(); }}
          title="Change Client Status"
          message="Are you sure you want to change the status?"
          confirmLabel="Yes"
          cancelLabel="No"
          loading={toggleStatus.isPending}
          danger={false}
        />

        <ImportResultModal
          open={importResultOpen}
          result={importResult}
          entityName="Clients"
          onClose={() => setImportResultOpen(false)}
        />

        {/* Delete confirmation */}
        <ConfirmModal open={deleteId !== null} onCancel={() => setDeleteId(null)} onConfirm={() => { void handleDelete(); }}
          title="Delete Client" message="Are you sure you want to delete this client? This action cannot be undone."
          loading={deleteMutation.isPending} />
      </div>
    </AppLayout>
  );
}
