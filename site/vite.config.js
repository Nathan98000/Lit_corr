import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Parts that load their code when first needed (F49), the Genres and Trends pages' components (Genre*.jsx, Trend*.jsx,
// IncludeSelect.jsx) and helpers among them, and the code that makes "Download PNG"'s image (lib/chartImage.js).
// Everything else, including React and the code the first chart needs, stays in the main chunk, so the first load is
// one script.
const LAZY =
  /[\\/]src[\\/](components[\\/](CharacteristicPicker|Methodology|MetricMenu|PatternBrowser|IncludeSelect|ComparisonProfile|Genre\w*|Trend\w*)\.jsx|lib[\\/](search|genres|genreLayout|chartImage|trends|trendLayout)\.js|(genres|trends)\.css)$/;

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the built site works from any host or sub-folder (Vercel, Netlify, GitHub Pages).
  base: "./",
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "index", test: (id) => !LAZY.test(id), priority: 10 }],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
  },
});
