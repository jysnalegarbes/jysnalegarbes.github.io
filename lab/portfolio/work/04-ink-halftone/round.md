---
title: "Ink halftone on the gallery cards"
project: Portfolio
page: Work
order: 4
date: 2026-11-06
summary: "Every card breaks into black ink halftone dots and resolves back into its cover when it comes on screen: on load, and each time scrolling the strip brings it back into view."
files:
  - work-gl-before.ts
  - work-gl-after.ts
options:
  - name: "Cards · flag only"
    status: rejected
    note: "Round 1: covers drawn plain, rippling like cloth while the strip moves."
  - name: "Cards · flag + ink halftone on entry"
    status: rejected
    note: "The flag shader gets the shared halftone (ink-halftone.ts); a card's dots start when its rect enters the screen with its texture up, and the layer keeps drawing while any resolve. The liquid morph into a case study stays plain. Jayson: the per-card timing felt off; replaced by round 5 (all cards together) 2026-11-06."
---
