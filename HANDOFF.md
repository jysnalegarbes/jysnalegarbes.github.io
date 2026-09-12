# Handoff Notes — Jayson Alegarbes Portfolio Website

**Note on this document:** the previous `HANDOFF.md` wasn't included in the
last upload (it had gone stale relative to the code), so this is a fresh
write focused on current state plus this round's changes — not a replay of
every historical round. If a fuller build history is needed later, it can
be reconstructed from the conversation this project has been built in.

---

## What this is

Live at **https://jysnalegarbes.github.io/** — a personal portfolio for
Jayson Alegarbes (UI/UX & Digital Designer, Philippines) with a portfolio-
website service built into it. Plain HTML/CSS/JS, no build step, no
framework. GSAP + ScrollTrigger + ScrollToPlugin + Lenis, all loaded from
CDN in `index.html`.

Section order: **Hero → About → Selected Works → My Approach → Portfolio
Website Services → Scroll-Scrub Storytelling → Final CTA → Footer**.

Real assets (images, video, favicons) are now in place — this was a
placeholder-only project for a long time; that's no longer the case.

## This round's changes

**Services section:**
- Cards now stagger in a "V" shape: Freelancers and Creatives sit 40px
  lower, Independent Professionals stays at the top. (`.service-card-
  freelancers`, `.service-card-creatives` get `margin-top: 40px`;
  `.service-card-independent` stays at `margin: 0`.) This replaced an
  equal-height 3-column row from an earlier round.
- The `✦` marks flanking "Services" in the eyebrow are now wrapped in
  `.eyebrow-mark` spans and colored green (`var(--green)`), independent of
  the "Services" text itself.
- The bottom-copy scroll-color-reveal (white → black per character) is
  now noticeably slower — the scroll range it's tied to went from roughly
  50% of a viewport-height to about 140%, and the per-character stagger
  increased slightly (`0.012` → `0.02`). See `servicesColorReveal()` in
  `script.js`.

**Storytelling section:**
- All three captions (Look like you / Make your work easy to understand /
  Create better opportunities) now appear **together**, right after the
  heading finishes its exit — previously they revealed one at a time at
  staggered scroll thresholds. This is a one-line change:
  `CAPTION_THRESHOLDS` in `script.js` went from `[0.5, 0.68, 0.86]` to
  `[0.55, 0.55, 0.55]`.

**CTA section:**
- Headline restructured to three explicit lines — "Let's create" /
  "something" / "worth showing off." — using `.headline-line` spans.
- The masked line-slide reveal (the same technique used on About/Services/
  Approach headlines, via `wrapLinesForReveal()`) is back on this
  headline. It had been reverted to a plain opacity fade in an earlier
  round for a side-by-side comparison; that plain fade is now removed
  from `cta()`'s timeline and `.cta-headline` is back in the shared
  `lineReveal()` module's target list.

**Footer section:**
- Social links are now text-only — the `<img>` icons were removed from
  each link in `.footer-socials-top` (HTML), and the now-unused icon-
  sizing CSS rule was removed too.
- The giant name (`.footer-name`) is now a flat `200px` instead of a
  responsive `clamp(64px, 12vw, 200px)`, and `overflow: hidden` was
  removed per explicit request ("don't allow masking"). Since the clamp
  was doing all the responsive scaling before, explicit fallback sizes
  were added at the existing breakpoints (120px at ≤1024px, 64px at
  ≤600px) so this doesn't overflow on smaller screens.

**Mobile:**
- Services bottom-copy headline size increased to `48px` at the ≤700px
  breakpoint (was `32px`).
- The stagger margins from the new "V" layout are reset to `0` at ≤700px
  (cards stack in one column there; the desktop offset doesn't apply).
- Added `!important` to the ≤700px `.services-grid { grid-template-
  columns: 1fr; }` rule as a defensive safety net — see gotcha below for
  why.

## Known gotcha — mobile Services grid, verify on a real phone

The person reported the Services cards showing side-by-side (2 columns)
on their phone instead of stacked. Investigated thoroughly:

- Confirmed via direct CSSOM inspection that the `@media (max-width:
  700px) { .services-grid { grid-template-columns: 1fr; } }` rule exists,
  is correctly written, and its media condition does match at a real
  phone's width (390px tested).
- Despite that, a local headless-browser test tool in this project's dev
  environment (a stripped-down `chrome-headless-shell` binary) rendered 3
  unequal columns instead of 1 — and **still did, even after adding
  `!important`** to that rule, which should be unbeatable in a normal
  cascade if the issue were really a specificity/ordering problem.
- That strongly suggests the failure is a limitation of that specific
  testing binary's CSS Grid handling under an emulated/small viewport,
  not a real bug in the site's code — but this was **not confirmed on an
  actual phone/real browser**, only reasoned from the evidence available.

**Action needed:** check the live site on a real phone after this update.
If it's still 2-column there, that's real signal this reasoning was wrong
and needs a fresh look — don't assume the `!important` fix is sufficient
without that confirmation. If it's correctly stacked, the `!important` can
likely be removed later as unneeded (though it's harmless to leave).

## Testing method used this round

Verified changes by actually running the page in a headless browser
(Playwright + a locally-vendored copy of GSAP/Lenis, since the CDN isn't
reachable from this sandboxed dev environment) rather than just reading
the code — checked real computed styles, element positions, and console
output after simulating scroll. This caught that the mobile grid issue
was worth flagging honestly rather than assuming the CSS fix was
sufficient. Recommend continuing this approach for future rounds rather
than trusting static code review alone, especially for anything
responsive/viewport-dependent.

## Still open / not addressed this round

- Whether the mobile Services-grid fix actually works on a real device
  (see gotcha above).
- The Works section slider — still using the original CSS/GSAP checkerboard
  slide, no WebGL/shader version built (that was floated as an option in
  an earlier round and never confirmed either way).
- Dead links: Works section's "View Project" and the Instagram icon both
  still point to `href="#"`.
- No additional pages beyond the homepage yet.
