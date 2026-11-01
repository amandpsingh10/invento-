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
          50: "#eaf0fe",
          100: "#d6e2fd",
          200: "#aec6fb",
          300: "#80a4f6",
          400: "#5783ef",
          500: "#3a67e6",
          600: "#2457d8",
          700: "#1d46b8",
          800: "#1b3c94",
          900: "#1a3574",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        // A single plain face throughout (weight alone marks headings) —
        // matches the dense, utilitarian "enterprise view" direction; no
        // separate display typeface.
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 24 40 / 0.04)",
        "card-hover": "0 2px 6px -1px rgb(16 24 40 / 0.08)",
      },
      borderRadius: {
        xl: "0.625rem",
        "2xl": "0.75rem",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
