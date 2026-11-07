---
title: "View Project tooltip"
project: Portfolio
page: Work
order: 6
date: 2026-11-07
summary: "A 'View Project' tooltip follows the cursor over the left-most card (the main slot, the one that opens the case study), hidden over the other cards, while dragging and once pressed. Three styles were tested (?ttfx=1..3); Jayson chose the Split Label."
files:
  - work-tooltip-all-styles.ts
  - work-tooltip-tweaks-all-styles.ts
  - work-tooltip-all-styles.css
  - work-tooltip.json
options:
  - name: "Pill"
    status: rejected
    note: "A small black pill with a green dot, 'VIEW PROJECT' and an arrow; springs in (back.out) and trails the cursor."
  - name: "Ink Disc"
    status: rejected
    note: "A black disc that takes the cursor's place, 'view PROJECT' inside; grows in through the site's ink goo and drains back out."
  - name: "Split Label"
    status: chosen
    note: "No background: '(View Project) →' beside the cursor, its letters rising in one after another through a mask; it inverts over the photo (difference blend)."
---