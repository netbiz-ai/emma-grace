/* Magic Quill — grown-ups' voice recorder (lives on replay.html).
 * Record your own voice for the game's fixed lines (MQ.VoiceLines), then export a
 * "voice pack" (.zip of <id>.wav + voice-manifest.json) to upload to the site's
 * /voice/ folder. Clips are captured as 16 kHz mono WAV (plays on every device,
 * including iPad) and kept in IndexedDB so you can record across several sittings.
 *
 * Touches only its own IndexedDB store ('mq-voice') + localStorage 'mq_voice'
 * (the in-game on/off toggle). It never reads or writes mq_profile / mq_topics /
 * mq_adventures.
 */
(function () {
  const VL = window.MQ && MQ.VoiceLines;
  const listEl = document.getElementById('voice-list');
  const exportBtn = document.getElementById('voice-export');
  const toggle = document.getElementById('voice-toggle');
  const countEl = document.getElementById('voice-count');
  const msgEl = document.getElementById('voice-msg');
  if (!VL || !listEl) return;

  const OUT_RATE = 16000;
  const recorded = {};   // id -> Blob (mirror of IndexedDB, for export)
  let active = null;     // current recording handle

  /* ---------- IndexedDB (clips persist across sessions on this device) ---------- */
  function db() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open('mq-voice', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('clips'); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function idbPut(id, blob) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        const tx = d.transaction('clips', 'readwrite');
        tx.objectStore('clips').put(blob, id);
        tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function idbDel(id) {
    return db().then(function (d) {
      return new Promise(function (res) {
        const tx = d.transaction('clips', 'readwrite');
        tx.objectStore('clips').delete(id);
        tx.oncomplete = res; tx.onerror = res;
      });
    });
  }
  function idbAll() {
    return db().then(function (d) {
      return new Promise(function (res) {
        const out = {};
        const tx = d.transaction('clips', 'readonly');
        const store = tx.objectStore('clips');
        const cur = store.openCursor();
        cur.onsuccess = function (e) {
          const c = e.target.result;
          if (c) { out[c.key] = c.value; c.continue(); } else { res(out); }
        };
        cur.onerror = function () { res(out); };
      });
    });
  }

  /* ---------- WAV recording (mic → 16 kHz mono 16-bit) ---------- */
  function startRecording() {
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const chunks = [];
      node.onaudioprocess = function (e) { chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      source.connect(node);
      node.connect(ctx.destination); // required for the processor to run in some browsers
      return {
        stop: function () {
          node.disconnect(); source.disconnect();
          stream.getTracks().forEach(function (t) { t.stop(); });
          const inRate = ctx.sampleRate;
          ctx.close();
          let len = 0; chunks.forEach(function (c) { len += c.length; });
          const data = new Float32Array(len);
          let off = 0; chunks.forEach(function (c) { data.set(c, off); off += c.length; });
          return encodeWav(downsample(data, inRate, OUT_RATE), OUT_RATE);
        }
      };
    });
  }

  function downsample(buf, inRate, outRate) {
    if (outRate >= inRate) return buf;
    const ratio = inRate / outRate;
    const outLen = Math.floor(buf.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const start = Math.floor(i * ratio), end = Math.floor((i + 1) * ratio);
      let sum = 0, n = 0;
      for (let j = start; j < end && j < buf.length; j++) { sum += buf[j]; n++; }
      out[i] = n ? sum / n : 0;
    }
    return out;
  }

  function encodeWav(samples, rate) {
    const bytes = 44 + samples.length * 2;
    const ab = new ArrayBuffer(bytes);
    const v = new DataView(ab);
    const wstr = function (o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    wstr(0, 'RIFF'); v.setUint32(4, bytes - 8, true); wstr(8, 'WAVE');
    wstr(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    wstr(36, 'data'); v.setUint32(40, samples.length * 2, true);
    let o = 44;
    for (let i = 0; i < samples.length; i++, o += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([ab], { type: 'audio/wav' });
  }

  /* ---------- minimal STORE-method zip writer ---------- */
  const CRC = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return function (buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  })();
  function buildZip(files) { // files: [{ name, bytes: Uint8Array }]
    const enc = new TextEncoder();
    const locals = [], central = [];
    let offset = 0;
    files.forEach(function (f) {
      const name = enc.encode(f.name), crc = CRC(f.bytes), sz = f.bytes.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      locals.push(new Uint8Array(lh.buffer), name, f.bytes);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0, true); ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true);
      ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + sz;
    });
    let cenSize = 0; central.forEach(function (c) { cenSize += c.length; });
    const eo = new DataView(new ArrayBuffer(22));
    eo.setUint32(0, 0x06054b50, true); eo.setUint16(8, files.length, true); eo.setUint16(10, files.length, true);
    eo.setUint32(12, cenSize, true); eo.setUint32(16, offset, true); eo.setUint16(20, 0, true);
    return new Blob(locals.concat(central, [new Uint8Array(eo.buffer)]), { type: 'application/zip' });
  }

  /* ---------- UI ---------- */
  function setMsg(t) { if (msgEl) msgEl.textContent = t || ''; }
  function refreshCount() {
    const n = Object.keys(recorded).length;
    if (countEl) countEl.textContent = '(' + n + ' / ' + VL.LINES.length + ' recorded)';
    if (exportBtn) exportBtn.disabled = n === 0;
  }

  function playBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    a.onended = function () { URL.revokeObjectURL(url); };
    a.play().catch(function () { URL.revokeObjectURL(url); });
  }

  function render() {
    listEl.textContent = '';
    let group = null;
    VL.LINES.forEach(function (line) {
      if (line.group !== group) {
        group = line.group;
        const h = document.createElement('h4'); h.className = 'voice-group'; h.textContent = group;
        listEl.appendChild(h);
      }
      const row = document.createElement('div');
      row.className = 'voice-row' + (recorded[line.id] ? ' has-clip' : '');

      const txt = document.createElement('span');
      txt.className = 'voice-text';
      txt.textContent = (recorded[line.id] ? '✓ ' : '') + '“' + line.text + '”';

      const actions = document.createElement('span');
      actions.className = 'voice-actions';

      const rec = document.createElement('button');
      rec.className = 'ghost'; rec.type = 'button';
      rec.textContent = recorded[line.id] ? 'Re-record' : '● Record';
      rec.onclick = function () { onRecord(line.id, rec); };
      actions.appendChild(rec);

      if (recorded[line.id]) {
        const play = document.createElement('button');
        play.className = 'ghost'; play.type = 'button'; play.textContent = '▶ Play';
        play.onclick = function () { playBlob(recorded[line.id]); };
        const del = document.createElement('button');
        del.className = 'danger'; del.type = 'button'; del.textContent = 'Clear';
        del.onclick = function () {
          idbDel(line.id).then(function () { delete recorded[line.id]; render(); refreshCount(); });
        };
        actions.appendChild(play);
        actions.appendChild(del);
      }

      row.appendChild(txt);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
  }

  function onRecord(id, btn) {
    if (active) { // stop the in-progress recording
      const handle = active; active = null;
      const blob = handle.stop();
      btn.textContent = '…';
      idbPut(id, blob).then(function () {
        recorded[id] = blob; render(); refreshCount();
        setMsg('Saved! Play it back, or record the next line.');
      });
      return;
    }
    startRecording().then(function (handle) {
      active = handle;
      document.querySelectorAll('.voice-actions button').forEach(function (b) { if (b !== btn) b.disabled = true; });
      btn.disabled = false;
      btn.textContent = '■ Stop';
      btn.classList.add('recording');
      setMsg('Recording… tap “■ Stop” when you finish the line.');
    }).catch(function () {
      setMsg('Could not use the microphone. Please allow mic access and try again.');
    });
  }

  function doExport() {
    const ids = Object.keys(recorded);
    if (!ids.length) return;
    const manifest = { v: 1, rate: OUT_RATE, lines: {} };
    const files = [];
    let pending = ids.length;
    ids.forEach(function (id) {
      manifest.lines[id] = VL.file(id);
      recorded[id].arrayBuffer().then(function (ab) {
        files.push({ name: VL.file(id), bytes: new Uint8Array(ab) });
        if (--pending === 0) {
          files.push({ name: 'voice-manifest.json', bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
          const zip = buildZip(files);
          const url = URL.createObjectURL(zip);
          const a = document.createElement('a');
          a.href = url; a.download = 'voice-pack.zip'; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
          setMsg('Exported voice-pack.zip — upload its contents into your site’s /voice/ folder.');
        }
      });
    });
  }

  /* ---------- boot ---------- */
  if (toggle) {
    let on = true;
    try { on = localStorage.getItem('mq_voice') !== 'off'; } catch (e) {}
    toggle.checked = on;
    toggle.onchange = function () {
      try { localStorage.setItem('mq_voice', toggle.checked ? 'on' : 'off'); } catch (e) {}
    };
  }
  if (exportBtn) exportBtn.onclick = doExport;

  idbAll().then(function (all) {
    Object.keys(all).forEach(function (id) { if (VL.get(id)) recorded[id] = all[id]; });
    render(); refreshCount();
  });
})();
