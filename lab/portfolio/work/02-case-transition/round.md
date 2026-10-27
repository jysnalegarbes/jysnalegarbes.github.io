---
title: "Case study transition"
project: Portfolio
page: Work
order: 2
date: 2026-10-18
summary: "How the main card becomes the case study cover across the page change. The card lands on the cover's exact rect (measured from a hidden copy of the case page), then a no-animation view transition swaps pages on an identical frame."
demo: work-case-transition
files:
  - case-transition.ts
  - work-gl.ts
  - ink-wipe.ts
options:
  - name: "Glide"
    status: rejected
    note: "One eased move (power3.inOut, 1.1 s) with the cloth ripple swelling mid-flight; the other cards ripple as they clear out."
    credit: "Card-to-target idea after Ben Paine, Page Transitions with WebGPU (Codrops), which Jayson found too plain"
  - name: "Liquid"
    status: chosen
    note: "Each vertex leaves on its own delay, leading edge first, so the card stretches like a drop of ink and settles into the cover. Later also used for the case study's Next project link."
    credit: "Original for this site"
  - name: "Strips"
    status: rejected
    note: "The card splits into 12 horizontal strips that travel on a stagger, swaying apart and closing up at the cover."
    credit: "Original for this site"
  - name: "Ink"
    status: rejected
    note: "A clean eased move while ink with a blotted noise edge floods the page; the case study opens inked except the cover and the ink recedes."
    credit: "Original for this site"
---
