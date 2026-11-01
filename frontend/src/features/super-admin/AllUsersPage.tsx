import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import type { PlatformUser } from "@/types";
import { PageHeader } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/Badge";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { formatDate } from "@/lib/utils";

/** Read-only directory of every dealer-side user across every tenant. Managing one (role, status, menu access) still happens per-dealer via Dealers → Manage Users. */
export function AllUsersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: async () => (await apiClient.get<{ data: PlatformUser[] }>("/admin/users")).data.data,
  });

  return (
    <div>
      <PageHeader title="Users" subtitle="Every dealer-side user across the platform." hideBack />

      <Card>
        <DataTable<PlatformUser>
          isLoading={isLoading}
          items={data ?? []}
          rowKey={(u) => u.id}
          emptyTitle="No users yet"
          columns={
            [
              { header: "Name", render: (u) => <span className="font-medium text-slate-800 dark:text-slate-200">{u.firstName} {u.lastName}</span> },
              { header: "Mobile", render: (u) => u.mobile },
              {
                header: "Dealer",
                render: (u) =>
                  u.dealerCode ? (
                    <Link to="/super-admin/dealers" className="text-brand-600 hover:text-brand-700 dark:text-brand-400">
                      {u.tenantName} <span className="text-slate-400 dark:text-slate-500">({u.dealerCode})</span>
                    </Link>
                  ) : (
                    "—"
                  ),
              },
              { header: "Role", render: (u) => u.roles.join(", ").replace(/_/g, " ") },
              { header: "Status", render: (u) => <StatusDot tone={u.isActive ? "success" : "neutral"}>{u.isActive ? "Active" : "Inactive"}</StatusDot> },
              { header: "Last Login", render: (u) => (u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never") },
            ] satisfies DataColumn<PlatformUser>[]
          }
        />
      </Card>
    </div>
  );
}
