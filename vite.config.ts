import { defineConfig } from "vite";
import logseqPluginImport from "vite-plugin-logseq";

// vite-plugin-logseq is CJS; the plugin factory lives on `.default`.
const logseqPlugin = (logseqPluginImport as any).default ?? logseqPluginImport;

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [logseqPlugin()],
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: true,
  },
});
