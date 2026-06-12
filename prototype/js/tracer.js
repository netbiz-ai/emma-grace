/* Magic Quill — tracing engine.
 * Renders a glyph's stroke guides into an <svg>, validates the child's
 * pointer trail against ordered checkpoints sampled along each stroke path
 * (Hanzi Writer-style quiz pattern), manages hint escalation, paints
 * rainbow progress, and records strokes for the parent replay page.
 */
window.MQ = window.MQ || {};

(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CP_SPACING = 12;      // distance between checkpoints (glyph units)
  const HIT_RADIUS_TOUCH = 16;
  const HIT_RADIUS_MOUSE = 20; // mouse is harder for little hands — be kinder
  const CORRIDOR = 36;        // how far off-path before we call it a stray
  const START_RADIUS = 22;    // how close to the start dot a touch must begin
  const MISSES_BEFORE_DEMO = 3;
  const MISSES_BEFORE_HELP = 6; // unicorn magically finishes the stroke

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function dist(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  class Tracer {
    /**
     * @param {SVGSVGElement} svg  - target svg (viewBox 0 0 100 140)
     * @param {string} glyph       - key into MQ.LETTERS
     * @param {object} cb          - { onStrokeComplete(i), onGlyphComplete(record),
     *                                onMiss(count), onDemo(), onHelp(), onCheckpoint(i),
     *                                onNudge() }
     */
    constructor(svg, glyph, cb) {
      this.svg = svg;
      this.glyph = glyph;
      this.data = MQ.LETTERS[glyph];
      this.cb = cb || {};
      this.strokeIdx = 0;
      this.misses = 0;
      this.totalMisses = 0;
      this.tracing = false;
      this.destroyed = false;
      this.record = { glyph: glyph, at: Date.now(), strokes: [], misses: 0, helped: false };
      this._t0 = performance.now();
      this._build();
      this._bind();
      this._armStroke();
    }

    /* ---------- construction ---------- */

    _build() {
      const svg = this.svg;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', '0 0 100 140');

      // defs: rainbow ink gradient + soft glow
      const defs = svgEl('defs', {});
      defs.innerHTML =
        '<linearGradient id="mq-rainbow" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#ff7eb6"/><stop offset="0.3" stop-color="#ffb86b"/>' +
        '<stop offset="0.55" stop-color="#ffe66b"/><stop offset="0.8" stop-color="#7ee8a2"/>' +
        '<stop offset="1" stop-color="#8ab6ff"/></linearGradient>' +
        '<filter id="mq-glow" x="-60%" y="-60%" width="220%" height="220%">' +
        '<feGaussianBlur stdDeviation="2.2" result="b"/>' +
        '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
      svg.appendChild(defs);

      this.strokes = this.data.strokes.map((s) => {
        // pale "letter body" underlay — makes the full letterform readable
        const under = svgEl('path', {
          d: s.path, class: 'mq-under',
          fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        });
        // dotted guide centerline
        const guide = svgEl('path', {
          d: s.path, class: 'mq-guide',
          fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        });
        // rainbow progress ink (revealed via dashoffset)
        const ink = svgEl('path', {
          d: s.path, class: 'mq-ink', stroke: 'url(#mq-rainbow)',
          fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
          filter: 'url(#mq-glow)'
        });
        svg.appendChild(under);
        svg.appendChild(guide);
        svg.appendChild(ink);

        const len = ink.getTotalLength();
        ink.style.strokeDasharray = String(len);
        ink.style.strokeDashoffset = String(len);

        // checkpoints
        const n = Math.max(3, Math.round(len / CP_SPACING));
        const cps = [];
        for (let i = 0; i <= n; i++) {
          const l = (len * i) / n;
          const p = ink.getPointAtLength(l);
          cps.push({ x: p.x, y: p.y, len: l });
        }
        return { pathEl: ink, guideEl: guide, underEl: under, len: len, cps: cps };
      });

      // start dot + direction arrow (re-positioned per stroke)
      this.startDot = svgEl('circle', { class: 'mq-start', r: 6.5 });
      this.startArrow = svgEl('path', { class: 'mq-arrow', d: 'M 0 -4 L 7 0 L 0 4 Z' });
      svg.appendChild(this.startDot);
      svg.appendChild(this.startArrow);

      // demo comet (hidden until needed)
      this.comet = svgEl('circle', { class: 'mq-comet', r: 5, opacity: 0 });
      svg.appendChild(this.comet);

      this.sparkleLayer = svgEl('g', { class: 'mq-sparkles' });
      svg.appendChild(this.sparkleLayer);
    }

    _armStroke() {
      const s = this.strokes[this.strokeIdx];
      this.cpIdx = 1; // cps[0] is the start point itself
      this.misses = 0;
      // place start dot + arrow showing direction
      const a = s.cps[0], b = s.cps[Math.min(1, s.cps.length - 1)];
      this.startDot.setAttribute('cx', a.x);
      this.startDot.setAttribute('cy', a.y);
      this.startDot.style.opacity = 1;
      this.startDot.classList.add('mq-pulse');
      const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      this.startArrow.setAttribute('transform',
        'translate(' + (a.x + (b.x - a.x) * 0.45) + ' ' + (a.y + (b.y - a.y) * 0.45) + ') rotate(' + ang + ')');
      this.startArrow.style.opacity = 1;
      // highlight current stroke's guide
      this.strokes.forEach((st, i) => {
        st.guideEl.classList.toggle('mq-guide-active', i === this.strokeIdx);
      });
    }

    /* ---------- pointer handling ---------- */

    _bind() {
      this._down = (e) => this._onDown(e);
      this._move = (e) => this._onMove(e);
      this._up = (e) => this._onUp(e);
      this.svg.addEventListener('pointerdown', this._down);
      this.svg.addEventListener('pointermove', this._move);
      this.svg.addEventListener('pointerup', this._up);
      this.svg.addEventListener('pointercancel', this._up);
      this.svg.addEventListener('pointerleave', this._up);
    }

    destroy() {
      this.destroyed = true;
      this.svg.removeEventListener('pointerdown', this._down);
      this.svg.removeEventListener('pointermove', this._move);
      this.svg.removeEventListener('pointerup', this._up);
      this.svg.removeEventListener('pointercancel', this._up);
      this.svg.removeEventListener('pointerleave', this._up);
    }

    _pt(e) {
      const ctm = this.svg.getScreenCTM();
      if (!ctm) return null;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      return p;
    }

    _hitRadius(e) {
      return e.pointerType === 'mouse' ? HIT_RADIUS_MOUSE : HIT_RADIUS_TOUCH;
    }

    _onDown(e) {
      // strokeIdx check: the glyph may be finished while the engine waits to be destroyed
      if (this.destroyed || this.demoPlaying || this.strokeIdx >= this.strokes.length) return;
      const p = this._pt(e);
      if (!p) return;
      this.svg.setPointerCapture && this.svg.setPointerCapture(e.pointerId);
      const s = this.strokes[this.strokeIdx];
      // resume point: last hit checkpoint (or the start)
      const resume = s.cps[this.cpIdx - 1];
      if (dist(p.x, p.y, resume.x, resume.y) <= START_RADIUS) {
        this.tracing = true;
        this._gained = 0;
        this._sample(p);
      } else {
        // touched far from the dot — gentle nudge, not a miss yet
        this.startDot.classList.remove('mq-pulse');
        void this.startDot.getBBox(); // reflow so animation restarts
        this.startDot.classList.add('mq-pulse');
        if (this.cb.onNudge) this.cb.onNudge();
      }
    }

    _onMove(e) {
      if (!this.tracing || this.destroyed || this.strokeIdx >= this.strokes.length) return;
      const p = this._pt(e);
      if (!p) return;
      this._sample(p);
      const s = this.strokes[this.strokeIdx];
      const r = this._hitRadius(e);

      // advance through any checkpoints within reach (fast fingers skip a few)
      let advanced = false;
      while (this.cpIdx < s.cps.length) {
        const lookahead = Math.min(this.cpIdx + 2, s.cps.length - 1);
        let hit = -1;
        for (let i = this.cpIdx; i <= lookahead; i++) {
          if (dist(p.x, p.y, s.cps[i].x, s.cps[i].y) <= r) { hit = i; }
        }
        if (hit < 0) break;
        this.cpIdx = hit + 1;
        advanced = true;
      }
      if (advanced) {
        const reached = s.cps[this.cpIdx - 1];
        s.pathEl.style.strokeDashoffset = String(s.len - reached.len);
        this._sparkle(p.x, p.y);
        if (this.cb.onCheckpoint) this.cb.onCheckpoint(this.cpIdx, s.cps.length);
        this._gained++;
        this.startDot.style.opacity = 0;
        this.startArrow.style.opacity = 0;
        if (this.cpIdx >= s.cps.length) this._strokeDone();
        return;
      }

      // stray detection: too far from both last and next checkpoint
      const prev = s.cps[this.cpIdx - 1];
      const next = s.cps[Math.min(this.cpIdx, s.cps.length - 1)];
      if (dist(p.x, p.y, prev.x, prev.y) > CORRIDOR && dist(p.x, p.y, next.x, next.y) > CORRIDOR) {
        this.tracing = false;
        this._endSampleRun();
        this._miss();
      }
    }

    _onUp(e) {
      if (!this.tracing || this.destroyed || this.strokeIdx >= this.strokes.length) return;
      this.tracing = false;
      this._endSampleRun();
      const s = this.strokes[this.strokeIdx];
      if (this.cpIdx < s.cps.length && this._gained < 1) {
        this._miss();
      } else if (this.cpIdx < s.cps.length) {
        // partial progress kept; re-show dot at resume point
        const resume = s.cps[this.cpIdx - 1];
        this.startDot.setAttribute('cx', resume.x);
        this.startDot.setAttribute('cy', resume.y);
        this.startDot.style.opacity = 1;
      }
    }

    /* ---------- feedback ---------- */

    _miss() {
      this.misses++;
      this.totalMisses++;
      this.record.misses++;
      this.svg.classList.remove('mq-shake');
      void this.svg.getBoundingClientRect();
      this.svg.classList.add('mq-shake');
      const s = this.strokes[this.strokeIdx];
      const resume = s.cps[this.cpIdx - 1];
      this.startDot.setAttribute('cx', resume.x);
      this.startDot.setAttribute('cy', resume.y);
      this.startDot.style.opacity = 1;
      if (this.misses >= MISSES_BEFORE_HELP) {
        this._unicornHelp();
      } else if (this.misses >= MISSES_BEFORE_DEMO && this.misses % MISSES_BEFORE_DEMO === 0) {
        this._playDemo();
        if (this.cb.onDemo) this.cb.onDemo();
      } else {
        if (this.cb.onMiss) this.cb.onMiss(this.misses);
      }
    }

    /* animate a glowing comet along the remaining path */
    _playDemo() {
      const s = this.strokes[this.strokeIdx];
      const from = s.cps[this.cpIdx - 1].len;
      const dur = Math.max(700, (s.len - from) * 14);
      const t0 = performance.now();
      this.demoPlaying = true;
      this.comet.style.opacity = 1;
      const step = (t) => {
        if (this.destroyed) return;
        const k = Math.min(1, (t - t0) / dur);
        const p = s.pathEl.getPointAtLength(from + (s.len - from) * k);
        this.comet.setAttribute('cx', p.x);
        this.comet.setAttribute('cy', p.y);
        if (k < 1) requestAnimationFrame(step);
        else {
          this.comet.style.opacity = 0;
          this.demoPlaying = false;
        }
      };
      requestAnimationFrame(step);
    }

    /* after 6 misses the unicorn finishes the stroke with magic — never stuck */
    _unicornHelp() {
      const s = this.strokes[this.strokeIdx];
      this.record.helped = true;
      if (this.cb.onHelp) this.cb.onHelp();
      const from = s.cps[this.cpIdx - 1].len;
      const dur = 900;
      const t0 = performance.now();
      this.demoPlaying = true;
      const step = (t) => {
        if (this.destroyed) return;
        const k = Math.min(1, (t - t0) / dur);
        const l = from + (s.len - from) * k;
        s.pathEl.style.strokeDashoffset = String(s.len - l);
        const p = s.pathEl.getPointAtLength(l);
        this._sparkle(p.x, p.y);
        if (k < 1) requestAnimationFrame(step);
        else {
          this.demoPlaying = false;
          this.cpIdx = s.cps.length;
          this._strokeDone();
        }
      };
      requestAnimationFrame(step);
    }

    _strokeDone() {
      const s = this.strokes[this.strokeIdx];
      s.pathEl.style.strokeDashoffset = '0';
      s.guideEl.style.opacity = 0;
      const end = s.cps[s.cps.length - 1];
      this._burst(end.x, end.y);
      if (this.cb.onStrokeComplete) this.cb.onStrokeComplete(this.strokeIdx);
      this.strokeIdx++;
      if (this.strokeIdx >= this.strokes.length) {
        this.startDot.style.opacity = 0;
        this.startArrow.style.opacity = 0;
        this.record.ms = Math.round(performance.now() - this._t0);
        MQ.saveReplay && MQ.saveReplay(this.record);
        if (this.cb.onGlyphComplete) this.cb.onGlyphComplete(this.record);
      } else {
        this._armStroke();
      }
    }

    /* ---------- sparkle particles ---------- */

    _sparkle(x, y) {
      if (this.sparkleLayer.childElementCount > 24) return;
      const s = svgEl('circle', {
        cx: x, cy: y, r: 1.6 + Math.random() * 1.8,
        class: 'mq-mote',
        fill: ['#fff6c9', '#ffd1ec', '#c9f0ff', '#ffe66b'][Math.floor(Math.random() * 4)]
      });
      s.style.setProperty('--dx', (Math.random() * 16 - 8) + 'px');
      s.style.setProperty('--dy', (-6 - Math.random() * 14) + 'px');
      this.sparkleLayer.appendChild(s);
      setTimeout(() => s.remove(), 800);
    }

    _burst(x, y) {
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        const s = svgEl('circle', {
          cx: x, cy: y, r: 2, class: 'mq-mote',
          fill: ['#ff7eb6', '#ffe66b', '#7ee8a2', '#8ab6ff'][i % 4]
        });
        s.style.setProperty('--dx', Math.cos(a) * 22 + 'px');
        s.style.setProperty('--dy', Math.sin(a) * 22 + 'px');
        this.sparkleLayer.appendChild(s);
        setTimeout(() => s.remove(), 800);
      }
    }

    /* ---------- replay recording ---------- */

    _sample(p) {
      if (!this._run) this._run = [];
      this._run.push([Math.round(performance.now() - this._t0), Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
    }

    _endSampleRun() {
      if (this._run && this._run.length > 1) this.record.strokes.push(this._run);
      this._run = null;
    }
  }

  MQ.Tracer = Tracer;

  /* persist attempts for the parent replay page (keep the latest 150) */
  MQ.saveReplay = function (record) {
    try {
      const all = JSON.parse(localStorage.getItem('mq_replays') || '[]');
      all.push(record);
      while (all.length > 150) all.shift();
      localStorage.setItem('mq_replays', JSON.stringify(all));
    } catch (err) { /* storage full or unavailable — gameplay must not break */ }
  };
})();
