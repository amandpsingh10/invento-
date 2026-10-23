import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";

const router = Router();

/**
 * Unauthenticated, pre-login branding info (dealer name/address) shown on
 * the Login / Forgot Password / Reset Password screens. This deployment
 * serves a single active dealer, so "the" tenant is simply the oldest
 * active/trial one — intentionally not exposing anything beyond the two
 * public-facing fields already shown on printed invoices.
 */
router.get(
  "/branding",
  asyncHandler(async (_req, res) => {
    const tenant = await prisma.tenant.findFirst({
      where: { status: { in: ["ACTIVE", "TRIAL"] } },
      orderBy: { createdAt: "asc" },
      select: { name: true, address: true },
    });
    res.json({
      success: true,
      data: {
        dealerName: tenant?.name ?? "AMAN ENTERPRISES",
        dealerAddress: tenant?.address ?? "SOHNA ROAD, FARIDABAD",
      },
    });
  })
);

/**
 * Pincode -> State/City lookup for the Sell Part customer form, proxied
 * server-side against India Post's public pincode API. Proxying (rather
 * than calling it from the browser) keeps this reliable inside the
 * Android WebView, where third-party CORS/network behavior is less
 * predictable than in a full browser, and gives us one place to fall
 * back gracefully if the upstream API is ever slow or down — the
 * frontend always gets a clean { found: boolean } response either way,
 * never a network error to handle.
 */
router.get(
  "/pincode/:pincode",
  asyncHandler(async (req, res) => {
    const pincode = req.params.pincode;
    if (!/^\d{6}$/.test(pincode)) {
      throw ApiError.badRequest("Enter a valid 6-digit pincode", "INVALID_PINCODE");
    }

    try {
      const upstream = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
        signal: AbortSignal.timeout(5000),
      });
      const payload = (await upstream.json()) as Array<{
        Status: string;
        PostOffice: Array<{ State: string; District: string; Block?: string; Name: string }> | null;
      }>;

      const postOffice = payload?.[0]?.PostOffice?.[0];
      if (payload?.[0]?.Status !== "Success" || !postOffice) {
        return res.json({ success: true, data: { found: false } });
      }

      res.json({
        success: true,
        data: { found: true, state: postOffice.State, city: postOffice.District || postOffice.Block || postOffice.Name },
      });
    } catch {
      // Upstream timeout/outage — the customer form falls back to manual
      // state/city entry rather than blocking the sale on a third party.
      res.json({ success: true, data: { found: false } });
    }
  })
);

export default router;
