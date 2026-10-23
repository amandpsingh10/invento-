import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { ApiError } from "../lib/apiError";

/**
 * Populates req.user from the Bearer access token. This is the ONLY place
 * tenantId enters the request context server-side — it is read from the
 * signed JWT, never from the request body/query/params. Every downstream
 * repository call must use req.user.tenantId, never a client-supplied value.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Missing or invalid Authorization header"));
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    if (payload.type !== "access") {
      return next(ApiError.unauthorized("Invalid token type"));
    }
    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      roles: payload.roles as any,
      email: "", // populated lazily where needed via DB lookup; kept out of JWT to allow email changes without re-login being mandatory
    };
    next();
  } catch {
    next(ApiError.unauthorized("Invalid or expired access token", "TOKEN_EXPIRED"));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    if (payload.type === "access") {
      req.user = { id: payload.sub, tenantId: payload.tenantId, roles: payload.roles as any, email: "" };
    }
  } catch {
    // ignore invalid token on optional routes
  }
  next();
}
