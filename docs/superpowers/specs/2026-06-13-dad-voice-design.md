# Dad-Recorded Voice Lines — Design

Date: 2026-06-13 · Status: approved by user · Project: Magic Quill (live at netbiz-game.com)

## Goal

Let Emma-Grace hear **Dad's real voice** for the game's narration instead of robotic
TTS. Narration is dynamic (her name, the current word, fun facts are assembled at
runtime), so Dad records the game's **fixed, repeated lines**; everything dynamic
falls back to Web Speech TTS. His voice carries the emotional, constantly-heard glue
(praise, encouragement, scene greetings).

Decisions (brainstorm 2026-06-13):
- **Coverage:** a fixed set of recordable lines; TTS fills the rest. Whole lines are
  either his clip or TTS — never spliced mid-sentence.
- **Storage:** *baked into the website*. Dad records in-browser, exports a voice pack,
  and uploads it to `public_html/voice/` with the game, so every device gets his voice
  permanently.
- **Architecture:** Approach A — transparent **text-keyed** swap in `narrator.js`
  (the module already documented as the single swap point). No game call-site changes.
- **Format:** 16 kHz mono **WAV** — universally playable, including iPad Safari.

## Recordable lines (v1 — 18 fixed, name-free lines)

Praise (from `narrator.js` PRAISE): Beautiful! · Wonderful writing! · You did it! ·
Amazing! · Sparkly perfect! · Hooray! · That was magical!

Encouragement (ENCOURAGE): Almost! Start at the sparkly dot. · Good try! Follow the
twinkly path. · Nearly there — try again from the dot! · You can do it! Trace along the stars.

Scene moments (fixed strings in `game.js`): Start at the sparkly dot! · Watch the
shooting star! Then you try! · "Oh! Hello... I am a baby unicorn. Who are you? Write
your name with the magic quill, so we can be friends!" · Now I need a name! Tap the
name you like best for me! · What shall we learn today? Pick one! · Where shall we
adventure today? Pick one! · You are back! What did you find?

Excluded (dynamic → TTS): any line containing her name, the unicorn name, a word, a
fun fact, or per-letter prompts.

## Components

- **`js/voice-lines.js` (`MQ.VoiceLines`)** — single source of truth: `LINES`
  (`[{ slug, text }]`) for the 18 lines, and `slug(text)` (lowercase, strip non-alnum,
  collapse to single `-`). Shared by recorder and player so keys always agree.
- **`js/voice.js` (`MQ.Voice`)** — loads `voice/voice-manifest.json` once; `has(text)`
  (slug present in manifest **and** voice enabled), `play(text)` → Promise resolving on
  clip end (HTMLAudioElement playing `voice/<file>`); `unlock()` primes an Audio element
  on the first user gesture (iOS); enabled flag in `localStorage mq_voice` (default on).
- **`narrator.js`** — `speak(text)` first: `if (MQ.Voice && MQ.Voice.has(text)) return
  MQ.Voice.play(text).catch(() => ttsSpeak(text))`; else existing TTS. `say()` still sets
  the bubble text. No other call sites change.
- **`js/voice-recorder.js`** — "🎙️ Dad's voice" panel on `replay.html`. Lists each line;
  per line: **Record / Play / Re-record / Clear** + a recorded ✓. Captures mic via
  `getUserMedia` → ScriptProcessor PCM → downsample to 16 kHz mono → 16-bit WAV; clips
  held in **IndexedDB** (`mq_voice` store) so recording can span sessions. **"Export voice
  pack (.zip)"** builds a STORE-method zip of `<slug>.wav` + a populated
  `voice-manifest.json`. Optional **Import** reloads a prior pack for editing. A
  "Use Dad's voice in the game" on/off toggle writes `mq_voice`.

## Data & files

- `voice/voice-manifest.json` ships as `{ "v": 1, "lines": {} }` (empty → all TTS, no 404s).
- Export / on-server form: `{ "v":1, "rate":16000, "lines": { "beautiful":"beautiful.wav", … } }`
  plus the `<slug>.wav` files, all under `public_html/voice/`.
- Manifest only lists lines actually recorded; unrecorded lines stay TTS.

## Deploy / workflow

1. Dad opens `replay.html` → 🎙️ Dad's voice → allow mic → record lines (play/re-record).
2. **Export voice pack (.zip)** → upload to `public_html/voice/` → Extract (same flow as
   the game). The on-server `voice-manifest.json` now lists his clips.
3. Game plays his clips (network-first SW serves the fresh manifest online; offline
   devices refresh when next online). Bump `sw.js CACHE_VERSION` on a big change.

## Error handling

- Empty/missing manifest, 404 clip, mic denied, or voice off → silent TTS fallback.
- iOS: voice player primed on the Play-button gesture that already unlocks `MQ.sounds`.
- Recording requires HTTPS (have it) and a mic; the panel shows a clear message if denied.

## Files to change

New: `js/voice-lines.js`, `js/voice.js`, `js/voice-recorder.js`, `voice/voice-manifest.json`.
Modified: `js/narrator.js` (try Voice first), `index.html` (load voice-lines.js + voice.js
before narrator.js; prime voice on `#play-btn`), `replay.html` (🎙️ section + load
voice-lines.js + voice-recorder.js), `sw.js` (precache new JS + manifest, bump to v3).

## Verification

- Headless Edge, seeded `voice/voice-manifest.json` + a tiny generated WAV for one praise
  line: assert that line plays the **clip** (spy on Audio/`play`) and an unrecorded line
  uses TTS. Toggle off → clip skipped.
- Recorder with Playwright fake mic (`--use-fake-device-for-media-stream`): record a line,
  Export, assert the downloaded `.zip` contains `<slug>.wav` + a manifest listing it.
- Re-run adventure + PWA suites (no regressions). Self-hosted font/SW unaffected.

## Risks / mitigations

- **Codec portability** → WAV (no codec dependency); 16 kHz mono keeps the pack to a few MB
  (~18 clips × 1–3 s).
- **Text edits break the key** → keep `LINES` the single source; if a line's wording changes
  in code, its clip silently falls back to TTS until re-recorded (acceptable).
- **Autoplay blocking on iOS** → prime on the Play gesture; fall back to TTS if play() rejects.
- **Recording is per-device; export is what makes it universal** — documented in the panel.
