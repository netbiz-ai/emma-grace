# Unicorn Nursery — Hatch & Care (Phase 1) — Design

_2026-06-18_

## Why

*Unicorn Academy: Magic Quill* teaches handwriting well but is "a tool with a mascot," lacking a reason to return. A verified deep-research pass (20 confirmed claims / 5 refuted; sources incl. Apple App Store, GitHub, CHI PLAY 2022, Self-Determination Theory, Common Sense Media, NN/g) found the dominant proven pattern for this audience (a 6-year-old girl, unicorn theme) is the **virtual-pet activity hub**: hatch an egg → care for a creature that visibly grows → dress-up / decorate / mini-games. *My Baby Unicorn* (~44M downloads, #1 US education game) is built on this. The retention engine is **visible growth + moods + small rewards** — not competition, and explicitly **not** guilt/neglect.

### Guardrails (from verification)
- **No guilt / neglect / "game over" / death.** Care meters decay gently and floor at a happy "a snack would be lovely" — always recoverable. (The "guilt drives retention" claim was refuted 0–3.)
- **Dress-up is not the hero** (refuted 0–3 as "top genre") — it is a later phase.

## Scope
- **Phase 1 (implemented):** Hatch ceremony + Care hub (feed / brush / play / tuck-in) + 3 gentle meters + visible growth (Baby → Little → Big) + star-dust earned from writing quests + a treat shop.
- **Phase 2 (implemented):** Dress-Up & Decorate studio — recolour mane & horn, toggle accessories (crown/bow/flower/shades/scarf/sparkles), decorate the stable. Open-ended, no win/lose; the live pet is the preview; the chosen look shows on every sprite (nursery, title, companion) and persists.
- **Phase 3 (implemented — addresses "the game is too static"):** Unicorn Arcade — a menu of relaxed, no-fail mini-games for active play. Launch set: 🌟 Star Catch (drag to catch falling stars), 🫧 Bubble Pop (tap rising bubbles, golden worth more), 🦋 Peek-a-Boo (tap friends before they hide). Scores convert to star-dust (≤5/round) feeding the nursery loop.
- **Phase 4 (future):** Touchable unicorn + drag-and-drop care + living world; hatch/collect more unicorns.

### Phase 3 notes
- `js/arcade.js` (`MQ.Arcade`) + `css/arcade.css`; new `#screen-arcade` and a "🎮 Play games" title tile; `sw.js` → v6.
- A single shared **Canvas + requestAnimationFrame engine** draws entities as emoji, handles high-DPI scaling, pointer input, particle bursts, the score/time HUD and the celebratory end screen. Each game is a compact object (`setup/update/onDown/onMove`) plugged into the engine and exposed via `MQ.Arcade.games` (keeps mechanics unit-testable without a real canvas).
- No-fail: ~30s timer, misses just fade, always ends on a celebration. Rewards via `MQ.Economy.addStardust` + `MQ.Pet.addGrowth`.

### Phase 2 notes
- `js/unicorn.js` now gives each sprite **unique gradient ids** (fixes a latent duplicate-id bug) and a `setLook(look)`; `MQ.setUnicornLook(look)` repaints all instances. Palettes live in `MQ.UnicornLook` (shared with the studio UI). Accessories are emoji `<text>` overlays toggled via `opacity`.
- `look = { mane, horn, accessories:[], decor:[] }` is stored in `mq_pet`; `MQ.Pet.getLook()` lets `game.js` paint the title/companion sprites on boot.
- The studio is a mode inside the nursery (`#screen-nursery.dressing`) that swaps the care UI for swatches/chips; the same pet is the live preview.

## How it works
- New **"🦄 My unicorn"** tile on the title screen opens `#screen-nursery`.
- **Hatch (one-time):** a glowing magic egg; tap 3× → sparkle burst → the baby unicorn (named from `profile.unicorn`, set in Quest 0) emerges.
- **Care hub:** Feed 🍎 / Brush ✨ / Play 🎈 / Tuck-in 😴 — each raises a meter, plays a chime, bursts sparkles, and the unicorn reacts. Tummy / Sparkle / Happy meters.
- **Growth:** care actions and completed quests add growth points; at thresholds the unicorn visibly scales up and the stage advances.
- **Mood:** reflects average meter — happy / calm / a little sleepy (never sad).
- **Economy:** `finishRun()` awards **star-dust** (3/quest, 1/adventure) shown on the complete screen; the nursery **Treat Shop** spends it. Care itself is always free.
- **Decay:** computed from `now − lastTs` on open, capped and floored at 28 (offline/PWA-safe).

## Architecture
- **`js/nursery.js`** (`MQ.Nursery`) — self-contained module; builds its own DOM in `#screen-nursery`; owns pet state in localStorage key **`mq_pet`**.
- **Bridges in `js/game.js`:** `MQ.Economy` (star-dust: get/add/spend) and `MQ.Game` (`show`, `unicornName`, `hasBow`). `MQ.Pet.addGrowth()` lets quests feed growth.
- **`js/unicorn.js`** gains `setStage(0|1|2)` (CSS scale).
- **`css/nursery.css`** — scene, egg/hatch, meters, care buttons, treat shop, sparkle burst, growth scaling.
- **`sw.js`** — cache bumped to `v4`; precaches `js/nursery.js` + `css/nursery.css`.

## Verification
A jsdom harness loaded the real modules and drove the full flow — 17/17 checks passed: bridges present, hatch after 3 taps, care raises/caps meters, growth accrues, shop spends star-dust and refuses when broke (no negative), stage reaches "big", decay floors at 28, state persists across opens. Manual browser pass (per repo convention): `npx -y http-server prototype -p 8080`, landscape tablet viewport.
