import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/auth.middleware";
import { authRateLimiter } from "../../middleware/rateLimit.middleware";
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from "./auth.schema";
import * as authService from "./auth.service";
import { ApiError } from "../../lib/apiError";
import { isProd } from "../../config/env";

const router = Router();

const REFRESH_COOKIE = "parts_inventory_refresh_token";
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  // Frontend and backend can be deployed on different subdomains (e.g.
  // Railway's *.up.railway.app, which registers each subdomain as its own
  // public-suffix boundary) — SameSite=Lax would silently stop the browser
  // from sending this cookie on cross-origin fetch/XHR in that case, only
  // surviving top-level navigation. In production (always HTTPS, secure:
  // true above) we use None+Secure so the refresh flow works whether the
  // deploy is same-site or split across subdomains. Local dev keeps Lax,
  // since None requires Secure and dev runs over plain HTTP.
  sameSite: isProd ? ("none" as const) : ("lax" as const),
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post(
  "/login",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input, req);
    res.cookie(REFRESH_COOKIE, result.refreshToken, REFRESH_COOKIE_OPTS);
    res.json({
      success: true,
      data: { accessToken: result.accessToken, user: result.user, tenant: result.tenant },
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw ApiError.unauthorized("No refresh token provided", "REFRESH_TOKEN_MISSING");
    const result = await authService.refresh(token);
    res.cookie(REFRESH_COOKIE, result.refreshToken, REFRESH_COOKIE_OPTS);
    res.json({ success: true, data: { accessToken: result.accessToken } });
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await authService.logout(req.user!.id);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.json({ success: true, data: { message: "Logged out" } });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await authService.getCurrentUser(req.user!.id);
    res.json({ success: true, data: me });
  })
);

router.post(
  "/forgot-password",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const input = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(input.mobile);
    res.json({ success: true, data: result });
  })
);

router.post(
  "/reset-password",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const input = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(input.token, input.newPassword);
    res.json({ success: true, data: result });
  })
);

export default router;
