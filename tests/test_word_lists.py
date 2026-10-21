import json
import re

import pytest

from litcorr.schema import REG
from litcorr.text.features import LEXICON_MEASURES, SUPPORT_LEXICONS
from litcorr.text.lexicons import LEXICON_DIR, load_lexicon, norm_token
from litcorr.word_lists import FAMILIES, MEASURES, OTHER, page_data, read_list, render, write_word_lists

SAMPLE = """# name: sample
# label: Sample list
# description: A list for the test.
# notes: Nothing left out.
kiss
kissed  # an inline comment
kiss*
# Group two
smart-ass
in control
kiss
!birth control
"""


def _page_data(html: str) -> dict:
    return json.loads(re.search(r'<script id="data" type="application/json">(.*?)</script>', html, re.S).group(1))


def test_every_list_is_placed_and_feeds_known_measures():
    placed = [name for _, names in FAMILIES for name in names]
    assert len(placed) == len(set(placed))
    assert set(placed) == {p.stem for p in LEXICON_DIR.glob("*.txt")} == set(MEASURES)
    assert set(MEASURES) == LEXICON_MEASURES | SUPPORT_LEXICONS
    columns = {x.name for x in REG}
    for name, (own, also) in MEASURES.items():
        assert own or also, name
        assert set(own) | set(also) <= columns, name


def test_the_page_shows_exactly_what_the_pipeline_matches(tmp_path):
    page = write_word_lists(tmp_path / "word_lists.html")
    html = page.read_text(encoding="utf-8")
    assert "__WORD_LISTS__" not in html and "__FONT_FACE__" not in html
    data = _page_data(html)
    assert [x["name"] for x in data["lists"]] == [name for _, names in FAMILIES for name in names]
    for x in data["lists"]:
        lex = load_lexicon(LEXICON_DIR / f"{x['name']}.txt")
        by_kind = {k: {norm_token(e["t"]) for e in x["entries"] if e["k"] == k} for k in "wxpn"}
        assert by_kind["w"] == lex.words
        assert {t[:-1] for t in by_kind["x"]} == set(lex.prefixes)
        assert by_kind["p"] == {" ".join(ph) for phs in lex.phrases.values() for ph in phs}
        assert by_kind["n"] == {" ".join(ph) for phs in lex.exclusions.values() for ph in phs}
        assert x["n"] == lex.n_entries
        assert (tmp_path / x["href"]).resolve() == (LEXICON_DIR / f"{x['name']}.txt").resolve()
    assert render(page_data(page=page)) == html  # the same lists give the same page


def test_read_list_kinds_sections_and_tidy_hints(tmp_path):
    p = tmp_path / "sample.txt"
    p.write_text(SAMPLE, encoding="utf-8")
    d = read_list(p)
    assert (d["label"], d["description"], d["notes"], d["n"]) == ("Sample list", "A list for the test.",
                                                                  "Nothing left out.", 6)
    assert [(e["t"], e["k"]) for e in d["entries"]] == [
        ("kiss", "w"), ("kissed", "w"), ("kiss*", "x"), ("smart-ass", "w"), ("in control", "p"), ("kiss", "w"),
        ("birth control", "n")]
    assert d["entries"][1]["c"] == "an inline comment"
    assert d["sections"] == ["Group two"]
    assert [e.get("s") for e in d["entries"]] == [None, None, None, 0, 0, 0, 0]
    assert d["tidy"] == {"dups": ["kiss"], "covered": [["kiss", "kiss*"], ["kissed", "kiss*"], ["kiss", "kiss*"]],
                         "unmatchable": ["smart-ass"]}


def test_a_list_the_pipeline_rejects_stops_the_build(tmp_path):
    p = tmp_path / "bad.txt"
    p.write_text("# name: bad\nword\n!birth\n", encoding="utf-8")
    with pytest.raises(ValueError, match="exclusion"):
        read_list(p)


def test_a_new_list_shows_up_before_it_is_mapped(tmp_path):
    (tmp_path / "sample.txt").write_text(SAMPLE, encoding="utf-8")
    data = page_data(tmp_path, tmp_path / "word_lists.html")
    assert [(x["name"], x["family"], x["measures"], x["also"]) for x in data["lists"]] == [("sample", OTHER, [], [])]
    assert [f["name"] for f in data["families"]] == [OTHER]


def test_example_words_in_the_sites_definitions_are_counted_by_their_lists():
    """Each word in a word-list definition's parentheses on the site ("Sexual terms (cock, orgasm, naked) per 1,000
    words.", the owner's examples of 2026-10-20, and the sensory lists' older ones) is matched by a list that feeds the
    characteristic, so an edit to a list can't leave the site showing an example it no longer counts."""
    from litcorr.stage2.wording import SITE_DESCRIPTION

    lists = {p.stem: load_lexicon(p) for p in LEXICON_DIR.glob("*.txt")}

    def counted(lex, example):
        parts = norm_token(example).split()
        if len(parts) > 1:
            return tuple(parts) in lex.phrases.get(parts[0], [])
        return lex.word_matches(parts[0])

    checked = 0
    for column, text in SITE_DESCRIPTION.items():
        feeding = [lists[name] for name, (own, also) in MEASURES.items() if column in own or column in also]
        found = re.findall(r"\(([^()]*)\)", text)
        if not feeding or not found:
            continue
        examples = [w.strip() for w in found[-1].split(",")]
        for w in examples:
            assert any(counted(lex, w) for lex in feeding), (column, w)
        checked += 1
    assert checked >= 34  # 28 definitions given examples on 2026-10-20 (8 of them pacing), 6 sensory ones before
