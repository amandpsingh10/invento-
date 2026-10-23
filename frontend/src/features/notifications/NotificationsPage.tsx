import { useMemo, useState } from "react";
import { PageHeader, EmptyState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { notificationVisual, ALERT_NOTIFICATION_TYPES } from "@/lib/notificationDisplay";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "./notificationQueries";
import type { NotificationItem } from "@/types";

type Tab = "all" | "unread" | "alerts";

function formatGroupLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return formatDate(dateStr);
}

/** Buckets an already-newest-first list into consecutive same-day groups without re-sorting it. */
function groupByDate(items: NotificationItem[]) {
  const groups: { label: string; items: NotificationItem[] }[] = [];
  for (const item of items) {
    const label = formatGroupLabel(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

export function NotificationsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = useMemo(() => data?.items ?? [], [data]);
  const unreadCount = data?.unreadCount ?? 0;
  const alertsCount = items.filter((n) => ALERT_NOTIFICATION_TYPES.has(n.type)).length;

  const filtered = useMemo(() => {
    if (tab === "unread") return items.filter((n) => !n.isRead);
    if (tab === "alerts") return items.filter((n) => ALERT_NOTIFICATION_TYPES.has(n.type));
    return items;
  }, [items, tab]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: `All (${items.length})` },
    { key: "unread", label: `Unread (${unreadCount})` },
    { key: "alerts", label: `Alerts (${alertsCount})` },
  ];

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Everything happening across your inventory."
        breadcrumbs={["Notifications"]}
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-brand-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-300 dark:hover:bg-navy-800"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">Loading...</p>
      ) : groups.length === 0 ? (
        <EmptyState title="No notifications" description="You're all caught up." />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{group.label}</p>
              <div className="space-y-2">
                {group.items.map((n) => {
                  const { icon: Icon, iconTone } = notificationVisual(n.type);
                  return (
                    <button
                      key={n.id}
                      onClick={() => !n.isRead && markRead.mutate(n.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-card transition-shadow active:scale-[0.99] hover:shadow-card-hover dark:border-navy-700 dark:bg-navy-900",
                        !n.isRead && "bg-brand-50/30 dark:bg-brand-500/10"
                      )}
                    >
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", iconTone)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{n.title}</p>
                        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{n.message}</p>
                        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{formatDateTime(n.createdAt)}</p>
                      </div>
                      {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
