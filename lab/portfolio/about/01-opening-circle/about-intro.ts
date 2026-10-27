/*
  About page opening (Figma 66:95). Scroll-scrubbed while the stage is pinned:
    rest   (1:142)  "hi! NICE TO MEET YOU", portrait hidden
    split  (1:190)  the line splits from the middle, portrait opens between
    expand (62:2)   text keeps leaving, portrait grows and recentres
    full            portrait fills the screen, text is off screen
  Once the portrait passes 3/4 of the screen width, black spreads from the
  centre as a circle. Inside it the portrait sits at Figma's "lighten, 5%":
  a 95% #141918 layer over the image (same result, since the image is never
  darker than the black). A solid black layer under the image, clipped the
  same, covers the area outside the image, so the screen ends as pure
  #141918 with the faint portrait.

  Text positions are relative to the portrait edges, in em, taken from the
  Figma frames, so desktop lands on the frames and mobile scales with its
  smaller heading. Scroll drives a target progress; the shown progress eases
  toward it time-based, so wheel notches don't step.
*/

// Scroll progress at which each Figma state is reached
const K_SPLIT = 0.16;
const K_EXPAND = 0.5;
const K_FULL = 0.8;
const K_DARK_END = 0.96;

// Gaps between the portrait and the text, in em (Figma 1:190 and 62:2)
const GAP_SPLIT = { left: 0.205, right: 0.36 };
const GAP_EXPAND = { left: 0.68, right: 0.6 };

// Portrait in Figma px: split 154×87 (height relative to the 110px heading),
// expand 1090×613 on desktop
const SPLIT_H_EM = 87 / 110;
const RATIO = 1090 / 613;
const EXPAND_W = 1090;

// The black starts once the portrait is this wide (share of the screen)
const DARK_FROM = 0.75;

const SMOOTHING = 0.09; // seconds

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

interface Rect {
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export function mountAboutIntro(section: HTMLElement) {
  const stage = section.querySelector<HTMLElement>('[data-about-stage]');
  const media = section.querySelector<HTMLElement>('[data-about-media]');
  const left = section.querySelector<HTMLElement>('[data-about-half="left"]');
  const right = section.querySelector<HTMLElement>('[data-about-half="right"]');
  const darks = [...section.querySelectorAll<HTMLElement>('[data-about-dark]')];
  if (!stage || !media || !left || !right) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = window.matchMedia('(min-width: 1024px)');

  section.classList.add('is-scrub');

  let W = 0;
  let H = 0;
  let em = 0;
  let restL = 0; // right edge of "hi! NICE TO" at rest
  let restR = 0; // left edge of "MEET YOU" at rest
  let states: Rect[] = [];
  let kDark = K_FULL;
  let maxR = 0;

  function measure() {
    left!.style.transform = '';
    right!.style.transform = '';
    const box = stage!.getBoundingClientRect();
    W = box.width;
    H = box.height;
    em = parseFloat(getComputedStyle(left!).fontSize);
    const l = left!.getBoundingClientRect();
    const r = right!.getBoundingClientRect();
    restL = l.right - box.left;
    restR = r.left - box.left;
    const textY = r.top + r.height / 2 - box.top;

    const splitH = SPLIT_H_EM * em;
    let expandW: number;
    if (desktop.matches) {
      expandW = EXPAND_W * (W / 1920);
    } else {
      const gutter = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')) || 24;
      expandW = W - 2 * gutter;
    }
    states = [
      { w: 0, h: 0, cx: W / 2, cy: textY },
      { w: splitH * RATIO, h: splitH, cx: W / 2, cy: textY },
      { w: expandW, h: expandW / RATIO, cx: W / 2, cy: H / 2 },
      { w: W, h: H, cx: W / 2, cy: H / 2 },
    ];

    // Progress at which the portrait reaches DARK_FROM of the screen width
    kDark = K_FULL;
    for (let i = 0; i <= 200; i++) {
      const p = lerp(K_EXPAND, K_FULL, i / 200);
      if (portrait(p).w >= W * DARK_FROM) {
        kDark = p;
        break;
      }
    }
    maxR = Math.hypot(W / 2, H / 2) + 2;
  }

  function portrait(p: number): Rect {
    let a: Rect, b: Rect, t: number;
    if (p <= K_SPLIT) [a, b, t] = [states[0], states[1], seg(p, 0, K_SPLIT)];
    else if (p <= K_EXPAND) [a, b, t] = [states[1], states[2], seg(p, K_SPLIT, K_EXPAND)];
    else [a, b, t] = [states[2], states[3], seg(p, K_EXPAND, K_FULL)];
    const e = ease(t);
    return {
      w: lerp(a.w, b.w, e),
      h: lerp(a.h, b.h, e),
      cx: lerp(a.cx, b.cx, e),
      cy: lerp(a.cy, b.cy, e),
    };
  }

  // Text offsets: at rest 0, afterwards held at a gap outside the portrait.
  // Interpolating the gap with the same easing keeps it glued to the edges.
  function textShift(p: number, img: Rect) {
    const g =
      p <= K_SPLIT
        ? GAP_SPLIT
        : {
            left: lerp(GAP_SPLIT.left, GAP_EXPAND.left, ease(seg(p, K_SPLIT, K_EXPAND))),
            right: lerp(GAP_SPLIT.right, GAP_EXPAND.right, ease(seg(p, K_SPLIT, K_EXPAND))),
          };
    const dl = img.cx - img.w / 2 - g.left * em - restL;
    const dr = img.cx + img.w / 2 + g.right * em - restR;
    if (p >= K_SPLIT) return { dl, dr };
    // Rest → split: the halves start touching (dx 0) and ease out to the gap
    const t = ease(seg(p, 0, K_SPLIT));
    const split = portrait(K_SPLIT);
    const sl = split.cx - split.w / 2 - GAP_SPLIT.left * em - restL;
    const sr = split.cx + split.w / 2 + GAP_SPLIT.right * em - restR;
    return { dl: sl * t, dr: sr * t };
  }

  function render(p: number) {
    const img = portrait(p);
    media!.style.width = `${img.w}px`;
    media!.style.height = `${img.h}px`;
    media!.style.transform = `translate3d(${img.cx - img.w / 2}px, ${img.cy - img.h / 2}px, 0)`;
    media!.style.visibility = img.w < 0.5 ? 'hidden' : 'visible';

    const { dl, dr } = textShift(p, img);
    left!.style.transform = `translate3d(${dl}px, 0, 0)`;
    right!.style.transform = `translate3d(${dr}px, 0, 0)`;

    const d = ease(seg(p, kDark, K_DARK_END));
    const clip = d <= 0 ? 'circle(0px at 50% 50%)' : d >= 1 ? 'none' : `circle(${d * maxR}px at 50% 50%)`;
    darks.forEach((el) => {
      el.style.clipPath = clip;
      el.style.visibility = d <= 0 ? 'hidden' : 'visible';
    });
  }

  function target() {
    const box = section.getBoundingClientRect();
    const run = box.height - H;
    const p = run > 0 ? clamp(-box.top / run) : 0;
    if (!reduced) return p;
    // Reduced motion: no scrubbed movement, jump between the Figma states
    const keys = [0, K_SPLIT, K_EXPAND, 1];
    return keys.reduce((best, k) => (Math.abs(k - p) < Math.abs(best - p) ? k : best), 0);
  }

  let shown = -1;
  let goal = 0;
  let raf = 0;
  let last = 0;

  function tick(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    shown += (goal - shown) * (1 - Math.exp(-dt / SMOOTHING));
    if (Math.abs(goal - shown) < 0.0005) shown = goal;
    render(shown);
    raf = shown === goal ? 0 : requestAnimationFrame(tick);
  }

  function onScroll() {
    goal = target();
    if (reduced || shown < 0) {
      shown = goal;
      render(shown);
      return;
    }
    if (!raf && goal !== shown) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }

  function onResize() {
    measure();
    goal = target();
    shown = goal;
    render(shown);
  }

  measure();
  onScroll();
  document.fonts?.ready.then(onResize);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  desktop.addEventListener('change', onResize);
}
