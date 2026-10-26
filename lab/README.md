# Effects library

Every option round from the portfolio build: the effects that were offered side by side, which one was chosen, and the code for all of them. Nothing in `lab/` is built or deployed. Astro only builds `src/`, and the deploy workflow ignores pushes that touch only `lab/`.

## How to use it

- **Each round folder** holds a snapshot of the files as they were while the options were on review, usually with every option and its switcher in the same file. Open the file and read its header comment first. It lists the options.
- **To reuse an option:** copy the parts you need into `src/`, not the whole snapshot. The rest of the site has moved on since, so a snapshot dropped back in place won't run without adjusting (imports, markup hooks, tunables).
- **Recovered from transcripts:** rounds before 2026-10-26 were rebuilt from Claude Code session transcripts, using the exact file contents the edit tool recorded. They are faithful to what ran then. A few edits made by shell scripts aren't replayed, so a snapshot can lag the screen by a small tweak.
- **Adding a new round:** while the options are still in `src/`, copy the files here into `<page>/<nn>-<name>/` and add a row below, before cleaning up.

## Home

| Round | Options (✓ chosen) | Files | Switch |
|---|---|---|---|
| [01 Portrait hover](home/01-portrait-hover/) | ✓ Slider dent (dev_loop pen) · Lens blur (Codrops SDF Lens Blur v1) | `portrait-fx.ts`, `index.astro` | `?tweak` panel |
| [02 Loader + header intro](home/02-loader-and-header-intro/) | Loader: ✓ Ink burst · Ink wash · Flipbook · Curtain. Header intro: ✓ Gooey · Masked rise · Ink drops | `page-loader.ts` | `?loader=1..4` |
| [03 Nav hover](home/03-nav-hover/) | ✓ Gooey cross-fade (Codrops Gooey Text Hover demo 2) · Letter flip · Letter roll · Star spin | `nav-hover.ts`, `SiteHeader.astro` (the option CSS) | `?nav=1..4` |

Also tried and rejected on Home: playing the loader once per session (it plays on every load now).

## Work

| Round | Options (✓ chosen) | Files | Switch |
|---|---|---|---|
| [01 Scroll effect](work/01-scroll-effect/) | ✓ Flag (after taroyoshimura.dev) · Bend (Jesper Landberg slider) · Ink drag · Halftone | `work-gl.ts`, `work-index.astro` | `?fx=1..4` |
| [02 Case transition](work/02-case-transition/) | Glide · ✓ Liquid · Strips · Ink | `case-transition.ts`, `work-gl.ts`, `ink-wipe.ts` | switcher on the Work page |
| [03 Detail text swap](work/03-detail-text-swap/) | ✓ Gooey demo 1, 0.9 s · Gooey demo 3 (shifting) | `work-gallery.ts` (the demo 3 version) | none |

## About

| Round | Options (✓ chosen) | Files | Switch |
|---|---|---|---|
| [01 Opening end](about/01-opening-circle/) | Black spreading from the centre as a circle, ending on the portrait at "lighten 5%" · ✓ Codrops noise wipe, bottom to top | `about-intro.ts` (the circle version) | none |
| [02 Section effects v1](about/02-section-effects-v1/) | Words condensing out of ink in a left-to-right wave, melting upward on exit, plus a velocity bend (scroll bends the lines into a sine). Replaced by the transition brief. | `about-sections.ts`, `about.astro` | none |
| [03 Spotlight + ghost](about/03-spotlight-and-ghost/) | Spotlight (chars sharpen centre-out) on section 1 · the dim "ghost" paragraph under rising words in section 2. Both replaced (by `goo-1` and `scrub-lines`). | `about-sections.ts`, `about.astro` | none |
| [04 Flying photos](about/04-flying-photos/) | Section 5 photos: the previous one flies off the top · ✓ they pile up | `about-sections.ts` | none |
| [05 Page indicator](about/05-page-indicator/) | ✓ Folio · Rail · Orbit · Chapters | `PageProgress.astro`, `page-progress.ts` | on-page switcher |
| [06 Portrait expand](about/06-portrait-expand/) | Ink Edge · Lens Settle · Lens Warp · Shutter Strips (*being chosen*) | `portrait-expand.ts`, `about-intro.hook.diff` (the 3 lines that call it) | dev-only switcher, `?pfx=0..4` |
