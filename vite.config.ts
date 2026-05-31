import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "path";

const isWatchMode = process.argv.includes("--watch");

export default defineConfig({
  plugins: [
    solid(),
    viteStaticCopy({
      targets: [{ src: "manifest.json", dest: "." }],
    }),
    viteStaticCopy({
      targets: [{ src: "src/styles.css", dest: "." }],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "./assets"),
    },
  },
  build: {
    watch: isWatchMode ? {} : undefined,
    minify: !isWatchMode,
    sourcemap: !isWatchMode,
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, "src/CoIntelligencePlugin.tsx"),
      formats: ["cjs"], // Obsidian loads CommonJS
      fileName: () => "main.js",
    },
    rollupOptions: {
      // Obsidian's runtime already loads CodeMirror; importing it as a peer
      // keeps our bundle small and avoids two CM6 instances in the host.
      external: [
        "obsidian",
        "electron",
        "@codemirror/state",
        "@codemirror/view",
      ],
      output: {
        exports: "named",
        assetFileNames: () => "styles.css", // Always output CSS as styles.css
        entryFileNames: "main.js", // Ensure the main entry file is named correctly
      },
    },
  },
  css: {
    modules: false,
  },
});
