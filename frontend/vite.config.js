import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// E1 — Vite + React Router scaffold (§13.5: chosen over Next.js — no SEO
// requirement, distribution is WhatsApp + placement cells, no SSR need
// behind an auth wall, and the NestJS backend already serves the API).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_ORIGIN ?? "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    include: ["src/**/*.test.js"],
    environment: "node",
  },
});
