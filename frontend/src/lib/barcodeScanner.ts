import { isNativePlatform } from "@/lib/platform";

export type ScanBarcodeResult =
  | { status: "scanned"; value: string }
  | { status: "cancelled" }
  | { status: "unsupported" }
  | { status: "permission-denied" }
  | { status: "error"; message: string };

/**
 * Opens the device camera in a ready-made native scanning UI (ML Kit's
 * `scan()` — no WebView transparency/overlay wiring needed, unlike
 * `startScan()`) and resolves with the first barcode found. Native-only:
 * on web (desktop or a mobile browser tab) this resolves "unsupported"
 * immediately rather than attempting a getUserMedia-based fallback, since
 * this app only ships as an Android APK today.
 */
export async function scanBarcode(): Promise<ScanBarcodeResult> {
  if (!isNativePlatform()) return { status: "unsupported" };

  try {
    const { BarcodeScanner } = await import("@capacitor-mlkit/barcode-scanning");

    const { supported } = await BarcodeScanner.isSupported();
    if (!supported) return { status: "unsupported" };

    let permission = await BarcodeScanner.checkPermissions();
    if (permission.camera !== "granted" && permission.camera !== "limited") {
      permission = await BarcodeScanner.requestPermissions();
    }
    if (permission.camera !== "granted" && permission.camera !== "limited") {
      return { status: "permission-denied" };
    }

    // Android needs Google Play Services' Barcode Scanner module — most
    // devices already have it, but a very fresh device may need it fetched
    // on first use. installGoogleBarcodeScannerModule() only starts that
    // download; there's no way to block on it finishing here, so the user
    // is asked to try again in a moment rather than left hanging.
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule();
      return { status: "error", message: "Preparing the scanner for first use — please try again in a few seconds." };
    }

    const { barcodes } = await BarcodeScanner.scan();
    const value = barcodes[0]?.rawValue || barcodes[0]?.displayValue;
    if (!value) return { status: "cancelled" };
    return { status: "scanned", value };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Scan failed" };
  }
}
