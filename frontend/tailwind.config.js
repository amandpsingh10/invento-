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
          50: "#eef1ff",
          100: "#e0e4ff",
          200: "#c6ccff",
          300: "#a3abfd",
          400: "#7c7ef7",
          500: "#5b58ef",
          600: "#3451e0",
          700: "#2a3dc4",
          800: "#26339e",
          900: "#232f7d",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        // Headings/titles/stat numbers only — body copy stays on Inter.
        display: ["Outfit", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(52 81 224 / 0.06), 0 1px 2px -1px rgb(52 81 224 / 0.08)",
        "card-hover": "0 8px 20px -4px rgb(52 81 224 / 0.14), 0 3px 8px -2px rgb(52 81 224 / 0.08)",
        glow: "0 0 0 1px rgb(255 255 255 / 0.08) inset, 0 20px 40px -16px rgb(52 81 224 / 0.45)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
