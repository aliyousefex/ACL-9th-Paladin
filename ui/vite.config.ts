import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { seo } from "./vite-seo.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), seo()],
  build: {
    target: "es2022",
  },
});
