export const PART_CATEGORIES = ["O", "C", "A", "P"] as const;
export type PartCategory = (typeof PART_CATEGORIES)[number];

export const PART_CATEGORY_LABELS: Record<PartCategory, string> = {
  O: "Oil & Lubricants",
  C: "Consumables",
  A: "Accessories",
  P: "Parts",
};

export function isValidPartCategory(value: string): value is PartCategory {
  return (PART_CATEGORIES as readonly string[]).includes(value.toUpperCase());
}
