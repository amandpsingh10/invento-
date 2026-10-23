import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.partsinventorysystem.app",
  // Note: the Android home-screen app label is baked in at native build
  // time (strings.xml), unlike the rest of the app which loads the live
  // web deploy at runtime — this value only takes effect after `npx cap
  // sync android` + a fresh APK build/install, not on the next web deploy.
  appName: "Inventory Management System",
  webDir: "dist",
  // Loads the live deployed web app directly, rather than bundling a local
  // copy of dist/ — the APK always reflects whatever is currently deployed,
  // with no separate rebuild-and-resign step needed when the web app
  // changes. Requires network access at runtime (by design: the backend is
  // a remote API either way).
  server: {
    url: "https://invento-frontend-i6ar.onrender.com",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
