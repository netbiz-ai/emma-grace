/* Magic Quill — Dad's-voice player (MQ.Voice).
 * Loads voice/voice-manifest.json and plays a recorded WAV clip for a line when
 * one exists. narrator.js calls has(text)/play(text); anything not recorded (or if
 * the voice is toggled off, or a clip fails) falls back to Web Speech TTS.
 *
 * Uses ONE shared <audio> element, primed on the first user gesture (unlock) so
 * iOS Safari allows the later programmatic plays. Clips are short; the network-first
 * service worker caches them after first play, so it works offline too.
 *
 * Also reads from IndexedDB ('mq-voice' store written by voice-recorder.js) so that
 * locally-recorded clips play immediately without an export/upload step.
 */
window.MQ = window.MQ || {};

(function () {
  const BASE = 'voice/';
  const MANIFEST = BASE + 'voice-manifest.json';

  let manifest = null;      // { v, rate, lines: { id: filename } }
  let idbClips = {};        // id -> Blob (from IndexedDB, no server upload needed)
  let audio = null;         // shared HTMLAudioElement
  let unlocked = false;

  function enabled() {
    try { return localStorage.getItem('mq_voice') !== 'off'; } catch (e) { return true; }
  }
  function setEnabled(on) {
    try { localStorage.setItem('mq_voice', on ? 'on' : 'off'); } catch (e) {}
  }

  function load() {
    return fetch(MANIFEST, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        manifest = (j && j.lines && typeof j.lines === 'object') ? j : { v: 1, lines: {} };
        return manifest;
      })
      .catch(function () { manifest = { v: 1, lines: {} }; return manifest; });
  }

  /* Warm in-memory cache of clips recorded via replay.html (voice-recorder.js).
   * Mirrors voice-recorder.js's open pattern (same name, version, store) so that
   * whichever module opens the DB first leaves a usable 'clips' store behind. */
  function loadIdb() {
    try {
      const req = indexedDB.open('mq-voice', 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains('clips')) {
          req.result.createObjectStore('clips');
        }
      };
      req.onsuccess = function () {
        const d = req.result;
        if (!d.objectStoreNames.contains('clips')) return;
        const tx = d.transaction('clips', 'readonly');
        const out = {};
        const cur = tx.objectStore('clips').openCursor();
        cur.onsuccess = function (e) {
          const c = e.target.result;
          if (c) { out[c.key] = c.value; c.continue(); } else { idbClips = out; }
        };
      };
    } catch (e) { /* IndexedDB unavailable — ignore */ }
  }

  function el() {
    if (!audio) { audio = new Audio(); audio.preload = 'auto'; }
    return audio;
  }

  /* call inside a user gesture (the Play tap) so iOS lets us play clips later */
  function unlock() {
    if (unlocked) return;
    const a = el();
    try {
      // a 44-byte silent WAV; playing it within the gesture user-activates the element
      a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
      const p = a.play();
      if (p && p.then) p.then(function () { a.pause(); a.currentTime = 0; }).catch(function () {});
      unlocked = true;
    } catch (e) { /* ignore */ }
  }

  function fileFor(text) {
    if (!manifest || !enabled() || !MQ.VoiceLines) return null;
    const id = MQ.VoiceLines.idFor(text);
    if (!id) return null;
    const f = manifest.lines[id];
    return (typeof f === 'string' && f) ? f : null;
  }

  function idbFor(text) {
    if (!enabled() || !MQ.VoiceLines) return null;
    const id = MQ.VoiceLines.idFor(text);
    return (id && idbClips[id]) ? idbClips[id] : null;
  }

  function has(text) { return !!fileFor(text) || !!idbFor(text); }

  function playAudio(src, isBlobUrl) {
    const a = el();
    return new Promise(function (resolve, reject) {
      let done = false;
      const finish = function (ok) {
        if (done) return; done = true;
        a.onended = a.onerror = null;
        if (isBlobUrl) URL.revokeObjectURL(src);
        ok ? resolve() : reject(new Error('clip failed'));
      };
      a.onended = function () { finish(true); };
      a.onerror = function () { finish(false); };
      try {
        a.pause();
        a.src = src;
        a.currentTime = 0;
        const p = a.play();
        if (p && p.catch) p.catch(function () { finish(false); });
      } catch (e) { finish(false); }
      // safety: clips are short — never hang the narration chain
      setTimeout(function () { finish(true); }, 9000);
    });
  }

  /* play the clip for `text`; resolves when it ends, rejects if it can't play
   * (so narrator can fall back to TTS). Interrupts any clip already playing.
   * Server manifest takes priority; locally-recorded IndexedDB clips are fallback. */
  function play(text) {
    const file = fileFor(text);
    if (file) return playAudio(BASE + file, false);
    const blob = idbFor(text);
    if (blob) return playAudio(URL.createObjectURL(blob), true);
    return Promise.reject(new Error('no clip'));
  }

  function stop() { if (audio) { try { audio.pause(); } catch (e) {} } }

  MQ.Voice = {
    load: load,
    loadIdb: loadIdb,
    has: has,
    play: play,
    stop: stop,
    unlock: unlock,
    enabled: enabled,
    setEnabled: setEnabled
  };

  load();    // warm the server manifest at startup
  loadIdb(); // warm locally-recorded clips from IndexedDB
})();
