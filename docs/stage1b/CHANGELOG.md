# Stage 1B changelog: changes to measure values

Every change that alters the value of a processed column is listed here: the measure, what changed, why, and the
effect on its median, mean and missing rate. Effects are measured on the same stories before and after the
change (`python -m litcorr.dev.measure_profile diff-features OLD NEW`), over the analysed stories of collection
batch 1 (4,251 stories with text as of 2026-10-04) unless stated otherwise.

Text pipeline versions are recorded in `collection_manifest.json` as `text_pipeline_version`.

| Version | Date | Summary |
|---|---|---|
| 1.0 | 2026-10-01 | Stage 1 as delivered (no version constant yet; the baseline). |

---
