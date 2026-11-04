---
title: "Flow refinements: pinned titles, ink halftone, photo wobble, new ending"
project: Portfolio
page: About
order: 11
date: 2026-11-04
summary: "Jayson's refinements to the continuous scroll (round 10). Section titles now hold in place and hand over to the next one, the intro paragraph's alternating line scrub is back, service images come in as ink halftone and reveal faster, the beyond DESIGN highlight runs slower and each photo wobbles in like the home portrait, and the ending follows Figma 175:132. The my APPROACH text animation (a GreenSock CodePen) is still to come."
files:
  - about-before.astro
  - about-sections-before.ts
  - service-hover-before.ts
  - about-after.astro
  - about-sections-after.ts
  - service-hover-after.ts
  - photo-ripple.ts
options:
  - name: "Titles scroll with their section"
    status: rejected
    note: "Round 10: each title came in with its goo when 30% up the screen and then scrolled away with its content. Replaced 2026-11-04."
    credit: "Goo intros after Codrops Gooey Text Hover"
  - name: "Pinned titles"
    status: chosen
    note: "Desktop: what I DO, my APPROACH and beyond DESIGN hold in their Figma place on the screen. Each comes in (goo-2) once the previous section's content has left the screen and goes out through the same goo the other way, sliding on to the right, once its own has, so the titles hand over in one slot. Mobile keeps the titles in the flow."
    credit: "Goo intros after Codrops Gooey Text Hover"
  - name: "Service image · green reveal only"
    status: rejected
    note: "Round 8: the noise-edged green band sweeps over the image in 1.5s. Replaced 2026-11-04."
    credit: "Codrops Motion Hover Effects demo 1 (Niccolò Miranda & Clément Roche); Revealing WebGL Images variation 2 (@akella)"
  - name: "Service image · green reveal + ink halftone"
    status: chosen
    note: "The band sweeps in 1.1s. Under it the photo first shows as black ink dots on off-white paper (45° screen, dot size from the photo's darkness), holds 0.55s, then resolves into the photo from the top down over 0.9s, the dots getting finer."
    credit: "Codrops Motion Hover Effects demo 1 (Niccolò Miranda & Clément Roche); Revealing WebGL Images variation 2 (@akella)"
  - name: "Beyond photos · clip rise"
    status: rejected
    note: "Each trigger word lays a photo on the pile with the home hero's clip reveal; the highlight ran over 0.55 screens. Replaced 2026-11-04."
  - name: "Beyond photos · clip rise + portrait wave"
    status: chosen
    note: "The same clip rise, plus the home portrait's intro wave (perspective ripple with a faint RGB split, 1.6s) running through the photo as it lands. The highlight now runs over 0.9 screens so each photo has time to land."
    credit: "Wave after dev_loop's WebGL Slider Interaction pen (via portrait-fx.ts)"
  - name: "Ending · 156:74"
    status: rejected
    note: "Thanks for reading. / GOT a project IN MIND? with Say hello and See the work links. Replaced 2026-11-04."
  - name: "Ending · 175:132"
    status: chosen
    note: "anyway, THAT'S ME. (Playfair Display) over one line of Archivo, centred; the page still turns from dark to light as it comes up. No links."
---
