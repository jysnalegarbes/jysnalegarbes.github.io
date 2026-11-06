---
title: "Nav page transitions"
project: Portfolio
page: Site
order: 1
date: 2026-11-06
summary: "Figma 1:869 / 1:927 / 1:986 / 1:1044: clicking Work, About, In Progress or Contact inks the screen black and names the page (italic word over an upside-down caps word); the next page arrives under the same screen, the word tumbles upright and the ink lifts off the top."
files:
  - PageTransition.astro
  - page-transition.ts
options:
  - name: "Ink screen · wipe, goo, tumble"
    status: rejected
    note: "Leaving: About's Codrops noise wipe rises (0.9s), the italic word condenses out of goo-1, the caps word (rotated 180° as in Figma) rises out of a mask. Arriving: BaseLayout's head script holds the screen before first paint; the caps word tumbles upright (rotateX + rotateY 180 → 0, 0.9s) through a goo pulse, both words melt back into goo, and the wipe runs back on a flipped canvas so the ink lifts upward. 170px SemiBold, Playfair italic tracked 14%. Nav links only; modified clicks, the current page and reduced motion keep plain links. Jayson: it paused in the middle and the flip read wrong; replaced by round 2 2026-11-06."
    credit: "Codrops WebGL Image Transitions demo 1 (noise wipe, Yuri Artiukh); Codrops Gooey Text Hover"
---
