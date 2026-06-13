/* Magic Quill — quest flow state machine.
 * Quest 0 (first run): write your name to meet the unicorn, then name her.
 * Quest runs: THREE random magic words from the word bank (shuffle bag —
 * no repeats until every word has appeared), each with a world payoff.
 * Two writing modes: 'trace' (guided) and 'free' (her own handwriting).
 */
window.MQ = window.MQ || {};

(function () {
  const N = MQ.narrator, S = MQ.sounds;
  const WORDS_PER_RUN = 3;
  const STICKERS = ['🎀', '🌙', '⭐', '🌈', '🌻', '🦋', '👑', '💖', '🍓', '🌸', '🫧', '🐞'];

  /* ---------- profile ---------- */
  function loadProfile() {
    try { return JSON.parse(localStorage.getItem('mq_profile') || '{}'); }
    catch (e) { return {}; }
  }
  function saveProfile(p) {
    try { localStorage.setItem('mq_profile', JSON.stringify(p)); } catch (e) {}
  }
  const profile = Object.assign(
    { name: MQ.NAME_TEXT, unicorn: null, quest0Done: false, stickers: [], bag: [], bags: {}, mode: 'trace', advLevel: 1 },
    loadProfile()
  );

  /* ---------- dom ---------- */
  const $ = (sel) => document.querySelector(sel);
  const screens = {
    title: $('#screen-title'),
    trace: $('#screen-trace'),
    naming: $('#screen-naming'),
    topics: $('#screen-topics'),
    adventures: $('#screen-adventures'),
    mission: $('#screen-mission'),
    found: $('#screen-found'),
    complete: $('#screen-complete')
  };
  const sky = document.body;
  const bubble = $('#bubble');
  const wordRow = $('#word-row');
  const wordCanvas = $('#word-canvas');
  let unicorn = null;
  let engine = null;
  let lastMode = 'topic';     // which picker the complete screen returns to
  let currentMission = null;  // mission resolved at trip start (immune to mid-trip edits)

  function showScreen(name) {
    Object.keys(screens).forEach((k) => screens[k].classList.toggle('active', k === name));
  }

  function setSky(stage) { // night | dawn1 | dawn2 | day
    sky.classList.remove('sky-night', 'sky-dawn1', 'sky-dawn2', 'sky-day');
    sky.classList.add('sky-' + stage);
  }

  function say(text, opts) {
    bubble.textContent = text;
    bubble.classList.remove('bubble-pop');
    void bubble.offsetWidth;
    bubble.classList.add('bubble-pop');
    return N.speak(text, opts);
  }

  /* word/name progress row: one tile per glyph */
  function buildWordRow(seq, displayText) {
    wordRow.innerHTML = '';
    const chars = displayText ? displayText.split('') : seq;
    chars.forEach((ch) => {
      const t = document.createElement('span');
      t.className = 'tile';
      t.textContent = ch;
      wordRow.appendChild(t);
    });
  }
  function markTile(i, state) { // 'current' | 'done'
    const tiles = wordRow.children;
    if (!tiles[i]) return;
    if (state === 'done') tiles[i].classList.remove('current');
    tiles[i].classList.add(state);
  }

  /* whole-word canvas: one svg slot per glyph, so the word builds up in place.
   * Finished letters keep their ink (engines clear a slot only when they take
   * it over); waiting letters show a faint preview of the letterform. */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function drawPreview(svg, glyph) {
    const d = MQ.LETTERS[glyph];
    if (!d) return;
    d.strokes.forEach((s) => {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', s.path);
      p.setAttribute('class', 'slot-preview');
      svg.appendChild(p);
    });
  }
  function buildWordCanvas(seq) {
    wordCanvas.innerHTML = '';
    const lines = [];
    if (seq.length > 6) { // long sequences wrap: after the dash if there is one
      const dash = seq.indexOf('-');
      const cut = dash >= 0 ? dash + 1 : Math.ceil(seq.length / 2);
      lines.push(seq.slice(0, cut), seq.slice(cut));
    } else {
      lines.push(seq);
    }
    const slots = [];
    lines.forEach((line) => {
      const row = document.createElement('div');
      row.className = 'word-line';
      row.style.setProperty('--n', line.length);
      line.forEach((glyph) => {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'slot');
        svg.setAttribute('viewBox', '0 0 100 140');
        drawPreview(svg, glyph);
        row.appendChild(svg);
        slots.push(svg);
      });
      wordCanvas.appendChild(row);
    });
    return slots;
  }

  /* ---------- world effects ---------- */
  const FX_CLASSES = ['moon-up', 'star-burst', 'rainbow-show', 'bloom-all',
    'rain-level-1', 'rain-level-2', 'rain-level-3', 'rain-level-4',
    'bloom-1', 'bloom-2', 'bloom-3', 'bloom-4'];
  function clearFx() { FX_CLASSES.forEach((c) => sky.classList.remove(c)); }

  function spawnShootingStar() {
    const s = document.createElement('div');
    s.className = 'shooting-star';
    s.style.top = (5 + Math.random() * 35) + '%';
    s.style.left = (5 + Math.random() * 55) + '%';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1400);
  }

  /* ---------- writing a sequence of glyphs (trace OR freehand) ---------- */
  function writeSequence(seq, hooks) {
    hooks = hooks || {};
    let i = 0;
    const shared = { heights: [] }; // size consistency across the word
    const slots = buildWordCanvas(seq);
    return new Promise((resolveAll) => {
      function nextGlyph() {
        if (i >= seq.length) return resolveAll();
        const glyph = seq[i];
        markTile(i, 'current');
        slots.forEach((s, k) => s.classList.toggle('active', k === i));
        const free = profile.mode === 'free' && !hooks.forceTrace && MQ.Freehand;
        const d = MQ.LETTERS[glyph];
        const size = glyph === glyph.toUpperCase() ? 'big' : 'little';
        const prompt = free
          ? (glyph === '-' ? 'Write the magic dash!' : 'Write a ' + size + ' ' + glyph + '! ' + d.sound + '!')
          : MQ.letterPrompt(glyph);
        // first letter: surface the writing area right away, prompt after the intro line
        if (i === 0 && hooks.intro) hooks.intro.then(() => say(prompt));
        else say(prompt);
        if (engine) engine.destroy();
        let nudgedAt = 0;
        const cb = {
          onCheckpoint: (idx, total) => S.tick(idx / total),
          onStrokeComplete: () => S.pop(),
          onStrokeEnd: () => S.pop(),
          onMiss: () => { say(N.encourage()); },
          onFeedback: (text) => { say(text); },
          onNudge: () => {
            const now = Date.now();
            if (now - nudgedAt > 4000) { nudgedAt = now; say('Start at the sparkly dot!'); }
          },
          onDemo: () => { say('Watch the shooting star! Then you try!'); },
          onHelp: () => {
            say((profile.unicorn || 'Your unicorn') + ' sprinkles magic to help you!');
            unicorn && unicorn.setState('happy');
          },
          onGlyphComplete: () => {
            S.letterDone();
            markTile(i, 'done');
            slots[i].classList.remove('active');
            unicorn && unicorn.setState('happy');
            setTimeout(() => unicorn && unicorn.setState('idle'), 1200);
            const done = i;
            i++;
            const cont = () => setTimeout(nextGlyph, 350);
            if (hooks.onLetterDone) Promise.resolve(hooks.onLetterDone(done)).then(cont);
            else { N.speak(N.praise()); cont(); }
          }
        };
        engine = free ? new MQ.Freehand(slots[i], glyph, cb, shared) : new MQ.Tracer(slots[i], glyph, cb);
      }
      nextGlyph();
    });
  }

  /* ---------- quest 0: meet your unicorn (always traced) ---------- */
  async function quest0() {
    setSky('day');
    showScreen('trace');
    unicorn.setState('shy');
    buildWordRow(MQ.NAME_SEQUENCE, MQ.NAME_TEXT);
    const intro = say('Oh! Hello... I am a baby unicorn. Who are you? Write your name with the magic quill, so we can be friends!');
    await writeSequence(MQ.NAME_SEQUENCE, { forceTrace: true, intro: intro });
    unicorn.setState('celebrate');
    S.fanfare();
    await say(profile.name + '! What a beautiful name! I am so happy to meet you, ' + profile.name + '!');
    profile.quest0Done = true;
    saveProfile(profile);
    showNaming();
  }

  function showNaming() {
    showScreen('naming');
    unicorn.setState('happy');
    say('Now I need a name! Tap the name you like best for me!');
    document.querySelectorAll('.name-btn').forEach((btn) => {
      btn.onclick = async () => {
        S.pop();
        profile.unicorn = btn.dataset.name;
        saveProfile(profile);
        unicorn.setState('celebrate');
        await say(profile.unicorn + '! I love it! I am ' + profile.unicorn + ' the unicorn! Now, let us learn something fun!');
        showTopicPicker();
      };
    });
  }

  /* ---------- topic picker ("What shall we learn today?") ---------- */
  function showTopicPicker() {
    lastMode = 'topic';
    showScreen('topics');
    unicorn && unicorn.setState('happy');
    say('What shall we learn today? Pick one!');
    const grid = $('#topic-grid');
    grid.innerHTML = '';
    // Magic-words card first, then every grown-up-made pack
    const cards = [MQ.Topics.MAGIC].concat(MQ.Topics.list());
    cards.forEach((t) => {
      const btn = document.createElement('button');
      btn.className = 'topic-btn' + (t.id === MQ.Topics.MAGIC.id ? ' magic' : '');
      const emoji = document.createElement('span');
      emoji.className = 'emoji';
      emoji.textContent = t.icon || '✨';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = t.name;          // textContent: parent-typed, never HTML
      btn.appendChild(emoji);
      btn.appendChild(label);
      btn.onclick = () => { S.pop(); runQuest(t.id); };
      grid.appendChild(btn);
    });
  }

  /* ---------- word runs (magic bank OR a topic pack) ---------- */
  /* topic === null means the built-in magic-word bank */
  function resolveTopic(topicId) {
    if (!topicId || topicId === MQ.Topics.MAGIC.id) return null;
    const t = MQ.Topics.get(topicId);
    return t && Array.isArray(t.words) ? t : null; // unknown/empty pack → magic
  }

  function factFor(topic, word) {
    const entry = topic.words.find((w) => w.word === word);
    const f = entry && typeof entry.fact === 'string' ? entry.fact.trim() : '';
    return f || null;
  }

  function drawWords(n, topic) {
    if (!topic) {
      // magic words: shuffle bag over the whole bank (no repeats until empty)
      let bag = Array.isArray(profile.bag) ? profile.bag : [];
      const picks = [];
      while (picks.length < n) {
        if (!bag.length) bag = MQ.shuffledBank();
        picks.push(bag.shift());
      }
      profile.bag = bag;
      saveProfile(profile);
      return picks;
    }
    // topic pack: per-topic bag, re-filtered against the pack's CURRENT valid
    // words so mid-life parent edits (removed words) can't serve stale picks
    const valid = topic.words.map((w) => w.word).filter(MQ.Topics.validWord);
    if (valid.length < 1) return drawWords(n, null); // nothing usable → magic fallback
    if (!profile.bags || typeof profile.bags !== 'object') profile.bags = {};
    let bag = Array.isArray(profile.bags[topic.id]) ? profile.bags[topic.id] : [];
    bag = bag.filter((w) => valid.indexOf(w) >= 0);
    const picks = [];
    while (picks.length < n) {
      if (!bag.length) bag = MQ.Topics.shuffle(valid);
      picks.push(bag.shift());
    }
    profile.bags[topic.id] = bag;
    saveProfile(profile);
    return picks;
  }

  const INTROS = [
    'Quick, write {W}! {S}!',
    'A new magic word: {W}! {S}!',
    'The meadow needs the word {W}! {S}!',
    'Can you write {W}? {S}!'
  ];
  const DONES = [
    '{W}! Magic everywhere!',
    'You wrote {W}! Amazing!',
    '{W} makes the meadow sparkle!',
    'Wow! {W}! The meadow loves it!'
  ];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const soundOut = (seq) => seq.map((g) => MQ.LETTERS[g].sound).join('... ');

  async function runWord(word, topic) {
    const display = MQ.wordDisplay(word); // 'SUN' → 'Sun'; FX/bank keep uppercase keys
    const seq = display.split('');
    const fact = topic ? factFor(topic, word) : null;
    // topic words get a random visual; only magic-bank words keep bespoke WORD_FX
    const fx = (!topic && MQ.WORD_FX[word]) ? MQ.WORD_FX[word] : pick(MQ.GENERIC_FX);
    clearFx();
    setSky(fx.sky || 'day');
    showScreen('trace');
    unicorn.setState('idle');
    buildWordRow(seq);
    const intro = say(pick(INTROS).replace(/\{W\}/g, display).replace('{S}', soundOut(seq)));
    await writeSequence(seq, {
      intro: intro,
      onLetterDone: async (i) => {
        if (fx.skyStages) setSky(fx.skyStages[Math.min(i, fx.skyStages.length - 1)]);
        if (fx.stageClass) sky.classList.add(fx.stageClass + '-' + Math.min(i + 1, 4));
        if (fx.stageFx === 'shoot') { spawnShootingStar(); spawnShootingStar(); }
        N.speak(N.praise());
      }
    });
    // word payoff!
    if (fx.clearStageOnPayoff && fx.stageClass) {
      for (let i = 1; i <= 4; i++) sky.classList.remove(fx.stageClass + '-' + i);
    }
    if (fx.payoffClass) sky.classList.add(fx.payoffClass);
    if (fx.stageFx === 'shoot' || fx.payoffClass === 'star-burst') {
      for (let i = 0; i < 6; i++) setTimeout(spawnShootingStar, i * 160);
    }
    unicorn.setState('celebrate');
    S.fanfare();
    const doneLine = fact || fx.doneLine || pick(DONES).replace(/\{W\}/g, display);
    await say(seq.join(' ') + ' spells ' + display + '! ' + doneLine);
  }

  async function runQuest(topicId) {
    const topic = resolveTopic(topicId);          // resolved once — immune to mid-run edits
    const words = drawWords(WORDS_PER_RUN, topic);
    for (const w of words) await runWord(w, topic);
    finishRun(words);
  }

  /* award a sticker (new ones first, then repeats) and show the complete screen */
  function finishRun(words) {
    const unearned = STICKERS.filter((s) => !profile.stickers.includes(s));
    const sticker = unearned.length ? pick(unearned) : pick(STICKERS);
    if (!profile.stickers.includes(sticker)) profile.stickers.push(sticker);
    if (profile.stickers.includes('🎀')) unicorn.setBow(true);
    saveProfile(profile);
    showComplete(sticker, words);
  }

  /* ---------- Adventure Playground Quest (go-outside missions) ----------
   * 🌞 Go outside! → pick a mission → go do it → tap back → pick what you
   * found → WRITE that word (reuses writeSequence) → sticker. One mission =
   * one trip = one word. Missions live in MQ.Adventures (mq_adventures). */

  function showAdventurePicker() {
    lastMode = 'adventure';
    showScreen('adventures');
    unicorn && unicorn.setState('happy');
    say('Where shall we adventure today? Pick one!');
    const grid = $('#adventure-grid');
    grid.innerHTML = '';
    const level = profile.advLevel || 1;
    let missions = MQ.Adventures.list().filter((m) => (m.level || 1) <= level);
    if (!missions.length) missions = MQ.Adventures.list(); // never show an empty picker
    missions.forEach((m) => {
      const btn = document.createElement('button');
      btn.className = 'topic-btn';                // reuse the topic card styling
      const emoji = document.createElement('span');
      emoji.className = 'emoji';
      emoji.textContent = m.icon || '🌞';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = m.name;                 // textContent: parent-typed, never HTML
      const stars = document.createElement('span');
      stars.className = 'stars';
      stars.textContent = '⭐'.repeat(Math.max(1, Math.min(3, m.level || 1)));
      btn.appendChild(emoji);
      btn.appendChild(label);
      btn.appendChild(stars);
      btn.onclick = () => { S.pop(); startMission(m.id); };
      grid.appendChild(btn);
    });
  }

  function startMission(id) {
    const m = MQ.Adventures.get(id);              // resolved once — immune to mid-trip edits
    if (!m) { showAdventurePicker(); return; }
    currentMission = m;
    showScreen('mission');
    $('#mission-icon').textContent = m.icon || '🌞';
    $('#mission-prompt').textContent = m.prompt;  // textContent: parent free-text
    unicorn && unicorn.setState('happy');
    say(m.prompt);
  }

  function showFound(mission) {
    if (!mission) { showAdventurePicker(); return; }
    showScreen('found');
    unicorn && unicorn.setState('happy');
    say('You are back! What did you find?');
    const grid = $('#found-grid');
    grid.innerHTML = '';
    mission.choices.filter(MQ.Adventures.validChoice).forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'topic-btn';
      const emoji = document.createElement('span');
      emoji.className = 'emoji';
      emoji.textContent = c.icon || '✨';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = MQ.wordDisplay(c.word);
      btn.appendChild(emoji);
      btn.appendChild(label);
      btn.onclick = () => { S.pop(); runAdventureWrite(mission, c.word); };
      grid.appendChild(btn);
    });
  }

  async function runAdventureWrite(mission, word) {
    const display = MQ.wordDisplay(word);         // 'LEAF' → 'Leaf'
    const seq = display.split('');
    const fx = pick(MQ.GENERIC_FX);               // adventures always get a random payoff
    clearFx();
    setSky(fx.sky || 'day');
    showScreen('trace');
    unicorn.setState('idle');
    buildWordRow(seq);
    const intro = say('You found ' + display + '! Write it with the magic quill! ' + soundOut(seq) + '!');
    await writeSequence(seq, {
      intro: intro,
      onLetterDone: async () => { N.speak(N.praise()); }
    });
    // word payoff (same vocabulary as runWord's tail)
    if (fx.payoffClass) sky.classList.add(fx.payoffClass);
    if (fx.stageFx === 'shoot' || fx.payoffClass === 'star-burst') {
      for (let i = 0; i < 6; i++) setTimeout(spawnShootingStar, i * 160);
    }
    unicorn.setState('celebrate');
    S.fanfare();
    await say(seq.join(' ') + ' spells ' + display + '! You are a real adventurer, ' + profile.name + '!');
    finishRun([word]);
  }

  function showComplete(sticker, words) {
    showScreen('complete');
    $('#complete-sticker').textContent = sticker;
    $('#complete-msg').textContent = 'You wrote ' + words.map(MQ.wordDisplay).join(', ') + '!';
    $('#sticker-row').textContent = profile.stickers.join(' ');
    const adv = lastMode === 'adventure';
    $('#again-btn').textContent = adv ? '🌞 Adventure again!' : 'Play again!';
    N.speak((adv
      ? 'What an adventure! You earned a sticker for '
      : 'Three words! You earned a sticker for ') +
      (profile.unicorn || 'your unicorn') + '! Want to ' + (adv ? 'go again?' : 'write more?'));
  }

  /* ---------- writing mode toggle ---------- */
  function updateModeBtn() {
    const b = $('#mode-btn');
    if (!b) return;
    b.textContent = profile.mode === 'free' ? '⭐ All by myself!' : '✏️ With tracing';
  }

  /* ---------- boot ---------- */
  function boot() {
    unicorn = MQ.createUnicorn($('#unicorn-slot'));
    const titleUnicorn = MQ.createUnicorn($('#title-unicorn'));
    if (profile.stickers.includes('🎀')) { unicorn.setBow(true); titleUnicorn.setBow(true); }

    $('#title-heading').textContent = profile.quest0Done
      ? 'Welcome back, ' + profile.name + '!'
      : 'Unicorn Academy';

    setSky('day');
    updateModeBtn();

    $('#mode-btn').onclick = () => {
      profile.mode = profile.mode === 'free' ? 'trace' : 'free';
      saveProfile(profile);
      updateModeBtn();
      S.pop();
    };

    $('#play-btn').onclick = async () => {
      S.unlock();                       // user gesture: unlock audio + speech
      if (MQ.Voice) MQ.Voice.unlock();  // prime Dad's-voice player for iOS
      if (S.musicPref()) S.toggleMusic(true);
      if (!profile.quest0Done) {
        quest0();
      } else {
        if (profile.unicorn) await N.speak('Welcome back, ' + profile.name + '! ' + profile.unicorn + ' missed you!');
        showTopicPicker();
      }
    };

    $('#again-btn').onclick = () =>
      (lastMode === 'adventure' ? showAdventurePicker() : showTopicPicker());

    $('#adventure-btn').onclick = async () => {
      S.unlock();                       // user gesture: unlock audio + speech
      if (MQ.Voice) MQ.Voice.unlock();  // prime Dad's-voice player for iOS
      if (S.musicPref()) S.toggleMusic(true);
      if (!profile.quest0Done) { quest0(); return; }  // meet + name the unicorn first
      if (profile.unicorn) await N.speak('Adventure time, ' + profile.name + '! ' + profile.unicorn + ' is coming too!');
      showAdventurePicker();
    };

    $('#mission-go-btn').onclick = () => { S.pop(); showFound(currentMission); };

    $('#music-btn').onclick = (e) => {
      const on = S.toggleMusic();
      e.currentTarget.classList.toggle('off', !on);
    };
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
