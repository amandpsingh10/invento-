import { env } from "../config/env";

/**
 * Hand-authored OpenAPI 3.0 document covering PARTS INVENTORY SYSTEM's REST surface.
 * Served at GET /api/docs.json and rendered at GET /api/docs (Swagger UI).
 */
export function buildOpenApiDocument() {
  const bearerAuth = { bearerAuth: [] as string[] };

  return {
    openapi: "3.0.3",
    info: {
      title: "PARTS INVENTORY SYSTEM API",
      version: "0.1.0",
      description: "Dealer Part Inventory Management SaaS — REST API. Multi-tenant; tenantId is always derived server-side from the authenticated JWT.",
    },
    servers: [{ url: env.API_URL }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: { code: { type: "string" }, message: { type: "string" } },
            },
          },
        },
      },
    },
    tags: [
      { name: "Auth" },
      { name: "Parts" },
      { name: "Stores" },
      { name: "Bins" },
      { name: "Racks" },
      { name: "Inventory" },
      { name: "Purchases" },
      { name: "Issues" },
      { name: "Returns" },
      { name: "Adjustments" },
      { name: "Stock Ledger" },
      { name: "Reports" },
      { name: "Dashboard" },
      { name: "Users" },
      { name: "Admin" },
    ],
    paths: {
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Log in with dealer code, email and password",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["dealerCode", "email", "password"],
                  properties: {
                    dealerCode: { type: "string", example: "DEMO001" },
                    email: { type: "string", example: "admin@demo.com" },
                    password: { type: "string", example: "Demo@1234" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Login successful" }, "401": { description: "Invalid credentials" } },
        },
      },
      "/api/auth/refresh": { post: { tags: ["Auth"], summary: "Refresh access token", responses: { "200": { description: "OK" } } } },
      "/api/auth/logout": { post: { tags: ["Auth"], summary: "Log out", security: [bearerAuth], responses: { "200": { description: "OK" } } } },
      "/api/auth/me": { get: { tags: ["Auth"], summary: "Current user profile", security: [bearerAuth], responses: { "200": { description: "OK" } } } },
      "/api/auth/forgot-password": { post: { tags: ["Auth"], summary: "Request a password reset", responses: { "200": { description: "OK" } } } },
      "/api/auth/reset-password": { post: { tags: ["Auth"], summary: "Reset password with a token", responses: { "200": { description: "OK" } } } },

      "/api/parts": {
        get: { tags: ["Parts"], summary: "List parts (paginated, searchable)", security: [bearerAuth], responses: { "200": { description: "OK" } } },
        post: { tags: ["Parts"], summary: "Create a part", security: [bearerAuth], responses: { "201": { description: "Created" } } },
      },
      "/api/parts/{id}": {
        get: { tags: ["Parts"], summary: "Get a part", security: [bearerAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
        put: { tags: ["Parts"], summary: "Update a part", security: [bearerAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
      },

      "/api/stores": {
        get: { tags: ["Stores"], summary: "List stores", security: [bearerAuth], responses: { "200": { description: "OK" } } },
        post: { tags: ["Stores"], summary: "Create a store", security: [bearerAuth], responses: { "201": { description: "Created" } } },
      },
      "/api/bins": { get: { tags: ["Bins"], summary: "List bins", security: [bearerAuth], responses: { "200": { description: "OK" } } } },
      "/api/racks": { get: { tags: ["Racks"], summary: "List racks", security: [bearerAuth], responses: { "200": { description: "OK" } } } },

      "/api/inventory": { get: { tags: ["Inventory"], summary: "Current stock (paginated, filterable by store/bin/rack/status)", security: [bearerAuth], responses: { "200": { description: "OK" } } } },
      "/api/inventory/{id}/history": { get: { tags: ["Inventory"], summary: "Stock ledger history for one inventory row", security: [bearerAuth], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } } },

      "/api/purchases/template": { get: { tags: ["Purchases"], summary: "Download the Excel upload template", security: [bearerAuth], responses: { "200": { description: "XLSX file" } } } },
      "/api/purchases/upload": {
        post: {
          tags: ["Purchases"],
          summary: "Upload & validate a purchase Excel file (preview only, does not import)",
          security: [bearerAuth],
          requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } } },
          responses: { "200": { description: "Validation preview with per-row errors" } },
        },
      },
      "/api/purchases/import": { post: { tags: ["Purchases"], summary: "Import the valid rows of a previously uploaded file", security: [bearerAuth], responses: { "201": { description: "Purchases created, inventory updated" } } } },
      "/api/purchases": { get: { tags: ["Purchases"], summary: "List purchases", security: [bearerAuth], responses: { "200": { description: "OK" } } } },

      "/api/issues": {
        get: { tags: ["Issues"], summary: "List issues", security: [bearerAuth], responses: { "200": { description: "OK" } } },
        post: { tags: ["Issues"], summary: "Issue a part from inventory", security: [bearerAuth], responses: { "201": { description: "Created" } } },
      },
      "/api/returns/lookup/{issueNumber}": { get: { tags: ["Returns"], summary: "Look up an issue by number to see returnable quantities", security: [bearerAuth], parameters: [{ name: "issueNumber", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } } },
      "/api/returns": {
        get: { tags: ["Returns"], summary: "List returns", security: [bearerAuth], responses: { "200": { description: "OK" } } },
        post: { tags: ["Returns"], summary: "Return previously issued parts", security: [bearerAuth], responses: { "201": { description: "Created" } } },
      },
      "/api/adjustments": {
        get: { tags: ["Adjustments"], summary: "List stock adjustments", security: [bearerAuth], responses: { "200": { description: "OK" } } },
        post: { tags: ["Adjustments"], summary: "Record a stock adjustment", security: [bearerAuth], responses: { "201": { description: "Created" } } },
      },
      "/api/stock-ledger": { get: { tags: ["Stock Ledger"], summary: "Query the immutable stock ledger", security: [bearerAuth], responses: { "200": { description: "OK" } } } },

      "/api/reports/stock": { get: { tags: ["Reports"], summary: "Stock report (add ?export=excel to download)", security: [bearerAuth], responses: { "200": { description: "OK" } } } },
      "/api/reports/issues": { get: { tags: ["Reports"], summary: "Issue report (add ?export=excel to download)", security: [bearerAuth], responses: { "200": { description: "OK" } } } },
      "/api/reports/returns": { get: { tags: ["Reports"], summary: "Return report (add ?export=excel to download)", security: [bearerAuth], responses: { "200": { description: "OK" } } } },
      "/api/reports/transactions": { get: { tags: ["Reports"], summary: "Transaction report (add ?export=excel to download)", security: [bearerAuth], responses: { "200": { description: "OK" } } } },

      "/api/dashboard": { get: { tags: ["Dashboard"], summary: "Dashboard summary (cards, charts, recent activity)", security: [bearerAuth], responses: { "200": { description: "OK" } } } },

      "/api/users": {
        get: { tags: ["Users"], summary: "List dealer users", security: [bearerAuth], responses: { "200": { description: "OK" } } },
        post: { tags: ["Users"], summary: "Create a dealer user", security: [bearerAuth], responses: { "201": { description: "Created" } } },
      },

      "/api/admin/dashboard": { get: { tags: ["Admin"], summary: "Platform-wide SaaS dashboard (SUPER_ADMIN only)", security: [bearerAuth], responses: { "200": { description: "OK" } } } },
      "/api/admin/tenants": {
        get: { tags: ["Admin"], summary: "List all dealers", security: [bearerAuth], responses: { "200": { description: "OK" } } },
        post: { tags: ["Admin"], summary: "Create a new dealer + its initial Tenant Admin", security: [bearerAuth], responses: { "201": { description: "Created" } } },
      },
    },
  };
}
