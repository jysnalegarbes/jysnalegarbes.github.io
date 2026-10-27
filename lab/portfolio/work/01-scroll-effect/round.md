---
title: "Gallery scroll effect"
project: Portfolio
page: Work
order: 1
date: 2026-10-18
summary: "What the Work cards do while the gallery moves. Driven by scroll speed, flat at rest."
demo: work-scroll
files:
  - work-gl.ts
  - work-index.astro
options:
  - name: "Flag"
    status: chosen
    note: "Two travelling sine waves bend each card's mesh like cloth, scaled by speed, with light shading on the folds. Jayson: \"I freaking love fx=1\"."
    credit: "After taroyoshimura.dev"
  - name: "Bend"
    status: rejected
    note: "The card bows against the motion with an RGB split (toned down after the first preview), and zooms out to the full frame as it reaches the main slot."
    credit: "After Jesper Landberg, Infinite draggable WebGL slider (CodePen povjKxV)"
  - name: "Ink drag"
    status: rejected
    note: "The image smears along the motion and ragged ink streaks trail off the back edge. The bleed was scaled down after it reached over the details text."
    credit: "Original for this site"
  - name: "Halftone"
    status: rejected
    note: "The photo breaks into black ink halftone dots on a 45° screen that grow with speed, then resolves back to the photo."
    credit: "Original for this site"
---
