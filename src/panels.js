// Everything that opens when you use something in the house: habit board, fridge, bed, AI chats...
import {
  state, save, replaceState, uid, today, lastNDays, niceDate, shortDay, esc, sum, clamp,
  earn, boost, levelInfo, habitsDone, focusMinutes, workoutMinutes, avgMood, journalHasContent, streak, NEEDS,
} from './state.js';
import { BOT, BOTS, chat, special, hasKey, renameBot, memoryOf, canShare, updateMemory, weeklyCheckIn, todaysPromise } from './ai.js';
import { weightTrend } from './patterns.js';
import { SHOP_ITEMS } from './world.js';
import { LOOKS } from './avatar.js';

export const hooks = { world: null, avatar: null, onClose: () => {}, onChange: () => {} };

const $ = s => document.querySelector(s);
const panel = () => $('#panel');
let current = null;

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

function reward(key, coins, limit, needs, msg) {
  const got = earn(key, coins, limit);
  boost(needs);
  save();
  toast(msg + (got ? `  +${got} 🪙` : ''));
  if (got) hooks.onReward?.();
}

const dailyPick = (list, salt = 0) => {
  const [y, m, d] = today().split('-').map(Number);
  return list[(y * 372 + m * 31 + d + salt) % list.length];
};

// ---------- open / close ----------

export function openPanel(id) {
  if (current && current !== id) cleanup(current);
  current = id;
  panel().classList.add('open');
  render(true);
}

export function closePanel() {
  if (!current) return;
  cleanup(current);
  current = null;
  panel().classList.remove('open');
  hooks.onClose();
}

export const currentPanel = () => current;

function cleanup(id) {
  if (id === 'calm') stopBreathing();
  if (id.startsWith('chat:')) {
    updateMemory(id.split(':')[1]);
    chatUI.asking = null; chatUI.renaming = false; chatUI.specialHTML = '';
  }
}

export function refresh() { if (current) render(false); }

function render(fresh) {
  const [kind, arg] = current.split(':');
  const def = PANELS[kind];
  const body = $('#panelBody');
  const scroll = body.scrollTop;
  const view = def(arg);
  $('#panelTitle').textContent = view.title;
  body.innerHTML = view.html;
  if (!fresh) body.scrollTop = scroll;
  else body.scrollTop = 0;
  view.after?.();
}

// ---------- reusable bits ----------

const helperBtn = (botId, text) => {
  const b = BOT[botId];
  return `<button class="helper" data-act="openChat" data-bot="${botId}"><span>${b.emoji}</span>${text || `Ask ${b.name}`}</button>`;
};

const needTag = (...keys) => `<div class="need-tags">${keys.map(k => `<span>${NEEDS[k].icon} ${NEEDS[k].label}</span>`).join('')}</div>`;

// ---------- panels ----------

const PANELS = {};

// ✅ Habit board
PANELS.habits = () => {
  const t = today();
  const done = state.habitLog[t] || [];
  const week = lastNDays(7);
  const items = state.habits.map(h => {
    const isDone = done.includes(h.id);
    const s = streak(h.id);
    const dots = week.map(d => `<i class="${(state.habitLog[d] || []).includes(h.id) ? 'on' : ''}" title="${niceDate(d)}"></i>`).join('');
    return `<div class="habit ${isDone ? 'done' : ''}">
      <button class="check" data-act="toggleHabit" data-id="${h.id}" aria-label="${isDone ? 'Undo' : 'Complete'} ${esc(h.name)}">${isDone ? '✓' : ''}</button>
      <div class="habit-name">${esc(h.icon)} ${esc(h.name)}<div class="week-dots">${dots}</div></div>
      <span class="streak">${s ? `🔥 ${s}` : ''}</span>
      <button class="ghost" data-act="delHabit" data-id="${h.id}" aria-label="Remove ${esc(h.name)}">✕</button>
    </div>`;
  }).join('');
  return {
    title: '✅ Habit board',
    html: `
      <p class="muted">Tick off what you really did today. Each habit gives coins once a day.</p>
      <h3>Today · ${habitsDone(t).length}/${state.habits.length}</h3>
      ${items || '<p class="muted">No habits yet. Add one below!</p>'}
      <h3>Add a habit</h3>
      <div class="row">
        <select id="habitIcon" style="flex:0 0 70px">${['⭐', '💧', '🏃', '📖', '🧘', '🥗', '😴', '📵', '🎨', '🎵', '💻', '🧹', '🦷', '☀️', '✍️', '🙏'].map(e => `<option>${e}</option>`).join('')}</select>
        <input id="habitName" placeholder="e.g. Stretch for 5 minutes">
        <button data-act="addHabit">Add</button>
      </div>
      <div class="note">Tip: start tiny. "Put on running shoes" beats "run 5k". Once it sticks, grow it.</div>
      ${helperBtn('sunny', 'Talk to Sunny about staying consistent')}`,
  };
};

// 💻 Focus timer
export const timer = { running: false, duration: 25 * 60, remaining: 25 * 60, endAt: 0, skill: null, tick: null };
const fmtTime = sec => { sec = Math.max(0, Math.round(sec)); return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; };
export const timerText = () => fmtTime(timer.remaining);

let studyBuddy = true;
const PETALS = 10;
function flowerTimer() {
  const k = timer.remaining / timer.duration;
  const petals = Array.from({ length: PETALS }, (_, i) => {
    const a = (i / PETALS) * 360;
    return `<ellipse id="fp${i}" cx="60" cy="26" rx="12" ry="22" transform="rotate(${a} 60 60)" fill="${['#ff5fa2', '#ff9f43', '#ffd93d', '#6fdcb9', '#4fc3ff', '#a98bff'][i % 6]}" stroke="#3b2a3f" stroke-width="2.5" opacity="${i < Math.ceil(k * PETALS) ? 1 : 0.12}"></ellipse>`;
  }).join('');
  return `<svg class="flower-timer" viewBox="0 0 120 120" role="img" aria-label="Flower timer: petals disappear as time passes">${petals}
    <circle cx="60" cy="60" r="20" fill="#ffd93d" stroke="#3b2a3f" stroke-width="2.5"></circle>
    <circle cx="53" cy="57" r="2.4" fill="#3b2a3f"></circle><circle cx="67" cy="57" r="2.4" fill="#3b2a3f"></circle>
    <path d="M52 65 q8 7 16 0" fill="none" stroke="#3b2a3f" stroke-width="2.5" stroke-linecap="round"></path></svg>`;
}

PANELS.focus = () => {
  if (!timer.skill || !state.skills.includes(timer.skill)) timer.skill = state.skills[0] || 'Studying';
  const t = today();
  const steps = state.focusSteps;
  return {
    title: '💻 Study desk',
    html: `
      ${timer.running ? '' : `<p class="muted">How's your energy right now?</p>
      <div class="chips">${[['low', '🪫 Low'], ['okay', '🙂 Okay'], ['high', '⚡ High']].map(([v, l]) => `<button class="chip" data-act="energy" data-v="${v}">${l}</button>`).join('')}</div>`}
      <div class="timer">
        ${flowerTimer()}
        <div class="timer-face" id="timerFace">${fmtTime(timer.remaining)}</div>
        <div class="row presets">
          ${[5, 15, 25, 45, 60].map(m => `<button class="secondary ${timer.duration === m * 60 ? 'on' : ''}" data-act="preset" data-min="${m}" ${timer.running ? 'disabled' : ''}>${m}m</button>`).join('')}
        </div>
        <select id="skillSel" ${timer.running ? 'disabled' : ''}>${state.skills.map(s => `<option ${s === timer.skill ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
        <div class="row center" style="margin-top:10px">
          <button data-act="timerStart">${timer.running ? 'Pause' : timer.remaining < timer.duration ? 'Resume' : 'Start focus'}</button>
          <button class="secondary" data-act="timerStop" ${timer.remaining === timer.duration && !timer.running ? 'disabled' : ''}>Finish &amp; log</button>
        </div>
      </div>
      <label class="row" style="gap:8px;justify-content:center"><input type="checkbox" id="buddyIn" ${studyBuddy ? 'checked' : ''}> 🦉 Study with Owl beside me</label>
      <p class="small muted">Today: ${focusMinutes(t)} focus minutes. The timer keeps running if you walk away.</p>

      <h3>🪜 Tiny steps</h3>
      ${steps.length ? `<ul class="list">${steps.map((st, i) => `<li><label class="row" style="gap:8px;flex:1"><input type="checkbox" data-step="${i}" ${st.done ? 'checked' : ''}> <span style="${st.done ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(st.text)}</span></label><span class="small muted">${st.minutes ? st.minutes + 'm' : ''}</span></li>`).join('')}</ul>
        <button class="ghost small" data-act="clearSteps">Clear steps</button>` : '<p class="small muted">Big task? Let Owl break it into tiny steps.</p>'}
      <button class="secondary" data-act="askOwl" data-i="1">🦉 Break a task down</button>

      <h3>🅿️ Distraction parking lot</h3>
      <p class="small muted">A thought popped up? Park it here and come back later.</p>
      <div class="row"><input id="parkIn" placeholder="e.g. reply to Mia, look up that song"><button data-act="addPark">Park it</button></div>
      ${state.parking.length ? `<ul class="list">${state.parking.map(x => `<li><span>${esc(x.text)}</span><button class="ghost small" data-act="delPark" data-id="${x.id}" aria-label="Remove">✕</button></li>`).join('')}</ul>` : ''}
      ${needTag('energy', 'calm')}
      ${helperBtn('owl', 'Ask Professor Owl for help')}`,
  };
};

function timerTick() {
  timer.remaining = (timer.endAt - Date.now()) / 1000;
  if (timer.remaining <= 0) { timer.remaining = 0; finishTimer(true); return; }
  const f = $('#timerFace');
  if (f) f.textContent = fmtTime(timer.remaining);
  const shown = Math.ceil((timer.remaining / timer.duration) * PETALS);
  for (let i = 0; i < PETALS; i++) document.getElementById('fp' + i)?.setAttribute('opacity', i < shown ? 1 : 0.12);
  if (!timer.halfDone && timer.duration >= 600 && timer.remaining <= timer.duration / 2) {
    timer.halfDone = true;
    toast(`🦉 Still with me? You're halfway there!`);
  }
}

function finishTimer(completed) {
  clearInterval(timer.tick);
  const minutes = Math.round((timer.duration - timer.remaining) / 60);
  timer.running = false;
  timer.remaining = timer.duration;
  hooks.studyBuddy?.(false);
  if (minutes >= 1) {
    state.focus.push({ date: today(), skill: timer.skill, minutes, ts: Date.now() });
    reward('focus', Math.max(1, Math.round(minutes / 5)), Infinity, { energy: -minutes / 6, calm: 4 },
      completed ? `🎉 Focus session done! ${minutes} min of ${timer.skill}` : `Logged ${minutes} min of ${timer.skill}`);
    if (completed) chime();
    const recent = sum(state.focus.filter(x => x.ts && Date.now() - x.ts < 2.5 * 3600e3).map(x => x.minutes));
    if (recent >= 90) setTimeout(() => toast('💧 Hyperfocus alert! Drink some water, stretch and grab a snack.'), 2800);
  } else toast('Too short to log (under 1 minute)');
  refresh();
}

function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [660, 880, 990].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t0 = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o.start(t0); o.stop(t0 + 0.55);
    });
  } catch (e) { /* no audio */ }
}

// 🧠 Skills whiteboard
PANELS.skills = () => {
  const totals = state.skills.map(s => ({ s, m: sum(state.focus.filter(f => f.skill === s).map(f => f.minutes)) }));
  return {
    title: '🧠 Skills & courses',
    html: `
      <h3>📚 My courses</h3>
      ${state.courses.length ? state.courses.map(c => {
        const all = c.units.flatMap(u => u.lessons), done = all.filter(l => l.done).length;
        return `<button class="course-row" data-act="openCourse" data-id="${c.id}"><b>${esc(c.title)}</b><span class="small muted">${done} of ${all.length} lessons</span><div class="bar"><i style="width:${Math.round((done / Math.max(1, all.length)) * 100)}%"></i></div></button>`;
      }).join('') : '<p class="small muted">No courses yet. Professor Owl can build you a whole course on anything.</p>'}
      <button class="secondary" data-act="askOwl" data-i="0">🦉 Build a new course</button>
      <h3>🧠 Skills</h3>
      <p class="muted">Everything you're getting better at, and how many hours you've put in.</p>
      <ul class="list">${totals.map(({ s, m }) => `<li><span>${esc(s)}</span><span class="muted">${(m / 60).toFixed(1)} h
        <button class="ghost" data-act="delSkill" data-skill="${esc(s)}" aria-label="Remove ${esc(s)}">✕</button></span></li>`).join('')}</ul>
      <h3>Add a skill or subject</h3>
      <div class="row"><input id="skillName" placeholder="e.g. Spanish, Guitar, Math"><button data-act="addSkill">Add</button></div>
      <h3>Practiced away from the desk?</h3>
      <div class="row">
        <select id="manualSkill">${state.skills.map(s => `<option>${esc(s)}</option>`).join('')}</select>
        <input id="manualMin" type="number" min="1" placeholder="Minutes" style="flex:0 0 100px">
        <button class="secondary" data-act="logManual">Log</button>
      </div>`,
  };
};

// 📚 Flashcards
const flash = { index: 0, showAnswer: false };
PANELS.flashcards = () => {
  const n = state.cards.length;
  const card = state.cards[flash.index % Math.max(1, n)];
  return {
    title: '📚 Flashcard shelf',
    html: `
      ${card ? `
        <button class="flashcard" data-act="flip">${esc(flash.showAnswer ? card.a : card.q)}</button>
        <p class="small muted center">${flash.showAnswer ? 'Answer' : 'Tap the card to flip it'} · card ${(flash.index % n) + 1} of ${n}</p>
        <div class="row center">
          <button class="secondary" data-act="nextCard">Next card</button>
          <button class="ghost" data-act="delCard" data-id="${card.id}">Delete</button>
        </div>` : '<p class="muted">No cards yet.</p>'}
      <h3>Add a card</h3>
      <input id="cardQ" placeholder="Question, e.g. Capital of Japan?">
      <input id="cardA" placeholder="Answer, e.g. Tokyo" style="margin-top:6px">
      <div style="margin-top:8px"><button data-act="addCard">Add card</button></div>
      ${helperBtn('owl', 'Have Professor Owl make cards for you')}`,
  };
};

// 🧊 Fridge & 🍳 stove
const mealForm = (cook) => `
  <div class="row"><input id="mealText" placeholder="${cook ? 'e.g. Veggie omelette' : 'e.g. Oatmeal with banana'}"><button data-act="addMeal" data-cook="${cook ? 1 : ''}">${cook ? 'I cooked it' : 'I ate it'}</button></div>
  <label class="row" style="gap:6px"><input type="checkbox" id="mealHealthy" style="width:auto" ${cook ? 'checked' : ''}> This made my body feel good</label>
  <ul class="list">${(state.meals[today()] || []).map(m => `<li><span>${m.cooked ? '🍳 ' : ''}${esc(m.text)}</span><span>${m.healthy ? '💚' : ''}</span></li>`).join('') || '<li class="muted">Nothing logged yet today.</li>'}</ul>`;

PANELS.fridge = () => ({
  title: '🧊 Fridge',
  html: `<p class="muted">Log what you really ate. Feeding yourself fills your hunger bar.</p>${mealForm(false)}${needTag('hunger')}${goalLine()}${helperBtn('basil', 'Ask Chef Basil for ideas')}`,
});
PANELS.stove = () => ({
  title: '🍳 Stove',
  html: `<p class="muted">Cooked something yourself? That's a real skill. It counts for food <b>and</b> fun.</p>${mealForm(true)}${needTag('hunger', 'fun')}${helperBtn('basil', 'Ask Chef Basil for a recipe')}`,
});

// 🚰 Water
PANELS.water = () => {
  const g = state.water[today()] || 0;
  return {
    title: '🚰 Water',
    html: `
      <p class="muted">Tap a glass each time you actually drink one. Goal: 8 a day.</p>
      <div class="water">${Array.from({ length: 8 }, (_, i) => `<button class="${i < g ? 'on' : ''}" data-act="water" data-n="${i + 1}" aria-label="${i + 1} glasses">🥛</button>`).join('')}</div>
      <p><b>${g}/8</b> glasses today ${g >= 8 ? '· fully hydrated! 💧' : ''}</p>${needTag('hunger', 'energy')}`,
  };
};

// 🏃 Gym equipment
const WORKOUT_TYPES = ['Walk', 'Run', 'Strength', 'Yoga / stretching', 'Sports', 'Dance', 'Cycling', 'Swimming', 'Other'];
PANELS.workout = type => {
  const t = today();
  const list = state.workouts.filter(w => w.date === t);
  return {
    title: `🏋️ ${type === 'Run' ? 'Treadmill' : type === 'Strength' ? 'Weights' : 'Yoga mat'}`,
    html: `
      <p class="muted">Log exercise you did in real life (anywhere counts, not only here).</p>
      <div class="row">
        <select id="wType">${WORKOUT_TYPES.map(x => `<option ${x === type ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <input id="wMin" type="number" min="1" placeholder="Minutes" style="flex:0 0 100px">
        <button data-act="addWorkout">Log</button>
      </div>
      <ul class="list">${list.map(w => `<li><span>${esc(w.type)}</span><span class="muted">${w.minutes} min</span></li>`).join('') || '<li class="muted">Nothing yet today.</li>'}</ul>
      ${needTag('fun', 'calm')}<p class="small muted">Exercise uses energy and makes you a bit sweaty, so rest and shower after!</p>
      ${goalLine()}
      ${helperBtn('rex', 'Ask Coach Rex for a workout')}`,
  };
};

// 🛏️ Bed
PANELS.bed = () => {
  const s = state.sleep[today()];
  return {
    title: '🛏️ Bed',
    html: `
      <p class="muted">How long did you really sleep last night? Good sleep fills your energy.</p>
      <div class="row"><input id="sleepH" type="number" min="0" max="16" step="0.5" value="${s ?? ''}" placeholder="Hours"><button data-act="saveSleep">Save sleep</button></div>
      <p class="small muted">Teens need about 8–10 hours, adults 7–9.</p>
      <div class="row" style="margin-top:8px"><button class="secondary" data-act="nap">😴 I took a real nap</button></div>
      ${needTag('energy')}
      ${helperBtn('luna', "Can't sleep? Talk to Luna")}`,
  };
};

// 📓 Journal
const JOURNAL_PROMPTS = ['What made you smile today?', 'What is something you learned about yourself this week?', 'If today had a title, what would it be?',
  'What is one thing you want to remember about today?', 'What challenged you today and how did you handle it?', 'Describe your ideal tomorrow.',
  'What are you proud of right now?', 'What would future-you thank you for doing today?'];
PANELS.journal = () => {
  const t = today();
  const j = state.journal[t] || {};
  const past = Object.keys(state.journal).filter(k => k !== t && journalHasContent(k)).sort().reverse();
  const area = (id, label, ph = '') => `<label for="j_${id}">${label}</label><textarea id="j_${id}" data-j="${id}" placeholder="${esc(ph)}">${esc(j[id] || '')}</textarea>`;
  return {
    title: '📓 Journal · ' + niceDate(t),
    html: `
      ${area('wins', '🏆 Wins today (big or tiny)', 'I finished my homework early...')}
      ${area('learned', '💡 Something I learned')}
      ${area('tomorrow', '🎯 One thing for tomorrow')}
      ${area('free', '✍️ ' + dailyPick(JOURNAL_PROMPTS, 3))}
      <div class="row" style="margin-top:8px"><button data-act="journalDone">Done for today ✓</button><span class="small muted" id="jSaved">${journalHasContent(t) ? 'Saved' : 'Saves as you type'}</span></div>
      ${needTag('calm')}
      ${helperBtn('luna', 'Reflect with Luna')}
      ${past.length ? `<details style="margin-top:12px"><summary>Past entries (${past.length})</summary>${past.slice(0, 30).map(k => {
        const e = state.journal[k];
        return `<div class="entry"><b>${niceDate(k)}</b>${['wins', 'learned', 'tomorrow', 'free'].filter(x => e[x]).map(x => `<p>${esc(e[x])}</p>`).join('')}</div>`;
      }).join('')}</details>` : ''}`,
  };
};

// 👕 Wardrobe
PANELS.wardrobe = () => {
  const a = state.avatar;
  const sw = (key, label) => `<h3>${label}</h3><div class="swatches">${LOOKS[key].map(c =>
    `<button class="swatch ${a[key] === c ? 'on' : ''}" style="background:${c}" data-act="look" data-k="${key}" data-v="${c}" aria-label="${label} ${c}"></button>`).join('')}</div>`;
  return {
    title: '👕 Wardrobe',
    html: `
      <p class="muted">Design yourself! Changes show up right away.</p>
      <label for="nameIn">Name</label>
      <div class="row"><input id="nameIn" value="${esc(state.name)}" placeholder="Your name"><button data-act="saveName">Save</button></div>
      ${sw('skin', 'Skin')}
      <h3>Hair style</h3><div class="row">${LOOKS.hairStyle.map(s => `<button class="chip ${a.hairStyle === s ? 'on' : ''}" data-act="look" data-k="hairStyle" data-v="${s}">${s}</button>`).join('')}</div>
      ${sw('hair', 'Hair color')}${sw('shirt', 'Top')}${sw('pants', 'Bottoms')}${sw('shoes', 'Shoes')}`,
  };
};

// 🚿 Shower, 🪞 Mirror, 🚽 Toilet
PANELS.shower = () => ({
  title: '🚿 Shower',
  html: `<p class="muted">Took a real shower or bath? Log it to feel fresh.</p>
    <div class="row"><button data-act="hygiene" data-what="shower">🚿 I showered</button><button class="secondary" data-act="hygiene" data-what="face">🧼 I washed my face</button></div>${needTag('hygiene')}`,
});
const AFFIRMATIONS = ['I am allowed to take up space.', 'I can do hard things, one step at a time.', 'My worth is not measured by my productivity.',
  'I am learning, and that is enough for today.', 'I treat myself with the kindness I give my friends.', 'Mistakes mean I am trying.', 'I am proud of how far I have come.'];
PANELS.mirror = () => ({
  title: '🪞 Mirror',
  html: `<div class="note big-quote">“${dailyPick(AFFIRMATIONS)}”</div><p class="small muted center">Say it out loud to the mirror. Seriously, it helps!</p>
    <div class="row"><button data-act="hygiene" data-what="teeth">🪥 I brushed my teeth</button></div>${needTag('hygiene')}
    ${helperBtn('mo', 'Talk to Mirror Mo')}`,
});
PANELS.toilet = () => ({
  title: '🚽 Toilet',
  html: `<p>Hey, everybody goes. 😄 Just don't forget:</p><div class="row"><button data-act="hygiene" data-what="hands">🧼 I washed my hands</button></div>${needTag('hygiene')}`,
});

// 📺 TV (fun) and 📱 phone (social)
const logForm = (kind, chips, ph) => `
  <div class="chips">${chips.map(c => `<button class="chip" data-act="quickLog" data-kind="${kind}" data-text="${esc(c)}">${c}</button>`).join('')}</div>
  <div class="row" style="margin-top:8px"><input id="logText" placeholder="${ph}"><button data-act="quickLog" data-kind="${kind}">Log</button></div>
  <ul class="list">${state[kind].filter(x => x.date === today()).map(x => `<li><span>${esc(x.text)}</span></li>`).join('') || '<li class="muted">Nothing logged yet today.</li>'}</ul>`;
PANELS.tv = () => ({
  title: '📺 Fun time',
  html: `<p class="muted">Rest and play matter too! Log something fun you did in real life.</p>
    ${logForm('fun', ['🎮 Played a game', '📺 Watched a show', '🎨 Made art', '🎵 Listened to music', '🌳 Went outside', '📖 Read for fun'], 'Something else fun...')}${needTag('fun')}`,
});
PANELS.phone = () => ({
  title: '📱 Phone',
  html: `<p class="muted">Real people fill your social bar the most. Who did you connect with?</p>
    ${logForm('social', ['💬 Texted a friend', '📞 Called family', '🧑‍🤝‍🧑 Hung out with someone', '🤝 Helped someone', '👋 Talked to someone new'], 'Something else...')}${needTag('social')}
    <p class="small muted">The AI helpers are nice to chat with, but they are not a replacement for your people. 💛</p>`,
});

// 💗 Feelings bench
const FEELINGS = ['Happy', 'Calm', 'Proud', 'Excited', 'Grateful', 'Tired', 'Stressed', 'Anxious', 'Sad', 'Lonely', 'Angry', 'Overwhelmed', 'Bored', 'Hopeful'];
const GENTLE = ['What is one thing you need right now, and how could you give it to yourself?', 'What would you say to a friend who felt the way you feel today?',
  'Name one thing you handled better than you would have a year ago.', 'What are you worrying about that you cannot control? Can you let it rest for today?',
  'Which part of your day gave you energy, and which part drained it?', 'What does "good enough" look like for today?'];
const TRAPS = [['All-or-nothing', '"If it\'s not perfect, it\'s a failure."'], ['Mind reading', '"Everyone thinks I\'m weird."'], ['Fortune telling', '"It\'s definitely going to go badly."'],
  ['Catastrophizing', '"This is the worst thing ever."'], ['Should statements', '"I should be better by now."'], ['Labeling', '"I\'m so stupid."']];
const FACES = ['😢', '😕', '😐', '🙂', '😄'];
let pickedMood = 0, pickedFeelings = [];
PANELS.feelings = () => {
  const todays = state.moods.filter(m => m.date === today());
  return {
    title: '💗 Feelings bench',
    html: `
      <h3>How are you feeling?</h3>
      <div class="moods">${FACES.map((f, i) => `<button class="${pickedMood === i + 1 ? 'on' : ''}" data-act="pickMood" data-m="${i + 1}" aria-label="Mood ${i + 1} of 5">${f}</button>`).join('')}</div>
      <div class="chips">${FEELINGS.map(f => `<button class="chip ${pickedFeelings.includes(f) ? 'on' : ''}" data-act="pickFeeling" data-f="${f}">${f}</button>`).join('')}</div>
      <textarea id="moodNote" placeholder="Anything on your mind? (optional)" style="margin-top:8px"></textarea>
      <div style="margin-top:8px"><button data-act="saveMood" ${pickedMood ? '' : 'disabled'}>Save check-in</button></div>
      ${todays.length ? `<ul class="list">${todays.map(m => `<li><span>${FACES[m.mood - 1]} ${esc(m.feelings.join(', '))}</span><span class="muted small">${new Date(m.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></li>`).join('')}</ul>` : ''}
      <div class="note"><b>Today's gentle question:</b> ${dailyPick(GENTLE)}</div>

      <h3>🧠 Thought reframe</h3>
      <p class="small muted">Brains fall into "thinking traps". Hover or tap one to see an example, then look at your thought like a detective.</p>
      <div class="chips">${TRAPS.map(([n, ex]) => `<span class="chip" data-tip="${esc(ex)}" title="${esc(ex)}">${n}</span>`).join('')}</div>
      <label>1. The thought that's bugging me</label><textarea id="rfThought" placeholder="I'm going to fail this test."></textarea>
      <label>2. Evidence it's true</label><textarea id="rfFor"></textarea>
      <label>3. Evidence it's not totally true</label><textarea id="rfAgainst" placeholder="I passed the last quiz. I've been studying."></textarea>
      <label>4. A kinder, more balanced thought</label><textarea id="rfBalanced" placeholder="It might be hard, but I've prepared and I can do my best."></textarea>
      <div style="margin-top:8px"><button data-act="saveReframe">Save reframe</button></div>
      ${state.reframes.length ? `<details style="margin-top:10px"><summary>Past reframes (${state.reframes.length})</summary>${state.reframes.slice().reverse().map(r => `<div class="entry"><b>${niceDate(r.date)}</b><p>💭 ${esc(r.thought)}</p><p>🌱 ${esc(r.balanced)}</p></div>`).join('')}</details>` : ''}
      ${needTag('calm')}
      ${helperBtn('sage', 'Talk it through with Sage')}
      ${CRISIS_NOTE}`,
  };
};

const CRISIS_NOTE = `<div class="note crisis"><b>💛 You're not alone.</b> This app is for everyday self-care, not a replacement for a therapist or doctor.
  If you're in danger or thinking about hurting yourself, call your local emergency number now or reach a crisis line:
  US call/text <b>988</b>, UK <b>116 123</b>, India <b>14416</b>, or find one at <a href="https://findahelpline.com" target="_blank" rel="noopener">findahelpline.com</a>. Please also tell a trusted adult.</div>`;

// 🌊 Calm pond
const breath = { running: false, timeouts: [], rounds: 0 };
PANELS.calm = () => ({
  title: '🌊 Calm pond',
  html: `
    <h3>Box breathing</h3>
    <p class="small muted">In for 4, hold 4, out for 4, hold 4. Do 4 rounds. Great before a test or when your mind is racing.</p>
    <div class="breath-wrap"><div class="breath" id="breath">Ready?</div></div>
    <div class="row center"><button data-act="breathe">${breath.running ? 'Stop' : 'Start breathing'}</button></div>
    <h3>5-4-3-2-1 grounding</h3>
    <ol class="steps"><li><b>5</b> things you can <b>see</b></li><li><b>4</b> things you can <b>touch</b></li><li><b>3</b> things you can <b>hear</b></li><li><b>2</b> things you can <b>smell</b></li><li><b>1</b> thing you can <b>taste</b></li></ol>
    <button class="secondary" data-act="grounded">I did it ✓</button>
    ${needTag('calm')}
    ${helperBtn('sage', 'Ask Sage to guide you')}`,
});
function startBreathing() {
  breath.running = true;
  const phases = [['Breathe in', true], ['Hold', true], ['Breathe out', false], ['Hold', false]];
  let i = 0;
  const step = () => {
    if (!breath.running) return;
    const node = $('#breath');
    if (!node) { stopBreathing(); return; }
    const [label, big] = phases[i % 4];
    node.textContent = label;
    node.classList.toggle('big', big);
    i++;
    if (i % 4 === 0 && ++breath.rounds === 4) {
      reward('breathe', 5, 3, { calm: 25 }, '🌿 4 calm breaths. Nice work.');
      breath.rounds = 0;
    }
    breath.timeouts.push(setTimeout(step, 4000));
  };
  step();
}
function stopBreathing() {
  breath.running = false;
  breath.rounds = 0;
  breath.timeouts.forEach(clearTimeout);
  breath.timeouts = [];
}

// 🌳 Gratitude tree
PANELS.gratitude = () => {
  const g = state.gratitude[today()] || ['', '', ''];
  const days = Object.keys(state.gratitude).filter(k => k !== today() && state.gratitude[k].some(Boolean)).sort().reverse();
  return {
    title: '🌳 Gratitude tree',
    html: `
      <p class="muted">Hang three good things on the tree. Small ones count: a warm drink, a funny text, sunshine.</p>
      ${[0, 1, 2].map(i => `<input class="grat" data-i="${i}" value="${esc(g[i])}" placeholder="Good thing #${i + 1}" style="margin-bottom:8px">`).join('')}
      <button data-act="saveGrat">Hang them on the tree</button>
      ${needTag('calm')}
      ${days.length ? `<details style="margin-top:12px"><summary>Older leaves (${days.length} days)</summary>${days.slice(0, 20).map(k => `<div class="entry"><b>${niceDate(k)}</b><p>${state.gratitude[k].filter(Boolean).map(esc).join(' · ')}</p></div>`).join('')}</details>` : ''}`,
  };
};

// 🐈 Cat
PANELS.cat = () => ({
  title: '🐈 Your cat',
  html: `<p>Your cat blinks slowly at you. That means "I love you" in cat.</p><div class="row"><button data-act="petCat">🤚 Pet the cat</button></div>${needTag('fun', 'calm')}`,
});

// 🎵 Music room and 🎮 game room (full features arrive in later phases)
PANELS.music = () => ({
  title: '🎵 Music room',
  html: `
    <div class="note big-quote">Your vinyl collection is almost ready! 💿</div>
    <p>Soon you'll connect Spotify here. Your albums and playlists will become records on the shelf, and the turntable will play them through your Spotify app.</p>
    <p class="small muted">Coming in Phase 5 of the build plan.</p>
    ${helperBtn('mochi', 'Chat with DJ Mochi about music')}`,
});
PANELS.arcade = () => ({
  title: '🕹️ Arcade',
  html: `
    <p>Insert coin... 🪙 The games are being built!</p>
    <ul class="list">${['❌⭕ XOXO', '🧱 Block builder', '🌼 Flower memory', '🐛 Caterpillar', '🐱 Merge kittens', '🔤 Word garden'].map(g => `<li><span>${g}</span><span class="small muted">soon</span></li>`).join('')}</ul>
    <p class="small muted">Coming in Phase 6 of the build plan.</p>`,
});
PANELS.claw = () => ({
  title: '🧸 Claw machine',
  html: `<p>The plushies are waiting for you! Soon you'll be able to win them and put them around your house.</p><p class="small muted">Coming in Phase 6 of the build plan.</p>`,
});

// 🛒 Shop
PANELS.shop = () => ({
  title: '🛒 Home shop',
  html: `
    <p class="muted">Earn coins by taking care of yourself in real life, then decorate your house. You have <b>🪙 ${state.coins}</b>.</p>
    <div class="shop">${SHOP_ITEMS.map(it => {
      const owned = state.owned.includes(it.id);
      return `<div class="shop-item ${owned ? 'owned' : ''}"><div class="shop-emoji">${it.emoji}</div><div><b>${it.name}</b><div class="small muted">${it.room}</div></div>
        ${owned ? '<span class="small">✓ Owned</span>' : `<button data-act="buy" data-id="${it.id}" ${state.coins < it.price ? 'disabled' : ''}>🪙 ${it.price}</button>`}</div>`;
    }).join('')}</div>`,
});

// 🏆 Progress
let range = 14;
PANELS.progress = () => {
  const days = lastNDays(range);
  const pts = fn => days.map(d => ({ date: d, value: fn(d) }));
  const habitPts = pts(d => habitsDone(d).length), focusPts = pts(focusMinutes), workPts = pts(workoutMinutes), moodPts = pts(avgMood);
  const lv = levelInfo();
  const moodDays = moodPts.filter(p => p.value > 0);
  const best = state.habits.map(h => ({ h, s: streak(h.id) })).sort((a, b) => b.s - a.s)[0];
  return {
    title: '🏆 Trophy shelf',
    html: `
      <div class="stat-grid">
        <div><div class="small muted">Level</div><div class="big-number">${lv.level}</div><div class="bar"><i style="width:${lv.pct}%"></i></div></div>
        <div><div class="small muted">Coins</div><div class="big-number">🪙 ${state.coins}</div></div>
        <div><div class="small muted">Best streak</div><div class="big-number">🔥 ${best?.s || 0}</div><div class="small muted">${best?.s ? esc(best.h.name) : ''}</div></div>
        <div><div class="small muted">Avg mood</div><div class="big-number">${moodDays.length ? (sum(moodDays.map(p => p.value)) / moodDays.length).toFixed(1) : '–'}</div></div>
      </div>
      <div class="row">${[7, 14, 30].map(n => `<button class="${range === n ? '' : 'secondary'}" data-act="range" data-n="${n}">${n} days</button>`).join('')}</div>
      <h3>Habits completed per day</h3>${barChart(habitPts, { unit: 'habits', max: Math.max(1, state.habits.length) })}
      <h3>Focus minutes per day</h3>${barChart(focusPts, { unit: 'min' })}
      <h3>Exercise minutes per day</h3>${barChart(workPts, { unit: 'min' })}
      <h3>Mood per day</h3><p class="small muted">1 = 😢, 5 = 😄, empty = no check-in</p>${barChart(moodPts, { unit: '/ 5', max: 5, decimals: 1 })}`,
  };
};

function barChart(points, { unit = '', max, decimals = 0 } = {}) {
  const W = 340, H = 150, padL = 26, padB = 20, padT = 8;
  const niceTop = max ?? [1, 2, 4, 5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 300, 500, 1000].find(s => s >= Math.max(1, ...points.map(p => p.value))) ?? 1000;
  const plotW = W - padL, plotH = H - padB - padT, slot = plotW / points.length;
  const bw = Math.max(4, Math.min(22, slot - 4));
  const y = v => padT + plotH - (v / niceTop) * plotH;
  const fmt = v => (decimals ? v.toFixed(decimals) : Math.round(v)) + (unit ? ' ' + unit : '');
  let out = '';
  for (const v of [0, niceTop / 2, niceTop]) {
    out += `<line class="grid-line" x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`;
  }
  const every = points.length <= 7 ? 1 : points.length <= 14 ? 2 : 4;
  points.forEach((p, i) => {
    const cx = padL + slot * i + slot / 2, x = cx - bw / 2, base = y(0);
    const h = Math.max(2, base - y(p.value)), r = Math.min(4, bw / 2, h), t = base - h;
    out += `<g data-tip="${esc(`${niceDate(p.date)}: ${fmt(p.value)}`)}"><rect class="hit" x="${padL + slot * i}" y="${padT}" width="${slot}" height="${plotH}"/>
      <path class="mark${p.value > 0 ? '' : ' zero'}" d="M${x},${base} V${t + r} Q${x},${t} ${x + r},${t} H${x + bw - r} Q${x + bw},${t} ${x + bw},${t + r} V${base} Z"/></g>`;
    if ((points.length - 1 - i) % every === 0) out += `<text class="axis" x="${cx}" y="${H - 5}" text-anchor="middle">${shortDay(p.date)}</text>`;
  });
  const rows = points.map(p => `<tr><td>${niceDate(p.date)}</td><td>${fmt(p.value)}</td></tr>`).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">${out}</svg>
    <details class="table-view"><summary>Show as table</summary><table><tr><th>Day</th><th>Value</th></tr>${rows}</table></details></div>`;
}

// 📬 Settings
PANELS.settings = () => ({
  title: '📬 Mailbox · settings',
  html: `
    <h3>🤖 AI helpers (Claude)</h3>
    <p class="small muted">The room helpers use Claude. Paste an API key from <a href="https://platform.claude.com" target="_blank" rel="noopener">platform.claude.com</a> to turn them on.
      API use costs a little money per message, billed to that account, so ask a parent or guardian if it isn't your account.
      The key is saved only in this browser and sent only to Anthropic. Without a key, the helpers run in a simple offline mode.</p>
    <div class="row"><input id="apiKey" type="password" placeholder="sk-ant-..." value="${esc(state.apiKey)}" autocomplete="off"><button data-act="saveKey">Save key</button></div>
    ${state.apiKey ? '<p class="small">✅ Key saved. <button class="ghost small" data-act="clearKey">Remove key</button></p>' : '<p class="small muted">No key yet: offline mode.</p>'}

    <h3>🧠 Your helpers</h3>
    <button class="secondary" data-act="openP" data-p="helpers">See what your helpers remember</button>

    <h3>📲 Put it on your home screen</h3>
    <p class="small muted">On iPhone or iPad: open this page in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>. It opens full screen like a real app and works offline after the first visit (the AI helpers still need internet).</p>

    <h3>🕒 Time of day</h3>
    <div class="row">${[['real', '🕒 Real time'], ['day', '☀️ Always day'], ['night', '🌙 Always night']].map(([v, l]) => `<button class="${state.timeMode === v ? '' : 'secondary'}" data-act="timeMode" data-v="${v}">${l}</button>`).join('')}</div>

    <h3>🧱 Walls</h3>
    <div class="row">${[['cut', 'Cutaway'], ['up', 'Walls up']].map(([v, l]) => `<button class="${state.walls === v ? '' : 'secondary'}" data-act="walls" data-v="${v}">${l}</button>`).join('')}</div>

    <h3>💾 Backup</h3>
    <p class="small muted">Your house lives only in this browser. Download a backup now and then. (Backups don't include your API key.)</p>
    <div class="row">
      <button class="secondary" data-act="export">⬇️ Download backup</button>
      <label class="btn secondary">⬆️ Restore backup<input type="file" id="importFile" accept="application/json" hidden></label>
      <button class="ghost" data-act="reset">Reset everything</button>
    </div>`,
});

// 🤖 AI chat
const chatUI = { busy: false, specialHTML: '', asking: null, renaming: false, weeklyTried: {} };
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^[-*] /gm, '• ').replace(/\n/g, '<br>');

function promiseCard() {
  const p = todaysPromise();
  const y = state.promises.find(x => x.date === lastNDays(2)[0]);
  let html = '<div class="promise"><b>🤝 Tiny promise</b>';
  if (y && y.kept == null) html += `<p>Yesterday you promised: "${esc(y.text)}". Did you keep it?</p>
    <div class="row"><button class="small" data-act="keptPromise" data-v="1">Yes! 🎉</button><button class="secondary small" data-act="keptPromise" data-v="0">Not this time</button></div>`;
  html += p ? `<p>Today you promised: <b>"${esc(p.text)}"</b></p>` : '<p class="small muted">Make one promise to yourself so small you can\'t fail.</p>';
  return html + '</div>';
}

PANELS.chat = botId => {
  const b = BOT[botId];
  const hist = state.chats[botId] || [];
  const mem = memoryOf(botId);
  const n = mem.notes.length;
  return {
    title: `${b.emoji} ${b.name}`,
    html: `
      <div class="bot-head" style="--bot:${b.color}"><span class="bot-emoji">${b.emoji}</span>
        <div style="flex:1;min-width:0">
          ${chatUI.renaming
            ? `<div class="row"><input id="renameIn" value="${esc(b.name)}" maxlength="24" aria-label="New name for ${esc(b.name)}"><button class="small" data-act="saveRename">Save</button></div>`
            : `<b>${esc(b.name)}</b> <button class="ghost small" data-act="rename" aria-label="Rename ${esc(b.name)}">✏️ Rename</button>`}
          <div class="small muted">${b.role} · ${hasKey() ? 'powered by Claude' : 'offline mode'} · remembers ${n} thing${n === 1 ? '' : 's'}</div>
        </div>
      </div>
      ${mem.weekly ? `<div class="weekly"><b>🗓️ Weekly check-in</b><p>${md(mem.weekly.text)}</p></div>` : ''}
      ${botId === 'sunny' ? promiseCard() : ''}
      <div class="msgs" id="msgs">
        <div class="msg bot">${md(b.intro(b.name))}</div>
        ${hist.map(m => `<div class="msg ${m.role === 'user' ? 'me' : 'bot'}">${md(m.content)}</div>`).join('')}
      </div>
      <div id="specialOut">${chatUI.specialHTML}</div>
      <div class="chips">${b.quick.map(q => `<button class="chip" data-act="ask" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="specials">${b.specials.map((sp, i) => `<button class="special" data-act="special" data-i="${i}" style="--bot:${b.color}" ${chatUI.busy ? 'disabled' : ''}>${sp.label}</button>`).join('')}</div>
      ${chatUI.asking ? `<div class="row" style="margin-top:8px"><input id="topicIn" placeholder="${esc(chatUI.asking.ask)}"><button data-act="submitAsk">Go</button></div>` : ''}
      <form class="chat-form" data-form="chat"><textarea id="chatIn" rows="2" placeholder="Message ${esc(b.name)}..." ${chatUI.busy ? 'disabled' : ''}></textarea><button ${chatUI.busy ? 'disabled' : ''}>Send</button></form>
      <div class="row" style="justify-content:space-between">
        <button class="ghost small" data-act="openP" data-p="helpers">🧠 What ${esc(b.name)} remembers</button>
        ${hist.length ? '<button class="ghost small" data-act="clearChat">Clear chat</button>' : ''}
      </div>
      ${['sage', 'sunny'].includes(botId) ? CRISIS_NOTE : ''}`,
    after: () => {
      const m = $('#msgs');
      m.scrollTop = m.scrollHeight;
      if (chatUI.asking) $('#topicIn')?.focus();
      if (!chatUI.weeklyTried[botId]) {
        chatUI.weeklyTried[botId] = true;
        const before = mem.weekly;
        weeklyCheckIn(botId).then(w => { if (w && w !== before && current === 'chat:' + botId) refresh(); });
      }
    },
  };
};

async function sendChat(text) {
  const botId = current.split(':')[1];
  if (!text.trim() || chatUI.busy) return;
  chatUI.busy = true;
  chatUI.specialHTML = '';
  refresh();
  const msgs = $('#msgs');
  msgs.insertAdjacentHTML('beforeend', `<div class="msg me">${md(text)}</div><div class="msg bot typing" id="streaming">…</div>`);
  msgs.scrollTop = msgs.scrollHeight;
  let acc = '';
  try {
    await chat(botId, text, d => {
      acc += d;
      const el = document.getElementById('streaming');
      if (el) { el.classList.remove('typing'); el.innerHTML = md(acc); msgs.scrollTop = msgs.scrollHeight; }
    });
    boost({ social: 3 });
    save();
  } catch (e) {
    toast(e.message);
  }
  chatUI.busy = false;
  if (current === 'chat:' + botId) refresh();
}

async function runSpecial(i, input) {
  const botId = current.split(':')[1];
  const b = BOT[botId];
  const sp = b.specials[i];
  if (sp.kind === 'chat') return sendChat(sp.prompt);
  if (sp.kind === 'goal') return openPanel('weight');
  if (sp.kind === 'promise' && input == null) { chatUI.asking = { i, ask: 'Today I promise to... (something tiny)' }; refresh(); return; }
  if (sp.kind === 'promise') {
    state.promises = state.promises.filter(p => p.date !== today());
    state.promises.push({ date: today(), text: input, kept: null });
    save();
    toast('🤝 Promise made. I believe in you.');
    refresh();
    return;
  }
  if (sp.ask && input == null) { chatUI.asking = { i, ask: sp.ask }; refresh(); return; }
  chatUI.busy = true; chatUI.asking = null;
  chatUI.specialHTML = `<div class="note">${b.emoji} Thinking…</div>`;
  refresh();
  try {
    const data = await special(botId, sp.kind, input);
    keepSpecial(sp.kind, data);
    chatUI.specialHTML = renderSpecial(sp.kind, data);
  } catch (e) {
    chatUI.specialHTML = '';
    toast(e.message);
  }
  chatUI.busy = false;
  if (current === 'chat:' + botId) refresh();
}

function keepSpecial(kind, data) {
  if (kind === 'cards') for (const c of data.cards) state.cards.push({ id: uid(), q: c.q, a: c.a });
  if (kind === 'steps') state.focusSteps = data.steps.map(st => ({ text: st.text, minutes: st.minutes, done: false }));
  if (kind === 'course') {
    data.id = uid();
    state.courses.push({
      id: data.id, title: data.title, overview: data.overview, created: Date.now(),
      units: data.units.map(u => ({ title: u.title, lessons: u.lessons.map(l => ({ title: l.title, goal: l.goal, done: false })) })),
      resources: data.resources || [],
    });
  }
  save();
}

let lastSpecial = null;
function renderSpecial(kind, data) {
  lastSpecial = { kind, data };
  const off = data.offline ? '<p class="small muted">(Offline example. Add an API key at the mailbox for personal ideas.)</p>' : '';
  if (kind === 'habits') return `<div class="note"><b>Tiny habit ideas</b>${data.habits.map((h, i) => `<div class="idea"><span>${esc(h.icon)} <b>${esc(h.name)}</b><br><span class="small muted">${esc(h.why)}</span></span><button class="secondary small" data-act="addIdea" data-i="${i}">Add</button></div>`).join('')}${off}</div>`;
  if (kind === 'cards') return `<div class="note">🃏 Added <b>${data.cards.length} flashcards</b> to your bookshelf in the study!</div>`;
  if (kind === 'course') return `<div class="note">📚 Your new course <b>${esc(data.title)}</b> has ${sum(data.units.map(u => u.lessons.length))} bite-size lessons. It's on the whiteboard in the study.<br><button class="small" data-act="openCourse" data-id="${data.id}">Open course</button></div>`;
  if (kind === 'steps') return `<div class="note"><b>Tiny steps</b><ol>${data.steps.map(st => `<li>${esc(st.text)} <span class="small muted">(${st.minutes} min)</span></li>`).join('')}</ol><p class="small">Saved to your study desk. Start with step 1, just that.</p>${off}</div>`;
  if (kind === 'meals') return `<div class="note"><b>Meal plan</b>${data.meals.map(m => `<div class="idea"><span><b>${esc(m.when)}:</b> ${esc(m.name)}<br><span class="small muted">${esc(m.why)}</span></span></div>`).join('')}${off}</div>`;
  if (kind === 'workout') return `<div class="note"><b>${esc(data.title)}</b> · about ${data.minutes} min<ol>${data.exercises.map(x => `<li><b>${esc(x.name)}</b>: ${esc(x.detail)}</li>`).join('')}</ol>
    <button data-act="logPlan">I did it! Log ${data.minutes} min</button>${off}</div>`;
  return '';
}

// 📚 A course from Professor Owl
const REVIEW_DAYS = [1, 3, 7, 14];
PANELS.course = id => {
  const c = state.courses.find(x => x.id === id);
  if (!c) return { title: '📚 Course', html: '<p class="muted">This course was removed.</p>' };
  const all = c.units.flatMap(u => u.lessons), done = all.filter(l => l.done).length;
  const dueReview = [];
  c.units.forEach((u, ui) => u.lessons.forEach((l, li) => {
    if (!l.done || !l.doneAt) return;
    const days = Math.floor((Date.now() - l.doneAt) / 864e5);
    if (REVIEW_DAYS.includes(days) && l.reviewed !== today()) dueReview.push({ l, ui, li });
  }));
  return {
    title: '📚 ' + c.title,
    html: `
      <p>${esc(c.overview || '')}</p>
      <div class="bar" style="height:12px"><i style="width:${Math.round((done / Math.max(1, all.length)) * 100)}%"></i></div>
      <p class="small muted">${done} of ${all.length} lessons done. Short lessons, one at a time. That's the whole trick.</p>
      ${dueReview.length ? `<div class="note"><b>🔁 Quick review today</b>${dueReview.map(r => `<div class="idea"><span>${esc(r.l.title)}</span><button class="secondary small" data-act="reviewLesson" data-c="${c.id}" data-u="${r.ui}" data-l="${r.li}">Review</button></div>`).join('')}</div>` : ''}
      ${c.units.map((u, ui) => `<h3>${ui + 1}. ${esc(u.title)}</h3>
        <ul class="list">${u.lessons.map((l, li) => `<li class="lesson ${l.done ? 'done' : ''}">
          <button class="check" data-act="toggleLesson" data-c="${c.id}" data-u="${ui}" data-l="${li}" aria-label="${l.done ? 'Mark not done' : 'Mark done'}: ${esc(l.title)}">${l.done ? '✓' : ''}</button>
          <span style="flex:1"><b>${esc(l.title)}</b><br><span class="small muted">${esc(l.goal || '')}</span></span>
          <button class="small" data-act="teachLesson" data-c="${c.id}" data-u="${ui}" data-l="${li}">Teach me</button>
        </li>`).join('')}</ul>`).join('')}
      ${c.resources?.length ? `<h3>🔗 Free resources</h3><ul class="list">${c.resources.map(r => `<li><span><a href="${esc(/^https?:\/\//.test(r.url) ? r.url : '#')}" target="_blank" rel="noopener">${esc(r.name)}</a><br><span class="small muted">${esc(r.why)}</span></span></li>`).join('')}</ul>
        <p class="small muted">Links come from Owl's knowledge, so double-check them.</p>` : ''}
      <button class="ghost small" data-act="delCourse" data-id="${c.id}">Delete this course</button>`,
  };
};

// ⚖️ Weight goal (optional)
const goalLine = () => state.goal
  ? `<button class="helper" data-act="openP" data-p="weight"><span>🎯</span>Weight goal: ${state.goal.target} ${state.weightUnit}${state.weights.at(-1) ? ` · last weigh-in ${state.weights.at(-1).value}` : ''}</button>`
  : `<button class="helper" data-act="openP" data-p="weight"><span>🎯</span>Set a healthy weight goal (optional)</button>`;

function weightChart() {
  const w = state.weights.slice(-12);
  if (w.length < 2) return '';
  const vals = w.map(x => x.value), lo = Math.min(...vals) - 1, hi = Math.max(...vals) + 1;
  const W = 300, H = 110, px = i => 20 + (i / (w.length - 1)) * (W - 30), py = v => 10 + (1 - (v - lo) / (hi - lo)) * (H - 30);
  const pts = w.map((x, i) => `${px(i)},${py(x.value)}`).join(' ');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weigh-in trend">
    <line class="grid-line" x1="20" x2="${W}" y1="${H - 20}" y2="${H - 20}"></line>
    ${state.goal ? `<line x1="20" x2="${W}" y1="${py(Math.max(lo, Math.min(hi, state.goal.target)))}" y2="${py(Math.max(lo, Math.min(hi, state.goal.target)))}" stroke="#6fdcb9" stroke-width="2" stroke-dasharray="5 4"></line>` : ''}
    <polyline points="${pts}" fill="none" stroke="#ff5fa2" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"></polyline>
    ${w.map((x, i) => `<g data-tip="${esc(`${niceDate(x.date)}: ${x.value} ${state.weightUnit}`)}"><circle cx="${px(i)}" cy="${py(x.value)}" r="9" fill="transparent"></circle><circle cx="${px(i)}" cy="${py(x.value)}" r="4.5" fill="#ff5fa2" stroke="#fff" stroke-width="2"></circle></g>`).join('')}
    <text class="axis" x="20" y="${H - 5}">${niceDate(w[0].date)}</text><text class="axis" x="${W}" y="${H - 5}" text-anchor="end">${niceDate(w.at(-1).date)}</text>
  </svg></div>`;
}

PANELS.weight = () => {
  const u = state.weightUnit, g = state.goal, last = state.weights.at(-1);
  const daysSince = last ? Math.floor((Date.now() - new Date(last.date + 'T12:00').getTime()) / 864e5) : 99;
  const t = weightTrend();
  const rates = u === 'kg' ? [0.25, 0.5, 0.75, 1] : [0.5, 1, 1.5, 2];
  const toGo = g && last ? last.value - g.target : null;
  return {
    title: '🎯 Weight goal',
    html: `
      <p class="muted">Optional and private. Basil and Rex use this to plan food and workouts for slow, healthy progress.</p>
      <div class="row"><label for="unitIn" style="margin:0">Units</label>
        <select id="unitIn" style="flex:0 0 90px"><option ${u === 'kg' ? 'selected' : ''}>kg</option><option ${u === 'lb' ? 'selected' : ''}>lb</option></select></div>
      <h3>My goal</h3>
      <div class="row">
        <label style="flex:1;margin:0">Now (${u})<input id="goalStart" type="number" step="0.1" value="${g?.start ?? last?.value ?? ''}"></label>
        <label style="flex:1;margin:0">Goal (${u})<input id="goalTarget" type="number" step="0.1" value="${g?.target ?? ''}"></label>
      </div>
      <label for="goalRate">Pace per week</label>
      <select id="goalRate">${rates.map(r => `<option value="${r}" ${(g ? g.perWeek === r : r === rates[1]) ? 'selected' : ''}>${r} ${u} per week${r === rates[1] ? ' (recommended)' : ''}</option>`).join('')}</select>
      <div style="margin-top:8px"><button data-act="saveGoal">Save goal</button></div>
      ${g && toGo != null ? `<div class="note">${toGo > 0 ? `<b>${toGo.toFixed(1)} ${u}</b> to go. At ${g.perWeek} ${u}/week, about <b>${Math.ceil(toGo / g.perWeek)} weeks</b>. Slow and steady wins. 🐢` : 'You reached your goal! 🎉 Talk to Basil and Rex about staying here.'}</div>` : ''}

      <h3>⚖️ Weekly weigh-in</h3>
      ${daysSince < 6 ? `<p class="small muted">Your next weigh-in is in ${6 - daysSince} day${6 - daysSince === 1 ? '' : 's'}. Weight goes up and down every day, so weekly is enough.</p>`
        : `<div class="row"><input id="weighIn" type="number" step="0.1" placeholder="Today (${u})"><button data-act="weighIn">Log weigh-in</button></div>
           <p class="small muted">Same time of day each week (morning is best) gives the fairest trend.</p>`}
      ${weightChart()}
      ${t ? `<p class="small">Trend: ${t.perWeek > 0 ? '+' : ''}${t.perWeek.toFixed(2)} ${u} per week.</p>` : ''}
      <div class="note">Healthy weight loss is slow: about ${u === 'kg' ? '0.25 to 1 kg' : '0.5 to 2 lb'} a week. If food or your body ever starts to feel scary or obsessive, please talk to a doctor. You matter more than any number.</div>
      ${helperBtn('basil', 'Plan food with Chef Basil')}${helperBtn('rex', 'Plan workouts with Coach Rex')}`,
  };
};

// 🧠 What the helpers remember
PANELS.helpers = () => ({
  title: '🧠 Your helpers',
  html: `
    <p class="muted">Each helper keeps a few short notes so it feels like talking to someone who knows you. Everything stays on this device. Delete anything, any time.</p>
    ${BOTS.map(b => {
      const mem = memoryOf(b.id);
      return `<div class="helper-card" style="--bot:${b.color}">
        <div class="row" style="justify-content:space-between"><b>${b.emoji} ${esc(b.name)}</b><span class="small muted">${esc(b.role)}</span></div>
        ${mem.weekly ? `<p class="small"><b>Latest check-in:</b> ${esc(mem.weekly.text)}</p>` : ''}
        ${mem.notes.length ? `<ul class="list">${mem.notes.map(n => `<li><span>${esc(n.text)}${n.share ? ' <span class="small muted">(shared with team)</span>' : ''}</span><button class="ghost small" data-act="delNote" data-bot="${b.id}" data-id="${n.id}" aria-label="Forget this">✕</button></li>`).join('')}</ul>` : '<p class="small muted">Nothing remembered yet.</p>'}
        <div class="row"><input data-note="${b.id}" placeholder="Something ${esc(b.name)} should know"><button class="small secondary" data-act="addNote" data-bot="${b.id}">Add</button></div>
        <label class="row small" style="gap:8px"><input type="checkbox" data-share="${b.id}" ${canShare(b.id) ? 'checked' : ''}> Let ${esc(b.name)} share helpful notes with the other helpers</label>
        <button class="ghost small" data-act="refreshWeekly" data-bot="${b.id}">🗓️ New check-in now</button>
      </div>`;
    }).join('')}`,
});

// ---------- actions ----------

const ACT = {
  openChat: el => { chatUI.specialHTML = ''; chatUI.asking = null; hooks.goToBot?.(el.dataset.bot); },
  openP: el => openPanel(el.dataset.p),
  askOwl: el => {
    const sp = BOT.owl.specials[Number(el.dataset.i)];
    openPanel('chat:owl');
    chatUI.asking = { i: Number(el.dataset.i), ask: sp.ask };
    refresh();
  },

  rename: () => { chatUI.renaming = true; refresh(); $('#renameIn')?.select(); },
  saveRename: () => {
    const id = current.split(':')[1];
    renameBot(id, $('#renameIn').value);
    chatUI.renaming = false;
    hooks.onRename?.(id);
    toast(`${BOT[id].emoji} Say hi to ${BOT[id].name}!`);
    refresh();
  },
  keptPromise: el => {
    const y = state.promises.find(x => x.date === lastNDays(2)[0]);
    if (!y) return;
    y.kept = el.dataset.v === '1';
    if (y.kept) reward('promise', 3, 1, { calm: 10 }, '🤝 You kept your promise to yourself!');
    else { save(); toast("That's okay. The rule is: never miss twice. 💛"); }
    refresh();
  },
  submitAsk: () => {
    const v = $('#topicIn')?.value.trim();
    if (!v || !chatUI.asking) return;
    const { i } = chatUI.asking;
    chatUI.asking = null;
    runSpecial(i, v);
  },

  energy: el => {
    const pick = { low: [5, '🪫 Low energy is okay. Just 5 minutes, then decide.'], okay: [15, '🙂 15 minutes. You got this.'], high: [25, '⚡ Ride the wave: 25 minutes!'] }[el.dataset.v];
    timer.duration = timer.remaining = pick[0] * 60;
    toast(pick[1]);
    refresh();
  },
  clearSteps: () => { state.focusSteps = []; save(); refresh(); },
  addPark: () => {
    const v = $('#parkIn').value.trim();
    if (!v) return;
    state.parking.push({ id: uid(), text: v });
    save(); refresh();
    toast('🅿️ Parked. Back to it!');
  },
  delPark: el => { state.parking = state.parking.filter(x => x.id !== el.dataset.id); save(); refresh(); },

  openCourse: el => openPanel('course:' + el.dataset.id),
  toggleLesson: el => {
    const c = state.courses.find(x => x.id === el.dataset.c);
    const l = c?.units[Number(el.dataset.u)]?.lessons[Number(el.dataset.l)];
    if (!l) return;
    l.done = !l.done;
    l.doneAt = l.done ? Date.now() : null;
    if (l.done) reward('lesson', 3, 6, { calm: 3, fun: 3 }, '📚 Lesson complete!');
    else save();
    refresh();
  },
  teachLesson: el => {
    const c = state.courses.find(x => x.id === el.dataset.c);
    const l = c?.units[Number(el.dataset.u)]?.lessons[Number(el.dataset.l)];
    if (!l) return;
    openPanel('chat:owl');
    sendChat(`Teach me the lesson "${l.title}" from my course "${c.title}" (goal: ${l.goal}). Bite-size please, then one quick check question.`);
  },
  reviewLesson: el => {
    const c = state.courses.find(x => x.id === el.dataset.c);
    const l = c?.units[Number(el.dataset.u)]?.lessons[Number(el.dataset.l)];
    if (!l) return;
    l.reviewed = today();
    save();
    openPanel('chat:owl');
    sendChat(`Give me a quick 3-question review quiz on "${l.title}" from my course "${c.title}". Ask one question at a time.`);
  },
  delCourse: el => {
    if (!confirm('Delete this course and its progress?')) return;
    state.courses = state.courses.filter(c => c.id !== el.dataset.id);
    save();
    openPanel('skills');
  },

  saveGoal: () => {
    const start = Number($('#goalStart').value), target = Number($('#goalTarget').value), perWeek = Number($('#goalRate').value);
    if (!(start > 0 && target > 0)) { toast('Fill in both numbers'); return; }
    state.goal = { start, target, perWeek, set: today() };
    save();
    toast('🎯 Goal saved. Slow and steady!');
    refresh();
  },
  weighIn: () => {
    const v = Number($('#weighIn').value);
    if (!(v > 0)) return;
    state.weights.push({ date: today(), value: v });
    reward('weighin', 2, 1, {}, '⚖️ Weigh-in logged. Remember, it\'s just one number.');
    refresh();
  },

  delNote: el => {
    const mem = memoryOf(el.dataset.bot);
    mem.notes = mem.notes.filter(n => n.id !== el.dataset.id);
    save(); refresh();
  },
  addNote: el => {
    const input = document.querySelector(`[data-note="${el.dataset.bot}"]`);
    const v = input?.value.trim();
    if (!v) return;
    memoryOf(el.dataset.bot).notes.push({ id: uid(), text: v, share: false });
    save(); refresh();
  },
  refreshWeekly: async el => {
    const w = await weeklyCheckIn(el.dataset.bot, true);
    toast(w ? '🗓️ New check-in ready' : 'Not enough logs yet for a check-in');
    refresh();
  },

  toggleHabit: el => {
    const list = state.habitLog[today()] || (state.habitLog[today()] = []);
    const i = list.indexOf(el.dataset.id);
    if (i >= 0) { list.splice(i, 1); save(); }
    else {
      list.push(el.dataset.id);
      const s = streak(el.dataset.id);
      reward('habit:' + el.dataset.id, 5, 1, { calm: 3, fun: 2 }, s > 1 ? `🔥 ${s} day streak!` : '✅ Habit done!');
    }
    refresh();
  },
  addHabit: () => {
    const name = $('#habitName').value.trim();
    if (!name) return;
    state.habits.push({ id: uid(), name, icon: $('#habitIcon').value });
    save(); refresh();
  },
  delHabit: el => {
    const h = state.habits.find(x => x.id === el.dataset.id);
    if (h && confirm(`Remove "${h.name}"?`)) { state.habits = state.habits.filter(x => x.id !== h.id); save(); refresh(); }
  },

  preset: el => { timer.duration = timer.remaining = Number(el.dataset.min) * 60; refresh(); },
  timerStart: () => {
    if (timer.running) {
      clearInterval(timer.tick);
      timer.running = false;
      timer.remaining = (timer.endAt - Date.now()) / 1000;
    } else {
      timer.skill = $('#skillSel').value;
      if (timer.remaining >= timer.duration) timer.halfDone = false;
      timer.endAt = Date.now() + timer.remaining * 1000;
      timer.running = true;
      timer.tick = setInterval(timerTick, 250);
    }
    hooks.studyBuddy?.(timer.running && studyBuddy);
    refresh();
  },
  timerStop: () => { if (timer.running) timer.remaining = (timer.endAt - Date.now()) / 1000; finishTimer(false); },

  addSkill: () => { const v = $('#skillName').value.trim(); if (v && !state.skills.includes(v)) { state.skills.push(v); save(); refresh(); } },
  delSkill: el => {
    const s = el.dataset.skill;
    if (state.skills.length > 1 && confirm(`Remove "${s}"? Logged time stays in your history.`)) { state.skills = state.skills.filter(x => x !== s); save(); refresh(); }
  },
  logManual: () => {
    const m = Math.round(Number($('#manualMin').value));
    if (m > 0) {
      state.focus.push({ date: today(), skill: $('#manualSkill').value, minutes: m, ts: Date.now() });
      reward('focus', Math.max(1, Math.round(m / 5)), Infinity, { energy: -m / 6, calm: 3 }, `Logged ${m} min`);
      refresh();
    }
  },

  flip: () => { flash.showAnswer = !flash.showAnswer; refresh(); },
  nextCard: () => {
    flash.showAnswer = false;
    const n = state.cards.length;
    flash.index = n > 1 ? (flash.index + 1 + Math.floor(Math.random() * (n - 1))) % n : 0;
    refresh();
  },
  addCard: () => {
    const q = $('#cardQ').value.trim(), a = $('#cardA').value.trim();
    if (q && a) { state.cards.push({ id: uid(), q, a }); flash.index = state.cards.length - 1; flash.showAnswer = false; save(); refresh(); }
  },
  delCard: el => { state.cards = state.cards.filter(c => c.id !== el.dataset.id); flash.index = 0; flash.showAnswer = false; save(); refresh(); },

  addMeal: el => {
    const text = $('#mealText').value.trim();
    if (!text) return;
    const healthy = $('#mealHealthy').checked, cooked = !!el.dataset.cook;
    (state.meals[today()] || (state.meals[today()] = [])).push({ text, healthy, cooked });
    reward(cooked ? 'cook' : 'meal', healthy ? 3 : 2, 4, { hunger: healthy ? 45 : 35, fun: cooked ? 10 : 0, energy: 5 }, cooked ? '🍳 Chef mode!' : '😋 Yum!');
    refresh();
  },
  water: el => {
    const n = Number(el.dataset.n), t = today(), before = state.water[t] || 0;
    state.water[t] = before === n ? n - 1 : n;
    if (state.water[t] > before) reward('water', state.water[t] - before, 8, { hunger: 3, energy: 2 }, state.water[t] >= 8 ? '💧 Fully hydrated!' : '💧 Glug glug');
    else save();
    refresh();
  },
  addWorkout: () => {
    const m = Math.round(Number($('#wMin').value));
    if (m > 0) {
      state.workouts.push({ date: today(), type: $('#wType').value, minutes: m });
      reward('workout', Math.floor(m / 5) + 2, 4, { energy: -Math.min(30, m / 3), hygiene: -12, fun: 12, calm: 12 }, `💪 ${m} min logged!`);
      refresh();
    }
  },
  saveSleep: () => {
    const h = Number($('#sleepH').value);
    if (!(h >= 0 && h <= 16)) return;
    state.sleep[today()] = h;
    state.needs.energy = clamp(Math.max(state.needs.energy, (h / 8.5) * 100));
    reward('sleep', h >= 7 ? 6 : 3, 1, {}, h >= 7 ? '😴 Well rested!' : '😴 Saved. Try for a bit more tonight.');
    refresh();
  },
  nap: () => reward('nap', 1, 1, { energy: 20 }, '💤 Refreshing nap'),
  journalDone: () => {
    if (!journalHasContent(today())) { toast('Write a little first ✍️'); return; }
    reward('journal', 10, 1, { calm: 15 }, '📓 Journal saved. Sweet dreams of progress!');
  },

  look: el => {
    state.avatar[el.dataset.k] = el.dataset.v;
    save();
    hooks.avatar?.setLook(state.avatar);
    refresh();
  },
  saveName: () => { state.name = $('#nameIn').value.trim(); save(); toast(state.name ? `Hi, ${state.name}! 🏡` : 'Saved'); },

  hygiene: el => {
    const w = el.dataset.what;
    const map = { shower: ['shower', 3, 1, { hygiene: 70, calm: 5 }, '🚿 Squeaky clean!'], face: ['face', 1, 2, { hygiene: 20 }, '🧼 Fresh face'],
      teeth: ['teeth', 2, 2, { hygiene: 20 }, '🪥 Sparkly teeth!'], hands: ['hands', 0, 0, { hygiene: 8 }, '🧼 Good job!'] };
    reward(...map[w]);
  },
  quickLog: el => {
    const kind = el.dataset.kind;
    const text = el.dataset.text || $('#logText').value.trim();
    if (!text) return;
    state[kind].push({ date: today(), text });
    if (kind === 'fun') reward('fun', 2, 3, { fun: 30 }, '🎉 Fun logged!');
    else reward('social', 3, 3, { social: 35, calm: 5 }, '💬 Connection logged!');
    refresh();
  },

  pickMood: el => { pickedMood = Number(el.dataset.m); keepAndRefresh(['moodNote']); },
  pickFeeling: el => {
    const f = el.dataset.f;
    pickedFeelings = pickedFeelings.includes(f) ? pickedFeelings.filter(x => x !== f) : [...pickedFeelings, f];
    keepAndRefresh(['moodNote']);
  },
  saveMood: () => {
    if (!pickedMood) return;
    state.moods.push({ date: today(), ts: Date.now(), mood: pickedMood, feelings: pickedFeelings, note: $('#moodNote').value.trim() });
    pickedMood = 0; pickedFeelings = [];
    reward('mood', 3, 3, { calm: 10 }, '💗 Thanks for checking in with yourself');
    refresh();
  },
  saveReframe: () => {
    const r = { date: today(), thought: $('#rfThought').value.trim(), evidenceFor: $('#rfFor').value.trim(), evidenceAgainst: $('#rfAgainst').value.trim(), balanced: $('#rfBalanced').value.trim() };
    if (!r.thought || !r.balanced) { toast('Fill in the thought and the balanced thought'); return; }
    state.reframes.push(r);
    reward('reframe', 8, 2, { calm: 20 }, '🌱 Thought reframed');
    refresh();
  },
  breathe: () => {
    if (breath.running) { stopBreathing(); refresh(); return; }
    refresh();
    startBreathing();
    const b = document.querySelector('[data-act="breathe"]');
    if (b) b.textContent = 'Stop';
    hooks.avatar?.setPose('meditate');
  },
  grounded: () => reward('ground', 4, 2, { calm: 20 }, '🌿 Grounded'),
  saveGrat: () => {
    state.gratitude[today()] = [...document.querySelectorAll('.grat')].map(i => i.value.trim());
    if (state.gratitude[today()].some(Boolean)) reward('gratitude', 5, 1, { calm: 15, fun: 5 }, '🌳 Leaves added to your tree');
    else save();
  },
  petCat: () => reward('cat', 1, 3, { fun: 10, calm: 10 }, '😺 Purrrrr...'),

  buy: el => {
    const it = SHOP_ITEMS.find(x => x.id === el.dataset.id);
    if (!it || state.owned.includes(it.id) || state.coins < it.price) return;
    state.coins -= it.price;
    state.owned.push(it.id);
    save();
    hooks.world?.setOwned(state.owned);
    toast(`${it.emoji} ${it.name} is now in your ${it.room}!`);
    refresh();
  },
  range: el => { range = Number(el.dataset.n); refresh(); },

  saveKey: () => { state.apiKey = $('#apiKey').value.trim(); save(); toast(state.apiKey ? '🤖 AI helpers are awake!' : 'Key removed'); refresh(); },
  clearKey: () => { state.apiKey = ''; save(); refresh(); },
  timeMode: el => { state.timeMode = el.dataset.v; save(); hooks.onChange(); refresh(); },
  walls: el => { state.walls = el.dataset.v; save(); hooks.world?.setWallMode(state.walls); refresh(); },
  export: () => {
    const { apiKey, ...data } = state;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pet-house-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  reset: () => {
    if (confirm('Erase ALL your data in this browser? Download a backup first if you want to keep it.')) {
      replaceState(null);
      hooks.onChange(true);
      toast('House reset');
      refresh();
    }
  },

  ask: el => sendChat(el.dataset.q),
  special: el => runSpecial(Number(el.dataset.i)),
  addIdea: el => {
    const h = lastSpecial?.data.habits?.[Number(el.dataset.i)];
    if (!h) return;
    state.habits.push({ id: uid(), name: h.name, icon: h.icon });
    save();
    el.disabled = true;
    el.textContent = 'Added ✓';
    toast(`${h.icon} Added to your habit board`);
  },
  logPlan: () => {
    const d = lastSpecial?.data;
    if (!d) return;
    state.workouts.push({ date: today(), type: 'Other', minutes: d.minutes });
    reward('workout', Math.floor(d.minutes / 5) + 2, 4, { energy: -Math.min(30, d.minutes / 3), hygiene: -12, fun: 12, calm: 12 }, `💪 ${d.title} logged!`);
    chatUI.specialHTML = '';
    refresh();
  },
  clearChat: () => { const id = current.split(':')[1]; if (confirm('Clear this conversation?')) { state.chats[id] = []; save(); refresh(); } },
};

function keepAndRefresh(ids) {
  const vals = ids.map(id => document.getElementById(id)?.value);
  refresh();
  ids.forEach((id, i) => { const el = document.getElementById(id); if (el && vals[i] != null) el.value = vals[i]; });
}

export function initPanels() {
  const p = panel();
  $('#panelClose').addEventListener('click', closePanel);

  // swipe the panel's header down to close it (phones)
  const head = p.querySelector('header');
  let drag = null;
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button') || window.innerWidth > 640) return;
    drag = { y: e.clientY, dy: 0 };
    head.setPointerCapture(e.pointerId);
    p.style.transition = 'none';
  });
  head.addEventListener('pointermove', e => {
    if (!drag) return;
    drag.dy = Math.max(0, e.clientY - drag.y);
    p.style.transform = `translateY(${drag.dy}px)`;
  });
  const endDrag = () => {
    if (!drag) return;
    const close = drag.dy > 90;
    drag = null;
    p.style.transition = '';
    p.style.transform = '';
    if (close) closePanel();
  };
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);
  p.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (el && ACT[el.dataset.act]) { e.preventDefault(); ACT[el.dataset.act](el); }
  });
  p.addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.dataset.form === 'chat') { const v = $('#chatIn').value; sendChat(v); }
  });
  p.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'chatIn') { e.preventDefault(); sendChat(e.target.value); return; }
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    const map = { habitName: 'addHabit', skillName: 'addSkill', cardA: 'addCard', wMin: 'addWorkout', mealText: 'addMeal', nameIn: 'saveName',
      sleepH: 'saveSleep', manualMin: 'logManual', apiKey: 'saveKey', topicIn: 'submitAsk', logText: 'quickLog',
      renameIn: 'saveRename', parkIn: 'addPark', weighIn: 'weighIn' };
    const act = map[e.target.id];
    if (act) {
      e.preventDefault();
      const btn = e.target.id === 'logText' || e.target.id === 'mealText' ? e.target.parentElement.querySelector('button') : null;
      ACT[act](btn || e.target);
    }
  });
  p.addEventListener('input', e => {
    if (e.target.dataset.j) {
      const j = state.journal[today()] || (state.journal[today()] = {});
      j[e.target.dataset.j] = e.target.value;
      save();
      const s = $('#jSaved');
      if (s) s.textContent = 'Saved ✓';
    }
  });
  p.addEventListener('change', e => {
    if (e.target.id === 'skillSel') timer.skill = e.target.value;
    if (e.target.id === 'buddyIn') studyBuddy = e.target.checked;
    if (e.target.id === 'unitIn') { state.weightUnit = e.target.value; save(); refresh(); }
    if (e.target.dataset.step != null) {
      const st = state.focusSteps[Number(e.target.dataset.step)];
      if (st) { st.done = e.target.checked; if (st.done) toast('✅ Tiny step done!'); save(); refresh(); }
    }
    if (e.target.dataset.share) {
      state.sharing = state.sharing || {};
      state.sharing[e.target.dataset.share] = e.target.checked;
      save();
    }
    if (e.target.id === 'importFile' && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (typeof data !== 'object' || !Array.isArray(data.habits)) throw new Error('bad file');
          data.apiKey = state.apiKey;
          replaceState(data);
          hooks.onChange(true);
          toast('Backup restored 🏡');
          refresh();
        } catch (err) { toast("That file doesn't look like a Pet House backup"); }
      };
      reader.readAsText(e.target.files[0]);
    }
  });
}

export { BOTS };
