# Unicorn Academy: Magic Quill

A handwriting game for a young learner. A baby unicorn asks her to write her
name and magic words with a "magic quill" — words build up letter by letter on
ruled workbook lines, in book case ("Sun", "Moon"), with world effects as a
payoff (sunrise, rainbows, blooming meadows).

## Run

No build step — it's a static PWA. Serve the `prototype/` folder:

```sh
npx -y http-server prototype -p 8080 -c-1
```

Then open http://localhost:8080/. Designed for landscape tablets;
"add to home screen" gives a full-screen app.

## Layout

- `prototype/index.html` — single page, screens toggled by the game flow
- `prototype/js/letters.js` — letter stroke data (upper + lowercase, ball-and-stick)
- `prototype/js/tracer.js` — guided tracing engine (checkpoints along the stroke)
- `prototype/js/freehand.js` — freehand mode: $P point-cloud recognizer + size coaching
- `prototype/js/game.js` — quest flow state machine, whole-word writing canvas
- `prototype/js/words.js` — word bank and world-effect mapping
- `prototype/replay.html` — parent page: replays of recorded writing
- `docs/superpowers/specs/` — design notes

Progress is stored in `localStorage` (`mq_profile`).
