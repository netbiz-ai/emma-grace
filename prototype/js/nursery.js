/* Magic Quill — Unicorn Nursery.
 *
 * Phase 1 — Hatch & Care: hatch a baby unicorn from a magic egg, then feed,
 *   brush, play with and tuck it in. It VISIBLY grows (Baby → Little → Big).
 *   Writing quests earn star-dust (MQ.Economy), spent here on treats.
 * Phase 2 — Dress-Up & Decorate studio: recolour the unicorn's mane and horn,
 *   add accessories (crown, bow, flowers, shades…) and decorate the stable.
 *   Open-ended, no win/lose; the live pet IS the preview.
 *
 * RELAXED BY DESIGN (research guardrail): meters drift down only gently over
 * real time and FLOOR at a happy "a snack would be lovely" — they never empty,
 * the unicorn never gets sad/sick, and there is no neglect/guilt/"game-over".
 *
 * Pet state lives in its own localStorage key `mq_pet`, owned entirely by this
 * module. It talks to the rest of the game through MQ.Economy (star-dust) and
 * MQ.Game (navigation + names), and drives the sprite via MQ.setUnicornLook. */
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
    poor:  'I need more star-dust. Let us write some words!',
    dress: 'Make me beautiful!',
    pet:   'Hehe! That tickles!'
  };

  const SHOP = [
    { icon: '🍰', label: 'Cake',    cost: 2, meter: 'tummy',   boost: 40, line: LINE.feed },
    { icon: '🫧', label: 'Bubbles', cost: 2, meter: 'sparkle', boost: 40, line: LINE.brush },
    { icon: '🎉', label: 'Party',   cost: 3, meter: 'happy',   boost: 40, growth: 3, line: LINE.play }
  ];

  /* dress-up options. Mane/horn colour palettes come from MQ.UnicornLook (single
   * source of truth, shared with the sprite). Accessory keys match the sprite's
   * data-acc attributes; décor keys match .decor-* scene elements below. */
  const ACCESSORIES = [
    { key: 'crown',  icon: '👑', label: 'Crown' },
    { key: 'bow',    icon: '🎀', label: 'Bow' },
    { key: 'flower', icon: '🌸', label: 'Flower' },
    { key: 'shades', icon: '🕶️', label: 'Shades' },
    { key: 'scarf',  icon: '🧣', label: 'Scarf' },
    { key: 'stars',  icon: '✨', label: 'Sparkles' }
  ];
  const DECOR = [
    { key: 'balloons', icon: '🎈' },
    { key: 'rainbow',  icon: '🌈' },
    { key: 'stars',    icon: '⭐' },
    { key: 'flowers',  icon: '🌷' },
    { key: 'teddy',    icon: '🧸' }
  ];
  const SWATCH = { // little preview gradient for a colour key
    mane: (cols) => 'linear-gradient(135deg,' + cols.join(',') + ')',
    horn: (cols) => 'linear-gradient(180deg,' + cols[1] + ',' + cols[0] + ')'
  };

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
  if (!pet.look || typeof pet.look !== 'object') pet.look = {};
  pet.look = Object.assign({ mane: 'rainbow', horn: 'gold', accessories: [], decor: [] }, pet.look);
  if (!Array.isArray(pet.look.accessories)) pet.look.accessories = [];
  if (!Array.isArray(pet.look.decor)) pet.look.decor = [];
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
  function applyLook() { if (MQ.setUnicornLook) MQ.setUnicornLook(pet.look); applyDecor(); }

  /* ---------- DOM ---------- */
  let root, eggEl, unicornHost, decorLayer, meterEls = {}, captionEl, dustEl, nightEl, studioEl, petUnicorn;
  let swatchBtns = { mane: {}, horn: {} }, chipBtns = { accessories: {}, decor: {} };
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

    const stage = el('div', 'nursery-stage');
    root.appendChild(stage);

    // a framed family photo on the nursery wall (cozy personal touch)
    const photo = document.createElement('figure');
    photo.className = 'nursery-photo';
    const pimg = document.createElement('img');
    pimg.src = 'img/family.jpg';
    pimg.alt = 'Our family';
    pimg.loading = 'lazy';
    photo.appendChild(pimg);
    stage.appendChild(photo);

    dustEl = el('div', 'stardust-counter');
    dustEl.appendChild(el('span', 'sd-star', '⭐'));
    dustEl.appendChild(el('span', 'sd-num', '0'));
    stage.appendChild(dustEl);

    captionEl = el('div', 'nursery-caption', '…');
    stage.appendChild(captionEl);

    const scene = el('div', 'nursery-scene');
    stage.appendChild(scene);

    decorLayer = el('div', 'nursery-decor');
    DECOR.forEach((d) => decorLayer.appendChild(el('span', 'decor-item decor-' + d.key, d.icon)));
    scene.appendChild(decorLayer);

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

    const dressBtn = el('button', 'nursery-dress-btn', '✨ Dress up!');
    dressBtn.onclick = () => { S.pop(); setDressing(true); };
    stage.appendChild(dressBtn);

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

    stage.appendChild(buildStudio());

    petUnicorn = MQ.createUnicorn(unicornHost);
    if (MQ.Game && MQ.Game.hasBow && MQ.Game.hasBow()) petUnicorn.setBow(true);
    unicornHost.style.cursor = 'pointer';
    unicornHost.addEventListener('pointerdown', petTap);

    built = true;
  }

  /* touchable unicorn: stroke/tap her and she reacts live */
  let petTaps = 0;
  function petTap() {
    if (!pet.hatched) return;
    petTaps++;
    burst(unicornHost);
    petUnicorn.setState('happy');
    bump('happy', 5);
    save();
    renderMeters();
    S.pop();
    if (petTaps % 4 === 1) { caption(LINE.pet); N.speak(LINE.pet); } // giggle, not every tap
    setTimeout(updateMood, 1200);
  }

  /* ---------- dress-up studio (Phase 2) ---------- */
  function buildStudio() {
    studioEl = el('div', 'nursery-studio');

    studioEl.appendChild(colourSection('Mane', 'mane'));
    studioEl.appendChild(colourSection('Horn', 'horn'));
    studioEl.appendChild(chipSection('Add', 'accessories', ACCESSORIES));
    studioEl.appendChild(chipSection('Stable', 'decor', DECOR));

    const done = el('button', 'studio-done', 'Done ✨');
    done.onclick = () => { S.pop(); setDressing(false); };
    studioEl.appendChild(done);
    return studioEl;
  }

  function colourSection(title, kind) {
    const sec = el('div', 'studio-section');
    sec.appendChild(el('div', 'studio-title', title));
    const row = el('div', 'studio-row');
    const palette = kind === 'mane' ? MQ.UnicornLook.MANE : MQ.UnicornLook.HORN;
    Object.keys(palette).forEach((key) => {
      const b = el('button', 'swatch');
      b.style.background = SWATCH[kind](palette[key]);
      b.setAttribute('aria-label', kind + ' ' + key);
      b.onclick = () => setColour(kind, key);
      swatchBtns[kind][key] = b;
      row.appendChild(b);
    });
    sec.appendChild(row);
    return sec;
  }

  function chipSection(title, group, items) {
    const sec = el('div', 'studio-section');
    sec.appendChild(el('div', 'studio-title', title));
    const row = el('div', 'studio-row');
    items.forEach((it) => {
      const b = el('button', 'chip');
      b.appendChild(el('span', 'chip-icon', it.icon));
      b.onclick = () => toggleChip(group, it.key);
      chipBtns[group][it.key] = b;
      row.appendChild(b);
    });
    sec.appendChild(row);
    return sec;
  }

  function setColour(kind, key) {
    pet.look[kind] = key;
    save();
    applyLook();
    S.pop();
    petUnicorn.setState('happy');
    refreshStudioSelection();
  }

  function toggleChip(group, key) {
    const list = pet.look[group];
    const i = list.indexOf(key);
    if (i >= 0) list.splice(i, 1); else list.push(key);
    save();
    applyLook();
    S.pop();
    if (group === 'accessories') petUnicorn.setState('happy');
    refreshStudioSelection();
  }

  function refreshStudioSelection() {
    ['mane', 'horn'].forEach((kind) => {
      Object.keys(swatchBtns[kind]).forEach((key) => {
        swatchBtns[kind][key].classList.toggle('selected', pet.look[kind] === key);
      });
    });
    ['accessories', 'decor'].forEach((group) => {
      Object.keys(chipBtns[group]).forEach((key) => {
        chipBtns[group][key].classList.toggle('on', pet.look[group].indexOf(key) >= 0);
      });
    });
  }

  function setDressing(on) {
    if (!root) return;
    root.classList.toggle('dressing', !!on);
    if (on) {
      petUnicorn.setState('happy');
      refreshStudioSelection();
      caption(LINE.dress); N.speak(LINE.dress);
    } else {
      updateMood();
    }
  }

  /* toggle the chosen décor on/off in the stable scene */
  function applyDecor() {
    if (!decorLayer) return;
    const on = pet.look.decor || [];
    DECOR.forEach((d) => {
      const node = decorLayer.querySelector('.decor-' + d.key);
      if (node) node.classList.toggle('on', on.indexOf(d.key) >= 0);
    });
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
    applyLook();
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
    if (!pet.hatched || root.classList.contains('dressing')) return;
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
    setDressing(false);
    pet.stage = stageFor(pet.growth);
    petUnicorn.setStage(pet.stage);
    applyLook();
    root.classList.toggle('is-hatched', !!pet.hatched);
    renderDust();
    renderMeters();
    refreshStudioSelection();
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

  /* writing quests feed growth too — game.js calls addGrowth() from finishRun().
   * getLook() lets game.js paint the title/companion sprites on boot. */
  MQ.Pet = {
    addGrowth: function (n) {
      if (!pet.hatched) return;
      pet.growth += (n || 0);
      save();
      if (built) checkGrowth();
    },
    getLook: function () { return pet.look; }
  };
})();
