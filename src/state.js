// Shared data for the whole house. Everything is saved in this browser (localStorage).

const STORE_KEY = 'petHouse.v1';

export function uid() { return Math.random().toString(36).slice(2, 10); }

export const NEEDS = {
  hunger:  { icon: '🍔', label: 'Hunger',  decay: 9 },   // points lost per real hour
  energy:  { icon: '⚡', label: 'Energy',  decay: 5 },
  hygiene: { icon: '🛁', label: 'Hygiene', decay: 4 },
  fun:     { icon: '🎮', label: 'Fun',     decay: 6 },
  social:  { icon: '💬', label: 'Social',  decay: 5 },
  calm:    { icon: '🧘', label: 'Calm',    decay: 4 },
};

const DEFAULT_STATE = () => ({
  name: '',
  needs: { hunger: 70, energy: 70, hygiene: 70, fun: 70, social: 70, calm: 70 },
  lastTick: Date.now(),
  coins: 40,
  xp: 0,
  claimed: {},           // { date: { key: count } } daily caps for coin rewards
  owned: [],             // shop item ids
  avatar: { skin: '#e0ac69', hair: '#3b2219', hairStyle: 'short', shirt: '#e07a5f', pants: '#3d405b', shoes: '#222222' },
  apiKey: '',
  chats: {},             // { botId: [{ role, content }] }
  timeMode: 'real',      // real | day | night
  walls: 'cut',          // cut | up

  habits: [
    { id: uid(), name: 'Drink water first thing', icon: '💧' },
    { id: uid(), name: 'Move for 20 minutes', icon: '🏃' },
    { id: uid(), name: 'Read 10 pages', icon: '📖' },
    { id: uid(), name: 'No phone in bed', icon: '📵' },
  ],
  habitLog: {},
  skills: ['Studying', 'Coding', 'Drawing'],
  focus: [],
  cards: [{ id: uid(), q: 'What does "I am the pet" mean here?', a: 'Take care of yourself like you would a pet you love.' }],
  workouts: [],
  water: {},
  sleep: {},
  meals: {},
  moods: [],
  calm: {},
  gratitude: {},
  reframes: [],
  journal: {},
  fun: [],               // [{ date, text }]
  social: [],            // [{ date, text }]
});

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const merged = Object.assign(DEFAULT_STATE(), data);
      merged.needs = Object.assign(DEFAULT_STATE().needs, data.needs);
      merged.avatar = Object.assign(DEFAULT_STATE().avatar, data.avatar);
      return merged;
    }
  } catch (e) { /* storage unavailable or corrupt: start fresh */ }
  return DEFAULT_STATE();
}

export let state = load();

export function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  bus.dispatchEvent(new Event('change'));
}

export function replaceState(data) {
  state = data ? Object.assign(DEFAULT_STATE(), data) : DEFAULT_STATE();
  save();
}

// Simple event bus so the HUD and 3D world can react to changes.
export const bus = new EventTarget();

// ---------- dates & formatting ----------

export function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const today = () => dayKey(new Date());

export function lastNDays(n) {
  const out = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) { out.push(dayKey(d)); d.setDate(d.getDate() + 1); }
  return out;
}

const parse = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
export const shortDay = key => parse(key).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
export const niceDate = key => parse(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const sum = arr => arr.reduce((a, b) => a + b, 0);
export const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

// ---------- needs, coins, levels ----------

export function tickNeeds(now = Date.now()) {
  const hours = Math.min(24, Math.max(0, (now - state.lastTick) / 3.6e6));
  for (const k in NEEDS) state.needs[k] = clamp(state.needs[k] - NEEDS[k].decay * hours);
  state.lastTick = now;
}

export function boost(changes) {
  for (const k in changes) state.needs[k] = clamp((state.needs[k] ?? 0) + changes[k]);
}

// Give coins, but only `limit` times per day for the same reason (no farming!).
export function earn(key, coins, limit = Infinity) {
  const t = today();
  const day = state.claimed[t] || (state.claimed[t] = {});
  if ((day[key] || 0) >= limit) return 0;
  day[key] = (day[key] || 0) + 1;
  state.coins += coins;
  state.xp += coins;
  return coins;
}

export function levelInfo() {
  const xp = state.xp;
  const level = Math.floor(Math.sqrt(xp / 30)) + 1;
  const cur = 30 * (level - 1) ** 2, next = 30 * level ** 2;
  return { xp, level, pct: Math.round((xp - cur) / (next - cur) * 100), toNext: next - xp };
}

export function moodScore() {
  return sum(Object.values(state.needs)) / Object.keys(NEEDS).length;
}

// ---------- derived data ----------

export const habitsDone = date => (state.habitLog[date] || []).filter(id => state.habits.some(h => h.id === id));
export const focusMinutes = date => sum(state.focus.filter(f => f.date === date).map(f => f.minutes));
export const workoutMinutes = date => sum(state.workouts.filter(w => w.date === date).map(w => w.minutes));
export function avgMood(date) {
  const m = state.moods.filter(x => x.date === date);
  return m.length ? sum(m.map(x => x.mood)) / m.length : 0;
}
export function journalHasContent(date) {
  const j = state.journal[date];
  return !!j && Object.values(j).some(v => v && v.trim());
}
export function streak(habitId) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  if (!(state.habitLog[dayKey(d)] || []).includes(habitId)) d.setDate(d.getDate() - 1);
  let n = 0;
  while ((state.habitLog[dayKey(d)] || []).includes(habitId)) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
