import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/", // Set base path from environment variable or default to "/"
  
  resolve: {
    alias: {
      "@source": resolve(__dirname, "src"),
      "@core": resolve(__dirname, "src/core"),
      "@game": resolve(__dirname, "src/game"),
      "@ui": resolve(__dirname, "src/ui"),
      "@data": resolve(__dirname, "src/data"),
      "@types": resolve(__dirname, "src/types"),
      "@persistence": resolve(__dirname, "src/persistence"),
      "@engine": resolve(__dirname, "src/engine"),
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});