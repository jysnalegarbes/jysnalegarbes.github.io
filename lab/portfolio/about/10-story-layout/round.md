---
title: "Story layout: pinned stage → continuous scroll"
project: Portfolio
page: About
order: 10
date: 2026-11-02
summary: "How the text after the opening is laid out. The pinned stage (every section swapping in place on one screen) was replaced by Jayson's revision: the greeting stays pinned, then the page scrolls on continuously; titles keep their goo intro and content just scrolls in. Same round: the services rows and hover band from Figma 154:2, and the dark-to-light ending from 156:74."
files:
  - about-pinned.astro
  - about-sections-pinned.ts
  - about-flow.astro
  - about-sections-flow.ts
options:
  - name: "Pinned stage"
    status: rejected
    note: "Five sections share one pinned screen; scroll only cues what shows. Each block has its own intro (goo, scrubbed lines, stack, cascade) and leaves through the reversed Ink Bleed, with breathers between sections. Replaced 2026-11-02."
    credit: "Goo intros after Codrops Gooey Text Hover; Cascade Reveal after Jayson's snippet"
  - name: "Continuous scroll"
    status: chosen
    note: "After the pinned greeting the page scrolls normally. Section titles keep the goo intro, cued from their own position on screen; content scrolls in with no intro, except beyond DESIGN's word highlight and photo pile. Hovering a service lays a full-width white band under its row (text turns black, the image stays between). The ending turns the page from dark to light as it comes halfway up."
    credit: "Goo intros after Codrops Gooey Text Hover"
---
