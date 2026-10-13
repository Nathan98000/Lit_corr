/**
 * The data build's stamp: meta.json's `generated_at` ("2026-10-13T16:44:59Z") without its separators
 * ("20261013T164459Z"). vite.config.js puts it in the code at build time (__DATA_BUILD__), and every aggregates request
 * carries it (aggregatesUrl in data.js), so a browser that keeps /aggregates/* for an hour never mixes one build's
 * files with another's: a new build asks for new addresses (the data update of 2026-10-13, D7).
 */
export const dataStamp = (generatedAt) => String(generatedAt || "").replace(/[^0-9A-Za-z]/g, "");
