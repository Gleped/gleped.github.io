'use strict';
/* =========================================================
   Mit – modulet Træning (bygget videre på TrainLog)
   Rutiner, træning med forudfyldte sæt, øvelser med
   statistik og historik. Øvelsesnavne er på engelsk.
   Bruger kernens hjælpere fra app.js (db, S, dialog, nav …).
   ========================================================= */

const MUSCLES = [
  ['chest', 'Bryst'], ['back', 'Ryg'], ['shoulders', 'Skuldre'], ['biceps', 'Biceps'], ['triceps', 'Triceps'],
  ['quads', 'Forlår'], ['hamstrings', 'Baglår'], ['glutes', 'Balder'], ['calves', 'Lægge'], ['abs', 'Mave'], ['other', 'Andet'],
];
const MUSCLE_KEYS = MUSCLES.map((m) => m[0]);
const normMuscle = (m) => { const k = String(m || '').toLowerCase(); return MUSCLE_KEYS.includes(k) ? k : 'other'; };
const muscleName = (k) => (MUSCLES.find((m) => m[0] === k) || [null, 'Andet'])[1];

const SEED_EXERCISES = [
  ['Bench Press', 'chest'], ['Incline Dumbbell Press', 'chest'], ['Overhead Press', 'shoulders'],
  ['Lateral Raise', 'shoulders'], ['Triceps Pushdown', 'triceps'], ['Pull-up', 'back'], ['Barbell Row', 'back'],
  ['Lat Pulldown', 'back'], ['Barbell Curl', 'biceps'], ['Squat', 'quads'], ['Leg Press', 'quads'],
  ['Romanian Deadlift', 'hamstrings'], ['Leg Curl', 'hamstrings'], ['Standing Calf Raise', 'calves'],
];

async function seedTrainIfNeeded() {
  if (await db.get('meta', 'seededTrain')) return;
  if (!S.exercises.length) {
    const ex = SEED_EXERCISES.map(([name, muscle]) => ({ id: uid(), name, muscle }));
    await db.put('exercises', ex);
    S.exercises = ex;
  }
  await db.put('meta', { id: 'seededTrain', at: Date.now() });
}

/* ---------- Hjælpere ---------- */
const numv = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) && n >= 0 ? n : 0; };
const fmtKg = (n) => String(+n).replace('.', ',');
const setStr = (s) => `${fmtKg(s.kg)} kg × ${s.reps}`;
const exById = (id) => byId(S.exercises, id);
const exName = (id) => exById(id)?.name || '(slettet øvelse)';
const exSorted = () => [...S.exercises].sort((a, b) => coll.compare(a.name, b.name));
const workoutsDesc = () => [...S.workouts].sort((a, b) => b.date.localeCompare(a.date));
const fmtWDate = (iso) => fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function exOptions() {
  return '<option value="">Vælg øvelse …</option>' + MUSCLES.map(([k, label]) => {
    const xs = exSorted().filter((e) => normMuscle(e.muscle) === k);
    return xs.length ? `<optgroup label="${label}">${xs.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</optgroup>` : '';
  }).join('');
}
function exHistory(exId) {
  const out = [];
  for (const w of workoutsDesc()) for (const en of w.entries) if (en.exId === exId) out.push({ wid: w.id, date: w.date, routine: w.routine, sets: en.sets });
  return out;
}
const lastSets = (exId) => { const h = exHistory(exId); return h.length ? h[0].sets : null; };
const prefill = (id) => {
  const l = lastSets(id);
  return l && l.length ? l.map((s) => ({ kg: fmtKg(s.kg), reps: String(s.reps) })) : [0, 1, 2].map(() => ({ kg: '', reps: '' }));
};

let draftTimer;
function saveDraft(now = false) {
  clearTimeout(draftTimer);
  const write = () => (S.trainDraft ? db.put('meta', { id: 'trainDraft', draft: S.trainDraft }) : db.del('meta', 'trainDraft')).catch(() => toast('Kunne ikke gemme træningen på enheden'));
  if (now) write(); else draftTimer = setTimeout(write, 300);
}

function spark(vals) {
  if (vals.length < 2) return '';
  const w = 300, h = 80, p = 8, mn = Math.min(...vals), mx = Math.max(...vals);
  const x = (i) => p + (i * (w - 2 * p)) / (vals.length - 1);
  const y = (v) => (mx === mn ? h / 2 : h - p - ((v - mn) * (h - 2 * p)) / (mx - mn));
  return `<svg viewBox="0 0 ${w} ${h}" class="spark" preserveAspectRatio="none"><polyline points="${vals.map((v, i) => x(i) + ',' + y(v)).join(' ')}"/>${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.2"/>`).join('')}</svg>`;
}

/* ---------- Routing for modulet ---------- */
function routeTrain(p, q) {
  const [, a, b] = p;
  if (!a) return viewTrain();
  if (a === 'routines') return viewRoutines();
  if (a === 'routine') return viewRoutineForm(b === 'new' ? null : b);
  if (a === 'exercises') return viewExercises();
  if (a === 'exercise') return viewExercise(b);
  if (a === 'history') return viewHistory();
  viewNotFound();
}

/* =========================================================
   TRÆN – start eller fortsæt en træning
   ========================================================= */
function viewTrain() {
  setTab('train');
  if (S.trainDraft) return viewWorkout();
  setTop({ title: 'Træn' });
  const last = workoutsDesc()[0];
  view.innerHTML = `
    ${last ? `<p class="muted small" style="margin:2px 2px 12px">Seneste træning: <b>${fmtWDate(last.date)}</b> · ${esc(last.routine)}</p>` : ''}
    ${S.routines.length ? `<div class="tlist">${S.routines.map((r) => {
      const lastR = S.workouts.filter((w) => w.routineId === r.id || w.routine === r.name).sort((x, y) => y.date.localeCompare(x.date))[0];
      return `<div class="tcard row-card">
        <div class="grow"><h3>${esc(r.name)}</h3>
          <small class="muted">${plural(r.exerciseIds.length, 'øvelse', 'øvelser')}${lastR ? ' · sidst ' + fmtDate(lastR.date, { day: 'numeric', month: 'short' }) : ''}</small></div>
        <button class="btn primary small" data-action="start" data-id="${r.id}">Start</button>
      </div>`; }).join('')}</div>`
      : `<div class="tcard muted">Du har ingen rutiner endnu. Opret en under <a href="#/train/routines">Rutiner</a>, eller start en tom træning herunder.</div>`}
    <button class="btn ghost block" style="margin-top:12px" data-action="start-empty">${ICON.plus} Start tom træning</button>`;
  H = {
    start: (el) => {
      const r = byId(S.routines, el.dataset.id);
      if (!r) return;
      S.trainDraft = { routine: r.name, routineId: r.id, date: new Date().toISOString(), items: r.exerciseIds.filter(exById).map((id) => ({ exId: id, sets: prefill(id) })) };
      saveDraft(true); viewTrain();
    },
    'start-empty': () => {
      S.trainDraft = { routine: 'Træning', routineId: null, date: new Date().toISOString(), items: [] };
      saveDraft(true); viewTrain();
    },
  };
}

function viewWorkout() {
  const d = S.trainDraft;
  setTop({ title: d.routine, actions: `<button class="btn small danger-ghost" data-action="cancel">Annuller</button>` });
  renderWorkout();
  H = {
    onInput: (e) => {
      const t = e.target;
      if (t.dataset.f && S.trainDraft) { S.trainDraft.items[+t.dataset.i].sets[+t.dataset.j][t.dataset.f] = t.value; saveDraft(); }
    },
    onChange: (e) => {
      if (e.target.id === 'addEx' && e.target.value) {
        S.trainDraft.items.push({ exId: e.target.value, sets: prefill(e.target.value) });
        saveDraft(true); renderWorkout();
        $$('.wcard').pop()?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    cancel: async () => {
      if (!(await confirmDlg('Kassér træningen?', 'Det, du har tastet ind i denne træning, bliver ikke gemt.', 'Kassér'))) return;
      S.trainDraft = null; saveDraft(true); viewTrain();
    },
    'rm-item': async (el) => {
      const it = S.trainDraft.items[+el.dataset.i];
      if (it.sets.some((s) => s.reps) && !(await confirmDlg('Fjern øvelse?', `<b>${esc(exName(it.exId))}</b> fjernes fra denne træning.`, 'Fjern'))) return;
      S.trainDraft.items.splice(+el.dataset.i, 1); saveDraft(true); renderWorkout();
    },
    'add-set': (el) => {
      const sets = S.trainDraft.items[+el.dataset.i].sets, prev = sets[sets.length - 1];
      sets.push({ kg: prev ? prev.kg : '', reps: prev ? prev.reps : '' });
      saveDraft(true); renderWorkout();
    },
    'rm-set': (el) => { S.trainDraft.items[+el.dataset.i].sets.splice(+el.dataset.j, 1); saveDraft(true); renderWorkout(); },
    finish: finishWorkout,
  };
}

function renderWorkout() {
  const d = S.trainDraft;
  view.innerHTML = `
    <p class="muted small" style="margin:2px 2px 12px">Startet ${fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })} kl. ${new Date(d.date).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}</p>
    ${d.items.map((it, i) => {
      const last = lastSets(it.exId);
      return `<div class="tcard wcard">
        <div class="row-head"><h3 class="grow">${esc(exName(it.exId))}</h3>
          <button class="icon-btn small" data-action="rm-item" data-i="${i}" aria-label="Fjern øvelse">${ICON.x}</button></div>
        <div class="muted small">${last ? 'Sidst: ' + last.map(setStr).join(' · ') : 'Ingen historik endnu'}</div>
        <div class="sets">
          <span class="h">Sæt</span><span class="h">kg</span><span class="h">Gentagelser</span><span></span>
          ${it.sets.map((s, j) => `<span class="setno">${j + 1}</span>
            <input type="text" inputmode="decimal" data-i="${i}" data-j="${j}" data-f="kg" value="${esc(s.kg)}" placeholder="kg">
            <input type="text" inputmode="numeric" data-i="${i}" data-j="${j}" data-f="reps" value="${esc(s.reps)}" placeholder="antal">
            <button class="icon-btn small" data-action="rm-set" data-i="${i}" data-j="${j}" aria-label="Fjern sæt"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>`).join('')}
        </div>
        <button class="btn ghost small" style="margin-top:10px" data-action="add-set" data-i="${i}">${ICON.plus} Sæt</button>
      </div>`;
    }).join('')}
    <div class="tcard">
      <label class="field"><span>Tilføj øvelse</span><select id="addEx" class="select">${exOptions()}</select></label>
    </div>
    <button class="btn primary block" style="min-height:52px" data-action="finish">Afslut træning</button>`;
}

async function finishWorkout() {
  const d = S.trainDraft;
  const entries = d.items.map((it) => ({
    exId: it.exId,
    sets: it.sets.map((s) => ({ kg: numv(s.kg), reps: Math.round(numv(s.reps)) })).filter((s) => s.reps > 0),
  })).filter((e) => e.sets.length);
  if (!entries.length) { toast('Log mindst ét sæt (gentagelser) først'); return; }
  const w = { id: uid(), date: d.date, routine: d.routine, routineId: d.routineId || null, entries };
  try {
    await db.put('workouts', w);
    S.workouts.push(w);
    S.trainDraft = null; saveDraft(true);
    const sets = entries.reduce((n, e) => n + e.sets.length, 0);
    toast(`Træning gemt – ${plural(entries.length, 'øvelse', 'øvelser')}, ${plural(sets, 'sæt', 'sæt')}`);
    viewTrain();
    window.scrollTo(0, 0);
  } catch (err) { toast('Kunne ikke gemme: ' + err.message); }
}

/* =========================================================
   RUTINER
   ========================================================= */
function viewRoutines() {
  setTab('routines');
  setTop({ title: 'Rutiner' });
  view.innerHTML = S.routines.length
    ? `<ul class="list" style="margin-top:0">${S.routines.map((r) => `<li><a class="row" href="#/train/routine/${r.id}">
        <div class="grow"><strong>${esc(r.name)}</strong><small>${esc(r.exerciseIds.map(exName).join(' · ') || 'Ingen øvelser')}</small></div>${ICON.chev}</a></li>`).join('')}</ul>`
    : `<div class="empty"><h3>Ingen rutiner endnu</h3><p>En rutine er en fast liste af øvelser, fx “Push Day” eller “Ben”.</p>
        <button class="btn primary" data-action="new">${ICON.plus} Ny rutine</button></div>`;
  view.insertAdjacentHTML('beforeend', `<button class="fab" data-action="new" aria-label="Ny rutine">${ICON.plus}</button>`);
  H = { new: () => nav('/train/routine/new') };
}

let rdraft = null;
function viewRoutineForm(id) {
  const r = id ? byId(S.routines, id) : null;
  if (id && !r) return viewNotFound();
  setTab(null);
  rdraft = { id: r?.id || uid(), name: r?.name || '', exerciseIds: [...(r?.exerciseIds || [])] };
  setTop({ title: r ? 'Rediger rutine' : 'Ny rutine', back: '/train/routines', actions: `<button class="btn small primary" data-action="save">Gem</button>` });
  view.innerHTML = `<form class="form" autocomplete="off" onsubmit="return false">
    <label class="field"><span>Navn</span><input data-field="name" value="${esc(rdraft.name)}" placeholder="Fx Push Day"></label>
    <div class="field"><span>Øvelser</span><ul class="list compact" id="rex" style="margin:0"></ul>
      <select id="rAddEx" class="select" style="margin-top:4px">${exOptions()}</select></div>
    <div class="form-actions">
      <button type="button" class="btn primary block" data-action="save">Gem rutine</button>
      ${r ? `<button type="button" class="btn danger-ghost block" data-action="delete">${ICON.trash} Slet rutine</button>` : ''}
    </div>
  </form>`;
  renderRoutineEx();
  if (!r) setTimeout(() => $('[data-field=name]')?.focus(), 80);
  const move = (i, dir) => { const a = rdraft.exerciseIds, j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; renderRoutineEx(); };
  H = {
    onInput: (e) => { if (e.target.dataset.field === 'name') rdraft.name = e.target.value; },
    onChange: (e) => { if (e.target.id === 'rAddEx' && e.target.value) { rdraft.exerciseIds.push(e.target.value); e.target.value = ''; renderRoutineEx(); } },
    up: (el) => move(+el.dataset.i, -1),
    down: (el) => move(+el.dataset.i, 1),
    rm: (el) => { rdraft.exerciseIds.splice(+el.dataset.i, 1); renderRoutineEx(); },
    save: async () => {
      const name = rdraft.name.trim();
      if (!name) { toast('Giv rutinen et navn'); $('[data-field=name]').focus(); return; }
      const rec = { id: rdraft.id, name, exerciseIds: rdraft.exerciseIds };
      await db.put('routines', rec); upsert(S.routines, rec);
      toast('Rutine gemt'); goBack('/train/routines');
    },
    delete: async () => {
      if (!(await confirmDlg('Slet rutine?', `<b>${esc(r.name)}</b> slettes. Dine loggede træninger bevares.`))) return;
      await db.del('routines', r.id); removeFrom(S.routines, r.id);
      toast('Rutine slettet'); goBack('/train/routines');
    },
  };
}
function renderRoutineEx() {
  const a = rdraft.exerciseIds;
  $('#rex').innerHTML = a.length ? a.map((id, i) => `<li><div class="row">
      <span class="setno">${i + 1}</span>
      <div class="grow"><strong>${esc(exName(id))}</strong><small>${esc(muscleName(normMuscle(exById(id)?.muscle)))}</small></div>
      <button type="button" class="icon-btn small" data-action="up" data-i="${i}" aria-label="Flyt op" ${i === 0 ? 'disabled style="opacity:.3"' : ''}><svg viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg></button>
      <button type="button" class="icon-btn small" data-action="down" data-i="${i}" aria-label="Flyt ned" ${i === a.length - 1 ? 'disabled style="opacity:.3"' : ''}><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
      <button type="button" class="icon-btn small" data-action="rm" data-i="${i}" aria-label="Fjern">${ICON.x}</button>
    </div></li>`).join('') : '<li class="pick-empty" style="padding:14px">Vælg øvelser herunder.</li>';
}

/* =========================================================
   ØVELSER
   ========================================================= */
function viewExercises() {
  setTab('exercises');
  setTop({ title: 'Øvelser' });
  view.innerHTML = `
    <div class="searchbar">${ICON.search}<input type="search" id="eq" placeholder="Søg i øvelser" value="${esc(S.ui.eq)}" autocomplete="off"></div>
    <div id="exlist"></div>
    <button class="fab" data-action="new-ex" aria-label="Ny øvelse">${ICON.plus}</button>`;
  renderExList();
  H = {
    onInput: (e) => { if (e.target.id === 'eq') { S.ui.eq = e.target.value; renderExList(); } },
    'new-ex': newExercise,
  };
}
function renderExList() {
  const q = norm(S.ui.eq.trim());
  const xs = exSorted().filter((e) => !q || norm(e.name).includes(q));
  const counts = {};
  S.workouts.forEach((w) => w.entries.forEach((en) => { counts[en.exId] = (counts[en.exId] || 0) + 1; }));
  $('#exlist').innerHTML = xs.length ? MUSCLES.map(([k, label]) => {
    const group = xs.filter((e) => normMuscle(e.muscle) === k);
    return group.length ? `<h4 class="group-h">${label}</h4><ul class="list" style="margin-top:0">${group.map((e) => `
      <li><a class="row" href="#/train/exercise/${e.id}">
        <div class="grow"><strong>${esc(e.name)}</strong><small>${counts[e.id] ? plural(counts[e.id], 'gang', 'gange') + ' logget' : 'Ikke logget endnu'}</small></div>${ICON.chev}
      </a></li>`).join('')}</ul>` : '';
  }).join('') : `<div class="empty">Ingen øvelser matcher.<br><button class="btn primary" data-action="new-ex">${ICON.plus} Ny øvelse</button></div>`;
}

async function newExercise() {
  const v = await dialog({
    title: 'Ny øvelse',
    body: `<input class="d-input" id="nx-name" placeholder="Navn på engelsk, fx Cable Fly" autocomplete="off" value="${esc(S.ui.eq.trim())}">
      <select class="d-input select" id="nx-muscle">${MUSCLES.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>`,
    buttons: [{ label: 'Opret', value: 'ok', cls: 'primary' }, { label: 'Annuller', value: '' }],
  });
  if (v !== 'ok') return;
  const name = ($('#nx-name')?.value || '').trim(), muscle = $('#nx-muscle')?.value || 'other';
  if (!name) { toast('Skriv et navn på øvelsen'); return; }
  if (S.exercises.some((e) => coll.compare(e.name, name) === 0)) { toast('Den øvelse findes allerede'); return; }
  const e = { id: uid(), name, muscle };
  await db.put('exercises', e); S.exercises.push(e);
  toast('Øvelse oprettet');
  if (currentPath === '/train/exercises') renderExList();
}

function viewExercise(id) {
  const e = exById(id);
  if (!e) return viewNotFound();
  setTab('exercises');
  setTop({ title: e.name, back: '/train/exercises', actions: `<button class="icon-btn" data-action="menu" aria-label="Flere valg">${ICON.more}</button>` });
  const hist = exHistory(e.id);
  let best = null, bestRm = 0;
  for (const s of hist.flatMap((x) => x.sets)) {
    if (!best || s.kg > best.kg || (s.kg === best.kg && s.reps > best.reps)) best = s;
    bestRm = Math.max(bestRm, s.kg * (1 + s.reps / 30));
  }
  const tops = hist.slice().reverse().map((x) => Math.max(...x.sets.map((s) => s.kg)));
  view.innerHTML = `
    <div class="ex-head"><h2>${esc(e.name)}</h2><span class="tag">${esc(muscleName(normMuscle(e.muscle)))}</span></div>
    <div class="stat">
      <div><small>Gange</small><b>${hist.length}</b></div>
      <div><small>Bedste sæt</small><b>${best ? setStr(best) : '–'}</b></div>
      <div><small>Est. 1RM</small><b>${bestRm ? fmtKg(Math.round(bestRm * 10) / 10) + ' kg' : '–'}</b></div>
    </div>
    ${tops.length > 1 ? `<div class="tcard"><small class="muted">Tungeste vægt pr. træning</small>${spark(tops)}</div>` : ''}
    <div class="section" style="margin-top:18px"><h3>Historik</h3></div>
    ${hist.length ? `<ul class="history">${hist.map((x) => `<li>
        <div class="h-date">${fmtWDate(x.date)} · ${esc(x.routine)}</div>
        <div>${x.sets.map(setStr).join(' · ')}</div></li>`).join('')}</ul>`
      : '<p class="muted">Ingen historik endnu. Log øvelsen i en træning, så dukker den op her.</p>'}`;
  H = {
    menu: async () => {
      const v = await dialog({
        title: e.name, stack: true,
        buttons: [{ label: 'Omdøb', value: 'rename', cls: 'ghost' }, { label: 'Skift muskelgruppe', value: 'muscle', cls: 'ghost' },
          { label: 'Slet øvelse', value: 'delete', cls: 'danger-ghost' }, { label: 'Annuller', value: '' }],
      });
      if (v === 'rename') {
        const n = await promptDlg('Omdøb øvelse', { value: e.name });
        if (n && n !== e.name) { e.name = n; await db.put('exercises', e); viewExercise(id); }
      } else if (v === 'muscle') {
        const m = await dialog({
          title: 'Muskelgruppe', stack: true,
          buttons: [...MUSCLES.map(([k, l]) => ({ label: l, value: k, cls: k === normMuscle(e.muscle) ? 'primary' : 'ghost' })), { label: 'Annuller', value: '' }],
        });
        if (m) { e.muscle = m; await db.put('exercises', e); viewExercise(id); }
      } else if (v === 'delete') {
        if (hist.length) { toast('Øvelsen har historik og kan ikke slettes. Omdøb den i stedet.'); return; }
        if (!(await confirmDlg('Slet øvelse?', `<b>${esc(e.name)}</b> slettes og fjernes fra dine rutiner.`))) return;
        const affected = S.routines.filter((r) => r.exerciseIds.includes(e.id));
        affected.forEach((r) => { r.exerciseIds = r.exerciseIds.filter((x) => x !== e.id); });
        if (affected.length) await db.put('routines', affected);
        await db.del('exercises', e.id); removeFrom(S.exercises, e.id);
        toast('Øvelse slettet'); goBack('/train/exercises');
      }
    },
  };
}

/* =========================================================
   HISTORIK
   ========================================================= */
function viewHistory() {
  setTab('history');
  setTop({ title: 'Historik' });
  const ws = workoutsDesc();
  view.innerHTML = ws.length ? `<div class="tlist">${ws.map((w) => `<article class="tcard">
      <div class="row-head"><div class="grow"><h3>${fmtWDate(w.date)}</h3><small class="muted">${esc(w.routine)}</small></div>
        <button class="icon-btn small" data-action="del" data-id="${w.id}" aria-label="Slet træning">${ICON.trash}</button></div>
      ${w.entries.map((en) => `<div class="h-entry"><a href="#/train/exercise/${en.exId}">${esc(exName(en.exId))}</a>
        <div class="muted small">${en.sets.map(setStr).join(' · ')}</div></div>`).join('')}
    </article>`).join('')}</div>`
    : '<div class="empty"><h3>Ingen træninger endnu</h3><p>Når du afslutter en træning under Træn, dukker den op her.</p></div>';
  H = {
    del: async (el) => {
      const w = byId(S.workouts, el.dataset.id);
      if (!(await confirmDlg('Slet træning?', `Træningen fra <b>${fmtWDate(w.date)}</b> slettes fra historikken.`))) return;
      await db.del('workouts', w.id); removeFrom(S.workouts, w.id);
      viewHistory();
    },
  };
}
