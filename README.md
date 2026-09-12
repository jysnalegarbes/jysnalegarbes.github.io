# Jayson Alegarbes — Portfolio (HTML / CSS / JS)

No build step. Open `index.html` directly, or serve the folder with VS
Code Live Server / `npx serve .`. `assets/README-assets.txt` lists every
exact filename/path the code expects.

This project includes `HANDOFF.md` / `HANDOFF.pdf` — the full project
handoff document covering build history, design decisions, and known
gotchas. Keep it updated when the project changes.

## What this round actually is

Not new work — a deliberate, partial rollback for comparison, pulled from
the 08-30-26 handoff zip you sent. Worth knowing exactly what changed:

**Storytelling's pin mechanic** — restructured to the older double-wrapper
setup you called "the parallax effect" (it's not technically parallax,
just a different way of wiring the same pin — see the handoff doc if you
want the real explanation). Outer section is `300vh` again, wrapping a
`100vh` inner element that actually gets pinned, instead of pinning the
section directly. Everything else in this section — the video, the
heading, the three captions and their behavior — is exactly what it was.
I verified the pin genuinely engages and releases correctly with a real
browser test, not just that nothing throws.

**CTA** — copied verbatim from the old file, which means this is a real
content rollback, not just structural: headline back to "Let's create
something *intentional.*", sub-copy back to "Open to freelance projects,
collaborations, and new opportunities.", the pill button back to fully
rounded (40px radius instead of 8px), and the headline's reveal back to a
plain fade instead of the masked line-slide.

**Footer** — checked byte-for-byte rather than assumed unchanged. HTML and
JS turned out identical already. Two CSS values didn't: the giant name's
size and the footer's padding/height were both bumped up in a later round
for better proportion — both reverted to the old, smaller values now.

**If you look at this and want to go back to the current (non-reverted)
version** for any of these, it's a quick fix — just say which piece, I
have exactly what to restore.

## Notes

- GSAP/ScrollTrigger/ScrollToPlugin/Lenis still load from CDN in
  `index.html` (gsap 3.12.5, lenis 1.1.13) — no npm, no build step.
- Still waiting on your call on the Works section slider (literal WebGL
  vs. a GSAP-only equivalent) — untouched this round.
