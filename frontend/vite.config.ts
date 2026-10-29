import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["icon.svg"],
      workbox: {
        // 배포 즉시 반영 — 새 SW 가 대기 없이 활성화하고 열린 페이지를 즉시 제어(캐시 잔존 방지).
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: "불사 · 회원관리",
        short_name: "회원관리",
        description: "불사 · 회원관리 시스템",
        lang: "ko",
        theme_color: "#2f6b5e",
        background_color: "#e8e0cf",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Phase 1: dev proxy to the NestJS backend API.
      "/api": {
        // 로컬 백엔드(NestJS) — 3000은 타 프로젝트 점유로 3100 사용.
        target: "http://localhost:3100",
        changeOrigin: true,
      },
    },
  },
});
