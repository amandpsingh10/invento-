import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-50 text-center dark:bg-navy-950">
      <p className="text-6xl font-bold text-slate-200 dark:text-slate-600">404</p>
      <p className="mt-2 text-lg font-semibold text-slate-700 dark:text-slate-300">Page not found</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/dashboard" className="mt-6">
        <Button>Back to Dashboard</Button>
      </Link>
    </div>
  );
}
