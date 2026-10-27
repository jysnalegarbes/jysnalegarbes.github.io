---
title: "Opening end"
project: Portfolio
page: About
order: 1
date: 2026-10-20
summary: "How the full-screen portrait gives way to the dark text sections."
demo: about-opening
files:
  - about-intro.ts
  - about-intro-wipe.ts
  - about-wipe.ts
options:
  - name: "Centre circle"
    status: rejected
    note: "Black spreads from the centre as a circle once the portrait passes 3/4 of the screen, leaving it at a faint 5% lighten. Rejected: Jayson wanted the portrait kept at 100%. Code: about-intro.ts."
  - name: "Noise wipe"
    status: chosen
    note: "The full-strength portrait gives way to #141918 through a noise-edged wipe from the bottom up. Jayson's settings: width 2.8, scaleX 16.21, scaleY 11.66. Code: about-intro-wipe.ts + about-wipe.ts (the shader only draws the black mask over the image)."
    credit: "After Codrops, WebGL Image Transitions demo 1 (Yuri Artiukh)"
---
