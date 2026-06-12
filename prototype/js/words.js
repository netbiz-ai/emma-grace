/* Magic Quill — the magic word bank.
 * Words are drawn at random via a shuffle bag (no repeats until the bag
 * empties). Five "hero" words keep bespoke world effects; every other word
 * gets a random payoff from GENERIC_FX.
 * All words use only authored glyphs: A B C D E F G H I K L M N O P R S T U W
 */
window.MQ = window.MQ || {};

MQ.WORD_FX = {
  SUN:  { sky: 'night', skyStages: ['dawn1', 'dawn2', 'day'],
          doneLine: 'You woke the whole meadow!' },
  MOON: { sky: 'day', skyStages: ['dawn2', 'dawn1', 'night', 'night'], payoffClass: 'moon-up',
          doneLine: 'You tucked the meadow into bed!' },
  STAR: { sky: 'night', stageFx: 'shoot', payoffClass: 'star-burst',
          doneLine: 'You filled the sky with twinkles!' },
  RAIN: { sky: 'day', stageClass: 'rain-level', payoffClass: 'rainbow-show', clearStageOnPayoff: true,
          doneLine: 'The flowers drank it all up — look, a rainbow!' },
  GROW: { sky: 'day', stageClass: 'bloom', payoffClass: 'bloom-all',
          doneLine: 'You made the whole meadow bloom!' }
};

/* random payoffs for non-hero words */
MQ.GENERIC_FX = [
  { sky: 'day',   payoffClass: 'rainbow-show' },
  { sky: 'day',   payoffClass: 'bloom-all' },
  { sky: 'night', payoffClass: 'star-burst', stageFx: 'shoot' },
  { sky: 'night', payoffClass: 'moon-up' },
  { sky: 'day' } // plain sparkle celebration
];

MQ.WORD_BANK = [
  // hero words
  'SUN', 'MOON', 'STAR', 'RAIN', 'GROW',
  // 3-letter
  'CAT', 'DOG', 'HAT', 'BAT', 'RAT', 'HEN', 'PIG', 'CUP', 'BUS',
  'RUN', 'SIT', 'HOP', 'BIG', 'RED', 'MOM', 'DAD', 'COW', 'OWL',
  'MAP', 'NET', 'BED', 'TOP', 'WIN',
  // 4-letter
  'SNOW', 'WIND', 'GOLD', 'PINK', 'FROG', 'FISH',
  'CLAP', 'HAND', 'LAMP', 'DRUM', 'CAKE'
];

/* book case for writing/display: 'SUN' → 'Sun' (bank keys stay uppercase) */
MQ.wordDisplay = function (word) {
  return word.charAt(0) + word.slice(1).toLowerCase();
};

MQ.shuffledBank = function () {
  const a = MQ.WORD_BANK.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
