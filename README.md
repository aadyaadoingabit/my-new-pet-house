# 🏠 My Pet House

A cute 3D life simulation where **you are the pet**. Walk around your own house, look after your needs, and fill them back up by doing real things in real life. Every room has its own AI helper.

The look is inspired by Takashi Murakami's superflat art and Sanrio: toon shading with outlines, candy colors, smiling flowers and kawaii faces. All characters and artwork are original.

The full design plan lives in a separate design doc; the app is being built in phases (1: look and movement, 2: phone and iPad, 3: helpers, 4: journal, 5: music room, 6: game room).

## What's inside

- **A cute 3D house** with nine rooms: bedroom, bathroom, study, music room, kitchen, living room, home gym, game room and garden. Tap to walk, tap furniture to use it, drag to turn the camera, hold Shift to run.
- **Smooth movement:** blended walk and run animations, gentle acceleration, curved turns, easing into chairs and bed, and a gliding camera.
- **Sims-style needs** (Hunger, Energy, Hygiene, Fun, Social, Calm) that slowly drop over real time. A mood gem floats over your head, and a thought bubble shows what you need most.
- **Day and night** that follows your real clock. Lamps turn on at night and stars come out.
- **Design yourself** in the wardrobe: skin, hair style and color, clothes, shoes.
- **Coins and a shop.** Earn coins for real self-care (with daily limits, so no cheating!) and buy furniture, an aquarium, a fountain, even a cat.
- **Everything from before**: habit board with streaks, focus timer, skills, flashcards, meals, water, sleep, workouts, journal, mood check-ins, box breathing, grounding, thought reframing, gratitude and progress charts.

## The AI helpers

| Helper | Room | What they do |
|---|---|---|
| 🌞 Sunny | Living room | Growth guide for attachment, fear of abandonment and consistency (DBT and CBT skills, tiny daily promises, ongoing-session memory) |
| 🦉 Professor Owl | Study | Builds full courses on anything, teaches them in bite-size lessons with reviews, makes flashcards, searches the web with sources, and helps you focus ADHD-style (tiny steps, flower timer, parking lot, studies beside you) |
| 🧑‍🍳 Chef Basil | Kitchen | Healthy, steady weight loss through food; plans meals from what you logged |
| 🦖 Coach Rex | Home gym | Healthy weight loss through workouts that fit your energy; shares your optional weekly weigh-ins with Basil |
| 🌙 Luna | Bedroom | Gentle journal companion (guided nightly journal comes in Phase 4) |
| 🪞 Mirror Mo | Bathroom | Confidence coach for kinder self-talk |
| 🌿 Sage | Garden | Spiritual and holistic guide: meditation, breath, values, meaning (any or no religion) |
| 🎧 DJ Mochi | Music room | Music guide who introduces new genres (Spotify comes in Phase 5) |

Every helper:
- **Can be renamed** (tap ✏️ Rename in their chat).
- **Remembers you**: after a chat it keeps a few short notes. See, add or delete them in Settings → "See what your helpers remember".
- **Works as a team**: helpers can share useful notes with each other (you can switch this off per helper).
- **Notices patterns** in your own logs and gives a weekly "This week I noticed..." check-in. Observations, never diagnoses.

### What powers the helpers (Settings → mailbox 📬)

- **🌸 Free on-iPad AI (default):** runs completely on your iPad with [WebLLM](https://github.com/mlc-ai/web-llm) and Meta's open Llama 3.2 models. Free, private (chats never leave the device) and works offline. One-time download: *Quick* (about 0.9 GB) or *Smarter* (about 2.3 GB, best on M1 iPads or newer). Needs iPadOS 26 or newer (WebGPU).
- **✨ Claude (optional, paid):** the smartest option, plus web search for Owl. Paste an API key from [platform.claude.com](https://platform.claude.com); each message costs a little.
- **Offline mode:** with neither, helpers give built-in tips, tiny steps and pattern check-ins.

Whatever powers them, if you write something that sounds like a crisis, the app always shows helpline numbers.

> The Calm Garden and Sage are for everyday self-care, not a replacement for a therapist. If you're struggling, please reach out to someone you trust or a helpline ([findahelpline.com](https://findahelpline.com)).

## How to open it

The app uses JavaScript modules, so it has to be opened through a web server (double-clicking `index.html` won't work):

```bash
python3 -m http.server
# then open http://localhost:8000
```

Or turn on **GitHub Pages** for this repo (Settings → Pages → deploy from branch) and open the link on any device.

### On iPad (the main device) and iPhone

1. Open the GitHub Pages link in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open **Pet House** from your home screen and hold your iPad **sideways** (the house plays in landscape): it runs full screen like a real app, and works offline after the first visit (the AI helpers still need internet).

Touch controls: tap to walk, use the **joystick** (push it all the way to run), drag to turn the camera, pinch to zoom, **long-press** anything to see what it is, and swipe a panel down to close it. In Safari, the **Full screen** button hides the browser bars.

Your data is saved in your browser only. Use **Settings → Download backup** now and then.

## Files

- `index.html`, `styles.css`: the page and HUD
- `src/main.js`: camera, controls, walking, game loop
- `src/world.js`: the house, furniture, garden, lights, shop decor and helper mascots
- `src/style.js`: the art style (toon materials, kawaii faces, smiling flowers, patterns)
- `src/optimize.js`: speed-ups for phones (merging still objects, automatic quality)
- `sw.js`, `manifest.webmanifest`, `icons/`: home-screen app and offline support
- `src/avatar.js`: your character
- `src/panels.js`: everything that opens when you use something
- `src/ai.js`: the AI helpers
- `src/state.js`: saved data, needs and coins
- `vendor/`: bundled libraries (see `vendor/README.md`)
