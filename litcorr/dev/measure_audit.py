"""`measure_audit`: the aggregate checks of every measure family (Stage 1B phase 3).

  python -m litcorr.dev.measure_audit degeneracy
  python -m litcorr.dev.measure_audit known-groups
  python -m litcorr.dev.measure_audit split-half [--min-words 1000] [--workers 0]
  python -m litcorr.dev.measure_audit redundancy [--threshold 0.9]
  python -m litcorr.dev.measure_audit length
  python -m litcorr.dev.measure_audit all

Population: analysed stories (analysis_include). Tables go to data/dev/audit/ and a summary is printed. Nothing
here prints text or story keys except where noted (degeneracy lists no keys; the outlier keys are in the
measure profile).
"""

from __future__ import annotations

import argparse
import math
import os
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from ..schema import BY_NAME, REG
from .common import dev_dir, load_features, load_texts, paragraphs_of, settings

# Families whose values are not computed from the story text.
NON_TEXT_GROUPS = {"Identifiers & category", "Publication", "Popularity (raw)", "Popularity (ratios)",
                   "Popularity (age-normalised)", "Site badges", "Site metadata", "Quality control"}

# The known-groups expectations, written in WORKLOG.md before they were computed.
EXPECTATIONS = [
    (1, "erotic-letters", "HIGH", "pov_second_per_1k"), (2, "adult-how-to", "HIGH", "pov_second_per_1k"),
    (3, "erotic-letters", "HIGH", "pov_first_singular_per_1k"), (4, "reviews-and-essays", "LOW", "pov_third_per_1k"),
    (5, "lesbian-sex-stories", "HIGH", "gender_feminine_share"), (6, "gay-sex-stories", "LOW", "gender_feminine_share"),
    (7, "gay-sex-stories", "HIGH", "gender_masculine_per_1k"),
    (8, "lesbian-sex-stories", "LOW", "gender_masculine_per_1k"),
    (9, "erotic-letters", "ABOVE", "narr_present_tense_share"), (10, "adult-how-to", "ABOVE", "narr_present_tense_share"),
    (11, "reviews-and-essays", "LOW", "dlg_word_share"), (12, "adult-how-to", "LOW", "dlg_word_share"),
    (13, "erotic-letters", "LOW", "dlg_word_share"), (14, "non-erotic-stories", "LOW", "sex_terms_per_1k"),
    (15, "reviews-and-essays", "LOW", "sex_terms_per_1k"), (16, "anal-sex-stories", "HIGH", "sex_anatomy_per_1k"),
    (17, "group-sex-stories", "HIGH", "sex_terms_per_1k"), (18, "adult-romance", "ABOVE", "sex_words_before_first"),
    (19, "non-erotic-stories", "HIGH", "sex_first_mention_position"),
    (20, "masturbation-stories", "HIGH", "sex_other_per_1k"), (21, "bdsm-stories", "HIGH", "agency_dominance_per_1k"),
    (22, "bdsm-stories", "HIGH", "agency_submission_per_1k"), (23, "mind-control", "HIGH", "agency_control_per_1k"),
    (24, "bdsm-stories", "HIGH", "agency_commands_per_1k"), (25, "adult-romance", "HIGH", "emo_affection_per_1k"),
    (26, "adult-romance", "HIGH", "rel_romance_per_1k"), (27, "erotic-horror", "HIGH", "emo_anxiety_per_1k"),
    (28, "loving-wives", "HIGH", "rel_terms_per_1k"), (29, "loving-wives", "HIGH", "emo_jealousy_per_1k"),
    (30, "adult-humor", "ABOVE", "qe_exclamation_sentences_per_1k"),
    (31, "reviews-and-essays", "HIGH", "read_grade_composite"), (32, "reviews-and-essays", "HIGH", "lex_long_word_share"),
    (33, "reviews-and-essays", "HIGH", "story_mean_sentence_words"),
    (34, "reviews-and-essays", "HIGH", "hedge_modal_per_1k"), (35, "reviews-and-essays", "HIGH", "psy_mental_verbs_per_1k"),
    (36, "erotic-novels", "HIGH", "series_is_part"), (37, "erotic-novels", "HIGH", "site_words_count"),
    (38, "science-fiction-fantasy", "HIGH", "lex_unrecognized_word_share"),
    (39, "group-sex-stories", "HIGH", "char_recurring_names"), (40, "erotic-letters", "LOW", "char_recurring_names"),
    (41, "exhibitionist-voyeur", "HIGH", "sense_sight_per_1k"), (42, "first-time-sex-stories", "ABOVE", "emo_anxiety_per_1k"),
    (43, "non-erotic-stories", "LOW", "emo_arousal_per_1k"), (44, "non-consent-stories", "HIGH", "agency_control_per_1k"),
    (45, "lesbian-sex-stories", "HIGH", "gender_feminine_per_1k"), (46, "chain-stories", "ABOVE", "story_has_author_note"),
    (47, "adult-how-to", "HIGH", "agency_commands_per_1k"), (48, "fetish-stories", "ABOVE", "sense_smell_per_1k"),
    (49, "non-erotic-stories", "BELOW", "style_profanity_per_1k"), (50, "erotic-horror", "ABOVE", "emo_negative_per_1k"),
]

# The Phase 5 expectations for the measures added in text pipeline 1.3 (WORKLOG Phase 5, written before the
# prototypes were computed). Ranked by category MEAN, as pre-registered (most of these are zero in many stories).
# "desc_pov=first" = the share of stories whose description is in the first person.
EXPECTATIONS_PHASE5 = [
    (51, 'erotic-letters', 'LOW', 'open_dialogue'), (52, 'reviews-and-essays', 'LOW', 'open_dialogue'),
    (53, 'adult-how-to', 'LOW', 'open_dialogue'), (54, 'erotic-letters', 'LOW', 'end_dialogue'),
    (55, 'reviews-and-essays', 'LOW', 'end_dialogue'), (56, 'adult-how-to', 'LOW', 'end_dialogue'),
    (57, 'erotic-novels', 'HIGH', 'end_to_be_continued'), (58, 'erotic-letters', 'LOW', 'end_to_be_continued'),
    (59, 'adult-how-to', 'LOW', 'end_to_be_continued'), (60, 'group-sex-stories', 'HIGH', 'sex_scene_count'),
    (61, 'erotic-novels', 'HIGH', 'sex_scene_count'), (62, 'non-erotic-stories', 'LOW', 'sex_scene_count'),
    (63, 'reviews-and-essays', 'LOW', 'sex_scene_count'), (64, 'adult-romance', 'HIGH', 'sex_first_scene_position'),
    (65, 'erotic-novels', 'HIGH', 'sex_first_scene_position'),
    (66, 'masturbation-stories', 'LOW', 'sex_first_scene_position'),
    (67, 'anal-sex-stories', 'LOW', 'sex_first_scene_position'),
    (68, 'reviews-and-essays', 'BELOW', 'mech_lowercase_i_per_1k'),
    (69, 'erotic-novels', 'BELOW', 'mech_lowercase_i_per_1k'),
    (70, 'reviews-and-essays', 'BELOW', 'mech_lowercase_start_per_1k'),
    (71, 'reviews-and-essays', 'BELOW', 'mech_missing_space_per_1k'),
    (72, 'reviews-and-essays', 'BELOW', 'mech_confusions_per_1k'),
    (73, 'erotic-novels', 'BELOW', 'mech_confusions_per_1k'), (74, 'adult-humor', 'HIGH', 'dlg_bare_line_share'),
    (75, 'bdsm-stories', 'HIGH', 'rel_consent_per_1k'), (76, 'first-time-sex-stories', 'HIGH', 'rel_consent_per_1k'),
    (77, 'non-erotic-stories', 'LOW', 'rel_consent_per_1k'), (78, 'erotic-novels', 'HIGH', 'time_jump_per_1k'),
    (79, 'adult-romance', 'HIGH', 'time_jump_per_1k'), (80, 'loving-wives', 'HIGH', 'time_jump_per_1k'),
    (81, 'masturbation-stories', 'LOW', 'time_jump_per_1k'), (82, 'adult-how-to', 'LOW', 'time_jump_per_1k'),
    (83, 'reviews-and-essays', 'HIGH', 'reader_address_per_1k'),
    (84, 'adult-how-to', 'HIGH', 'reader_address_per_1k'), (85, 'adult-humor', 'HIGH', 'humor_per_1k'),
    (86, 'erotic-horror', 'LOW', 'humor_per_1k'), (87, 'non-consent-stories', 'LOW', 'humor_per_1k'),
    (88, 'loving-wives', 'HIGH', 'setting_home_per_1k'),
    (89, 'exhibitionist-voyeur', 'HIGH', 'setting_public_per_1k'),
    (90, 'exhibitionist-voyeur', 'HIGH', 'setting_outdoors_per_1k'), (91, 'anal-sex-stories', 'HIGH', 'title_sexual'),
    (92, 'group-sex-stories', 'HIGH', 'title_sexual'), (93, 'masturbation-stories', 'HIGH', 'title_sexual'),
    (94, 'adult-romance', 'LOW', 'title_sexual'), (95, 'non-erotic-stories', 'LOW', 'title_sexual'),
    (96, 'science-fiction-fantasy', 'LOW', 'title_sexual'),
    (97, 'masturbation-stories', 'HIGH', 'style_elongated_per_1k'),
    (98, 'group-sex-stories', 'HIGH', 'style_elongated_per_1k'),
    (99, 'reviews-and-essays', 'LOW', 'style_elongated_per_1k'),
    (100, 'non-erotic-stories', 'LOW', 'style_elongated_per_1k'),
    (101, 'adult-how-to', 'LOW', 'style_elongated_per_1k'), (102, 'erotic-letters', 'HIGH', 'desc_pov=first'),
    (103, 'adult-how-to', 'HIGH', 'desc_pov=second'),
]


def out_dir() -> Path:
    p = dev_dir(settings()) / "audit"
    p.mkdir(parents=True, exist_ok=True)
    return p


def analysed(df: pd.DataFrame) -> pd.DataFrame:
    return df[df["analysis_include"].fillna(False).astype(bool)].copy()


def text_measures(df: pd.DataFrame, kinds: tuple[str, ...] = ("continuous", "count", "share", "binary")) -> list[str]:
    return [x.name for x in REG if x.kind in kinds and x.group not in NON_TEXT_GROUPS and x.name in df.columns]


def spearman(a: pd.Series, b: pd.Series) -> float:
    ok = a.notna() & b.notna()
    if ok.sum() < 10:
        return float("nan")
    return float(a[ok].rank().corr(b[ok].rank()))


# ------------------------------------------------------------------------------------------- degeneracy
def degeneracy(df: pd.DataFrame) -> pd.DataFrame:
    d = analysed(df)
    rows = []
    for m in text_measures(d):
        x = BY_NAME[m]
        v = pd.to_numeric(d[m], errors="coerce").astype(float)
        nn = v.dropna()
        top_share = float(nn.value_counts(normalize=True).iloc[0]) if len(nn) else np.nan
        issues = []
        if not len(nn):
            issues.append("all missing")
        if len(nn) and top_share >= 0.95:
            issues.append(f"one value in {top_share:.0%}")
        if x.kind == "share" and len(nn) and (nn.min() < -1e-9 or nn.max() > 1 + 1e-9):
            issues.append("share outside 0-1")
        if x.kind in ("count",) and len(nn) and nn.min() < 0:
            issues.append("negative count")
        if x.unit.startswith("per 1,000") and len(nn) and (nn.min() < 0 or nn.max() > 1000):
            issues.append("rate outside 0-1000")
        if len(nn) > 20:
            q1, q99 = nn.quantile([0.01, 0.99])
            iqr = nn.quantile(0.75) - nn.quantile(0.25)
            if iqr > 0 and (nn.max() - q99) > 5 * iqr:
                issues.append(f"extreme upper tail (max {nn.max():.4g} vs p99 {q99:.4g})")
        rows.append({"measure": m, "group": x.group, "kind": x.kind, "n": len(nn),
                     "pct_missing": 100 * (1 - len(nn) / len(d)), "most_common_value_share": top_share,
                     "issues": "; ".join(issues)})
    return pd.DataFrame(rows)


# ------------------------------------------------------------------------------------------- known groups
def known_groups(df: pd.DataFrame) -> pd.DataFrame:
    d = analysed(df)
    rows = []
    checks = [(e, "median") for e in EXPECTATIONS] + [(e, "mean") for e in EXPECTATIONS_PHASE5]
    for (num, cat, kind, m), stat in checks:
        if "=" in m:  # a category's share of one value of a categorical measure
            col, val = m.split("=", 1)
            v = (d[col].astype(str) == val).astype(float).where(d[col].notna())
        else:
            v = pd.to_numeric(d[m], errors="coerce").astype(float)
        med = getattr(v.groupby(d["category_slug"]), stat)().dropna().sort_values(ascending=False)
        if cat not in med.index:
            rows.append({"#": num, "category": cat, "expect": kind, "measure": m, "result": "n/a"})
            continue
        rank = int(list(med.index).index(cat)) + 1  # 1 = highest
        k = len(med)
        mid = float(med.median())
        ok = {"HIGH": rank <= 6, "LOW": rank > k - 6, "ABOVE": med[cat] > mid, "BELOW": med[cat] < mid}[kind]
        rows.append({"#": num, "category": cat, "expect": kind, "measure": m, "ranked_by": stat,
                     "rank_of_30": rank,
                     "category_median": float(med[cat]), "median_of_categories": mid,
                     "top3": ", ".join(med.index[:3]), "bottom3": ", ".join(med.index[-3:]),
                     "result": "pass" if ok else "FAIL"})
    return pd.DataFrame(rows)


# ------------------------------------------------------------------------------------------- split half
_M = None


def _init(analysis: dict[str, Any]) -> None:
    global _M
    from ..settings import Analysis
    from ..text.features import Measurer

    _M = Measurer(analysis=Analysis(**analysis))


def _halves(task: tuple[str, str, Any, Any]) -> tuple[str, dict, dict]:
    from ..text.prepare import prepare, story_only

    key, text, title, desc = task
    prep = prepare(paragraphs_of(text), title if isinstance(title, str) else None,
                   desc if isinstance(desc, str) else None)
    story = prep.story
    odd, even = story[0::2], story[1::2]
    return key, _M.measure_prepared(story_only(odd)), _M.measure_prepared(story_only(even))


def split_half(df: pd.DataFrame, min_words: int = 1000, workers: int = 0) -> pd.DataFrame:
    d = analysed(df)
    d = d[pd.to_numeric(d["story_words"], errors="coerce") >= min_words]
    s = settings()
    texts = load_texts(s, list(d["story_key"]), columns=("story_key", "text", "title", "description"))
    tasks = list(texts.itertuples(index=False, name=None))
    n = workers or max(1, min(8, (os.cpu_count() or 2) - 1))
    with ProcessPoolExecutor(max_workers=n, initializer=_init, initargs=(asdict(s.analysis),)) as ex:
        res = list(ex.map(_halves, tasks, chunksize=16))
    a = pd.DataFrame([r[1] for r in res], index=[r[0] for r in res])
    b = pd.DataFrame([r[2] for r in res], index=[r[0] for r in res])
    skip = {"sex_first_mention_position", "sex_words_before_first"}
    measures = [m for m in text_measures(d, ("continuous", "share")) if not m.startswith("pace_") and m not in skip
                and m in a.columns]
    rows = []
    for m in measures:
        x = pd.to_numeric(a[m], errors="coerce").astype(float)
        y = pd.to_numeric(b[m], errors="coerce").astype(float)
        ok = x.notna() & y.notna()
        r = float(x[ok].corr(y[ok])) if ok.sum() > 10 else np.nan
        rho = spearman(x, y)
        sb = 2 * r / (1 + r) if r == r and r > -1 else np.nan  # Spearman-Brown: reliability at full length
        rows.append({"measure": m, "stories": int(ok.sum()), "r_half": r, "rho_half": rho, "r_full_sb": sb,
                     "flag": "low" if sb == sb and sb < 0.6 else "moderate" if sb == sb and sb < 0.8 else ""})
    return pd.DataFrame(rows).sort_values("r_full_sb")


# ------------------------------------------------------------------------------------------- redundancy
def redundancy(df: pd.DataFrame, threshold: float = 0.9) -> pd.DataFrame:
    d = analysed(df)
    ms = text_measures(d, ("continuous", "count", "share"))
    X = d[ms].apply(pd.to_numeric, errors="coerce").astype(float)
    pear = X.corr()
    spear = X.rank().corr()
    rows = []
    for i, a in enumerate(ms):
        for b in ms[i + 1:]:
            p, s_ = pear.loc[a, b], spear.loc[a, b]
            if (p == p and abs(p) >= threshold) or (s_ == s_ and abs(s_) >= threshold):
                rows.append({"a": a, "b": b, "pearson": p, "spearman": s_,
                             "same_family": BY_NAME[a].group == BY_NAME[b].group})
    return pd.DataFrame(rows).sort_values("spearman", key=lambda s: -s.abs()) if rows else pd.DataFrame()


# ------------------------------------------------------------------------------------------- length
def length_dependence(df: pd.DataFrame) -> pd.DataFrame:
    d = analysed(df)
    words = pd.to_numeric(d["story_words"], errors="coerce").fillna(pd.to_numeric(d["site_words_count"],
                                                                                    errors="coerce"))
    lw = np.log(words.astype(float))
    rows = []
    for m in text_measures(d, ("continuous", "count", "share", "binary")):
        v = pd.to_numeric(d[m], errors="coerce").astype(float)
        rho = spearman(v, lw)
        x = BY_NAME[m]
        expected = x.kind == "count" or m in {"lex_ttr", "lex_unique_words", "char_recurring_names",
                                              "story_has_author_note", "story_requests_feedback",
                                              "series_part_number", "series_parts_count"}
        rows.append({"measure": m, "kind": x.kind, "unit": x.unit, "rho_log_words": rho,
                     "expected_length_dependent": expected,
                     "flag": "unexpected" if (not expected and rho == rho and abs(rho) >= 0.3) else ""})
    return pd.DataFrame(rows).sort_values("rho_log_words", key=lambda s: -s.abs())


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m litcorr.dev.measure_audit", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("check", choices=("degeneracy", "known-groups", "split-half", "redundancy", "length", "all"))
    ap.add_argument("--min-words", type=int, default=1000)
    ap.add_argument("--workers", type=int, default=0)
    ap.add_argument("--threshold", type=float, default=0.9)
    ap.add_argument("--features", default=None)
    args = ap.parse_args(argv)
    df = load_features(settings(), Path(args.features) if args.features else None)
    od = out_dir()
    checks = ["degeneracy", "known-groups", "split-half", "redundancy", "length"] if args.check == "all" else [args.check]
    with pd.option_context("display.width", 220, "display.max_rows", 400, "display.max_colwidth", 70):
        for c in checks:
            t = {"degeneracy": lambda: degeneracy(df), "known-groups": lambda: known_groups(df),
                 "split-half": lambda: split_half(df, args.min_words, args.workers),
                 "redundancy": lambda: redundancy(df, args.threshold), "length": lambda: length_dependence(df)}[c]()
            t.to_csv(od / f"{c}.tsv", sep="\t", index=False, float_format="%.4g")
            print(f"== {c} ({len(t)} rows) -> {od / (c + '.tsv')}")
            show = t[t["issues"] != ""] if c == "degeneracy" else t
            print(show.to_string(index=False, float_format=lambda x: f"{x:.3g}") if len(show) else "(none)")
            print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
