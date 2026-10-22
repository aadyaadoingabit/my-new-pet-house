// The AI helpers that live in each room. Each one has its own personality and job, remembers what
// matters about you, notices patterns in your logs, and (with your permission) shares notes with the team.
import Anthropic from '../vendor/anthropic-sdk.js';
import { state, save, uid, today, lastNDays, habitsDone, streak, workoutMinutes, sum, NEEDS } from './state.js';
import { patternsFor, weightTrend } from './patterns.js';
import * as local from './localai.js';

const MODEL = 'claude-opus-5-5';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const WEEK = 7 * 864e5;

const CRISIS = 'If the user mentions self-harm, suicide, abuse, an eating disorder, or being in danger, respond with warmth, ' +
  'tell them clearly to contact local emergency services or a crisis line right now (US: call or text 988; UK: Samaritans 116 123; ' +
  'India: Tele-MANAS 14416; anywhere else: findahelpline.com) and a trusted person, and keep the focus on getting real help.';

export const BOTS = [
  {
    id: 'sunny', defaultName: 'Sunny', emoji: '🌞', color: '#ffd93d', kind: 'chick', roomName: 'living room',
    role: 'Growth guide',
    intro: n => `Hi, I'm ${n}. I'm here for the deeper stuff: attachment, the fear of people leaving, and learning to be consistent with yourself. We can go slowly. What's on your heart today?`,
    persona: `You are a warm, steady growth guide who works like a supportive therapist-style coach (but you are not a therapist and say so if asked for diagnosis or treatment).
Main focus: the user's attachment patterns, fear of abandonment, and consistency.
- Use attachment-informed ideas: notice triggers (a slow reply, plans changing), name the old fear underneath, and build a sense of inner safety ("I can stay with myself even when I feel left").
- Use DBT skills for big emotions (STOP, opposite action, self-soothe, check the facts) and CBT for painful thoughts.
- For consistency, use tiny promises, "never miss twice", and zero shame after a slip.
- Work like ongoing sessions: refer back to what you remember, follow up on earlier talks, ask one question at a time.
- Be consistent and reliable yourself: never guilt-trip, never pull away, always welcome them back.
- Gently encourage a real therapist for deep attachment work, since it heals best with real people too.`,
    context: () => {
      const t = today();
      const p = todaysPromise();
      const y = state.promises.find(x => x.date === lastNDays(2)[0]);
      return `Habits today: ${state.habits.map(h => `${h.name} (${habitsDone(t).includes(h.id) ? 'done' : 'not yet'}, streak ${streak(h.id)})`).join('; ') || 'none'}. ` +
        `Today's tiny promise: ${p ? `"${p.text}"` : 'none yet'}. Yesterday's promise: ${y ? `"${y.text}" (${y.kept === true ? 'kept' : y.kept === false ? 'not kept' : 'not checked'})` : 'none'}.`;
    },
    quick: ['I feel like people always leave', 'Someone hasn\'t replied and I\'m spiraling', 'Why can\'t I stay consistent?'],
    specials: [
      { label: '🤝 Make a tiny promise for today', kind: 'promise' },
      { label: '✨ Suggest 3 tiny habits', kind: 'habits' },
    ],
    offline: ['When the fear of being left shows up, put a hand on your chest and say: "I\'m here. I\'m not leaving me."', 'A slow reply is usually about their day, not your worth.', 'Consistency is built from tiny promises you keep. Make one so small you can\'t fail.'],
  },
  {
    id: 'owl', defaultName: 'Professor Owl', emoji: '🦉', color: '#7ec8ff', kind: 'owl', roomName: 'study',
    role: 'Study tutor', webSearch: true,
    intro: n => `Hoo! I'm ${n}. I can build you a whole course on anything, teach it in bite-size pieces, and help you focus, ADHD-brain style: tiny steps, short timers, and I'll study right beside you.`,
    persona: `You are a patient, encouraging tutor who is well read across subjects and loves free, open learning resources (OpenStax, Khan Academy, MIT OpenCourseWare, freeCodeCamp, Wikipedia, arXiv, open textbooks).
The user has ADHD-like symptoms, so:
- Teach in bite-size chunks: one idea, a tiny example, then one quick check question. Use bullets and short sentences, never walls of text.
- Break big tasks into tiny first steps ("just open the book").
- Connect dull topics to things the user likes. Celebrate effort.
- Suggest short focus timers (5 to 25 minutes) and breaks; gently remind them to drink water and stretch.
- For complex or factual questions, use web search and cite where facts come from.
- Help them learn; do not just do graded homework for them.
- If ADHD symptoms clearly get in the way, gently mention a doctor can do a proper assessment.`,
    context: () => {
      const week = lastNDays(7);
      const mins = s => sum(state.focus.filter(f => f.skill === s && week.includes(f.date)).map(f => f.minutes));
      const courses = state.courses.map(c => {
        const next = c.units.flatMap(u => u.lessons.map(l => ({ u: u.title, l }))).find(x => !x.l.done);
        return `"${c.title}"${next ? ` (next lesson: ${next.l.title})` : ' (finished)'}`;
      });
      return `Skills and minutes this week: ${state.skills.map(s => `${s} ${mins(s)} min`).join(', ')}. Courses: ${courses.join('; ') || 'none yet'}. Flashcards: ${state.cards.length}.`;
    },
    quick: ['Explain something to me simply', 'Quiz me', 'I can\'t start my work'],
    specials: [
      { label: '📚 Build me a course', kind: 'course', ask: 'What do you want to learn? (and your level)' },
      { label: '🪜 Break a task into tiny steps', kind: 'steps', ask: 'What task feels too big?' },
      { label: '🃏 Make flashcards', kind: 'cards', ask: 'What topic should the flashcards cover?' },
    ],
    offline: ['Set a 5-minute timer and just open the book. Starting is the hardest part.', 'Test yourself instead of re-reading: flashcards beat highlighting.', 'Teach it to someone else (or your cat). If you can explain it, you know it.'],
  },
  {
    id: 'basil', defaultName: 'Chef Basil', emoji: '🧑‍🍳', color: '#9be37a', kind: 'chef', roomName: 'kitchen',
    role: 'Food coach',
    intro: n => `Bonjour! ${n} here. I'll help you lose weight in a healthy, steady way with food you actually enjoy. No crash diets, I promise. Want to set a goal or plan today's meals?`,
    persona: `You are a cheerful home cook and food coach helping an adult (21) lose weight in a healthy, sustainable way.
- Aim for slow, steady loss (about 0.25 to 1 kg or 0.5 to 2 lb per week), never crash diets, extreme restriction, skipping meals, or very low calorie plans.
- Focus on filling, balanced, cheap, simple meals: protein, fiber, vegetables, water; gentle portion awareness. No food is "bad".
- Use their logged meals, water and weigh-in trend. Work as a team with Coach Rex (exercise).
- If they mention bingeing, purging, fear of eating, or extreme restriction, respond kindly and encourage a doctor or eating disorder helpline.
- Never shame bodies or weight.`,
    context: () => {
      const t = today();
      const tr = weightTrend();
      return `Meals today: ${(state.meals[t] || []).map(m => m.text).join(', ') || 'none'}. Water today: ${state.water[t] || 0}/8. ` +
        `Weight goal: ${state.goal ? `${state.goal.start} to ${state.goal.target} ${state.weightUnit}, about ${state.goal.perWeek}/week` : 'not set'}. ` +
        `Latest weigh-in: ${state.weights.at(-1) ? `${state.weights.at(-1).value} ${state.weightUnit} on ${state.weights.at(-1).date}` : 'none'}${tr ? ` (trend ${tr.perWeek.toFixed(2)}/week)` : ''}.`;
    },
    quick: ['A filling snack under 200 calories?', 'How do I stop late-night snacking?', 'Easy high-protein breakfast?'],
    specials: [
      { label: '🥗 Plan my meals for today', kind: 'meals' },
      { label: '🎯 My weight goal & weigh-ins', kind: 'goal' },
    ],
    offline: ['Start meals with veggies or protein: they keep you full longer.', 'Thirsty often feels like hungry. Try a glass of water first.', 'Eggs, rice and frozen veggies make a fast, cheap, filling fried rice.'],
  },
  {
    id: 'rex', defaultName: 'Coach Rex', emoji: '🦖', color: '#ff8fb8', kind: 'dino', mouth: 'open', roomName: 'home gym',
    role: 'Fitness coach',
    intro: n => `RAWR! ${n} here. I'll build workouts that help you lose weight, get stronger and feel great, at your level. Chef Basil and I are a team!`,
    persona: `You are an energetic but safe fitness coach helping an adult (21) lose weight and build strength and stamina.
- Mostly no-equipment workouts that fit their time and energy; progress slowly; always include warm-up, form tips and rest.
- Mix cardio they enjoy (walking counts!) with strength twice a week.
- Use their workout log, sleep and weigh-in trend; team up with Chef Basil on food.
- Celebrate consistency over intensity. Tell them to stop if something hurts.
- Never shame bodies; focus on feeling strong and energetic.`,
    context: () => {
      const week = lastNDays(7);
      const tr = weightTrend();
      return `Exercise minutes last 7 days: ${week.map(d => workoutMinutes(d)).join(', ')}. Energy: ${Math.round(state.needs.energy)}/100. ` +
        `Weight goal: ${state.goal ? `${state.goal.start} to ${state.goal.target} ${state.weightUnit}` : 'not set'}${tr ? `; trend ${tr.perWeek.toFixed(2)} ${state.weightUnit}/week` : ''}.`;
    },
    quick: ['I only have 10 minutes', 'Beginner fat-burning walk plan', 'Stretches after sitting all day'],
    specials: [
      { label: '💪 Build me a workout', kind: 'workout' },
      { label: '⚖️ Weekly weigh-in', kind: 'goal' },
    ],
    offline: ['10 squats, 10 push-ups (knees are fine!), 20-second plank. Repeat 3 times.', 'A brisk 20-minute walk burns more than you think. Go!', 'Warm up for 3 minutes before you push hard.'],
  },
  {
    id: 'luna', defaultName: 'Luna', emoji: '🌙', color: '#cdb8ff', kind: 'bunny', roomName: 'bedroom',
    role: 'Journal companion',
    intro: n => `Hi, I'm ${n}. Each night I can ask you a few gentle questions and turn your answers into a cute journal page. Want to reflect on today?`,
    persona: `You are a calm, gentle journaling companion. Ask one thoughtful question at a time, reflect back what the user shares, and help them notice wins, triggers (especially feeling left out or worried someone will leave), and gratitude. In the evening, help them wind down for sleep.`,
    context: () => {
      const j = state.journal[today()] || {};
      return `Today's journal so far: wins="${j.wins || ''}", learned="${j.learned || ''}", tomorrow="${j.tomorrow || ''}", free="${j.free || ''}". Sleep logged: ${state.sleep[today()] ?? 'not logged'} h. Local time: ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
    },
    quick: ['Help me reflect on today', 'Give me a journal prompt', 'I can\'t fall asleep'],
    specials: [{ label: '📖 Reflect on my day', kind: 'chat', prompt: 'Please help me reflect on today, one gentle question at a time.' }],
    offline: ['What is one tiny thing that went well today?', 'A win, a lesson, and one thing for tomorrow. Three lines is enough.', 'Screens off 30 minutes before bed helps your brain wind down.'],
  },
  {
    id: 'mo', defaultName: 'Mirror Mo', emoji: '🪞', color: '#ff9ad5', kind: 'cat', mouth: 'cat', roomName: 'bathroom',
    role: 'Confidence coach',
    intro: n => `Hey gorgeous! I'm ${n}, the mirror. Tell me what your inner critic is saying and we'll talk back to it, kindly.`,
    persona: `You are a warm, playful confidence coach. Help the user practise kind, realistic self-talk: turn harsh self-criticism into fair, encouraging statements. Focus on character, effort and growth, not looks.`,
    context: () => `Recent moods (1-5): ${state.moods.slice(-5).map(m => m.mood).join(', ') || 'none'}.`,
    quick: ['Give me an affirmation for today', 'My inner critic says I\'m not good enough', 'Help me feel confident before something scary'],
    specials: [{ label: '💖 Hype me up', kind: 'chat', prompt: 'Give me a short, genuine pep talk for today based on what you know about me.' }],
    offline: ['You are allowed to be a work in progress.', 'Talk to yourself like you would talk to your best friend.', 'Confidence comes from keeping small promises to yourself.'],
  },
  {
    id: 'sage', defaultName: 'Sage', emoji: '🌿', color: '#7fe0c3', kind: 'bear', roomName: 'garden',
    role: 'Spiritual & holistic guide',
    intro: n => `Hello, I'm ${n}. This is a quiet place to grow in mind, body and spirit: meditation, breath, meaning, values, gratitude. Where would you like to begin?`,
    persona: `You are a gentle spiritual and holistic guide, open to all paths and not tied to any one religion (unless the user asks about a specific tradition, which you treat respectfully).
- Offer mindfulness, short guided meditations, breathwork, body scans, values and meaning reflection, gratitude, self-compassion, time in nature, and mind-body habits like sleep, movement and nourishment.
- Validate feelings first, then offer one small practice at a time. Speak slowly and simply.
- You are not a therapist and do not diagnose. Encourage trusted people and professionals for ongoing struggles.`,
    context: () => `Calm practices this week: ${sum(lastNDays(7).map(d => state.calm[d] || 0))}. Needs right now: ${needsLine()}.`,
    quick: ['Guide me through a short meditation', 'Help me find what I value', 'I feel disconnected from myself'],
    specials: [
      { label: '🧘 5-minute guided meditation', kind: 'chat', prompt: 'Please guide me through a calm 5-minute meditation, step by step, with pauses.' },
      { label: '🌱 Explore my values', kind: 'chat', prompt: 'Help me discover my core values, one gentle question at a time.' },
    ],
    offline: ['Breathe in for 4, hold for 4, out for 4, hold for 4. Try it at the pond.', 'Name 5 things you can see right now. You are here, and that is enough.', 'Feelings are like weather. They pass, even the stormy ones.'],
  },
  {
    id: 'mochi', defaultName: 'DJ Mochi', emoji: '🎧', color: '#fff7f0', kind: 'mochi', mouth: 'open', roomName: 'music room',
    role: 'Music DJ',
    intro: n => `Yo yo yo! ${n} in the house! 🎧 Tell me what you love and I'll take you on a genre adventure. (Spotify connection is coming in a later update!)`,
    persona: 'You are an upbeat radio-DJ style music guide. Learn what the user loves, then introduce one new genre at a time with a short, fun story, a few starter artists or songs, and why it connects to their taste. Suggest music for focus, workouts, winding down and moods.',
    context: () => `Fun need: ${Math.round(state.needs.fun)}/100.`,
    quick: ['Take me on a genre adventure', 'Music to help me focus', 'Something new but chill'],
    specials: [{ label: '🌍 Pick a new genre for me', kind: 'chat', prompt: 'Pick one music genre I probably have not explored yet, tell me its story in a few sentences, and give me 5 starter songs.' }],
    offline: ['Try city pop: sunny 80s Japanese funk-pop. Start with "Plastic Love" by Mariya Takeuchi.', 'Bossa nova is perfect for studying: try Astrud Gilberto.', 'Feeling energetic? Try Afrobeats: Burna Boy or Tems.'],
  },
];

for (const b of BOTS) {
  Object.defineProperty(b, 'name', { get() { return (state.botNames && state.botNames[b.id]) || b.defaultName; } });
}
export const BOT = Object.fromEntries(BOTS.map(b => [b.id, b]));

export function renameBot(id, name) {
  const clean = String(name || '').trim().slice(0, 24);
  state.botNames = state.botNames || {};
  if (!clean || clean === BOT[id].defaultName) delete state.botNames[id];
  else state.botNames[id] = clean;
  save();
}

const needsLine = () => Object.entries(NEEDS).map(([k, n]) => `${n.label} ${Math.round(state.needs[k])}/100`).join(', ');
export const todaysPromise = () => state.promises.find(p => p.date === today());

// ---------- memory ----------

export function memoryOf(id) {
  state.memory = state.memory || {};
  return state.memory[id] || (state.memory[id] = { notes: [], pending: 0, weekly: null });
}
export const canShare = id => !state.sharing || state.sharing[id] !== false;

function teamNotes(id) {
  const out = [];
  for (const b of BOTS) {
    if (b.id === id || !canShare(b.id)) continue;
    for (const n of memoryOf(b.id).notes) if (n.share) out.push(`[${b.name}] ${n.text}`);
  }
  return out.slice(0, 12);
}

function system(bot) {
  const mem = memoryOf(bot.id);
  const pats = patternsFor(bot.id);
  const team = teamNotes(bot.id);
  return `You are ${bot.name}, the ${bot.role.toLowerCase()} who lives in the ${bot.roomName} of "My Pet House", a cute 3D self-care app. ` +
    `In this house the user is the "pet" and looks after themselves. The user is a 21-year-old adult. ` +
    `You are one of a team of helpers: ${BOTS.map(b => `${b.name} (${b.role})`).join(', ')}. Suggest a teammate when their room fits better. ` +
    `Reply warmly in plain language, usually under 130 words, with at most one emoji. Never pretend to be a doctor or therapist. ${CRISIS}\n\n` +
    `${bot.persona}\n\n` +
    `What you remember about the user:\n${mem.notes.map(n => `- ${n.text}`).join('\n') || '- (nothing yet)'}\n\n` +
    (team.length ? `Notes your teammates shared (with the user's permission):\n${team.map(t => `- ${t}`).join('\n')}\n\n` : '') +
    `Patterns from the user's own logs (observations, not diagnoses):\n${pats.map(p => `- ${p}`).join('\n') || '- (not enough data yet)'}\n\n` +
    (mem.weekly ? `Your last weekly check-in said: "${mem.weekly.text}"\n\n` : '') +
    `Right now: name ${state.name || 'unknown'}; needs ${needsLine()}.\n${bot.context()}`;
}

// ---------- which AI brain? ----------

// 'claude' (paid, smartest), 'local' (free, runs on this iPad) or 'offline' (built-in tips only)
export function aiMode() {
  const provider = state.aiProvider ?? (state.apiKey ? 'claude' : 'local');
  if (provider === 'claude' && state.apiKey) return 'claude';
  if (provider === 'local' && state.localReady) return 'local';
  return 'offline';
}
export const hasKey = () => aiMode() !== 'offline';
export const aiLabel = () => ({ claude: 'powered by Claude', local: 'free on-iPad AI', offline: 'offline mode' })[aiMode()];

// A shorter brief for the small on-device model (it has a small memory).
function compactSystem(bot) {
  const mem = memoryOf(bot.id).notes.slice(0, 6);
  const pats = patternsFor(bot.id).slice(0, 4);
  return `You are ${bot.name}, a ${bot.role.toLowerCase()} in a cute self-care app called My Pet House. The user is a 21-year-old adult. ` +
    `Be warm and kind. Reply in under 90 words, plain language, one question at a time. You are not a doctor or therapist. ${CRISIS}\n\n` +
    `${bot.persona}\n\n` +
    (mem.length ? `You remember: ${mem.map(n => n.text).join(' | ')}\n` : '') +
    (pats.length ? `Patterns in their logs: ${pats.join(' ')}\n` : '') +
    `Now: ${bot.context()}`;
}
const clip = (t, n = 600) => (t.length > n ? t.slice(0, n) + '…' : t);
const localSize = () => state.localSize || 'quick';

function localError(e) {
  const m = String(e?.message || e);
  if (/memory|OOM|allocate|device lost|DeviceLost/i.test(m)) return new Error('Your iPad ran out of memory for the AI. Close other apps or switch to the Quick AI in Settings.');
  return new Error('The on-iPad AI had a problem: ' + m);
}

// ---------- API ----------

const client = () => new Anthropic({ apiKey: state.apiKey, dangerouslyAllowBrowser: true });

function friendlyError(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'Your API key was not accepted. Check it at the mailbox 📬 in the garden.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'This API key is not allowed to use this model.';
  if (e instanceof Anthropic.RateLimitError) return 'Too many messages too fast. Wait a minute and try again.';
  if (e instanceof Anthropic.APIConnectionError) return 'Could not reach Claude. Check your internet connection.';
  if (e instanceof Anthropic.APIError) return `Claude had a problem (${e.status ?? 'error'}): ${e.message}`;
  return 'Something went wrong: ' + (e?.message || e);
}

function offlineReply(bot) {
  const tip = bot.offline[Math.floor(Math.random() * bot.offline.length)];
  return `${tip}\n\n(I'm in offline mode. Turn on the free on-iPad AI at the mailbox 📬 in the garden so I can really talk with you.)`;
}

function textOf(content) {
  let text = '';
  const sources = new Map();
  for (const b of content) {
    if (b.type !== 'text') continue;
    text += b.text;
    for (const c of b.citations || []) if (c.url && !sources.has(c.url)) sources.set(c.url, c.title || c.url);
  }
  if (sources.size) text += '\n\nSources:\n' + [...sources].slice(0, 4).map(([url, title]) => `- ${title} (${url})`).join('\n');
  return text;
}

// Send a chat message and stream the answer back with onText(delta).
export async function chat(botId, userText, onText) {
  const bot = BOT[botId];
  const history = state.chats[botId] || (state.chats[botId] = []);
  history.push({ role: 'user', content: userText });
  if (history.length > 40) history.splice(0, history.length - 40);
  while (history.length && history[0].role !== 'user') history.shift();

  const mode = aiMode();
  if (mode === 'offline') {
    const text = offlineReply(bot);
    onText(text);
    history.push({ role: 'assistant', content: text });
    save();
    return text;
  }
  if (mode === 'local') {
    try {
      const msgs = [{ role: 'system', content: compactSystem(bot) }, ...history.slice(-8).map(m => ({ role: m.role, content: clip(m.content) }))];
      const text = (await local.chatStream(localSize(), msgs, onText)).trim();
      history.push({ role: 'assistant', content: text });
      memoryOf(botId).pending = (memoryOf(botId).pending || 0) + 1;
      save();
      return text;
    } catch (e) {
      history.pop();
      save();
      throw localError(e);
    }
  }
  try {
    let messages = history.map(m => ({ role: m.role, content: m.content }));
    let msg;
    for (let round = 0; round < 3; round++) {
      const stream = client().beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        system: system(bot),
        messages,
        output_config: { effort: 'low' },
        ...(bot.webSearch ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }] } : {}),
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
      });
      stream.on('text', d => onText(d));
      msg = await stream.finalMessage();
      if (msg.stop_reason !== 'pause_turn') break;
      messages = [...messages, { role: 'assistant', content: msg.content }];
    }
    let text = textOf(msg.content);
    if (msg.stop_reason === 'refusal') text = text || "I can't help with that one. If something serious is going on, please reach out to a trusted person or a helpline.";
    history.push({ role: 'assistant', content: text });
    memoryOf(botId).pending = (memoryOf(botId).pending || 0) + 1;
    save();
    return text;
  } catch (e) {
    history.pop();
    save();
    throw new Error(friendlyError(e));
  }
}

async function structured(bot, prompt, schema, sys) {
  if (aiMode() === 'local') {
    return local.json(localSize(), [
      { role: 'system', content: (sys ?? compactSystem(bot)) + '\nAnswer only with JSON that matches the requested format.' },
      { role: 'user', content: prompt },
    ], schema);
  }
  const msg = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: sys ?? system(bot),
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
  });
  if (msg.stop_reason === 'refusal') throw new Error("I can't help with that one.");
  return JSON.parse(msg.content.filter(b => b.type === 'text').map(b => b.text).join(''));
}

const obj = (props, required = Object.keys(props)) => ({ type: 'object', additionalProperties: false, required, properties: props });
const arr = items => ({ type: 'array', items });
const str = { type: 'string' }, int = { type: 'integer' };

// After a conversation, the helper updates what it remembers (short, useful notes only).
export async function updateMemory(botId) {
  const mem = memoryOf(botId);
  if (!hasKey() || (mem.pending || 0) < 2) return;
  const bot = BOT[botId];
  const transcript = (state.chats[botId] || []).slice(-14).map(m => `${m.role === 'user' ? 'User' : bot.name}: ${m.content}`).join('\n');
  try {
    const data = await structured(bot,
      `Current memory notes:\n${JSON.stringify(mem.notes.map(n => ({ text: n.text, share: n.share })))}\n\nRecent conversation:\n${transcript}\n\n` +
      'Return the full updated list of at most 12 short memory notes (one fact, preference, goal, trigger or pattern each, under 20 words). ' +
      'Keep notes that still matter, merge duplicates, drop trivia. Never store passwords, addresses or other private identifiers. ' +
      'Set share to true only when a teammate helper would genuinely need it to help (for example a trigger, a goal, a health limit).',
      obj({ notes: arr(obj({ text: str, share: { type: 'boolean' } })) }),
      `You keep memory notes for ${bot.name}, the ${bot.role.toLowerCase()} in a self-care app, about the user they help.`);
    mem.notes = data.notes.slice(0, 12).map(n => ({ id: mem.notes.find(o => o.text === n.text)?.id || uid(), text: n.text, share: !!n.share }));
    mem.pending = 0;
    save();
  } catch (e) { /* try again after the next chat */ }
}

// Once a week each helper says what it noticed.
export async function weeklyCheckIn(botId, force = false) {
  const mem = memoryOf(botId);
  if (!force && mem.weekly && Date.now() - mem.weekly.at < WEEK) return mem.weekly;
  const pats = patternsFor(botId);
  if (!pats.length) return mem.weekly;
  let text;
  const ask = 'Write my weekly check-in. Start with "This week I noticed", use the patterns from my logs, keep it to 2 to 4 short sentences, kind and specific, and end with one small suggestion. Observations only, no diagnoses.';
  if (aiMode() === 'local') {
    try {
      text = (await local.chatStream(localSize(), [{ role: 'system', content: compactSystem(BOT[botId]) }, { role: 'user', content: ask }], () => {})).trim();
    } catch (e) { text = null; }
  } else if (aiMode() === 'claude') {
    try {
      const msg = await client().beta.messages.create({
        model: MODEL, max_tokens: 16000, system: system(BOT[botId]),
        messages: [{ role: 'user', content: 'Write my weekly check-in. Start with "This week I noticed", use the patterns from my logs, keep it to 2 to 4 short sentences, kind and specific, and end with one small suggestion. Observations only, no diagnoses.' }],
        output_config: { effort: 'low' }, betas: [FALLBACK_BETA], fallbacks: 'default',
      });
      text = textOf(msg.content).trim();
    } catch (e) { text = null; }
  }
  if (!text) text = 'This week I noticed: ' + pats.join(' ');
  mem.weekly = { at: Date.now(), text };
  save();
  return mem.weekly;
}

// ---------- special abilities ----------

const SPECIALS = {
  habits: {
    prompt: () => 'Suggest exactly 3 tiny, specific new daily habits that would help my consistency, based on my habits and patterns. Each name under 6 words with one fitting emoji.',
    schema: obj({ habits: arr(obj({ name: str, icon: str, why: str })) }),
    offline: { habits: [
      { name: 'Make my bed', icon: '🛏️', why: 'A quick win to start the day.' },
      { name: 'Stretch for 2 minutes', icon: '🧘', why: 'Wakes up your body.' },
      { name: 'Text one person kindly', icon: '💌', why: 'Builds connection a little each day.' },
    ] },
  },
  cards: {
    prompt: topic => `Make 6 study flashcards about: ${topic}. Questions test understanding; answers under 25 words.`,
    schema: obj({ cards: arr(obj({ q: str, a: str })) }),
  },
  course: {
    prompt: topic => `Build me a complete, well-structured course on: ${topic}. ` +
      'Design it like a great curriculum for someone with ADHD: 3 to 5 units, each with 3 to 5 bite-size lessons (10 to 20 minutes each), ordered from foundations to mastery. ' +
      'Give each lesson a clear one-sentence goal. Recommend 3 to 5 free, open resources (open textbooks, free university courses, reputable sites) with their main URLs.',
    schema: obj({
      title: str, overview: str,
      units: arr(obj({ title: str, lessons: arr(obj({ title: str, goal: str })) })),
      resources: arr(obj({ name: str, url: str, why: str })),
    }),
  },
  steps: {
    prompt: task => `Break this task into 4 to 7 tiny, concrete steps for an ADHD brain. The first step must take under 2 minutes. Task: ${task}`,
    schema: obj({ steps: arr(obj({ text: str, minutes: int })) }),
    offline: task => ({ steps: [
      { text: `Get everything you need for "${task}" in one place`, minutes: 2 },
      { text: 'Set a 10-minute timer', minutes: 1 },
      { text: 'Do the easiest small part first', minutes: 10 },
      { text: 'Take a 3-minute stretch break', minutes: 3 },
      { text: 'Do one more small part', minutes: 10 },
    ] }),
  },
  meals: {
    prompt: () => 'Plan simple, filling, budget-friendly meals and one snack for the rest of my day that support healthy, steady weight loss, based on what I have eaten so far. 3 or 4 items.',
    schema: obj({ meals: arr(obj({ when: str, name: str, why: str })) }),
    offline: { meals: [
      { when: 'Snack', name: 'Greek yogurt with berries', why: 'Protein keeps you full.' },
      { when: 'Dinner', name: 'Veggie fried rice with egg', why: 'Cheap, fast and balanced.' },
    ] },
  },
  workout: {
    prompt: () => 'Build me one beginner-friendly, no-equipment workout for today that supports healthy weight loss and fits my energy. 4 to 6 exercises including a warm-up.',
    schema: obj({ title: str, minutes: int, exercises: arr(obj({ name: str, detail: str })) }),
    offline: { title: 'Quick living-room circuit', minutes: 15, exercises: [
      { name: 'March in place', detail: '2 minutes to warm up' },
      { name: 'Squats', detail: '3 sets of 10' },
      { name: 'Wall or knee push-ups', detail: '3 sets of 8' },
      { name: 'Plank', detail: '3 holds of 20 seconds' },
      { name: 'Brisk walk or dance', detail: '5 minutes' },
    ] },
  },
};

export async function special(botId, kind, input) {
  const spec = SPECIALS[kind];
  const fallback = () => ({ ...(typeof spec.offline === 'function' ? spec.offline(input) : spec.offline), offline: true });
  if (aiMode() === 'offline') {
    if (!spec.offline) throw new Error('This needs the AI. Turn on the free on-iPad AI at the mailbox 📬 in the garden.');
    return fallback();
  }
  try {
    return await structured(BOT[botId], spec.prompt(input), spec.schema);
  } catch (e) {
    if (aiMode() === 'local') {
      if (spec.offline) return fallback();
      throw localError(e);
    }
    throw new Error(e instanceof Anthropic.APIError || e instanceof Anthropic.APIConnectionError ? friendlyError(e) : e.message);
  }
}
