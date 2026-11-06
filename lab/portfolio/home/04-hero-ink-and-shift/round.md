---
title: "New hero photo, ink halftone intro, mouse shift"
project: Portfolio
page: Home
order: 4
date: 2026-11-06
summary: "The hero photo is swapped for Figma 1:14's new one (its crop too), comes in as ink halftone dots that resolve back into the photo (on touch screens as well), and the composition drifts a little against the cursor."
files:
  - index-before.astro
  - index-after.astro
  - portrait-fx-before.ts
  - portrait-fx-after.ts
  - page-loader-before.ts
  - page-loader-after.ts
  - hero-before.png
options:
  - name: "Hero photo · 09-23 portrait"
    status: rejected
    note: "hero-before.png, cropped top -11.32%, left -72.8%, 190.23% × 119.2%. Replaced by Jayson's update 2026-11-06."
  - name: "Hero photo · 1:14 update"
    status: chosen
    note: "New 1254² image, cropped top -14.58%, left -82%, 205.84% × 129.16% of the 411×655 frame."
  - name: "Hero intro · clip + wave"
    status: rejected
    note: "Round 2: the loader opens the portrait's clip and plays the intro wave."
  - name: "Hero intro · clip + ink halftone + wave"
    status: chosen
    note: "The same, with the photo breaking into black ink dots as the clip opens and resolving from the top down under the wave (ink-halftone.ts). Without the loader (?loader=0 or a page transition) it plays on its own. The portrait canvas now mounts on touch screens too, without the dent."
  - name: "Mouse shift"
    status: chosen
    note: "Each piece moves up to --depth Figma px against the cursor (UI/UX 26, visual 18, designer 30, footer 8; the portrait −12, with it), eased at 6% a frame, through the CSS translate property so the pieces keep their own transforms. Fine pointers only, off under reduced motion."
    credit: "After santionispirits.com's hero"
---
