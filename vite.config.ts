import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  base: "/Solitair/",
  plugins: [react(), tailwindcss()],
  build: { target: "es2020", cssCodeSplit: true },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
