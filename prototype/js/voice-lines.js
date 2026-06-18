/* Magic Quill — recordable voice lines (shared registry).
 * The fixed, name-free lines a grown-up can record in their own voice. The game
 * speaks these exact strings, so we map an incoming line back to a stable id by
 * EXACT TEXT match — no fragile slugifying, and clip filenames stay tidy.
 *
 * Single source of truth for both the player (js/voice.js → narrator.js) and the
 * recorder (js/voice-recorder.js on replay.html). If a line's wording changes in
 * the game, update its `text` here too or its recording silently falls back to TTS.
 *
 * Every `text` below must match the literal the game passes to N.speak()/say():
 *   - praise/encourage come from narrator.js PRAISE / ENCOURAGE
 *   - scene lines are the variable-free say('…') calls in game.js
 */
window.MQ = window.MQ || {};

(function () {
  const LINES = [
    // praise (narrator.js PRAISE)
    { id: 'praise-beautiful', group: 'Praise', text: 'Beautiful!' },
    { id: 'praise-wonderful', group: 'Praise', text: 'Wonderful writing!' },
    { id: 'praise-youdidit',  group: 'Praise', text: 'You did it!' },
    { id: 'praise-amazing',   group: 'Praise', text: 'Amazing!' },
    { id: 'praise-sparkly',   group: 'Praise', text: 'Sparkly perfect!' },
    { id: 'praise-hooray',    group: 'Praise', text: 'Hooray!' },
    { id: 'praise-magical',   group: 'Praise', text: 'That was magical!' },
    // encouragement (narrator.js ENCOURAGE)
    { id: 'enc-almost',     group: 'Encouragement', text: 'Almost! Start at the sparkly dot.' },
    { id: 'enc-goodtry',    group: 'Encouragement', text: 'Good try! Follow the twinkly path.' },
    { id: 'enc-nearly',     group: 'Encouragement', text: 'Nearly there — try again from the dot!' },
    { id: 'enc-youcandoit', group: 'Encouragement', text: 'You can do it! Trace along the stars.' },
    // scene moments (fixed say('…') in game.js)
    { id: 'nudge-dot',       group: 'Story moments', text: 'Start at the sparkly dot!' },
    { id: 'demo-star',       group: 'Story moments', text: 'Watch the shooting star! Then you try!' },
    { id: 'hello',           group: 'Story moments', text: 'Oh! Hello... I am a baby unicorn. Who are you? Write your name with the magic quill, so we can be friends!' },
    { id: 'naming',          group: 'Story moments', text: 'Now I need a name! Tap the name you like best for me!' },
    { id: 'learn-today',     group: 'Story moments', text: 'What shall we learn today? Pick one!' },
    { id: 'adventure-today', group: 'Story moments', text: 'Where shall we adventure today? Pick one!' },
    { id: 'found-back',      group: 'Story moments', text: 'You are back! What did you find?' },
    // nursery (fixed, name-free lines in js/nursery.js)
    { id: 'nursery-egg',   group: 'Nursery', text: 'Tap the magic egg!' },
    { id: 'nursery-feed',  group: 'Nursery', text: 'Yummy! Thank you!' },
    { id: 'nursery-brush', group: 'Nursery', text: 'Ooh, so sparkly!' },
    { id: 'nursery-play',  group: 'Nursery', text: 'Wheee! That tickles!' },
    { id: 'nursery-sleep', group: 'Nursery', text: 'Nighty night...' },
    { id: 'nursery-poor',  group: 'Nursery', text: 'I need more star-dust. Let us write some words!' },
    { id: 'nursery-dress', group: 'Nursery', text: 'Make me beautiful!' }
  ];

  const byText = {};
  const byId = {};
  LINES.forEach(function (l) { byText[l.text] = l.id; byId[l.id] = l; });

  function idFor(text) {
    return (typeof text === 'string' && byText[text]) || null;
  }
  function get(id) { return byId[id] || null; }

  MQ.VoiceLines = {
    LINES: LINES,
    idFor: idFor,
    get: get,
    file: function (id) { return id + '.wav'; } // canonical clip filename for an id
  };
})();
