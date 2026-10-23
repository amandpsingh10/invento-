import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, User, Boxes, ArrowRight, Sun, Moon } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useTheme } from "@/features/theme/ThemeContext";
import { formatDateTime, cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/branding";
import { Badge } from "@/components/ui/Badge";
import { notificationVisual } from "@/lib/notificationDisplay";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/features/notifications/notificationQueries";

function BellWithBadge({ count }: { count: number }) {
  return (
    <span className="relative inline-flex">
      <Bell className="h-5 w-5" />
      {!!count && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      )}
    </span>
  );
}

/**
 * Carries the brand (mobile only — desktop shows it in the Sidebar
 * instead), notifications, and the profile menu (My Profile / Logout).
 * Visible at every screen size, on both mobile and desktop.
 *
 * The bell behaves differently by width rather than by platform (native
 * app vs. browser share the same responsive layout, so there's no other
 * signal to key off): on a phone-width screen it's a plain link straight
 * to the full /notifications page, since a Radix dropdown panel doesn't
 * have room to breathe there; on a wider screen it opens an inline
 * preview dropdown, with a "View All Notifications" link down to the same
 * full page for the rest.
 */
export function Topbar() {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);

  // Drag-to-dismiss for the notification panel's handle: it's anchored
  // near the top of the screen, so — mirroring the bottom-anchored "More"
  // sheet's slide-down close — this one closes by sliding up. Dragging the
  // handle upward translates the panel with it in real time; releasing
  // past a threshold finishes the slide off-screen before actually
  // closing, so it reads as one continuous motion rather than a jump-cut.
  const [notifDragY, setNotifDragY] = useState(0);
  const [notifDragging, setNotifDragging] = useState(false);
  const notifDragStartRef = useRef(0);

  useEffect(() => {
    if (notifOpen) setNotifDragY(0);
  }, [notifOpen]);

  function handleNotifHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    setNotifDragging(true);
    notifDragStartRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function handleNotifHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!notifDragging) return;
    const delta = e.clientY - notifDragStartRef.current;
    if (delta < 0) setNotifDragY(delta);
  }
  function handleNotifHandlePointerUp() {
    if (!notifDragging) return;
    setNotifDragging(false);
    if (notifDragY < -60) {
      setNotifDragY(-window.innerHeight);
      setTimeout(() => setNotifOpen(false), 200);
    } else {
      setNotifDragY(0);
    }
  }

  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-3 dark:border-navy-800 dark:bg-navy-900 print:hidden sm:px-6">
      <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5 lg:hidden">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600">
          <Boxes className="h-5 w-5 text-white" />
        </div>
        <span className="font-display truncate text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-base">{PRODUCT_NAME}</span>
      </Link>
      <span className="hidden lg:block" />

      <div className="flex items-center gap-1.5 sm:gap-3">
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800"
          title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle dark mode"
        >
          {resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <Link to="/notifications" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800 sm:hidden">
          <BellWithBadge count={data?.unreadCount ?? 0} />
        </Link>

        <DropdownMenu.Root open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenu.Trigger asChild>
            <button className="relative hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800 sm:block">
              <BellWithBadge count={data?.unreadCount ?? 0} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              collisionPadding={12}
              className="z-50 w-[calc(100vw-1.5rem)] max-w-96 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-navy-700 dark:bg-navy-900"
              style={{
                transform: notifDragY ? `translateY(${notifDragY}px)` : undefined,
                transition: notifDragging ? "none" : "transform 200ms ease-out",
              }}
            >
              <div
                className="flex touch-none justify-center pb-1 pt-2"
                onPointerDown={handleNotifHandlePointerDown}
                onPointerMove={handleNotifHandlePointerMove}
                onPointerUp={handleNotifHandlePointerUp}
                onPointerCancel={handleNotifHandlePointerUp}
              >
                <div className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-navy-600" />
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 dark:border-navy-800">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notifications</p>
                  {!!data?.unreadCount && <Badge tone="danger">{data.unreadCount}</Badge>}
                </div>
                {!!data?.unreadCount && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto thin-scroll">
                {data?.items.length ? (
                  data.items.map((n) => {
                    const { icon: Icon, iconTone } = notificationVisual(n.type);
                    return (
                      <button
                        key={n.id}
                        onClick={() => !n.isRead && markRead.mutate(n.id)}
                        className={cn(
                          "flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-navy-800",
                          !n.isRead && "bg-brand-50/40 dark:bg-brand-500/10"
                        )}
                      >
                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", iconTone)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{formatDateTime(n.createdAt)}</p>
                        </div>
                        {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500">You're all caught up.</p>
                )}
              </div>
              <Link
                to="/notifications"
                onClick={() => setNotifOpen(false)}
                className="flex items-center justify-center gap-1 border-t border-slate-100 px-3 py-2.5 text-xs font-semibold text-brand-600 hover:bg-slate-50 hover:text-brand-700 dark:border-navy-800 dark:text-brand-400 dark:hover:bg-navy-800"
              >
                View All Notifications <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-navy-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white dark:bg-navy-700">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium leading-tight text-slate-800 dark:text-slate-200">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[11px] leading-tight text-slate-400 dark:text-slate-500">{user?.roles?.[0]?.replace("_", " ")}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              collisionPadding={12}
              className="z-50 w-[calc(100vw-1.5rem)] max-w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-navy-700 dark:bg-navy-900"
            >
              <div className="px-2 py-2">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200" title={user?.email}>
                  {user?.email}
                </p>
              </div>
              <DropdownMenu.Item
                onClick={() => navigate("/settings")}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-600 outline-none hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-navy-800"
              >
                <User className="h-4 w-4" /> My Profile
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={handleLogout}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-600 outline-none hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" /> Logout
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
