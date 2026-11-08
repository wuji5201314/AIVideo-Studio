/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#FAFAFA",
        surface: "#FFFFFF",
        "surface-muted": "#F5F5F7",
        "border-subtle": "#EBEBEB",
        ink: {
          DEFAULT: "#171717",
          muted: "#666666",
          subtle: "#999999",
        },
        apple: {
          blue: "#0071E3",
          green: "#248A3D",
          amber: "#B26A00",
          red: "#D70015",
          purple: "#7C3AED",
        },
      },
      boxShadow: {
        soft: "0 0 0 1px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.04)",
        "soft-hover": "0 0 0 1px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)",
        card: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
      },
      borderRadius: {
        apple: "12px",
        "apple-lg": "16px",
      },
    },
  },
  plugins: [],
}
