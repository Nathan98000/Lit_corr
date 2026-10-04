"""Text measures: tokens/sentences/dialogue (doc), paratext, lexicons and every per-story measure (features).

TEXT_PIPELINE_VERSION changes whenever a change to the parser, the text preparation or the measures can change
a measure's value (see docs/stage1b/CHANGELOG.md). It is recorded in collection_manifest.json together with a
hash of the lexicons/ folder, and the per-story measure cache is keyed on both.
"""

TEXT_PIPELINE_VERSION = "1.1"
