// vite.config.ts
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "node:path";

export default defineConfig({
  // --- Base URL ---
  base: process.env.VITE_BASE ?? "/",
  // --- Plugins ---
  plugins: [
    tsconfigPaths({ projects: [resolve(__dirname, "tsconfig.json")] }),
  ],

  // --- Root & Public ---
  publicDir: resolve(__dirname, "public"), // points to actual /public folder
  server: { open: true },
  build: { outDir: "../dist", emptyOutDir: true },

  // --- Aliases ---
  resolve: {
    alias: {
      "@source": resolve(__dirname, "src"),
      "@core": resolve(__dirname, "src/core"),
      "@game": resolve(__dirname, "src/game"),
      "@ui": resolve(__dirname, "src/ui"),
      "@data": resolve(__dirname, "src/data"),
      "@types": resolve(__dirname, "src/types"),
      "@persistence": resolve(__dirname, "src/persistence"),
      "@engine": resolve(__dirname, "src/engine"), // optional — remove if unused
    },
  },
});
