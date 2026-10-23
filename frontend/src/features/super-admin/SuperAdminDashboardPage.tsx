import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Clock, DollarSign, Users, Activity } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { PageHeader, Skeleton } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/branding";

interface PlatformDashboard {
  totalDealers: number;
  activeDealers: number;
  trialDealers: number;
  subscriptionRevenue: number;
  activeUsers: number;
  transactionsToday: number;
}

const CARDS: Array<{ key: keyof PlatformDashboard; label: string; icon: any; format?: "currency" }> = [
  { key: "totalDealers", label: "Total Dealers", icon: Building2 },
  { key: "activeDealers", label: "Active Dealers", icon: CheckCircle2 },
  { key: "trialDealers", label: "Trial Dealers", icon: Clock },
  { key: "subscriptionRevenue", label: "Subscription Revenue (Monthly)", icon: DollarSign, format: "currency" },
  { key: "activeUsers", label: "Active Users", icon: Users },
  { key: "transactionsToday", label: "Transactions Today", icon: Activity },
];

export function SuperAdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => (await apiClient.get<{ data: PlatformDashboard }>("/admin/dashboard")).data.data,
  });

  return (
    <div>
      <PageHeader title="Platform Dashboard" subtitle={`Cross-dealer overview for the ${PRODUCT_NAME} SaaS platform.`} hideBack />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {CARDS.map(({ key, label, icon: Icon, format }) => (
          <Card key={key}>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-6 w-20" />
                ) : (
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {format === "currency" ? formatCurrency(data?.[key] ?? 0) : formatNumber(data?.[key] ?? 0)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
