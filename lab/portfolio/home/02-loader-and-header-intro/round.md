---
title: "Loader and header intro"
project: Portfolio
page: Home
order: 2
date: 2026-10-17
summary: "The home page loader, with how the header arrives once it ends. Loader previews use the gooey header; header previews follow the ink burst."
demo: home-loader
files:
  - page-loader.ts
  - fluid-trail.ts
options:
  - name: "Ink burst"
    status: chosen
    note: "The screen starts flooded with the trail's ink, then blows open from the centre and fades like a trail."
    credit: "Built on the site's fluid (after Pavel Dobryakov, WebGL Fluid Simulation, MIT)"
  - name: "Ink wash"
    status: rejected
    note: "The ink cover lifts in noise-edged blotches, like ink off wet paper."
    credit: "Noise dissolve after gl-transitions (MIT)"
  - name: "Flipbook"
    status: rejected
    note: "No cover: the portrait flicks through its frames in step with the counter."
  - name: "Curtain"
    status: rejected
    note: "A dark panel with the counter lifts away on a dripping, liquid edge. No WebGL."
    credit: "Idea after CodyHouse, Ink Transition Effect"
  - name: "Header: gooey"
    status: chosen
    note: "Header items condense in through a goo filter."
  - name: "Header: masked rise"
    status: rejected
    note: "Header items rise out of a clip mask, staggered."
  - name: "Header: ink drops"
    status: rejected
    note: "Header items appear out of drops of the trail's ink."
---
