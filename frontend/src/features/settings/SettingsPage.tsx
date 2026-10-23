import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { User, Building2, SlidersHorizontal, Save, Sun, Moon, MonitorSmartphone } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { Store } from "@/types";
import { useAuth } from "@/features/auth/AuthContext";
import { useTheme, type ThemeMode } from "@/features/theme/ThemeContext";
import { PageHeader } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: MonitorSmartphone },
];

interface Preferences {
  dateFormat: "dd-mm-yyyy" | "mm-dd-yyyy" | "yyyy-mm-dd";
  timeFormat: "12" | "24";
  defaultStoreId: string;
  defaultPage: string;
}

const PREFERENCES_KEY = "invento_preferences";

const DEFAULT_PREFERENCES: Preferences = { dateFormat: "dd-mm-yyyy", timeFormat: "12", defaultStoreId: "", defaultPage: "/dashboard" };

const DEFAULT_PAGE_OPTIONS = [
  { value: "/dashboard", label: "Home Dashboard" },
  { value: "/inventory/current-stock", label: "Current Stock" },
  { value: "/inventory/stock-ledger", label: "Stock Ledger" },
  { value: "/sell/new", label: "Sell Part" },
  { value: "/issues", label: "Issued Parts" },
  { value: "/reports/stock", label: "Stock Report" },
];

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function SettingsPage() {
  const { user, tenant } = useAuth();
  const { theme, setTheme } = useTheme();
  const { push } = useToast();
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => (await apiClient.get<{ data: Store[] }>("/stores")).data.data,
  });

  function savePreferences() {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
      push({ tone: "success", title: "Preferences saved", description: "Saved to this device." });
    } catch {
      push({ tone: "error", title: "Unable to save preferences", description: "This browser is blocking local storage." });
    }
  }

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

        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">Preferences</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label>Date Format</Label>
                <Select value={prefs.dateFormat} onChange={(e) => setPrefs({ ...prefs, dateFormat: e.target.value as Preferences["dateFormat"] })}>
                  <option value="dd-mm-yyyy">dd-mm-yyyy</option>
                  <option value="mm-dd-yyyy">mm-dd-yyyy</option>
                  <option value="yyyy-mm-dd">yyyy-mm-dd</option>
                </Select>
              </div>
              <div>
                <Label>Time Format</Label>
                <Select value={prefs.timeFormat} onChange={(e) => setPrefs({ ...prefs, timeFormat: e.target.value as Preferences["timeFormat"] })}>
                  <option value="12">12 Hour (AM/PM)</option>
                  <option value="24">24 Hour</option>
                </Select>
              </div>
              <div>
                <Label>Default Store</Label>
                <Select value={prefs.defaultStoreId} onChange={(e) => setPrefs({ ...prefs, defaultStoreId: e.target.value })}>
                  <option value="">No preference</option>
                  {stores?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Default Page</Label>
                <Select value={prefs.defaultPage} onChange={(e) => setPrefs({ ...prefs, defaultPage: e.target.value })}>
                  {DEFAULT_PAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              Saved to this device only — these don't yet change how dates are formatted app-wide or redirect you after login.
            </p>

            <div className="mt-4 flex justify-end">
              <Button onClick={savePreferences}>
                <Save className="h-4 w-4" /> Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
