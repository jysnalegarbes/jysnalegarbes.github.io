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
  - SiteHeader.astro
options:
  - name: "Hand-over · continuous"
    status: review
    note: "Leaving: wipe 0.9s; italic word condenses out of the goo from 0.35s, caps word (still upside down) slides in through a goo pulse from 0.45s, both over gooTitles.duration with the ink edge; navigates as they finish (≈1.65s). Arriving: a 0.3s hold on the finished screen (Jayson, 2026-11-06), then both words blur back into goo and fade (the caps word sliding on) while the ink lifts from 0.2s over 1.1s. Removed: the 0.15s beat before leaving, the 0.15s delay and 0.9s tumble on arrival. Prefetch on nav hover / focus / touch. Cross-document view transition (@view-transition, no animation) only for this hand-over."
    credit: "Codrops WebGL Image Transitions demo 1 (noise wipe); Codrops Gooey Text Hover"
  - name: "Header · badge bump on load"
    status: chosen
    note: "The desktop availability badge's fist bump plays on every page load, once the header can be seen (after the home loader or a transition's ink has lifted)."
  - name: "Header · Menu hides the nav"
    status: chosen
    note: "Desktop: clicking Menu lifts the four links out one after another from the bottom up (0.06s apart) and drops them back in from the top; remembered for the visit (sessionStorage). Hidden links are inert. Mobile keeps its full-screen panel."
---
