# Effects library

Every motion and interaction option round from my projects: the options that were offered side by side, which one was chosen, and the code for all of them. It's browsable at **`/lab/`** on the site, a hidden page that isn't in the nav and has `noindex`. The page is built from the files in this folder.

## Layout

```
lab/<project>/<page>/<nn>-<round>/
  round.md        the round's data (read by the /lab/ page)
  *.ts, *.astro   snapshots of the code while the options were on review
```

`src/content.config.ts` (collection `lab`) reads every `round.md`. `src/pages/lab/src/[...path].ts` serves each code file as plain text at `/lab/src/<path inside lab>`, which is what the page's View and Copy use.

## round.md

```yaml
---
title: "Portrait expand"
project: Portfolio
page: About            # Home, Work, Case study, About, In Progress, Contact (the order on the page)
order: 6               # round number within the page
date: 2026-10-26
summary: "One sentence on what the round was for."
demo: portrait-expand  # optional: src/pages/lab/demo/<demo>.astro, takes ?pfx=<option number>
files:                 # relative to this folder
  - portrait-expand.ts
options:
  - name: "Ink Edge"
    status: review     # chosen | rejected | review
    note: "What it does, in one or two sentences."
    credit: "After …"  # optional
---
```

## Live previews

A round with `demo` gets a live card per option. The demo page is drawn at 1440×900 and scaled into the card, and it's mounted only while on screen. Demo pages use `src/layouts/LabDemo.astro` (no site header). Scroll-driven demos call `autoplayScroll()` from `src/scripts/lab-demo.ts`, so they play themselves when embedded.

A demo imports the round's frozen copies in `lab/`, never the live `src/` versions, so it keeps working after the site's own code moves on. Shared helpers (for example `liquid-morph.ts`) are imported from `src/`. Page markup and styles that several of a page's demos share are frozen once at page level, for example `lab/portfolio/home/HomeMarkup.astro` and `home-demo.css`.

Rounds without `demo` show their options as a list with code only. Rebuilding a preview means writing its demo page against the snapshot.

## Adding a round

While the options are still in `src/`, copy the files into a new round folder, write its `round.md`, and only then remove the unchosen options from the site.

## Notes

- **Recovered rounds:** rounds dated before 2026-10-26 were recovered from Claude Code session transcripts, using the exact file contents the edit tool recorded (backup: `~/.claude/backups/portfolio-transcripts/`). A few edits made by shell scripts aren't replayed, so a snapshot can lag the screen by a small tweak.
- **Reusing a snapshot:** snapshots refer to the site as it was then. Copy the parts you need rather than dropping a whole file back into `src/`.
- **Type-checking and deploys:** `lab/` is excluded from `tsconfig.json`, so old snapshots don't fail type checks. Every push to `main` deploys, `lab/` included, because the `/lab/` page is built from it.
