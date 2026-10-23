import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

/**
 * Navigation is: a collapsible icon Sidebar on desktop (lg and up), and
 * Home's four action cards + BottomNav's bottom tabs/"More" sheet on
 * mobile. Both read from the same moreMenuItems.ts groups so nothing is
 * reachable from one and not the other.
 */
export function DashboardLayout() {
  return (
    // print:h-auto/print:overflow-visible undo the fixed-height, scrolling
    // shell for print media — otherwise the browser only prints whatever
    // portion of <main>'s scroll area happens to be in view (often nothing
    // useful), which is what made "Print Invoice" / "Download PDF" look
    // broken. Topbar/BottomNav/Sidebar hide themselves via print:hidden.
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-navy-950 print:h-auto print:overflow-visible print:bg-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        {/* Bottom padding on mobile clears the fixed BottomNav (h-16) plus
            safe-area inset; lg and up have no bottom nav so it collapses. */}
        <main className="flex-1 overflow-y-auto px-4 py-6 pb-24 thin-scroll sm:px-6 lg:pb-6 print:overflow-visible print:p-0">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
