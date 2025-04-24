import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "path";

export default defineConfig({
  plugins: [
    solid(),
    viteStaticCopy({
      targets: [{ src: "manifest.json", dest: "." }],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: true,
    lib: {
      entry: path.resolve(__dirname, "src/main.tsx"),
      formats: ["cjs"], // Obsidian loads CommonJS
      fileName: () => "main.js",
    },
    rollupOptions: {
      external: ["obsidian", "electron"], // don’t bundle the host libs
      output: {
        exports: "default",
      },
    },
  },
});
