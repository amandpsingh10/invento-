import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

function newRowKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `row-${Date.now()}-${Math.random()}`;
}

function blankLine(): CartLine {
  return {
    key: newRowKey(),
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

function SectionHeader({ step, title, actions }: { step: number; title: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{step}</div>
        <p className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</p>
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
    queryFn: async () => (await apiClient.get<{ data: PagedResult<InventoryRow> }>("/inventory", { params: { search: query, pageSize: 8 } })).data.data,
    enabled: open && query.trim().length > 0,
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
 * Full-width "Part Details" card for one cart line, shown on desktop/web
 * only (see CartRowMobile for the app's own, unrelated card design — the
 * user asked for this reference to apply to the web view specifically).
 * Store/Bin/Rack aren't shown here: the reference has no location fields at
 * all, since the search-result picker already commits to a specific
 * store/bin/rack when a part is matched (see useCartRow.applyMatch) —
 * there's nothing left to choose afterward on this screen.
 */
function CartRowDesktop({
  line,
  index,
  showRemove,
  otherInventoryIds,
  onUpdate,
  onRemove,
}: {
  line: CartLine;
  index: number;
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
  const qtyNum = line.quantity === "" ? 0 : line.quantity;
  const priceNum = line.sellingPrice === "" ? 0 : line.sellingPrice;
  const mrpNum = line.mrp === "" ? 0 : line.mrp;
  // sellingPrice is tax-inclusive (defaults to the part's MRP) — Grand
  // Total is fixed at price × qty, and Subtotal/Tax are extracted from
  // within it rather than adding tax on top (see computeTotals above).
  const lineGrandTotal = Math.round(priceNum * qtyNum * 100) / 100;
  const { taxableValue: lineSubtotal, taxAmount: lineTax } = splitTaxInclusiveAmount(lineGrandTotal, line.taxPercent);
  // Discount is shown/edited in ₹ here (vs. Discount % on mobile) — both
  // read and write the same canonical discountPercent field on CartLine so
  // the two surfaces never drift out of sync with each other.
  const discountAmount = line.mrp !== "" && line.discountPercent !== "" ? Math.round(mrpNum * (line.discountPercent / 100) * 100) / 100 : "";
  const categoryCode = line.category as PartCategoryCode;

  function stepQuantity(direction: 1 | -1) {
    const step = unitAllowsDecimalQuantity(line.unit) ? 0.001 : 1;
    const current = line.quantity === "" ? 0 : line.quantity;
    const next = Math.max(step, Math.round((current + direction * step) * 1000) / 1000);
    onUpdate({ quantity: next });
  }

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-5 dark:border-navy-700 dark:bg-navy-900">
      {showRemove && (
        <button onClick={onRemove} className="absolute right-4 top-4 rounded-md p-1.5 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      {index > 0 && <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Part {index + 1}</p>}

      <div className="grid grid-cols-4 gap-4 pr-8">
        <div>
          <Label>Part No *</Label>
          <div ref={anchorRef} className="flex gap-1.5">
            <Input
              placeholder="Search part..."
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-400 hover:bg-slate-50 dark:border-navy-600 dark:text-slate-500 dark:hover:bg-navy-800"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
          <PartSearchDropdown
            anchorRef={anchorRef}
            open={row.open && row.query.trim().length > 0}
            onClose={() => row.setOpen(false)}
            results={row.results?.items}
            onSelect={(r) => row.applyMatch(r, true)}
          />
        </div>
        <div>
          <Label>Description</Label>
          <div className="flex h-9 items-center truncate rounded-lg bg-slate-50 px-3 text-sm text-slate-700 dark:bg-navy-800 dark:text-slate-300" title={line.description || undefined}>
            {line.description || "—"}
          </div>
        </div>
        <div>
          <Label>Category</Label>
          <Select disabled value={line.category}>
            <option value={line.category}>{line.category ? `${categoryCode} — ${PART_CATEGORY_LABELS[categoryCode] ?? line.category}` : "—"}</option>
          </Select>
        </div>
        <div>
          <Label>Available Qty</Label>
          <div className="flex h-9 items-center rounded-lg bg-slate-50 px-3 text-sm text-slate-700 dark:bg-navy-800 dark:text-slate-300">
            {line.inventoryId ? (
              <>
                {line.availableQty} <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">{line.unit}</span>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-4">
        <div>
          <Label>Quantity *</Label>
          <div className={cn("flex h-9 items-center overflow-hidden rounded-lg border", overStock ? "border-red-400 dark:border-red-500/60" : "border-slate-300 dark:border-navy-600")}>
            <button
              type="button"
              onClick={() => stepQuantity(-1)}
              className="flex h-full w-9 shrink-0 items-center justify-center text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-navy-800"
            >
              <Minus className="h-3.5 w-3.5" />
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
            <button
              type="button"
              onClick={() => stepQuantity(1)}
              className="flex h-full w-9 shrink-0 items-center justify-center text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-navy-800"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <span className="flex h-full shrink-0 items-center border-l border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-500 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-400">
              {line.unit}
            </span>
          </div>
          {qtyMissing && <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">Quantity is required.</p>}
          {overStock && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">Only {line.availableQty} available.</p>}
        </div>
        <div>
          <Label>MRP (₹)</Label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            value={line.mrp}
            onChange={(e) => {
              const mrp = e.target.value === "" ? "" : Number(e.target.value);
              if (mrp === "") return onUpdate({ mrp: "" });
              const discount = line.discountPercent === "" ? 0 : line.discountPercent;
              onUpdate({ mrp, sellingPrice: priceFromDiscount(mrp, discount) });
            }}
          />
        </div>
        <div>
          <Label>Selling Price (₹) *</Label>
          <Input
            className={priceMissing ? "border-red-400 dark:border-red-500/60" : ""}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            value={line.sellingPrice}
            onChange={(e) => {
              const sellingPrice = e.target.value === "" ? "" : Number(e.target.value);
              if (sellingPrice === "") return onUpdate({ sellingPrice: "" });
              const mrp = line.mrp === "" ? 0 : line.mrp;
              onUpdate({ sellingPrice, discountPercent: discountFromPrice(mrp, sellingPrice) });
            }}
          />
          {priceMissing && <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">Selling price is required.</p>}
        </div>
        <div>
          <Label>Discount (₹)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step={0.01}
            placeholder="0.00"
            value={discountAmount}
            onChange={(e) => {
              const amount = e.target.value === "" ? "" : Number(e.target.value);
              if (amount === "") return onUpdate({ discountPercent: "", sellingPrice: mrpNum });
              // Selling price comes directly from mrp - amount, not from
              // round-tripping through the rounded discountPercent below —
              // that round-trip previously reintroduced up to a paisa of
              // drift from what was actually typed. discountPercent is
              // still stored (rounded) purely so the mobile Discount %
              // field stays in sync; it never feeds back into this price.
              const discountPercent = mrpNum > 0 ? Math.round((amount / mrpNum) * 10000) / 100 : 0;
              onUpdate({ discountPercent, sellingPrice: Math.round((mrpNum - amount) * 100) / 100 });
            }}
          />
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm dark:bg-navy-800">
        <div className="flex justify-between text-slate-500 dark:text-slate-400">
          <span>Subtotal</span>
          <span>{formatCurrency(lineSubtotal)}</span>
        </div>
        <div className="flex justify-between text-slate-500 dark:text-slate-400">
          <span>Tax ({line.taxPercent}%)</span>
          <span>{formatCurrency(lineTax)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-navy-700 dark:text-slate-100">
          <span>Grand Total</span>
          <span className="text-brand-600 dark:text-brand-400">{formatCurrency(lineGrandTotal)}</span>
        </div>
      </div>
    </div>
  );
}

function CartRowMobile({ line, otherInventoryIds, onUpdate, onRemove }: { line: CartLine; otherInventoryIds: Set<string>; onUpdate: (patch: Partial<CartLine>) => void; onRemove: () => void }) {
  const row = useCartRow(line, onUpdate, otherInventoryIds);
  const anchorRef = useRef<HTMLDivElement>(null);
  const qtyMissing = line.quantity === "";
  const priceMissing = line.sellingPrice === "";
  const priceNegative = !priceMissing && Number(line.sellingPrice) < 0;
  const overStock = !qtyMissing && Number(line.quantity) > line.availableQty;
  const lineTotal = (line.sellingPrice === "" ? 0 : line.sellingPrice) * (line.quantity === "" ? 0 : line.quantity);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-navy-700 dark:bg-navy-900">
      <div className="p-3.5">
        <div ref={anchorRef} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              className="pl-9"
              placeholder="Search Part No / Description"
              value={row.query}
              onChange={(e) => {
                row.setQuery(e.target.value);
                row.setOpen(true);
                onUpdate({ partNo: e.target.value });
              }}
              onFocus={() => row.setOpen(true)}
            />
          </div>
          <button onClick={onRemove} className="shrink-0 rounded-lg border border-slate-200 p-2 text-red-500 hover:bg-red-50 dark:border-navy-700 dark:text-red-400 dark:hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <PartSearchDropdown
          anchorRef={anchorRef}
          open={row.open && row.query.trim().length > 0}
          onClose={() => row.setOpen(false)}
          results={row.results?.items}
          onSelect={(r) => row.applyMatch(r, true)}
        />

        {line.inventoryId && (
          <>
            <div className="mt-3 flex items-start justify-between gap-2">
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

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Store</Label>
                <Select className="h-9" value={line.store?.id ?? ""} disabled={row.stores.length === 0} onChange={(e) => row.selectStore(e.target.value)}>
                  {row.stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ?? s.code}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="text-xs">Bin</Label>
                <Select className="h-9" value={line.bin?.id ?? ""} disabled={row.binsForStore.length === 0} onChange={(e) => row.selectBin(e.target.value)}>
                  {row.binsForStore.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="text-xs">Rack</Label>
                <Select className="h-9" value={line.rack?.id ?? ""} disabled={row.racksForStoreBin.length === 0} onChange={(e) => row.selectRack(e.target.value)}>
                  {row.racksForStoreBin.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">
                  Qty ({line.unit}, avail. {line.availableQty})
                </Label>
                <Input
                  className={overStock ? "border-red-400 dark:border-red-500/60" : ""}
                  type="number"
                  inputMode={unitAllowsDecimalQuantity(line.unit) ? "decimal" : "numeric"}
                  step={unitAllowsDecimalQuantity(line.unit) ? 0.001 : 1}
                  min={unitAllowsDecimalQuantity(line.unit) ? 0.001 : 1}
                  placeholder="Enter quantity"
                  value={line.quantity}
                  onChange={(e) => onUpdate({ quantity: e.target.value === "" ? "" : Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">MRP</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
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
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Discount %</Label>
                <Input
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
              </div>
              <div>
                <Label className="text-xs">Selling Price</Label>
                <Input
                  className={priceMissing || priceNegative ? "border-red-400 dark:border-red-500/60" : ""}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
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
            {qtyMissing && <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">Quantity is required.</p>}
            {priceMissing && <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">Selling price is required.</p>}
            {priceNegative && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">Selling price can't be negative — lower the discount %.</p>}
            {overStock && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">Insufficient stock. Available quantity is {line.availableQty}.</p>}
          </>
        )}
      </div>

      {line.inventoryId && (
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-3.5 py-2.5 text-xs dark:border-navy-800 dark:bg-navy-800/40">
          <Badge tone="neutral">Tax {line.taxPercent}%</Badge>
          <span className="font-semibold text-slate-900 dark:text-slate-100">Line total: {formatCurrency(lineTotal)}</span>
        </div>
      )}
    </div>
  );
}

export function SellPartPage() {
  const [params] = useSearchParams();
  const [step, setStep] = useState<Step>("cart");
  const [cart, setCart] = useState<CartLine[]>(() => [blankLine()]);
  const [customer, setCustomer] = useState<CustomerInput>(emptyCustomer);
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
  const itemCount = cart.filter((l) => l.inventoryId).length;
  // Every row must resolve to a real part/location with a valid quantity
  // and price before Confirm Sale unlocks — explicit checks rather than
  // relying on "" <= 0 coercion, since a future refactor could easily
  // change that comparison's behavior silently.
  const cartHasIssue =
    itemCount === 0 ||
    cart.some(
      (l) =>
        !l.inventoryId ||
        l.quantity === "" ||
        Number(l.quantity) <= 0 ||
        Number(l.quantity) > l.availableQty ||
        l.mrp === "" ||
        Number(l.mrp) < 0 ||
        l.sellingPrice === "" ||
        Number(l.sellingPrice) < 0
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
        items: cart.filter((l) => l.inventoryId).map((l) => ({ inventoryId: l.inventoryId!, quantity: Number(l.quantity), sellingPrice: Number(l.sellingPrice) })),
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
          <div className="space-y-4">
            <Card>
              <CardContent className="p-5">
                <SectionHeader
                  step={1}
                  title="Part Details"
                  actions={
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleScan}>
                        <ScanLine className="h-4 w-4" /> Scan
                      </Button>
                      <Button type="button" size="sm" onClick={addRow}>
                        <Plus className="h-4 w-4" /> Add from Stock
                      </Button>
                    </div>
                  }
                />

                {/* Desktop: one full-width card per part */}
                <div className="hidden space-y-4 lg:block">
                  {cart.map((line, i) => (
                    <CartRowDesktop
                      key={line.key}
                      line={line}
                      index={i}
                      showRemove={cart.length > 1}
                      otherInventoryIds={new Set(cart.filter((l) => l.key !== line.key && l.inventoryId).map((l) => l.inventoryId!))}
                      onUpdate={(patch) => updateRow(line.key, patch)}
                      onRemove={() => removeRow(line.key)}
                    />
                  ))}
                </div>

                {/* Mobile: stacked cards */}
                <div className="space-y-3 lg:hidden">
                  {cart.map((line) => (
                    <CartRowMobile
                      key={line.key}
                      line={line}
                      otherInventoryIds={new Set(cart.filter((l) => l.key !== line.key && l.inventoryId).map((l) => l.inventoryId!))}
                      onUpdate={(patch) => updateRow(line.key, patch)}
                      onRemove={() => removeRow(line.key)}
                    />
                  ))}
                  <Button type="button" variant="outline" className="w-full" onClick={addRow}>
                    <Plus className="h-4 w-4" /> Add from Stock
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <p className="text-base font-bold text-slate-900 dark:text-slate-100">Order Summary</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Items ({itemCount}) — before tax</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(subtotal)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Discount</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{discount > 0 ? `-${formatCurrency(discount)}` : formatCurrency(0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Tax</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(tax)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Total Amount</p>
                    <p className="text-lg font-bold text-brand-600 dark:text-brand-400">{formatCurrency(grandTotal)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
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
