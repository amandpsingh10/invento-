import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { isNativePlatform } from "@/lib/platform";

/**
 * Screens with nowhere sensible to go "back" to — pressing the hardware/
 * gesture back button here backgrounds the app instead of navigating,
 * matching standard Android behavior at the top of a task's back stack
 * (WhatsApp, Gmail, etc. all minimize here rather than killing the
 * process — a full exitApp() reads as the app crashing/closing, not as
 * "going home").
 */
const MINIMIZE_PATHS = new Set(["/dashboard", "/super-admin/dashboard", "/login"]);

/**
 * Wires the Android hardware/gesture back button to react-router's
 * navigate(-1), so it behaves exactly like every other back gesture on the
 * platform. Screens no longer need their own in-header Back button on
 * native (see PageHeader in ui/Feedback.tsx, which hides it there) — a
 * visible on-screen Back button next to the OS's own back gesture reads as
 * duplicated, unfamiliar chrome on Android. Web has no hardware back
 * button, so PageHeader keeps its Back button there.
 *
 * @capacitor/app is imported statically (not dynamically inside the
 * effect) so listener registration can't lose a race with the very first
 * back press right after launch, and can't silently fail if a dynamic
 * chunk fails to load inside the packaged WebView.
 */
export function useHardwareBackButton() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativePlatform()) return;

    let removeListener: (() => void) | undefined;
    let cancelled = false;

    CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      const path = window.location.pathname;
      if (MINIMIZE_PATHS.has(path)) {
        CapacitorApp.minimizeApp();
      } else if (canGoBack) {
        navigate(-1);
      } else {
        // Reached this screen with no in-app history behind it (e.g. a
        // bottom-tab/sidebar jump right after the post-login redirect
        // replaced history, so there's nothing for navigate(-1) to land
        // on) — go Home instead of letting the press fall through to
        // Android's default "nothing left" handling.
        navigate("/dashboard", { replace: true });
      }
    })
      .then((sub) => {
        if (cancelled) {
          sub.remove();
        } else {
          removeListener = () => sub.remove();
        }
      })
      .catch(() => {
        // Plugin unavailable for some reason — leave Android's own default
        // back handling in place rather than leaving the screen dead.
      });

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [navigate]);
}
