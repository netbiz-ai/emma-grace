# Topic Adventures (Word Packs) — Design

Date: 2026-06-12 · Status: approved by user · Project: Magic Quill prototype

## Goal

Let Dad add learning topics (science, maths, animals…) **without coding**, and let
Emma-Grace (6) pick a topic each session. A topic is a themed **word pack** that
rides the existing writing engine: a list of words, each with a spoken fun fact.
After tapping Play she sees "What shall we learn today?" and chooses a pack.

A second idea explored this session — **Adventure Playground Quest** (a physical,
go-outside mission mode) — is explicitly parked until after this ships. It will
reuse the parent-editor patterns built here.

## Data model

Topic = `{ id, name, icon, words: [{ word, fact }] }`.

- Stored in `localStorage` key `mq_topics` as `{ v: 1, topics: [...] }`.
- Words canonical **uppercase**; displayed in book case via `MQ.wordDisplay`
  ('SPACE' → 'Space'), same as the magic-word bank.
- The built-in **"✨ Magic words"** topic = the existing 39-word `WORD_BANK` +
  bespoke `WORD_FX`. Always present, never editable, **not** stored in `mq_topics`.

## Behaviour

- **Picker** (`#screen-topics`): shown after Play (returning players) and after
  naming (first run) and after a run from the complete screen. A Magic-words card
  plus one card per stored topic. Parent-typed names render via **textContent**.
- **Topic word payoff**: spell-out + the word's fun fact spoken + a random
  `GENERIC_FX` visual. Magic words keep their bespoke `WORD_FX`. Run flow unchanged
  — 3 words per run, sticker reward, no timers/buzzers.
- **Per-topic shuffle bags**: `profile.bags[topicId]` (the existing `profile.bag`
  keeps serving magic words). Old profiles gain `bags: {}` via the `Object.assign`
  defaults seed.
- **Topic resolved once at run start** — mid-run parent edits/deletes can't break a
  run. `drawWords` filters a topic's bag against its *current* valid words; a topic
  left with <1 valid word falls back to magic words.

## Starter packs (seeded on first run, editable/deletable after)

Three packs, chosen to exercise the new glyphs and keep every word ≤6 letters,
facts ≤100 chars:

- **Science 🔭** — SPACE ROCKET MAGNET PLANET COMET RIVER ICE
- **Maths 🔢** — ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT NINE TEN (counting facts)
- **Animals 🐢** — TURTLE ZEBRA FOX YAK QUAIL JAGUAR PUPPY

Corrupt `mq_topics` → fall back to the starters **in memory only**, never
auto-overwrite the stored value (don't clobber a pack Dad spent time on).

## Glyphs

Author the 16 glyphs the word bank never needed so any English word works:
uppercase **J Q V X Y Z**, lowercase **b f j q v x y z**. Same conventions as
`letters.js` (viewBox 0 0 100 140; cap 15 / mid 62 / base 112; descenders ≤139;
`display` + `sound` per entry). Tracer checkpoints, freehand $P templates, preview
outlines and size boxes all generate automatically from the stroke data — no engine
changes.

**Refinement vs the brainstorm:** editor word length **2–6 letters** (not 2–8). The
word canvas wraps sequences >6 glyphs across two lines (correct for "Emma-Grace",
wrong mid-word), and ≤6 keeps letters big and legible at age 6. Relax later if wanted.

## Parent editor

New "📚 Word packs" section on `replay.html` (grown-ups page), matching its
dark-theme inline styles. List packs; add/edit form with name input, emoji radio
row, word+fact rows (add/remove), live validation (uppercase-normalize, flag
invalid words inline, dedupe, Save disabled until the topic is valid), delete with
`confirm()`. The Magic pack is not listed. The editor only touches `mq_topics`,
never `mq_profile`. **textContent everywhere** — these are free-text fields, so do
*not* copy replay.js's `innerHTML` rendering.

## Validation rules

- `validWord`: `/^[A-Za-z]{2,6}$/`.
- `validTopic`: name 1–20 chars, an icon, ≥3 valid words, every fact ≤100 chars.

## Risks / mitigations

- Look-alike new glyphs (v/u, x/y): freehand verification step; widen v's vertex if
  mis-recognized. Z vs z height-coached like the existing S/s pair (already coexist).
- Topic deleted/edited mid-run: topic resolved at run start; bags filtered against
  current words; magic fallback.
- Injection via parent-typed names/facts: textContent-only rendering everywhere.
- 6-letter words render 6 slots on one line — already supported (the name uses 5+5).
