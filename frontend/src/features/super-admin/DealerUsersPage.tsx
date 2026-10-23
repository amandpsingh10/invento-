import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { AppUser, DealerTenant, RoleName } from "@/types";
import { PageHeader } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { PRIMARY_TABS, MORE_MENU_GROUPS } from "@/components/layout/moreMenuItems";

/** Whether a menu item is visible to this set of roles by default, before any Super-Admin override is applied. */
function roleDefault(roles: RoleName[] | undefined, userRoles: RoleName[]): boolean {
  return !roles || roles.some((r) => userRoles.includes(r));
}

function MenuAccessDialog({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const { push } = useToast();
  const queryClient = useQueryClient();

  const { data: overrides, isLoading } = useQuery({
    queryKey: ["user-menu-access", user.id],
    queryFn: async () => (await apiClient.get<{ data: Record<string, boolean> }>(`/admin/users/${user.id}/menu-access`)).data.data,
  });

  const [checked, setChecked] = useState<Record<string, boolean> | null>(null);

  // Seed local checkbox state from role-defaults + fetched overrides, once per fetch.
  if (overrides && !checked) {
    const initial: Record<string, boolean> = {};
    for (const tab of PRIMARY_TABS) initial[tab.key] = overrides[tab.key] ?? roleDefault(tab.roles, user.roles);
    for (const group of MORE_MENU_GROUPS) {
      for (const item of group.items) initial[item.key] = overrides[item.key] ?? roleDefault(item.roles, user.roles);
    }
    setChecked(initial);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!checked) return;
      const items = [
        ...PRIMARY_TABS.map((tab) => ({ key: tab.key, roles: tab.roles })),
        ...MORE_MENU_GROUPS.flatMap((g) => g.items.map((item) => ({ key: item.key, roles: item.roles }))),
      ]
        // Only persist an explicit override where it actually differs from
        // the role default — an untouched item stays undetermined server-side
        // so it keeps tracking the role default automatically in future.
        .filter(({ key, roles }) => checked[key] !== roleDefault(roles, user.roles))
        .map(({ key }) => ({ menuKey: key, allowed: checked[key] }));
      return apiClient.put(`/admin/users/${user.id}/menu-access`, { items });
    },
    onSuccess: () => {
      push({ tone: "success", title: "Menu access updated" });
      queryClient.invalidateQueries({ queryKey: ["user-menu-access", user.id] });
      onClose();
    },
    onError: (err) => push({ tone: "error", title: "Failed", description: getApiErrorMessage(err) }),
  });

  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`Menu Access — ${user.firstName} ${user.lastName}`}
      description="Choose which menu items this user can see. Unchecked items are hidden even if their role would normally allow them."
      className="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={save.isPending} onClick={() => save.mutate()}>
            Save Changes
          </Button>
        </>
      }
    >
      {isLoading || !checked ? (
        <div className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">Loading…</div>
      ) : (
        <div className="max-h-[60vh] space-y-4 overflow-y-auto thin-scroll pr-1">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Primary Tabs</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PRIMARY_TABS.map((tab) => (
                <label key={tab.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-navy-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-navy-600"
                    checked={checked[tab.key] ?? true}
                    onChange={(e) => setChecked({ ...checked, [tab.key]: e.target.checked })}
                  />
                  <span className="truncate">{tab.label}</span>
                </label>
              ))}
            </div>
          </div>

          {MORE_MENU_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{group.label}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.items.map((item) => (
                  <label key={item.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-navy-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-navy-600"
                      checked={checked[item.key] ?? true}
                      onChange={(e) => setChecked({ ...checked, [item.key]: e.target.checked })}
                    />
                    <span className="truncate">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}

export function DealerUsersPage() {
  const { id } = useParams<{ id: string }>();
  const [menuAccessUser, setMenuAccessUser] = useState<AppUser | null>(null);

  const { data: tenant } = useQuery({
    queryKey: ["admin-tenant", id],
    queryFn: async () => (await apiClient.get<{ data: DealerTenant }>(`/admin/tenants/${id}`)).data.data,
    enabled: !!id,
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-tenant-users", id],
    queryFn: async () => (await apiClient.get<{ data: AppUser[] }>(`/admin/tenants/${id}/users`)).data.data,
    enabled: !!id,
  });

  return (
    <div>
      <Link to="/super-admin/dealers" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader title="Dealer Users" subtitle={tenant ? `${tenant.name} (${tenant.dealerCode}) — manage menu access per user.` : "Manage menu access per user."} />

      <Card>
        <DataTable<AppUser>
          isLoading={isLoading}
          items={users ?? []}
          rowKey={(u) => u.id}
          emptyTitle="No users yet"
          columns={
            [
              { header: "Name", render: (u) => <span className="font-medium text-slate-800 dark:text-slate-200">{u.firstName} {u.lastName}</span> },
              { header: "Mobile", render: (u) => u.mobile },
              { header: "Role", render: (u) => u.roles.join(", ").replace(/_/g, " ") },
              { header: "Status", render: (u) => <Badge tone={u.isActive ? "success" : "neutral"}>{u.isActive ? "Active" : "Inactive"}</Badge> },
              {
                header: "Actions",
                align: "right",
                render: (u) => (
                  <button
                    onClick={() => setMenuAccessUser(u)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:text-slate-500 dark:hover:bg-brand-500/15 dark:hover:text-brand-400"
                    title="Menu Access"
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </button>
                ),
              },
            ] satisfies DataColumn<AppUser>[]
          }
        />
      </Card>

      {menuAccessUser && <MenuAccessDialog user={menuAccessUser} onClose={() => setMenuAccessUser(null)} />}
    </div>
  );
}
