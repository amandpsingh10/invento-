import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { globalRateLimiter } from "./middleware/rateLimit.middleware";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware";

import authRoutes from "./modules/auth/auth.routes";
import publicRoutes from "./modules/public/public.routes";
import partsRoutes from "./modules/parts/parts.routes";
import storesRoutes from "./modules/stores/stores.routes";
import binsRoutes from "./modules/bins/bins.routes";
import racksRoutes from "./modules/racks/racks.routes";
import inventoryRoutes from "./modules/inventory/inventory.routes";
import purchasesRoutes from "./modules/purchases/purchases.routes";
import issuesRoutes from "./modules/issues/issues.routes";
import returnsRoutes from "./modules/returns/returns.routes";
import adjustmentsRoutes from "./modules/adjustments/adjustments.routes";
import ledgerRoutes from "./modules/ledger/ledger.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import auditRoutes from "./modules/audit/audit.routes";
import usersRoutes from "./modules/users/users.routes";
import notificationsRoutes from "./modules/notifications/notifications.routes";
import adminRoutes from "./modules/admin/admin.routes";
import salesRoutes from "./modules/sales/sales.routes";
import { buildOpenApiDocument } from "./docs/openapi";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );

  app.use((req, _res, next) => {
    req.requestId = randomUUID();
    next();
  });

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as any).requestId,
      autoLogging: { ignore: (req) => req.url === "/health" },
    })
  );

  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(globalRateLimiter);

  app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  app.get("/api/docs.json", (_req, res) => res.json(buildOpenApiDocument()));
  app.get("/api/docs", (_req, res) => {
    res.type("html").send(`<!doctype html>
<html><head><title>PARTS INVENTORY SYSTEM API Docs</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head><body><div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>window.onload = () => SwaggerUIBundle({ url: '/api/docs.json', dom_id: '#swagger-ui' });</script>
</body></html>`);
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/parts", partsRoutes);
  app.use("/api/stores", storesRoutes);
  app.use("/api/bins", binsRoutes);
  app.use("/api/racks", racksRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/purchases", purchasesRoutes);
  app.use("/api/issues", issuesRoutes);
  app.use("/api/returns", returnsRoutes);
  app.use("/api/adjustments", adjustmentsRoutes);
  app.use("/api/stock-ledger", ledgerRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/audit-logs", auditRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/admin", adminRoutes);
  // Same router mounted twice: /api/invoices is the canonical resource
  // name (matches the Invoice model), /api/sales is kept as an alias since
  // the spec lists both — no business logic is duplicated between them.
  app.use("/api/invoices", salesRoutes);
  app.use("/api/sales", salesRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
