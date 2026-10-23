// Patterns each helper notices in your own logs. Plain observations ("I noticed..."), never diagnoses.
import { state, lastNDays, habitsDone, focusMinutes, workoutMinutes, avgMood, journalHasContent, sum, niceDate } from './state.js';

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const weekday = key => niceDate(key).split(',')[0];
const mean = arr => (arr.length ? sum(arr) / arr.length : 0);

function compareDays(days, test, value) {
  const yes = days.filter(test).map(value).filter(v => v > 0);
  const no = days.filter(d => !test(d)).map(value).filter(v => v > 0);
  return yes.length >= 2 && no.length >= 2 ? { yes: mean(yes), no: mean(no) } : null;
}

export function weightTrend() {
  const w = state.weights.slice(-6);
  if (w.length < 2) return null;
  const first = w[0], last = w[w.length - 1];
  const weeks = Math.max(1, (new Date(last.date) - new Date(first.date)) / (7 * 864e5));
  return { change: last.value - first.value, perWeek: (last.value - first.value) / weeks, latest: last.value, count: w.length };
}

const finders = {
  sunny() {
    const out = [];
    const week = lastNDays(7), prev = lastNDays(14).slice(0, 7);
    const n = state.habits.length;
    if (n) {
      const rate = pct(sum(week.map(d => habitsDone(d).length)), n * 7);
      const before = pct(sum(prev.map(d => habitsDone(d).length)), n * 7);
      out.push(`Habits done this week: ${rate}% (the week before: ${before}%).`);
      const missed = state.habits.map(h => ({ h, c: week.filter(d => (state.habitLog[d] || []).includes(h.id)).length })).sort((a, b) => a.c - b.c)[0];
      if (missed && missed.c < 3) out.push(`The habit that slipped most: "${missed.h.name}" (${missed.c} of 7 days).`);
    }
    const ps = state.promises.filter(p => week.includes(p.date));
    if (ps.length) out.push(`Tiny promises this week: ${ps.length} made, ${ps.filter(p => p.kept).length} kept.`);
    const lonely = state.moods.filter(m => week.includes(m.date) && m.feelings.some(f => ['Lonely', 'Anxious', 'Sad'].includes(f)));
    if (lonely.length >= 2) {
      const late = lonely.filter(m => new Date(m.ts).getHours() >= 20).length;
      out.push(`Felt lonely, anxious or sad ${lonely.length} times this week${late >= lonely.length / 2 ? ', mostly in the evening' : ''}.`);
    }
    return out;
  },
  owl() {
    const out = [];
    const week = lastNDays(7);
    const sessions = state.focus.filter(f => week.includes(f.date));
    if (sessions.length) {
      out.push(`Focus this week: ${sum(sessions.map(s => s.minutes))} minutes in ${sessions.length} sessions (about ${Math.round(mean(sessions.map(s => s.minutes)))} min each).`);
      const timed = sessions.filter(s => s.ts);
      if (timed.length >= 3) {
        const buckets = { morning: [], afternoon: [], evening: [] };
        for (const s of timed) {
          const h = new Date(s.ts).getHours();
          (h < 12 ? buckets.morning : h < 18 ? buckets.afternoon : buckets.evening).push(s.minutes);
        }
        const best = Object.entries(buckets).filter(([, v]) => v.length).sort((a, b) => mean(b[1]) - mean(a[1]))[0];
        if (best) out.push(`Longest focus sessions happen in the ${best[0]}.`);
      }
      const bySkill = {};
      for (const s of sessions) bySkill[s.skill] = (bySkill[s.skill] || 0) + s.minutes;
      const top = Object.entries(bySkill).sort((a, b) => b[1] - a[1])[0];
      if (top) out.push(`Most studied: ${top[0]} (${top[1]} min).`);
    }
    if (state.parking.length >= 3) out.push(`${state.parking.length} distracting thoughts are parked in the parking lot.`);
    const active = state.courses.map(c => ({ c, done: sum(c.units.map(u => u.lessons.filter(l => l.done).length)), total: sum(c.units.map(u => u.lessons.length)) }));
    for (const a of active.slice(0, 2)) out.push(`Course "${a.c.title}": ${a.done} of ${a.total} lessons done.`);
    return out;
  },
  basil() {
    const out = [];
    const week = lastNDays(7);
    const meals = week.map(d => (state.meals[d] || []).length);
    if (sum(meals)) {
      out.push(`Meals logged: ${sum(meals)} this week (${week.filter((d, i) => meals[i]).length} of 7 days).`);
      const all = week.flatMap(d => state.meals[d] || []);
      out.push(`${pct(all.filter(m => m.healthy).length, all.length)}% of meals felt good for your body.`);
    }
    const water = week.map(d => state.water[d] || 0).filter(Boolean);
    if (water.length) out.push(`Water: about ${mean(water).toFixed(1)} glasses on days you logged it.`);
    const stress = compareDays(week, d => state.moods.some(m => m.date === d && m.feelings.includes('Stressed')), d => (state.meals[d] || []).length);
    if (stress && stress.yes < stress.no) out.push('On stressful days you log fewer meals.');
    const t = weightTrend();
    if (t) out.push(`Weight trend: ${t.change > 0 ? '+' : ''}${t.change.toFixed(1)} ${state.weightUnit} over ${t.count} weigh-ins.`);
    return out;
  },
  rex() {
    const out = [];
    const week = lastNDays(7);
    const mins = week.map(workoutMinutes);
    if (sum(mins)) {
      out.push(`Exercise: ${sum(mins)} minutes on ${mins.filter(Boolean).length} of 7 days.`);
      const types = {};
      state.workouts.filter(w => week.includes(w.date)).forEach(w => { types[w.type] = (types[w.type] || 0) + 1; });
      const fav = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
      if (fav) out.push(`Favorite this week: ${fav[0]}.`);
    }
    const days14 = lastNDays(14);
    const sleep = compareDays(days14, d => (state.sleep[d] ?? 0) >= 7, d => workoutMinutes(d) || 0.0001);
    if (sleep && sleep.yes > sleep.no * 1.2) out.push('You move more on days after a good night of sleep.');
    const t = weightTrend();
    if (t) out.push(`Weight is changing about ${t.perWeek > 0 ? '+' : ''}${t.perWeek.toFixed(2)} ${state.weightUnit} per week.`);
    return out;
  },
  luna() {
    const out = [];
    const week = lastNDays(7);
    const j = week.filter(journalHasContent).length;
    if (j) out.push(`Journaled ${j} of 7 nights.`);
    const moods = week.map(d => ({ d, m: avgMood(d) })).filter(x => x.m);
    if (moods.length >= 3) {
      const best = moods.sort((a, b) => b.m - a.m)[0];
      out.push(`Average mood: ${mean(moods.map(x => x.m)).toFixed(1)} out of 5. Best day: ${weekday(best.d)}.`);
    }
    const outside = compareDays(week, d => state.fun.some(f => f.date === d && /outside|walk/i.test(f.text)) || state.workouts.some(w => w.date === d && w.type === 'Walk'), avgMood);
    if (outside && outside.yes > outside.no) out.push('Your mood is higher on days you get outside.');
    return out;
  },
  mo() {
    const out = [];
    const moods = state.moods.slice(-14);
    if (moods.length >= 4) {
      const half = Math.floor(moods.length / 2);
      const a = mean(moods.slice(0, half).map(m => m.mood)), b = mean(moods.slice(half).map(m => m.mood));
      out.push(b > a + 0.3 ? 'Your mood has been rising lately.' : b < a - 0.3 ? 'Your mood has dipped a little lately.' : 'Your mood has been steady lately.');
    }
    const proud = state.moods.filter(m => m.feelings.includes('Proud')).length;
    if (proud) out.push(`You felt proud ${proud} times recently.`);
    return out;
  },
  sage() {
    const out = [];
    const week = lastNDays(7);
    const calm = sum(week.map(d => state.calm[d] || 0));
    if (calm) out.push(`Breathing or grounding: ${calm} times this week.`);
    const grat = week.filter(d => (state.gratitude[d] || []).some(Boolean)).length;
    if (grat) out.push(`Gratitude on ${grat} days.`);
    const effect = compareDays(lastNDays(14), d => (state.calm[d] || 0) > 0, avgMood);
    if (effect && effect.yes > effect.no) out.push('Days with a calm practice have better moods.');
    return out;
  },
  mochi() {
    const fun = state.fun.filter(f => lastNDays(7).includes(f.date));
    return fun.length ? [`Fun logged ${fun.length} times this week.`] : [];
  },
};

export function patternsFor(botId) {
  try { return (finders[botId] || (() => []))(); } catch (e) { return []; }
}
