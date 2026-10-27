import type { Config } from "tailwindcss";

/** Cores vêm de variáveis CSS (app/globals.css), uma por tema. `white` segue o texto do tema. */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: v("fg"),
        canvas: v("canvas"),
        panel: v("panel"),
        ok: v("ok"),
        bad: v("bad"),
        "bad-soft": v("bad-soft"),
        warn: v("warn"),
        violet: { 200: v("accent-200"), 300: v("accent-300"), 400: v("accent-400"), 500: v("accent-500"), 600: v("accent-600") },
      },
    },
  },
  plugins: [],
} satisfies Config;
