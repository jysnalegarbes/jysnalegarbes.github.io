---
title: "Approach hold, slower beyond, photo halftone, mobile pins, goo controls"
project: Portfolio
page: About
order: 14
date: 2026-11-06
summary: "my APPROACH now holds in its Figma place while its lines rise, then moves on; beyond DESIGN holds longer (slower highlight) and its photos come in as ink halftone dots; mobile gets the Figma 1:1377–1:1521 layout with pinned titles and both holds; hold, highlight and goo settings move into src/config/about-motion.json with a ?tweak panel, including a noise-roughened 'ink edge' for the goo."
files:
  - about-before.astro
  - about-after.astro
  - about-sections-before.ts
  - about-sections-after.ts
  - photo-ripple-before.ts
  - photo-ripple-after.ts
  - ink-halftone.ts
  - about-tweaks.ts
  - about-motion.json
options:
  - name: "Approach · scrolled line scrub"
    status: rejected
    note: "Round 13: the masked lines rose with the block's own height of scroll while it kept moving up. Replaced 2026-11-06."
  - name: "Approach · held line scrub"
    status: chosen
    note: "The section holds (sticky frame, approach.hold = 2 screens) once its top meets the top of the screen; the two paragraphs' masked lines rise one after the other over 5–90% of the hold, then the section scrolls on."
    credit: "GreenSock CodePen GggpRoB (SplitText masked lines), driven by the site's own cue engine"
  - name: "Beyond · 2.5-screen hold"
    status: rejected
    note: "Round 12's hold. Jayson found the highlight still too quick. Replaced 2026-11-06."
  - name: "Beyond · 3.5-screen hold, tweakable"
    status: chosen
    note: "beyond.hold = 3.5 screens, highlight over 5–85% of it; all three numbers live in about-motion.json and the ?tweak panel."
  - name: "Beyond photos · ink halftone"
    status: chosen
    note: "Each photo comes in as black ink dots on paper (45° screen, dot area by darkness) and resolves back into itself from the top down under the home portrait's wave. Shared shader in ink-halftone.ts, also used by the services hover, the home hero and the Work gallery."
  - name: "Mobile · stacked, unpinned"
    status: rejected
    note: "Rounds 10–13: mobile sections stacked and centred, titles in the flow, no holds. Replaced 2026-11-06."
  - name: "Mobile · Figma screens, pinned"
    status: chosen
    note: "Figma 1:1377–1:1521: greeting 36px on one line; titles 44px held at y 141 while their section goes by; content from y 267 (services 342 wide, rows 80 apart; approach 22px, 80 apart; photos 270×318 centred, text 66 under). Approach and beyond hold as on desktop."
  - name: "Goo · fixed constants"
    status: rejected
    note: "Goo blur, threshold and duration were constants in about-sections.ts (and data-fx-dur / data-fx-blur on the ending)."
  - name: "Goo · config + ink edge"
    status: review
    note: "gooTitles / gooFade / gooEnding in about-motion.json, live in /about/?tweak with Save to project. inkEdge.roughness > 0 pushes the blurred edge around with feTurbulence + feDisplacementMap before the threshold; a 'comic ink' preset is in the panel. Defaults keep the clean Codrops goo until Jayson picks values."
    credit: "Codrops Gooey Text Hover (demos 1 and 2); ink-edge idea after santionispirits.com's hero ink"
---
