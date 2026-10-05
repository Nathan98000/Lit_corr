"""Text measures: tokens/sentences/dialogue (doc), paratext, lexicons and every per-story measure (features).

TEXT_PIPELINE_VERSION changes whenever a change to the parser, the text preparation or the measures can change
a measure's value (see docs/stage1b/CHANGELOG.md). It is recorded in collection_manifest.json together with a
hash of the lexicons/ folder, and the per-story measure cache is keyed on both.
"""

TEXT_PIPELINE_VERSION = "1.2"


def code_fingerprint() -> str:
    """A short hash of the text-measure code (every .py file in this package). The measure cache is keyed on it as
    well as on TEXT_PIPELINE_VERSION, so an edit that forgot to bump the version still invalidates the cache."""
    import hashlib
    from pathlib import Path

    h = hashlib.sha256()
    for f in sorted(Path(__file__).parent.glob("*.py")):
        h.update(f.name.encode("utf-8") + b"\0" + f.read_bytes() + b"\0")
    return h.hexdigest()[:16]
