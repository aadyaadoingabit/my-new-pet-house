# 🏠 My Pet House

A 3D life simulation where **you are the pet**. Walk around your own house, look after your needs, and fill them back up by doing real things in real life. Every room has its own AI helper.

## What's inside

- **A real 3D house** with a bedroom, bathroom, study, kitchen, living room, home gym and garden. Tap to walk, tap furniture to use it, drag to turn the camera.
- **Sims-style needs** (Hunger, Energy, Hygiene, Fun, Social, Calm) that slowly drop over real time. A mood gem floats over your head, and a thought bubble shows what you need most.
- **Day and night** that follows your real clock. Lamps turn on at night and stars come out.
- **Design yourself** in the wardrobe: skin, hair style and color, clothes, shoes.
- **Coins and a shop.** Earn coins for real self-care (with daily limits, so no cheating!) and buy furniture, an aquarium, a fountain, even a cat.
- **Everything from before**: habit board with streaks, focus timer, skills, flashcards, meals, water, sleep, workouts, journal, mood check-ins, box breathing, grounding, thought reframing, gratitude and progress charts.

## The AI helpers

| Helper | Room | What they do differently |
|---|---|---|
| 🌞 Sunny | Living room | Habit coach. Sees your habits and streaks and can suggest new habits you add with one tap |
| 🦉 Professor Owl | Study | Tutor. Explains topics, quizzes you and **makes flashcards** that land on your bookshelf |
| 🧑‍🍳 Chef Basil | Kitchen | Sees what you ate today and plans easy meals |
| 🦖 Coach Rex | Home gym | Builds a workout for your energy level that you can log when done |
| 🌙 Luna | Bedroom | Reads today's journal page and helps you reflect or wind down |
| 🪞 Mirror Mo | Bathroom | Confidence coach for kinder self-talk |
| 🌿 Sage | Garden | Calm guide using ideas from CBT and mindfulness, with crisis resources |

The helpers use Claude. To turn them on, walk to the **mailbox 📬** in the garden and paste an API key from [platform.claude.com](https://platform.claude.com). API use costs a little money per message. The key is stored only in your browser. Without a key, the helpers still give simple offline tips.

> The Calm Garden and Sage are for everyday self-care, not a replacement for a therapist. If you're struggling, please reach out to someone you trust or a helpline ([findahelpline.com](https://findahelpline.com)).

## How to open it

The app uses JavaScript modules, so it has to be opened through a web server (double-clicking `index.html` won't work):

```bash
python3 -m http.server
# then open http://localhost:8000
```

Or turn on **GitHub Pages** for this repo (Settings → Pages → deploy from branch) and open the link on any device.

Your data is saved in your browser only. Use **Settings → Download backup** now and then.

## Files

- `index.html`, `styles.css`: the page and HUD
- `src/main.js`: camera, controls, walking, game loop
- `src/world.js`: the house, furniture, garden, lights and shop decor
- `src/avatar.js`: your character
- `src/panels.js`: everything that opens when you use something
- `src/ai.js`: the AI helpers
- `src/state.js`: saved data, needs and coins
- `vendor/`: bundled libraries (see `vendor/README.md`)
