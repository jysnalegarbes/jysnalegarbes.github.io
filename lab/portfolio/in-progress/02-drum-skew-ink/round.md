---
title: "Drum skew and liquid ink"
project: Portfolio
page: In Progress
order: 2
date: 2026-11-07
summary: "Round 1's choices refined. Drum Roll gained a lean and stretch that follow the scroll speed and ease back, like the About services image following the cursor; Jayson tuned it (tilt 80°, perspective 4000, stretch 0.16, smoothing 0.15, wheel 1.35). The Liquid hover was turned into black liquid ink with a tail and a wobbling edge, and tuned too, but Jayson went back to Liquid RGB 'for now'."
files:
  - in-progress-hover-ink.ts
  - in-progress.ts
  - in-progress-tweaks.ts
  - in-progress.json
options:
  - name: "Drum Roll + skew"
    status: chosen
    note: "Cards tilt and shrink toward the screen edges; while scrolling they also lean (skewY) and stretch with the speed, easing back over 'settle'. Values in in-progress.json."
  - name: "Hover · Liquid Ink"
    status: rejected
    note: "Black ink (--black) floods the photo around the cursor, drawn out into a tail behind it, with a wobbling edge, the photo smeared underneath; it drains back when the cursor slows. Jayson's tuning is in in-progress.json (ink). Set aside for Liquid RGB 'for now' (2026-11-07)."
  - name: "Hover · Liquid RGB"
    status: chosen
    note: "Back from round 1: the photo smears in the direction the cursor moves, splitting into red / green / blue, and springs back."
---