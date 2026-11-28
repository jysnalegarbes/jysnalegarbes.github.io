/*
  Work details swap: the three versions that were on screen (2026-10-18)
  -----------------------------------------------------------------------
  How the main slot's number, year, name and category change to the next
  project. Recovered from the session: work-gallery.ts's showDetails() at
  each stage, reduced to one function per version so the demo can run them
  side by side.

    roll   first build: the old text slides up out of a clip, the new one
           rises in (yPercent ±105, expo), 40 ms stagger per field
    demo3  gooey cross-fade with a quarter-line vertical shift, 0.8 s,
           after Codrops' Gooey Text Hover demo 3 (MIT). On the site the
           new copy appeared on a second line (scoped CSS missed the
           runtime spans), which is what got it replaced
    demo1  gooey cross-fade in place, after Codrops' Gooey Text Hover
           demo 1 (MIT); Codrops runs 1.6 s, the site settled on 0.9 s so
           the text lands with the card. Chosen.

  Each field is a box (display: grid) whose `.swap-text` children share
  one cell (grid-area: 1 / 1), so copies cross in place.
*/
import gsap from 'gsap';

export type SwapVariant = 'roll' | 'demo3' | 'demo1';

const SVG_NS = 'http://www.w3.org/2000/svg';
let filters: SVGSVGElement | null = null;
let uid = 0;

/** One blur + alpha-threshold filter per field, pulsed during a swap */
function gooFilter() {
  if (!filters) {
    filters = document.createElementNS(SVG_NS, 'svg');
    filters.setAttribute('aria-hidden', 'true');
    Object.assign(filters.style, { position: 'absolute', width: '0', height: '0' });
    document.body.append(filters);
  }
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.id = `detail-goo-${uid++}`;
  filter.setAttribute('x', '-20%');
  filter.setAttribute('y', '-50%');
  filter.setAttribute('width', '140%');
  filter.setAttribute('height', '200%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
  blur.setAttribute('in', 'SourceGraphic');
  blur.setAttribute('stdDeviation', '0');
  blur.setAttribute('result', 'blur');
  const matrix = document.createElementNS(SVG_NS, 'feColorMatrix');
  matrix.setAttribute('in', 'blur');
  matrix.setAttribute('type', 'matrix');
  // Lower threshold than Codrops' 18 -8: mid-fade both copies sit near
  // 50% opacity, and Playfair hairlines / 14px strokes would vanish
  matrix.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -6');
  matrix.setAttribute('result', 'goo');
  const composite = document.createElementNS(SVG_NS, 'feComposite');
  composite.setAttribute('in', 'SourceGraphic');
  composite.setAttribute('in2', 'goo');
  composite.setAttribute('operator', 'atop');
  filter.append(blur, matrix, composite);
  filters.append(filter);
  return { id: filter.id, blur };
}

const fieldGoo = new WeakMap<HTMLElement, ReturnType<typeof gooFilter>>();
const running = new WeakMap<HTMLElement, gsap.core.Timeline>();

/**
  Swap `box`'s text to `text`. `dir` is 1 when stepping forward, -1 back
  (only roll and demo3 use it). `delay` staggers fields (roll only).
*/
export function swapText(box: HTMLElement, text: string, variant: SwapVariant, dir = 1, delay = 0) {
  const texts = [...box.querySelectorAll<HTMLElement>('.swap-text')];
  const old = texts[texts.length - 1];
  if (old?.textContent === text) return;
  running.get(box)?.progress(1);

  const next = document.createElement('span');
  next.className = 'swap-text';
  next.textContent = text;
  box.append(next);
  if (!old) return;

  if (variant === 'roll') {
    box.style.clipPath = 'inset(0 -40% 0 -40%)';
    const tl = gsap
      .timeline({ onComplete: () => old.remove() })
      .to(old, { yPercent: -105 * dir, duration: 0.5, delay, ease: 'expo.in' }, 0)
      .fromTo(next, { yPercent: 105 * dir }, { yPercent: 0, duration: 0.9, delay: delay + 0.12, ease: 'expo.out' }, 0);
    running.set(box, tl);
    return;
  }

  box.style.clipPath = '';
  let goo = fieldGoo.get(box);
  if (!goo) fieldGoo.set(box, (goo = gooFilter()));
  // Peak blur: ~0.6px on 14px text, ~1.6px on the 80px number
  const peak = 0.4 + parseFloat(getComputedStyle(box).fontSize) * 0.015;
  const half = variant === 'demo3' ? 0.4 : 0.45;
  const state = { blur: 0 };
  box.style.filter = `url(#${goo.id})`;
  const g = goo;
  const tl = gsap
    .timeline({
      onUpdate: () => g.blur.setAttribute('stdDeviation', String(state.blur)),
      onComplete: () => {
        box.style.filter = '';
        g.blur.setAttribute('stdDeviation', '0');
        old.remove();
      },
    })
    .to(state, { blur: peak, duration: half, ease: 'none' }, 0)
    .to(state, { blur: 0, duration: half, ease: 'none' }, half)
    .to(old, { opacity: 0, duration: half * 2, ease: 'none' }, 0)
    .fromTo(next, { opacity: 0 }, { opacity: 1, duration: half * 2, ease: 'none' }, 0);

  if (variant === 'demo3') {
    tl.to(old, { yPercent: -25 * dir, duration: 0.8, ease: 'power1.inOut' }, 0).fromTo(
      next,
      { yPercent: 25 * dir },
      { yPercent: 0, duration: 0.8, ease: 'power1.inOut' },
      0,
    );
  }
  running.set(box, tl);
}
