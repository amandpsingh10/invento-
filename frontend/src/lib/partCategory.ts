export const PART_CATEGORIES = ["O", "C", "A", "P"] as const;
export type PartCategoryCode = (typeof PART_CATEGORIES)[number];

export const PART_CATEGORY_LABELS: Record<PartCategoryCode, string> = {
  O: "Oil & Lubricants",
  C: "Consumables",
  A: "Accessories",
  P: "Parts",
};

/**
 * The dealer's own mapping of category → the store code that category is
 * usually stocked under (O/C → Store 01, A/P → Store 03). Purely an
 * informational hint shown next to the Category field — nothing enforces
 * it, since a Part's actual stock can live in any Store/Bin/Rack via its
 * Inventory rows, independent of this master-data grouping.
 */
export const PART_CATEGORY_STORE_HINT: Record<PartCategoryCode, string> = {
  O: "01",
  C: "01",
  A: "03",
  P: "03",
};
