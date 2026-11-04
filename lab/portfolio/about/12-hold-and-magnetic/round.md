---
title: "Held beyond DESIGN, Magnetic Pull ending"
project: Portfolio
page: About
order: 12
date: 2026-11-04
summary: "Jayson's second pass on round 11. beyond DESIGN now holds in place while its highlight lays the photos, and the ending's title gets a longer goo with the line under it pulled in character by character. The previous versions are round 11's -after files. The my APPROACH text animation (a GreenSock CodePen) is still to come."
files:
  - about.astro
  - about-sections.ts
options:
  - name: "Beyond · highlight while scrolling past"
    status: rejected
    note: "Round 11: the photos and text scroll up the whole time; the highlight runs over 0.9 screens of it. Replaced 2026-11-04."
  - name: "Beyond · held"
    status: chosen
    note: "Desktop: once the section's top meets the top of the screen, its photos and text hold in their Figma places for 2.5 screens (sticky frame, data-hold). The highlight runs over 5–85% of the hold (about 2 screens), laying the photos as before, then the section scrolls up. Mobile keeps round 11's scroll highlight."
  - name: "Ending title · goo-1 1.6s"
    status: rejected
    note: "Round 11: the same goo as the greeting. Replaced 2026-11-04."
  - name: "Ending title · goo-1 2.6s, blur × 1.5"
    status: chosen
    note: "A longer, stronger condense for anyway, THAT'S ME."
    credit: "Codrops Gooey Text Hover"
  - name: "Ending line · Magnetic Pull"
    status: chosen
    note: "The line under the title: each character flies in from a random offset (±5em) and turn (±90°), stagger 0.02s, 1s power3.out, starting 0.4s after its cue."
    credit: "Jayson's Magnetic Pull snippet (GSAP SplitText)"
---
