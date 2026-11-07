---
title: "Portrait halftone and ink wipe controls"
project: Portfolio
page: About
order: 15
date: 2026-11-07
summary: "Three halftone variants for the opening portrait were tested against the live Ink Develop print, using the site's shared halftone. Jayson chose Halftone Develop and tuned it: dots growing from 4 to 7 px, resolving top-down from 60% of the growth, with 65% of the dots kept at full screen. The noise wipe that follows got live controls: edge width, noise scale x/y, and its start and end in the scroll. All values are in portrait-expand.json."
files:
  - portrait-expand-all-variants.ts
  - portrait-tweaks-all-variants.ts
  - portrait-expand.json
  - about-intro.ts
  - about-wipe.ts
options:
  - name: "Ink Develop"
    status: rejected
    note: "Round 6's choice: a grainy ink print in the site's black and off-white that gains tones as it grows, held at full screen until the wipe. Variant 0 in portrait-expand-all-variants.ts."
  - name: "Halftone Develop"
    status: chosen
    note: "The portrait is ink dots (the shared 45° screen) while it grows. From 'resolve from' it resolves top-down into the photo; 'dots at end' keeps part of the screen at full size. Jayson's values: cells 4 → 7 px, resolve from 0.6, dots at end 0.65. Variant 1."
  - name: "Print + Scroll Dots"
    status: rejected
    note: "The Ink Develop print breaks into dots, cell by cell, while you scroll (scroll speed), and settles back into the print when you stop. Variant 2."
  - name: "Photo + Scroll Dots"
    status: rejected
    note: "The photo breaks into dots while you scroll, like the Work strip, and returns to the photo at rest. Variant 3."
  - name: "Ink wipe controls"
    status: chosen
    note: "Edge width 2.79, noise scale x 28.31, y 17.96, from 0.69 to 1 of the opening's scroll (was 2.8 / 16.21 / 11.66, 0.7 → 0.97). The page transitions keep the original wipe."
    credit: "Wipe after Codrops, WebGL Image Transitions demo 1 (Yuri Artiukh)"
---