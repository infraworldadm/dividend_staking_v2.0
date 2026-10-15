import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        appBg: "var(--app-bg)",
        cardBg: "var(--card-bg)",
        borderSoft: "var(--border-soft)",
        textMuted: "var(--text-muted)",
        brand: "var(--brand)",
        brandDark: "var(--brand-dark)",
      },
      boxShadow: {
        card: "0 2px 10px rgba(15, 23, 42, 0.06)",
      },
      borderRadius: {
        xl2: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
