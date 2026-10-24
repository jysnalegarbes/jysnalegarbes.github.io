/*
  Home page loader: ink burst
  ---------------------------
  The screen starts flooded with the trail's ink (page text shows inverted
  through it). The two footer lines condense in with a gooey ink filter
  while a counter tracks real work (fonts, the hero image, window load)
  with a minimum on-screen time. Then the fluid blows open from the centre,
  the title rises in, the portrait ripples, and the header condenses in
  with the same goo. The leftover ink fades like the trail.

  Skip with ?loader=0. Reduced motion skips it entirely (see index.astro).
*/
import gsap from 'gsap';
import type { FluidTrail } from './fluid-trail';
import type { PortraitFx } from './portrait-fx';

interface LoaderDeps {
  fluid: FluidTrail | null;
  portraitFx: PortraitFx | null;
  portrait: HTMLElement;
  heroImg: HTMLImageElement;
  /** The trail's own ink fade, restored after the loader's ink clears */
  baseDissipation: number;
}

const MIN_SECONDS = 1.8;
const SVG_NS = 'http://www.w3.org/2000/svg';
const root = document.documentElement;

const whenLoaded = () =>
  new Promise<void>((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', () => resolve(), { once: true });
  });

/** Counts tasks into a 0–100 counter that never outruns real progress. */
function trackProgress(tasks: Promise<unknown>[], onFrame: (shown: number) => void) {
  let done = 0;
  tasks.forEach((t) => t.finally(() => done++));
  const start = performance.now();
  let last = start;
  let shown = 0;

  return new Promise<void>((resolve) => {
    const tick = () => {
      const now = performance.now();
      const elapsed = (now - start) / 1000;
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;
      const target = Math.min(done / tasks.length, elapsed / MIN_SECONDS) * 100;
      // Time-based ease, so slow frame rates don't stall the counter
      shown += (target - shown) * (1 - Math.exp(-dt * 8));
      if (target >= 100 && shown > 99.5) shown = 100;
      onFrame(shown);
      if (shown >= 100) {
        gsap.ticker.remove(tick);
        resolve();
      }
    };
    gsap.ticker.add(tick);
  });
}

/*
  Gooey condense: each element starts as soft ink blobs (blur + alpha
  threshold) that pull together into sharp form. One filter per element so
  a stagger can run them independently; filters are removed afterwards
  (a filter forms a stacking context, which would trap .ink-exempt green).
*/
export function gooIn(elements: HTMLElement[], { stagger = 0.07, delay = 0 } = {}) {
  if (!elements.length) return gsap.timeline();
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
  document.body.append(svg);

  const blurs = elements.map((el, i) => {
    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.id = `ink-goo-${Math.random().toString(36).slice(2, 8)}-${i}`;
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    blur.setAttribute('in', 'SourceGraphic');
    blur.setAttribute('stdDeviation', '10');
    const goo = document.createElementNS(SVG_NS, 'feColorMatrix');
    goo.setAttribute('type', 'matrix');
    goo.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8');
    filter.append(blur, goo);
    svg.append(filter);
    el.style.filter = `url(#${filter.id})`;
    return blur;
  });

  gsap.set(elements, { opacity: 0 });
  const tl = gsap.timeline({
    delay,
    onComplete: () => {
      elements.forEach((el) => (el.style.filter = ''));
      svg.remove();
    },
  });
  elements.forEach((el, i) => {
    const at = i * stagger;
    tl.to(el, { opacity: 1, duration: 0.25, ease: 'power1.out' }, at);
    tl.fromTo(el, { scale: 0.92 }, { scale: 1, duration: 1.1, ease: 'elastic.out(1, 0.6)', clearProps: 'transform' }, at);
    tl.fromTo(blurs[i], { attr: { stdDeviation: 10 } }, { attr: { stdDeviation: 0 }, duration: 1.1, ease: 'power3.out' }, at);
  });
  return tl;
}

/** Visible header pieces, ordered outward from the logo. */
function headerLeaves() {
  const header = document.querySelector('.site-header');
  if (!header) return [];
  const leaves = ['.brand__mark', '.brand__wordmark', '.badge__lottie', '.badge__text', '.menu__title', '.menu__link']
    .flatMap((s) => [...header.querySelectorAll<HTMLElement>(s)])
    .filter((el) => el.getClientRects().length > 0);
  const cx = window.innerWidth / 2;
  const dist = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2);
  };
  return leaves.sort((a, b) => dist(a) - dist(b));
}

export async function runLoader({ fluid, portraitFx, portrait, heroImg, baseDissipation }: LoaderDeps) {
  const loader = document.querySelector<HTMLElement>('.loader');
  const count = loader?.querySelector<HTMLElement>('[data-loader-count]');
  const cover = loader?.querySelector<HTMLElement>('[data-loader-cover]');
  const lines = gsap.utils.toArray<HTMLElement>('.home__based, .home__love');

  if (!loader || !count || !fluid) {
    // No WebGL: skip straight to the landing
    loader?.remove();
    landing();
    return;
  }

  fluid.setInput(false);

  // Hand the static cover over to real ink in the same frame (identical colours)
  fluid.update({ densityDissipation: 0 });
  fluid.flood(4);
  fluid.renderNow();
  cover?.remove();
  root.classList.add('loader-inked');
  gooIn(lines, { stagger: 0.18, delay: 0.15 });

  await trackProgress([document.fonts.ready, heroImg.decode().catch(() => {}), whenLoaded()], (shown) => {
    count.textContent = String(Math.floor(shown)).padStart(2, '0');
  });

  // Burst: erase from the centre outward while outward kicks stir the edge
  const exit = gsap.timeline();
  exit.to(count, { yPercent: -110, duration: 0.6, ease: 'expo.in' }, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    fluid.splatAt(0.5 + Math.cos(a) * 0.04, 0.5 + Math.sin(a) * 0.04, {
      dx: Math.cos(a) * 2500,
      dy: Math.sin(a) * 2500,
      amount: 0,
      radius: 0.004,
    });
  }
  const burst = { r: 0 };
  let lastErase = 0;
  exit.to(
    burst,
    {
      r: 0.9,
      duration: 1.1,
      ease: 'power2.in',
      onStart: () => (lastErase = performance.now()),
      onUpdate: () => {
        // Erase rate per second, independent of frame rate
        const now = performance.now();
        const dt = Math.min((now - lastErase) / 1000, 0.1);
        lastErase = now;
        fluid.splatAt(0.5, 0.5, { amount: -60 * dt, radius: 0.0005 + burst.r * burst.r });
      },
      // Drop the erase's negative ink so it can't eat the trail afterwards
      onComplete: () => fluid.clampInk(),
    },
    0.2,
  );
  exit.add(() => fluid.update({ densityDissipation: 6 }), 1.1);
  exit.add(landing, 0.7);

  await exit.then();
  // Restore the trail's own fade once the loader's ink has cleared
  gsap.delayedCall(1.2, () => fluid.update({ densityDissipation: baseDissipation }));

  function landing() {
    const titleParts = gsap.utils.toArray<HTMLElement>('.home__title > span');
    const tl = gsap.timeline({ onComplete: finish });

    tl.fromTo(
      titleParts,
      { clipPath: 'inset(0% 0% 100% 0%)', y: 40 },
      { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12, clearProps: 'clipPath,transform' },
      0,
    );
    tl.fromTo(
      portrait,
      { clipPath: 'inset(100% 0% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.inOut', clearProps: 'clipPath' },
      0.05,
    );
    tl.add(() => portraitFx?.ripple(), 0.5);
    tl.fromTo('.home__copy', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 0.35);
    tl.add(() => {
      const leaves = headerLeaves();
      gooIn(leaves);
      root.classList.remove('header-pending');
    }, 0.55);

    root.classList.remove('is-loading');
  }

  function finish() {
    root.classList.remove('is-loading', 'loader-inked', 'header-pending');
    loader?.remove();
    fluid?.setInput(true);
  }
}
