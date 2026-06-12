# Full-Word Writing + Mixed-Case Words — Design

Date: 2026-06-12 · Status: approved by user · Project: Magic Quill prototype

## Goal

1. The child writes the **whole word on one card**: every letter has its own spot,
   finished letters stay visible, the active letter glows, upcoming letters show
   faint outlines. The word builds up like real writing on a page.
2. Words appear in **book case**: capital first letter, lowercase rest
   ("Sun", "Moon", "Cat"). The name "Emma-Grace" already works this way.

## Architecture

**Per-letter SVG slots.** `.trace-card` hosts `#word-canvas` (replaces the single
`#trace-svg`). Each glyph gets its own `<svg class="slot" viewBox="0 0 100 140">`.
`Tracer`/`Freehand` already accept any SVG as their target — the active slot gets
the engine, engines are unchanged for tracing. `_build()` clears the slot (removing
the faint preview); `destroy()` only unbinds events, so the completed rainbow letter
persists in its slot.

- Rows: words ≤ 6 glyphs → one `.word-line`; longer sequences split after the dash
  (name: "Emma-" / "Grace") or at the middle.
- Slot width = `100% / n` per row (CSS `--n`), aspect 100:140; school writing lines
  (cap/mid dashed/baseline) drawn as CSS background gradients on `.word-line`,
  continuous across the row like a workbook page.
- Freehand stops drawing its own per-slot lines (canvas lines replace them).

## Mixed case

- `WORD_BANK` / `WORD_FX` / save data keep canonical uppercase keys.
- New `MQ.wordDisplay('SUN') → 'Sun'`; glyph sequence = display form split, so
  tiles, prompts ("sss! Big S!", "uh! Little u!") and spell-out lines follow.
- 13 new lowercase glyphs in `letters.js` (ball-and-stick, cap y=15 / mid y=62 /
  base y=112, descenders below): x-height `n o s u w`; ascenders `d h k l`;
  mid-height `t i`; descenders `g p`. Sounds copied from uppercase counterparts.
  Covers every non-initial letter in the word bank.

## Freehand judging

- Recognizer templates extend from `/^[A-Z]$/` to all letter glyphs.
- Size/position coaching derives from each glyph's authored bounding box
  (height ratio 0.55–1.5, bottom-edge alignment) instead of hardcoded
  cap-height rules — so "u" at half height is correct and "g" must dip below
  the baseline. Same-shape pairs (c/C, o/O, s/S, u/U, w/W) are distinguished by
  these size rules; the recognizer's lenient match handles the shape.

## Files

`prototype/js/letters.js` (new glyphs) · `prototype/js/words.js` (display helper) ·
`prototype/index.html` (#word-canvas) · `prototype/css/game.css` (slots, lines,
preview/active) · `prototype/js/game.js` (slot build, sequence from display form) ·
`prototype/js/freehand.js` (templates + bbox judging, drop per-slot lines).

## Verification

Headless-Edge run (per project testing recipe): name quest renders two slot rows
with previews; deterministic word ("Sun" via seeded bag) renders mixed-case tiles
and slots; auto-tracing the first letter leaves its ink and advances the active
slot; freehand accepts a lowercase letter drawn from its own stroke data; all glyph
paths parse with sane bounding boxes; zero console/page errors.

## Trade-off

Letters are smaller than the old one-giant-letter card (a 4-letter word ≈ quarter
card width per letter) — inherent to whole-word writing; matches workbook
proportions. Accepted by user.
