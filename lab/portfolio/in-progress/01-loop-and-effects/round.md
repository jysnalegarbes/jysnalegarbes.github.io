---
title: "Endless cards, scroll and hover effects"
project: Portfolio
page: In Progress
order: 1
date: 2026-11-07
summary: "The intro text holds still while the three card columns loop downward without end (wheel, touch flick, keys), starting from the Figma layout. Three scroll effects and four hover effects were tested side by side (?sfx / ?hfx / ?tweak). Jayson chose Drum Roll for the scroll and Liquid for the hover, then asked for the Liquid smear in black ink and a skew on the drum."
files:
  - in-progress.ts
  - in-progress-hover.ts
  - in-progress-tweaks.ts
  - in-progress.json
  - pixel-trail.ts
  - in-progress.astro
options:
  - name: "Scroll · Velocity Skew"
    status: rejected
    note: "Cards lean (skewY) and stretch with the scroll speed, straightening as it settles. Its lean came back combined with the drum (round 2)."
  - name: "Scroll · Drum Roll"
    status: chosen
    note: "Cards tilt away (rotateX) and shrink toward the top and bottom of the screen, as if on a turning drum; each column's vanishing point is the middle of the screen."
  - name: "Scroll · Column Drift"
    status: rejected
    note: "The columns travel at different speeds (left 0.82, right 1.2) and catch up with different lags."
  - name: "Hover · Halftone Lens"
    status: rejected
    note: "A soft disc around the cursor turns into the site's ink halftone, trailing slightly behind."
  - name: "Hover · Pixel Trail"
    status: rejected
    note: "The cursor leaves blocks that pixelate the photo, fine where fresh and coarse as they fade."
    credit: "After the Produx project cards / footer (produx.design)"
  - name: "Hover · Liquid RGB"
    status: chosen
    note: "The photo smears in the direction the cursor moves, splitting into red / green / blue, and springs back. Chosen, then turned into black liquid ink (round 2)."
  - name: "Hover · Liquid Halftone Trail"
    status: rejected
    note: "A soft, wobbling trail in which the photo turns into the ink halftone and smears with the cursor, drying back into the photo."
---