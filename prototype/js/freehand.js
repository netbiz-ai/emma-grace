/* Magic Quill — freehand handwriting engine ("All by myself" mode).
 * No letter outline, no guides — just school-style writing lines.
 * The child writes the letter from memory; a $P point-cloud recognizer
 * (templates generated from the same stroke data in letters.js) checks
 * WHICH letter she wrote, and size rules coach consistent letter height.
 * After 3 unrecognized tries, falls back to guided tracing for that one
 * letter (never stuck), then freehand resumes on the next letter.
 */
window.MQ = window.MQ || {};

(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const N_PTS = 32;          // $P cloud size
  const CAP = 15, MID = 62, BASE = 112;   // writing lines (match letters.js)
  const EVAL_PAUSE_MS = 900; // quiet time after pen-up before judging
  const MISSES_BEFORE_RESCUE = 3;

  /* ---------------- $P point-cloud recognizer ---------------- */

  function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

  function pathLen(pts) {
    let d = 0;
    for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1], pts[i]);
    return d;
  }

  function resample(pts, n) {
    const I = pathLen(pts) / (n - 1);
    if (I === 0) return pts.slice(0, 1).concat(new Array(n - 1).fill(pts[0]));
    const src = pts.map((p) => ({ x: p.x, y: p.y }));
    const out = [{ x: src[0].x, y: src[0].y }];
    let D = 0;
    for (let i = 1; i < src.length; i++) {
      const d = dist(src[i - 1], src[i]);
      if (D + d >= I && d > 0) {
        const t = (I - D) / d;
        const q = { x: src[i - 1].x + t * (src[i].x - src[i - 1].x), y: src[i - 1].y + t * (src[i].y - src[i - 1].y) };
        out.push(q);
        src.splice(i, 0, q);
        D = 0;
      } else D += d;
    }
    while (out.length < n) out.push({ ...out[out.length - 1] });
    return out.slice(0, n);
  }

  function normalize(pts) {
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    pts.forEach((p) => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    const s = Math.max(maxX - minX, maxY - minY) || 1;
    const sc = pts.map((p) => ({ x: (p.x - minX) / s, y: (p.y - minY) / s }));
    let cx = 0, cy = 0;
    sc.forEach((p) => { cx += p.x; cy += p.y; });
    cx /= sc.length; cy /= sc.length;
    return sc.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  }

  function cloudDist(a, b, start) {
    const n = a.length;
    const matched = new Array(n).fill(false);
    let sum = 0, i = start;
    do {
      let min = 1e9, idx = -1;
      for (let j = 0; j < n; j++) {
        if (!matched[j]) {
          const d = dist(a[i], b[j]);
          if (d < min) { min = d; idx = j; }
        }
      }
      matched[idx] = true;
      const w = 1 - ((i - start + n) % n) / n;
      sum += w * min;
      i = (i + 1) % n;
    } while (i !== start);
    return sum;
  }

  function greedyMatch(a, b) {
    const step = Math.max(1, Math.floor(Math.sqrt(a.length)));
    let min = 1e9;
    for (let s = 0; s < a.length; s += step) {
      min = Math.min(min, cloudDist(a, b, s), cloudDist(b, a, s));
    }
    return min;
  }

  /* templates: sample each uppercase glyph's stroke paths once, lazily */
  let TEMPLATES = null;
  function buildTemplates() {
    if (TEMPLATES) return TEMPLATES;
    const holder = document.createElementNS(SVG_NS, 'svg');
    holder.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden');
    document.body.appendChild(holder);
    TEMPLATES = {};
    for (const [g, d] of Object.entries(MQ.LETTERS)) {
      if (!/^[A-Za-z]$/.test(g)) continue; // every authored letter, both cases
      const pts = [];
      d.strokes.forEach((s) => {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', s.path);
        holder.appendChild(p);
        const L = p.getTotalLength();
        const n = Math.max(8, Math.round(L / 6));
        for (let i = 0; i <= n; i++) {
          const q = p.getPointAtLength((L * i) / n);
          pts.push({ x: q.x, y: q.y });
        }
      });
      // expected box drives size coaching: lowercase letters are judged
      // against their own height/position, not cap-height rules
      let minY = 1e9, maxY = -1e9;
      pts.forEach((p) => { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
      TEMPLATES[g] = {
        cloud: normalize(resample(pts, N_PTS)),
        box: { minY: minY, maxY: maxY, h: maxY - minY }
      };
    }
    holder.remove();
    return TEMPLATES;
  }

  function recognize(strokes) {
    const flat = strokes.flat();
    if (flat.length < 6) return null;
    const cloud = normalize(resample(flat, N_PTS));
    const templates = buildTemplates();
    let best = null, bestD = 1e9;
    const scores = {};
    for (const [g, tpl] of Object.entries(templates)) {
      const d = greedyMatch(cloud, tpl.cloud);
      scores[g] = d;
      if (d < bestD) { bestD = d; best = g; }
    }
    return { best, bestD, scores };
  }

  /* ---------------- freehand input engine ---------------- */

  class Freehand {
    /**
     * Same contract as MQ.Tracer plus:
     *   cb.onFeedback(text) — coaching lines to narrate
     *   shared.heights[]    — accepted letter heights for this word
     *                         (size-consistency coaching across letters)
     */
    constructor(svg, glyph, cb, shared) {
      this.svg = svg;
      this.glyph = glyph;
      this.cb = cb || {};
      this.shared = shared || { heights: [] };
      this.strokes = [];
      this.misses = 0;
      this.destroyed = false;
      this.rescue = null;
      this.record = { glyph: glyph, at: Date.now(), strokes: [], misses: 0, helped: false, mode: 'free' };
      this._t0 = performance.now();
      this._build();
      this._bind();
    }

    _build() {
      const svg = this.svg;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', '0 0 100 140');
      const defs = document.createElementNS(SVG_NS, 'defs');
      defs.innerHTML =
        '<linearGradient id="mq-rainbow" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#ff7eb6"/><stop offset="0.3" stop-color="#ffb86b"/>' +
        '<stop offset="0.55" stop-color="#ffe66b"/><stop offset="0.8" stop-color="#7ee8a2"/>' +
        '<stop offset="1" stop-color="#8ab6ff"/></linearGradient>' +
        '<filter id="mq-glow" x="-60%" y="-60%" width="220%" height="220%">' +
        '<feGaussianBlur stdDeviation="2.2" result="b"/>' +
        '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
      svg.appendChild(defs);

      // school writing lines come from the word canvas (.word-line background)

      this.inkLayer = document.createElementNS(SVG_NS, 'g');
      svg.appendChild(this.inkLayer);
      this.sparkleLayer = document.createElementNS(SVG_NS, 'g');
      svg.appendChild(this.sparkleLayer);
    }

    _bind() {
      this._down = (e) => this._onDown(e);
      this._move = (e) => this._onMove(e);
      this._up = (e) => this._onUp(e);
      this.svg.addEventListener('pointerdown', this._down);
      this.svg.addEventListener('pointermove', this._move);
      this.svg.addEventListener('pointerup', this._up);
      this.svg.addEventListener('pointercancel', this._up);
    }

    destroy() {
      this.destroyed = true;
      clearTimeout(this._timer);
      this.svg.removeEventListener('pointerdown', this._down);
      this.svg.removeEventListener('pointermove', this._move);
      this.svg.removeEventListener('pointerup', this._up);
      this.svg.removeEventListener('pointercancel', this._up);
      if (this.rescue) this.rescue.destroy();
    }

    _pt(e) {
      const ctm = this.svg.getScreenCTM();
      if (!ctm) return null;
      return new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    }

    _onDown(e) {
      if (this.destroyed || this.rescue) return;
      clearTimeout(this._timer);
      const p = this._pt(e);
      if (!p) return;
      this.svg.setPointerCapture && this.svg.setPointerCapture(e.pointerId);
      this._cur = [{ x: p.x, y: p.y }];
      this._curSamples = [[Math.round(performance.now() - this._t0), Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]];
      this._curEl = document.createElementNS(SVG_NS, 'path');
      this._curEl.setAttribute('class', 'fh-ink');
      this._curEl.setAttribute('fill', 'none');
      this._curEl.setAttribute('d', 'M ' + p.x + ' ' + p.y);
      this.inkLayer.appendChild(this._curEl);
    }

    _onMove(e) {
      if (!this._cur || this.destroyed || this.rescue) return;
      const p = this._pt(e);
      if (!p) return;
      this._cur.push({ x: p.x, y: p.y });
      this._curSamples.push([Math.round(performance.now() - this._t0), Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
      this._curEl.setAttribute('d', this._curEl.getAttribute('d') + ' L ' + p.x + ' ' + p.y);
    }

    _onUp() {
      if (!this._cur || this.destroyed || this.rescue) return;
      if (this._cur.length > 2) {
        this.strokes.push(this._cur);
        this.record.strokes.push(this._curSamples);
        if (this.cb.onStrokeEnd) this.cb.onStrokeEnd();
      } else if (this._curEl) {
        this._curEl.remove(); // stray tap
      }
      this._cur = null;
      this._curEl = null;
      this._timer = setTimeout(() => this._evaluate(), EVAL_PAUSE_MS);
    }

    /* ---------------- judging ---------------- */

    _bbox() {
      let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      this.strokes.flat().forEach((p) => {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      });
      return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
    }

    _evaluate() {
      if (this.destroyed || this.rescue || !this.strokes.length) return;
      const flat = this.strokes.flat();
      const box = this._bbox();
      const isDash = this.glyph === '-';

      // ignore accidental dots/smudges silently
      if (flat.length < 6 || (box.w < 8 && box.h < 8)) { this._clearInk(false); return; }

      const tpl = buildTemplates()[this.glyph];
      const exp = tpl && tpl.box; // the glyph's own authored size and position
      if (!isDash && exp) {
        if (box.h < exp.h * 0.55) {
          return this._coach(exp.minY < MID - 10
            ? 'Make it bigger! Start at the top line and go all the way down!'
            : 'Make it bigger! Fill the space between the middle line and the bottom line!');
        }
        if (box.h > exp.h * 1.5) {
          return this._coach('A little smaller! Keep your letter between the lines!');
        }
        if (box.maxY < exp.maxY - 24) {
          return this._coach(exp.maxY > BASE + 6
            ? 'Let the tail dip down under the bottom line!'
            : 'Bring your letter all the way down to sit on the bottom line!');
        }
      }

      let ok;
      let res = null;
      if (isDash) {
        ok = box.w > 25 && box.h < 20;
      } else {
        res = recognize(this.strokes);
        // lenient: accept if expected letter is the best match or close to it
        ok = res && (res.best === this.glyph || res.scores[this.glyph] <= res.bestD * 1.35);
      }

      if (ok) return this._accept(box.h);

      this.misses++;
      this.record.misses++;
      if (this.misses >= MISSES_BEFORE_RESCUE) return this._startRescue();
      const guess = res && res.best && res.best !== this.glyph
        ? 'Hmm, that looks like ' + res.best + '! '
        : 'Almost! ';
      this._coach(guess + 'Try writing ' + (isDash ? 'the dash' : this.glyph) + ' again!');
    }

    _coach(text) {
      if (this.cb.onFeedback) this.cb.onFeedback(text);
      this.svg.classList.remove('mq-shake');
      void this.svg.getBoundingClientRect();
      this.svg.classList.add('mq-shake');
      this._clearInk(true);
    }

    _accept(h) {
      // size consistency across the word: coach, but never block
      const hs = this.shared.heights;
      if (hs.length) {
        const mean = hs.reduce((a, b) => a + b, 0) / hs.length;
        if (Math.abs(h - mean) / mean > 0.4 && this.cb.onFeedback) {
          this.cb.onFeedback('Lovely! Next time try to keep your letters all the same size!');
        }
      }
      hs.push(h);

      this.inkLayer.querySelectorAll('.fh-ink').forEach((el) => {
        el.classList.add('fh-ink-done');
        el.setAttribute('stroke', 'url(#mq-rainbow)');
        el.setAttribute('filter', 'url(#mq-glow)');
      });
      const box = this._bbox();
      this._burst((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
      this.record.ms = Math.round(performance.now() - this._t0);
      MQ.saveReplay && MQ.saveReplay(this.record);
      if (this.cb.onGlyphComplete) this.cb.onGlyphComplete(this.record);
    }

    /* after 3 unrecognized tries: guided tracing for THIS letter only */
    _startRescue() {
      this.record.helped = true;
      if (this.cb.onFeedback) {
        this.cb.onFeedback('Let me show you ' + this.glyph + '! Trace the sparkly path — then next one all by yourself!');
      }
      const cb = this.cb;
      this.rescue = new MQ.Tracer(this.svg, this.glyph, {
        onCheckpoint: cb.onCheckpoint,
        onStrokeComplete: cb.onStrokeComplete,
        onMiss: cb.onMiss,
        onNudge: cb.onNudge,
        onDemo: cb.onDemo,
        onHelp: cb.onHelp,
        onGlyphComplete: (record) => {
          record.helped = true;
          if (cb.onGlyphComplete) cb.onGlyphComplete(record);
        }
      });
    }

    _clearInk(fade) {
      const els = this.inkLayer.querySelectorAll('.fh-ink');
      if (fade) {
        els.forEach((el) => el.classList.add('fh-fade'));
        setTimeout(() => els.forEach((el) => el.remove()), 450);
      } else {
        els.forEach((el) => el.remove());
      }
      this.strokes = [];
    }

    _burst(x, y) {
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        const s = document.createElementNS(SVG_NS, 'circle');
        s.setAttribute('cx', x); s.setAttribute('cy', y); s.setAttribute('r', 2);
        s.setAttribute('class', 'mq-mote');
        s.setAttribute('fill', ['#ff7eb6', '#ffe66b', '#7ee8a2', '#8ab6ff'][i % 4]);
        s.style.setProperty('--dx', Math.cos(a) * 24 + 'px');
        s.style.setProperty('--dy', Math.sin(a) * 24 + 'px');
        this.sparkleLayer.appendChild(s);
        setTimeout(() => s.remove(), 800);
      }
    }
  }

  MQ.Freehand = Freehand;
})();
