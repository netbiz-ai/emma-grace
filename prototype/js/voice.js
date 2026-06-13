/* Magic Quill — Dad's-voice player (MQ.Voice).
 * Loads voice/voice-manifest.json and plays a recorded WAV clip for a line when
 * one exists. narrator.js calls has(text)/play(text); anything not recorded (or if
 * the voice is toggled off, or a clip fails) falls back to Web Speech TTS.
 *
 * Uses ONE shared <audio> element, primed on the first user gesture (unlock) so
 * iOS Safari allows the later programmatic plays. Clips are short; the network-first
 * service worker caches them after first play, so it works offline too.
 */
window.MQ = window.MQ || {};

(function () {
  const BASE = 'voice/';
  const MANIFEST = BASE + 'voice-manifest.json';

  let manifest = null;      // { v, rate, lines: { id: filename } }
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

  function has(text) { return !!fileFor(text); }

  /* play the clip for `text`; resolves when it ends, rejects if it can't play
   * (so narrator can fall back to TTS). Interrupts any clip already playing. */
  function play(text) {
    const file = fileFor(text);
    if (!file) return Promise.reject(new Error('no clip'));
    const a = el();
    return new Promise(function (resolve, reject) {
      let done = false;
      const finish = function (ok) {
        if (done) return; done = true;
        a.onended = a.onerror = null;
        ok ? resolve() : reject(new Error('clip failed'));
      };
      a.onended = function () { finish(true); };
      a.onerror = function () { finish(false); };
      try {
        a.pause();
        a.src = BASE + file;
        a.currentTime = 0;
        const p = a.play();
        if (p && p.catch) p.catch(function () { finish(false); });
      } catch (e) { finish(false); }
      // safety: clips are short — never hang the narration chain
      setTimeout(function () { finish(true); }, 9000);
    });
  }

  function stop() { if (audio) { try { audio.pause(); } catch (e) {} } }

  MQ.Voice = {
    load: load,
    has: has,
    play: play,
    stop: stop,
    unlock: unlock,
    enabled: enabled,
    setEnabled: setEnabled
  };

  load(); // warm the manifest at startup (narration happens after the Play tap)
})();
