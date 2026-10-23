import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "invento_theme";

interface ThemeContextValue {
  /** The user's stored preference — may be "system". */
  theme: ThemeMode;
  /** What's actually applied right now — always "light" or "dark". */
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function loadTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // Private browsing / storage blocked — fall back to system.
  }
  return "system";
}

function applyResolvedTheme(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(loadTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme
  );

  useEffect(() => {
    const resolved = theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
    setResolvedTheme(resolved);
    applyResolvedTheme(resolved);

    if (theme !== "system") return;
    // Follow OS-level changes live (e.g. device switches to Night Mode at sunset) while in "system" mode.
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      const next = e.matches ? "dark" : "light";
      setResolvedTheme(next);
      applyResolvedTheme(next);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  function setTheme(next: ThemeMode) {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / storage blocked — theme just won't persist across reloads.
    }
  }

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
