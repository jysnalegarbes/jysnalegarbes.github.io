---
title: "Name reveal"
project: Portfolio
page: Contact
order: 1
date: 2026-11-07
summary: "The area under 'GOT a project IN MIND?' looks blank; the cursor uncovers the name (Figma 1:552) in the brand green along its trail. After the Produx footer (produx.design)."
files:
  - contact-reveal-pixel.ts
  - contact-reveal-pixel-tweaks.ts
  - contact-reveal-pixel.json
  - pixel-trail.ts
options:
  - name: "Pixel blocks"
    status: rejected
    note: "A block grid remembers the cursor's path: fresh trail shows the letters in fine blocks, older trail in coarser ones, each block its own shade of green with a few near-black, fading back to blank. Replaced by the home page's ink brush at Jayson's request (2026-11-07)."
    credit: "After the Produx footer (produx.design)"
  - name: "Ink brush"
    status: chosen
    note: "The home page's fluid ink trail (src/scripts/fluid-trail.ts, reveal mode) masks the name: where the ink flows, the green letters show. Settings in src/config/contact-reveal.json, panel at /contact/?tweak."
    credit: "Fluid after Pavel Dobryakov's WebGL-Fluid-Simulation (MIT)"
---