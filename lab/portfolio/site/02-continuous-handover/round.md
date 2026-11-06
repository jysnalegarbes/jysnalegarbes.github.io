---
title: "Continuous hand-over"
project: Portfolio
page: Site
order: 2
date: 2026-11-06
summary: "The transition runs straight through: the words form through the ink goo on the leaving page, the browser changes page the moment they have, and the new page melts them away and lifts the ink at once. No flip, no pauses; the next page is prefetched on hover, and a view transition holds the inked frame across the change."
files:
  - page-transition.ts
  - PageTransition.astro
options:
  - name: "Hand-over · continuous"
    status: review
    note: "Leaving: wipe 0.9s; italic word condenses out of the goo from 0.35s, caps word (still upside down) slides in through a goo pulse from 0.45s, both over gooTitles.duration with the ink edge; navigates as they finish (≈1.65s). Arriving: no delay; both words blur back into goo and fade (the caps word sliding on) while the ink lifts from 0.2s over 1.1s. Removed: the 0.15s beat before leaving, the 0.15s delay and 0.9s tumble on arrival. Prefetch on nav hover / focus / touch. Cross-document view transition (@view-transition, no animation) only for this hand-over."
    credit: "Codrops WebGL Image Transitions demo 1 (noise wipe); Codrops Gooey Text Hover"
---
