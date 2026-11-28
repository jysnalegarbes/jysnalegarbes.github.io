/*
  Case study title and meta (desktop)
  -----------------------------------
  1. Title morph. The big project name would otherwise sit behind the
     scrolling images, so as soon as the page scrolls it gives way to a
     small copy at the top of the left column, level with the last nav
     link. Scrolling back to the top plays it in reverse. Options
     (?title=, 2026-11-28, under review):
       travel  the big name shrinks and travels into the small one's spot
               while the two cross-fade through a goo filter (the original)
       swap    the big name melts away in place (ink goo), then the small
               one melts in at its spot
  2. Outro. As "Next project" scrolls in, the pinned title and meta leave,
     tied to scroll: it starts when the section's top enters the lower 15%
     of the screen and is done by the time the meta would unpin, so they
     never move while visible. Options (?outro=, under review):
       goo     row by row, top to bottom, each melts into ink blobs and
               fades (the site's ink goo, as in the nav hover)
       mask    line by line, each slides up out of its own line mask
  Settings: src/config/case-title.json, panel on /work/<slug>/?tweak.

  Fixed 2026-11-28: arriving through the Work morph, the intro animates
  the big title and then clears its styles. Scrolling during that intro
  left the big title back at full size over the small one. The morph now
  waits for the intro to finish ("case-intro-done", case-transition.ts).
*/
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import defaults from '../config/case-title.json';
import { makeInkGoo, motion } from './ink-goo';

gsap.registerPlugin(SplitText);

export type CaseTitleSettings = typeof defaults;
export const caseTitleDefaults = defaults;
export const caseTitleSettings: CaseTitleSettings = structuredClone(defaults);

const params = new URLSearchParams(location.search);
export const titleMode: 'travel' | 'swap' = params.get('title') === 'swap' ? 'swap' : 'travel';
export const outroMode: 'goo' | 'mask' = params.get('outro') === 'mask' ? 'mask' : 'goo';

const SVG_NS = 'http://www.w3.org/2000/svg';
const THRESHOLD = 8; // px of scroll before the title tucks away
const s = caseTitleSettings;

const gooStyle = (blur: number) => ({
  blur,
  contrast: motion.gooTitles.contrast,
  threshold: motion.gooTitles.threshold,
});

/** Resolves once the arrival intro (if any) has finished and cleaned up */
function introDone() {
  const html = document.documentElement;
  if (!html.classList.contains('case-arriving')) return Promise.resolve();
  return new Promise<void>((resolve) => {
    window.addEventListener('case-intro-done', () => resolve(), { once: true });
    setTimeout(resolve, 4000); // never hold the page hostage
  });
}

/* ---------- 1. Title morph ---------- */

export function mountTitleMorph(page: HTMLElement) {
  const title = page.querySelector<HTMLElement>('[data-case-title]');
  const big = title?.querySelector<HTMLElement>('.case__title-big');
  const mini = title?.querySelector<HTMLElement>('.case__title-mini');
  if (!title || !big || !mini) return null;

  const desktop = window.matchMedia('(min-width: 1024px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // travel: one goo filter on the whole title, pulsed while the copies cross
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
  svg.innerHTML = `
    <filter id="case-title-goo" x="-10%" y="-40%" width="120%" height="180%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="0" result="blur" />
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -6" result="goo" />
      <feComposite in="SourceGraphic" in2="goo" operator="atop" />
    </filter>`;
  document.body.append(svg);
  const blur = svg.querySelector('feGaussianBlur')!;

  // swap: each copy melts through its own ink goo
  const gooBig = makeInkGoo('case-big');
  const gooMini = makeInkGoo('case-mini');

  let tl: gsap.core.Timeline | null = null;
  let small = window.scrollY > THRESHOLD;
  let live = false;

  const clearFilters = () => {
    title.style.filter = '';
    big.style.filter = '';
    mini.style.filter = '';
  };

  function buildTravel(miniY: number, scale: number) {
    const { duration: d, blur: peak } = s.travel;
    const state = { blur: 0 };
    const ease = 'power3.inOut';
    return gsap
      .timeline({
        paused: true,
        onStart: () => (title!.style.filter = 'url(#case-title-goo)'),
        onUpdate: () => blur.setAttribute('stdDeviation', String(state.blur)),
        onComplete: () => (title!.style.filter = ''),
        onReverseComplete: () => (title!.style.filter = ''),
      })
      .to(state, { blur: peak, duration: d / 2, ease: 'none' }, 0)
      .to(state, { blur: 0, duration: d / 2, ease: 'none' }, d / 2)
      // The big name shrinks into the small one's spot and fades out...
      .fromTo(big, { y: 0, scale: 1 }, { y: miniY, scale, duration: d, ease }, 0)
      .fromTo(big, { opacity: 1 }, { opacity: 0, duration: d * 0.55, ease: 'none' }, d / 3)
      // ...while the small one grows out of the big one and fades in
      .fromTo(mini, { y: -miniY, scale: 1 / scale }, { y: 0, scale: 1, duration: d, ease }, 0)
      .fromTo(mini, { opacity: 0 }, { opacity: 1, duration: d * 0.55, ease: 'none' }, d / 3);
  }

  function buildSwap() {
    const { out, in: dIn, gap, blur: peak, lift } = s.swap;
    const emBig = parseFloat(getComputedStyle(big!).fontSize);
    const emMini = parseFloat(getComputedStyle(mini!).fontSize);
    const style = gooStyle(peak);
    const st = { a: 0, b: 1 }; // a: big's melt 0 → 1, b: mini's melt 1 → 0
    const apply = () => {
      gooBig.set(st.a * peak * emBig, emBig, style);
      gooMini.set(st.b * peak * emMini, emMini, style);
      big!.style.filter = st.a > 0.001 && st.a < 0.999 ? gooBig.filter : '';
      mini!.style.filter = st.b > 0.001 && st.b < 0.999 ? gooMini.filter : '';
    };
    const at = out + gap;
    return gsap
      .timeline({ paused: true, onUpdate: apply, onComplete: apply, onReverseComplete: apply })
      .fromTo(st, { a: 0 }, { a: 1, duration: out, ease: 'power2.in' }, 0)
      .fromTo(big, { opacity: 1, y: 0 }, { opacity: 0, y: -lift * emBig, duration: out, ease: 'power2.in' }, 0)
      .fromTo(st, { b: 1 }, { b: 0, duration: dIn, ease: 'power2.out' }, at)
      .fromTo(mini, { opacity: 0, y: lift * emMini }, { opacity: 1, y: 0, duration: dIn, ease: 'power2.out' }, at);
  }

  function build() {
    if (!live) return;
    const progress = tl ? tl.progress() : small ? 1 : 0;
    tl?.kill();
    tl = null;
    gsap.set([big, mini], { clearProps: 'transform,opacity' });
    clearFilters();
    if (!desktop.matches) return;

    // Small copy's box top level with the last nav label's (since the nav
    // moved up under "Menu", 2026-11-28; it was the first, which now sits
    // right under the availability badge)
    const navs = document.querySelectorAll('[data-header="main"] .menu__link .menu__text:not(.menu__text--alt)');
    const nav = navs[navs.length - 1];
    const t = title!.getBoundingClientRect();
    const miniY = nav ? nav.getBoundingClientRect().top - t.top : 0;
    title!.style.setProperty('--mini-y', `${miniY}px`);
    const scale = parseFloat(getComputedStyle(mini!).fontSize) / parseFloat(getComputedStyle(big!).fontSize);

    tl = titleMode === 'swap' ? buildSwap() : buildTravel(miniY, scale);
    tl.progress(progress);
    // A rebuild (fonts loaded, resize) mid-way carries on to where it was going
    const goal = small ? 1 : 0;
    if (progress !== goal) {
      if (reduced) tl.progress(goal);
      else {
        if (titleMode === 'travel') title!.style.filter = 'url(#case-title-goo)';
        small ? tl.play() : tl.reverse();
      }
    }
  }

  function update() {
    const next = window.scrollY > THRESHOLD;
    if (next === small) return;
    small = next;
    if (!tl) return;
    if (reduced) tl.progress(small ? 1 : 0);
    else {
      if (titleMode === 'travel') title!.style.filter = 'url(#case-title-goo)';
      small ? tl.play() : tl.reverse();
    }
  }

  introDone().then(() => {
    live = true;
    build();
    // Scrolled while the intro ran: tuck the title away now
    const want = window.scrollY > THRESHOLD;
    if (want !== small) update();
    document.fonts.ready.then(build);
    window.addEventListener('resize', build);
    desktop.addEventListener('change', build);
    window.addEventListener('scroll', update, { passive: true });
  });

  return { refresh: build };
}

/* ---------- 2. Outro ---------- */

export function mountPinnedOutro(page: HTMLElement) {
  const next = document.querySelector<HTMLElement>('.next');
  const title = page.querySelector<HTMLElement>('[data-case-title]');
  const meta = page.querySelector<HTMLElement>('[data-case-meta]');
  const mini = title?.querySelector<HTMLElement>('.case__title-mini');
  if (!next || !title || !meta || !mini) return null;

  const desktop = window.matchMedia('(min-width: 1024px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rows = [title, ...([...meta.children] as HTMLElement[])];

  let tl: gsap.core.Timeline | null = null;
  let shown = -1;
  let gooRows: { el: HTMLElement; goo: ReturnType<typeof makeInkGoo> }[] = [];
  let splits: SplitText[] = [];

  /** Spread n staggered pieces over a 0..1 timeline */
  const spread = (n: number, stagger: number) => {
    const st = Math.min(stagger, 0.8 / Math.max(1, n - 1));
    return { st, d: Math.max(0.2, 1 - st * (n - 1)) };
  };

  function buildGoo() {
    if (!gooRows.length) gooRows = rows.map((el) => ({ el, goo: makeInkGoo('case-outro') }));
    const { blur: peak, stagger, lift } = s.gooOutro;
    const style = gooStyle(peak);
    const { st, d } = spread(gooRows.length, stagger);
    const states = gooRows.map(() => ({ k: 0 }));
    const apply = () =>
      gooRows.forEach(({ el, goo }, i) => {
        // The title row melts at the small title's size (it's tucked away by now)
        const em = parseFloat(getComputedStyle(i === 0 ? mini! : el).fontSize);
        const k = states[i].k;
        goo.set(k * peak * em, em, style);
        el.style.filter = k > 0.001 && k < 0.999 ? goo.filter : '';
      });
    const t = gsap.timeline({ paused: true, onUpdate: apply });
    gooRows.forEach(({ el }, i) => {
      t.fromTo(states[i], { k: 0 }, { k: 1, duration: d, ease: 'power1.in' }, i * st);
      t.fromTo(el, { opacity: 1, y: 0 }, { opacity: 0, y: -lift, duration: d, ease: 'power2.in' }, i * st);
    });
    return t;
  }

  function buildMask() {
    const lines = splits.flatMap((sp) => sp.lines as HTMLElement[]);
    const { stagger, lift } = s.maskOutro;
    const { st, d } = spread(lines.length, stagger);
    const t = gsap.timeline({ paused: true });
    lines.forEach((line, i) => {
      t.fromTo(line, { yPercent: 0 }, { yPercent: -lift, duration: d, ease: 'power3.in' }, i * st);
    });
    return t;
  }

  function build() {
    const p = Math.max(0, shown);
    tl?.kill();
    tl = outroMode === 'mask' ? buildMask() : buildGoo();
    shown = -1;
    tl.progress(p);
    update();
  }

  const update = () => {
    if (!tl) return;
    let p = 0;
    if (desktop.matches) {
      const top = next.getBoundingClientRect().top;
      // Done when the section meets the pinned meta's bottom edge
      // (pin offset + height: independent of the outro's own drift)
      const end = parseFloat(getComputedStyle(meta).top) + meta.offsetHeight + 8;
      const start = Math.max(window.innerHeight * 0.85, end + 120);
      p = Math.min(1, Math.max(0, (start - top) / (start - end)));
    }
    if (reduced) p = p > 0.5 ? 1 : 0;
    if (p === shown) return;
    shown = p;
    tl.progress(p);
    const gone = p > 0.5 ? 'none' : '';
    title.style.pointerEvents = gone;
    meta.style.pointerEvents = gone;
  };

  let rebuild = 0;
  const queueBuild = () => {
    cancelAnimationFrame(rebuild);
    rebuild = requestAnimationFrame(build);
  };

  if (outroMode === 'mask') {
    // Line masks: the small title and each meta text, split into lines
    // (the Live link is split itself, so its underline leaves with its line)
    const targets = [
      mini,
      ...meta.querySelectorAll<HTMLElement>('dt, dd:not(.case__scope):not(:has(.case__live)), .case__scope > span, .case__live'),
    ];
    splits = targets.map((el) =>
      SplitText.create(el, { type: 'lines', mask: 'lines', autoSplit: true, onSplit: queueBuild }),
    );
  }

  introDone().then(() => {
    build();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    desktop.addEventListener('change', update);
  });

  return { refresh: build };
}
