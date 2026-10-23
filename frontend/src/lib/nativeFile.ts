import { isNativePlatform } from "@/lib/platform";

export type HandoffResult = "shared" | "downloaded" | "cancelled" | "unsupported";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Filesystem.writeFile wants raw base64, not a data: URL.
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Writes a file into this app's private cache directory and hands it to
 * Android's native share sheet via the official @capacitor/filesystem +
 * @capacitor/share plugins. This is the one mechanism that reliably
 * reaches the Android OS from inside a Capacitor WebView: earlier
 * attempts assumed the WebView implements the standard Web Share API and
 * blob: URL downloads the way a real mobile browser does — on real
 * devices it turned out to implement neither (confirmed live: both
 * silently failed). The native Share plugin registers its own
 * FileProvider under the hood, so the share sheet's "Save to Files" /
 * "Drive" / a Print service (if installed) all get a real, readable file
 * — not a blob only valid inside this WebView's JS context.
 */
async function writeAndShareNative(file: File, title: string): Promise<HandoffResult> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");

  const base64 = await fileToBase64(file);
  await Filesystem.writeFile({ path: file.name, data: base64, directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path: file.name, directory: Directory.Cache });

  try {
    await Share.share({ title, dialogTitle: title, url: uri });
    return "shared";
  } catch (err) {
    // The native Share plugin rejects the promise both when the user
    // backs out of the sheet and on a genuine failure — there's no
    // AbortError-style distinction, so treat it as a silent cancel
    // rather than surfacing a scary error for a normal "changed my mind".
    void err;
    return "cancelled";
  }
}

/**
 * Hands any generated file (invoice PDF, an Excel export, a template
 * download, ...) off to the user, choosing a strategy that actually works
 * in the current environment:
 *  - Real browsers (desktop or a mobile browser tab): a blob URL + a
 *    synthetic <a download> click reliably triggers the browser's own
 *    download manager.
 *  - The Android APK: routes through the native Filesystem+Share plugins
 *    (see writeAndShareNative) — there is no in-WebView download manager
 *    to trigger instead, so the exact same blob-URL/<a download> trick
 *    that works everywhere else silently does nothing here.
 * Returns what actually happened so the caller can show an accurate
 * message rather than a blanket "saved" claim that might be false.
 */
export async function saveFileToDevice(file: File): Promise<HandoffResult> {
  if (isNativePlatform()) {
    return writeAndShareNative(file, file.name);
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}

/** Explicit "Share" action — native Share plugin on the Android app, Web Share API (with a download fallback) in a real browser. */
export async function shareFileToDevice(file: File, title: string): Promise<HandoffResult> {
  if (isNativePlatform()) {
    return writeAndShareNative(file, title);
  }
  const shareData = { title, files: [file] };
  if (navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "cancelled";
    }
  } else if (navigator.share) {
    try {
      await navigator.share({ title });
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "cancelled";
    }
  }
  // No Web Share support at all (older/desktop browser) — fall back to a
  // plain download so the user still gets a usable file.
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
