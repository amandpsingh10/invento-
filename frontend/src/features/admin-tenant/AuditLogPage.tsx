import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, RotateCcw, Search, Download, ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { PagedResult, AppUser } from "@/types";
import { PageHeader, Pagination } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/utils";
import { saveFileToDevice } from "@/lib/nativeFile";

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userEmail: string | null;
  role: string | null;
  ipAddress: string | null;
  createdAt: string;
}

// Every distinct action/entityType string ever passed to recordAudit() —
// hand-maintained since the backend has no enum or "distinct values"
// endpoint to derive this list from (see recordAudit() call sites).
const ACTIONS = [
  "LOGIN",
  "LOCATION_CREATED",
  "LOCATION_UPDATED",
  "STORE_CREATED",
  "STORE_UPDATED",
  "PART_CREATED",
  "PART_UPDATED",
  "EXCEL_UPLOADED",
  "PARTS_BULK_IMPORTED",
  "INVENTORY_ADDED",
  "PURCHASE_CREATED",
  "ISSUE_CREATED",
  "SALE_CREATED",
  "INVOICE_CANCELLED",
  "RETURN_CREATED",
  "ADJUSTMENT_CREATED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_PASSWORD_RESET",
  "USER_DEACTIVATED",
];

const ENTITIES = ["SESSION", "Store", "Bin", "Rack", "Part", "UploadedFile", "Purchase", "Issue", "Invoice", "Return", "StockAdjustment", "User"];

function AuditLogMobileCard({ log }: { log: AuditLogEntry }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-400">
        <History className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={log.action.replace(/_/g, " ")}>
          {log.action.replace(/_/g, " ")}
        </p>
        <p
          className="truncate text-xs text-slate-400 dark:text-slate-500"
          title={`${formatDateTime(log.createdAt)} · ${log.userEmail ?? "System"} · ${log.entityType}`}
        >
          {formatDateTime(log.createdAt)} &middot; {log.userEmail ?? "System"} &middot; {log.entityType}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
    </div>
  );
}

export function AuditLogPage() {
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { push } = useToast();

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await apiClient.get<{ data: AppUser[] }>("/users")).data.data,
  });

  const params = {
    action: action || undefined,
    userId: userId || undefined,
    entityType: entityType || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", params],
    queryFn: async () => (await apiClient.get<{ data: PagedResult<AuditLogEntry> }>("/audit-logs", { params })).data.data,
  });

  function resetFilters() {
    setAction("");
    setUserId("");
    setEntityType("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  async function exportExcel() {
    const res = await apiClient.get("/audit-logs", { params: { ...params, export: "excel", pageSize: 5000 }, responseType: "blob" });
    const file = new File([res.data], "Audit-Log.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const result = await saveFileToDevice(file);
    if (result === "shared") {
      push({ tone: "success", title: "Choose where to save", description: 'Pick "Save to Files" or "Drive" from the menu that opened.' });
    } else if (result === "downloaded") {
      push({ tone: "success", title: "Excel file downloaded" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Immutable record of every sensitive action taken in this dealership."
        breadcrumbs={["Administration", "Audit Log"]}
        actions={
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download className="h-4 w-4" /> Export Excel
          </Button>
        }
      />
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4 dark:border-navy-800">
          <div className="w-40">
            <Select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Actions</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-48">
            <Select
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Users</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Entities</option>
              {ENTITIES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-40">
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button variant="outline" size="sm" onClick={resetFilters}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button size="sm" onClick={() => setPage(1)}>
            <Search className="h-4 w-4" /> Search
          </Button>
        </div>

        <DataTable<AuditLogEntry>
          isLoading={isLoading}
          items={data?.items ?? []}
          rowKey={(log) => log.id}
          emptyTitle="No audit events yet"
          renderMobileCard={(log) => <AuditLogMobileCard log={log} />}
          columns={
            [
              { header: "Action", render: (log) => <span className="font-medium text-slate-800 dark:text-slate-200">{log.action.replace(/_/g, " ")}</span> },
              { header: "Timestamp", render: (log) => formatDateTime(log.createdAt) },
              { header: "User", render: (log) => log.userEmail ?? "System" },
              { header: "Role", render: (log) => log.role ?? "—" },
              { header: "Entity", render: (log) => log.entityType },
              { header: "IP Address", render: (log) => log.ipAddress ?? "—" },
            ] satisfies DataColumn<AuditLogEntry>[]
          }
        />
        {data && data.total > 0 && (
          <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}
