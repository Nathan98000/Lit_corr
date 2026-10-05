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
  low_i, low_start, missing_space, confusions
                      a counted writing-mechanics slip: is it a real slip (lower-case "i" as the pronoun, a
                      lower-case sentence or paragraph start, a missing space, a word confusion)?
  consent, time_jumps, reader_address
                      a counted phrase: consent or check-in language / a narrative time jump / the narrator
                      talking to the reader? (the phrase with one word on each side; "(in quotes)" marks speech)
  speaker             a paragraph counted as opening with a recurring speaker label: is it one (chat, script)?
  scenes              a sex-dense stretch (sex_scene_count): is it sexual activity, or sex talked about? Shown in
                      the masked view (sexual and action words labelled) from the paragraph where it starts.

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

CHECKS = ("passive", "commands", "commands_unflagged", "names", "low_i", "low_start", "missing_space", "confusions",
          "consent", "time_jumps", "reader_address", "speaker", "scenes")
_LEXICON_CHECKS = {"consent": "consent_checkin", "time_jumps": "time_jumps", "reader_address": "reader_address"}
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
    if check == "scenes":
        import numpy as np

        from ..text.features import SEX_LEXICONS, sex_scenes
        from ..text.lexicons import match

        sex = np.zeros(doc.n, dtype=np.int8)
        for name in SEX_LEXICONS:
            sex = np.maximum(sex, match(_M.lex[name], doc.vocab, doc.type_ids, doc.para_idx, doc.positions_by_type()))
        return key, [f"s{a}-{b}" for a, b in sex_scenes(sex, doc.n)]
    if check in CHECKS[4:]:
        return key, _slip_or_phrase_candidates(doc, check)
    flagged = set(_M.command_segments(doc))
    want = check == "commands"
    return key, [f"seg{k}" for k in range(len(doc.segment_info)) if (k in flagged) == want]


def _slip_or_phrase_candidates(doc, check: str) -> list[str]:
    from collections import Counter

    import numpy as np

    from ..text.features import _CONFUSIONS, _LOWER_I, _MISSING_SPACE, _URLISH, _token_around
    from ..text.lexicons import match

    paras = doc.paragraphs
    text = "\n".join(paras)
    if check == "low_i":
        return [f"w{i}" for i, o in enumerate(doc.orig) if o.replace("’", "'") in _LOWER_I]
    if check == "low_start":
        from ..text.features import lowercase_starts

        return [f"P{k}" if off is None else f"P{k}c{off}"
                for k, off in lowercase_starts(paras, _M.lex["speech_verbs"].word_matches)]
    if check == "missing_space":
        ms = list(_MISSING_SPACE.finditer(text))
        toks = [_token_around(text, m.start(), m.end()) for m in ms]
        reps = Counter(toks)
        return [f"c{m.start()}" for m, tok in zip(ms, toks) if not _URLISH.search(tok)
                and not any(ch.isdigit() for ch in tok) and not tok.endswith(":") and reps[tok] < 3]
    if check == "confusions":
        return [f"c{m.start()}" for m in _CONFUSIONS.finditer(text)]
    if check == "speaker":
        from ..text.features import speaker_label

        labels = [speaker_label(q) for q in paras]
        counts = Counter(lab for lab in labels if lab)
        return [f"P{k}" for k, lab in enumerate(labels) if lab and counts[lab] >= 3]
    h = match(_M.lex[_LEXICON_CHECKS[check]], doc.vocab, doc.type_ids, doc.para_idx, doc.positions_by_type())
    pos = np.flatnonzero(h)
    if check == "reader_address":
        pos = [i for i in pos if not doc.in_quote[i]]
    if check == "time_jumps":
        from ..text.features import _TIME_REFERENCE_BEFORE

        pos = [i for i in pos if not doc.in_quote[i] and (i == 0 or doc.tokens[i - 1] not in _TIME_REFERENCE_BEFORE)]
    return [f"w{int(i)}" for i in pos]


def _phrase_len(doc, lex, i: int) -> int:
    toks = doc.tokens
    for ph in lex.phrases.get(toks[i], ()):
        if i + len(ph) <= doc.n and tuple(toks[i:i + len(ph)]) == ph:
            return len(ph)
    return 1


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
                "names": "name", "scenes": "scene"}.get(check, "counted")
    df = pd.DataFrame({"item": [str(i) for i in range(1, len(picked) + 1)], "classifier": check,
                       "story_key": [k for k, _ in picked], "locator": [loc for _, loc in picked],
                       "decision": decision, "judgement": "", "error_type": "", "note": ""})
    print(f"{len(pool):,} candidates in {len(texts):,} stories; drew {len(df)}")
    return df


def fragment(doc, locator: str, check: str = "") -> str:
    import re

    if check in CHECKS[4:]:
        if _M is None:
            _init()
        paras = doc.paragraphs
        if locator.startswith("w"):
            i = int(locator[1:])
            if check in _LEXICON_CHECKS:
                L = _phrase_len(doc, _M.lex[_LEXICON_CHECKS[check]], i)
                words = " ".join(doc.orig[max(0, i - 1):min(doc.n, i + L + 1)])
                return words + ("  (in quotes)" if doc.in_quote[i] else "")
            return " ".join(doc.orig[max(0, i - 2):i + 3])
        if locator.startswith("P"):
            k, _, off = locator[1:].partition("c")
            q = paras[int(k)]
            if not off:  # the end of the previous paragraph shows whether a sentence ended there
                prev = " ".join(paras[int(k) - 1].split()[-2:]) if int(k) > 0 else "(story start)"
                return f"{prev} ¶ " + " ".join(q.split()[:4])
            m = re.match(r"\S+\s+\S+(?:\s+\S+)?", q[int(off):])
            return m.group(0) if m else q[int(off):int(off) + 30]
        text = "\n".join(paras)
        c = int(locator[1:])
        if check == "missing_space":
            from ..text.features import _token_around

            return _token_around(text, c, c + 1)[:40]
        m = re.match(r"\S+\s+\S+(?:\s+\S+)?", text[c:])
        return m.group(0) if m else text[c:c + 30]
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
        t = tx.loc[r.story_key]
        if r.classifier == "scenes":
            print(f"#{r.item:>3} [scene] {_scene_view(t['text'], t['title'], t['description'], r.locator)}\n")
            continue
        if r.story_key not in docs:
            docs[r.story_key] = _doc(t["text"], t["title"], t["description"])
        print(f"#{r.item:>3} [{r.decision}] {fragment(docs[r.story_key], r.locator, r.classifier)}")


def _scene_view(text: str, title: Any, desc: Any, locator: str) -> str:
    """The masked view of the paragraphs where a sex-dense stretch starts (two paragraphs, up to 60 words each)."""
    from ..text.doc import TextDoc
    from ..text.prepare import prepare
    from .mask import format_views, render

    prep = prepare(paragraphs_of(text), title if isinstance(title, str) else None,
                   desc if isinstance(desc, str) else None)
    doc = TextDoc(prep.story)
    start = int(locator[1:].split("-")[0])
    pi = prep.story_index[int(doc.para_idx[start])]
    views = render(prep.paragraphs, paras=(pi, pi + 2), prep=prep, overlay=False,
                   lex_names=["sexual_anatomy", "sexual_action", "sexual_general", "action_verbs"])
    out = format_views(views, per_sentence=False).splitlines()
    return "\n      ".join(line[:420] for line in out)


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
