/* Magic Quill — narrator: friendly voice for an early reader.
 * Wraps Web Speech API speechSynthesis. Cloud TTS / dad-recorded lines
 * are a planned upgrade — this module is the single swap point.
 */
window.MQ = window.MQ || {};

(function () {
  let voice = null;
  let ready = false;

  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return;
    // prefer warm natural English voices commonly available on tablets
    const prefer = [
      /natural.*(jenny|aria|emma|ana)/i,
      /(jenny|aria|samantha|karen|moira|tessa|ana)/i,
      /google (us|uk) english female/i,
      /google us english/i,
      /zira/i,
      /female/i
    ];
    for (const re of prefer) {
      const v = voices.find((v) => /^en/i.test(v.lang) && re.test(v.name));
      if (v) { voice = v; break; }
    }
    if (!voice) voice = voices.find((v) => /^en/i.test(v.lang)) || voices[0];
    ready = true;
  }

  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  /**
   * Speak a line. Returns a Promise resolving when speech ends
   * (or immediately if speech is unavailable).
   * opts: { rate, pitch, interrupt (default true) }
   */
  function speak(text, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) return resolve();
      if (opts.interrupt !== false) speechSynthesis.cancel();
      if (!ready) pickVoice();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = opts.rate || 0.92;   // a touch slow for a 6-year-old
      u.pitch = opts.pitch || 1.15; // bright and friendly
      u.onend = resolve;
      u.onerror = resolve;
      speechSynthesis.speak(u);
      // safety: resolve even if onend never fires (some Android quirks)
      setTimeout(resolve, Math.max(2500, text.length * 90));
    });
  }

  function stop() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  /* rotating encouragement so it never sounds like a broken record */
  const PRAISE = [
    'Beautiful!', 'Wonderful writing!', 'You did it!', 'Amazing!',
    'Sparkly perfect!', 'Hooray!', 'That was magical!'
  ];
  const ENCOURAGE = [
    'Almost! Start at the sparkly dot.', 'Good try! Follow the twinkly path.',
    'Nearly there — try again from the dot!', 'You can do it! Trace along the stars.'
  ];
  let praiseIdx = 0, encIdx = 0;
  function praise() { return PRAISE[praiseIdx++ % PRAISE.length]; }
  function encourage() { return ENCOURAGE[encIdx++ % ENCOURAGE.length]; }

  MQ.narrator = { speak, stop, praise, encourage };
})();
