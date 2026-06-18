/* Magic Quill — the living world.
 * Ambient life behind every screen so the whole app feels alive: drifting
 * clouds, fluttering butterflies and the occasional shooting star. Plus a bit of
 * tap-magic on the title screen — poke the sky and sparkles (and sometimes a
 * butterfly) flutter up.
 *
 * Cheap by design: clouds/butterflies are pure CSS animations (no JS loop); the
 * only JS timers are the rare shooting star and short-lived tap sparkles. The
 * layer is pointer-events:none, sits below the screens, and honours
 * prefers-reduced-motion (see css/living.css). */
window.MQ = window.MQ || {};

(function () {
  const S = MQ.sounds;
  const rand = (a, b) => a + Math.random() * (b - a);
  const SPK = ['✨', '⭐', '💖', '🌸', '🫧'];
  let layer = null, started = false;

  function init() {
    if (started) return;
    started = true;
    layer = document.createElement('div');
    layer.id = 'living';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);

    // drifting clouds
    for (let i = 0; i < 3; i++) {
      const c = document.createElement('span');
      c.className = 'cloud';
      c.textContent = '☁️';
      c.style.top = rand(5, 34).toFixed(1) + '%';
      c.style.fontSize = rand(40, 76).toFixed(0) + 'px';
      c.style.opacity = rand(0.7, 0.95).toFixed(2);
      c.style.animationDuration = rand(40, 72).toFixed(0) + 's';
      c.style.animationDelay = (-rand(0, 45)).toFixed(0) + 's';
      layer.appendChild(c);
    }

    // fluttering butterflies (wrapper wanders, inner span flaps)
    for (let i = 0; i < 2; i++) layer.appendChild(makeButterfly(rand(10, 78) + '%', rand(42, 74) + '%'));

    scheduleStar();

    const title = document.getElementById('screen-title');
    if (title) title.addEventListener('pointerdown', onTitleTap);
  }

  function makeButterfly(left, top) {
    const b = document.createElement('div');
    b.className = 'butterfly';
    b.style.left = left;
    b.style.top = top;
    b.style.fontSize = rand(20, 30).toFixed(0) + 'px';
    b.style.animationDuration = rand(10, 17).toFixed(0) + 's';
    b.style.animationDelay = (-rand(0, 9)).toFixed(1) + 's';
    const w = document.createElement('span');
    w.className = 'bw';
    w.textContent = '🦋';
    w.style.animationDuration = rand(0.4, 0.7).toFixed(2) + 's';
    b.appendChild(w);
    return b;
  }

  /* occasional shooting star, re-scheduling itself */
  function scheduleStar() {
    setTimeout(() => { shootingStar(); scheduleStar(); }, rand(9000, 20000));
  }
  function shootingStar() {
    if (!layer) return;
    const s = document.createElement('span');
    s.className = 'shoot';
    s.textContent = '🌠';
    s.style.top = rand(3, 28).toFixed(1) + '%';
    s.style.left = rand(8, 64).toFixed(1) + '%';
    s.style.fontSize = rand(22, 36).toFixed(0) + 'px';
    layer.appendChild(s);
    setTimeout(() => s.remove(), 1600);
  }

  /* tap the title's sky → sparkles + a chance of a butterfly */
  function onTitleTap(e) {
    if (e.target.closest && e.target.closest('button, a, figure, input, #title-unicorn')) return;
    sprinkle(e.clientX, e.clientY);
    if (Math.random() < 0.45) releaseButterfly(e.clientX, e.clientY);
    if (S && S.tick) { try { S.tick(rand(0.3, 0.9)); } catch (err) {} }
  }

  function sprinkle(x, y) {
    if (!layer) return;
    for (let i = 0; i < 6; i++) {
      const p = document.createElement('span');
      p.className = 'petal';
      p.textContent = SPK[Math.floor(Math.random() * SPK.length)];
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.fontSize = rand(14, 24).toFixed(0) + 'px';
      p.style.setProperty('--dx', rand(-55, 55).toFixed(0) + 'px');
      p.style.setProperty('--dy', rand(-95, -40).toFixed(0) + 'px');
      p.style.animationDelay = rand(0, 0.08).toFixed(2) + 's';
      layer.appendChild(p);
      setTimeout(() => p.remove(), 1200);
    }
  }

  function releaseButterfly(x, y) {
    if (!layer) return;
    const b = makeButterfly(x + 'px', y + 'px');
    b.classList.add('fly-up');
    b.style.setProperty('--fx', rand(-12, 14).toFixed(0) + 'vw');
    layer.appendChild(b);
    setTimeout(() => b.remove(), 4200);
  }

  MQ.Living = { init: init, sprinkle: sprinkle };
  document.addEventListener('DOMContentLoaded', init);
})();
