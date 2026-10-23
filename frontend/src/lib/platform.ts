declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

/**
 * True inside the Android APK's Capacitor WebView, false in a real
 * browser (desktop or a mobile browser tab). Several UI decisions differ
 * between the two — e.g. save/print/share strategy (see invoicePdf.ts) and
 * whether to show an in-screen Back button (the native app has a hardware/
 * gesture back button instead — see hardwareBack.ts).
 */
export function isNativePlatform(): boolean {
  return !!window.Capacitor?.isNativePlatform?.();
}
