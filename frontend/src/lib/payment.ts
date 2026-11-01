/** Platform owner's own UPI details — the payee for every dealer's subscription payment, shown on the trial-expired plan-selection screen. */
export const PLATFORM_UPI_ID = "7087443418@upi";
export const PLATFORM_PAYEE_NAME = "Invento Payment";
/** Same number as the UPI ID above — reused as the contact number for a custom-plan request (tel:/WhatsApp), since this is also the platform owner's own phone. */
export const PLATFORM_CONTACT_NUMBER = "7087443418";

/** Builds a standard UPI deep link — scanning it (or tapping it on a phone with a UPI app installed) opens that app with the payee, amount and note pre-filled. */
export function buildUpiLink(amount: number, note: string): string {
  const params = new URLSearchParams({
    pa: PLATFORM_UPI_ID,
    pn: PLATFORM_PAYEE_NAME,
    am: amount.toFixed(2),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}
