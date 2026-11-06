---
title: "Strip-wide halftone, ink settle sound, ink goo details"
project: Portfolio
page: Work
order: 5
date: 2026-11-06
summary: "The halftone is now one effect for the whole strip: every cover breaks into dots together once all have loaded, and scrolling breaks them all into dots again, holds them while the strip moves and resolves them as it comes to rest, with a synthesised ink sound as they settle. The project details melt through About's ink goo (about-motion.json gooTitles + inkEdge)."
files:
  - work-gl.ts
  - ink-sound.ts
  - ink-goo.ts
  - ink-halftone.ts
  - work-gallery.ts
options:
  - name: "Cards · strip-wide halftone"
    status: chosen
    note: "One ink level for all cards: rises to full dots in 0.15s while |velocity| > 0.03, holds 0.55s after the strip stops, resolves over 0.9s. On load the covers wait for each other, swap to WebGL together and run it once. Resolve staggered (Jayson, 2026-11-06): cards on screen resolve left to right, 0.15s apart; then shortened (Jayson, 2026-11-06): dots hold 0.3s after the strip stops and each card resolves in 0.45s (the rest of the site keeps 0.55 / 0.9)."
  - name: "Ink settle sound"
    status: rejected
    note: "Web Audio synth, no file: band-passed noise sweeping 2.8k → 700 Hz (0.38s) over a sine drop 180 → 70 Hz (0.2s), at 0.18. Plays when the dots finish resolving. Browsers only allow it after a click, tap or key press on the page; wheel scrolling alone stays silent. Off under reduced motion. Switched off for now (Jayson, 2026-11-06); ink-sound.ts stays in the project, unused."
  - name: "Details · ink goo"
    status: chosen
    note: "The number / year / title / category cross-fade now uses the shared ink goo (ink-goo.ts) with gooTitles' blur, contrast, threshold and duration and the ink edge, replacing round 3's fixed small-blur goo."
    credit: "Codrops Gooey Text Hover, demo 1"
---
