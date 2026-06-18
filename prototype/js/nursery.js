/* Magic Quill — Unicorn Nursery (Phase 1: Hatch & Care).
 *
 * A cozy hub where the child hatches her very own baby unicorn from a magic egg,
 * then feeds, brushes, plays with and tucks it in. The unicorn VISIBLY grows
 * (Baby → Little → Big). Writing quests earn star-dust (MQ.Economy), spent here
 * on treats.
 *
 * RELAXED BY DESIGN (research guardrail): meters drift down only gently over real
 * time and FLOOR at a happy "a snack would be lovely" — they never empty, the
 * unicorn never gets sad/sick, and there is no neglect/guilt/"game-over". The
 * loop is all positive: growth, moods, rewards.
 *
 * Pet state lives in its own localStorage key `mq_pet`, owned entirely by this
 * module. It talks to the rest of the game only through two tiny bridges that
 * game.js publishes: MQ.Economy (star-dust) and MQ.Game (navigation + names).
 */
window.MQ = window.MQ || {};

(function () {
  const N = MQ.narrator, S = MQ.sounds;

  /* ---------- tuning (all gentle on purpose) ---------- */
  const FLOOR = 28;             // meters never decay below this — always recoverable
  const DECAY_PER_HOUR = 3;     // points lost per hour away
  const DECAY_CAP = 40;         // most a meter can ever drop in one absence
  const CARE_BOOST = 20;        // one care tap
  const SLEEP_BOOST = 14;       // tuck-in tops everything up a little
  const STAGE_AT = [0, 10, 24]; // growth points needed for Baby / Little / Big
  const STAGE_NAME = ['baby', 'little', 'big'];

  /* exact, name-free lines — mirrored in voice-lines.js so a grown-up can record
   * them in their own voice (otherwise they fall back to TTS). */
  const LINE = {
    egg:   'Tap the magic egg!',
    feed:  'Yummy! Thank you!',
    brush: 'Ooh, so sparkly!',
    play:  'Wheee! That tickles!',
    sleep: 'Nighty night...',
    poor:  'I need more star-dust. Let us write some words!'
  };

  const SHOP = [
    { icon: '🍰', label: 'Cake',    cost: 2, meter: 'tummy',   boost: 40, line: LINE.feed },
    { icon: '🫧', label: 'Bubbles', cost: 2, meter: 'sparkle', boost: 40, line: LINE.brush },
    { icon: '🎉', label: 'Party',   cost: 3, meter: 'happy',   boost: 40, growth: 3, line: LINE.play }
  ];

  /* ---------- pet state (mq_pet) ---------- */
  function load() {
    try {
      const p = JSON.parse(localStorage.getItem('mq_pet') || '{}');
      if (p && typeof p === 'object') return p;
    } catch (e) {}
    return {};
  }
  const pet = Object.assign(
    { hatched: false, stage: 0, growth: 0, meters: { tummy: 70, sparkle: 70, happy: 70 }, lastTs: Date.now() },
    load()
  );
  if (!pet.meters || typeof pet.meters !== 'object') pet.meters = { tummy: 70, sparkle: 70, happy: 70 };
  function save() { try { localStorage.setItem('mq_pet', JSON.stringify(pet)); } catch (e) {} }

  const clamp = (v) => Math.max(0, Math.min(100, v));
  function bump(key, n) { pet.meters[key] = clamp((pet.meters[key] || 0) + n); }
  function avg() { const m = pet.meters; return (m.tummy + m.sparkle + m.happy) / 3; }
  function stageFor(g) { let s = 0; for (let i = 0; i < STAGE_AT.length; i++) if (g >= STAGE_AT[i]) s = i; return s; }

  /* gentle, capped, floored decay since the last visit (offline/PWA-safe) */
  function applyDecay() {
    const now = Date.now();
    const hours = Math.max(0, (now - (pet.lastTs || now)) / 3600000);
    if (hours > 0.05) {
      const drop = Math.min(DECAY_CAP, hours * DECAY_PER_HOUR);
      ['tummy', 'sparkle', 'happy'].forEach((k) => {
        pet.meters[k] = Math.max(FLOOR, (pet.meters[k] || 0) - drop);
      });
    }
    pet.lastTs = now;
    save();
  }

  /* ---------- bridges to the rest of the game (read at call time) ---------- */
  function petName() { return (MQ.Game && MQ.Game.unicornName && MQ.Game.unicornName()) || 'your unicorn'; }
  function dust() { return (MQ.Economy && MQ.Economy.getStardust && MQ.Economy.getStardust()) || 0; }

  /* ---------- DOM ---------- */
  let root, eggEl, unicornHost, meterEls = {}, captionEl, dustEl, nightEl, petUnicorn;
  let built = false, eggTaps = 0;
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };

  function build() {
    root = document.getElementById('screen-nursery');
    root.innerHTML = '';

    const back = el('button', 'nursery-back', '⬅');
    back.setAttribute('aria-label', 'Back home');
    back.onclick = () => { S.pop(); if (MQ.Game) MQ.Game.show('title'); };
    root.appendChild(back);

    const stage = el('div', 'nursery-stage');
    root.appendChild(stage);

    dustEl = el('div', 'stardust-counter');
    dustEl.appendChild(el('span', 'sd-star', '⭐'));
    dustEl.appendChild(el('span', 'sd-num', '0'));
    stage.appendChild(dustEl);

    captionEl = el('div', 'nursery-caption', '…');
    stage.appendChild(captionEl);

    const scene = el('div', 'nursery-scene');
    stage.appendChild(scene);

    nightEl = el('div', 'nursery-night', '💤');
    scene.appendChild(nightEl);

    eggEl = el('button', 'nursery-egg', '🥚');
    eggEl.setAttribute('aria-label', 'Magic egg');
    eggEl.onclick = tapEgg;
    scene.appendChild(eggEl);

    unicornHost = el('div', 'nursery-unicorn');
    scene.appendChild(unicornHost);

    const meters = el('div', 'nursery-meters');
    [['tummy', '🍎'], ['sparkle', '✨'], ['happy', '🎈']].forEach(([k, icon]) => {
      const row = el('div', 'meter');
      row.appendChild(el('span', 'meter-icon', icon));
      const bar = el('div', 'meter-bar');
      const fill = el('div', 'meter-fill meter-' + k);
      bar.appendChild(fill);
      row.appendChild(bar);
      meterEls[k] = fill;
      meters.appendChild(row);
    });
    stage.appendChild(meters);

    const actions = el('div', 'nursery-actions');
    [['feed', '🍎', 'Feed'], ['brush', '✨', 'Brush'], ['play', '🎈', 'Play'], ['sleep', '😴', 'Sleep']]
      .forEach(([kind, icon, label]) => {
        const b = el('button', 'care-btn care-' + kind);
        b.appendChild(el('span', 'care-icon', icon));
        b.appendChild(el('span', 'care-label', label));
        b.onclick = () => care(kind);
        actions.appendChild(b);
      });
    stage.appendChild(actions);

    const shop = el('div', 'nursery-shop');
    shop.appendChild(el('div', 'shop-title', '✨ Star-dust treats ✨'));
    const shopRow = el('div', 'shop-row');
    SHOP.forEach((item) => {
      const b = el('button', 'shop-btn');
      b.appendChild(el('span', 'shop-icon', item.icon));
      b.appendChild(el('span', 'shop-label', item.label));
      b.appendChild(el('span', 'shop-cost', '⭐' + item.cost));
      b.onclick = () => buy(item);
      shopRow.appendChild(b);
    });
    shop.appendChild(shopRow);
    stage.appendChild(shop);

    petUnicorn = MQ.createUnicorn(unicornHost);
    if (MQ.Game && MQ.Game.hasBow && MQ.Game.hasBow()) petUnicorn.setBow(true);

    built = true;
  }

  /* ---------- hatch ceremony (one-time) ---------- */
  function tapEgg() {
    if (pet.hatched) return;
    eggTaps++;
    S.pop();
    eggEl.classList.remove('wiggle'); void eggEl.offsetWidth; eggEl.classList.add('wiggle');
    eggEl.classList.add('crack-' + Math.min(eggTaps, 3));
    if (eggTaps >= 3) hatch();
  }

  function hatch() {
    pet.hatched = true;
    pet.growth = Math.max(pet.growth, 1);
    pet.lastTs = Date.now();
    save();
    burst(unicornHost);
    S.fanfare();
    root.classList.add('is-hatched');
    petUnicorn.setStage(pet.stage || 0);
    petUnicorn.setState('shy');
    const hello = 'Meet your very own baby ' + petName() + '!';
    caption(hello); N.speak(hello);
    renderMeters();
    setTimeout(() => petUnicorn.setState('happy'), 1400);
    setTimeout(updateMood, 2800);
  }

  /* ---------- care actions ---------- */
  function care(kind) {
    if (!pet.hatched) return;
    if (kind === 'sleep') return sleep();
    S.letterDone();
    burst(unicornHost);
    petUnicorn.setState('happy');
    if (kind === 'feed') bump('tummy', CARE_BOOST);
    else if (kind === 'brush') bump('sparkle', CARE_BOOST);
    else if (kind === 'play') bump('happy', CARE_BOOST);
    pet.growth += 1;
    save();
    caption(LINE[kind]); N.speak(LINE[kind]);
    renderMeters();
    checkGrowth();
    setTimeout(updateMood, 1500);
  }

  function sleep() {
    nightEl.classList.add('on');
    petUnicorn.setState('idle');
    ['tummy', 'sparkle', 'happy'].forEach((k) => bump(k, SLEEP_BOOST));
    pet.growth += 1;
    save();
    caption(LINE.sleep); N.speak(LINE.sleep);
    renderMeters();
    setTimeout(() => {
      nightEl.classList.remove('on');
      petUnicorn.setState('happy');
      checkGrowth();
      updateMood();
    }, 2600);
  }

  /* ---------- treat shop (spends star-dust earned by writing) ---------- */
  function buy(item) {
    if (!MQ.Economy || !MQ.Economy.spendStardust(item.cost)) {
      caption(LINE.poor); N.speak(LINE.poor);
      return;
    }
    bump(item.meter, item.boost);
    if (item.growth) pet.growth += item.growth;
    save();
    S.letterDone();
    burst(unicornHost);
    petUnicorn.setState('celebrate');
    caption(item.line); N.speak(item.line);
    renderDust();
    renderMeters();
    checkGrowth();
    setTimeout(updateMood, 1600);
  }

  /* ---------- visible growth ---------- */
  function checkGrowth() {
    const s = stageFor(pet.growth);
    const grew = s > (pet.stage || 0);
    pet.stage = s;
    save();
    petUnicorn.setStage(s);
    if (grew) {
      petUnicorn.setState('celebrate');
      S.fanfare();
      burst(unicornHost);
      const msg = petName() + ' grew bigger! Now ' + petName() + ' is a ' + STAGE_NAME[s] + ' unicorn!';
      caption(msg); N.speak(msg);
    }
  }

  /* ---------- mood (positive only: happy / calm / a little sleepy) ---------- */
  function updateMood() {
    if (!pet.hatched) return;
    const a = avg();
    if (a >= 75) petUnicorn.setState('happy');
    else if (a >= 45) petUnicorn.setState('idle');
    else { petUnicorn.setState('shy'); caption('A snack would be lovely 🍎'); }
  }

  /* ---------- sparkle burst (DOM, over a host element) ---------- */
  const SPARKLES = ['✨', '⭐', '💖', '🌟', '🫧'];
  function burst(target) {
    const host = target || root;
    const layer = el('div', 'sparkle-burst');
    host.appendChild(layer);
    for (let i = 0; i < 8; i++) {
      const s = el('span', 'sparkle', SPARKLES[i % SPARKLES.length]);
      const ang = (Math.PI * 2 * i) / 8 + Math.random();
      const dist = 40 + Math.random() * 50;
      s.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
      s.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
      s.style.animationDelay = (Math.random() * 0.1).toFixed(2) + 's';
      layer.appendChild(s);
    }
    setTimeout(() => layer.remove(), 1200);
  }

  /* ---------- render helpers ---------- */
  function renderMeters() {
    ['tummy', 'sparkle', 'happy'].forEach((k) => {
      if (meterEls[k]) meterEls[k].style.width = clamp(pet.meters[k]) + '%';
    });
  }
  function renderDust() {
    const span = dustEl && dustEl.querySelector('.sd-num');
    if (span) span.textContent = dust();
  }
  function caption(t) {
    if (!captionEl) return;
    captionEl.textContent = t;
    captionEl.classList.remove('pop'); void captionEl.offsetWidth; captionEl.classList.add('pop');
  }

  /* ---------- entry ---------- */
  function open() {
    if (!built) build();
    applyDecay();
    pet.stage = stageFor(pet.growth);
    petUnicorn.setStage(pet.stage);
    root.classList.toggle('is-hatched', !!pet.hatched);
    renderDust();
    renderMeters();
    if (MQ.Game) MQ.Game.show('nursery');
    if (!pet.hatched) {
      eggTaps = 0;
      caption(LINE.egg); N.speak(LINE.egg);
    } else {
      const hi = 'Hello again! Let us play with ' + petName() + '!';
      caption(hi); N.speak(hi);
      updateMood();
    }
  }

  MQ.Nursery = { open: open };

  /* writing quests feed growth too — game.js calls this from finishRun().
   * Safe to call before the nursery is ever opened (just banks the points). */
  MQ.Pet = {
    addGrowth: function (n) {
      if (!pet.hatched) return;
      pet.growth += (n || 0);
      save();
      if (built) checkGrowth();
    }
  };
})();
