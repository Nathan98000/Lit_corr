# Lexicons

Every word-list measure in this project is computed from the plain-text files in
this folder. Open them, check them, and improve them. Re-running
`python -m litcorr analyze` picks up any edit; nothing needs to be re-collected.

## Format

```
# name: hedges                     <- machine name (must match the file name)
# label: Hedging words              <- human label used in reports
# description: ...                  <- one-sentence plain-English description
# notes: ...                        <- what was deliberately left out, and why
maybe
possibl*                            <- '*' at the end = any ending (possible, possibly)
a little bit                        <- several words = a phrase (consecutive words)
```

* Matching is case-insensitive. Curly apostrophes are treated as straight ones.
* Words are matched whole: `hot` never matches inside `photo`.
* A wildcard only extends the end of a word (`kiss*` matches kisses, kissed, kissing).
* Phrases match consecutive words inside one paragraph.
* Text after `  #` on an entry line is a comment.
* A word may appear in more than one lexicon (for example `moan` is both an
  arousal word and something you can hear). Each measure is computed separately,
  so this never double-counts within a single measure.

## Caveats

These are simple keyword counts. They do not understand negation ("not happy"
still counts as a happy word), sarcasm, or context, and some words have
everyday meanings (for example `ass` in "smart-ass"). The lists favour words that
are unambiguous in this corpus and leave out very ambiguous ones; the `notes`
line in each file lists important exclusions. Treat every lexicon score as a
rough indicator, not a measurement of what a story "is".

Words referring to age or youth are deliberately absent from every list.
