/* Magic Quill — Adventure Playground Quest missions (shared store).
 * A "mission" sends the child on a real go-outside task ("Find something RED!").
 * She goes, comes back, taps which of a few pictured choices she found, then
 * WRITES that word with the quill — writing is the proof/payoff. Grown-ups author
 * missions on the replay page; the kid taps 🌞 Go outside! on the title screen.
 *
 * Missions live in localStorage `mq_adventures`
 * ({ v:1, missions:[{ id, name, icon, level, prompt, choices:[{ word, icon }] }] }).
 *
 * This is a deliberate sibling of topics.js — same store/validation/shuffle shape —
 * so the two modes stay independent. Choice words are canonical UPPERCASE
 * (book-cased for display via MQ.wordDisplay), 2–6 letters so they fit one canvas line.
 *
 * Used by game.js (picker + the adventure run) and adventures-editor.js (authoring).
 */
window.MQ = window.MQ || {};

(function () {
  const KEY = 'mq_adventures';
  const STORE_V = 1;
  const WORD_RE = /^[A-Za-z]{2,6}$/;   // 2–6 letters (canvas keeps them on one line)
  const NAME_MAX = 20;
  const PROMPT_MAX = 60;
  const CHOICES_MIN = 2;
  const CHOICES_MAX = 4;
  const LEVELS = [1, 2, 3];            // ⭐ little · ⭐⭐ · ⭐⭐⭐ big-kid

  /* curated emoji row for the editor's icon picker (mission + choice icons) */
  const EMOJIS = ['🔴', '🍃', '🐛', '☁️', '🔔', '🗺️', '🌈', '🌳',
                  '🌸', '🪨', '🐦', '⭐', '🐞', '🍂', '🌼', '🦋'];

  /* seeded on first run; fully editable/deletable afterwards. Every choice word
   * is 2–6 letters and uses only authored glyphs (full A–Z exists). */
  const STARTERS = [
    { id: 'red-hunt', name: 'Red Hunt', icon: '🔴', level: 1,
      prompt: 'Find something RED and bring it back!',
      choices: [ { word: 'ROSE', icon: '🌹' }, { word: 'BALL', icon: '🔴' }, { word: 'APPLE', icon: '🍎' } ] },
    { id: 'leaf-look', name: 'Leaf Look', icon: '🍃', level: 1,
      prompt: 'Go and find a leaf!',
      choices: [ { word: 'LEAF', icon: '🍃' }, { word: 'FERN', icon: '🌿' }, { word: 'GRASS', icon: '🌱' } ] },
    { id: 'bug-safari', name: 'Bug Safari', icon: '🐛', level: 2,
      prompt: 'Find a little bug — look down low!',
      choices: [ { word: 'ANT', icon: '🐜' }, { word: 'BEE', icon: '🐝' }, { word: 'BUG', icon: '🐛' } ] },
    { id: 'sky-spy', name: 'Sky Spy', icon: '☁️', level: 2,
      prompt: 'Look up! Find something in the sky!',
      choices: [ { word: 'BIRD', icon: '🐦' }, { word: 'CLOUD', icon: '☁️' }, { word: 'SUN', icon: '☀️' } ] },
    { id: 'sound-quest', name: 'Sound Quest', icon: '🔔', level: 3,
      prompt: 'Find something that makes a sound!',
      choices: [ { word: 'BELL', icon: '🔔' }, { word: 'BIRD', icon: '🐦' }, { word: 'WIND', icon: '🌬️' } ] },
    { id: 'treasure-map', name: 'Treasure Map', icon: '🗺️', level: 3,
      prompt: 'Hunt for a treasure to bring back!',
      choices: [ { word: 'ROCK', icon: '🪨' }, { word: 'STICK', icon: '🥢' }, { word: 'SHELL', icon: '🐚' } ] }
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- validation (mirrors topics.js) ---------- */

  function validWord(w) {
    return typeof w === 'string' && WORD_RE.test(w.trim());
  }

  function validChoice(c) {
    return c && validWord(c.word) && typeof c.icon === 'string' && c.icon.trim().length > 0;
  }

  function validMission(m) {
    if (!m || typeof m.name !== 'string') return false;
    const name = m.name.trim();
    if (name.length < 1 || name.length > NAME_MAX) return false;
    if (!m.icon || typeof m.icon !== 'string') return false;
    if (LEVELS.indexOf(m.level) < 0) return false;
    if (typeof m.prompt !== 'string') return false;
    const prompt = m.prompt.trim();
    if (prompt.length < 1 || prompt.length > PROMPT_MAX) return false;
    if (!Array.isArray(m.choices) || m.choices.length < CHOICES_MIN || m.choices.length > CHOICES_MAX) return false;
    for (const c of m.choices) { if (!validChoice(c)) return false; }
    return true;
  }

  /* ---------- persistence (cached per page load) ---------- */

  let state = null; // { missions: [...], corrupt: bool }

  function persist(missions) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: STORE_V, missions: missions }));
      return true;
    } catch (e) { return false; }
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }

    if (raw == null) {
      // first ever run: seed the starter missions once
      const seeded = STARTERS.map(clone);
      persist(seeded);
      state = { missions: seeded, corrupt: false };
      return state;
    }

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    if (!parsed || !Array.isArray(parsed.missions)) {
      // corrupt/unreadable: fall back to starters IN MEMORY ONLY — never
      // auto-overwrite, so a grown-up's hand-made missions aren't clobbered by a
      // transient parse glitch. The editor warns and overwrites on first save.
      state = { missions: STARTERS.map(clone), corrupt: true };
      return state;
    }

    // keep only structurally-sound missions; choice filtering happens at run time
    const missions = parsed.missions.filter(function (m) {
      return m && typeof m.id === 'string' && typeof m.name === 'string' && Array.isArray(m.choices);
    });
    state = { missions: missions, corrupt: false };
    return state;
  }

  function ensure() { return state || load(); }

  /* ---------- public API ---------- */

  function list() { return ensure().missions.map(clone); }

  function isCorrupt() { return ensure().corrupt; }

  function get(id) {
    const m = ensure().missions.find(function (x) { return x.id === id; });
    return m ? clone(m) : null;
  }

  function newId(name) {
    const ids = ensure().missions.map(function (m) { return m.id; });
    const base = (String(name || 'quest').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || 'quest';
    if (ids.indexOf(base) < 0) return base;
    let n = 2;
    while (ids.indexOf(base + '-' + n) >= 0) n++;
    return base + '-' + n;
  }

  /* insert or replace by id; persists. Returns the saved mission. */
  function upsert(mission) {
    const s = ensure();
    const m = clone(mission);
    if (!m.id) m.id = newId(m.name);
    const i = s.missions.findIndex(function (x) { return x.id === m.id; });
    if (i >= 0) s.missions[i] = m; else s.missions.push(m);
    persist(s.missions);
    s.corrupt = false; // a deliberate save supersedes any corrupt value
    return clone(m);
  }

  function remove(id) {
    const s = ensure();
    s.missions = s.missions.filter(function (x) { return x.id !== id; });
    persist(s.missions);
    s.corrupt = false;
    return true;
  }

  /* Fisher-Yates copy — adventure shuffle bag (mirrors MQ.Topics.shuffle) */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  MQ.Adventures = {
    EMOJIS: EMOJIS,
    STARTERS: STARTERS,
    LEVELS: LEVELS,
    WORD_MAX: 6,
    WORD_MIN: 2,
    PROMPT_MAX: PROMPT_MAX,
    NAME_MAX: NAME_MAX,
    CHOICES_MIN: CHOICES_MIN,
    CHOICES_MAX: CHOICES_MAX,
    validWord: validWord,
    validChoice: validChoice,
    validMission: validMission,
    load: load,
    list: list,
    get: get,
    isCorrupt: isCorrupt,
    upsert: upsert,
    remove: remove,
    newId: newId,
    shuffle: shuffle
  };
})();
