import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0a0f1f",
          900: "#0f1729",
          800: "#141d34",
          700: "#1c2942",
          600: "#263252",
        },
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        // Headings/titles/stat numbers only — body copy stays on Inter.
        // Same colors and layout everywhere; this is a typography refresh,
        // not a redesign.
        display: ["Sora", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        "card-hover": "0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.06)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
