"""Generate docs/DATA_DICTIONARY.md, docs/data_dictionary.json, docs/METHODOLOGY.md and docs/word_lists.html.

METHODOLOGY.md is built from docs/methodology_template.md: every
``{{table:<group>}}`` placeholder is replaced by the plain-English table of the
variables in that group from litcorr/schema.py, so the explanations and the
variable list can never drift apart. word_lists.html is the page for reading the
word lists (litcorr/word_lists.py).
"""

from __future__ import annotations

import re
from pathlib import Path

from .schema import REG, dictionary_markdown, group_table, write_dictionary_json
from .settings import PROJECT_ROOT

DOCS = PROJECT_ROOT / "docs"
_PLACEHOLDER = re.compile(r"\{\{table:([^}]+)\}\}")


def render_methodology(template: str) -> str:
    groups = {x.group for x in REG}

    def repl(m: re.Match[str]) -> str:
        g = m.group(1).strip()
        if g not in groups:
            raise KeyError(f"methodology_template.md refers to unknown variable group {g!r}")
        return group_table(g)

    return _PLACEHOLDER.sub(repl, template)


def write_docs(docs_dir: Path = DOCS) -> list[Path]:
    docs_dir.mkdir(parents=True, exist_ok=True)
    out = []
    p = docs_dir / "DATA_DICTIONARY.md"
    p.write_text(dictionary_markdown(), encoding="utf-8")
    out.append(p)
    p = docs_dir / "data_dictionary.json"
    write_dictionary_json(p)
    out.append(p)
    tpl = docs_dir / "methodology_template.md"
    if tpl.exists():
        rendered = render_methodology(tpl.read_text(encoding="utf-8"))
        header = ("<!-- Generated from docs/methodology_template.md by `python -m litcorr docs`. "
                  "Edit the template, not this file. -->\n\n")
        p = docs_dir / "METHODOLOGY.md"
        p.write_text(header + rendered, encoding="utf-8")
        out.append(p)
    from .word_lists import write_word_lists

    out.append(write_word_lists(docs_dir / "word_lists.html"))
    return out
