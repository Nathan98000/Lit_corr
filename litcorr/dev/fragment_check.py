"""`fragment_check`: hand-check passive voice and commands on short fragments drawn from the whole corpus.

  python -m litcorr.dev.fragment_check make CHECK SHEET [--n 50] [--seed 1] [--sample NAME]
  python -m litcorr.dev.fragment_check show SHEET
  python -m litcorr.dev.handcheck judge SHEET "1:ok 2:error:type ..."     (judge and score as for hand-checks)
  python -m litcorr.dev.handcheck score SHEET

Checks:
  passive             a counted passive-voice match: is it a passive ("was taken by"), or an adjective or
                      something else ("was tired of")?
  commands            a quoted passage counted as a command: is it an imperative ("Come here"), or not
                      ("Fuck!", "Look, I ...")?
  commands_unflagged  a quoted passage NOT counted as a command: is it in fact an imperative (a miss)?
  names               a recurring name found in a story: is it a character's name, or a place, title or
                      ordinary word? (only the name is shown)

The masked view hides exactly the words these rules look at (the participle, the verb), so these checks show
fragments of at most five words instead: for passive voice the auxiliary, any adverbs, the participle and the
next word; for a counted command the first four words of the sentence that made it a command ("... " when that
is not the passage's first sentence); for a passage not counted, the first four words of the passage and the
first three words of up to two later sentences, as separate fragments. Items are drawn uniformly at random from all
matches (or passages) in the analysed stories, or in the stories of a review sample (--sample, e.g. one drawn
with review_sample --only-new-since to re-check new stories only), so the accuracy is per match. Fragments are
like entries of a corpus n-gram list: `show` prints them in random order without story keys, and the sheet
stores only the story key and word positions, never the words.
"""

from __future__ import annotations

import argparse
import os
import random
from concurrent.futures import ProcessPoolExecutor
from typing import Any

import pandas as pd

from .common import load_features, load_texts, paragraphs_of, settings
from .handcheck import _load, _save, sheet_path
from .measure_audit import analysed

CHECKS = ("passive", "commands", "commands_unflagged", "names")
_M = None


def _init() -> None:
    global _M
    from ..text.features import Measurer

    _M = Measurer()


def _doc(text: str, title: Any, desc: Any):
    from ..text.doc import TextDoc
    from ..text.prepare import prepare

    prep = prepare(paragraphs_of(text), title if isinstance(title, str) else None,
                   desc if isinstance(desc, str) else None)
    return TextDoc(prep.story)


def _candidates(task: tuple[str, str, Any, Any, str]) -> tuple[str, list[str]]:
    from ..text.features import passive_matches

    key, text, title, desc, check = task
    doc = _doc(text, title, desc)
    if check == "passive":
        return key, [f"t{i}-{j}" for i, j in passive_matches(doc)]
    if check == "names":
        return key, [f"n{k}" for k in range(len(_M.recurring_names(doc)[0]))]
    flagged = set(_M.command_segments(doc))
    want = check == "commands"
    return key, [f"seg{k}" for k in range(len(doc.segment_info)) if (k in flagged) == want]


def make(check: str, n: int, seed: int, sample: str | None = None) -> pd.DataFrame:
    s = settings()
    if sample:
        from .review_sample import load_sample

        keys = list(load_sample(sample)["story_key"])
    else:
        keys = list(analysed(load_features(s))["story_key"])
    texts = load_texts(s, keys, columns=("story_key", "text", "title", "description"))
    tasks = [(*r, check) for r in texts.itertuples(index=False, name=None)]
    workers = max(1, min(8, (os.cpu_count() or 2) - 1))
    with ProcessPoolExecutor(max_workers=workers, initializer=_init) as ex:
        pool = [(k, loc) for k, locs in ex.map(_candidates, tasks, chunksize=16) for loc in locs]
    pool.sort()
    rng = random.Random(f"{check}:{seed}")
    picked = rng.sample(pool, min(n, len(pool)))
    decision = {"passive": "passive", "commands": "command", "commands_unflagged": "not a command",
                "names": "name"}[check]
    df = pd.DataFrame({"item": [str(i) for i in range(1, len(picked) + 1)], "classifier": check,
                       "story_key": [k for k, _ in picked], "locator": [loc for _, loc in picked],
                       "decision": decision, "judgement": "", "error_type": "", "note": ""})
    print(f"{len(pool):,} candidates in {len(texts):,} stories; drew {len(df)}")
    return df


def fragment(doc, locator: str) -> str:
    if locator.startswith("n"):
        if _M is None:
            _init()
        return _M.recurring_names(doc)[0][int(locator[1:])]
    if locator.startswith("t"):
        i, j = (int(x) for x in locator[1:].split("-"))
        end = j + 2 if j + 1 < doc.n and doc.sent_idx[j + 1] == doc.sent_idx[j] else j + 1
        return " ".join(doc.orig[i:end])
    from ..text.features import passage_sentences

    if _M is None:
        _init()
    k = int(locator[3:])
    first, count, _ = doc.segment_info[k]
    parts = passage_sentences(doc, first, first + count)
    flagged = dict(_M.command_starts(doc))
    if k in flagged:  # the sentence that made it a command
        j = flagged[k]
        stop = next(e for s, e in parts if s == j)
        lead = "... " if j > first else ""
        return f'"{lead}{_words(doc, j, stop, 4)}"'
    # not counted: the start of the passage and of up to two later sentences
    shown = [_words(doc, s, e, 4 if n == 0 else 3) for n, (s, e) in enumerate(parts[:3])]
    more = " | ..." if len(parts) > 3 else ""
    return '"' + " | ".join(shown) + more + '"' + "".join(
        "  (question)" for s, _ in parts[:1] if doc.sentences[doc.sent_idx[s]].terminal == "?")


def _words(doc, start: int, stop: int, k: int) -> str:
    return " ".join(doc.orig[start:min(stop, start + k)]) + (" ..." if stop - start > k else "")


def show(sheet: str) -> None:
    d = _load(sheet)
    s = settings()
    tx = load_texts(s, list(d["story_key"].unique()),
                    columns=("story_key", "text", "title", "description")).set_index("story_key")
    docs: dict[str, Any] = {}
    for r in d.itertuples(index=False):
        if r.story_key not in docs:
            t = tx.loc[r.story_key]
            docs[r.story_key] = _doc(t["text"], t["title"], t["description"])
        print(f"#{r.item:>3} [{r.decision}] {fragment(docs[r.story_key], r.locator)}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m litcorr.dev.fragment_check", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    mk = sub.add_parser("make")
    mk.add_argument("check", choices=CHECKS)
    mk.add_argument("sheet")
    mk.add_argument("--n", type=int, default=50)
    mk.add_argument("--seed", type=int, default=1)
    mk.add_argument("--sample", default=None, help="draw only from the stories of this review sample")
    sh = sub.add_parser("show")
    sh.add_argument("sheet")
    args = ap.parse_args(argv)
    if args.cmd == "make":
        df = make(args.check, args.n, args.seed, args.sample)
        _save(df, args.sheet)
        print(f"-> {sheet_path(args.sheet)}")
    else:
        show(args.sheet)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
