---
title: "Tools page layout"
project: Portfolio
page: Tools
order: 1
date: 2026-11-09
summary: "Three layouts for the /tools/ page, replacing equal cards with hand-drawn icon tiles. All three show each tool by what it does, with real screenshots of the tools in use (Jayson's own projects and portrait as content). Jayson chose Index 'for now' (2026-11-09); Workbench and Showcase stay on review."
demo: tools-layout
files:
  - ToolsIndex.astro
  - ToolsWorkbench.astro
  - ToolsShowcase.astro
  - tools-layout.ts
  - tools-data.ts
options:
  - name: "Index"
    status: chosen
    note: "Typography-led, in the site's editorial voice: one big row per tool with its name as the focal point. On a fine pointer the tool's real screenshot follows the cursor; on touch each row carries a small thumbnail."
  - name: "Workbench"
    status: review
    note: "Task-first: drop a file and the tools that take it light up while the rest step back. Tools grouped by input (For PDFs / For images) and headed by what they do. If chosen, the live page could hand the file straight to the tool."
  - name: "Showcase"
    status: review
    note: "Product-led: an uneven grid of real screenshots. PDF Studio leads wide, three image tools share a row, the Mockup Generator closes as a full-width band."
---
