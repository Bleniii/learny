/* Portfolio + Lernapp
   Alles im Browser: Projekte aus projects.json, Lerninhalte aus content.json,
   Lernstand in localStorage. Kein Framework, keine Abhängigkeiten. */

const STORE_KEY = 'lernapp.v1';
const ROUND_SIZE = 15;          // Fragen pro Runde

let CONTENT = null;
let PROJECTS = [];
let SERVICE = null;
let PROGRESS = loadProgress();
let session = null;
let pendingTopic;               // Thema, das nach dem Ansichtswechsel starten soll

/* ── Lernstand ─────────────────────────────────────────── */

function emptyProgress() {
  return { v: 1, boxes: {}, answered: 0, correct: 0, days: [] };
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyProgress();
    const p = JSON.parse(raw);
    return Object.assign(emptyProgress(), p, { boxes: p.boxes || {} });
  } catch (err) {
    console.warn('Lernstand nicht lesbar, starte neu:', err);
    return emptyProgress();
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(PROGRESS));
  } catch (err) {
    console.warn('Lernstand konnte nicht gespeichert werden:', err);
  }
}

const keyOf = (topicId, qid) => topicId + ':' + qid;
const boxOf = (topicId, qid) => PROGRESS.boxes[keyOf(topicId, qid)] || 1;

function recordAnswer(topicId, qid, right) {
  const k = keyOf(topicId, qid);
  const box = boxOf(topicId, qid);
  const next = right ? Math.min(3, box + 1) : 1;
  PROGRESS.boxes[k] = next;
  PROGRESS.answered++;
  if (right) PROGRESS.correct++;
  const today = new Date().toISOString().slice(0, 10);
  if (PROGRESS.days[PROGRESS.days.length - 1] !== today) PROGRESS.days.push(today);
  saveProgress();
  return { from: box, to: next };
}

function streak() {
  const days = PROGRESS.days.slice().sort();
  if (!days.length) return 0;
  const day = ms => Math.floor(ms / 86400000);
  const today = day(Date.now());
  const last = day(Date.parse(days[days.length - 1]));
  if (today - last > 1) return 0;
  let run = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (day(Date.parse(days[i])) - day(Date.parse(days[i - 1])) === 1) run++;
    else break;
  }
  return run;
}

/* ── Antwortprüfung ────────────────────────────────────── */

function normalize(s) {
  return String(s)
    .toLowerCase().trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/(\d)[.,'](\d)/g, '$1$2')      // 1.024 und 1'024 -> 1024
    .replace(/[-–—_/]+/g, ' ')              // Bindestriche wie Leerzeichen behandeln
    .replace(/[.,!?;:]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRight(question, given) {
  const want = question.answer.map(normalize);
  return want.includes(normalize(given));
}

/* ── Hilfsfunktionen ───────────────────────────────────── */

const $ = sel => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* Ein- und Ausblenden ohne Umweg über CSS — inline gesetzt, gewinnt immer. */
function show(node, on) {
  if (!node) return;
  node.style.display = on ? '' : 'none';
  node.hidden = !on;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const allQuestions = () =>
  CONTENT.topics.flatMap(t => t.questions.map(q => ({ topic: t, q, box: boxOf(t.id, q.id) })));

const topicById = id => CONTENT.topics.find(t => t.id === id);
const projectById = id => PROJECTS.find(p => p.id === id);

/* ── Router ────────────────────────────────────────────── */

/* Pfad -> Ansicht. Die Lernapp hängt bewusst unter /lernapp, damit sie ein
   Projekt unter mehreren bleibt und nicht die Startseite bestimmt. */
const ROUTES = {
  'start':          { view: 'start',    render: renderBoard,        tab: '#/start' },
  'projekte':       { view: 'projekte', render: renderProjects,     tab: '#/projekte' },
  'lernapp':        { view: 'lernapp',  render: renderLernappHome,  tab: '#/projekte', bar: true },
  'lernapp/lernen': { view: 'lernen',   render: renderTopicList,    tab: '#/projekte', bar: true },
  'lernapp/ueben':  { view: 'ueben',    render: renderUeben,        tab: '#/projekte', bar: true },
  'lernapp/stand':  { view: 'stand',    render: renderStand,        tab: '#/projekte', bar: true },
};

/* Alte Adressen der reinen Lernapp weiterleiten. */
const ALIAS = {
  'lernen': 'lernapp/lernen',
  'ueben':  'lernapp/ueben',
  'stand':  'lernapp/stand',
  'ueber':  'start',
};

function currentPath() {
  const raw = location.hash.replace(/^#\/?/, '').split('?')[0];
  return raw || 'start';
}

function route() {
  let path = currentPath();
  if (ALIAS[path]) {
    location.replace('#/' + ALIAS[path]);
    return;
  }

  let entry = ROUTES[path];
  let projectId = null;

  if (!entry && path.startsWith('projekt/')) {
    projectId = path.slice('projekt/'.length);
    if (projectById(projectId)) {
      entry = { view: 'projekt', render: () => renderProject(projectId), tab: '#/projekte' };
    }
  }
  if (!entry) {
    entry = ROUTES['start'];
    path = 'start';
  }

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + entry.view).classList.add('active');

  markCurrent('#nav a', entry.tab);
  show($('#lernapp-bar'), !!entry.bar);
  if (entry.bar) markCurrent('#subnav a', '#/' + path);

  if (entry.render) entry.render();
  window.scrollTo(0, 0);
}

function markCurrent(selector, href) {
  document.querySelectorAll(selector).forEach(a => {
    if (a.getAttribute('href') === href) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/* ── Startseite: Projekte als Statusliste ──────────────── */

/* Wer Monitoring baut, darf seine Startseite wie eine Statusseite lesen.
   Die Zustände stehen in projects.json, hier wird nichts live gemessen. */
function renderBoard() {
  const board = $('#board');
  board.textContent = '';

  PROJECTS.forEach(p => {
    const row = el('a', 'board-row');
    row.href = p.kind === 'detail' ? '#/projekt/' + p.id : p.href;
    if (p.kind === 'extern') { row.rel = 'noopener'; row.target = '_blank'; }

    row.appendChild(el('span', 'dot dot-' + (p.state || 'extern')));
    row.appendChild(el('span', 'board-name', p.title));
    row.appendChild(el('span', 'board-state', p.stateLabel || ''));
    board.appendChild(row);
  });
}

/* ── Projektübersicht ──────────────────────────────────── */

function renderProjects() {
  const list = $('#project-list');
  list.textContent = '';

  PROJECTS.forEach(p => {
    const href = p.kind === 'detail' ? '#/projekt/' + p.id : p.href;
    const card = el('a', 'card card-project');
    card.href = href;
    if (p.kind === 'extern') {
      card.rel = 'noopener';
      card.target = '_blank';
    }

    card.appendChild(el('p', 'meta', p.meta));
    card.appendChild(el('h3', null, p.title));
    card.appendChild(el('p', null, p.tagline));
    if (p.note) card.appendChild(el('p', null, p.note));

    const foot = el('p', 'tally', p.status);
    card.appendChild(foot);

    // Fortschrittsstreifen nur dort, wo es eine echte Reihenfolge gibt
    if (p.stages) card.appendChild(stageStrip(p.stages));

    list.appendChild(card);
  });

  renderService();
}

/* Kein Projekt, sondern ein Angebot — darum unter den Karten und
   in eigener Form, ohne Zustandspunkt und ohne Fortschritt. */
function renderService() {
  if (!SERVICE) return;

  // Container notfalls selbst anlegen. Wird noch eine ältere index.html
  // verwendet, fehlt er — ohne das bliebe der Block kommentarlos aus.
  let box = $('#service');
  if (!box) {
    box = el('section', 'service');
    box.id = 'service';
    $('#project-list').parentNode.insertBefore(box, $('#project-list').nextSibling);
  }
  show(box, true);

  box.textContent = '';
  box.appendChild(el('h2', null, SERVICE.title));
  if (SERVICE.intro) box.appendChild(el('p', 'lead', SERVICE.intro));

  SERVICE.items.forEach(it => {
    const p = el('p', 'service-item');
    p.appendChild(el('strong', null, it.name + '.'));
    p.appendChild(document.createTextNode(' ' + it.text));
    box.appendChild(p);
  });

  if (SERVICE.link) box.appendChild(linkRow([{ ...SERVICE.link, primary: true }]));
}

function stageStrip(stages) {
  const strip = el('div', 'bitfield bitfield-tight');
  stages.forEach(s => {
    const bit = el('div', 'bit' + (s.done ? ' b3' : ''));
    bit.title = 'Stufe ' + s.n + ' — ' + s.title + (s.done ? '' : ' (offen)');
    strip.appendChild(bit);
  });
  return strip;
}

/* ── Eine Projektseite ─────────────────────────────────── */

function renderProject(id) {
  const p = projectById(id);
  const root = $('#view-projekt');
  root.textContent = '';

  const back = el('a', 'backlink', '← Alle Projekte');
  back.href = '#/projekte';
  root.appendChild(back);

  root.appendChild(el('p', 'meta', p.meta));
  root.appendChild(el('h1', null, p.title));
  root.appendChild(el('p', 'lead', p.tagline));

  if (p.stack) {
    const chips = el('ul', 'chips');
    p.stack.forEach(s => chips.appendChild(el('li', null, s)));
    root.appendChild(chips);
  }

  if (p.intro) {
    const prose = el('div', 'prose');
    p.intro.forEach(t => prose.appendChild(el('p', null, t)));
    root.appendChild(prose);
  }

  if (p.parts) {
    root.appendChild(el('h2', null, 'Aufbau'));
    if (p.partsNote) root.appendChild(el('p', 'lead', p.partsNote));
    const dl = el('dl', 'parts');
    p.parts.forEach(part => {
      dl.appendChild(el('dt', null, part.name));
      dl.appendChild(el('dd', null, part.note));
    });
    root.appendChild(dl);
  }

  if (p.stages) {
    const done = p.stages.filter(s => s.done).length;
    root.appendChild(el('h2', null, 'Stufen'));
    root.appendChild(el('p', 'lead',
      done + ' von ' + p.stages.length + ' abgeschlossen. Jede Stufe ergänzt einen Baustein.'));
    root.appendChild(stageStrip(p.stages));

    const ol = el('ol', 'stages');
    p.stages.forEach(s => {
      const li = el('li', 'stage' + (s.done ? ' done' : ''));
      li.appendChild(el('span', 'stage-n', String(s.n)));
      const body = el('div');
      body.appendChild(el('h3', null, s.title));
      body.appendChild(el('p', null, s.note));
      li.appendChild(body);
      ol.appendChild(li);
    });
    root.appendChild(ol);
  }

  if (p.reflection) {
    root.appendChild(el('h2', null, 'Was ich dabei gelernt habe'));
    p.reflection.forEach(r => {
      const block = el('section', 'reflect');
      block.appendChild(el('h3', null, r.heading));
      r.body.forEach(t => block.appendChild(el('p', null, t)));
      root.appendChild(block);
    });
  }

  if (p.repoNote) root.appendChild(el('p', 'lead repo-note', p.repoNote));
  if (p.links) root.appendChild(linkRow(p.links));
}

function linkRow(links) {
  const row = el('p', 'actions');
  links.forEach(l => {
    const a = el('a', 'btn' + (l.primary ? '' : ' btn-quiet'), l.label);
    a.href = l.href;
    a.rel = 'noopener';
    if (/^https?:/.test(l.href)) a.target = '_blank';
    row.appendChild(a);
  });
  return row;
}

/* ── Lernapp: Übersicht ────────────────────────────────── */

function renderLernappHome() {
  const items = allQuestions();

  // Vor der ersten Antwort gibt es nichts zu zeigen. Ein Feld voller
  // "kannst du noch nicht" ist als Begrüssung das falsche Signal.
  show($('#lernapp-fortschritt'), PROGRESS.answered > 0);
  if (!PROGRESS.answered) return;

  const field = $('#bitfield');
  field.textContent = '';
  items.forEach(it => {
    const bit = el('div', 'bit b' + it.box);
    bit.title = it.topic.title + ' — ' + it.q.question;
    field.appendChild(bit);
  });

  const neu  = items.filter(it => it.box === 1).length;
  const fast = items.filter(it => it.box === 2).length;
  const safe = items.filter(it => it.box === 3).length;

  $('#stand-satz').textContent = headline(safe, items.length);
  captionNode().textContent =
    'Ein Kästchen ist eine Frage. Beantwortest du sie richtig, rückt sie eine Stufe weiter: '
    + 'grau heisst offen oder zuletzt daneben, gelb einmal geschafft, grün sitzt. '
    + 'Zeig mit der Maus darauf, um die Frage zu sehen. '
    + 'Gerade: ' + neu + ' offen · ' + fast + ' fast · ' + safe + ' sicher.';
}

/* Ermutigung statt Zählerstand. Stufen nach Anteil sicherer Fragen. */
function headline(safe, total) {
  const pct = total ? safe / total : 0;
  if (!PROGRESS.answered)  return 'Starte deine Lernreise in die IT.';
  if (safe === 0)          return 'Der Anfang ist gemacht.';
  if (pct < 0.25)          return 'Es kommt in Bewegung — weiter so.';
  if (pct < 0.5)           return 'Du bist auf dem guten Weg.';
  if (pct < 0.75)          return 'Mehr als die Hälfte sitzt schon.';
  if (pct < 1)             return 'Du hast es fast geschafft!';
  return 'Alles sitzt. Du hast bewiesen, dass du es kannst! :-)';
}

/* Erklärkasten hinter einem (?) neben der Legende — wird einmal angelegt. */
function captionNode() {
  let box = document.getElementById('bitfield-caption');
  if (!box) {
    const legend = $('#bitfield-legend');
    const btn = el('button', 'hint-btn', '(?)');
    btn.type = 'button';
    btn.title = 'Was bedeutet dieser Balken?';
    btn.setAttribute('aria-label', 'Erklärung zum Wissensstand');
    btn.setAttribute('aria-expanded', 'false');
    legend.appendChild(btn);

    box = el('p', 'infobox');
    box.id = 'bitfield-caption';
    legend.parentNode.insertBefore(box, legend.nextSibling);
    show(box, false);

    btn.addEventListener('click', () => {
      const auf = box.style.display === 'none';
      show(box, auf);
      btn.setAttribute('aria-expanded', String(auf));
      btn.textContent = auf ? '(×)' : '(?)';
    });
  }
  return box;
}

/* ── Lernapp: Lernen ───────────────────────────────────── */

function renderTopicList() {
  show($('#topic-reader'), false);
  show($('#lernen-kopf'), true);
  const list = $('#topic-list');
  show(list, true);
  list.textContent = '';
  CONTENT.topics.forEach(t => {
    const card = el('button', 'card');
    card.type = 'button';
    card.appendChild(el('h3', null, t.title));
    card.appendChild(el('p', null, t.description));
    card.appendChild(el('p', 'tally', t.sections.length + ' Abschnitte · ' + t.questions.length + ' Fragen'));
    card.addEventListener('click', () => renderTopic(t.id));
    list.appendChild(card);
  });
}

/* Gestufte Balken für Abschnitte mit "levels" — oben schmal, unten breit. */
function ladder(levels) {
  const wrap = el('div', 'ladder');
  levels.forEach((lv, i) => {
    const rung = el('div', 'rung');
    const track = el('div', 'track');
    const bar = el('div', 'bar');
    bar.style.width = (38 + i * (62 / Math.max(1, levels.length - 1))) + '%';
    bar.appendChild(el('span', null, lv.label));
    track.appendChild(bar);
    rung.append(track, el('span', 'note', lv.note));
    wrap.appendChild(rung);
  });
  wrap.appendChild(el('p', 'scale', 'Nach unten: langsamer, dafür grösser und günstiger.'));
  return wrap;
}

function renderTopic(id) {
  const t = topicById(id);
  const reader = $('#topic-reader');
  reader.textContent = '';

  const back = el('button', 'backlink', '← Alle Themen');
  back.type = 'button';
  back.addEventListener('click', renderTopicList);
  reader.appendChild(back);

  reader.appendChild(el('h2', null, t.title));
  t.sections.forEach(s => {
    const sec = el('section');
    sec.appendChild(el('h3', null, s.heading));
    sec.appendChild(el('p', null, s.content));
    if (s.levels) sec.appendChild(ladder(s.levels));
    reader.appendChild(sec);
  });

  const foot = el('p', 'actions');
  const quiz = el('button', 'btn', 'Dieses Thema üben');
  quiz.type = 'button';
  quiz.addEventListener('click', () => { pendingTopic = t.id; location.hash = '#/lernapp/ueben'; });
  const back2 = el('button', 'btn btn-quiet', 'Alle Themen');
  back2.type = 'button';
  back2.addEventListener('click', renderTopicList);
  foot.append(quiz, back2);
  reader.appendChild(foot);

  show($('#topic-list'), false);
  show($('#lernen-kopf'), false);
  show(reader, true);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Lernapp: Üben ─────────────────────────────────────── */

function renderUeben() {
  if (pendingTopic !== undefined) {
    const t = pendingTopic;
    pendingTopic = undefined;
    startRound(t);
  } else {
    renderQuizPicker();
  }
}

function renderQuizPicker() {
  show($('#quiz-run'), false);
  show($('#quiz-done'), false);
  show($('#quiz-pick'), true);

  const list = $('#quiz-topics');
  list.textContent = '';

  const mixed = el('button', 'card');
  mixed.type = 'button';
  mixed.appendChild(el('h3', null, 'Alles gemischt'));
  mixed.appendChild(el('p', null, 'Wackelige Fragen aus allen Themen, aufgefüllt mit Wiederholungen.'));
  mixed.addEventListener('click', () => startRound(null));
  list.appendChild(mixed);

  CONTENT.topics.forEach(t => {
    const boxes = t.questions.map(q => boxOf(t.id, q.id));
    const card = el('button', 'card');
    card.type = 'button';
    card.appendChild(el('h3', null, t.title));
    card.appendChild(el('p', null, t.questions.length + ' Fragen'));
    card.appendChild(el('p', 'tally',
      'sitzt ' + boxes.filter(b => b === 3).length +
      ' · fast ' + boxes.filter(b => b === 2).length +
      ' · offen ' + boxes.filter(b => b === 1).length));
    card.addEventListener('click', () => startRound(t.id));
    list.appendChild(card);
  });
}

/* Leitner: zuerst alles aus Box 1, halb aus Box 2, ein Viertel aus Box 3.
   Bleibt Platz, wird mit dem Rest aufgefüllt — eine Runde hat immer ROUND_SIZE Fragen.
   Beides wird reihum über die Themen verteilt, damit jedes drankommt. */
function buildRound(topicId) {
  const pool = allQuestions().filter(it => !topicId || it.topic.id === topicId);
  const b = n => shuffle(pool.filter(it => it.box === n));
  const b2 = b(2), b3 = b(3);
  const dringend = b(1)
    .concat(b2.slice(0, Math.ceil(b2.length / 2)))
    .concat(b3.slice(0, Math.max(1, Math.round(b3.length / 4))));
  const gewaehlt = new Set(dringend);
  const rest = shuffle(pool.filter(it => !gewaehlt.has(it)));
  return interleave(dringend).concat(interleave(rest)).slice(0, ROUND_SIZE);
}

/* Reihum eine Frage pro Thema ziehen. Die Reihenfolge innerhalb eines Themas
   bleibt erhalten, wackelige Fragen stehen dort also vorn. */
function interleave(items) {
  const lanes = new Map();
  items.forEach(it => {
    if (!lanes.has(it.topic.id)) lanes.set(it.topic.id, []);
    lanes.get(it.topic.id).push(it);
  });
  const queues = shuffle(Array.from(lanes.values()));
  const out = [];
  let taken = true;
  while (taken) {
    taken = false;
    queues.forEach(q => { if (q.length) { out.push(q.shift()); taken = true; } });
  }
  return out;
}

function startRound(topicId) {
  session = { items: buildRound(topicId), i: 0, right: 0, moves: [] };
  show($('#quiz-pick'), false);
  show($('#quiz-done'), false);
  show($('#quiz-run'), true);
  showQuestion();
}

function showQuestion() {
  const it = session.items[session.i];
  $('#q-counter').textContent = 'Frage ' + (session.i + 1) + ' von ' + session.items.length;
  $('#q-topic').textContent = it.topic.title;
  $('#q-rail').style.width = (session.i / session.items.length * 100) + '%';
  $('#q-text').textContent = it.q.question;
  show($('#q-feedback'), false);

  const box = $('#q-input');
  box.textContent = '';

  if (it.q.type === 'choice') {
    const wrap = el('div', 'opts');
    shuffle(it.q.options).forEach((opt, n) => {
      const btn = el('button', 'opt');
      btn.type = 'button';
      btn.dataset.value = opt;
      btn.appendChild(el('span', 'tick', String.fromCharCode(65 + n)));
      btn.appendChild(document.createTextNode(opt));
      btn.addEventListener('click', () => answer(opt, wrap, btn));
      wrap.appendChild(btn);
    });
    box.appendChild(wrap);
  } else {
    const form = el('div', 'textform');
    const input = el('input');
    input.type = 'text';
    input.placeholder = 'Deine Antwort';
    input.autocomplete = 'off';
    const btn = el('button', 'btn', 'Prüfen');
    btn.type = 'button';
    const go = () => { if (input.value.trim()) answer(input.value, null, null); };
    btn.addEventListener('click', go);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    form.append(input, btn);
    box.appendChild(form);
    input.focus();
  }
}

function answer(given, optWrap, clicked) {
  const it = session.items[session.i];
  const right = isRight(it.q, given);
  const move = recordAnswer(it.topic.id, it.q.id, right);
  if (right) session.right++;
  session.moves.push({ q: it.q, topic: it.topic, right: right, move: move });

  if (optWrap) {
    optWrap.querySelectorAll('.opt').forEach(o => { o.disabled = true; });
    if (clicked) clicked.classList.add(right ? 'right' : 'wrong');
    if (!right) {
      optWrap.querySelectorAll('.opt').forEach(o => {
        if (isRight(it.q, o.dataset.value)) o.classList.add('right');
      });
    }
  } else {
    $('#q-input').textContent = '';
  }

  const fb = $('#q-feedback');
  fb.className = 'feedback ' + (right ? 'right' : 'wrong');
  fb.textContent = '';
  fb.appendChild(el('p', 'verdict', right ? 'Richtig' : 'Nicht richtig'));
  if (!right) fb.appendChild(el('p', null, 'Richtig wäre: ' + it.q.answer[0]));
  fb.appendChild(el('p', null, it.q.explanation));

  const actions = el('p', 'actions');
  const last = session.i === session.items.length - 1;
  const next = el('button', 'btn', last ? 'Runde abschliessen' : 'Weiter');
  next.type = 'button';
  next.addEventListener('click', () => {
    session.i++;
    if (session.i >= session.items.length) finishRound();
    else showQuestion();
  });
  actions.appendChild(next);
  fb.appendChild(actions);
  show(fb, true);
  next.focus();
}

function finishRound() {
  show($('#quiz-run'), false);
  show($('#quiz-done'), true);
  const total = session.items.length;
  $('#done-headline').textContent = session.right + ' von ' + total + ' richtig';

  const up = session.moves.filter(m => m.move.to > m.move.from).length;
  const down = session.moves.filter(m => m.move.to < m.move.from).length;
  $('#done-detail').textContent =
    up + ' Fragen sind aufgestiegen, ' + down + ' zurückgefallen. Die Fehler kommen in der nächsten Runde wieder.';

  const list = $('#done-moves');
  list.textContent = '';
  session.moves.filter(m => !m.right).forEach(m => {
    const card = el('div', 'card card-static');
    card.appendChild(el('h3', null, m.q.question));
    card.appendChild(el('p', null, m.q.answer[0] + ' — ' + m.q.explanation));
    list.appendChild(card);
  });
}

/* ── Lernapp: Stand ────────────────────────────────────── */

function renderStand() {
  const items = allQuestions();
  const body = $('#stand-body');
  body.textContent = '';

  const quote = PROGRESS.answered
    ? Math.round(PROGRESS.correct / PROGRESS.answered * 100) + '%'
    : '—';
  const figures = el('div', 'figures');
  [[items.filter(i => i.box === 3).length + '/' + items.length, 'Fragen sitzen'],
   [quote, 'Trefferquote'],
   [String(PROGRESS.answered), 'Antworten insgesamt'],
   [streak() + ' Tage', 'Serie']].forEach(([big, small]) => {
    const f = el('div', 'figure');
    f.appendChild(el('strong', null, big));
    f.appendChild(el('span', null, small));
    figures.appendChild(f);
  });
  body.appendChild(figures);

  CONTENT.topics.forEach(t => {
    const boxes = t.questions.map(q => boxOf(t.id, q.id));
    const row = el('div', 'card card-static');
    row.appendChild(el('h3', null, t.title));
    const strip = el('div', 'bitfield');
    boxes.forEach(b => strip.appendChild(el('div', 'bit b' + b)));
    row.appendChild(strip);
    row.appendChild(el('p', 'tally', 'sitzt ' + boxes.filter(b => b === 3).length +
      ' · fast sicher ' + boxes.filter(b => b === 2).length +
      ' · offen ' + boxes.filter(b => b === 1).length));
    body.appendChild(row);
  });
}

/* ── Daten exportieren, importieren, löschen ───────────── */

function notify(text) {
  const msg = $('#data-msg');
  msg.textContent = text;
  show(msg, true);
}

function setupDataButtons() {
  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(PROGRESS, null, 2)], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lernstand-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    notify('Datei wurde heruntergeladen.');
  });

  $('#btn-import').addEventListener('click', () => $('#file-import').click());

  $('#file-import').addEventListener('change', ev => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data.boxes !== 'object') throw new Error('Kein Lernstand');
        PROGRESS = Object.assign(emptyProgress(), data);
        saveProgress();
        notify('Lernstand übernommen.');
        renderStand();
      } catch (err) {
        notify('Die Datei ist kein gültiger Lernstand.');
      }
    };
    reader.readAsText(file);
    ev.target.value = '';
  });

  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Lernstand in diesem Browser löschen? Das lässt sich nicht rückgängig machen.')) return;
    PROGRESS = emptyProgress();
    saveProgress();
    renderStand();
    notify('Lernstand gelöscht.');
  });
}

/* ── Start ─────────────────────────────────────────────── */

async function laden(datei) {
  // no-cache erzwingt eine Rückfrage beim Server. Ohne das liefert der
  // Browser gerne die alte JSON-Datei aus, obwohl sie längst geändert ist.
  const res = await fetch(datei, { cache: 'no-cache' });
  if (!res.ok) throw new Error(datei + ': HTTP ' + res.status);
  return res.json();
}

async function boot() {
  try {
    const [content, projects] = await Promise.all([
      laden('content.json'),
      laden('projects.json'),
    ]);
    CONTENT = content;
    PROJECTS = projects.projects;
    SERVICE = projects.service || null;
  } catch (err) {
    console.error(err);
    document.querySelector('main').innerHTML =
      '<h1>Inhalte nicht geladen</h1><p class="lead">content.json oder projects.json ist nicht erreichbar. '
      + 'Lokal geht das nur über einen Webserver, nicht per Doppelklick auf die Datei: '
      + '<code>python3 -m http.server</code> im Projektordner starten und '
      + '<code>http://localhost:8000</code> öffnen.</p>';
    return;
  }
  setupDataButtons();
  window.addEventListener('hashchange', route);
  route();
}

boot();
