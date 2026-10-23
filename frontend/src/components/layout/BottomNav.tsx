import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu as MenuIcon, X, ChevronRight, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";
import { visibleMoreMenuGroups, visiblePrimaryTabs, MORE_MENU_COLOR_CLASSES, type MoreMenuItem } from "./moreMenuItems";

function MoreMenuCard({ item, onClick }: { item: MoreMenuItem; onClick: () => void }) {
  return (
    <NavLink to={item.to} onClick={onClick} className="flex flex-col gap-1.5 rounded-2xl border border-slate-200 p-3 text-left hover:bg-slate-50 dark:border-navy-700 dark:hover:bg-navy-800">
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", MORE_MENU_COLOR_CLASSES[item.color])}>
            <item.icon className="h-4 w-4" />
          </div>
          <p className="truncate whitespace-nowrap text-[13px] font-semibold text-slate-900 dark:text-slate-100" title={item.label}>
            {item.label}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
      </div>
      <p className="truncate whitespace-nowrap text-[11px] text-slate-400 dark:text-slate-500" title={item.description}>
        {item.description}
      </p>
    </NavLink>
  );
}

/**
 * Mobile-only tab bar (hidden from lg upward, where the desktop Sidebar
 * takes over). "More" opens a bottom sheet with every secondary
 * destination — the same grouped list the desktop Sidebar renders (see
 * moreMenuItems.ts), so nothing became unreachable without a permanent
 * sidebar on mobile. Logout lives in the Topbar's profile menu (visible at
 * every screen size) rather than duplicated here.
 */
export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { canAccessMenu } = useAuth();

  // Drag-to-dismiss for the handle at the top of the sheet: tracks how far
  // the pointer has moved down since pointerdown and translates the sheet
  // by that amount in real time. On release, past a threshold it finishes
  // sliding all the way off-screen before actually closing (so the close
  // reads as one continuous slide rather than a jump-cut); otherwise it
  // snaps back to resting position.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef(0);

  useEffect(() => {
    if (moreOpen) setDragY(0);
  }, [moreOpen]);

  function handleHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    setDragging(true);
    dragStartRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function handleHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const delta = e.clientY - dragStartRef.current;
    if (delta > 0) setDragY(delta);
  }
  function handleHandlePointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (dragY > 80) {
      setDragY(window.innerHeight);
      setTimeout(() => setMoreOpen(false), 200);
    } else {
      setDragY(0);
    }
  }

  const allGroups = visibleMoreMenuGroups(canAccessMenu);
  const tabs = visiblePrimaryTabs(canAccessMenu);
  // Settings renders as its own icon button next to the sheet's close
  // button (matching the reference) instead of taking a grid slot.
  const settingsItem = allGroups.find((g) => g.label === "Settings")?.items[0];
  const groups = allGroups.filter((g) => g.label !== "Settings");

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-navy-800 dark:bg-navy-900 print:hidden lg:hidden">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/dashboard"}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500",
                isActive && "text-brand-600 dark:text-brand-400"
              )
            }
          >
            <tab.icon className="h-5 w-5" />
            {tab.label}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500"
        >
          <MenuIcon className="h-5 w-5" />
          More
        </button>
      </nav>

      <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" />
          <Dialog.Content
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto thin-scroll rounded-t-2xl bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl dark:bg-navy-900 lg:hidden"
            style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragging ? "none" : "transform 200ms ease-out" }}
          >
            <div
              className="flex touch-none justify-center pb-2 pt-2.5"
              onPointerDown={handleHandlePointerDown}
              onPointerMove={handleHandlePointerMove}
              onPointerUp={handleHandlePointerUp}
              onPointerCancel={handleHandlePointerUp}
            >
              <div className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-navy-600" />
            </div>
            <div className="mb-4 flex items-start justify-between px-4">
              <div>
                <Dialog.Title className="text-2xl font-bold text-slate-900 dark:text-slate-100">More</Dialog.Title>
                <Dialog.Description className="text-sm text-slate-400 dark:text-slate-500">Quick access to all features</Dialog.Description>
              </div>
              <div className="flex items-center gap-2">
                {settingsItem && (
                  <NavLink
                    to={settingsItem.to}
                    onClick={() => setMoreOpen(false)}
                    className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 dark:bg-navy-800 dark:text-slate-400 dark:hover:bg-navy-700"
                    aria-label="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </NavLink>
                )}
                <Dialog.Close className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 dark:bg-navy-800 dark:text-slate-400 dark:hover:bg-navy-700">
                  <X className="h-4 w-4" />
                </Dialog.Close>
              </div>
            </div>
            <div className="space-y-5 px-4">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{group.label}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {group.items.map((item) => (
                      <MoreMenuCard key={item.to} item={item} onClick={() => setMoreOpen(false)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
