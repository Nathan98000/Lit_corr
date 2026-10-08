import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the built site works from any host or sub-folder (Vercel, Netlify, GitHub Pages).
  base: "./",
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
  },
});
