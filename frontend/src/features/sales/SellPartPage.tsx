import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ShoppingCart,
  Trash2,
  CheckCircle2,
  Printer,
  Download,
  Share2,
  Loader2,
  MapPin,
  ScanLine,
  User,
  Phone,
  Building2,
  FileText,
  Mail,
  Plus,
  Minus,
  ClipboardList,
  PackageSearch,
  Info,
} from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import type { InventoryRow, PagedResult, Invoice, CustomerInput, LocationRef, PartUnit } from "@/types";
import { PART_CATEGORY_LABELS, type PartCategoryCode } from "@/lib/partCategory";
import { PageHeader } from "@/components/ui/Feedback";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge, stockStatusTone } from "@/components/ui/Badge";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { Dialog } from "@/components/ui/Dialog";
import { PortalDropdown } from "@/components/ui/PortalDropdown";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/AuthContext";
import { formatCurrency, cn } from "@/lib/utils";
import { buildInvoicePdfFile, savePdfToDevice, shareFile, type HandoffResult } from "@/lib/invoicePdf";
import { normalizeQuantityForUnit, unitAllowsDecimalQuantity } from "@/lib/quantity";
import { scanBarcode } from "@/lib/barcodeScanner";

interface CartLine {
  key: string;
  // Unchecked via the row's checkbox — kept in the cart (so typed data
  // isn't lost) but left out of totals, validation and the sale itself.
  // Lets a dealer pause a part without deleting the row.
  included: boolean;
  inventoryId: string | null;
  partNo: string;
  description: string;
  category: string;
  store: LocationRef | null;
  bin: LocationRef | null;
  rack: LocationRef | null;
  availableQty: number;
  taxPercent: number;
  // MRP, Discount % and Selling Price are all directly editable and kept
  // in sync — whichever of the three was just touched recomputes the
  // other two via priceFromDiscount/discountFromPrice below. Quantity
  // starts blank rather than defaulting to 1 — the dealer must explicitly
  // type it, and a blank value blocks Confirm Sale (see cartHasIssue).
  mrp: number | "";
  discountPercent: number | "";
  sellingPrice: number | "";
  quantity: number | "";
  unit: PartUnit;
}

type Step = "cart" | "success";

const emptyCustomer: CustomerInput = { name: "", mobile: "", address: "", pincode: "", state: "", city: "", gstin: "", email: "" };

/** Passed via navigate(..., { state }) from a cancelled invoice's "New Sale for Customer" — prefills the customer and starts the cart from its items (quantity left blank, same as any other part match) so the dealer can add, remove or change anything before confirming a genuinely new sale. */
interface SellPartPrefillState {
  customer?: CustomerInput;
  inventoryIds?: string[];
}

function newRowKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `row-${Date.now()}-${Math.random()}`;
}

function blankLine(): CartLine {
  return {
    key: newRowKey(),
    included: true,
    inventoryId: null,
    partNo: "",
    description: "",
    category: "",
    store: null,
    bin: null,
    rack: null,
    availableQty: 0,
    taxPercent: 0,
    mrp: "",
    discountPercent: "",
    sellingPrice: "",
    quantity: "",
    unit: "NOS",
  };
}

/** Same comparison the backend uses (sales.service.ts normalizeState) — kept in sync so the totals shown here match what actually gets saved. */
function isIntraState(dealerState: string | null | undefined, customerState: string | undefined): boolean {
  const a = (dealerState ?? "").trim().toLowerCase();
  const b = (customerState ?? "").trim().toLowerCase();
  return !!a && !!b && a === b;
}

function priceFromDiscount(mrp: number, discountPercent: number): number {
  return Math.round(mrp * (1 - discountPercent / 100) * 100) / 100;
}

/** Negative when the selling price is above MRP — treated as a markup, not clamped away, since the dealer may deliberately price above MRP. */
function discountFromPrice(mrp: number, sellingPrice: number): number {
  if (!(mrp > 0)) return 0;
  return Math.round(((mrp - sellingPrice) / mrp) * 10000) / 100;
}

/** Splits a tax-inclusive amount into its pre-tax (taxable) value and tax — mirrors backend/src/utils/pricing.ts exactly. */
function splitTaxInclusiveAmount(amount: number, taxPercent: number): { taxableValue: number; taxAmount: number } {
  const taxableValue = Math.round((amount / (1 + taxPercent / 100)) * 100) / 100;
  const taxAmount = Math.round((amount - taxableValue) * 100) / 100;
  return { taxableValue, taxAmount };
}

function computeTotals(cart: CartLine[]) {
  let subtotal = 0;
  let tax = 0;
  let discount = 0;
  for (const line of cart) {
    if (!line.included) continue;
    const qty = line.quantity === "" ? 0 : line.quantity;
    const price = line.sellingPrice === "" ? 0 : line.sellingPrice;
    const mrp = line.mrp === "" ? 0 : line.mrp;
    // sellingPrice is tax-inclusive (it defaults to the part's MRP, which
    // always includes tax) — it's what the customer actually pays, so the
    // line amount charged stays price × qty. Items/Tax below are extracted
    // from within that fixed amount rather than adding tax on top of it,
    // which would silently charge tax twice.
    const lineCharged = Math.round(price * qty * 100) / 100;
    const { taxableValue, taxAmount } = splitTaxInclusiveAmount(lineCharged, line.taxPercent);
    subtotal += taxableValue;
    tax += taxAmount;
    discount += Math.max(0, (mrp - price) * qty);
  }
  subtotal = Math.round(subtotal * 100) / 100;
  tax = Math.round(tax * 100) / 100;
  discount = Math.round(discount * 100) / 100;
  const grandTotal = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal, tax, discount, grandTotal };
}

function SectionHeader({ step, title, subtitle, actions }: { step: number; title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{step}</div>
        <div>
          <p className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</p>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

/**
 * Shared logic behind one Select Parts row — inline part search (typing or
 * the magnifying-glass icon opens a results dropdown) plus Store/Bin/Rack
 * switching once a part is matched. Location switching re-fetches every
 * inventory row sharing this exact partNo (Store/Bin/Rack are location
 * data, not part data — MRP/tax/description never change when switching
 * location, so those fields are left untouched) and lets the three selects
 * cascade down to a single concrete inventory row.
 */
function useCartRow(line: CartLine, onUpdate: (patch: Partial<CartLine>) => void, otherInventoryIds: Set<string>) {
  const [query, setQuery] = useState(line.partNo);
  const [open, setOpen] = useState(false);
  const { push } = useToast();

  const { data: results } = useQuery({
    queryKey: ["inventory-search-row", query],
    // Not gated on a non-empty query — desktop's "Browse stock" button (and
    // just focusing the search field) opens the dropdown with an empty
    // query, which the backend treats as "no filter" and returns the first
    // page of all in-stock parts rather than nothing.
    queryFn: async () => (await apiClient.get<{ data: PagedResult<InventoryRow> }>("/inventory", { params: { search: query, pageSize: 8 } })).data.data,
    enabled: open,
  });

  const { data: locationRows } = useQuery({
    queryKey: ["inventory-locations", line.partNo],
    queryFn: async () =>
      (await apiClient.get<{ data: PagedResult<InventoryRow> }>("/inventory", { params: { search: line.partNo, pageSize: 50 } })).data.data.items.filter(
        (r) => r.partNo === line.partNo
      ),
    enabled: !!line.inventoryId,
  });

  function applyMatch(row: InventoryRow, resetPricing: boolean) {
    if (row.id !== line.inventoryId && otherInventoryIds.has(row.id)) {
      push({ tone: "error", title: "Already in cart", description: `${row.partNo} at this location is already on another row.` });
      return;
    }
    const mrp = Number(row.mrp);
    onUpdate({
      inventoryId: row.id,
      partNo: row.partNo,
      description: row.description,
      category: row.category,
      store: row.store,
      bin: row.bin,
      rack: row.rack,
      availableQty: row.availableQty,
      taxPercent: Number(row.taxPercent),
      unit: row.unit ?? "NOS",
      ...(resetPricing ? { mrp, discountPercent: "" as const, sellingPrice: mrp, quantity: "" as const } : {}),
    });
    setQuery(row.partNo);
    setOpen(false);
  }

  const stores = useMemo(() => {
    const map = new Map<string, LocationRef>();
    for (const r of locationRows ?? []) map.set(r.store.id, r.store);
    return [...map.values()];
  }, [locationRows]);

  const binsForStore = useMemo(() => {
    if (!line.store) return [];
    const map = new Map<string, LocationRef>();
    for (const r of locationRows ?? []) if (r.store.id === line.store!.id) map.set(r.bin.id, r.bin);
    return [...map.values()];
  }, [locationRows, line.store]);

  const racksForStoreBin = useMemo(() => {
    if (!line.store || !line.bin) return [];
    const map = new Map<string, LocationRef>();
    for (const r of locationRows ?? []) if (r.store.id === line.store!.id && r.bin.id === line.bin!.id) map.set(r.rack.id, r.rack);
    return [...map.values()];
  }, [locationRows, line.store, line.bin]);

  function selectStore(storeId: string) {
    const matches = (locationRows ?? []).filter((r) => r.store.id === storeId);
    if (matches.length === 1) applyMatch(matches[0], false);
    else if (matches.length > 1) onUpdate({ store: matches[0].store, bin: null, rack: null, inventoryId: null, availableQty: 0 });
  }
  function selectBin(binId: string) {
    const matches = (locationRows ?? []).filter((r) => r.store!.id === line.store!.id && r.bin.id === binId);
    if (matches.length === 1) applyMatch(matches[0], false);
    else if (matches.length > 1) onUpdate({ bin: matches[0].bin, rack: null, inventoryId: null, availableQty: 0 });
  }
  function selectRack(rackId: string) {
    const match = (locationRows ?? []).find((r) => r.store!.id === line.store!.id && r.bin!.id === line.bin!.id && r.rack.id === rackId);
    if (match) applyMatch(match, false);
  }

  return { query, setQuery, open, setOpen, results, applyMatch, stores, binsForStore, racksForStoreBin, selectStore, selectBin, selectRack };
}

/**
 * Renders the part-search results via a portal to document.body, positioned
 * with `position: fixed` from the anchor's live bounding rect. The Select
 * Parts card (like every Card) sets `overflow-hidden` on its root — an
 * absolutely-positioned dropdown nested inside it gets silently clipped
 * invisible even though the search data loaded fine, which is exactly what
 * made typing in a row look like "nothing happens". Fixed positioning via a
 * portal escapes that ancestor clipping entirely.
 */
function PartSearchDropdown({
  anchorRef,
  open,
  onClose,
  results,
  onSelect,
}: {
  anchorRef: RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  results: InventoryRow[] | undefined;
  onSelect: (row: InventoryRow) => void;
}) {
  return (
    <PortalDropdown anchorRef={anchorRef} open={open} onClose={onClose}>
      {results?.length ? (
        results.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r)}
            disabled={r.availableQty <= 0}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-navy-800"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800 dark:text-slate-200" title={`${r.partNo} — ${r.description}`}>
                {r.partNo} — {r.description}
              </p>
              <p
                className="truncate text-xs text-slate-500 dark:text-slate-400"
                title={`${r.store.name ?? r.store.code} / ${r.bin.code} / ${r.rack.code}`}
              >
                {r.store.name ?? r.store.code} / {r.bin.code} / {r.rack.code}
              </p>
            </div>
            <Badge tone={stockStatusTone(r.status)} className="ml-2 shrink-0">
              {r.availableQty}
            </Badge>
          </button>
        ))
      ) : (
        <p className="px-3 py-3 text-sm text-slate-400 dark:text-slate-500">No matching stock found.</p>
      )}
    </PortalDropdown>
  );
}

/**
 * One dense table row per cart line, shown on desktop/web only (see
 * CartRowMobile for the separate mobile card design). Store/Bin/Rack
 * aren't shown here: the search-result picker already commits to a
 * specific store/bin/rack when a part is matched (see
 * useCartRow.applyMatch) — there's nothing left to choose afterward.
 * The leading checkbox toggles CartLine.included: unchecked keeps the row
 * (and whatever the dealer already typed into it) but drops it from
 * totals, validation and the sale itself — a way to pause a part without
 * losing or deleting it.
 */
function CartRowDesktop({
  line,
  showRemove,
  otherInventoryIds,
  onUpdate,
  onRemove,
}: {
  line: CartLine;
  showRemove: boolean;
  otherInventoryIds: Set<string>;
  onUpdate: (patch: Partial<CartLine>) => void;
  onRemove: () => void;
}) {
  const row = useCartRow(line, onUpdate, otherInventoryIds);
  const anchorRef = useRef<HTMLDivElement>(null);
  const qtyMissing = line.quantity === "";
  const priceMissing = line.sellingPrice === "";
  const overStock = !qtyMissing && Number(line.quantity) > line.availableQty;
  const mrpNum = line.mrp === "" ? 0 : line.mrp;
  const priceNum = line.sellingPrice === "" ? 0 : line.sellingPrice;
  // Read directly off mrp - sellingPrice (both stored exactly, to the
  // paisa) — not derived back from the separately-rounded discountPercent,
  // which round-trips a small drift into the displayed amount (typing 6.68
  // would redisplay as 6.6 even though sellingPrice was correct).
  const discountAmount = line.mrp !== "" && line.sellingPrice !== "" ? Math.round((mrpNum - priceNum) * 100) / 100 : "";
  const categoryCode = line.category as PartCategoryCode;

  function stepQuantity(direction: 1 | -1) {
    const step = unitAllowsDecimalQuantity(line.unit) ? 0.001 : 1;
    const current = line.quantity === "" ? 0 : line.quantity;
    const next = Math.max(step, Math.round((current + direction * step) * 1000) / 1000);
    onUpdate({ quantity: next });
  }

  return (
    <tr className={cn(!line.included && "opacity-50")}>
      <td className="px-2.5 py-2 align-top">
        <input
          type="checkbox"
          checked={line.included}
          onChange={(e) => onUpdate({ included: e.target.checked })}
          className="mt-1.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-navy-600"
          aria-label={line.included ? "Exclude this part from the sale" : "Include this part in the sale"}
        />
      </td>
      <td className="min-w-[11rem] px-2.5 py-2 align-top">
        <div ref={anchorRef} className="relative">
          <Input
            className="h-9 pr-8"
            placeholder="Part No. / Description"
            value={row.query}
            onChange={(e) => {
              row.setQuery(e.target.value);
              row.setOpen(true);
              onUpdate({ partNo: e.target.value });
            }}
            onFocus={() => row.setOpen(true)}
          />
          <button
            type="button"
            onClick={() => row.setOpen((v) => !v)}
            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-navy-800"
            aria-label="Browse stock"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        </div>
        <PartSearchDropdown
          anchorRef={anchorRef}
          open={row.open}
          onClose={() => row.setOpen(false)}
          results={row.results?.items}
          onSelect={(r) => row.applyMatch(r, true)}
        />
      </td>
      <td className="max-w-[9rem] px-2.5 py-2 align-top">
        <p className={cn("truncate text-sm", line.description ? "text-slate-700 dark:text-slate-300" : "text-slate-300 dark:text-slate-600")} title={line.description || undefined}>
          {line.description || "—"}
        </p>
      </td>
      <td className="max-w-[8rem] px-2.5 py-2 align-top">
        <p className="truncate text-sm text-slate-700 dark:text-slate-300">{line.category ? PART_CATEGORY_LABELS[categoryCode] ?? line.category : "—"}</p>
      </td>
      <td className="px-2.5 py-2 text-right align-top">
        <span className={cn("text-sm font-semibold", line.inventoryId ? "text-brand-600 dark:text-brand-400" : "text-slate-300 dark:text-slate-600")}>
          {line.inventoryId ? line.availableQty : "—"}
        </span>
      </td>
      <td className="px-2.5 py-2 align-top">
        <div className={cn("flex h-9 w-[5.5rem] items-center overflow-hidden rounded-lg border", overStock ? "border-red-400 dark:border-red-500/60" : "border-slate-300 dark:border-navy-600")}>
          <button type="button" onClick={() => stepQuantity(-1)} className="flex h-full w-6 shrink-0 items-center justify-center text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-navy-800">
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="number"
            inputMode={unitAllowsDecimalQuantity(line.unit) ? "decimal" : "numeric"}
            step={unitAllowsDecimalQuantity(line.unit) ? 0.001 : 1}
            min={unitAllowsDecimalQuantity(line.unit) ? 0.001 : 1}
            value={line.quantity}
            onChange={(e) => onUpdate({ quantity: e.target.value === "" ? "" : Number(e.target.value) })}
            className="h-full w-full min-w-0 border-0 text-center text-sm text-slate-900 focus:outline-none focus:ring-0 dark:text-slate-100"
          />
          <button type="button" onClick={() => stepQuantity(1)} className="flex h-full w-6 shrink-0 items-center justify-center text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-navy-800">
            <Plus className="h-3 w-3" />
          </button>
        </div>
        {qtyMissing ? (
          <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">Required</p>
        ) : (
          overStock && <p className="mt-1 text-[11px] font-medium text-red-600 dark:text-red-400">Max {line.availableQty}</p>
        )}
      </td>
      <td className="px-2.5 py-2 align-top">
        <Input
          className="h-9 w-24"
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          placeholder="Auto"
          value={line.mrp}
          onChange={(e) => {
            const mrp = e.target.value === "" ? "" : Number(e.target.value);
            if (mrp === "") return onUpdate({ mrp: "" });
            const discount = line.discountPercent === "" ? 0 : line.discountPercent;
            onUpdate({ mrp, sellingPrice: priceFromDiscount(mrp, discount) });
          }}
        />
      </td>
      <td className="px-2.5 py-2 align-top">
        <Input
          className={cn("h-9 w-28", priceMissing && "border-red-400 dark:border-red-500/60")}
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          placeholder="0.00"
          value={line.sellingPrice}
          onChange={(e) => {
            const sellingPrice = e.target.value === "" ? "" : Number(e.target.value);
            if (sellingPrice === "") return onUpdate({ sellingPrice: "" });
            const mrp = line.mrp === "" ? 0 : line.mrp;
            onUpdate({ sellingPrice, discountPercent: discountFromPrice(mrp, sellingPrice) });
          }}
        />
        {priceMissing && <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">Required</p>}
      </td>
      <td className="px-2.5 py-2 align-top">
        <Input
          className="h-9 w-24"
          type="number"
          inputMode="decimal"
          step={0.01}
          placeholder="0.00"
          value={discountAmount}
          onChange={(e) => {
            const amount = e.target.value === "" ? "" : Number(e.target.value);
            if (amount === "") return onUpdate({ discountPercent: "", sellingPrice: mrpNum });
            onUpdate({ discountPercent: discountFromPrice(mrpNum, mrpNum - amount), sellingPrice: Math.round((mrpNum - amount) * 100) / 100 });
          }}
        />
      </td>
      <td className="px-2.5 py-2 align-top">
        {showRemove && (
          <button onClick={onRemove} className="rounded-md p-1.5 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

function CartRowMobile({
  line,
  showRemove,
  otherInventoryIds,
  onUpdate,
  onRemove,
}: {
  line: CartLine;
  showRemove: boolean;
  otherInventoryIds: Set<string>;
  onUpdate: (patch: Partial<CartLine>) => void;
  onRemove: () => void;
}) {
  const row = useCartRow(line, onUpdate, otherInventoryIds);
  const anchorRef = useRef<HTMLDivElement>(null);
  const qtyMissing = line.quantity === "";
  const priceMissing = line.sellingPrice === "";
  const priceNegative = !priceMissing && Number(line.sellingPrice) < 0;
  const overStock = !qtyMissing && Number(line.quantity) > line.availableQty;
  const qtyNum = line.quantity === "" ? 0 : line.quantity;
  const priceNum = line.sellingPrice === "" ? 0 : line.sellingPrice;
  const mrpNum = line.mrp === "" ? 0 : line.mrp;
  const lineGrandTotal = Math.round(priceNum * qtyNum * 100) / 100;
  const { taxableValue: lineSubtotal, taxAmount: lineTax } = splitTaxInclusiveAmount(lineGrandTotal, line.taxPercent);
  const discountPerUnit = line.mrp !== "" && line.sellingPrice !== "" ? Math.max(0, Math.round((mrpNum - priceNum) * 100) / 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-navy-700 dark:bg-navy-900">
      {showRemove && (
        <button onClick={onRemove} className="absolute right-2.5 top-2.5 z-10 rounded-md p-1.5 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      <div className="p-3">
        <div ref={anchorRef} className="flex gap-2 pr-8">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              className="pl-9"
              placeholder="Search part no. or name"
              value={row.query}
              onChange={(e) => {
                row.setQuery(e.target.value);
                row.setOpen(true);
                onUpdate({ partNo: e.target.value });
              }}
              onFocus={() => row.setOpen(true)}
            />
          </div>
          <button
            type="button"
            onClick={() => row.setOpen((v) => !v)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400"
            aria-label="Browse stock"
          >
            <PackageSearch className="h-4 w-4" />
          </button>
        </div>
        <PartSearchDropdown anchorRef={anchorRef} open={row.open} onClose={() => row.setOpen(false)} results={row.results?.items} onSelect={(r) => row.applyMatch(r, true)} />

        {line.inventoryId ? (
          <div className="mt-2.5 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={line.description}>
                {line.description}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={line.partNo}>
                {line.partNo}
              </p>
              <CategoryBadge category={line.category} className="mt-1" />
            </div>
          </div>
        ) : (
          <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-400 dark:border-navy-700 dark:text-slate-500">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Pick a part to see description, category &amp; stock
          </div>
        )}

        <div className="mt-2.5 grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Quantity *</Label>
            <Input
              className={overStock ? "border-red-400 dark:border-red-500/60" : ""}
              type="number"
              inputMode={unitAllowsDecimalQuantity(line.unit) ? "decimal" : "numeric"}
              step={unitAllowsDecimalQuantity(line.unit) ? 0.001 : 1}
              min={unitAllowsDecimalQuantity(line.unit) ? 0.001 : 1}
              placeholder="0"
              value={line.quantity}
              onChange={(e) => onUpdate({ quantity: e.target.value === "" ? "" : Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs">Selling price *</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500">₹</span>
              <Input
                className={cn("pl-7", (priceMissing || priceNegative) && "border-red-400 dark:border-red-500/60")}
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={line.sellingPrice}
                onChange={(e) => {
                  const sellingPrice = e.target.value === "" ? "" : Number(e.target.value);
                  if (sellingPrice === "") return onUpdate({ sellingPrice: "" });
                  const mrp = line.mrp === "" ? 0 : line.mrp;
                  onUpdate({ sellingPrice, discountPercent: discountFromPrice(mrp, sellingPrice) });
                }}
              />
            </div>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">MRP</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500">₹</span>
              <Input
                className="pl-7"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                placeholder="Auto"
                value={line.mrp}
                onChange={(e) => {
                  const mrp = e.target.value === "" ? "" : Number(e.target.value);
                  if (mrp === "") return onUpdate({ mrp: "" });
                  const discount = line.discountPercent === "" ? 0 : line.discountPercent;
                  onUpdate({ mrp, sellingPrice: priceFromDiscount(mrp, discount) });
                }}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Discount (opt.)</Label>
            <div className="relative">
              <Input
                className="pr-7"
                type="number"
                inputMode="decimal"
                step={0.01}
                placeholder="0"
                value={line.discountPercent}
                onChange={(e) => {
                  const mrp = line.mrp === "" ? 0 : line.mrp;
                  const discountPercent = e.target.value === "" ? "" : Number(e.target.value);
                  if (discountPercent === "") return onUpdate({ discountPercent: "", sellingPrice: mrp });
                  onUpdate({ discountPercent, sellingPrice: priceFromDiscount(mrp, discountPercent) });
                }}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500">%</span>
            </div>
          </div>
        </div>
        {qtyMissing && <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">Quantity is required.</p>}
        {priceMissing && <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">Selling price is required.</p>}
        {priceNegative && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">Selling price can't be negative — lower the discount %.</p>}
        {overStock && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">Only {line.availableQty} {line.unit} available.</p>}
      </div>

      {line.inventoryId && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-navy-800 dark:bg-navy-800/40">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Subtotal {formatCurrency(lineSubtotal)}</span>
            <span>Disc − {formatCurrency(discountPerUnit * qtyNum)}</span>
            <span>Tax {line.taxPercent}% {formatCurrency(lineTax)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Line Total</span>
            <span className="text-base font-bold text-brand-600 dark:text-brand-400">{formatCurrency(lineGrandTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function SellPartPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const prefill = location.state as SellPartPrefillState | null;
  const [step, setStep] = useState<Step>("cart");
  const [cart, setCart] = useState<CartLine[]>(() => [blankLine()]);
  const [customer, setCustomer] = useState<CustomerInput>(prefill?.customer ?? emptyCustomer);
  const [customerErrors, setCustomerErrors] = useState<Record<string, string>>({});
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [busy, setBusy] = useState<"save" | "share" | null>(null);
  const [pincodeLookup, setPincodeLookup] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const { push } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useAuth();

  async function lookupPincode(pincode: string) {
    if (!/^\d{6}$/.test(pincode)) return;
    setPincodeLookup("loading");
    try {
      const res = await apiClient.get<{ data: { found: boolean; state?: string; city?: string } }>(`/public/pincode/${pincode}`);
      if (res.data.data.found) {
        setCustomer((c) => ({ ...c, state: res.data.data.state ?? c.state, city: res.data.data.city ?? c.city }));
        setPincodeLookup("found");
      } else {
        setPincodeLookup("not-found");
      }
    } catch {
      setPincodeLookup("not-found");
    }
  }

  function reportOutcome(result: HandoffResult) {
    if (result === "shared") {
      push({ tone: "success", title: "Choose where to save", description: 'Pick "Save to Files", "Drive", or a Print service from the menu that opened.' });
    } else if (result === "downloaded") {
      push({ tone: "success", title: "Invoice PDF downloaded" });
    } else if (result === "unsupported") {
      push({
        tone: "info",
        title: "Not supported in this app",
        description: 'This action isn\'t available here. Please open the invoice in a phone browser instead of the app, or try "Share".',
      });
    }
    // "cancelled" (user backed out of the share sheet) — no toast needed.
  }

  async function savePdf() {
    if (!createdInvoice) return;
    setBusy("save");
    try {
      const file = await buildInvoicePdfFile(createdInvoice, createdInvoice.tenant?.name ?? "AMAN ENTERPRISES", createdInvoice.tenant?.address);
      reportOutcome(await savePdfToDevice(file));
    } catch {
      push({ tone: "error", title: "Unable to generate PDF", description: "Try again, or use Share instead." });
    } finally {
      setBusy(null);
    }
  }

  async function shareInvoice() {
    if (!createdInvoice) return;
    setBusy("share");
    try {
      const file = await buildInvoicePdfFile(createdInvoice, createdInvoice.tenant?.name ?? "AMAN ENTERPRISES", createdInvoice.tenant?.address);
      reportOutcome(await shareFile(file, `Invoice ${createdInvoice.invoiceNumber}`));
    } catch {
      push({ tone: "error", title: "Unable to share", description: "Try Save PDF instead." });
    } finally {
      setBusy(null);
    }
  }

  const isDirty = step !== "success" && (cart.some((l) => l.inventoryId) || Object.values(customer).some((v) => v !== ""));

  function handleBack() {
    if (isDirty) {
      setLeaveConfirmOpen(true);
    } else {
      navigate(-1);
    }
  }

  const preselectId = params.get("inventoryId");

  useEffect(() => {
    if (preselectId && !cart.some((l) => l.inventoryId)) {
      apiClient.get(`/inventory/${preselectId}`).then((res) => {
        const inv = res.data.data;
        const mrp = Number(inv.part.mrp);
        setCart((prev) => {
          const target = prev.find((l) => !l.inventoryId) ?? blankLine();
          const updated: CartLine = {
            ...target,
            inventoryId: inv.id,
            partNo: inv.part.partNo,
            description: inv.part.description,
            category: inv.part.category,
            store: inv.store,
            bin: inv.bin,
            rack: inv.rack,
            availableQty: inv.quantity,
            taxPercent: Number(inv.part.taxPercent),
            mrp,
            discountPercent: "",
            sellingPrice: mrp,
            quantity: "",
            unit: inv.part.unit ?? "NOS",
          };
          return prev.some((l) => l.key === target.key) ? prev.map((l) => (l.key === target.key ? updated : l)) : [updated, ...prev];
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectId]);

  useEffect(() => {
    const ids = prefill?.inventoryIds;
    if (!ids || ids.length === 0) return;
    Promise.all(
      ids.map((id) =>
        apiClient
          .get(`/inventory/${id}`)
          .then((res) => res.data.data)
          .catch(() => null)
      )
    ).then((rows) => {
      const lines: CartLine[] = rows
        .filter((inv): inv is NonNullable<typeof inv> => inv !== null)
        .map((inv) => {
          const mrp = Number(inv.part.mrp);
          return {
            ...blankLine(),
            inventoryId: inv.id,
            partNo: inv.part.partNo,
            description: inv.part.description,
            category: inv.part.category,
            store: inv.store,
            bin: inv.bin,
            rack: inv.rack,
            availableQty: inv.quantity,
            taxPercent: Number(inv.part.taxPercent),
            unit: inv.part.unit ?? "NOS",
            mrp,
            discountPercent: "" as const,
            sellingPrice: mrp,
            quantity: "" as const,
          };
        });
      if (lines.length > 0) setCart(lines);
    });
    // Runs once from the entry navigation's state — never re-fetches as the dealer edits the cart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleScan() {
    const result = await scanBarcode();
    if (result.status === "scanned") {
      const res = await apiClient.get<{ data: PagedResult<InventoryRow> }>("/inventory", { params: { search: result.value, pageSize: 8 } });
      const matches = res.data.data.items;
      if (matches.length === 1 && matches[0].availableQty > 0) {
        const r = matches[0];
        const mrp = Number(r.mrp);
        setCart((prev) => {
          const blank = prev.find((l) => !l.inventoryId);
          const newLine: CartLine = {
            key: blank?.key ?? newRowKey(),
            included: true,
            inventoryId: r.id,
            partNo: r.partNo,
            description: r.description,
            category: r.category,
            store: r.store,
            bin: r.bin,
            rack: r.rack,
            availableQty: r.availableQty,
            taxPercent: Number(r.taxPercent),
            mrp,
            discountPercent: "",
            sellingPrice: mrp,
            quantity: "",
            unit: r.unit ?? "NOS",
          };
          return blank ? prev.map((l) => (l.key === blank.key ? newLine : l)) : [...prev, newLine];
        });
        push({ tone: "success", title: "Added to cart", description: `${r.partNo} — ${r.description}` });
      } else if (matches.length === 0) {
        push({ tone: "error", title: "No match found", description: `Scanned "${result.value}" — no part with this barcode yet.` });
      } else {
        push({ tone: "info", title: "Multiple matches", description: "Search this code in a row to choose the location." });
      }
    } else if (result.status === "unsupported") {
      push({ tone: "info", title: "Not supported here", description: "Barcode scanning only works in the Android app." });
    } else if (result.status === "permission-denied") {
      push({ tone: "error", title: "Camera permission needed", description: "Allow camera access in the app settings to scan a barcode." });
    } else if (result.status === "error") {
      push({ tone: "error", title: "Unable to scan", description: result.message });
    }
    // "cancelled" (user backed out of the scanner) — no toast needed.
  }

  function addRow() {
    setCart((prev) => [...prev, blankLine()]);
  }

  function updateRow(key: string, patch: Partial<CartLine>) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (patch.quantity !== undefined && patch.quantity !== "" && Number.isFinite(patch.quantity)) {
          const normalized = normalizeQuantityForUnit(patch.quantity, next.unit);
          next.quantity = Math.max(unitAllowsDecimalQuantity(next.unit) ? 0.001 : 1, normalized);
        }
        return next;
      })
    );
  }

  function removeRow(key: string) {
    setCart((prev) => {
      const filtered = prev.filter((l) => l.key !== key);
      return filtered.length > 0 ? filtered : [blankLine()];
    });
  }

  function handleClear() {
    setCart([blankLine()]);
    setCustomer(emptyCustomer);
    setCustomerErrors({});
  }

  const { subtotal, tax, discount, grandTotal } = computeTotals(cart);
  const itemCount = cart.filter((l) => l.included && l.inventoryId).length;
  // Every included row must resolve to a real part/location with a valid
  // quantity and price before Confirm Sale unlocks — explicit checks
  // rather than relying on "" <= 0 coercion, since a future refactor could
  // easily change that comparison's behavior silently. An unchecked
  // ("paused") row is skipped entirely — it's excluded from the sale, so
  // whatever state it's in doesn't block submitting the rest.
  const cartHasIssue =
    itemCount === 0 ||
    cart.some(
      (l) =>
        l.included &&
        (!l.inventoryId ||
          l.quantity === "" ||
          Number(l.quantity) <= 0 ||
          Number(l.quantity) > l.availableQty ||
          l.mrp === "" ||
          Number(l.mrp) < 0 ||
          l.sellingPrice === "" ||
          Number(l.sellingPrice) < 0)
    );

  function validateCustomer(): boolean {
    const errors: Record<string, string> = {};
    if (!customer.name.trim()) errors.name = "Customer Name is required";
    if (!/^[6-9]\d{9}$/.test(customer.mobile.trim())) errors.mobile = "Enter a valid 10-digit Indian mobile number";
    setCustomerErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const createSale = useMutation({
    mutationFn: async () =>
      apiClient.post<{ data: Invoice }>("/sales", {
        customer,
        items: cart.filter((l) => l.included && l.inventoryId).map((l) => ({ inventoryId: l.inventoryId!, quantity: Number(l.quantity), sellingPrice: Number(l.sellingPrice) })),
      }),
    onSuccess: (res) => {
      setCreatedInvoice(res.data.data);
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock-count"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      push({ tone: "success", title: "Sale completed", description: `Invoice ${res.data.data.invoiceNumber} created.` });
    },
    onError: (err) => push({ tone: "error", title: "Unable to complete sale", description: getApiErrorMessage(err) }),
  });

  function handleConfirmSale() {
    if (cartHasIssue) return;
    if (!validateCustomer()) return;
    createSale.mutate();
  }

  function startNewSale() {
    setCart([blankLine()]);
    setCustomer(emptyCustomer);
    setCustomerErrors({});
    setCreatedInvoice(null);
    setStep("cart");
    navigate("/sell/new", { replace: true });
  }

  return (
    <div className="pb-28 sm:pb-0">
      <PageHeader
        title="Sell Part"
        subtitle="Search and select parts, add customer details and complete the sale."
        breadcrumbs={["Part Sell", "Sell Part"]}
        hideBack={step === "success"}
        onBack={handleBack}
      />

      {step === "cart" && (
        <>
          <div className="space-y-3">
            <Card>
              <CardContent className="p-4">
                <SectionHeader
                  step={1}
                  title="Part Details"
                  subtitle="Find a part, set quantity and price — totals update as you type."
                  actions={
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleScan}>
                        <ScanLine className="h-4 w-4" /> Scan
                      </Button>
                      <Button type="button" size="sm" onClick={addRow}>
                        <Plus className="h-4 w-4" /> Add
                      </Button>
                    </div>
                  }
                />

                {/* Desktop: one dense table, one row per part */}
                <div className="hidden overflow-x-auto thin-scroll lg:block">
                  <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left text-sm">
                    <thead className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      <tr>
                        <th className="px-2.5 py-2" />
                        <th className="px-2.5 py-2">Part No / Description</th>
                        <th className="px-2.5 py-2">Description</th>
                        <th className="px-2.5 py-2">Category</th>
                        <th className="px-2.5 py-2 text-right">Stock</th>
                        <th className="px-2.5 py-2">Quantity *</th>
                        <th className="px-2.5 py-2">MRP (₹)</th>
                        <th className="px-2.5 py-2">Selling Price (₹) *</th>
                        <th className="px-2.5 py-2">Discount (₹)</th>
                        <th className="px-2.5 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                      {cart.map((line) => (
                        <CartRowDesktop
                          key={line.key}
                          line={line}
                          showRemove={cart.length > 1}
                          otherInventoryIds={new Set(cart.filter((l) => l.key !== line.key && l.inventoryId).map((l) => l.inventoryId!))}
                          onUpdate={(patch) => updateRow(line.key, patch)}
                          onRemove={() => removeRow(line.key)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: stacked cards */}
                <div className="space-y-3 lg:hidden">
                  {cart.map((line) => (
                    <CartRowMobile
                      key={line.key}
                      line={line}
                      showRemove={cart.length > 1}
                      otherInventoryIds={new Set(cart.filter((l) => l.key !== line.key && l.inventoryId).map((l) => l.inventoryId!))}
                      onUpdate={(patch) => updateRow(line.key, patch)}
                      onRemove={() => removeRow(line.key)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    <ClipboardList className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-base font-bold text-slate-900 dark:text-slate-100">Order Summary</p>
                </div>
                <div className="flex flex-wrap items-stretch gap-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Subtotal (₹) {itemCount > 0 && <span className="text-slate-400 dark:text-slate-500">· {itemCount} item{itemCount === 1 ? "" : "s"}</span>}</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(subtotal)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Discount (₹)</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(discount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Tax (₹)</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(tax)}</p>
                  </div>
                  <div className="ml-auto flex items-center rounded-xl bg-brand-50 px-5 py-2.5 dark:bg-brand-500/10">
                    <div>
                      <p className="text-sm text-brand-600 dark:text-brand-400">Grand Total (₹)</p>
                      <p className="text-xl font-bold text-brand-700 dark:text-brand-400">{formatCurrency(grandTotal)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4">
                <SectionHeader step={2} title="Customer Details" />

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div>
                      <Label>Customer Name *</Label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <Input
                          className="pl-9"
                          placeholder="Enter customer name"
                          value={customer.name}
                          onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                        />
                      </div>
                      {customerErrors.name && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{customerErrors.name}</p>}
                    </div>
                    <div>
                      <Label>Mobile Number *</Label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <Input
                          className="pl-9"
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="9876543210"
                          value={customer.mobile}
                          onChange={(e) => setCustomer({ ...customer, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                        />
                      </div>
                      {customerErrors.mobile && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{customerErrors.mobile}</p>}
                    </div>
                    <div>
                      <Label>Email (Optional)</Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <Input
                          className="pl-9"
                          type="email"
                          placeholder="Enter email address"
                          value={customer.email}
                          onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                    <div>
                      <Label>Address (Optional)</Label>
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <Textarea
                          rows={1}
                          className="pl-9"
                          placeholder="Enter complete address"
                          value={customer.address}
                          onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Pincode</Label>
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <Input
                          className="pl-9"
                          type="tel"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="121002"
                          value={customer.pincode}
                          onChange={(e) => {
                            const pincode = e.target.value.replace(/\D/g, "").slice(0, 6);
                            setCustomer({ ...customer, pincode });
                            setPincodeLookup("idle");
                            if (pincode.length === 6) lookupPincode(pincode);
                          }}
                        />
                        {pincodeLookup === "loading" && (
                          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400 dark:text-slate-500" />
                        )}
                      </div>
                    </div>
                    <div>
                      <Label>State</Label>
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <Input className="pl-9" placeholder="State" value={customer.state} onChange={(e) => setCustomer({ ...customer, state: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>City</Label>
                      <div className="relative">
                        <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <Input className="pl-9" placeholder="City" value={customer.city} onChange={(e) => setCustomer({ ...customer, city: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  {pincodeLookup === "found" && (
                    <p className="-mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">State and city auto-filled — you can edit them.</p>
                  )}
                  {pincodeLookup === "not-found" && (
                    <p className="-mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">Couldn't look up that pincode — enter state and city manually.</p>
                  )}

                  {customer.state && (
                    <div
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs font-medium",
                        isIntraState(tenant?.state, customer.state)
                          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400"
                          : "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-400"
                      )}
                    >
                      {isIntraState(tenant?.state, customer.state)
                        ? "Same state as dealer — CGST + SGST will apply."
                        : "Different state from dealer — IGST will apply."}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div>
                      <Label>Customer GSTIN (Optional)</Label>
                      <div className="relative">
                        <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <Input
                          className="pl-9"
                          placeholder="03ABCDE1234F1Z5"
                          value={customer.gstin}
                          onChange={(e) => setCustomer({ ...customer, gstin: e.target.value.toUpperCase() })}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

          {/* Desktop/tablet action bar — natural page flow beneath everything above */}
          <div className="hidden items-center justify-end gap-3 pt-4 sm:flex">
            <Button variant="outline" onClick={handleClear}>
              Clear
            </Button>
            <Button
              className="bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-700 hover:to-blue-700"
              size="lg"
              disabled={cartHasIssue}
              isLoading={createSale.isPending}
              onClick={handleConfirmSale}
            >
              <ShoppingCart className="h-4 w-4" /> Confirm Sale
            </Button>
          </div>
        </>
      )}

      {step === "success" && createdInvoice && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 dark:text-emerald-400" />
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sale Successful</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Invoice <span className="font-semibold text-slate-800 dark:text-slate-200">{createdInvoice.invoiceNumber}</span> for{" "}
                {formatCurrency(createdInvoice.grandTotal)}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => navigate(`/invoices/${createdInvoice.id}/print`)}>
                <Printer className="h-4 w-4" /> Print
              </Button>
              <Button variant="outline" disabled={busy !== null} onClick={savePdf}>
                {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Save PDF
              </Button>
              <Button variant="outline" disabled={busy !== null} onClick={shareInvoice}>
                {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share
              </Button>
              <Button onClick={startNewSale}>New Sale</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sticky mobile action bar — mirrors the desktop bar above so the
          primary actions are always one thumb-reach away. */}
      {step === "cart" && (
        <div className="fixed inset-x-0 bottom-16 z-20 flex gap-2 border-t border-slate-200 bg-white p-3 sm:hidden dark:border-navy-700 dark:bg-navy-900">
          <Button variant="outline" className="flex-1" onClick={handleClear}>
            Clear
          </Button>
          <Button
            className="flex-[2] bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-700 hover:to-blue-700"
            disabled={cartHasIssue}
            isLoading={createSale.isPending}
            onClick={handleConfirmSale}
          >
            <ShoppingCart className="h-4 w-4" /> Confirm Sale
          </Button>
        </div>
      )}

      <Dialog
        open={leaveConfirmOpen}
        onOpenChange={setLeaveConfirmOpen}
        title="Discard unsaved changes?"
        description="Are you sure you want to leave? Unsaved changes will be lost."
        footer={
          <>
            <Button variant="outline" onClick={() => setLeaveConfirmOpen(false)}>
              Stay
            </Button>
            <Button variant="danger" onClick={() => navigate(-1)}>
              Leave
            </Button>
          </>
        }
      >
        <div />
      </Dialog>
    </div>
  );
}
