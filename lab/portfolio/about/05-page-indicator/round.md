---
title: "Page indicator"
project: Portfolio
page: About
order: 5
date: 2026-10-24
summary: "How far through the page you are, by chapter."
files:
  - PageProgress.astro
  - page-progress.ts
options:
  - name: "Folio"
    status: chosen
    note: "Bottom right: a rolling italic chapter number, the chapter name and a hairline with the percentage."
  - name: "Rail"
    status: rejected
    note: "A hairline on the right edge with a tick per chapter; the current one is named."
  - name: "Orbit"
    status: rejected
    note: "A ring that closes as you read, with a dot per chapter."
  - name: "Chapters"
    status: rejected
    note: "A segmented hairline along the bottom, one segment per chapter."
---
