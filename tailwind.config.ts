import type { Config } from "tailwindcss";

// 原型的视觉真源是 globals.css 里的自定义 CSS 变量与类。
// Tailwind 仅作为补充工具类存在（spec 选型要求），不覆盖原型样式。
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
