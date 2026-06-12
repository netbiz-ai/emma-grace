/* Magic Quill — letter stroke data.
 * Coordinate space: viewBox 0 0 100 140.
 *   cap line y=15, midline y=62, baseline y=112.
 * Each glyph: ordered strokes, drawn in US-print (ball-and-stick) formation.
 * `path` is the guide the child traces; checkpoints are sampled along it.
 * Scales to all 26 letters later — just add entries.
 */
window.MQ = window.MQ || {};

MQ.LETTERS = {
  // ---- Quest 1: SUN ----
  'S': {
    display: 'S',
    sound: 'sss',
    strokes: [
      { path: 'M 71 32 C 67 18 36 16 31 32 C 26 47 44 54 51 58 C 60 63 74 72 69 90 C 64 107 32 107 28 91' }
    ]
  },
  'U': {
    display: 'U',
    sound: 'uh',
    strokes: [
      { path: 'M 30 15 L 30 78 C 30 104 70 104 70 78 L 70 15' }
    ]
  },
  'N': {
    display: 'N',
    sound: 'nnn',
    strokes: [
      { path: 'M 30 15 L 30 112' },
      { path: 'M 30 15 L 70 112' },
      { path: 'M 70 15 L 70 112' }
    ]
  },

  // ---- more magic words: MOON, STAR, RAIN, GROW ----
  'M': {
    display: 'M',
    sound: 'mmm',
    strokes: [
      { path: 'M 28 15 L 28 112' },
      { path: 'M 28 15 L 50 72' },
      { path: 'M 72 15 L 50 72' },
      { path: 'M 72 15 L 72 112' }
    ]
  },
  'O': {
    display: 'O',
    sound: 'oh',
    strokes: [
      { path: 'M 50 15 C 26 15 22 45 22 63 C 22 82 26 112 50 112 C 74 112 78 82 78 63 C 78 45 74 15 50 15' }
    ]
  },
  'T': {
    display: 'T',
    sound: 'tuh',
    strokes: [
      { path: 'M 28 15 L 72 15' },
      { path: 'M 50 15 L 50 112' }
    ]
  },
  'A': {
    display: 'A',
    sound: 'aah',
    strokes: [
      { path: 'M 50 15 L 28 112' },
      { path: 'M 50 15 L 72 112' },
      { path: 'M 36 75 L 64 75' }
    ]
  },
  'R': {
    display: 'R',
    sound: 'rrr',
    strokes: [
      { path: 'M 30 15 L 30 112' },
      { path: 'M 30 15 C 62 15 66 28 66 38 C 66 50 58 58 30 58' },
      { path: 'M 32 58 L 68 112' }
    ]
  },
  'I': {
    display: 'I',
    sound: 'ih',
    strokes: [
      { path: 'M 32 15 L 68 15' },
      { path: 'M 50 15 L 50 112' },
      { path: 'M 32 112 L 68 112' }
    ]
  },
  'W': {
    display: 'W',
    sound: 'wuh',
    strokes: [
      { path: 'M 22 15 L 36 112' },
      { path: 'M 50 28 L 36 112' },
      { path: 'M 50 28 L 64 112' },
      { path: 'M 78 15 L 64 112' }
    ]
  },

  // ---- word-bank letters ----
  'B': {
    display: 'B',
    sound: 'buh',
    strokes: [
      { path: 'M 30 15 L 30 112' },
      { path: 'M 30 15 C 62 15 66 26 66 38 C 66 50 60 62 30 62' },
      { path: 'M 30 62 C 66 62 70 74 70 87 C 70 100 64 112 30 112' }
    ]
  },
  'C': {
    display: 'C',
    sound: 'kuh',
    strokes: [
      { path: 'M 70 32 C 62 12 28 14 26 63 C 28 112 62 114 70 95' }
    ]
  },
  'D': {
    display: 'D',
    sound: 'duh',
    strokes: [
      { path: 'M 30 15 L 30 112' },
      { path: 'M 30 15 C 70 15 76 40 76 63 C 76 86 70 112 30 112' }
    ]
  },
  'F': {
    display: 'F',
    sound: 'fff',
    strokes: [
      { path: 'M 32 15 L 32 112' },
      { path: 'M 32 15 L 72 15' },
      { path: 'M 32 62 L 64 62' }
    ]
  },
  'H': {
    display: 'H',
    sound: 'hhh',
    strokes: [
      { path: 'M 28 15 L 28 112' },
      { path: 'M 72 15 L 72 112' },
      { path: 'M 28 62 L 72 62' }
    ]
  },
  'K': {
    display: 'K',
    sound: 'kuh',
    strokes: [
      { path: 'M 30 15 L 30 112' },
      { path: 'M 68 15 L 30 64' },
      { path: 'M 38 57 L 70 112' }
    ]
  },
  'L': {
    display: 'L',
    sound: 'lll',
    strokes: [
      { path: 'M 32 15 L 32 112' },
      { path: 'M 32 112 L 70 112' }
    ]
  },
  'P': {
    display: 'P',
    sound: 'puh',
    strokes: [
      { path: 'M 30 15 L 30 112' },
      { path: 'M 30 15 C 64 15 68 28 68 40 C 68 52 62 64 30 64' }
    ]
  },

  // ---- Quest 0: Emma-Grace ----
  'E': {
    display: 'E',
    sound: 'eh',
    strokes: [
      { path: 'M 32 15 L 32 112' },
      { path: 'M 32 15 L 72 15' },
      { path: 'M 32 62 L 66 62' },
      { path: 'M 32 112 L 72 112' }
    ]
  },
  'G': {
    display: 'G',
    sound: 'guh',
    strokes: [
      { path: 'M 73 34 C 66 14 30 16 27 50 C 24 88 36 110 58 108 C 72 106 75 95 75 78' },
      { path: 'M 75 78 L 52 78' }
    ]
  },
  'm': {
    display: 'm',
    sound: 'mmm',
    strokes: [
      { path: 'M 26 64 L 26 112' },
      { path: 'M 26 82 C 26 60 46 60 46 82 L 46 112' },
      { path: 'M 46 82 C 46 60 66 60 66 82 L 66 112' }
    ]
  },
  'a': {
    display: 'a',
    sound: 'aah',
    strokes: [
      { path: 'M 61 72 C 51 58 28 62 28 87 C 28 112 51 116 61 102' },
      { path: 'M 63 64 L 63 112' }
    ]
  },
  'r': {
    display: 'r',
    sound: 'rrr',
    strokes: [
      { path: 'M 31 64 L 31 112' },
      { path: 'M 31 84 C 31 64 53 60 61 70' }
    ]
  },
  'c': {
    display: 'c',
    sound: 'kuh',
    strokes: [
      { path: 'M 64 72 C 54 58 30 62 30 87 C 30 112 54 116 64 102' }
    ]
  },
  'e': {
    display: 'e',
    sound: 'eh',
    strokes: [
      { path: 'M 30 86 L 62 86 C 64 64 34 58 30 84 C 26 110 52 116 63 101' }
    ]
  },
  // ---- lowercase (book-case words: "Sun", "Moon" — non-initial letters) ----
  // x-height letters sit between midline 62 and baseline 112
  'n': {
    display: 'n',
    sound: 'nnn',
    strokes: [
      { path: 'M 30 64 L 30 112' },
      { path: 'M 30 84 C 30 60 68 60 68 84 L 68 112' }
    ]
  },
  'o': {
    display: 'o',
    sound: 'oh',
    strokes: [
      { path: 'M 50 62 C 28 62 25 77 25 87 C 25 103 36 112 50 112 C 64 112 75 103 75 87 C 75 77 72 62 50 62' }
    ]
  },
  's': {
    display: 's',
    sound: 'sss',
    strokes: [
      { path: 'M 66 72 C 62 60 38 60 35 71 C 32 81 46 84 51 87 C 57 90 68 93 65 103 C 62 113 37 112 34 102' }
    ]
  },
  'u': {
    display: 'u',
    sound: 'uh',
    strokes: [
      { path: 'M 30 64 L 30 92 C 30 112 60 111 64 96' },
      { path: 'M 64 64 L 64 112' }
    ]
  },
  'w': {
    display: 'w',
    sound: 'wuh',
    strokes: [
      { path: 'M 25 64 L 36 112 L 50 66 L 64 112 L 75 64' }
    ]
  },
  // ascenders reach the cap line 15
  'd': {
    display: 'd',
    sound: 'duh',
    strokes: [
      { path: 'M 62 72 C 52 58 28 62 28 87 C 28 112 52 116 62 102' },
      { path: 'M 64 15 L 64 112' }
    ]
  },
  'h': {
    display: 'h',
    sound: 'hhh',
    strokes: [
      { path: 'M 30 15 L 30 112' },
      { path: 'M 30 84 C 30 60 68 60 68 84 L 68 112' }
    ]
  },
  'k': {
    display: 'k',
    sound: 'kuh',
    strokes: [
      { path: 'M 30 15 L 30 112' },
      { path: 'M 62 64 L 30 91' },
      { path: 'M 41 82 L 64 112' }
    ]
  },
  'l': {
    display: 'l',
    sound: 'lll',
    strokes: [
      { path: 'M 50 15 L 50 112' }
    ]
  },
  't': {
    display: 't',
    sound: 'tuh',
    strokes: [
      { path: 'M 47 30 L 47 100 C 47 112 56 113 63 107' },
      { path: 'M 31 62 L 63 62' }
    ]
  },
  'i': {
    display: 'i',
    sound: 'ih',
    strokes: [
      { path: 'M 50 64 L 50 112' },
      { path: 'M 50 43 C 46 43 46 49 50 49 C 54 49 54 43 50 43' }
    ]
  },
  // descenders dip below the baseline
  'g': {
    display: 'g',
    sound: 'guh',
    strokes: [
      { path: 'M 62 72 C 52 58 28 62 28 87 C 28 112 52 116 62 102' },
      { path: 'M 64 64 L 64 120 C 64 136 45 139 36 130' }
    ]
  },
  'p': {
    display: 'p',
    sound: 'puh',
    strokes: [
      { path: 'M 30 64 L 30 138' },
      { path: 'M 30 81 C 30 58 68 61 68 87 C 68 113 38 114 30 95' }
    ]
  },
  '-': {
    display: '-',
    sound: 'a magic dash',
    isDash: true,
    strokes: [
      { path: 'M 34 64 L 66 64' }
    ]
  }
};

/* What the narrator says when each glyph appears.
 * Phonics sound-first, kept SHORT — long repeated prompts get boring fast. */
MQ.letterPrompt = function (glyph) {
  const d = MQ.LETTERS[glyph];
  if (!d) return 'Trace the letter!';
  if (d.isDash) return 'The magic dash! Swoosh left to right!';
  const name = d.display.toUpperCase() === d.display ? 'Big ' + d.display : 'Little ' + d.display;
  return d.sound + '! ' + name + '!';
};

/* Sequences */
MQ.NAME_SEQUENCE = ['E', 'm', 'm', 'a', '-', 'G', 'r', 'a', 'c', 'e'];
MQ.NAME_TEXT = 'Emma-Grace';
MQ.SUN_SEQUENCE = ['S', 'U', 'N'];
