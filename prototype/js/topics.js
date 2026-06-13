/* Magic Quill — topic word packs (shared store).
 * A "topic" is a themed pack of words the child writes, each with a fun fact
 * the unicorn speaks as the payoff. Grown-ups author packs on the replay page;
 * the kid picks one after Play. Packs live in localStorage `mq_topics`
 * ({ v:1, topics:[{ id, name, icon, words:[{ word, fact }] }] }).
 *
 * The built-in "✨ Magic words" pack is NOT stored here — it is the existing
 * WORD_BANK + WORD_FX, handled specially by game.js. MQ.Topics.MAGIC is just
 * its picker descriptor.
 *
 * Words are canonical UPPERCASE (book-cased for display via MQ.wordDisplay).
 * Used by game.js (picker + runs) and topics-editor.js (authoring).
 */
window.MQ = window.MQ || {};

(function () {
  const KEY = 'mq_topics';
  const STORE_V = 1;
  const WORD_RE = /^[A-Za-z]{2,6}$/;   // 2–6 letters (canvas keeps them on one line)
  const MAX_FACT = 100;
  const NAME_MAX = 20;

  /* picker descriptor for the always-present built-in pack */
  const MAGIC = { id: 'magic', name: 'Magic words', icon: '✨' };

  /* curated emoji row for the editor's icon picker */
  const EMOJIS = ['🔭', '🔢', '🐢', '🚀', '🪐', '🌈', '🦕', '🐙',
                  '🍎', '🎨', '🎵', '🏰', '⚽', '🌍', '🦋', '🚂'];

  /* seeded on first run; fully editable/deletable afterwards. Words ≤6 letters,
   * facts ≤100 chars, deliberately exercising the newly-authored glyphs. */
  const STARTERS = [
    { id: 'science', name: 'Science', icon: '🔭', words: [
      { word: 'SPACE',  fact: 'Space is so big it never ends — that is where the stars and planets live!' },
      { word: 'ROCKET', fact: 'A rocket pushes fire down really hard so it can zoom up into space!' },
      { word: 'MAGNET', fact: 'A magnet can pull metal toward it without even touching it!' },
      { word: 'PLANET', fact: 'Earth is a planet, and it spins like a giant ball in space!' },
      { word: 'COMET',  fact: 'A comet is a ball of ice and dust with a long sparkly tail!' },
      { word: 'RIVER',  fact: 'A river is water that flows all the way down to the sea!' },
      { word: 'ICE',    fact: 'Ice is water that got so cold it turned nice and hard!' }
    ] },
    { id: 'maths', name: 'Maths', icon: '🔢', words: [
      { word: 'ONE',   fact: 'One is the very first number when you start to count!' },
      { word: 'TWO',   fact: 'Two eyes, two hands — two makes a pair!' },
      { word: 'THREE', fact: 'Three straight sides make a triangle!' },
      { word: 'FOUR',  fact: 'A square has four sides, all the same size!' },
      { word: 'FIVE',  fact: 'You have five fingers on one hand — count them!' },
      { word: 'SIX',   fact: 'A little insect has six legs!' },
      { word: 'SEVEN', fact: 'There are seven days in every week!' },
      { word: 'EIGHT', fact: 'A spider has eight legs to crawl with!' },
      { word: 'NINE',  fact: 'Nine comes right before ten!' },
      { word: 'TEN',   fact: 'Ten fingers and ten toes — count them all!' }
    ] },
    { id: 'animals', name: 'Animals', icon: '🐢', words: [
      { word: 'TURTLE', fact: 'A turtle carries its hard shell house around on its back!' },
      { word: 'ZEBRA',  fact: 'Every zebra has black and white stripes all of its own!' },
      { word: 'FOX',    fact: 'A fox has a big bushy tail and loves to pounce and play!' },
      { word: 'YAK',    fact: 'A yak has long shaggy hair to stay warm up in the mountains!' },
      { word: 'QUAIL',  fact: 'A quail is a little round bird that bobs along when it runs!' },
      { word: 'JAGUAR', fact: 'A jaguar is a big spotted cat that is really good at swimming!' },
      { word: 'PUPPY',  fact: 'A puppy is a baby dog that wags its tail when it is happy!' }
    ] }
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- validation ---------- */

  function validWord(w) {
    return typeof w === 'string' && WORD_RE.test(w.trim());
  }

  function validTopic(t) {
    if (!t || typeof t.name !== 'string') return false;
    const name = t.name.trim();
    if (name.length < 1 || name.length > NAME_MAX) return false;
    if (!t.icon || typeof t.icon !== 'string') return false;
    if (!Array.isArray(t.words) || t.words.length < 3) return false;
    for (const w of t.words) {
      if (!w || !validWord(w.word)) return false;
      if (w.fact != null && typeof w.fact === 'string' && w.fact.length > MAX_FACT) return false;
    }
    return true;
  }

  /* ---------- persistence (cached per page load) ---------- */

  let state = null; // { topics: [...], corrupt: bool }

  function persist(topics) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: STORE_V, topics: topics }));
      return true;
    } catch (e) { return false; }
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }

    if (raw == null) {
      // first ever run: seed the starter packs once
      const seeded = STARTERS.map(clone);
      persist(seeded);
      state = { topics: seeded, corrupt: false };
      return state;
    }

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    if (!parsed || !Array.isArray(parsed.topics)) {
      // corrupt/unreadable: fall back to starters IN MEMORY ONLY — never
      // auto-overwrite, so a grown-up's hand-made packs aren't clobbered by a
      // transient parse glitch. The editor warns and overwrites on first save.
      state = { topics: STARTERS.map(clone), corrupt: true };
      return state;
    }

    // keep only structurally-sound topics; per-word filtering happens at draw time
    const topics = parsed.topics.filter(function (t) {
      return t && typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.words);
    });
    state = { topics: topics, corrupt: false };
    return state;
  }

  function ensure() { return state || load(); }

  /* ---------- public API ---------- */

  function list() { return ensure().topics.map(clone); }

  function isCorrupt() { return ensure().corrupt; }

  function get(id) {
    if (id === MAGIC.id) return clone(MAGIC);
    const t = ensure().topics.find(function (x) { return x.id === id; });
    return t ? clone(t) : null;
  }

  function newId(name) {
    const ids = ensure().topics.map(function (t) { return t.id; });
    const base = (String(name || 'pack').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || 'pack';
    if (base !== MAGIC.id && ids.indexOf(base) < 0) return base;
    let n = 2;
    while (ids.indexOf(base + '-' + n) >= 0 || base + '-' + n === MAGIC.id) n++;
    return base + '-' + n;
  }

  /* insert or replace by id; persists. Returns the saved topic. */
  function upsert(topic) {
    const s = ensure();
    const t = clone(topic);
    if (!t.id) t.id = newId(t.name);
    const i = s.topics.findIndex(function (x) { return x.id === t.id; });
    if (i >= 0) s.topics[i] = t; else s.topics.push(t);
    persist(s.topics);
    s.corrupt = false; // a deliberate save supersedes any corrupt value
    return clone(t);
  }

  function remove(id) {
    const s = ensure();
    s.topics = s.topics.filter(function (x) { return x.id !== id; });
    persist(s.topics);
    s.corrupt = false;
    return true;
  }

  /* Fisher-Yates copy — per-topic shuffle bag (mirrors MQ.shuffledBank) */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  MQ.Topics = {
    MAGIC: MAGIC,
    EMOJIS: EMOJIS,
    STARTERS: STARTERS,
    WORD_MAX: 6,
    WORD_MIN: 2,
    FACT_MAX: MAX_FACT,
    NAME_MAX: NAME_MAX,
    validWord: validWord,
    validTopic: validTopic,
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
