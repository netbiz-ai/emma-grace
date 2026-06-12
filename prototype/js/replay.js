/* Magic Quill — parent stroke-replay viewer.
 * Lists recorded tracing attempts (localStorage mq_replays) and replays
 * the child's actual pointer trail at recorded timing over the letter guide.
 */
(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const list = document.getElementById('list');
  const stage = document.getElementById('stage');
  const playBtn = document.getElementById('play');
  const fastChk = document.getElementById('fast');

  let attempts = [];
  try { attempts = JSON.parse(localStorage.getItem('mq_replays') || '[]'); } catch (e) {}
  attempts = attempts.slice().reverse(); // newest first

  let selected = null;
  let raf = null;

  function fmtDur(ms) { return (ms / 1000).toFixed(1) + 's'; }

  function renderList() {
    if (!attempts.length) {
      list.innerHTML = '<div class="empty">No tracings recorded yet — once she plays, every attempt shows up here.</div>';
      return;
    }
    list.innerHTML = '';
    attempts.forEach((a, i) => {
      const div = document.createElement('div');
      div.className = 'attempt';
      const when = a.at ? new Date(a.at).toLocaleString() : '—';
      const badge = a.helped
        ? '<span class="badge helped">unicorn helped</span>'
        : (a.misses === 0 ? '<span class="badge clean">first try!</span>' : '');
      div.innerHTML =
        '<div class="g">' + (a.glyph || '?') + '</div>' +
        '<div class="meta">' + when + '<br>' +
        fmtDur(a.ms || 0) + ' · ' + (a.misses || 0) + ' retries' + badge + '</div>';
      div.onclick = () => select(i, div);
      list.appendChild(div);
    });
  }

  function select(i, el) {
    document.querySelectorAll('.attempt').forEach((d) => d.classList.remove('sel'));
    el.classList.add('sel');
    selected = attempts[i];
    drawGuide(selected.glyph);
    replay();
  }

  function drawGuide(glyph) {
    while (stage.firstChild) stage.removeChild(stage.firstChild);
    const data = window.MQ && MQ.LETTERS && MQ.LETTERS[glyph];
    if (data) {
      data.strokes.forEach((s) => {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', s.path);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', '#eadbf2');
        p.setAttribute('stroke-width', '12');
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        stage.appendChild(p);
      });
    }
  }

  function replay() {
    if (!selected || !selected.strokes || !selected.strokes.length) return;
    if (raf) cancelAnimationFrame(raf);
    // remove previous ink
    stage.querySelectorAll('.ink').forEach((e) => e.remove());
    const speed = fastChk.checked ? 2 : 1;
    const runs = selected.strokes;
    const t0 = performance.now();
    const startT = runs[0][0][0]; // first sample's timestamp

    const polys = runs.map(() => {
      const pl = document.createElementNS(SVG_NS, 'polyline');
      pl.setAttribute('fill', 'none');
      pl.setAttribute('stroke', '#ff7eb6');
      pl.setAttribute('stroke-width', '3.4');
      pl.setAttribute('stroke-linecap', 'round');
      pl.setAttribute('stroke-linejoin', 'round');
      pl.setAttribute('class', 'ink');
      stage.appendChild(pl);
      return pl;
    });

    function step(now) {
      const elapsed = (now - t0) * speed + startT;
      let allDone = true;
      runs.forEach((run, ri) => {
        const pts = run.filter((s) => s[0] <= elapsed);
        if (pts.length < run.length) allDone = false;
        polys[ri].setAttribute('points', pts.map((s) => s[1] + ',' + s[2]).join(' '));
      });
      if (!allDone) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
  }

  playBtn.onclick = replay;
  renderList();
})();
