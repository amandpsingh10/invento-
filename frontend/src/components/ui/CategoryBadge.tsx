import { Badge } from "@/components/ui/Badge";
import { PART_CATEGORY_LABELS, type PartCategoryCode } from "@/lib/partCategory";

/** One consistent rendering of a Part's category everywhere it's shown, so the O/C/A/P code always carries its label alongside it. */
export function CategoryBadge({ category, className }: { category: string; className?: string }) {
  const code = category as PartCategoryCode;
  const label = PART_CATEGORY_LABELS[code];
  return (
    <Badge tone="neutral" className={className}>
      {label ? `${code} — ${label}` : category}
    </Badge>
  );
}
