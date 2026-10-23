export type RoleName = "SUPER_ADMIN" | "TENANT_ADMIN" | "INVENTORY_MANAGER" | "STORE_USER" | "VIEWER";
export type MasterStatus = "ACTIVE" | "INACTIVE";
export type StockStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK";
export type StockTxnType = "PURCHASE" | "ISSUE" | "SALE" | "RETURN" | "ADJUSTMENT" | "CORRECTION";
export type InvoiceStatus = "DRAFT" | "COMPLETED" | "CANCELLED";

export interface CurrentUser {
  id: string;
  email: string;
  mobile: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
  /** Per-user menu overrides set by Super Admin. Absent key = fall back to the normal role-based default. */
  menuAccess: Record<string, boolean>;
}

export interface TenantSummary {
  id: string;
  name: string;
  dealerCode: string;
  address?: string | null;
  state?: string | null;
  status?: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type PartUnit = "NOS" | "LTR" | "ML" | "KGS";

export interface Part {
  id: string;
  partNo: string;
  description: string;
  taxPercent: string;
  hsnCode: string | null;
  mrp: string;
  ndp: string;
  dealerMarginPercent: string;
  unit: PartUnit;
  barcode?: string | null;
  category: string;
  minimumStockLevel: number;
  status: MasterStatus;
  createdAt: string;
}

export interface Store {
  id: string;
  code: string;
  name: string;
  address: string | null;
  status: MasterStatus;
}

export interface Bin {
  id: string;
  code: string;
  storeId: string;
  status: MasterStatus;
  store?: { id: string; name: string; code: string };
}

export interface Rack {
  id: string;
  code: string;
  storeId: string;
  status: MasterStatus;
  store?: { id: string; name: string; code: string };
}

export interface LocationRef {
  id: string;
  code: string;
  name?: string;
}

export interface InventoryRow {
  id: string;
  partId: string;
  partNo: string;
  description: string;
  store: LocationRef;
  bin: LocationRef;
  rack: LocationRef;
  mrp: string;
  ndp: string;
  taxPercent: string;
  unit: PartUnit;
  category: string;
  availableQty: number;
  minimumStockLevel: number;
  status: StockStatus;
  updatedAt: string;
}

export interface StockLedgerEntry {
  id: string;
  transactionNumber: string;
  transactionType: StockTxnType;
  invoiceNumber: string | null;
  quantityChange: number;
  balanceQuantity: number;
  reference: string | null;
  createdByName: string;
  createdAt: string;
  part?: { partNo: string; description: string; unit: PartUnit; category: string };
  inventory?: { store: LocationRef; bin: LocationRef; rack: LocationRef };
}

export interface ValidatedPurchaseRow {
  rowNumber: number;
  invoiceNo: string;
  partNo: string;
  partDescription: string;
  taxPercent: number | null;
  hsnCode: string;
  mrp: number | null;
  ndp: number | null;
  quantity: number | null;
  unit: string;
  storeCode: string;
  binCode: string;
  rackCode: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  ndpMismatch: boolean;
}

export interface UploadPreviewResult {
  uploadedFileId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ValidatedPurchaseRow[];
}

export interface ValidatedPartRow {
  rowNumber: number;
  partNo: string;
  partDescription: string;
  taxPercent: number | null;
  hsnCode: string;
  mrp: number | null;
  ndp: number | null;
  unit: string;
  category: string;
  barcode: string;
  minimumStockLevel: number;
  status: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  ndpMismatch: boolean;
}

export interface PartsUploadPreviewResult {
  uploadedFileId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ValidatedPartRow[];
}

export interface PartsImportResult {
  createdCount: number;
  updatedCount: number;
  importedRows: number;
  skippedRows: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  invoiceNumber: string;
  status: string;
  createdAt: string;
  items: { id: string; quantity: number; mrp: string; ndp: string; taxPercent: string; part?: Part }[];
  createdBy?: { firstName: string; lastName: string };
}

export interface IssueItem {
  id: string;
  partId: string;
  quantity: number;
  returnedQty: number;
  mrp: string;
  ndp: string;
  taxPercent: string;
  part: Part;
  inventory: { store: Store; bin: Bin; rack: Rack };
}

export interface Issue {
  id: string;
  issueNumber: string;
  issueDate: string;
  reference: string | null;
  status: string;
  remarks: string | null;
  items: IssueItem[];
  createdBy?: { firstName: string; lastName: string };
  tenant?: {
    name: string;
    dealerCode: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    gstin: string | null;
  };
}

export interface ReturnableIssueItem {
  id: string;
  partId: string;
  partNo: string;
  description: string;
  store: LocationRef;
  bin: LocationRef;
  rack: LocationRef;
  originalQty: number;
  alreadyReturnedQty: number;
  remainingReturnableQty: number;
}

export interface ReturnableIssue {
  id: string;
  issueNumber: string;
  issueDate: string;
  reference: string | null;
  status: string;
  items: ReturnableIssueItem[];
}

export interface ReturnRecord {
  id: string;
  returnNumber: string;
  returnDate: string;
  issueId: string | null;
  invoiceId: string | null;
  remarks: string | null;
  items: { id: string; quantity: number; part: Part }[];
  issue?: { issueNumber: string } | null;
  invoice?: { invoiceNumber: string } | null;
  createdBy?: { firstName: string; lastName: string };
}

export interface StockAdjustment {
  id: string;
  adjustmentNumber: string;
  systemQuantity: number;
  physicalQuantity: number;
  difference: number;
  reasonType: string;
  remarks: string | null;
  createdAt: string;
  part: Part;
  inventory: { store: Store; bin: Bin; rack: Rack };
}

export interface DashboardSummary {
  cards: {
    totalParts: number;
    totalStockQuantity: number;
    lowStock: number;
    outOfStock: number;
    partsIssuedToday: number;
    partsReturnedToday: number;
    purchaseQtyThisMonth: number;
  };
  stockMovement: { date: string; purchase: number; issue: number; return: number; adjustment: number }[];
  topIssuedParts: { partId: string; partNo: string; description: string; quantityIssued: number }[];
  lowStockParts: { partNo: string; description: string; store: string; availableQty: number; minimumStockLevel: number; status: StockStatus }[];
  recentTransactions: {
    id: string;
    date: string;
    transactionNumber: string;
    transactionType: StockTxnType;
    partNo: string;
    description: string;
    quantityChange: number;
    balanceQuantity: number;
    createdByName: string;
  }[];
}

export interface AppUser {
  id: string;
  email: string;
  mobile: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: RoleName[];
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  address: string | null;
  pincode: string | null;
  state: string | null;
  city: string | null;
  gstin: string | null;
  email: string | null;
}

export type InvoiceTaxType = "CGST_SGST" | "IGST";

export interface InvoiceItem {
  id: string;
  partId: string;
  quantity: number;
  returnedQty: number;
  sellingPrice: string;
  taxPercent: string;
  taxAmount: string;
  taxType: InvoiceTaxType;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  lineTotal: string;
  part: Part;
  inventory: { store: Store; bin: Bin; rack: Rack };
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: InvoiceStatus;
  subtotal: string;
  taxAmount: string;
  grandTotal: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  customer: Customer;
  items: InvoiceItem[];
  createdBy?: { firstName: string; lastName: string; email?: string };
  cancelledBy?: { firstName: string; lastName: string } | null;
  tenant?: {
    name: string;
    dealerCode: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    state: string | null;
    pincode: string | null;
    gstin: string | null;
  };
}

export interface CreateSaleItemInput {
  inventoryId: string;
  quantity: number;
  sellingPrice?: number;
}

export interface CustomerInput {
  name: string;
  mobile: string;
  address: string;
  pincode?: string;
  state?: string;
  city?: string;
  gstin?: string;
  email?: string;
}

export interface ReturnableItem {
  id: string;
  kind: "ISSUE_ITEM" | "INVOICE_ITEM";
  partId: string;
  partNo: string;
  description: string;
  unit: PartUnit;
  category: string;
  store: LocationRef;
  bin: LocationRef;
  rack: LocationRef;
  originalQty: number;
  alreadyReturnedQty: number;
  remainingReturnableQty: number;
}

export interface ReturnableSource {
  kind: "ISSUE" | "INVOICE";
  id: string;
  number: string;
  date: string;
  reference: string | null;
  status: string;
  requiresCancellationFirst: boolean;
  items: ReturnableItem[];
}

export interface ReturnableSearchResult {
  kind: "ISSUE" | "INVOICE";
  number: string;
  date: string;
  label: string;
  status: string;
}

export interface LowStockRow {
  id: string;
  partId: string;
  partNo: string;
  description: string;
  store: LocationRef;
  bin: LocationRef;
  rack: LocationRef;
  mrp: string;
  ndp: string;
  taxPercent: string;
  unit: PartUnit;
  category: string;
  availableQty: number;
  status: "OUT_OF_STOCK" | "LOW_STOCK";
  updatedAt: string;
}

export interface Plan {
  id: string;
  code: "TRIAL" | "BASIC" | "PRO" | "ENTERPRISE";
  name: string;
  description: string | null;
  priceMonthly: string;
  maxUsers: number;
  maxStores: number;
  maxParts: number;
  maxMonthlyTxns: number;
  maxExcelUploadRows: number;
  maxStorageMb: number;
  allowedMenuKeys: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DealerTenant {
  id: string;
  dealerCode: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  trialEndsAt: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
  userCount: number;
  partCount: number;
  storeCount: number;
  createdAt: string;
}
