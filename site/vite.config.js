import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dataStamp } from "./src/lib/dataStamp.js";

// Parts that load their code when first needed (F49), the Genres and Trends pages' components (Genre*.jsx, Trend*.jsx,
// IncludeSelect.jsx, their cards' TipBody.jsx and tips.css) and helpers among them, How it works' pictures and styles
// (HowFigures.jsx, methodology.css), and the code that makes "Download PNG"'s image (lib/chartImage.js). Everything
// else, including React and the code the first chart needs, stays in the main chunk, so the first load is one script.
const LAZY =
  /[\\/]src[\\/](components[\\/](CharacteristicPicker|Methodology|HowFigures|MetricMenu|PatternBrowser|IncludeSelect|ComparisonProfile|Genre\w*|Trend\w*|TipBody)\.jsx|lib[\\/](search|genres|genreLayout|chartImage|trends|trendLayout)\.js|(genres|trends|methodology|tips)\.css)$/;

// The data build's stamp, from the aggregates' meta.json, for every aggregates request (?v=…, lib/data.js): one
// build's files stay together in a browser's cache. The tests run without it (their fetch stubs read plain paths);
// dataUpdate.test.jsx sets it. public/ is the project root's, and the root is where vite and vitest run.
const META = path.resolve("public", "aggregates", "meta.json");
export const dataBuild = (mode) =>
  mode === "test" || !existsSync(META) ? "" : dataStamp(JSON.parse(readFileSync(META, "utf8")).generated_at);

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: { __DATA_BUILD__: JSON.stringify(dataBuild(mode)) },
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
}));
