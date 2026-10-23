/**
 * App-level product brand — constant across every tenant/dealer using this
 * codebase (as opposed to dealer name/address, which is tenant data and
 * comes from the Tenant record / GET /api/public/branding pre-login, or
 * useAuth().tenant post-login). Defined once here so it's never re-typed
 * across components.
 */
export const PRODUCT_NAME = "INVENTORY MANAGEMENT SYSTEM";
export const PRODUCT_TAGLINE = "Smart Inventory. Better Control.";
