import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4319",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
