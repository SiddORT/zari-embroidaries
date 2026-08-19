import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, FileInput, FileDown, FileUp, FileSpreadsheet, ChevronDown } from "lucide-react";
import {
  useGetMe,
  useLogout,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import AppLayout from "@/components/layout/AppLayout";
import MasterHeader from "@/components/master/MasterHeader";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { MASTERS_TDS } from "@/constants/permissions";
import SearchBar from "@/components/master/SearchBar";
import MasterTable, {
  type Column,
  type TableRow,
} from "@/components/master/MasterTable";
import MasterFormModal from "@/components/master/MasterFormModal";
import StatusToggle from "@/components/master/StatusToggle";
import InputField from "@/components/ui/InputField";
import TextareaField from "@/components/ui/TextareaField";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ImportResultModal, { normalizeImportResult, type NormalizedImportResult } from "@/components/ui/ImportResultModal";
import * as XLSX from "xlsx";

import {
  useTDSMasterList,
  useCreateTDSMaster,
  useUpdateTDSMaster,
  useToggleTDSMasterStatus,
  useDeleteTDSMaster,
  fetchAllTDSForExport,
  useImportTDSMaster,
  type TDSMasterRecord,
  type TDSMasterFormData,
  type StatusFilter,
  type TDSMasterImportRow,
} from "@/hooks/useTDSMaster";

// Constants
const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const EMPTY_FORM: TDSMasterFormData = {
  serviceName: "",
  paymentNature: "",
  sectionCode: "",
  ratePercent: "",
  thresholdAmount: "",
  effectiveFrom: "",
  effectiveTo: null,
  remarks: "",
  status: true,
};

const PERCENTAGE_MAX = 100;
const PERCENTAGE_MIN = 0;
const REMARKS_MAX = 500;
const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/; // optional 2 decimal places

type FormErrors = Partial<Record<keyof TDSMasterFormData, string>>;

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
}

export default function TDSMaster() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const token = localStorage.getItem("zarierp_token");
  const { data: user, isLoading: loadingUser } = useGetMe({
    query: { enabled: !!token } as any,
  });

  useEffect(() => {
    if (!token || (!loadingUser && !user)) {
      setLocation("/login");
    }
  }, [token, user, loadingUser, setLocation]);

  const logoutMutation = useLogout();
  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      localStorage.removeItem("zarierp_token");
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/login");
    }
  };

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useTDSMasterList({
    search: debouncedSearch,
    status: statusFilter,
    page,
    limit,
  });
  const rows = data?.data ?? [];
  const total = data?.totalRecords ?? 0;

  const createMutation = useCreateTDSMaster();
  const updateMutation = useUpdateTDSMaster();
  const toggleMutation = useToggleTDSMasterStatus();
  const deleteMutation = useDeleteTDSMaster();
  const importMutation = useImportTDSMaster();
  const [exportLoading, setExportLoading] = useState(false);

  const { can } = useMyPermissions();
  const canView = can(MASTERS_TDS.VIEW);
  const canAddEdit = can(MASTERS_TDS.ADD_EDIT);
  const canImport = canAddEdit;
  const canDelete = can(MASTERS_TDS.DELETE);
  const canDownload = can(MASTERS_TDS.DOWNLOAD);

  const [modalOpen, setModalOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [editRecord, setEditRecord] = useState<TDSMasterRecord | null>(null);
  const [form, setForm] = useState<TDSMasterFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const [deleteTarget, setDeleteTarget] = useState<TDSMasterRecord | null>(
    null,
  );
  const [toggleTarget, setToggleTarget] = useState<TDSMasterRecord | null>(
    null,
  );

  // Import result modal state
  const [importResult, setImportResult] = useState<NormalizedImportResult | null>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);

  // Refs for import dropdown
  const importMenuRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setImportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openAdd = () => {
    setEditRecord(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (record: TDSMasterRecord) => {
    setEditRecord(record);
    setForm({
      serviceName: record.serviceName,
      paymentNature: record.paymentNature,
      sectionCode: record.sectionCode,
      ratePercent: record.ratePercent,
      thresholdAmount: record.thresholdAmount,
      effectiveFrom: record.effectiveFrom.split("T")[0],
      effectiveTo: record.effectiveTo ? record.effectiveTo.split("T")[0] : null,
      remarks: record.remarks ?? "",
      status: record.status,
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.serviceName.trim()) e.serviceName = "Service name is required.";
    if (!form.paymentNature.trim())
      e.paymentNature = "Payment nature is required.";
    if (!form.sectionCode.trim()) e.sectionCode = "Section code is required.";

    const rate = parseFloat(form.ratePercent);
    if (isNaN(rate) || rate < PERCENTAGE_MIN || rate > PERCENTAGE_MAX) {
      e.ratePercent = `Rate must be between ${PERCENTAGE_MIN} and ${PERCENTAGE_MAX}.`;
    }

    if (!form.thresholdAmount.trim()) {
      e.thresholdAmount = "Threshold amount is required.";
    } else if (!AMOUNT_REGEX.test(form.thresholdAmount)) {
      e.thresholdAmount = "Enter a valid amount (e.g. 50000.00).";
    }

    if (!form.effectiveFrom)
      e.effectiveFrom = "Effective from date is required.";
    if (
      form.effectiveTo &&
      form.effectiveFrom &&
      form.effectiveTo < form.effectiveFrom
    ) {
      e.effectiveTo = "Effective to must be after effective from.";
    }

    if ((form.remarks ?? "").length > REMARKS_MAX) {
      e.remarks = `Remarks must be ${REMARKS_MAX} characters or fewer.`;
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const isFormValid = (): boolean => {
    if (!form.serviceName.trim()) return false;
    if (!form.paymentNature.trim()) return false;
    if (!form.sectionCode.trim()) return false;
    const rate = parseFloat(form.ratePercent);
    if (isNaN(rate) || rate < PERCENTAGE_MIN || rate > PERCENTAGE_MAX)
      return false;
    if (
      !form.thresholdAmount.trim() ||
      !AMOUNT_REGEX.test(form.thresholdAmount)
    )
      return false;
    if (!form.effectiveFrom) return false;
    if (form.effectiveTo && form.effectiveTo < form.effectiveFrom) return false;
    if ((form.remarks ?? "").length > REMARKS_MAX) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      const payload: TDSMasterFormData = {
        ...form,
        serviceName: form.serviceName.trim(),
        paymentNature: form.paymentNature.trim(),
        sectionCode: form.sectionCode.trim(),
        remarks: form.remarks?.trim() ?? "",
        effectiveTo: form.effectiveTo || null,
      };
      if (editRecord) {
        await updateMutation.mutateAsync({ id: editRecord.id, data: payload });
        toast({
          title: "Updated",
          description: `TDS "${payload.serviceName}" updated successfully.`,
        });
      } else {
        await createMutation.mutateAsync(payload);
        toast({
          title: "Created",
          description: `TDS "${payload.serviceName}" created successfully.`,
        });
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { error?: string } })?.data?.error ??
        "An error occurred. Please try again.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleToggleConfirm = async () => {
    if (!toggleTarget) return;
    try {
      await toggleMutation.mutateAsync(toggleTarget.id);
      toast({
        title: "Status Updated",
        description: `TDS "${toggleTarget.serviceName}" is now ${toggleTarget.status ? "Inactive" : "Active"}.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update status.",
        variant: "destructive",
      });
    } finally {
      setToggleTarget(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({
        title: "Deleted",
        description: `TDS "${deleteTarget.serviceName}" has been deleted.`,
      });
      setDeleteTarget(null);
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete record.",
        variant: "destructive",
      });
    }
  };

  // Export handler
  const handleExportAll = async () => {
    setExportLoading(true);
    try {
      const allRows = await fetchAllTDSForExport(debouncedSearch, statusFilter);

      const exportData = allRows.map((r) => ({
        "Service Name": r.serviceName,
        "Payment Nature": r.paymentNature,
        "Section Code": r.sectionCode,
        "Rate %": r.ratePercent,
        Threshold: r.thresholdAmount,
        "Effective From": r.effectiveFrom,
        "Effective To": r.effectiveTo ?? "",
        Remarks: r.remarks ?? "",
        Status: r.status ? "Active" : "Inactive",
        "Created By": r.createdByUser?.username ?? "—",
        "Created At": formatDate(r.createdAt),
        "Updated By": r.updatedByUser?.username ?? "—",
        "Updated At": formatDate(r.updatedAt),
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 20 },
        { wch: 18 },
        { wch: 12 },
        { wch: 8 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 30 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "TDS Master");
      XLSX.writeFile(wb, "TDS_Master.xlsx");

      toast({
        title: "Export Complete",
        description: `${allRows.length} record(s) exported.`,
      });
    } catch (error) {
      console.log(error);
      toast({
        title: "Export Failed",
        description: "Could not fetch records for export.",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  };

  const downloadSample = () => {
    setImportMenuOpen(false);

    const sampleData = [
      {
        serviceName: "Interest on Fixed Deposits",
        paymentNature: "Interest",
        sectionCode: "194A",
        ratePercent: 10,
        thresholdAmount: 5000,
        effectiveFrom: "2025-04-01",
        effectiveTo: "",
        remarks: "Applicable for banks",
      },
      {
        serviceName: "Contractor Payments",
        paymentNature: "Contract",
        sectionCode: "194C",
        ratePercent: 1,
        thresholdAmount: 30000,
        effectiveFrom: "2025-04-01",
        effectiveTo: "2026-03-31",
        remarks: "",
      },
      {
        serviceName: "Commission on Sales",
        paymentNature: "Commission",
        sectionCode: "194H",
        ratePercent: 5,
        thresholdAmount: 15000,
        effectiveFrom: "2025-01-01",
        effectiveTo: "",
        remarks: "Brokerage payments",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws["!cols"] = [
      { wch: 30 }, // serviceName
      { wch: 20 }, // paymentNature
      { wch: 14 }, // sectionCode
      { wch: 14 }, // ratePercent
      { wch: 16 }, // thresholdAmount
      { wch: 16 }, // effectiveFrom
      { wch: 16 }, // effectiveTo
      { wch: 40 }, // remarks
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TDS Import Template");
    XLSX.writeFile(wb, "TDS_Import_Sample.xlsx");

    toast({
      title: "Sample Downloaded",
      description: "Fill in the template and upload it to import TDS records.",
    });
  };

  // Import handler
  // const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;

  //   setImportLoading(true);
  //   setImportMenuOpen(false);
  //   setImportResult(null);
  //   setImportResultOpen(false);

  //   try {
  //     const data = await file.arrayBuffer();
  //     const workbook = XLSX.read(data, { type: "array" });
  //     const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  //     const jsonData = XLSX.utils.sheet_to_json(firstSheet);

  //     if (!jsonData.length) {
  //       toast({
  //         title: "Empty File",
  //         description: "The uploaded file contains no data.",
  //         variant: "destructive",
  //       });
  //       return;
  //     }

  //     // Validate required columns
  //     const requiredColumns = [
  //       "serviceName",
  //       "paymentNature",
  //       "sectionCode",
  //       "ratePercent",
  //       "thresholdAmount",
  //       "effectiveFrom",
  //     ];
  //     const firstRow = jsonData[0] as Record<string, unknown>;
  //     const missing = requiredColumns.filter((col) => !(col in firstRow));
  //     if (missing.length) {
  //       toast({
  //         title: "Invalid Template",
  //         description: `Missing columns: ${missing.join(", ")}. Please use the downloaded sample.`,
  //         variant: "destructive",
  //       });
  //       return;
  //     }

  //     // Send JSON array to backend
  //     const response = await fetch("/api/tds-master/import", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${localStorage.getItem("zarierp_token")}`,
  //       },
  //       body: JSON.stringify(jsonData),
  //     });

  //     const result = await response.json();

  //     if (!response.ok) {
  //       throw new Error(result.error || "Import failed");
  //     }

  //     // Normalize and enrich errors with serviceName
  //     const normalized = normalizeImportResult(result);
  //     if (normalized.errors.length > 0) {
  //       normalized.errors = normalized.errors.map((err) => {
  //         // The server returns 1‑based row numbers (starting at 2)
  //         const rowIndex = err.row - 2;
  //         const rowData = jsonData[rowIndex] as Record<string, unknown> | undefined;
  //         const serviceName = rowData?.serviceName ? String(rowData.serviceName) : "";
  //         return {
  //           ...err,
  //           name: serviceName || err.name || "", // fallback to existing name if any
  //         };
  //       });
  //     }

  //     setImportResult(normalized);
  //     setImportResultOpen(true);

  //     // Refresh table
  //     queryClient.invalidateQueries({ queryKey: ["tdsMasterList"] });
  //   } catch (error: unknown) {
  //     console.error(error);
  //     toast({
  //       title: "Import Failed",
  //       description: (error as Error).message || "Could not process the file.",
  //       variant: "destructive",
  //     });
  //   } finally {
  //     setImportLoading(false);
  //     if (importFileRef.current) importFileRef.current.value = "";
  //   }
  // };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportMenuOpen(false);
    setImportResult(null);
    setImportResultOpen(false);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);

      if (!jsonData.length) {
        toast({
          title: "Empty File",
          description: "The uploaded file contains no data.",
          variant: "destructive",
        });
        return;
      }

      // Validate required columns
      const requiredColumns = [
        "serviceName",
        "paymentNature",
        "sectionCode",
        "ratePercent",
        "thresholdAmount",
        "effectiveFrom",
      ];
      const firstRow = jsonData[0] as Record<string, unknown>;
      const missing = requiredColumns.filter((col) => !(col in firstRow));
      if (missing.length) {
        toast({
          title: "Invalid Template",
          description: `Missing columns: ${missing.join(", ")}. Please use the downloaded sample.`,
          variant: "destructive",
        });
        return;
      }

      // Use the hook to send the data
      const result = await importMutation.mutateAsync(jsonData as TDSMasterImportRow[]);

      // Normalize and enrich errors with serviceName
      const normalized = normalizeImportResult(result);
      if (normalized.errors.length > 0) {
        normalized.errors = normalized.errors.map((err) => {
          const rowIndex = err.row - 2;
          const rowData = jsonData[rowIndex] as Record<string, unknown> | undefined;
          const serviceName = rowData?.serviceName ? String(rowData.serviceName) : "";
          return {
            ...err,
            name: serviceName || err.name || "",
          };
        });
      }

      setImportResult(normalized);
      setImportResultOpen(true);

      // Table is already invalidated by the mutation's onSuccess
    } catch (error: unknown) {
      console.error(error);
      toast({
        title: "Import Failed",
        description: (error as Error).message || "Could not process the file.",
        variant: "destructive",
      });
    } finally {
      setImportLoading(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  const asTDS = (r: TableRow) => r as unknown as TDSMasterRecord;

  const columns: Column[] = [
    {
      key: "srNo",
      label: "Sr No",
      className: "w-16 text-center",
      render: (r) => {
        const idx = rows.findIndex((row) => row.id === asTDS(r).id);
        const srNo = (page - 1) * limit + (idx === -1 ? 0 : idx) + 1;
        return (
          <span className="text-gray-400 text-xs font-medium">{srNo}</span>
        );
      },
    },
    {
      key: "serviceName",
      label: "Service Name",
      render: (r) => (
        <span className="font-semibold text-gray-900">
          {asTDS(r).serviceName}
        </span>
      ),
    },
    {
      key: "paymentNature",
      label: "Payment Nature",
      render: (r) => <span>{asTDS(r).paymentNature}</span>,
    },
    {
      key: "sectionCode",
      label: "Section Code",
      render: (r) => <span className="font-mono">{asTDS(r).sectionCode}</span>,
    },
    {
      key: "ratePercent",
      label: "Rate %",
      render: (r) => (
        <span className="font-medium">{asTDS(r).ratePercent}%</span>
      ),
    },
    {
      key: "thresholdAmount",
      label: "Threshold",
      render: (r) => (
        <span className="font-medium">{asTDS(r).thresholdAmount}</span>
      ),
    },
    {
      key: "effectiveFrom",
      label: "Effective From",
      render: (r) => (
        <span className="whitespace-nowrap">
          {formatDate(asTDS(r).effectiveFrom)}
        </span>
      ),
    },
    {
      key: "effectiveTo",
      label: "Effective To",
      render: (r) => (
        <span className="whitespace-nowrap">
          {formatDate(asTDS(r).effectiveTo)}
        </span>
      ),
    },
    {
      key: "remarks",
      label: "Remarks",
      render: (r) => (
        <span
          className="max-w-xs block truncate"
          title={asTDS(r).remarks ?? ""}
        >
          {asTDS(r).remarks ?? "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusToggle
          isActive={asTDS(r).status}
          onToggle={() => canAddEdit && setToggleTarget(asTDS(r))}
          loading={toggleMutation.isPending && toggleTarget?.id === asTDS(r).id}
        />
      ),
    },
    {
      key: "createdBy",
      label: "Created By",
      render: (r) => (
        <span className="text-gray-500">
          {asTDS(r).createdByUser?.username}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Created At",
      render: (r) => (
        <span className="text-gray-500 whitespace-nowrap">
          {formatDate(asTDS(r).createdAt)}
        </span>
      ),
    },
    {
      key: "updatedBy",
      label: "Updated By",
      render: (r) => (
        <span className="text-gray-500">
          {asTDS(r).updatedByUser?.username || "—"}
        </span>
      ),
    },
    {
      key: "updatedAt",
      label: "Updated At",
      render: (r) => (
        <span className="text-gray-500 whitespace-nowrap">
          {formatDate(asTDS(r).updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-2">
          {canAddEdit && (
            <button
              onClick={() => openEdit(asTDS(r))}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setDeleteTarget(asTDS(r))}
              disabled={deleteMutation.isPending}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const filteredColumns =
    canAddEdit || canDelete
      ? columns
      : columns.filter((c) => c.key !== "actions");

  const submitting = createMutation.isPending || updateMutation.isPending;
  const formValid = isFormValid();

  if (!user) return null;

  return (
    <AppLayout
      username={user.username}
      role={user.role}
      onLogout={handleLogout}
      isLoggingOut={logoutMutation.isPending}
    >
      <div className="max-w-screen-xl mx-auto space-y-5">
        <MasterHeader
          title="TDS Master"
          onAdd={openAdd}
          addLabel="Add TDS"
          addPermission={MASTERS_TDS.ADD_EDIT}
        />

        {/* Filters row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchBar
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search by service name, section code..."
            />
          </div>

          <div className="sm:w-44">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {(search || statusFilter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors whitespace-nowrap"
            >
              Clear Filters
            </button>
          )}

          {/* Export button */}
          {canDownload && (
            <button
              onClick={handleExportAll}
              disabled={exportLoading || isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown className="h-4 w-4" />
              {exportLoading ? "Exporting…" : "Export to Excel"}
            </button>
          )}

          {/* Import button with dropdown */}
          {canImport && (
            <div className="relative" ref={importMenuRef}>
              <button
                onClick={() => setImportMenuOpen((v) => !v)}
                disabled={importLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#C9B45C]/50 bg-white text-sm font-medium text-gray-700 shadow-sm hover:border-[#C9B45C] hover:bg-amber-50/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileInput className="h-4 w-4 text-[#C6AF4B]" />
                {importLoading ? "Importing…" : "Import Data"}
                <ChevronDown
                  className={`h-3.5 w-3.5 text-gray-400 transition-transform ${importMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {importMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={downloadSample}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-medium">Download Sample</p>
                      <p className="text-xs text-gray-400">
                        Get the Excel template
                      </p>
                    </div>
                  </button>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={() => {
                      setImportMenuOpen(false);
                      importFileRef.current?.click();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    <FileUp className="h-4 w-4 text-blue-600 shrink-0" />
                    <div>
                      <p className="font-medium">Upload Excel File</p>
                      <p className="text-xs text-gray-400">
                        Import records from file
                      </p>
                    </div>
                  </button>
                </div>
              )}
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>
          )}
        </div>

        {/* Data table */}
        <MasterTable
          columns={filteredColumns}
          rows={rows as unknown as TableRow[]}
          loading={isLoading}
          rowKey={(r) => asTDS(r).id}
          emptyText="No TDS records found. Click 'Add TDS' to create one."
          pagination={{
            page,
            limit,
            total,
            onPageChange: setPage,
            onLimitChange: (l) => {
              setLimit(l);
              setPage(1);
            },
          }}
        />
      </div>

      {/* Add / Edit Modal */}
      <MasterFormModal
        open={modalOpen}
        title={editRecord ? `Edit TDS — ${editRecord.serviceName}` : "Add TDS"}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editRecord ? "Update" : "Create"}
        submitDisabled={!formValid}
      >
        <InputField
          label="Service Name"
          required
          placeholder="e.g. Professional Services"
          value={form.serviceName}
          maxLength={255}
          onChange={(e) => {
            setForm((f) => ({ ...f, serviceName: e.target.value }));
            setErrors((prev) => ({ ...prev, serviceName: undefined }));
          }}
          error={errors.serviceName}
        />

        <InputField
          label="Payment Nature"
          required
          placeholder="e.g. Professional Fees"
          value={form.paymentNature}
          maxLength={255}
          onChange={(e) => {
            setForm((f) => ({ ...f, paymentNature: e.target.value }));
            setErrors((prev) => ({ ...prev, paymentNature: undefined }));
          }}
          error={errors.paymentNature}
        />

        <InputField
          label="Section Code"
          required
          placeholder="e.g. 194J"
          value={form.sectionCode}
          maxLength={20}
          onChange={(e) => {
            setForm((f) => ({ ...f, sectionCode: e.target.value }));
            setErrors((prev) => ({ ...prev, sectionCode: undefined }));
          }}
          error={errors.sectionCode}
        />

        <InputField
          label="Rate %"
          required
          placeholder="e.g. 10.00"
          value={form.ratePercent}
          type="number"
          min={PERCENTAGE_MIN}
          max={PERCENTAGE_MAX}
          step="any"
          onChange={(e) => {
            const val = e.target.value;
            setForm((f) => ({ ...f, ratePercent: val }));
            const num = parseFloat(val);
            if (isNaN(num) || num < PERCENTAGE_MIN || num > PERCENTAGE_MAX) {
              setErrors((prev) => ({
                ...prev,
                ratePercent: `Must be between ${PERCENTAGE_MIN} and ${PERCENTAGE_MAX}`,
              }));
            } else {
              setErrors((prev) => ({ ...prev, ratePercent: undefined }));
            }
          }}
          error={errors.ratePercent}
        />

        <InputField
          label="Threshold Amount"
          required
          placeholder="e.g. 50000.00"
          value={form.thresholdAmount}
          type="text"
          inputMode="decimal"
          onChange={(e) => {
            const val = e.target.value;
            setForm((f) => ({ ...f, thresholdAmount: val }));
            if (val && !AMOUNT_REGEX.test(val)) {
              setErrors((prev) => ({
                ...prev,
                thresholdAmount: "Enter a valid amount (e.g. 50000.00).",
              }));
            } else {
              setErrors((prev) => ({ ...prev, thresholdAmount: undefined }));
            }
          }}
          error={errors.thresholdAmount}
        />

        <InputField
          label="Effective From"
          required
          type="date"
          value={form.effectiveFrom}
          onChange={(e) => {
            setForm((f) => ({ ...f, effectiveFrom: e.target.value }));
            setErrors((prev) => ({ ...prev, effectiveFrom: undefined }));
          }}
          error={errors.effectiveFrom}
        />

        <InputField
          label="Effective To"
          type="date"
          value={form.effectiveTo ?? ""}
          onChange={(e) => {
            const val = e.target.value || null;
            setForm((f) => ({ ...f, effectiveTo: val }));
            if (val && form.effectiveFrom && val < form.effectiveFrom) {
              setErrors((prev) => ({
                ...prev,
                effectiveTo: "Must be after effective from.",
              }));
            } else {
              setErrors((prev) => ({ ...prev, effectiveTo: undefined }));
            }
          }}
          error={errors.effectiveTo}
        />

        <div className="flex flex-col gap-1.5">
          <TextareaField
            label="Remarks"
            placeholder="Optional notes..."
            value={form.remarks ?? ""}
            maxLength={REMARKS_MAX}
            onChange={(e) => {
              const val = e.target.value;
              setForm((f) => ({ ...f, remarks: val }));
              if (val.length > REMARKS_MAX) {
                setErrors((prev) => ({
                  ...prev,
                  remarks: `Max ${REMARKS_MAX} characters.`,
                }));
              } else {
                setErrors((prev) => ({ ...prev, remarks: undefined }));
              }
            }}
            error={errors.remarks}
            rows={2}
          />
          <p
            className={`text-xs text-right -mt-1 ${(form.remarks ?? "").length > REMARKS_MAX ? "text-red-500" : "text-gray-400"}`}
          >
            {(form.remarks ?? "").length} / {REMARKS_MAX} characters used
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, status: !f.status }))}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900/20 ${
              form.status ? "bg-gray-900" : "bg-gray-300"
            }`}
            role="switch"
            aria-checked={form.status}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                form.status ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm ${form.status ? "text-emerald-600 font-medium" : "text-gray-400"}`}
          >
            {form.status ? "Active" : "Inactive"}
          </span>
        </div>
      </MasterFormModal>

      {/* Status toggle confirmation */}
      <ConfirmModal
        open={!!toggleTarget}
        title="Change Status"
        message={
          toggleTarget
            ? `Are you sure you want to change the status of TDS "${toggleTarget.serviceName}" to ${toggleTarget.status ? "Inactive" : "Active"}?`
            : ""
        }
        confirmLabel="Yes, Change"
        cancelLabel="No, Cancel"
        onConfirm={handleToggleConfirm}
        onCancel={() => setToggleTarget(null)}
        loading={toggleMutation.isPending}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete TDS Record"
        message={
          deleteTarget
            ? `Are you sure you want to delete TDS "${deleteTarget.serviceName}"? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />

      {/* Import result modal */}
      <ImportResultModal
        open={importResultOpen}
        result={importResult}
        entityName="TDS Records"
        onClose={() => setImportResultOpen(false)}
      />
    </AppLayout>
  );
}