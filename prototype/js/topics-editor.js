/* Magic Quill — grown-ups' word-pack editor (lives on replay.html).
 * Create / edit / delete topic packs held by MQ.Topics. Every free-text value
 * (pack name, words, fun facts) is rendered with textContent — never innerHTML —
 * because it is grown-up input. Touches mq_topics only; never reads or writes
 * mq_profile. The built-in "Magic words" pack is not listed or editable.
 */
(function () {
  const T = window.MQ && MQ.Topics;
  const listEl = document.getElementById('pack-list');
  const editorEl = document.getElementById('pack-editor');
  const addBtn = document.getElementById('pack-add');
  const banner = document.getElementById('pack-corrupt');
  if (!T || !listEl || !editorEl) return;

  let draft = null; // topic object being edited (null = editor closed)
  let refs = null;  // live DOM references for the open editor

  /* ---------- pack list ---------- */

  function showBanner() {
    if (!banner) return;
    if (T.isCorrupt()) {
      banner.textContent = '⚠️ Your saved packs could not be read, so the starter packs are shown. Saving any pack will replace the unreadable data.';
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }

  function renderList() {
    showBanner();
    listEl.textContent = '';
    const packs = T.list();
    if (!packs.length) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'No packs yet — tap “+ New pack” to make one.';
      listEl.appendChild(e);
      return;
    }
    packs.forEach(function (t) {
      const card = document.createElement('div');
      card.className = 'pack-card';

      const icon = document.createElement('span');
      icon.className = 'pk-icon';
      icon.textContent = t.icon || '✨';

      const name = document.createElement('span');
      name.className = 'pk-name';
      name.textContent = t.name;

      const meta = document.createElement('span');
      meta.className = 'pk-meta';
      meta.textContent = t.words.length + (t.words.length === 1 ? ' word' : ' words');

      const actions = document.createElement('span');
      actions.className = 'pk-actions';

      const edit = document.createElement('button');
      edit.className = 'ghost';
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.onclick = function () { openEditor(t); };

      const del = document.createElement('button');
      del.className = 'danger';
      del.type = 'button';
      del.textContent = 'Delete';
      del.onclick = function () {
        if (window.confirm('Delete the “' + t.name + '” pack? This cannot be undone.')) {
          T.remove(t.id);
          if (draft && draft.id === t.id) closeEditor();
          renderList();
        }
      };

      actions.appendChild(edit);
      actions.appendChild(del);
      card.appendChild(icon);
      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(actions);
      listEl.appendChild(card);
    });
  }

  /* ---------- editor ---------- */

  function blankWord() { return { word: '', fact: '' }; }

  function openEditor(topic) {
    draft = topic
      ? JSON.parse(JSON.stringify(topic))
      : { name: '', icon: T.EMOJIS[0], words: [blankWord(), blankWord(), blankWord()] };
    buildEditor();
    editorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeEditor() {
    draft = null;
    refs = null;
    editorEl.hidden = true;
    editorEl.textContent = '';
  }

  function field(labelText) {
    const wrap = document.createElement('div');
    wrap.className = 'fld';
    const lab = document.createElement('label');
    lab.textContent = labelText;
    wrap.appendChild(lab);
    return wrap;
  }

  function buildEditor() {
    editorEl.hidden = false;
    editorEl.textContent = '';
    refs = { wordRows: [] };

    const title = document.createElement('h3');
    title.textContent = draft.id ? 'Edit pack' : 'New pack';
    editorEl.appendChild(title);

    // pack name
    const nameFld = field('Pack name');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = T.NAME_MAX;
    nameInput.value = draft.name;
    nameInput.placeholder = 'e.g. Dinosaurs';
    nameInput.addEventListener('input', refresh);
    nameFld.appendChild(nameInput);
    refs.nameInput = nameInput;
    editorEl.appendChild(nameFld);

    // icon picker (radio row)
    const iconFld = field('Pick an icon');
    const row = document.createElement('div');
    row.className = 'emoji-row';
    refs.iconInputs = [];
    T.EMOJIS.forEach(function (emoji, i) {
      const lab = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'pack-emoji';
      input.value = emoji;
      if (emoji === draft.icon || (!draft.icon && i === 0)) input.checked = true;
      input.addEventListener('change', refresh);
      const span = document.createElement('span');
      span.textContent = emoji;
      lab.appendChild(input);
      lab.appendChild(span);
      row.appendChild(lab);
      refs.iconInputs.push(input);
    });
    iconFld.appendChild(row);
    editorEl.appendChild(iconFld);

    // words + facts
    const wordsFld = field('Words & fun facts (2–6 letters each, at least 3 words)');
    const rows = document.createElement('div');
    rows.className = 'word-rows';
    refs.wordRowsEl = rows;
    wordsFld.appendChild(rows);
    const addWord = document.createElement('button');
    addWord.className = 'ghost';
    addWord.type = 'button';
    addWord.textContent = '+ Add word';
    addWord.onclick = function () { addWordRow(blankWord()); refresh(); };
    wordsFld.appendChild(addWord);
    editorEl.appendChild(wordsFld);

    draft.words.forEach(function (w) { addWordRow(w); });

    // actions
    const actions = document.createElement('div');
    actions.className = 'editor-actions';
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Save pack';
    save.onclick = onSave;
    const cancel = document.createElement('button');
    cancel.className = 'ghost';
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.onclick = closeEditor;
    const msg = document.createElement('span');
    msg.className = 'editor-msg';
    actions.appendChild(save);
    actions.appendChild(cancel);
    actions.appendChild(msg);
    editorEl.appendChild(actions);
    refs.saveBtn = save;
    refs.msg = msg;

    refresh();
  }

  function addWordRow(w) {
    const ref = {};
    const rowEl = document.createElement('div');
    rowEl.className = 'word-row';

    const main = document.createElement('div');
    main.className = 'wr-main';

    const wordInput = document.createElement('input');
    wordInput.type = 'text';
    wordInput.className = 'w-word';
    wordInput.maxLength = T.WORD_MAX;
    wordInput.placeholder = 'WORD';
    wordInput.value = w.word || '';
    wordInput.addEventListener('input', function () {
      // uppercase-normalize in place (keeps caret); validity is judged in refresh
      const c = wordInput.selectionStart;
      wordInput.value = wordInput.value.toUpperCase();
      try { wordInput.setSelectionRange(c, c); } catch (e) { /* unsupported */ }
      refresh();
    });

    const factInput = document.createElement('input');
    factInput.type = 'text';
    factInput.className = 'w-fact';
    factInput.maxLength = T.FACT_MAX;
    factInput.placeholder = 'A fun fact the unicorn will say';
    factInput.value = w.fact || '';
    factInput.addEventListener('input', refresh);

    const del = document.createElement('button');
    del.className = 'w-del';
    del.type = 'button';
    del.textContent = '×';
    del.title = 'Remove this word';
    del.onclick = function () {
      const idx = refs.wordRows.indexOf(ref);
      if (idx >= 0) refs.wordRows.splice(idx, 1);
      rowEl.remove();
      refresh();
    };

    const flag = document.createElement('div');
    flag.className = 'w-flag';

    main.appendChild(wordInput);
    main.appendChild(factInput);
    main.appendChild(del);
    rowEl.appendChild(main);
    rowEl.appendChild(flag);

    ref.rowEl = rowEl;
    ref.wordInput = wordInput;
    ref.factInput = factInput;
    ref.flag = flag;
    refs.wordRows.push(ref);
    refs.wordRowsEl.appendChild(rowEl);
  }

  /* live validation: flag bad rows, enable Save only when the whole pack is valid */
  function refresh() {
    if (!refs) return;

    const name = refs.nameInput.value.trim();
    let icon = '';
    refs.iconInputs.forEach(function (inp) { if (inp.checked) icon = inp.value; });

    const words = refs.wordRows.map(function (r) {
      return { word: r.wordInput.value.trim().toUpperCase(), fact: r.factInput.value.trim() };
    });

    // duplicate detection over non-empty words
    const seen = {}, dup = {};
    words.forEach(function (w) {
      if (w.word) { if (seen[w.word]) dup[w.word] = true; seen[w.word] = true; }
    });

    let nonBlank = 0, anyInvalid = false;
    refs.wordRows.forEach(function (r, i) {
      const w = words[i];
      const blank = w.word === '' && w.fact === '';
      let flag = '';
      if (!blank) {
        nonBlank++;
        if (!T.validWord(w.word)) {
          flag = w.word ? 'Use 2–6 letters (A–Z only).' : 'Type the word here.';
          anyInvalid = true;
        } else if (dup[w.word]) {
          flag = '“' + w.word + '” is already in this pack.';
          anyInvalid = true;
        } else if (w.fact.length > T.FACT_MAX) {
          flag = 'Fun fact is a little too long.';
          anyInvalid = true;
        }
      }
      r.flag.textContent = flag;
      r.wordInput.classList.toggle('bad', !!flag && w.word !== '');
    });

    const candidate = {
      id: draft.id,
      name: name,
      icon: icon,
      words: words.filter(function (w) { return w.word !== '' || w.fact !== ''; })
    };

    const validName = name.length >= 1 && name.length <= T.NAME_MAX;
    refs.nameInput.classList.toggle('bad', name.length > 0 && !validName);

    const ok = validName && !!icon && !anyInvalid && nonBlank >= 3 && T.validTopic(candidate);
    refs.saveBtn.disabled = !ok;

    let msg;
    if (!validName) msg = 'Give the pack a name (1–20 letters).';
    else if (nonBlank < 3) {
      const need = 3 - nonBlank;
      msg = 'Add ' + need + ' more word' + (need === 1 ? '' : 's') + ' (at least 3).';
    } else if (!ok) msg = 'Fix the highlighted words to save.';
    else msg = 'Looks great — ready to save!';
    refs.msg.textContent = msg;

    refs._candidate = candidate;
  }

  function onSave() {
    if (!refs || refs.saveBtn.disabled) return;
    const c = refs._candidate;
    T.upsert({
      id: c.id,
      name: c.name,
      icon: c.icon,
      words: c.words.map(function (w) { return { word: w.word, fact: w.fact }; })
    });
    closeEditor();
    renderList();
  }

  if (addBtn) addBtn.onclick = function () { openEditor(null); };
  renderList();
})();
