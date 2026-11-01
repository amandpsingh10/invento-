import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { UserPlus, Ban, Pencil, KeyRound, ShieldCheck, MoreVertical, Phone, Mail, Shield, Clock } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { AppUser, RoleName } from "@/types";
import { PageHeader } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, FieldError } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { Badge, StatusDot } from "@/components/ui/Badge";
import { IconFieldRow } from "@/components/ui/IconFieldRow";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import { PRIMARY_TABS, MORE_MENU_GROUPS } from "@/components/layout/moreMenuItems";

const ROLES: { value: RoleName; label: string }[] = [
  { value: "TENANT_ADMIN", label: "Tenant Admin" },
  { value: "INVENTORY_MANAGER", label: "Inventory Manager" },
  { value: "STORE_USER", label: "Store User" },
  { value: "VIEWER", label: "Viewer" },
];

const emptyCreateForm = { email: "", mobile: "", firstName: "", lastName: "", password: "", role: "STORE_USER" as RoleName };

type EditForm = { firstName: string; lastName: string; email: string; mobile: string; role: RoleName; isActive: boolean };

/** Whether a menu item is visible to this set of roles by default, before any override is applied. */
function roleDefault(roles: RoleName[] | undefined, userRoles: RoleName[]): boolean {
  return !roles || roles.some((r) => userRoles.includes(r));
}

/**
 * Tenant Admin's own version of Super Admin's DealerUsersPage menu-access
 * editor — same UI, scoped to /users/:id/menu-access (this tenant's own
 * users only) instead of /admin/users/:id/menu-access (any tenant). A menu
 * a plan doesn't include stays hidden no matter what's checked here — see
 * auth.service.ts loadMenuAccess, which applies that cap on top.
 */
function MenuAccessDialog({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const { push } = useToast();
  const queryClient = useQueryClient();

  const { data: overrides, isLoading } = useQuery({
    queryKey: ["user-menu-access", user.id],
    queryFn: async () => (await apiClient.get<{ data: Record<string, boolean> }>(`/users/${user.id}/menu-access`)).data.data,
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
      return apiClient.put(`/users/${user.id}/menu-access`, { items });
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

function UserMobileCard({
  u,
  onEdit,
  onMenuAccess,
  onResetPassword,
  onDeactivate,
}: {
  u: AppUser;
  onEdit: () => void;
  onMenuAccess: () => void;
  onResetPassword: () => void;
  onDeactivate: () => void;
}) {
  const initials = `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase();
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-navy-700 dark:bg-navy-900">
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-base font-bold text-slate-900 dark:text-slate-100" title={`${u.firstName} ${u.lastName}`}>
              {u.firstName} {u.lastName}
            </p>
            <Badge tone={u.isActive ? "success" : "neutral"} className="shrink-0">{u.isActive ? "Active" : "Inactive"}</Badge>
          </div>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400" title={u.roles.join(", ").replace(/_/g, " ")}>
            {u.roles.join(", ").replace(/_/g, " ")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pb-3 text-xs">
        <IconFieldRow icon={Phone} label="Mobile" value={u.mobile} />
        <IconFieldRow icon={Mail} label="Email" value={u.email} />
        <IconFieldRow icon={Shield} label="Role" value={u.roles.join(", ").replace(/_/g, " ")} />
        <IconFieldRow icon={Clock} label="Last Login" value={u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"} />
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 dark:border-navy-800">
        <button
          onClick={onEdit}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-100 py-2 text-sm font-semibold text-slate-600 active:scale-[0.98] dark:bg-navy-800 dark:text-slate-300"
        >
          <Pencil className="h-4 w-4" /> Edit
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-navy-800 dark:text-slate-400 dark:hover:bg-navy-700">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-50 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-navy-700 dark:bg-navy-900">
              <DropdownMenu.Item
                onSelect={onMenuAccess}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-600 outline-none hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-navy-800"
              >
                <ShieldCheck className="h-4 w-4" /> Menu Access
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={onResetPassword}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-600 outline-none hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-navy-800"
              >
                <KeyRound className="h-4 w-4" /> Reset Password
              </DropdownMenu.Item>
              {u.isActive && (
                <DropdownMenu.Item
                  onSelect={onDeactivate}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-600 outline-none hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <Ban className="h-4 w-4" /> Deactivate
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}

export function UsersPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyCreateForm);
  const [error, setError] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [resetPasswordUser, setResetPasswordUser] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  const [menuAccessUser, setMenuAccessUser] = useState<AppUser | null>(null);

  const { push } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await apiClient.get<{ data: AppUser[] }>("/users")).data.data,
  });

  const createUser = useMutation({
    mutationFn: async () => apiClient.post("/users", form),
    onSuccess: () => {
      push({ tone: "success", title: "User created" });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      setForm(emptyCreateForm);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const deactivateUser = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/users/${id}`),
    onSuccess: () => {
      push({ tone: "success", title: "User deactivated" });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => push({ tone: "error", title: "Failed", description: getApiErrorMessage(err) }),
  });

  function openEdit(u: AppUser) {
    setEditingUser(u);
    setEditError(null);
    setEditForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      mobile: u.mobile,
      role: u.roles[0] ?? "STORE_USER",
      isActive: u.isActive,
    });
  }

  const updateUser = useMutation({
    mutationFn: async () => apiClient.put(`/users/${editingUser!.id}`, editForm),
    onSuccess: () => {
      push({ tone: "success", title: "User updated" });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
      setEditForm(null);
    },
    onError: (err) => setEditError(getApiErrorMessage(err)),
  });

  function openResetPassword(u: AppUser) {
    setResetPasswordUser(u);
    setNewPassword("");
    setResetError(null);
  }

  const resetPassword = useMutation({
    mutationFn: async () => apiClient.post(`/users/${resetPasswordUser!.id}/reset-password`, { newPassword }),
    onSuccess: () => {
      push({ tone: "success", title: "Password updated", description: `${resetPasswordUser?.firstName} can now sign in with the new password.` });
      setResetPasswordUser(null);
      setNewPassword("");
    },
    onError: (err) => setResetError(getApiErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage dealer staff, their roles and login details."
        breadcrumbs={["Administration", "Users"]}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add User
          </Button>
        }
      />

      <Card>
        <DataTable<AppUser>
          isLoading={isLoading}
          items={data ?? []}
          rowKey={(u) => u.id}
          emptyTitle="No users yet"
          renderMobileCard={(u) => (
            <UserMobileCard
              u={u}
              onEdit={() => openEdit(u)}
              onMenuAccess={() => setMenuAccessUser(u)}
              onResetPassword={() => openResetPassword(u)}
              onDeactivate={() => deactivateUser.mutate(u.id)}
            />
          )}
          columns={
            [
              { header: "Name", render: (u) => <span className="font-medium text-slate-800 dark:text-slate-200">{u.firstName} {u.lastName}</span> },
              { header: "Mobile", render: (u) => u.mobile },
              { header: "Email", render: (u) => u.email },
              { header: "Role", render: (u) => u.roles.join(", ").replace(/_/g, " ") },
              { header: "Status", render: (u) => <StatusDot tone={u.isActive ? "success" : "neutral"}>{u.isActive ? "Active" : "Inactive"}</StatusDot> },
              { header: "Last Login", render: (u) => (u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never") },
              {
                header: "Actions",
                align: "right",
                render: (u) => (
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(u)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-navy-800 dark:hover:text-slate-200"
                      title="Edit user"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setMenuAccessUser(u)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-navy-800 dark:hover:text-slate-200"
                      title="Menu Access"
                    >
                      <ShieldCheck className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openResetPassword(u)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-navy-800 dark:hover:text-slate-200"
                      title="Reset password"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    {u.isActive && (
                      <button
                        onClick={() => deactivateUser.mutate(u.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        title="Deactivate"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ),
              },
            ] satisfies DataColumn<AppUser>[]
          }
        />
      </Card>

      {/* Add User */}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Add User"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={createUser.isPending} onClick={() => { setError(null); createUser.mutate(); }}>
              Create User
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First Name</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Mobile Number</Label>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="9876543210"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
            />
            <FieldError message="Used to sign in — 10-digit mobile number." />
          </div>
          <div>
            <Label>Temporary Password</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <FieldError message="Minimum 8 characters, with uppercase, lowercase and a number." />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as RoleName })}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Dialog>

      {/* Edit User */}
      <Dialog
        open={!!editingUser}
        onOpenChange={(o) => {
          if (!o) {
            setEditingUser(null);
            setEditForm(null);
          }
        }}
        title={`Edit ${editingUser?.firstName ?? "User"}`}
        footer={
          <>
            <Button variant="outline" onClick={() => { setEditingUser(null); setEditForm(null); }}>
              Cancel
            </Button>
            <Button isLoading={updateUser.isPending} onClick={() => { setEditError(null); updateUser.mutate(); }}>
              Save Changes
            </Button>
          </>
        }
      >
        {editForm && (
          <div className="space-y-3">
            {editError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{editError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name</Label>
                <Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Mobile Number</Label>
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={editForm.mobile}
                onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
              />
              <FieldError message="Used to sign in — 10-digit mobile number." />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as RoleName })}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-navy-600"
                checked={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
              />
              Active (can sign in)
            </label>
          </div>
        )}
      </Dialog>

      {/* Reset Password */}
      <Dialog
        open={!!resetPasswordUser}
        onOpenChange={(o) => !o && setResetPasswordUser(null)}
        title={`Reset Password — ${resetPasswordUser?.firstName ?? ""}`}
        description="Set a new password for this user. They'll need to sign in again with it."
        footer={
          <>
            <Button variant="outline" onClick={() => setResetPasswordUser(null)}>
              Cancel
            </Button>
            <Button isLoading={resetPassword.isPending} onClick={() => { setResetError(null); resetPassword.mutate(); }}>
              Update Password
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {resetError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">{resetError}</div>}
          <Label>New Password</Label>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <FieldError message="Minimum 8 characters, with uppercase, lowercase and a number." />
        </div>
      </Dialog>

      {menuAccessUser && <MenuAccessDialog user={menuAccessUser} onClose={() => setMenuAccessUser(null)} />}
    </div>
  );
}
