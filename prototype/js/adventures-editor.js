/* Magic Quill — grown-ups' Adventure mission editor (lives on replay.html).
 * Create / edit / delete go-outside missions held by MQ.Adventures. Every
 * free-text value (mission name, prompt, choice words/emojis) is rendered with
 * textContent — never innerHTML — because it is grown-up input.
 *
 * Touches mq_adventures only, with ONE documented exception: the small
 * "adventure level" control writes mq_profile.advLevel (the kid's current tier),
 * because the level lives on her profile, not on a mission.
 */
(function () {
  const A = window.MQ && MQ.Adventures;
  const listEl = document.getElementById('adv-list');
  const editorEl = document.getElementById('adv-editor');
  const addBtn = document.getElementById('adv-add');
  const banner = document.getElementById('adv-corrupt');
  const levelEl = document.getElementById('adv-level-control');
  if (!A || !listEl || !editorEl) return;

  const STARS = function (n) { return '⭐'.repeat(Math.max(1, Math.min(3, n || 1))); };

  let draft = null; // mission object being edited (null = editor closed)
  let refs = null;  // live DOM references for the open editor

  /* ---------- her current adventure level (the one mq_profile write) ---------- */

  function loadProfile() {
    try { return JSON.parse(localStorage.getItem('mq_profile') || '{}'); }
    catch (e) { return {}; }
  }
  function currentLevel() {
    const p = loadProfile();
    const n = parseInt(p.advLevel, 10);
    return (n >= 1 && n <= 3) ? n : 1;
  }
  function setLevel(n) {
    const p = loadProfile();
    p.advLevel = n;
    try { localStorage.setItem('mq_profile', JSON.stringify(p)); } catch (e) {}
  }
  function renderLevelControl() {
    if (!levelEl) return;
    levelEl.textContent = '';
    const cur = currentLevel();
    A.LEVELS.forEach(function (n) {
      const lab = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'adv-level';
      input.value = String(n);
      if (n === cur) input.checked = true;
      input.addEventListener('change', function () { setLevel(n); });
      const span = document.createElement('span');
      span.textContent = STARS(n);
      lab.appendChild(input);
      lab.appendChild(span);
      levelEl.appendChild(lab);
    });
  }

  /* ---------- mission list ---------- */

  function showBanner() {
    if (!banner) return;
    if (A.isCorrupt()) {
      banner.textContent = '⚠️ Your saved missions could not be read, so the starter missions are shown. Saving any mission will replace the unreadable data.';
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }

  function renderList() {
    showBanner();
    listEl.textContent = '';
    const missions = A.list();
    if (!missions.length) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'No missions yet — tap “+ New mission” to make one.';
      listEl.appendChild(e);
      return;
    }
    missions.forEach(function (m) {
      const card = document.createElement('div');
      card.className = 'pack-card';

      const icon = document.createElement('span');
      icon.className = 'pk-icon';
      icon.textContent = m.icon || '🌞';

      const name = document.createElement('span');
      name.className = 'pk-name';
      name.textContent = m.name + '  ' + STARS(m.level);

      const meta = document.createElement('span');
      meta.className = 'pk-meta';
      const n = Array.isArray(m.choices) ? m.choices.length : 0;
      meta.textContent = n + (n === 1 ? ' choice' : ' choices');

      const actions = document.createElement('span');
      actions.className = 'pk-actions';

      const edit = document.createElement('button');
      edit.className = 'ghost';
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.onclick = function () { openEditor(m); };

      const del = document.createElement('button');
      del.className = 'danger';
      del.type = 'button';
      del.textContent = 'Delete';
      del.onclick = function () {
        if (window.confirm('Delete the “' + m.name + '” mission? This cannot be undone.')) {
          A.remove(m.id);
          if (draft && draft.id === m.id) closeEditor();
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

  function blankChoice() { return { word: '', icon: A.EMOJIS[0] }; }

  function openEditor(mission) {
    draft = mission
      ? JSON.parse(JSON.stringify(mission))
      : { name: '', icon: A.EMOJIS[0], level: 1, prompt: '', choices: [blankChoice(), blankChoice()] };
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
    refs = { choiceRows: [] };

    const title = document.createElement('h3');
    title.textContent = draft.id ? 'Edit mission' : 'New mission';
    editorEl.appendChild(title);

    // mission name
    const nameFld = field('Mission name');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = A.NAME_MAX;
    nameInput.value = draft.name;
    nameInput.placeholder = 'e.g. Red Hunt';
    nameInput.addEventListener('input', refresh);
    nameFld.appendChild(nameInput);
    refs.nameInput = nameInput;
    editorEl.appendChild(nameFld);

    // icon picker (radio row)
    const iconFld = field('Pick an icon');
    const iconRow = document.createElement('div');
    iconRow.className = 'emoji-row';
    refs.iconInputs = [];
    A.EMOJIS.forEach(function (emoji, i) {
      const lab = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'adv-icon';
      input.value = emoji;
      if (emoji === draft.icon || (!draft.icon && i === 0)) input.checked = true;
      input.addEventListener('change', refresh);
      const span = document.createElement('span');
      span.textContent = emoji;
      lab.appendChild(input);
      lab.appendChild(span);
      iconRow.appendChild(lab);
      refs.iconInputs.push(input);
    });
    iconFld.appendChild(iconRow);
    editorEl.appendChild(iconFld);

    // difficulty level (radio row): ⭐ little / ⭐⭐ / ⭐⭐⭐ big-kid
    const levelFld = field('How big-kid is it?');
    const levelRow = document.createElement('div');
    levelRow.className = 'emoji-row';
    refs.levelInputs = [];
    A.LEVELS.forEach(function (n) {
      const lab = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'adv-difficulty';
      input.value = String(n);
      if (n === (draft.level || 1)) input.checked = true;
      input.addEventListener('change', refresh);
      const span = document.createElement('span');
      span.textContent = STARS(n);
      lab.appendChild(input);
      lab.appendChild(span);
      levelRow.appendChild(lab);
      refs.levelInputs.push(input);
    });
    levelFld.appendChild(levelRow);
    editorEl.appendChild(levelFld);

    // the spoken go-do prompt
    const promptFld = field('What should she go and do? (the unicorn says this)');
    const promptInput = document.createElement('input');
    promptInput.type = 'text';
    promptInput.maxLength = A.PROMPT_MAX;
    promptInput.value = draft.prompt || '';
    promptInput.placeholder = 'e.g. Find something RED and bring it back!';
    promptInput.addEventListener('input', refresh);
    promptFld.appendChild(promptInput);
    refs.promptInput = promptInput;
    editorEl.appendChild(promptFld);

    // choices: what she might bring back (each = emoji + word to write)
    const choiceFld = field('What might she find? (2–4 choices, words 2–6 letters)');
    const rows = document.createElement('div');
    rows.className = 'word-rows';
    refs.choiceRowsEl = rows;
    choiceFld.appendChild(rows);
    const addChoice = document.createElement('button');
    addChoice.className = 'ghost';
    addChoice.type = 'button';
    addChoice.textContent = '+ Add choice';
    addChoice.onclick = function () {
      if (refs.choiceRows.length >= A.CHOICES_MAX) return;
      addChoiceRow(blankChoice());
      refresh();
    };
    choiceFld.appendChild(addChoice);
    refs.addChoiceBtn = addChoice;
    editorEl.appendChild(choiceFld);

    draft.choices.forEach(function (c) { addChoiceRow(c); });

    // actions
    const actions = document.createElement('div');
    actions.className = 'editor-actions';
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Save mission';
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

  function addChoiceRow(c) {
    const ref = {};
    const rowEl = document.createElement('div');
    rowEl.className = 'word-row';

    const main = document.createElement('div');
    main.className = 'wr-main';

    const emojiInput = document.createElement('input');
    emojiInput.type = 'text';
    emojiInput.className = 'w-emoji';
    emojiInput.maxLength = 4;
    emojiInput.placeholder = '🙂';
    emojiInput.value = c.icon || '';
    emojiInput.addEventListener('input', refresh);

    const wordInput = document.createElement('input');
    wordInput.type = 'text';
    wordInput.className = 'w-word';
    wordInput.maxLength = A.WORD_MAX;
    wordInput.placeholder = 'WORD';
    wordInput.value = c.word || '';
    wordInput.addEventListener('input', function () {
      const at = wordInput.selectionStart;
      wordInput.value = wordInput.value.toUpperCase();
      try { wordInput.setSelectionRange(at, at); } catch (e) { /* unsupported */ }
      refresh();
    });

    const del = document.createElement('button');
    del.className = 'w-del';
    del.type = 'button';
    del.textContent = '×';
    del.title = 'Remove this choice';
    del.onclick = function () {
      const idx = refs.choiceRows.indexOf(ref);
      if (idx >= 0) refs.choiceRows.splice(idx, 1);
      rowEl.remove();
      refresh();
    };

    const flag = document.createElement('div');
    flag.className = 'w-flag';

    main.appendChild(emojiInput);
    main.appendChild(wordInput);
    main.appendChild(del);
    rowEl.appendChild(main);
    rowEl.appendChild(flag);

    ref.rowEl = rowEl;
    ref.emojiInput = emojiInput;
    ref.wordInput = wordInput;
    ref.flag = flag;
    refs.choiceRows.push(ref);
    refs.choiceRowsEl.appendChild(rowEl);
  }

  /* live validation: flag bad rows, enable Save only when the whole mission is valid */
  function refresh() {
    if (!refs) return;

    const name = refs.nameInput.value.trim();
    const prompt = refs.promptInput.value.trim();
    let icon = '';
    refs.iconInputs.forEach(function (inp) { if (inp.checked) icon = inp.value; });
    let level = 0;
    refs.levelInputs.forEach(function (inp) { if (inp.checked) level = parseInt(inp.value, 10); });

    const choices = refs.choiceRows.map(function (r) {
      return { word: r.wordInput.value.trim().toUpperCase(), icon: r.emojiInput.value.trim() };
    });

    // duplicate detection over non-empty words
    const seen = {}, dup = {};
    choices.forEach(function (c) {
      if (c.word) { if (seen[c.word]) dup[c.word] = true; seen[c.word] = true; }
    });

    let valid = 0, anyInvalid = false;
    refs.choiceRows.forEach(function (r, i) {
      const c = choices[i];
      const blank = c.word === '' && c.icon === '';
      let flag = '';
      if (!blank) {
        if (!A.validWord(c.word)) {
          flag = c.word ? 'Use 2–6 letters (A–Z only).' : 'Type the word here.';
          anyInvalid = true;
        } else if (!c.icon) {
          flag = 'Pick an emoji for this choice.';
          anyInvalid = true;
        } else if (dup[c.word]) {
          flag = '“' + c.word + '” is already a choice.';
          anyInvalid = true;
        } else {
          valid++;
        }
      }
      r.flag.textContent = flag;
      r.wordInput.classList.toggle('bad', !!flag && c.word !== '');
    });

    if (refs.addChoiceBtn) refs.addChoiceBtn.disabled = refs.choiceRows.length >= A.CHOICES_MAX;

    const candidate = {
      id: draft.id,
      name: name,
      icon: icon,
      level: level,
      prompt: prompt,
      choices: choices.filter(function (c) { return c.word !== '' || c.icon !== ''; })
    };

    const validName = name.length >= 1 && name.length <= A.NAME_MAX;
    refs.nameInput.classList.toggle('bad', name.length > 0 && !validName);
    const validPrompt = prompt.length >= 1 && prompt.length <= A.PROMPT_MAX;
    refs.promptInput.classList.toggle('bad', prompt.length > 0 && !validPrompt);

    const ok = validName && validPrompt && !!icon && level >= 1 &&
      !anyInvalid && valid >= A.CHOICES_MIN && A.validMission(candidate);
    refs.saveBtn.disabled = !ok;

    let msg;
    if (!validName) msg = 'Give the mission a name (1–20 letters).';
    else if (!validPrompt) msg = 'Write what she should go and do (1–60 letters).';
    else if (valid < A.CHOICES_MIN) {
      const need = A.CHOICES_MIN - valid;
      msg = 'Add ' + need + ' more choice' + (need === 1 ? '' : 's') + ' (at least 2).';
    } else if (!ok) msg = 'Fix the highlighted choices to save.';
    else msg = 'Looks great — ready to save!';
    refs.msg.textContent = msg;

    refs._candidate = candidate;
  }

  function onSave() {
    if (!refs || refs.saveBtn.disabled) return;
    const c = refs._candidate;
    A.upsert({
      id: c.id,
      name: c.name,
      icon: c.icon,
      level: c.level,
      prompt: c.prompt,
      choices: c.choices.map(function (ch) { return { word: ch.word, icon: ch.icon }; })
    });
    closeEditor();
    renderList();
  }

  if (addBtn) addBtn.onclick = function () { openEditor(null); };
  renderLevelControl();
  renderList();
})();
