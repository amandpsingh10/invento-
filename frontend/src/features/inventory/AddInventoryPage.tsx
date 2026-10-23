import { Link } from "react-router-dom";
import { FileSpreadsheet, PackagePlus, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";

function ChoiceCard({
  to,
  icon: Icon,
  iconTone,
  title,
  subtitle,
}: {
  to: string;
  icon: any;
  iconTone: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link to={to}>
      <Card className="transition-shadow hover:shadow-card-hover active:scale-[0.99]">
        <CardContent className="flex items-center gap-4 p-6">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${iconTone}`}>
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</p>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />
        </CardContent>
      </Card>
    </Link>
  );
}

export function AddInventoryPage() {
  return (
    <div>
      <PageHeader title="Add Inventory" subtitle="Choose how you'd like to add parts to inventory." />

      <div className="mx-auto max-w-xl space-y-3">
        <ChoiceCard
          to="/inventory/upload-purchase"
          icon={FileSpreadsheet}
          iconTone="bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
          title="Upload Excel"
          subtitle="Add multiple parts at once from a spreadsheet"
        />
        <ChoiceCard
          to="/inventory/add-part"
          icon={PackagePlus}
          iconTone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
          title="Manual Entry"
          subtitle="Add one part at a time"
        />
      </div>
    </div>
  );
}
