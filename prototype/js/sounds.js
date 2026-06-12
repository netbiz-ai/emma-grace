/* Magic Quill — sound design via Web Audio.
 * Soft pentatonic chimes (no files needed) + a gentle generative music bed.
 * Everything is created lazily on first user gesture (autoplay policy).
 */
window.MQ = window.MQ || {};

(function () {
  let ctx = null;
  let musicOn = false;
  let musicTimer = null;
  let musicGain = null;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* one soft bell-like note */
  function note(freq, t0, dur, gain, type) {
    const c = ac();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  // C major pentatonic — everything always sounds sweet
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

  /* rising checkpoint tick — pitch climbs with progress through the stroke */
  function tick(progress) {
    const c = ac();
    if (!c) return;
    const idx = Math.min(PENTA.length - 1, Math.floor((progress || 0) * PENTA.length));
    note(PENTA[idx], c.currentTime, 0.18, 0.06);
  }

  function pop() {
    const c = ac();
    if (!c) return;
    note(740, c.currentTime, 0.12, 0.08, 'triangle');
  }

  /* letter complete — quick sparkly arpeggio */
  function letterDone() {
    const c = ac();
    if (!c) return;
    [0, 2, 4, 5].forEach((d, i) => note(PENTA[d], c.currentTime + i * 0.09, 0.35, 0.09));
  }

  /* quest complete — small fanfare */
  function fanfare() {
    const c = ac();
    if (!c) return;
    const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    seq.forEach((f, i) => note(f, c.currentTime + i * 0.14, 0.4, 0.1, i > 3 ? 'triangle' : 'sine'));
  }

  /* gentle dreamy music bed: slow pentatonic arpeggio, very quiet */
  function startMusic() {
    const c = ac();
    if (!c || musicTimer) return;
    musicGain = c.createGain();
    musicGain.gain.value = 0.035;
    musicGain.connect(c.destination);
    let step = 0;
    const pattern = [0, 2, 4, 2, 5, 4, 2, 1];
    musicTimer = setInterval(() => {
      if (!musicOn) return;
      const t = c.currentTime;
      const f = PENTA[pattern[step % pattern.length]] / 2; // an octave down
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g).connect(musicGain);
      o.start(t);
      o.stop(t + 1.8);
      step++;
    }, 900);
  }

  function toggleMusic(force) {
    musicOn = force !== undefined ? force : !musicOn;
    if (musicOn) startMusic();
    try { localStorage.setItem('mq_music', musicOn ? 'on' : 'off'); } catch (e) {}
    return musicOn;
  }

  function musicPref() {
    try { return localStorage.getItem('mq_music') !== 'off'; } catch (e) { return true; }
  }

  MQ.sounds = { tick, pop, letterDone, fanfare, toggleMusic, musicPref, unlock: ac };
})();
