/* Magic Quill — Unicorn Arcade (Phase 3: active play).
 *
 * A menu of quick, relaxed mini-games that add real interaction to the app.
 * Scores convert to star-dust (MQ.Economy), feeding the nursery loop.
 *
 * Three launch games on one shared Canvas engine:
 *   🌟 Star Catch   — DRAG the unicorn to catch falling stars
 *   🫧 Bubble Pop   — TAP rising bubbles (golden ones worth more)
 *   🦋 Peek-a-Boo   — TAP friends before they duck back into the flowers
 *
 * NO-FAIL BY DESIGN (research guardrail for this age): each round is a relaxed
 * ~30s timer, missing something just fades, and it always ends on a celebration
 * — never a "game over". Big targets, forgiving speeds, capped rewards.
 *
 * The engine draws entities as emoji on a <canvas> with requestAnimationFrame,
 * handles high-DPI scaling, pointer input, a score/time HUD, particle bursts and
 * the end screen. Each game is a small object plugged into it (exposed as
 * MQ.Arcade.games so the mechanics are unit-testable without a real canvas). */
window.MQ = window.MQ || {};

(function () {
  const N = MQ.narrator, S = MQ.sounds;
  const ROUND = 30;          // seconds per round
  const PTS_PER_DUST = 4;    // points needed per star-dust
  const MAX_DUST = 5;        // cap per round (keeps the economy meaningful)

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- engine state ---------- */
  const entities = [];
  const particles = [];
  const pointer = { x: 0, y: 0, down: false };
  let root, menuEl, playEl, canvas, ctx, hudScore, hudTime, titleEl, endEl, dustEl;
  let built = false, running = false, raf = 0, last = 0, game = null;
  let W = 0, H = 0, dpr = 1, score = 0, timeLeft = 0;

  /* api handed to each game (mechanics live here, drawing/loop in the engine) */
  const api = {
    w: 0, h: 0, now: 0, state: {}, entities: entities, pointer: pointer,
    rand: rand, pick: pick,
    add(e) { if (e.alive === undefined) e.alive = true; entities.push(e); return e; },
    addScore(n) { score += n; if (hudScore) hudScore.textContent = '⭐ ' + score; },
    burst: burst,
    hitTop(x, y, pred) {
      for (let i = entities.length - 1; i >= 0; i--) {
        const e = entities[i];
        if (pred && !pred(e)) continue;
        const dx = x - e.x, dy = y - e.y, rr = (e.r || 20) * 1.35;
        if (dx * dx + dy * dy <= rr * rr) return e;
      }
      return null;
    }
  };

  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };

  /* ---------- games ---------- */
  const starCatch = {
    id: 'star', name: 'Star Catch', icon: '🌟', intro: 'Catch the falling stars!',
    setup(a) { a.state.player = a.add({ x: a.w / 2, y: a.h - 46, r: 30, emoji: '🦄', kind: 'player' }); a.state.acc = 0; },
    update(a, dt) {
      const st = a.state;
      st.acc -= dt;
      if (st.acc <= 0) { st.acc = rand(0.55, 0.9); a.add({ x: rand(30, a.w - 30), y: -30, vy: rand(130, 210), r: 16, emoji: '⭐', kind: 'star' }); }
      const pl = st.player; pl.y = a.h - 46;
      for (const e of a.entities) {
        if (e.kind !== 'star') continue;
        if (e.y > pl.y - 36 && Math.abs(e.x - pl.x) < pl.r + e.r) { e.alive = false; a.addScore(1); a.burst(e.x, e.y); S.tick(0.7); }
        else if (e.y > a.h + 40) e.alive = false;
      }
    },
    onDown(a, x) { a.state.player.x = clamp(x, 24, a.w - 24); },
    onMove(a, x) { a.state.player.x = clamp(x, 24, a.w - 24); }
  };

  const bubblePop = {
    id: 'bubble', name: 'Bubble Pop', icon: '🫧', intro: 'Pop all the bubbles!',
    setup(a) { a.state.acc = 0; },
    update(a, dt) {
      const st = a.state;
      st.acc -= dt;
      if (st.acc <= 0) {
        st.acc = rand(0.35, 0.7);
        const gold = Math.random() < 0.18;
        a.add({ x: rand(30, a.w - 30), y: a.h + 30, vy: -rand(45, 95), vx: rand(-18, 18), r: gold ? 26 : rand(20, 32), emoji: gold ? '🟡' : '🫧', kind: 'bubble', gold: gold });
      }
      for (const e of a.entities) {
        if (e.kind !== 'bubble') continue;
        if (e.x < 20 || e.x > a.w - 20) e.vx = -(e.vx || 0); // bounce off the sides
        if (e.y < -40) e.alive = false;
      }
    },
    onDown(a, x, y) {
      const b = a.hitTop(x, y, (e) => e.kind === 'bubble');
      if (b) { b.alive = false; a.addScore(b.gold ? 3 : 1); a.burst(b.x, b.y); S.pop(); }
    }
  };

  const peekaboo = {
    id: 'peek', name: 'Peek-a-Boo', icon: '🦋', intro: 'Tap the friends before they hide!',
    setup(a) {
      const cols = 4, rows = 2, spots = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        spots.push({ x: (c + 0.5) / cols * a.w, y: (r + 0.45) / rows * a.h + 16, busy: false });
      }
      a.state.spots = spots; a.state.acc = 0;
    },
    update(a, dt) {
      const st = a.state;
      st.acc -= dt;
      if (st.acc <= 0) {
        st.acc = rand(0.5, 0.9);
        const free = st.spots.filter((s) => !s.busy);
        if (free.length) {
          const s = pick(free); s.busy = true;
          const f = a.add({ x: s.x, y: s.y, r: 24, emoji: pick(['🦋', '🐞', '🐰', '🐤', '🐸', '🐥']), kind: 'friend', life: rand(1.0, 1.6), scale: 0, spot: s });
          f.update = (e, d) => { e.life -= d; e.scale = Math.min(1, e.scale + d * 5); if (e.life <= 0) { e.alive = false; s.busy = false; } };
        }
      }
    },
    onDown(a, x, y) {
      const f = a.hitTop(x, y, (e) => e.kind === 'friend');
      if (f) { f.alive = false; if (f.spot) f.spot.busy = false; a.addScore(1); a.burst(f.x, f.y); S.letterDone(); }
    }
  };

  const GAMES = [starCatch, bubblePop, peekaboo];

  /* ---------- particles (sparkle bursts) ---------- */
  const BURST = ['✨', '⭐', '💖', '🌟'];
  function burst(x, y) {
    for (let i = 0; i < 7; i++) {
      const ang = (Math.PI * 2 * i) / 7 + Math.random();
      const sp = rand(80, 170);
      particles.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 60, life: rand(0.5, 0.9), emoji: pick(BURST), size: rand(14, 22) });
    }
  }

  /* ---------- engine loop ---------- */
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016);
    last = ts;
    timeLeft -= dt;
    api.w = W; api.h = H; api.now += dt;

    if (game.update) game.update(api, dt);
    for (const e of entities) {
      e.x += (e.vx || 0) * dt; e.y += (e.vy || 0) * dt;
      if (e.update) e.update(e, dt);
    }
    for (let i = entities.length - 1; i >= 0; i--) if (entities[i].alive === false) entities.splice(i, 1);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);

    draw();
    if (hudTime) hudTime.textContent = '⏱ ' + Math.max(0, Math.ceil(timeLeft));
    if (timeLeft <= 0) { endRound(); return; }
    raf = requestAnimationFrame(loop);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const e of entities) {
      const size = (e.r || 20) * 2 * (e.scale == null ? 1 : e.scale);
      if (size <= 0) continue;
      ctx.globalAlpha = e.alpha == null ? 1 : e.alpha;
      ctx.font = size + 'px serif';
      ctx.fillText(e.emoji, e.x, e.y);
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.font = (p.size || 16) + 'px serif';
      ctx.fillText(p.emoji, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- pointer ---------- */
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onDown(e) {
    if (!running) return;
    e.preventDefault();
    const p = pos(e); pointer.x = p.x; pointer.y = p.y; pointer.down = true;
    if (game && game.onDown) game.onDown(api, p.x, p.y);
  }
  function onMove(e) {
    if (!running) return;
    const p = pos(e); pointer.x = p.x; pointer.y = p.y;
    if (game && game.onMove) game.onMove(api, p.x, p.y);
  }
  function onUp() { pointer.down = false; }

  /* ---------- rounds ---------- */
  function resize() {
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const cssW = wrap.clientWidth || 320, cssH = wrap.clientHeight || 420;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = cssW; H = cssH; api.w = W; api.h = H;
  }

  function startGame(g) {
    game = g; score = 0; timeLeft = ROUND; last = 0;
    entities.length = 0; particles.length = 0;
    api.state = {}; api.now = 0;
    root.classList.add('playing');
    endEl.classList.remove('show');
    resize();
    if (hudScore) hudScore.textContent = '⭐ 0';
    if (hudTime) hudTime.textContent = '⏱ ' + ROUND;
    if (titleEl) titleEl.textContent = g.icon + ' ' + g.name;
    if (g.setup) g.setup(api);
    if (g.intro) N.speak(g.intro);
    running = true;
    raf = requestAnimationFrame(loop);
  }

  function endRound() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    const dust = Math.min(MAX_DUST, Math.floor(score / PTS_PER_DUST));
    if (dust > 0 && MQ.Economy) MQ.Economy.addStardust(dust);
    if (MQ.Pet) MQ.Pet.addGrowth(1);
    renderDust();
    S.fanfare();
    endEl.querySelector('.end-score').textContent = 'You got ' + score + '!';
    endEl.querySelector('.end-dust').textContent = dust > 0 ? ('+' + dust + ' ⭐ star-dust!') : 'Play again for star-dust!';
    endEl.classList.add('show');
    N.speak('Yay! You got ' + score + '! ' + (dust > 0 ? ('You earned ' + dust + ' star-dust!') : ''));
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    entities.length = 0; particles.length = 0;
    if (endEl) endEl.classList.remove('show');
  }

  /* ---------- DOM ---------- */
  function build() {
    root = document.getElementById('screen-arcade');
    root.innerHTML = '';

    const back = el('button', 'arcade-back', '⬅');
    back.setAttribute('aria-label', 'Back home');
    back.onclick = () => { S.pop(); stop(); if (MQ.Game) MQ.Game.show('title'); };
    root.appendChild(back);

    dustEl = el('div', 'stardust-counter');
    dustEl.appendChild(el('span', 'sd-star', '⭐'));
    dustEl.appendChild(el('span', 'sd-num', '0'));
    root.appendChild(dustEl);

    menuEl = el('div', 'arcade-menu');
    menuEl.appendChild(el('h2', 'arcade-heading', '🎮 Fun & Games'));
    const grid = el('div', 'arcade-grid');
    GAMES.forEach((g) => {
      const b = el('button', 'game-card');
      b.appendChild(el('span', 'emoji', g.icon));
      b.appendChild(el('span', 'label', g.name));
      b.onclick = () => { S.pop(); startGame(g); };
      grid.appendChild(b);
    });
    menuEl.appendChild(grid);
    root.appendChild(menuEl);

    playEl = el('div', 'arcade-play');
    const hud = el('div', 'arcade-hud');
    hudScore = el('span', 'hud-score', '⭐ 0');
    titleEl = el('span', 'hud-title', '');
    hudTime = el('span', 'hud-time', '⏱ ' + ROUND);
    hud.appendChild(hudScore); hud.appendChild(titleEl); hud.appendChild(hudTime);
    playEl.appendChild(hud);

    const wrap = el('div', 'arcade-canvas-wrap');
    canvas = document.createElement('canvas');
    canvas.className = 'arcade-canvas';
    wrap.appendChild(canvas);

    endEl = el('div', 'arcade-end');
    endEl.appendChild(el('div', 'end-title', '🎉'));
    endEl.appendChild(el('div', 'end-score', ''));
    endEl.appendChild(el('div', 'end-dust', ''));
    const again = el('button', 'arcade-again', 'Play again');
    again.onclick = () => { S.pop(); startGame(game); };
    const more = el('button', 'arcade-more', 'More games');
    more.onclick = () => { S.pop(); stop(); showMenu(); };
    endEl.appendChild(again); endEl.appendChild(more);
    wrap.appendChild(endEl);
    playEl.appendChild(wrap);
    root.appendChild(playEl);

    ctx = canvas.getContext('2d');
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('resize', () => { if (root.classList.contains('active') && root.classList.contains('playing')) resize(); });

    built = true;
  }

  function renderDust() {
    const span = dustEl && dustEl.querySelector('.sd-num');
    if (span) span.textContent = (MQ.Economy && MQ.Economy.getStardust && MQ.Economy.getStardust()) || 0;
  }

  function showMenu() {
    stop();
    root.classList.remove('playing');
    renderDust();
  }

  function open() {
    if (!built) build();
    if (MQ.Game) MQ.Game.show('arcade');
    showMenu();
  }

  MQ.Arcade = { open: open, games: GAMES };
})();
