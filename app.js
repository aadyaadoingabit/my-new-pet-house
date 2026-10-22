/* My Pet House — a cozy self-improvement app where you are the pet.
   Everything is saved in this browser (localStorage). Use the Attic to back up. */

(() => {
  'use strict';

  // ---------- storage ----------

  const STORE_KEY = 'petHouse.v1';

  const DEFAULT_STATE = () => ({
    name: '',
    habits: [
      { id: uid(), name: 'Drink water first thing', icon: '💧' },
      { id: uid(), name: 'Move for 20 minutes', icon: '🏃' },
      { id: uid(), name: 'Read 10 pages', icon: '📖' },
      { id: uid(), name: 'No phone in bed', icon: '📵' },
    ],
    habitLog: {},          // { 'YYYY-MM-DD': [habitId, ...] }
    skills: ['Studying', 'Coding', 'Drawing'],
    focus: [],             // [{ date, skill, minutes }]
    cards: [
      { id: uid(), q: 'What does "I am the pet" mean here?', a: 'Take care of yourself like you would a pet you love.' },
    ],
    workouts: [],          // [{ date, type, minutes }]
    water: {},             // { date: glasses }
    sleep: {},             // { date: hours }
    meals: {},             // { date: [{ text, healthy }] }
    moods: [],             // [{ date, ts, mood, feelings, note }]
    calm: {},              // { date: count }
    gratitude: {},         // { date: [a, b, c] }
    reframes: [],          // [{ date, thought, feeling, evidenceFor, evidenceAgainst, balanced }]
    journal: {},           // { date: { wins, learned, tomorrow, free } }
    theme: null,
  });

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign(DEFAULT_STATE(), JSON.parse(raw));
    } catch (e) { /* storage unavailable or corrupt: start fresh */ }
    return DEFAULT_STATE();
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  let state = load();

  // ---------- helpers ----------

  function uid() { return Math.random().toString(36).slice(2, 10); }

  function dayKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const today = () => dayKey(new Date());

  function lastNDays(n) {
    const out = [];
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (n - 1));
    for (let i = 0; i < n; i++) {
      out.push(dayKey(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function shortDay(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
  }
  function niceDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const sum = arr => arr.reduce((a, b) => a + b, 0);
  const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
  const $ = sel => document.querySelector(sel);

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  // Pick something from a list that stays the same all day.
  function dailyPick(list, salt = 0) {
    const k = today().split('-').map(Number);
    return list[(k[0] * 372 + k[1] * 31 + k[2] + salt) % list.length];
  }

  // ---------- derived numbers ----------

  const habitsDone = date => (state.habitLog[date] || []).filter(id => state.habits.some(h => h.id === id));
  const focusMinutes = date => sum(state.focus.filter(f => f.date === date).map(f => f.minutes));
  const workoutMinutes = date => sum(state.workouts.filter(w => w.date === date).map(w => w.minutes));
  function avgMood(date) {
    const m = state.moods.filter(x => x.date === date);
    return m.length ? sum(m.map(x => x.mood)) / m.length : 0;
  }

  function streak(habitId) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    if (!(state.habitLog[dayKey(d)] || []).includes(habitId)) d.setDate(d.getDate() - 1);
    let n = 0;
    while ((state.habitLog[dayKey(d)] || []).includes(habitId)) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function petStats(date = today()) {
    const habits = state.habits.length ? habitsDone(date).length / state.habits.length * 100 : 0;
    const body = clamp(workoutMinutes(date) / 30 * 50, 0, 50)
      + clamp((state.water[date] || 0) / 8 * 25, 0, 25)
      + ((state.sleep[date] || 0) >= 7 ? 25 : (state.sleep[date] || 0) / 7 * 25);
    const mind = clamp(focusMinutes(date) / 60 * 100);
    const heart = (state.moods.some(m => m.date === date) ? 30 : 0)
      + (journalHasContent(date) ? 30 : 0)
      + ((state.calm[date] || 0) > 0 ? 20 : 0)
      + ((state.gratitude[date] || []).some(Boolean) ? 20 : 0);
    return {
      habits: Math.round(clamp(habits)),
      body: Math.round(clamp(body)),
      mind: Math.round(mind),
      heart: Math.round(clamp(heart)),
    };
  }

  function journalHasContent(date) {
    const j = state.journal[date];
    return !!j && Object.values(j).some(v => v && v.trim());
  }

  function totalXP() {
    return sum(Object.values(state.habitLog).map(a => a.length * 10))
      + sum(state.focus.map(f => f.minutes))
      + sum(state.workouts.map(w => w.minutes))
      + state.moods.length * 5
      + sum(Object.values(state.calm)) * 10
      + Object.values(state.gratitude).filter(g => g.some(Boolean)).length * 10
      + state.reframes.length * 15
      + Object.keys(state.journal).filter(journalHasContent).length * 20;
  }

  function levelInfo() {
    const xp = totalXP();
    const level = Math.floor(Math.sqrt(xp / 50)) + 1;
    const cur = 50 * (level - 1) ** 2;
    const next = 50 * level ** 2;
    return { xp, level, pct: Math.round((xp - cur) / (next - cur) * 100), toNext: next - xp };
  }

  function petFace(stats) {
    const avg = (stats.habits + stats.body + stats.mind + stats.heart) / 4;
    if (avg >= 85) return ['🤩', 'Thriving! You took amazing care of yourself today.'];
    if (avg >= 55) return ['😄', 'Happy and well cared for.'];
    if (avg >= 25) return ['🙂', 'Doing okay. A little more care would help.'];
    if (avg > 0) return ['🥱', 'A bit sleepy. Feed yourself some goals!'];
    return ['😴', 'Still napping. Every small step wakes you up.'];
  }

  // ---------- chart (single-series bar chart with hover tooltips) ----------

  function barChart(points, { unit = '', max, decimals = 0 } = {}) {
    const W = 340, H = 160, padL = 26, padB = 22, padT = 8;
    const top = max ?? Math.max(1, ...points.map(p => p.value));
    const niceTop = max ?? niceCeil(top);
    const plotW = W - padL, plotH = H - padB - padT;
    const slot = plotW / points.length;
    const bw = Math.max(4, Math.min(24, slot - 4));
    const y = v => padT + plotH - (v / niceTop) * plotH;
    const fmt = v => (decimals ? v.toFixed(decimals) : Math.round(v)) + (unit ? ' ' + unit : '');

    let grid = '';
    [0, niceTop / 2, niceTop].forEach(v => {
      grid += `<line class="grid-line" x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>`;
      grid += `<text class="axis" x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${decimals ? v.toFixed(0) : Math.round(v)}</text>`;
    });

    let bars = '';
    points.forEach((p, i) => {
      const cx = padL + slot * i + slot / 2;
      const x = cx - bw / 2;
      const base = y(0);
      const hgt = Math.max(p.value > 0 ? 2 : 2, base - y(p.value));
      const r = Math.min(4, bw / 2, hgt);
      const t = base - hgt;
      const d = `M${x},${base} V${t + r} Q${x},${t} ${x + r},${t} H${x + bw - r} Q${x + bw},${t} ${x + bw},${t + r} V${base} Z`;
      const tip = `${niceDate(p.date)}: ${fmt(p.value)}`;
      bars += `<g data-tip="${esc(tip)}">
        <rect class="hit" x="${padL + slot * i}" y="${padT}" width="${slot}" height="${plotH}"/>
        <path class="mark${p.value > 0 ? '' : ' zero'}" d="${d}"/>
      </g>`;
      if (points.length <= 7 || i % (points.length <= 14 ? 2 : 4) === (points.length - 1) % (points.length <= 14 ? 2 : 4)) {
        bars += `<text class="axis" x="${cx}" y="${H - 6}" text-anchor="middle">${shortDay(p.date)}</text>`;
      }
    });

    const rows = points.map(p => `<tr><td>${niceDate(p.date)}</td><td>${fmt(p.value)}</td></tr>`).join('');
    return `<div class="chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">${grid}${bars}</svg>
      <details class="table-view"><summary>Show as table</summary><table><tr><th>Day</th><th>Value</th></tr>${rows}</table></details>
    </div>`;
  }

  function niceCeil(v) {
    const steps = [1, 2, 4, 5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 300, 500, 1000];
    return steps.find(s => s >= v) || Math.ceil(v / 100) * 100;
  }

  // tooltip for any [data-tip]
  document.addEventListener('mousemove', e => {
    const tip = $('#tooltip');
    const target = e.target.closest && e.target.closest('[data-tip]');
    if (!target) { tip.style.opacity = 0; return; }
    tip.textContent = target.getAttribute('data-tip');
    const w = tip.offsetWidth;
    tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, e.clientX - w / 2)) + 'px';
    tip.style.top = (e.clientY - 40) + 'px';
    tip.style.opacity = 1;
  });

  // ---------- rooms ----------

  const ROOMS = {};

  // 🚪 Front Door
  ROOMS.home = () => {
    const stats = petStats();
    const [face, faceMsg] = petFace(stats);
    const lv = levelInfo();
    const hour = new Date().getHours();
    const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const name = state.name ? `, ${esc(state.name)}` : '';
    const stat = (label, icon, v, hint) => `
      <div class="stat">
        <div class="stat-top"><span>${icon} ${label}</span><span class="muted">${v}%</span></div>
        <div class="bar"><i style="width:${v}%"></i></div>
        <div class="small muted">${hint}</div>
      </div>`;

    return `
      <section class="room-head">
        <h1>${hello}${name}! 🏡</h1>
        <p>Welcome home. In this house <b>you</b> are the pet. Feed yourself good habits, rest, learn and be kind to yourself.</p>
      </section>
      <div class="grid">
        <div class="card">
          <div class="hero">
            <div class="pet" aria-hidden="true">${face}</div>
            <div class="hero-text">
              <span class="level">Level ${lv.level}</span>
              <p style="margin-top:6px">${faceMsg}</p>
              <div class="bar"><i style="width:${lv.pct}%"></i></div>
              <div class="small muted">${lv.xp} XP · ${lv.toNext} XP to level ${lv.level + 1}</div>
            </div>
          </div>
          ${state.name ? '' : `
            <label for="nameIn">What should your house call you?</label>
            <div class="row"><input id="nameIn" placeholder="Your name"><button data-act="saveName">Save</button></div>`}
        </div>
        <div class="card">
          <h2>Today's care meter</h2>
          ${stat('Habits', '✅', stats.habits, 'Living Room checklist')}
          ${stat('Body', '💪', stats.body, 'Workout, water and sleep')}
          ${stat('Mind', '🧠', stats.mind, '60 focus minutes fills it')}
          ${stat('Heart', '💗', stats.heart, 'Mood, journal, calm and gratitude')}
        </div>
        <div class="card wide">
          <h2>Rooms</h2>
          <div class="room-tiles">
            <a class="room-tile" href="#living"><b>🛋️</b>Living Room<br><span>Habits &amp; streaks</span></a>
            <a class="room-tile" href="#study"><b>📚</b>Study<br><span>Focus timer, skills, flashcards</span></a>
            <a class="room-tile" href="#gym"><b>🏋️</b>Gym &amp; Kitchen<br><span>Workouts, water, sleep, food</span></a>
            <a class="room-tile" href="#garden"><b>🌿</b>Calm Garden<br><span>Mood, breathing, reframing</span></a>
            <a class="room-tile" href="#bedroom"><b>🛏️</b>Bedroom<br><span>Daily journal</span></a>
            <a class="room-tile" href="#attic"><b>📈</b>Attic<br><span>Progress charts &amp; backups</span></a>
          </div>
        </div>
        <div class="card wide">
          <h2>💌 Note on the fridge</h2>
          <p>${dailyPick(FRIDGE_NOTES)}</p>
        </div>
      </div>`;
  };

  const FRIDGE_NOTES = [
    'You don\'t have to be perfect today. You just have to show up a little.',
    'Small steps every day beat big steps once in a while.',
    'Rest is part of the work, not the opposite of it.',
    'Talk to yourself like you would talk to a friend you love.',
    'Progress, not perfection.',
    'You are allowed to be a masterpiece and a work in progress at the same time.',
    'Drink some water. Stretch. Breathe. Then try again.',
    'Every expert was once a beginner who kept going.',
    'Feelings are visitors. Let them come and go.',
    'Done is better than perfect.',
  ];

  // 🛋️ Living Room — habits
  ROOMS.living = () => {
    const t = today();
    const done = state.habitLog[t] || [];
    const week = lastNDays(7);
    const items = state.habits.map(h => {
      const isDone = done.includes(h.id);
      const s = streak(h.id);
      const dots = week.map(d => `<i class="${(state.habitLog[d] || []).includes(h.id) ? 'on' : ''}" title="${niceDate(d)}"></i>`).join('');
      return `<div class="habit ${isDone ? 'done' : ''}">
        <button class="check" data-act="toggleHabit" data-id="${h.id}" aria-label="${isDone ? 'Undo' : 'Complete'} ${esc(h.name)}">${isDone ? '✓' : ''}</button>
        <div class="habit-name">${esc(h.icon)} ${esc(h.name)}<div class="week-dots" aria-label="Last 7 days">${dots}</div></div>
        <span class="streak">${s ? `🔥 ${s}` : ''}</span>
        <button class="ghost" data-act="delHabit" data-id="${h.id}" aria-label="Remove ${esc(h.name)}">✕</button>
      </div>`;
    }).join('');

    return `
      <section class="room-head">
        <h1>🛋️ Living Room</h1>
        <p>Your daily routines. Tick them off and keep your streaks warm. 🔥</p>
      </section>
      <div class="grid">
        <div class="card">
          <h2>Today · ${done.filter(id => state.habits.some(h => h.id === id)).length}/${state.habits.length}</h2>
          ${items || '<p class="muted">No habits yet. Add one below!</p>'}
        </div>
        <div class="card">
          <h2>Add a habit</h2>
          <label for="habitName">Habit</label>
          <input id="habitName" placeholder="e.g. Stretch for 5 minutes">
          <label for="habitIcon">Emoji</label>
          <div class="row">
            <select id="habitIcon">
              ${['⭐', '💧', '🏃', '📖', '🧘', '🥗', '😴', '📵', '🎨', '🎵', '💻', '🧹', '🦷', '☀️', '✍️', '🙏'].map(e => `<option>${e}</option>`).join('')}
            </select>
            <button data-act="addHabit">Add habit</button>
          </div>
          <div class="note" style="margin-top:16px">
            <b>Tip:</b> start with habits so small they feel almost too easy, like "put on running shoes". Once they stick, make them bigger.
          </div>
        </div>
      </div>`;
  };

  // 📚 Study — focus timer, skills, flashcards
  const timer = { running: false, duration: 25 * 60, remaining: 25 * 60, endAt: 0, skill: null, tick: null };

  ROOMS.study = () => {
    if (!timer.skill) timer.skill = state.skills[0] || 'Studying';
    const t = today();
    const todayLog = state.focus.filter(f => f.date === t);
    const skillTotals = state.skills.map(s => ({ s, m: sum(state.focus.filter(f => f.skill === s).map(f => f.minutes)) }));
    const card = state.cards[flash.index % Math.max(1, state.cards.length)];

    return `
      <section class="room-head">
        <h1>📚 Study</h1>
        <p>Focus timer for school and skills. Every focused minute levels you up.</p>
      </section>
      <div class="grid">
        <div class="card">
          <h2>Focus timer</h2>
          <div class="timer">
            <div class="timer-face" id="timerFace">${fmtTime(timer.remaining)}</div>
            <div class="row presets">
              ${[5, 15, 25, 45, 60].map(m => `<button class="secondary ${timer.duration === m * 60 ? 'on' : ''}" data-act="preset" data-min="${m}" ${timer.running ? 'disabled' : ''}>${m}m</button>`).join('')}
            </div>
            <label for="skillSel">Working on</label>
            <select id="skillSel" ${timer.running ? 'disabled' : ''}>
              ${state.skills.map(s => `<option ${s === timer.skill ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
            <div class="row" style="justify-content:center;margin-top:12px">
              <button data-act="timerStart" id="timerBtn">${timer.running ? 'Pause' : (timer.remaining < timer.duration ? 'Resume' : 'Start')}</button>
              <button class="secondary" data-act="timerStop" ${timer.remaining === timer.duration && !timer.running ? 'disabled' : ''}>Finish &amp; log</button>
            </div>
          </div>
          <p class="small muted">Today: ${focusMinutes(t)} focus minutes in ${todayLog.length} session${todayLog.length === 1 ? '' : 's'}.</p>
        </div>

        <div class="card">
          <h2>Skills I'm growing</h2>
          <ul class="list">
            ${skillTotals.map(({ s, m }) => `<li><span>${esc(s)}</span><span class="muted">${(m / 60).toFixed(1)} h
              <button class="ghost" data-act="delSkill" data-skill="${esc(s)}" aria-label="Remove ${esc(s)}">✕</button></span></li>`).join('')}
          </ul>
          <label for="skillName">Add a skill or subject</label>
          <div class="row"><input id="skillName" placeholder="e.g. Spanish, Guitar, Math"><button data-act="addSkill">Add</button></div>
          <p class="small muted" style="margin-top:8px">Did practice away from the timer? Log it:</p>
          <div class="row">
            <input id="manualMin" type="number" min="1" placeholder="Minutes">
            <button class="secondary" data-act="logManual">Log for selected skill</button>
          </div>
        </div>

        <div class="card">
          <h2>Flashcards</h2>
          ${card ? `
            <button class="flashcard" data-act="flip">${esc(flash.showAnswer ? card.a : card.q)}</button>
            <p class="small muted" style="text-align:center;margin-top:6px">${flash.showAnswer ? 'Answer' : 'Tap to see the answer'} · card ${(flash.index % state.cards.length) + 1} of ${state.cards.length}</p>
            <div class="row" style="justify-content:center">
              <button class="secondary" data-act="nextCard">Next card</button>
              <button class="ghost" data-act="delCard" data-id="${card.id}">Delete card</button>
            </div>` : '<p class="muted">No cards yet.</p>'}
          <label for="cardQ">Question</label><input id="cardQ" placeholder="e.g. Capital of Japan?">
          <label for="cardA">Answer</label><input id="cardA" placeholder="e.g. Tokyo">
          <div style="margin-top:8px"><button data-act="addCard">Add card</button></div>
        </div>
      </div>`;
  };

  const flash = { index: 0, showAnswer: false };

  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  }

  function timerTick() {
    timer.remaining = (timer.endAt - Date.now()) / 1000;
    if (timer.remaining <= 0) {
      timer.remaining = 0;
      finishTimer(true);
      return;
    }
    const face = $('#timerFace');
    if (face) face.textContent = fmtTime(timer.remaining);
    document.title = `${fmtTime(timer.remaining)} · My Pet House`;
  }

  function finishTimer(completed) {
    clearInterval(timer.tick);
    const minutes = Math.round((timer.duration - timer.remaining) / 60);
    timer.running = false;
    timer.remaining = timer.duration;
    document.title = 'My Pet House';
    if (minutes >= 1) {
      state.focus.push({ date: today(), skill: timer.skill, minutes });
      save();
      toast(completed ? `🎉 Session done! +${minutes} XP for ${timer.skill}` : `Logged ${minutes} min of ${timer.skill}`);
      if (completed) chime();
    } else {
      toast('Session too short to log (under 1 minute)');
    }
    render();
  }

  function chime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [660, 880, 990].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f;
        o.connect(g); g.connect(ctx.destination);
        const t0 = ctx.currentTime + i * 0.18;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        o.start(t0); o.stop(t0 + 0.55);
      });
    } catch (e) { /* no audio */ }
  }

  // 🏋️ Gym & Kitchen
  ROOMS.gym = () => {
    const t = today();
    const glasses = state.water[t] || 0;
    const todayW = state.workouts.filter(w => w.date === t);
    const meals = state.meals[t] || [];
    return `
      <section class="room-head">
        <h1>🏋️ Gym &amp; Kitchen</h1>
        <p>Move your body, drink water, sleep well and eat things that make you feel good.</p>
      </section>
      <div class="grid">
        <div class="card">
          <h2>Log a workout</h2>
          <label for="wType">Activity</label>
          <select id="wType">
            ${['Walk', 'Run', 'Strength', 'Yoga / stretching', 'Sports', 'Dance', 'Cycling', 'Swimming', 'Other'].map(x => `<option>${x}</option>`).join('')}
          </select>
          <label for="wMin">Minutes</label>
          <div class="row"><input id="wMin" type="number" min="1" placeholder="30"><button data-act="addWorkout">Log</button></div>
          <ul class="list" style="margin-top:12px">
            ${todayW.map((w, i) => `<li><span>${esc(w.type)}</span><span class="muted">${w.minutes} min</span></li>`).join('') || '<li class="muted">Nothing yet today.</li>'}
          </ul>
        </div>
        <div class="card">
          <h2>💧 Water · ${glasses}/8 glasses</h2>
          <div class="water">
            ${Array.from({ length: 8 }, (_, i) => `<button class="${i < glasses ? 'on' : ''}" data-act="water" data-n="${i + 1}" aria-label="${i + 1} glasses">🥛</button>`).join('')}
          </div>
          <h2 style="margin-top:16px">😴 Sleep last night</h2>
          <div class="row">
            <input id="sleepH" type="number" min="0" max="16" step="0.5" value="${state.sleep[t] ?? ''}" placeholder="Hours">
            <button data-act="saveSleep">Save</button>
          </div>
          <p class="small muted" style="margin-top:6px">Most teens need 8–10 hours, most adults 7–9.</p>
        </div>
        <div class="card">
          <h2>🥗 Kitchen: what I ate</h2>
          <div class="row">
            <input id="mealText" placeholder="e.g. Oatmeal with banana">
            <button data-act="addMeal">Add</button>
          </div>
          <label class="row" style="gap:6px"><input type="checkbox" id="mealHealthy" style="width:auto"> This made my body feel good</label>
          <ul class="list" style="margin-top:8px">
            ${meals.map(m => `<li><span>${esc(m.text)}</span><span>${m.healthy ? '💚' : ''}</span></li>`).join('') || '<li class="muted">No meals logged today.</li>'}
          </ul>
        </div>
      </div>`;
  };

  // 🌿 Calm Garden — therapy-style self-care tools
  const breath = { running: false, timeouts: [], rounds: 0 };
  const FEELINGS = ['Happy', 'Calm', 'Proud', 'Excited', 'Grateful', 'Tired', 'Stressed', 'Anxious', 'Sad', 'Lonely', 'Angry', 'Overwhelmed', 'Bored', 'Hopeful'];
  const GENTLE_PROMPTS = [
    'What is one thing you need right now, and how could you give it to yourself?',
    'What would you say to a friend who felt the way you feel today?',
    'Name one thing you handled better than you would have a year ago.',
    'What is something you are worrying about that you cannot control? Can you let it rest for today?',
    'Which part of your day gave you energy, and which part drained it?',
    'What is one boundary that would make your life a little easier?',
    'What does "good enough" look like for today?',
    'Who makes you feel safe, and when did you last talk to them?',
  ];
  const THINKING_TRAPS = [
    ['All-or-nothing', '"If it\'s not perfect, it\'s a failure."'],
    ['Mind reading', '"Everyone thinks I\'m weird."'],
    ['Fortune telling', '"It\'s definitely going to go badly."'],
    ['Catastrophizing', '"This is the worst thing ever."'],
    ['Should statements', '"I should be better at this by now."'],
    ['Labeling', '"I\'m so stupid."'],
  ];
  let pickedMood = 0;
  let pickedFeelings = [];

  ROOMS.garden = () => {
    const t = today();
    const todayMoods = state.moods.filter(m => m.date === t);
    const grat = state.gratitude[t] || ['', '', ''];
    const moodFaces = ['😢', '😕', '😐', '🙂', '😄'];
    return `
      <section class="room-head">
        <h1>🌿 Calm Garden</h1>
        <p>A quiet corner to check in with yourself. These tools come from ideas used in therapy, like CBT and mindfulness.</p>
      </section>
      <div class="grid">
        <div class="card">
          <h2>How are you feeling?</h2>
          <div class="moods">
            ${moodFaces.map((f, i) => `<button class="${pickedMood === i + 1 ? 'on' : ''}" data-act="pickMood" data-m="${i + 1}" aria-label="Mood ${i + 1} of 5">${f}</button>`).join('')}
          </div>
          <div class="chips">
            ${FEELINGS.map(f => `<button class="chip ${pickedFeelings.includes(f) ? 'on' : ''}" data-act="pickFeeling" data-f="${f}">${f}</button>`).join('')}
          </div>
          <label for="moodNote">Anything on your mind? (optional)</label>
          <textarea id="moodNote" placeholder="I feel this way because..."></textarea>
          <div style="margin-top:8px"><button data-act="saveMood" ${pickedMood ? '' : 'disabled'}>Save check-in</button></div>
          ${todayMoods.length ? `<ul class="list" style="margin-top:12px">${todayMoods.map(m => `<li><span>${moodFaces[m.mood - 1]} ${esc(m.feelings.join(', '))}</span><span class="muted small">${new Date(m.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></li>`).join('')}</ul>` : ''}
        </div>

        <div class="card">
          <h2>Box breathing</h2>
          <p class="small muted">Breathe in 4 seconds, hold 4, out 4, hold 4. Great for calming nerves before a test or when your mind is racing.</p>
          <div class="breath-wrap"><div class="breath" id="breath">Ready?</div></div>
          <div class="row" style="justify-content:center">
            <button data-act="breathe">${breath.running ? 'Stop' : 'Start breathing'}</button>
          </div>
        </div>

        <div class="card">
          <h2>5-4-3-2-1 grounding</h2>
          <p class="small muted">When you feel anxious or overwhelmed, slowly notice:</p>
          <ol class="steps">
            <li><b>5</b> things you can <b>see</b></li>
            <li><b>4</b> things you can <b>touch</b></li>
            <li><b>3</b> things you can <b>hear</b></li>
            <li><b>2</b> things you can <b>smell</b></li>
            <li><b>1</b> thing you can <b>taste</b></li>
          </ol>
          <button class="secondary" data-act="calmDone">I did it ✓</button>
        </div>

        <div class="card">
          <h2>🙏 Three good things</h2>
          ${[0, 1, 2].map(i => `<input class="grat" data-i="${i}" value="${esc(grat[i])}" placeholder="Good thing #${i + 1}" style="margin-bottom:8px">`).join('')}
          <button data-act="saveGrat">Save</button>
        </div>

        <div class="card wide">
          <h2>🧠 Thought reframe</h2>
          <p class="small muted">Our brains sometimes fall into "thinking traps". Write the thought down and look at it like a detective.</p>
          <div class="chips" style="margin-bottom:8px">
            ${THINKING_TRAPS.map(([n, ex]) => `<span class="chip" data-tip="${esc(ex)}">${n}</span>`).join('')}
          </div>
          <div class="grid">
            <div>
              <label for="rfThought">1. The thought that's bugging me</label>
              <textarea id="rfThought" placeholder="I'm going to fail this test."></textarea>
              <label for="rfFor">2. Evidence that it's true</label>
              <textarea id="rfFor"></textarea>
            </div>
            <div>
              <label for="rfAgainst">3. Evidence that it's not totally true</label>
              <textarea id="rfAgainst" placeholder="I passed the last quiz. I've been studying."></textarea>
              <label for="rfBalanced">4. A kinder, more balanced thought</label>
              <textarea id="rfBalanced" placeholder="I might find it hard, but I've prepared and I can do my best."></textarea>
            </div>
          </div>
          <div style="margin-top:8px"><button data-act="saveReframe">Save reframe</button></div>
          ${state.reframes.length ? `<details style="margin-top:12px"><summary>Past reframes (${state.reframes.length})</summary>
            ${state.reframes.slice().reverse().map(r => `<div class="entry"><b>${niceDate(r.date)}</b><p>💭 ${esc(r.thought)}</p><p>🌱 ${esc(r.balanced)}</p></div>`).join('')}
          </details>` : ''}
        </div>

        <div class="card">
          <h2>Today's gentle question</h2>
          <p>${dailyPick(GENTLE_PROMPTS)}</p>
          <a href="#bedroom">Write about it in your journal →</a>
        </div>

        <div class="card">
          <h2>💛 You're not alone</h2>
          <div class="note">
            This garden is for everyday self-care. It is <b>not</b> a replacement for a real therapist, counselor or doctor.
            If you are struggling, please talk to a trusted adult, friend or professional.
            <br><br>
            <b>If you are in danger or thinking about hurting yourself</b>, call your local emergency number now, or reach a crisis line:
            in the US call or text <b>988</b>, in the UK call <b>116 123</b> (Samaritans), in India call <b>14416</b> (Tele-MANAS),
            or find a free helpline in your country at <a href="https://findahelpline.com" target="_blank" rel="noopener">findahelpline.com</a>.
          </div>
        </div>
      </div>`;
  };

  function startBreathing() {
    const el = $('#breath');
    if (!el) return;
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
      if (i % 4 === 0) breath.rounds++;
      if (breath.rounds === 4) {
        state.calm[today()] = (state.calm[today()] || 0) + 1;
        save();
        toast('🌿 4 rounds of calm breathing. Nice work.');
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

  // 🛏️ Bedroom — journal
  const JOURNAL_PROMPTS = [
    'What made you smile today?',
    'What is something you learned about yourself this week?',
    'If today had a title, what would it be?',
    'What is one thing you want to remember about today?',
    'What challenged you today and how did you handle it?',
    'Describe your ideal tomorrow.',
    'What are you proud of right now?',
    'What would future-you thank you for doing today?',
  ];

  ROOMS.bedroom = () => {
    const t = today();
    const j = state.journal[t] || {};
    const past = Object.keys(state.journal).filter(k => k !== t && journalHasContent(k)).sort().reverse();
    const area = (id, label, ph) => `<label for="j_${id}">${label}</label><textarea id="j_${id}" data-j="${id}" placeholder="${esc(ph)}">${esc(j[id] || '')}</textarea>`;
    return `
      <section class="room-head">
        <h1>🛏️ Bedroom</h1>
        <p>Wind down and reflect. Your journal saves automatically as you type.</p>
      </section>
      <div class="grid">
        <div class="card">
          <h2>${niceDate(t)}</h2>
          ${area('wins', '🏆 Wins today (big or tiny)', 'I finished my homework early...')}
          ${area('learned', '💡 Something I learned', '')}
          ${area('tomorrow', '🎯 One thing I want to do tomorrow', '')}
          ${area('free', '✍️ ' + dailyPick(JOURNAL_PROMPTS, 3), '')}
          <p class="small muted" id="jSaved" style="margin-top:6px">${journalHasContent(t) ? 'Saved ✓' : ''}</p>
        </div>
        <div class="card">
          <h2>Past entries</h2>
          ${past.length ? past.slice(0, 30).map(k => {
            const e = state.journal[k];
            return `<div class="entry"><b>${niceDate(k)}</b>
              ${e.wins ? `<p>🏆 ${esc(e.wins)}</p>` : ''}
              ${e.learned ? `<p>💡 ${esc(e.learned)}</p>` : ''}
              ${e.tomorrow ? `<p>🎯 ${esc(e.tomorrow)}</p>` : ''}
              ${e.free ? `<p>✍️ ${esc(e.free)}</p>` : ''}
            </div>`;
          }).join('') : '<p class="muted">Your past entries will show up here.</p>'}
        </div>
      </div>`;
  };

  // 📈 Attic — progress + settings
  let atticRange = 14;

  ROOMS.attic = () => {
    const days = lastNDays(atticRange);
    const pts = fn => days.map(d => ({ date: d, value: fn(d) }));
    const habitPts = pts(d => habitsDone(d).length);
    const focusPts = pts(focusMinutes);
    const workPts = pts(workoutMinutes);
    const moodPts = pts(avgMood);
    const totalFocus = sum(focusPts.map(p => p.value));
    const totalWork = sum(workPts.map(p => p.value));
    const totalHabits = sum(habitPts.map(p => p.value));
    const moodDays = moodPts.filter(p => p.value > 0);
    const best = state.habits.map(h => ({ h, s: streak(h.id) })).sort((a, b) => b.s - a.s)[0];

    return `
      <section class="room-head">
        <h1>📈 Attic</h1>
        <p>Look how far you've come. Hover a bar to see the exact number.</p>
        <div class="row">
          ${[7, 14, 30].map(n => `<button class="${atticRange === n ? '' : 'secondary'}" data-act="range" data-n="${n}">Last ${n} days</button>`).join('')}
        </div>
      </section>
      <div class="grid">
        <div class="card"><div class="chart-sub">Habits completed</div><div class="big-number">${totalHabits}</div>
          <div class="small muted">${best && best.s ? `Best streak right now: ${esc(best.h.name)} 🔥 ${best.s}` : 'Start a streak today!'}</div></div>
        <div class="card"><div class="chart-sub">Focus time</div><div class="big-number">${(totalFocus / 60).toFixed(1)} h</div></div>
        <div class="card"><div class="chart-sub">Exercise</div><div class="big-number">${totalWork} min</div></div>
        <div class="card"><div class="chart-sub">Average mood</div><div class="big-number">${moodDays.length ? (sum(moodDays.map(p => p.value)) / moodDays.length).toFixed(1) + ' / 5' : '–'}</div></div>

        <div class="card"><h2>Habits completed per day</h2>${barChart(habitPts, { unit: 'habits', max: Math.max(1, state.habits.length) })}</div>
        <div class="card"><h2>Focus minutes per day</h2>${barChart(focusPts, { unit: 'min' })}</div>
        <div class="card"><h2>Exercise minutes per day</h2>${barChart(workPts, { unit: 'min' })}</div>
        <div class="card"><h2>Mood per day</h2><div class="chart-sub">1 = 😢 · 5 = 😄 · empty = no check-in</div>${barChart(moodPts, { unit: '/ 5', max: 5, decimals: 1 })}</div>

        <div class="card wide">
          <h2>🔧 House settings</h2>
          <p class="small muted">Your data lives only in this browser. Download a backup now and then so you never lose it.</p>
          <label for="setName">Your name</label>
          <div class="row"><input id="setName" value="${esc(state.name)}"><button data-act="saveSetName">Save</button></div>
          <div class="row" style="margin-top:12px">
            <button class="secondary" data-act="export">⬇️ Download backup</button>
            <label class="btn secondary" style="margin:0;color:var(--accent);background:transparent;cursor:pointer">⬆️ Restore backup
              <input type="file" id="importFile" accept="application/json" hidden>
            </label>
            <button class="ghost" data-act="reset">Reset everything</button>
          </div>
        </div>
      </div>`;
  };

  // ---------- actions ----------

  const ACTIONS = {
    saveName() {
      const v = $('#nameIn').value.trim();
      if (v) { state.name = v; save(); render(); toast(`Welcome home, ${v}! 🏡`); }
    },
    saveSetName() { state.name = $('#setName').value.trim(); save(); toast('Saved'); },

    toggleHabit(el) {
      const t = today();
      const list = state.habitLog[t] || (state.habitLog[t] = []);
      const i = list.indexOf(el.dataset.id);
      if (i >= 0) list.splice(i, 1);
      else {
        list.push(el.dataset.id);
        const s = streak(el.dataset.id);
        toast(s > 1 ? `🔥 ${s} day streak! +10 XP` : '✅ Nice! +10 XP');
      }
      save(); render();
    },
    addHabit() {
      const name = $('#habitName').value.trim();
      if (!name) return;
      state.habits.push({ id: uid(), name, icon: $('#habitIcon').value });
      save(); render();
    },
    delHabit(el) {
      const h = state.habits.find(x => x.id === el.dataset.id);
      if (h && confirm(`Remove "${h.name}"? Its history will stop counting.`)) {
        state.habits = state.habits.filter(x => x.id !== h.id);
        save(); render();
      }
    },

    preset(el) {
      timer.duration = timer.remaining = Number(el.dataset.min) * 60;
      render();
    },
    timerStart() {
      if (timer.running) {
        clearInterval(timer.tick);
        timer.running = false;
        timer.remaining = (timer.endAt - Date.now()) / 1000;
      } else {
        timer.skill = $('#skillSel').value;
        timer.endAt = Date.now() + timer.remaining * 1000;
        timer.running = true;
        timer.tick = setInterval(timerTick, 250);
      }
      render();
    },
    timerStop() {
      if (timer.running) timer.remaining = (timer.endAt - Date.now()) / 1000;
      finishTimer(false);
    },
    addSkill() {
      const v = $('#skillName').value.trim();
      if (v && !state.skills.includes(v)) { state.skills.push(v); save(); render(); }
    },
    delSkill(el) {
      const s = el.dataset.skill;
      if (state.skills.length > 1 && confirm(`Remove "${s}" from your list? Logged time stays in your history.`)) {
        state.skills = state.skills.filter(x => x !== s);
        if (timer.skill === s) timer.skill = state.skills[0];
        save(); render();
      }
    },
    logManual() {
      const m = Math.round(Number($('#manualMin').value));
      if (m > 0) {
        state.focus.push({ date: today(), skill: $('#skillSel').value, minutes: m });
        save(); render(); toast(`Logged ${m} min. +${m} XP`);
      }
    },
    flip() { flash.showAnswer = !flash.showAnswer; render(); },
    nextCard() {
      flash.showAnswer = false;
      flash.index = state.cards.length > 1 ? (flash.index + 1 + Math.floor(Math.random() * (state.cards.length - 1))) % state.cards.length : 0;
      render();
    },
    addCard() {
      const q = $('#cardQ').value.trim(), a = $('#cardA').value.trim();
      if (q && a) { state.cards.push({ id: uid(), q, a }); flash.index = state.cards.length - 1; flash.showAnswer = false; save(); render(); }
    },
    delCard(el) {
      state.cards = state.cards.filter(c => c.id !== el.dataset.id);
      flash.index = 0; flash.showAnswer = false;
      save(); render();
    },

    addWorkout() {
      const m = Math.round(Number($('#wMin').value));
      if (m > 0) {
        state.workouts.push({ date: today(), type: $('#wType').value, minutes: m });
        save(); render(); toast(`💪 +${m} XP`);
      }
    },
    water(el) {
      const n = Number(el.dataset.n);
      const t = today();
      state.water[t] = state.water[t] === n ? n - 1 : n;
      save(); render();
      if (state.water[t] === 8) toast('💧 Fully hydrated!');
    },
    saveSleep() {
      const h = Number($('#sleepH').value);
      if (h >= 0) { state.sleep[today()] = h; save(); render(); toast('😴 Sleep saved'); }
    },
    addMeal() {
      const text = $('#mealText').value.trim();
      if (!text) return;
      const t = today();
      (state.meals[t] || (state.meals[t] = [])).push({ text, healthy: $('#mealHealthy').checked });
      save(); render();
    },

    pickMood(el) { pickedMood = Number(el.dataset.m); keepNoteAndRender(); },
    pickFeeling(el) {
      const f = el.dataset.f;
      pickedFeelings = pickedFeelings.includes(f) ? pickedFeelings.filter(x => x !== f) : [...pickedFeelings, f];
      keepNoteAndRender();
    },
    saveMood() {
      if (!pickedMood) return;
      state.moods.push({ date: today(), ts: Date.now(), mood: pickedMood, feelings: pickedFeelings, note: $('#moodNote').value.trim() });
      pickedMood = 0; pickedFeelings = [];
      save(); render(); toast('💗 Thanks for checking in with yourself');
    },
    breathe() {
      if (breath.running) { stopBreathing(); render(); }
      else { render(); startBreathing(); const b = document.querySelector('[data-act="breathe"]'); if (b) b.textContent = 'Stop'; }
    },
    calmDone() {
      state.calm[today()] = (state.calm[today()] || 0) + 1;
      save(); toast('🌿 Grounded. +10 XP');
    },
    saveGrat() {
      state.gratitude[today()] = [...document.querySelectorAll('.grat')].map(i => i.value.trim());
      save(); toast('🙏 Saved');
    },
    saveReframe() {
      const r = {
        date: today(),
        thought: $('#rfThought').value.trim(),
        evidenceFor: $('#rfFor').value.trim(),
        evidenceAgainst: $('#rfAgainst').value.trim(),
        balanced: $('#rfBalanced').value.trim(),
      };
      if (!r.thought || !r.balanced) { toast('Fill in the thought and the balanced thought'); return; }
      state.reframes.push(r);
      save(); render(); toast('🌱 Reframed. +15 XP');
    },

    range(el) { atticRange = Number(el.dataset.n); render(); },
    export() {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pet-house-backup-${today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    reset() {
      if (confirm('Erase ALL your data in this browser? Download a backup first if you want to keep it.')) {
        state = DEFAULT_STATE();
        save(); render(); toast('House reset');
      }
    },
  };

  function keepNoteAndRender() {
    const note = $('#moodNote') ? $('#moodNote').value : '';
    render();
    if ($('#moodNote')) $('#moodNote').value = note;
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (el && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el);
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    const map = { habitName: 'addHabit', skillName: 'addSkill', cardA: 'addCard', wMin: 'addWorkout', mealText: 'addMeal', nameIn: 'saveName', sleepH: 'saveSleep', manualMin: 'logManual' };
    if (map[e.target.id]) ACTIONS[map[e.target.id]]();
  });

  document.addEventListener('input', e => {
    if (e.target.dataset.j) {
      const t = today();
      const j = state.journal[t] || (state.journal[t] = {});
      j[e.target.dataset.j] = e.target.value;
      save();
      const s = $('#jSaved');
      if (s) s.textContent = 'Saved ✓';
    }
  });

  document.addEventListener('change', e => {
    if (e.target.id === 'skillSel') timer.skill = e.target.value;
    if (e.target.id === 'importFile' && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (typeof data !== 'object' || !Array.isArray(data.habits)) throw new Error('bad file');
          state = Object.assign(DEFAULT_STATE(), data);
          save(); render(); toast('Backup restored 🏡');
        } catch (err) { toast('That file doesn\'t look like a Pet House backup'); }
      };
      reader.readAsText(e.target.files[0]);
    }
  });

  // ---------- theme ----------

  function applyTheme() {
    if (state.theme) document.documentElement.setAttribute('data-theme', state.theme);
    else document.documentElement.removeAttribute('data-theme');
    const dark = state.theme ? state.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    $('#themeToggle').textContent = dark ? '☀️' : '🌙';
  }
  $('#themeToggle').addEventListener('click', () => {
    const dark = state.theme ? state.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    state.theme = dark ? 'light' : 'dark';
    save(); applyTheme();
  });

  // ---------- router ----------

  function render() {
    const route = (location.hash || '#home').slice(1);
    const room = ROOMS[route] ? route : 'home';
    if (room !== 'garden' && breath.running) stopBreathing();
    $('#tooltip').style.opacity = 0;
    $('#app').innerHTML = ROOMS[room]();
    document.querySelectorAll('.rooms a').forEach(a => a.classList.toggle('active', a.dataset.route === room));
  }

  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo(0, 0);
    const active = document.querySelector('.rooms a.active');
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest' });
  });

  applyTheme();
  render();
})();
