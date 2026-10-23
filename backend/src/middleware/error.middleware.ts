import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@parts-inventory-system/database";
import { ApiError } from "../lib/apiError";
import { logger } from "../config/logger";
import { isProd } from "../config/env";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { code: "ROUTE_NOT_FOUND", message: `No route for ${req.method} ${req.path}` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId: req.requestId }, err.message);
    }
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.flatten(),
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: { code: "DUPLICATE_ENTRY", message: "A record with these values already exists" },
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Record not found" },
      });
    }
  }

  logger.error({ err, requestId: req.requestId }, "Unhandled error");

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: isProd ? "An unexpected error occurred" : String((err as Error)?.message ?? err),
    },
  });
}
