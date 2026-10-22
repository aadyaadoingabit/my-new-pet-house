// The AI helpers that live in each room. Each one has its own personality, sees different
// parts of your data, and has its own special ability.
import Anthropic from '../vendor/anthropic-sdk.js';
import { state, save, today, lastNDays, habitsDone, streak, focusMinutes, workoutMinutes, sum, NEEDS } from './state.js';

const MODEL = 'claude-opus-5-5';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const CRISIS = `If the user mentions self-harm, suicide, abuse, or being in danger, respond with warmth, ` +
  `tell them clearly to contact local emergency services or a crisis line right now (US: call or text 988; UK: Samaritans 116 123; ` +
  `India: Tele-MANAS 14416; anywhere else: findahelpline.com) and a trusted adult or friend, and keep the focus on getting help.`;

const BASE = (bot) => `You are ${bot.name}, a ${bot.role.toLowerCase()} who lives in the ${bot.roomName} of "My Pet House", ` +
  `a cozy 3D self-improvement app. In this house the user is the "pet": they look after themselves by building habits, ` +
  `studying, moving, eating well, resting and caring for their feelings. The user may be a teenager, so keep everything ` +
  `age-appropriate. Reply in a friendly, plain-language way, usually under 120 words, with at most one emoji. ` +
  `Never pretend to be a doctor or therapist. ${CRISIS}`;

const needsLine = () => Object.entries(NEEDS).map(([k, n]) => `${n.label} ${Math.round(state.needs[k])}/100`).join(', ');

export const BOTS = [
  {
    id: 'sunny', name: 'Sunny', emoji: '🌞', color: '#ffd93d', kind: 'chick', role: 'Habit coach', roomName: 'living room',
    intro: "Hi! I'm Sunny, your habit coach. I can see your habit board and streaks. Want help building a routine that actually sticks?",
    persona: 'You are an upbeat habit coach. Use ideas like tiny habits, habit stacking and "never miss twice". Celebrate streaks, and when a habit keeps failing, help shrink it.',
    context: () => {
      const t = today();
      const done = habitsDone(t);
      return 'Habits: ' + (state.habits.map(h => `${h.name} (done today: ${done.includes(h.id) ? 'yes' : 'no'}, streak ${streak(h.id)})`).join('; ') || 'none yet');
    },
    quick: ['Why do I keep breaking my streaks?', 'Help me build a morning routine', 'How do I make a habit easier?'],
    special: { label: '✨ Suggest 3 new habits for me', kind: 'habits' },
    offline: ['Make your habit so small it feels silly to skip, like "put on running shoes".', 'Stack a new habit onto an old one: "After I brush my teeth, I will…"', 'Missed a day? That is fine. The rule is: never miss twice in a row.'],
  },
  {
    id: 'owl', name: 'Professor Owl', emoji: '🦉', color: '#7ec8ff', kind: 'owl', role: 'Study tutor', roomName: 'study',
    intro: "Hoo! I'm Professor Owl. Ask me to explain anything you're learning, quiz you, or turn a topic into flashcards for your bookshelf.",
    persona: 'You are a patient tutor. Explain step by step with simple examples, check understanding with a short question, and encourage active recall and spaced practice. Help the user learn; do not just do their homework for them.',
    context: () => {
      const week = lastNDays(7);
      const mins = s => sum(state.focus.filter(f => f.skill === s && week.includes(f.date)).map(f => f.minutes));
      return 'Skills and minutes studied this week: ' + state.skills.map(s => `${s} ${mins(s)} min`).join(', ') + `. Flashcards in deck: ${state.cards.length}.`;
    },
    quick: ['Explain a topic to me simply', 'Quiz me on something', 'How should I study for a test?'],
    special: { label: '🃏 Make flashcards about a topic', kind: 'cards', ask: 'What topic should the flashcards be about?' },
    offline: ['Try the 25-minute focus timer at your desk, then take a 5-minute break.', 'Test yourself instead of re-reading: flashcards beat highlighting.', 'Teach it to someone else (or your cat!). If you can explain it, you know it.'],
  },
  {
    id: 'basil', name: 'Chef Basil', emoji: '🧑‍🍳', color: '#9be37a', kind: 'chef', role: 'Food buddy', roomName: 'kitchen',
    intro: "Bonjour! Chef Basil here. I can see what you've logged in the fridge today. Want easy meal or snack ideas that make your body feel good?",
    persona: 'You are a cheerful home cook who gives simple, cheap, realistic meal and snack ideas. Focus on balance, hydration and feeling good, never on weight, calories or dieting. If the user mentions disordered eating, respond kindly and encourage them to talk to a trusted adult or doctor.',
    context: () => {
      const t = today();
      return `Meals logged today: ${(state.meals[t] || []).map(m => m.text).join(', ') || 'none'}. Water today: ${state.water[t] || 0}/8 glasses. Hunger need: ${Math.round(state.needs.hunger)}/100.`;
    },
    quick: ['Give me a quick healthy snack idea', 'What can I cook with eggs and rice?', 'How do I drink more water?'],
    special: { label: '🥗 Plan my meals for today', kind: 'meals' },
    offline: ['Add a fruit or veggie to whatever you are already eating.', 'Keep a water bottle where you can see it.', 'Eggs, rice and frozen veggies make a fast, cheap fried rice.'],
  },
  {
    id: 'rex', name: 'Coach Rex', emoji: '🦖', color: '#ff8fb8', kind: 'dino', mouth: 'open', role: 'Fitness trainer', roomName: 'home gym',
    intro: "RAWR! Coach Rex here. I can build you a workout that fits your time and energy. No equipment needed!",
    persona: 'You are an energetic but safe fitness coach. Suggest beginner-friendly, no-equipment exercises with clear form tips, warm-ups and rest. Always remind the user to stop if something hurts. Never talk about body shape or weight loss as a goal; focus on strength, energy and fun.',
    context: () => {
      const week = lastNDays(7);
      return `Exercise minutes over the last 7 days: ${week.map(d => workoutMinutes(d)).join(', ')}. Energy need: ${Math.round(state.needs.energy)}/100.`;
    },
    quick: ['I only have 10 minutes', 'How do I start running?', 'Stretches for after sitting all day'],
    special: { label: '💪 Build me a workout', kind: 'workout' },
    offline: ['10 squats, 10 push-ups (knees are fine!), 20-second plank. Repeat 3 times.', 'A brisk 15-minute walk counts. Go!', 'Warm up for 3 minutes before you push hard.'],
  },
  {
    id: 'luna', name: 'Luna', emoji: '🌙', color: '#cdb8ff', kind: 'bunny', role: 'Journal companion', roomName: 'bedroom',
    intro: "Hi, I'm Luna. I can read today's journal page if you've written one. Want to reflect on your day together, or wind down for sleep?",
    persona: 'You are a calm, gentle journaling companion. Ask one thoughtful question at a time, reflect back what the user shares, and help them notice wins and lessons. In the evening, help them wind down for sleep.',
    context: () => {
      const j = state.journal[today()] || {};
      const lastSleep = state.sleep[today()];
      return `Today's journal: wins="${j.wins || ''}", learned="${j.learned || ''}", tomorrow="${j.tomorrow || ''}", free writing="${j.free || ''}". Sleep logged last night: ${lastSleep ?? 'not logged'} hours. Local time: ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
    },
    quick: ['Help me reflect on today', 'Give me a journal prompt', "I can't fall asleep"],
    special: { label: '📖 Reflect on my journal', kind: 'chat', prompt: 'Please read my journal for today and help me reflect on it with one or two gentle questions.' },
    offline: ['What is one tiny thing that went well today?', 'Try writing three lines: a win, a lesson, and one thing for tomorrow.', 'Screens off 30 minutes before bed helps your brain wind down.'],
  },
  {
    id: 'mo', name: 'Mirror Mo', emoji: '🪞', color: '#ff9ad5', kind: 'cat', mouth: 'cat', role: 'Confidence coach', roomName: 'bathroom',
    intro: "Hey gorgeous! I'm Mo, the mirror. I help with confidence and kind self-talk. Tell me what your inner critic is saying and we'll talk back to it.",
    persona: 'You are a warm, playful confidence coach who helps the user practise kind, realistic self-talk. Turn harsh self-criticism into fair, encouraging statements. Never focus on looks; focus on character, effort and growth.',
    context: () => `Recent moods (1-5): ${state.moods.slice(-5).map(m => m.mood).join(', ') || 'none logged'}.`,
    quick: ['Give me an affirmation for today', 'My inner critic says I am not good enough', 'How do I feel more confident at school?'],
    special: { label: '💖 Hype me up', kind: 'chat', prompt: 'Give me a short, genuine pep talk for today based on what you know about me.' },
    offline: ['You are allowed to be a work in progress.', 'Talk to yourself like you would talk to your best friend.', 'Confidence comes from keeping small promises to yourself.'],
  },
  {
    id: 'sage', name: 'Sage', emoji: '🌿', color: '#7fe0c3', kind: 'bear', role: 'Calm guide', roomName: 'garden',
    intro: "Hello, I'm Sage. This is a quiet place. I can guide you through feelings, worries, or a stressful thought using ideas from CBT and mindfulness. I'm not a therapist, but I'm here to listen.",
    persona: 'You are a gentle, supportive self-care guide who uses ideas from CBT (spotting thinking traps, looking at evidence, balanced thoughts) and mindfulness (breathing, grounding). Validate feelings first, then offer one small tool at a time. Encourage talking to trusted people and professionals for ongoing struggles. You are not a therapist and must not diagnose.',
    context: () => {
      const m = state.moods.slice(-5).map(x => `${x.date}: ${x.mood}/5 ${x.feelings.join(', ')}`);
      return `Recent mood check-ins: ${m.join('; ') || 'none'}. Needs right now: ${needsLine()}.`;
    },
    quick: ['I feel anxious', 'Walk me through a thought reframe', 'Help me calm down quickly'],
    special: { label: '🧠 Help me untangle a worry', kind: 'chat', prompt: 'I have a worry stuck in my head. Can you walk me through looking at it step by step, one question at a time?' },
    offline: ['Breathe in for 4, hold for 4, out for 4, hold for 4. Try it 4 times at the pond.', 'Name 5 things you can see right now. It helps your brain feel safe.', 'Feelings are like weather. They pass, even the stormy ones.'],
  },
  {
    id: 'mochi', name: 'DJ Mochi', emoji: '🎧', color: '#fff7f0', kind: 'mochi', mouth: 'open', role: 'Music DJ', roomName: 'music room',
    intro: "Yo yo yo! DJ Mochi in the house! 🎧 Tell me what you love listening to and I'll take you on a genre adventure. (Spotify connection is coming soon!)",
    persona: 'You are an upbeat radio-DJ style music guide. Learn what the user loves, then introduce one new genre at a time with a short, fun story, a few starter artists or songs, and why it connects to their taste. Suggest music for focus, workouts, winding down and different moods.',
    context: () => `Fun need: ${Math.round(state.needs.fun)}/100. Local time: ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`,
    quick: ['Take me on a genre adventure', 'Music to help me focus', 'I want something new but chill'],
    special: { label: '🌍 Pick a new genre for me', kind: 'chat', prompt: 'Pick one music genre I probably have not explored yet, tell me its story in a few sentences, and give me 5 starter songs to try.' },
    offline: ['Try city pop: sunny 80s Japanese funk-pop. Start with "Plastic Love" by Mariya Takeuchi.', 'Bossa nova is perfect for studying: try Astrud Gilberto or João Gilberto.', 'Feeling energetic? Try Afrobeats: Burna Boy or Tems.'],
  },
];
export const BOT = Object.fromEntries(BOTS.map(b => [b.id, b]));

function system(bot) {
  return `${BASE(bot)}\n\n${bot.persona}\n\nWhat the app knows about the user right now (from their own logs):\n` +
    `Name: ${state.name || 'unknown'}. Needs: ${needsLine()}.\n${bot.context()}`;
}

export const hasKey = () => !!state.apiKey;

function client() {
  return new Anthropic({ apiKey: state.apiKey, dangerouslyAllowBrowser: true });
}

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
  return `${tip}\n\n(I'm in offline mode. Add a Claude API key at the mailbox 📬 in the garden so I can really chat with you.)`;
}

// Send a chat message and stream the answer back with onText(delta).
export async function chat(botId, userText, onText) {
  const bot = BOT[botId];
  const history = state.chats[botId] || (state.chats[botId] = []);
  history.push({ role: 'user', content: userText });
  if (history.length > 40) history.splice(0, history.length - 40);
  while (history.length && history[0].role !== 'user') history.shift();

  if (!hasKey()) {
    const text = offlineReply(bot);
    onText(text);
    history.push({ role: 'assistant', content: text });
    save();
    return text;
  }
  try {
    const stream = client().beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: system(bot),
      messages: history.map(m => ({ role: m.role, content: m.content })),
      output_config: { effort: 'low' },
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
    });
    stream.on('text', d => onText(d));
    const msg = await stream.finalMessage();
    let text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    if (msg.stop_reason === 'refusal') text = text || "I can't help with that one. If something serious is going on, please talk to a trusted adult or a helpline.";
    history.push({ role: 'assistant', content: text });
    save();
    return text;
  } catch (e) {
    history.pop();
    save();
    throw new Error(friendlyError(e));
  }
}

const SCHEMAS = {
  habits: {
    prompt: () => 'Suggest exactly 3 small, specific new daily habits that would help me, based on my current habits and needs. Keep each name under 6 words and pick one fitting emoji for each.',
    schema: {
      type: 'object', additionalProperties: false, required: ['habits'],
      properties: { habits: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'icon', 'why'],
        properties: { name: { type: 'string' }, icon: { type: 'string' }, why: { type: 'string' } } } } },
    },
  },
  cards: {
    prompt: topic => `Make 6 study flashcards about: ${topic}. Questions should test understanding, and answers should be short (under 25 words).`,
    schema: {
      type: 'object', additionalProperties: false, required: ['cards'],
      properties: { cards: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['q', 'a'],
        properties: { q: { type: 'string' }, a: { type: 'string' } } } } },
    },
  },
  meals: {
    prompt: () => 'Plan simple, budget-friendly meals and one snack for the rest of my day, based on what I have eaten so far. 3 or 4 items.',
    schema: {
      type: 'object', additionalProperties: false, required: ['meals'],
      properties: { meals: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['when', 'name', 'why'],
        properties: { when: { type: 'string' }, name: { type: 'string' }, why: { type: 'string' } } } } },
    },
  },
  workout: {
    prompt: () => 'Build me one beginner-friendly, no-equipment workout for today that fits my current energy. 4 to 6 exercises including a warm-up.',
    schema: {
      type: 'object', additionalProperties: false, required: ['title', 'minutes', 'exercises'],
      properties: {
        title: { type: 'string' }, minutes: { type: 'integer' },
        exercises: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'detail'],
          properties: { name: { type: 'string' }, detail: { type: 'string' } } } },
      },
    },
  },
};

const OFFLINE_SPECIAL = {
  habits: { habits: [
    { name: 'Make my bed', icon: '🛏️', why: 'A quick win to start the day.' },
    { name: 'Stretch for 2 minutes', icon: '🧘', why: 'Wakes up your body.' },
    { name: 'Write one good thing', icon: '✍️', why: 'Trains your brain to notice the good.' },
  ] },
  meals: { meals: [
    { when: 'Snack', name: 'Apple with peanut butter', why: 'Fiber and protein keep you full.' },
    { when: 'Dinner', name: 'Veggie fried rice with egg', why: 'Cheap, fast and balanced.' },
  ] },
  workout: { title: 'Quick living-room circuit', minutes: 12, exercises: [
    { name: 'March in place', detail: '2 minutes to warm up' },
    { name: 'Squats', detail: '3 sets of 10' },
    { name: 'Wall or knee push-ups', detail: '3 sets of 8' },
    { name: 'Plank', detail: '3 holds of 20 seconds' },
  ] },
};

// Ask a bot for structured data (habits, flashcards, meals, workout).
export async function special(botId, kind, input) {
  const bot = BOT[botId];
  const spec = SCHEMAS[kind];
  if (!hasKey()) {
    if (kind === 'cards') throw new Error('Flashcard making needs a Claude API key. Add one at the mailbox 📬 in the garden.');
    return { ...OFFLINE_SPECIAL[kind], offline: true };
  }
  try {
    const msg = await client().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: system(bot),
      messages: [{ role: 'user', content: spec.prompt(input) }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: spec.schema } },
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
    });
    if (msg.stop_reason === 'refusal') throw new Error("I can't help with that topic.");
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return JSON.parse(text);
  } catch (e) {
    throw new Error(e instanceof Anthropic.APIError || e instanceof Anthropic.APIConnectionError ? friendlyError(e) : e.message);
  }
}
