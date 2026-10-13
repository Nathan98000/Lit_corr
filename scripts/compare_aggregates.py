"""Compare two builds of the Stage 2 site's aggregates and print what changed, as Markdown.

    python scripts/compare_aggregates.py BEFORE AFTER > comparison.md

BEFORE and AFTER are aggregate folders written by `python -m litcorr site-data` (site/public/aggregates/, or a copy).
The script reads only their JSON files and uses the standard library only. It prints aggregate numbers only: the
handoffs' names and dates, counts of stories, the results' directions and effects, and the files' sizes.

Sections: 1 source and counts; 2 what the site offers (measures, characteristics, kinds, groups); 3 Popularity's
"tend to" results (v/<characteristic>/all.json's `p`); 4 the Genres page (genres/<included>.json); 5 the Trends page
(trends/<included>/<genre>.json and meta.trend.too_few); 6 the featured questions and the Popular list; 7 files.
"""

from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

GENRES_LIMIT = 60_000   # bytes gzipped, each genres/ file
TRENDS_LIMIT = 16_000   # bytes gzipped, each trends/ file


class Build:
    def __init__(self, root: str) -> None:
        self.root = Path(root)
        self.meta = self.json("meta.json")
        self.genre_name = {g["id"]: g["name"] for g in self.meta["genres"]}
        self.genre_n = {g["id"]: g["n"] for g in self.meta["genres"]}
        self.var = {v["id"]: v for v in self.meta["variables"]}
        self.metrics = [m["id"] for m in self.meta["metrics"]]
        self.metric = {m["id"]: m for m in self.meta["metrics"]}
        self.subsets = {s["id"]: s for s in self.meta["subsets"]}
        self._cache: dict[str, object] = {}

    def json(self, rel: str):
        return json.loads((self.root / rel).read_text(encoding="utf-8"))

    def cached(self, rel: str):
        if rel not in self._cache:
            path = self.root / rel
            self._cache[rel] = self.json(rel) if path.exists() else None
        return self._cache[rel]

    def patterns(self, var: str) -> dict[str, dict[str, list]]:
        """{genre: {metric: [direction, effect]}} from v/<var>/all.json."""
        f = self.cached(f"v/{var}/all.json")
        if not f:
            return {}
        return {gid: dict(zip(self.metrics, g["p"])) for gid, g in f["g"].items()}

    def genres_file(self, sid: str):
        return self.cached(f"genres/{sid}.json")

    def trends_file(self, sid: str, gid: str):
        return self.cached(f"trends/{sid}/{gid}.json")


def fmt(n) -> str:
    return f"{n:,}" if isinstance(n, int) else str(n)


def arrow(a, b) -> str:
    return fmt(a) if a == b else f"{fmt(a)} → {fmt(b)}"


def signed(x) -> str:
    return "–" if x is None else f"{x:+.2f}"


def table(head: list[str], rows: list[list]) -> list[str]:
    out = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return out


def chart_kind(v: dict) -> str:
    if "yes" in v:
        return "yes/no"
    return "ordered" if v["bins"].get("ordered") else "named groups"


def page_kind(build: Build, var: str) -> str | None:
    f = build.genres_file("all")
    c = f["c"].get(var) if f else None
    return c["k"] if c else None


def verdict(build: Build, var: str, genre: str, metric: str) -> str:
    v = build.var.get(var)
    if v is None:
        return "not offered"
    if chart_kind(v) == "named groups":
        return "each group on its own"
    p = build.patterns(var).get(genre, {}).get(metric)
    if p is None:
        return "not offered"
    direction, effect = p
    if effect is None:
        return "too few stories to judge"
    if direction == 0:
        return f"no clear pattern ({signed(effect)})"
    return f"tend to {'more' if direction > 0 else 'less'} ({signed(effect)})"


# --------------------------------------------------------------------------------------------------- sections
def source_and_counts(a: Build, b: Build) -> list[str]:
    out = ["## 1. Source and counts", ""]
    sa, sb = a.meta["source"], b.meta["source"]
    rows = [["Handoff", sa["handoff"], sb["handoff"]],
            ["Processed", sa.get("processed_at", "")[:10], sb.get("processed_at", "")[:10]],
            ["Collected", f"{sa['collected_from']} to {sa['collected_to']}", f"{sb['collected_from']} to {sb['collected_to']}"],
            ["Popularity snapshots", " to ".join(sa.get("stats_observed") or []), " to ".join(sb.get("stats_observed") or [])]]
    ca, cb = a.meta["counts"], b.meta["counts"]
    for k, label in (("sampled", "Sampled"), ("with_text", "With text"), ("included", "Included (in the charts)")):
        rows.append([label, fmt(ca[k]), fmt(cb[k])])
    ra, rb = ca.get("excluded_reasons", {}), cb.get("excluded_reasons", {})
    for r in sorted(set(ra) | set(rb)):
        rows.append([f"Excluded: {r}", fmt(ra.get(r, 0)), fmt(rb.get(r, 0))])
    out += table(["", "Before", "After"], rows) + [""]

    ids = [g for g in b.genre_name if g != "all"] + [g for g in a.genre_name if g != "all" and g not in b.genre_name]
    na = [a.genre_n[g] for g in ids if g in a.genre_n]
    nb = [b.genre_n[g] for g in ids if g in b.genre_n]
    out += [f"Stories per genre: {min(na)}–{max(na)} before, {min(nb)}–{max(nb)} after.", ""]
    out += table(["Genre", "Stories"], [[(b.genre_name.get(g) or a.genre_name.get(g)),
                                          arrow(a.genre_n.get(g, 0), b.genre_n.get(g, 0))] for g in ids]) + [""]
    sids = list(b.subsets) + [s for s in a.subsets if s not in b.subsets]
    out += ["Each “Only include” option's stories:", ""]
    out += table(["Option", "Stories"], [[(b.subsets.get(s) or a.subsets[s])["label"],
                                          arrow(a.subsets.get(s, {}).get("n", 0), b.subsets.get(s, {}).get("n", 0))]
                                         for s in sids]) + [""]
    return out


def offer(a: Build, b: Build) -> list[str]:
    out = ["## 2. What the site offers", ""]
    rows = []
    for m in b.metrics + [m for m in a.metrics if m not in b.metric]:
        ma, mb = a.metric.get(m), b.metric.get(m)
        rows.append([(mb or ma)["label"], ma["coverage"] if ma else "–", mb["coverage"] if mb else "–"])
    out += ["Measures and their coverage:", ""] + table(["Measure", "Before", "After"], rows) + [""]
    added = [v for v in b.var if v not in a.var]
    removed = [v for v in a.var if v not in b.var]
    out += [f"Characteristics: {len(a.var)} before, {len(b.var)} after. "
            f"Added: {', '.join(b.var[v]['label'] for v in added) or 'none'}. "
            f"Removed: {', '.join(a.var[v]['label'] for v in removed) or 'none'}.", ""]
    kinds = []
    for v in b.var:
        if v not in a.var:
            continue
        ka = (chart_kind(a.var[v]), page_kind(a, v))
        kb = (chart_kind(b.var[v]), page_kind(b, v))
        if ka != kb:
            kinds.append([b.var[v]["label"], f"{ka[0]}, {ka[1]}", f"{kb[0]}, {kb[1]}"])
    out += ["Changed kinds (the chart's, then the Genres and Trends pages' form):", ""]
    out += (table(["Characteristic", "Before", "After"], kinds) if kinds else ["None."]) + [""]
    groups = [[b.var[v]["label"], " · ".join(a.var[v]["bins"]["labels"]), " · ".join(b.var[v]["bins"]["labels"])]
              for v in b.var if v in a.var and a.var[v]["bins"]["labels"] != b.var[v]["bins"]["labels"]]
    out += [f"Changed groups ({len(groups)} characteristics):", ""]
    out += (table(["Characteristic", "Before", "After"], groups) if groups else ["None."]) + [""]
    return out


def popularity(a: Build, b: Build) -> list[str]:
    out = ["## 3. Popularity (Explore): “tend to” results", ""]
    common = [v for v in b.var if v in a.var]
    metrics = [m for m in b.metrics if m in a.metric]
    pa = {v: a.patterns(v) for v in common}
    pb = {v: b.patterns(v) for v in common}
    rows = []
    for m in metrics:
        ca = sum(1 for v in common if (pa[v].get("all", {}).get(m) or [0])[0] != 0)
        cb = sum(1 for v in common if (pb[v].get("all", {}).get(m) or [0])[0] != 0)
        rows.append([b.metric[m]["label"], arrow(ca, cb)])
    out += ["All genres' “tend to” results per measure (of the characteristics in both builds):", ""]
    out += table(["Measure", "Tend to"], rows) + [""]

    changes = {"reversed": [], "new": [], "gone": []}
    per_genre: dict[str, int] = {}
    for v in common:
        for g in set(pa[v]) | set(pb[v]):
            for m in metrics:
                da, ea = (pa[v].get(g, {}).get(m) or [0, None])
                db, eb = (pb[v].get(g, {}).get(m) or [0, None])
                if da == db:
                    continue
                per_genre[g] = per_genre.get(g, 0) + 1
                if g != "all":
                    continue
                kind = "reversed" if da and db else ("new" if db else "gone")
                changes[kind].append([b.var[v]["label"], b.metric[m]["label"],
                                      f"{'+' if da > 0 else '−' if da < 0 else '0'} {signed(ea)}",
                                      f"{'+' if db > 0 else '−' if db < 0 else '0'} {signed(eb)}"])
    total = sum(len(x) for x in changes.values())
    out += [f"All genres: {total} changes ({len(changes['reversed'])} reversed, {len(changes['new'])} new, "
            f"{len(changes['gone'])} gone). Each gives the direction (+, − or 0 for no clear pattern) and the effect "
            "(the rank correlation, or for yes/no characteristics the rank-biserial correlation).", ""]
    for kind, title in (("reversed", "Reversed (the direction flipped)"), ("new", "New"), ("gone", "Gone")):
        out += [f"**{title}** ({len(changes[kind])})", ""]
        rows = sorted(changes[kind], key=lambda r: (r[1], r[0]))
        out += (table(["Characteristic", "Measure", "Before", "After"], rows) if rows else ["None."]) + [""]
    names = {**a.genre_name, **b.genre_name}
    rows = [[names.get(g, g), per_genre.get(g, 0)] for g in ["all"] + sorted((g for g in names if g != "all"),
                                                                            key=lambda g: names[g])]
    out += ["Changes per genre (characteristic × measure pairs whose direction changed):", ""]
    out += table(["Genre", "Changes"], rows) + [""]
    return out


def _pairs(build: Build, sid: str) -> dict[tuple[str, str], tuple[int, float | None]]:
    f = build.genres_file(sid)
    if not f:
        return {}
    out = {}
    for var, c in f["c"].items():
        for gid, flag, r in zip(f["genres"], c.get("f") or [], c.get("r") or []):
            if gid != "all":
                out[(var, gid)] = (flag, r)
    return out


def genres_page(a: Build, b: Build) -> list[str]:
    out = ["## 4. The Genres page", ""]
    rows = []
    for sid in b.subsets:
        pa, pb = _pairs(a, sid), _pairs(b, sid)
        if not pb:
            continue
        rows.append([b.subsets[sid]["label"], arrow(sum(1 for f, _ in pa.values() if f), sum(1 for f, _ in pb.values() if f))])
    out += ["(Characteristic, genre) pairs that clearly differ from all genres, per option:", ""]
    out += table(["Option", "Clearly differ"], rows) + [""]
    pa, pb = _pairs(a, "all"), _pairs(b, "all")
    changed = []
    for key in sorted(set(pa) | set(pb), key=lambda k: (b.var.get(k[0], a.var.get(k[0], {})).get("label", k[0]),
                                                        b.genre_name.get(k[1], k[1]))):
        fa, ra = pa.get(key, (0, None))
        fb, rb = pb.get(key, (0, None))
        if fa != fb:
            var, gid = key
            label = (b.var.get(var) or a.var.get(var))["label"]
            mark = {1: "▲", -1: "▼", 0: "·"}
            changed.append([label, b.genre_name.get(gid, gid), f"{mark.get(fa, '≠')} {signed(ra)}",
                            f"{mark.get(fb, '≠')} {signed(rb)}"])
    out += [f"All stories: {len(changed)} pairs changed (▲ higher, ▼ lower, ≠ a different mix, · no clear difference; "
            "r is the rank-biserial correlation, or for named groups the total variation distance).", ""]
    out += (table(["Characteristic", "Genre", "Before", "After"], changed) if changed else ["None."]) + [""]
    return out


def trends_page(a: Build, b: Build) -> list[str]:
    out = ["## 5. The Trends page", ""]
    sids = b.meta["trend"]["subsets"]
    gids = ["all"] + sorted((g for g in b.genre_name if g != "all"), key=lambda g: b.genre_name[g])

    def count(build, sid, gid):
        f = build.trends_file(sid, gid)
        return sum(1 for c in f["c"].values() if c.get("f")) if f else 0

    rows = [[b.genre_name[g]] + [arrow(count(a, s, g), count(b, s, g)) for s in sids] for g in gids]
    out += ["Characteristics that clearly changed from the first window to the last, per genre and option:", ""]
    out += table(["Genre"] + [b.subsets[s]["label"] for s in sids], rows) + [""]
    fa, fb = a.trends_file("all", "all"), b.trends_file("all", "all")
    mark = {1: "▲", -1: "▼"}
    changed = []
    for var in sorted(set(fa["c"]) | set(fb["c"]), key=lambda v: (b.var.get(v) or a.var.get(v))["label"]):
        ca, cb = fa["c"].get(var, {}), fb["c"].get(var, {})
        if ca.get("f") != cb.get("f"):
            show = lambda c: f"{mark.get(c.get('f'), '≠' if c.get('f') else '·')} {signed(c.get('r'))}"
            changed.append([(b.var.get(var) or a.var.get(var))["label"], show(ca), show(cb)])
    out += [f"All genres, All stories: {len(changed)} characteristics changed their verdict (▲ rose, ▼ fell, ≠ "
            "changed, · no clear change; r as on the Genres page).", ""]
    out += (table(["Characteristic", "Before", "After"], changed) if changed else ["None."]) + [""]
    ta, tb = a.meta["trend"]["too_few"], b.meta["trend"]["too_few"]
    rows = []
    for s in sids:
        x, y = ta.get(s, []), tb.get(s, [])
        name = lambda g: b.genre_name.get(g) or a.genre_name.get(g, g)
        rows.append([b.subsets[s]["label"], arrow(len(x), len(y)),
                     ", ".join(sorted(name(g) for g in y if g not in x)) or "–",
                     ", ".join(sorted(name(g) for g in x if g not in y)) or "–"])
    out += ["Genres too few to compare (`meta.trend.too_few`):", ""]
    out += table(["Option", "Genres", "Now too few", "Now comparable"], rows) + [""]
    return out


def featured(a: Build, b: Build) -> list[str]:
    out = ["## 6. The featured questions and the Popular list", ""]
    rows = []
    for f in b.meta["featured"]:
        g = f.get("genre", "all")
        rows.append([f["question"], arrow(verdict(a, f["var"], g, f["metric"]), verdict(b, f["var"], g, f["metric"]))])
    out += table(["Featured question", "Verdict"], rows) + [""]
    m = b.meta["default_metric"]
    rows = [[b.var[v]["label"], arrow(verdict(a, v, "all", m), verdict(b, v, "all", m))] for v in b.meta["popular"]]
    out += [f"The Popular list, with the {b.metric[m]['label'].lower()} in all genres:", ""]
    out += table(["Characteristic", "Verdict"], rows) + [""]
    return out


def files(a: Build, b: Build) -> list[str]:
    def sizes(build: Build):
        out = {}
        for p in sorted(build.root.rglob("*.json")):
            raw = p.read_bytes()
            out[p.relative_to(build.root).as_posix()] = (len(raw), len(gzip.compress(raw, 9, mtime=0)))
        return out

    sa, sb = sizes(a), sizes(b)
    tot = lambda s, i: sum(x[i] for x in s.values())
    out = ["## 7. Files", "", "Gzip at level 9, as a host compresses them. KB = 1,000 bytes.", ""]
    rows = [["Files", fmt(len(sa)), fmt(len(sb))],
            ["Total, raw", f"{tot(sa, 0) / 1e6:.2f} MB", f"{tot(sb, 0) / 1e6:.2f} MB"],
            ["Total, gzipped", f"{tot(sa, 1) / 1e6:.2f} MB", f"{tot(sb, 1) / 1e6:.2f} MB"]]
    for prefix, limit in (("genres/", GENRES_LIMIT), ("trends/", TRENDS_LIMIT)):
        big = lambda s: max(((k, v[1]) for k, v in s.items() if k.startswith(prefix)), key=lambda x: x[1])
        ka, ga = big(sa)
        kb, gb = big(sb)
        rows.append([f"Largest {prefix} file (limit {limit / 1000:.0f} KB)", f"{ka} {ga / 1000:.1f} KB",
                     f"{kb} {gb / 1000:.1f} KB"])
    for rel in ("meta.json", "patterns.json"):
        rows.append([f"{rel}, gzipped", f"{sa[rel][1] / 1000:.1f} KB", f"{sb[rel][1] / 1000:.1f} KB"])
    out += table(["", "Before", "After"], rows) + [""]
    over = [k for k, v in sb.items() if (k.startswith("genres/") and v[1] > GENRES_LIMIT)
            or (k.startswith("trends/") and v[1] > TRENDS_LIMIT)]
    out += [f"Files over their limit after: {', '.join(over) or 'none'}.", ""]
    return out


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    a, b = Build(argv[1]), Build(argv[2])
    out = [f"# Aggregates: {a.meta['source']['handoff']} → {b.meta['source']['handoff']}", ""]
    for section in (source_and_counts, offer, popularity, genres_page, trends_page, featured, files):
        out += section(a, b)
    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
