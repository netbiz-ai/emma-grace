/* Magic Quill — the baby unicorn.
 * A layered chibi SVG with animation states driven by CSS classes:
 *   idle | shy | happy | celebrate
 * createUnicorn(container) -> { el, setState(name), setBow(bool) }
 */
window.MQ = window.MQ || {};

MQ.createUnicorn = function (container) {
  const wrap = document.createElement('div');
  wrap.className = 'unicorn u-idle';
  wrap.innerHTML = `
<svg viewBox="0 0 200 180" class="unicorn-svg" aria-hidden="true">
  <defs>
    <linearGradient id="u-horn" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#ffd76b"/><stop offset="1" stop-color="#fff3c4"/>
    </linearGradient>
    <linearGradient id="u-mane" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff7eb6"/><stop offset="0.5" stop-color="#b89cff"/>
      <stop offset="1" stop-color="#7fd4ff"/>
    </linearGradient>
  </defs>

  <g class="u-body-group">
    <!-- tail -->
    <path class="u-tail" fill="url(#u-mane)"
      d="M 38 112 C 18 104 12 128 24 138 C 14 140 16 156 30 154 C 22 162 36 170 44 160 C 52 150 50 124 48 116 Z"/>

    <!-- back legs -->
    <rect x="58" y="128" width="14" height="34" rx="7" fill="#fdf3f8"/>
    <rect x="118" y="128" width="14" height="34" rx="7" fill="#fdf3f8"/>
    <!-- body -->
    <ellipse cx="96" cy="118" rx="52" ry="36" fill="#fff9fc"/>
    <!-- front legs -->
    <rect class="u-leg-front" x="76" y="132" width="14" height="34" rx="7" fill="#fff9fc"/>
    <rect class="u-leg-front2" x="100" y="132" width="14" height="34" rx="7" fill="#fff9fc"/>
    <!-- hooves -->
    <rect x="58" y="156" width="14" height="8" rx="4" fill="#e8c9f0"/>
    <rect x="118" y="156" width="14" height="8" rx="4" fill="#e8c9f0"/>
    <rect class="u-hoof-f" x="76" y="160" width="14" height="8" rx="4" fill="#e8c9f0"/>
    <rect class="u-hoof-f2" x="100" y="160" width="14" height="8" rx="4" fill="#e8c9f0"/>

    <g class="u-head-group">
      <!-- mane behind head -->
      <path fill="url(#u-mane)"
        d="M 124 28 C 108 18 92 24 88 42 C 80 38 70 46 74 58 C 64 60 62 74 72 80 L 96 86 L 130 60 Z"/>
      <!-- head -->
      <ellipse cx="134" cy="58" rx="34" ry="30" fill="#fff9fc"/>
      <!-- snout -->
      <ellipse cx="158" cy="68" rx="16" ry="12" fill="#ffeaf4"/>
      <ellipse cx="162" cy="66" rx="2.6" ry="3.6" fill="#e8a8c8"/>
      <!-- ear -->
      <path d="M 116 32 L 124 12 L 134 30 Z" fill="#fff9fc"/>
      <path d="M 119 29 L 124 18 L 129 28 Z" fill="#ffd7ea"/>
      <!-- horn -->
      <path class="u-horn" d="M 138 30 L 146 2 L 152 30 Z" fill="url(#u-horn)"/>
      <path d="M 140 24 L 150 20 M 141 16 L 149 13" stroke="#e8b84a" stroke-width="1.6" fill="none"/>
      <!-- mane fringe -->
      <path fill="url(#u-mane)"
        d="M 112 38 C 118 26 132 24 140 32 C 134 36 130 42 130 48 C 122 44 114 44 112 38 Z"/>
      <!-- eye (blinks) -->
      <g class="u-eye">
        <ellipse cx="140" cy="54" rx="6" ry="7.5" fill="#4a3650"/>
        <circle cx="142" cy="51" r="2.4" fill="#fff"/>
        <circle cx="138" cy="57" r="1.1" fill="#fff" opacity="0.8"/>
      </g>
      <path class="u-eye-lid" d="M 133 52 Q 140 46 147 52" stroke="#4a3650" stroke-width="2"
        fill="none" stroke-linecap="round" opacity="0"/>
      <!-- blush -->
      <ellipse cx="124" cy="68" rx="7" ry="4" fill="#ffc9dd" opacity="0.8"/>
      <!-- smile -->
      <path class="u-smile" d="M 150 76 Q 156 81 162 77" stroke="#d98bb0" stroke-width="2.2"
        fill="none" stroke-linecap="round"/>
      <!-- bow (reward sticker; hidden until earned) -->
      <g class="u-bow" opacity="0">
        <path d="M 108 26 C 100 18 88 22 92 32 C 94 38 102 38 108 34 C 114 38 122 38 124 32 C 128 22 116 18 108 26 Z"
          fill="#ff5f9e"/>
        <circle cx="108" cy="29" r="4" fill="#ffd1e4"/>
      </g>
    </g>

    <!-- body mane -->
    <path fill="url(#u-mane)" opacity="0.9"
      d="M 86 86 C 78 78 64 82 66 94 C 58 94 54 106 64 110 C 60 118 70 124 78 118 L 90 100 Z"/>
  </g>

  <!-- celebration stars (shown in celebrate state) -->
  <g class="u-stars">
    <path class="u-star s1" d="M 30 40 l 3 6 6 1 -4.5 4.5 1 6.5 -5.5 -3 -5.5 3 1 -6.5 L 21 47 l 6 -1 Z" fill="#ffe66b"/>
    <path class="u-star s2" d="M 170 20 l 2.4 4.8 4.8 0.8 -3.6 3.6 0.8 5.2 -4.4 -2.4 -4.4 2.4 0.8 -5.2 -3.6 -3.6 4.8 -0.8 Z" fill="#ffb3d4"/>
    <path class="u-star s3" d="M 180 120 l 2 4 4 0.7 -3 3 0.7 4.3 -3.7 -2 -3.7 2 0.7 -4.3 -3 -3 4 -0.7 Z" fill="#9be0ff"/>
  </g>
</svg>`;
  container.appendChild(wrap);

  return {
    el: wrap,
    setState(name) {
      wrap.classList.remove('u-idle', 'u-shy', 'u-happy', 'u-celebrate');
      wrap.classList.add('u-' + name);
    },
    setBow(on) {
      const bow = wrap.querySelector('.u-bow');
      if (bow) bow.style.opacity = on ? 1 : 0;
    }
  };
};
