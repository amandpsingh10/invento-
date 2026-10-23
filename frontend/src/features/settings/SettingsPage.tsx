import { User, Building2, Sun, Moon, MonitorSmartphone } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useTheme, type ThemeMode } from "@/features/theme/ThemeContext";
import { PageHeader } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: MonitorSmartphone },
];

export function SettingsPage() {
  const { user, tenant } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your account and dealership information." breadcrumbs={["Settings"]} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <User className="h-5 w-5" />
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">My Profile</p>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Name</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  {user?.firstName} {user?.lastName}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Mobile Number</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{user?.mobile}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Email</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{user?.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Role</p>
                <div className="mt-1 flex gap-1.5">
                  {user?.roles.map((r) => (
                    <Badge key={r} tone="info">
                      {r.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <Building2 className="h-5 w-5" />
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">Dealership Information</p>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Dealer Name</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{tenant?.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Dealer Code</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{tenant?.dealerCode}</p>
              </div>
              {tenant?.address && (
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Dealer Address</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300">{tenant.address}</p>
                </div>
              )}
              {tenant?.status && (
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Status</p>
                  <Badge tone="success">{tenant.status}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <Moon className="h-5 w-5" />
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">Appearance</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-sm font-medium transition-colors",
                    theme === opt.value
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-navy-700 dark:text-slate-400 dark:hover:bg-navy-800"
                  )}
                >
                  <opt.icon className="h-5 w-5" />
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              "System" follows your device's own light/dark (night mode) setting automatically.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
