/*
  Home page loader (previews: ?loader=1..4)
  -----------------------------------------
  Every option counts real work (fonts, the hero image, window load, plus
  the portrait frames for the flipbook) with a minimum on-screen time, then
  plays its exit and the shared landing: the title rises in, the footer
  fades up, the portrait ripples, and the ink trail switches on.

    1  Ink burst   The screen starts flooded with the trail's ink (page text
                   shows inverted through it); the fluid then blows open
                   from the centre and the leftovers fade like a trail.
    2  Ink wash    The same ink cover lifts in noise-edged blotches, like
                   ink lifting off wet paper; holes open as loading runs.
    3  Flipbook    No cover. The portrait flicks through the frames in
                   step with the counter, then lands on the hero.
    4  Curtain     A plain dark panel with the counter lifts away with a
                   dripping, liquid bottom edge. No WebGL.
*/
import gsap from 'gsap';
import type { FluidTrail } from './fluid-trail';
import type { PortraitFx } from './portrait-fx';

export type LoaderOption = 1 | 2 | 3 | 4;

interface LoaderDeps {
  option: LoaderOption;
  fluid: FluidTrail | null;
  portraitFx: PortraitFx | null;
  portrait: HTMLElement;
  frameImg: HTMLImageElement;
  heroImg: HTMLImageElement;
  frames: string[];
  /** The trail's own ink fade, restored after the loader's ink clears */
  baseDissipation: number;
  /** How the header (badge, logo, menu) enters; previews via ?intro=1..3 */
  headerIntro?: HeaderIntro;
}

export type HeaderIntro = 1 | 2 | 3;

/*
  Header intros. The header is hidden through loading (html.header-pending)
  and enters after the title starts rising. Animated per visible "leaf"
  (lottie layers, badge text, logo mark, wordmark, menu title, each link) so
  filters and clips never wrap an .ink-exempt piece in a new stacking
  context for long.

    1  Gooey      Each leaf condenses out of blurred ink blobs into sharp
                  form: an SVG blur + alpha-threshold ("goo") filter whose
                  blur eases to zero.
    2  Masked     Leaves rise through a clip, the same language as the
                  title, cascading out from the logo.
    3  Ink drops  A drop of the trail's ink lands on each leaf; it appears
                  inverted inside the drop, then the drop dissolves.
*/
const SVG_NS = 'http://www.w3.org/2000/svg';

function headerLeaves() {
  const header = document.querySelector('.site-header');
  if (!header) return [];
  const selectors = [
    '.brand__mark',
    '.brand__wordmark',
    '.badge__lottie',
    '.badge__text',
    '.menu__title',
    '.menu__link',
  ];
  return selectors
    .flatMap((s) => [...header.querySelectorAll<HTMLElement>(s)])
    .filter((el) => el.getClientRects().length > 0);
}

/** Order leaves by distance from the logo, so intros radiate outward. */
function fromCentre(leaves: HTMLElement[]) {
  const cx = window.innerWidth / 2;
  const centre = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2);
  };
  return [...leaves].sort((a, b) => centre(a) - centre(b));
}

export function introHeader(kind: HeaderIntro, fluid: FluidTrail | null, baseDissipation: number) {
  const leaves = fromCentre(headerLeaves());
  const reveal = () => root.classList.remove('header-pending');
  if (!leaves.length) return reveal();

  if (kind === 1) {
    // One filter per leaf so the stagger can run them independently
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
    document.body.append(svg);

    const blurs = leaves.map((el, i) => {
      const filter = document.createElementNS(SVG_NS, 'filter');
      filter.id = `ink-goo-${i}`;
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

    gsap.set(leaves, { opacity: 0 });
    reveal();
    const tl = gsap.timeline({
      onComplete: () => {
        leaves.forEach((el) => (el.style.filter = ''));
        svg.remove();
      },
    });
    leaves.forEach((el, i) => {
      const at = i * 0.07;
      tl.to(el, { opacity: 1, duration: 0.25, ease: 'power1.out' }, at);
      tl.fromTo(el, { scale: 0.92 }, { scale: 1, duration: 1.1, ease: 'elastic.out(1, 0.6)', clearProps: 'transform' }, at);
      tl.fromTo(blurs[i], { attr: { stdDeviation: 10 } }, { attr: { stdDeviation: 0 }, duration: 1.1, ease: 'power3.out' }, at);
    });
    return;
  }

  if (kind === 2) {
    gsap.set(leaves, { clipPath: 'inset(0% 0% 100% 0%)', yPercent: 60 });
    reveal();
    gsap.to(leaves, {
      clipPath: 'inset(0% 0% 0% 0%)',
      yPercent: 0,
      duration: 0.9,
      ease: 'expo.out',
      stagger: 0.07,
      clearProps: 'clipPath,transform',
    });
    return;
  }

  // 3: ink drops
  gsap.set(leaves, { opacity: 0 });
  reveal();
  if (fluid) fluid.update({ densityDissipation: 2.4 });
  leaves.forEach((el, i) => {
    gsap.delayedCall(i * 0.09, () => {
      const r = el.getBoundingClientRect();
      const x = (r.left + r.width / 2) / window.innerWidth;
      const y = 1 - (r.top + r.height / 2) / window.innerHeight;
      // Drop size follows the leaf's height, in splat-radius units
      const size = Math.max(r.height, 18) / window.innerHeight;
      fluid?.splatAt(x, y, {
        amount: 2.2,
        radius: size * size * 2.2,
        dx: (Math.random() - 0.5) * 300,
        dy: -200,
      });
      gsap.to(el, { opacity: 1, duration: 0.2, ease: 'power1.out' });
    });
  });
  gsap.delayedCall(leaves.length * 0.09 + 2, () => fluid?.update({ densityDissipation: baseDissipation }));
}

const MIN_SECONDS = 1.8;
const root = document.documentElement;

const loadImage = (src: string) =>
  new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });

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

export async function runLoader({
  option,
  fluid,
  portraitFx,
  portrait,
  frameImg,
  heroImg,
  frames,
  baseDissipation,
  headerIntro = 1,
}: LoaderDeps) {
  const loader = document.querySelector<HTMLElement>('[data-loader]');
  const count = loader?.querySelector<HTMLElement>('[data-loader-count]');
  const cover = loader?.querySelector<HTMLElement>('[data-loader-cover]');
  if (!loader || !count) return finish();

  fluid?.setInput(false);

  // Ink options need WebGL; without it they fall back to the curtain
  if ((option === 1 || option === 2) && !fluid) option = 4;
  root.dataset.loaderOption = String(option);

  // Hand the static cover over to real ink in the same frame (identical colours)
  if (option === 1 || option === 2) {
    fluid!.update({ densityDissipation: 0 });
    if (option === 1) fluid!.flood(4);
    else fluid!.setVeil(1);
    fluid!.renderNow();
    cover?.remove();
    root.classList.add('loader-inked');
  }

  const tasks: Promise<unknown>[] = [document.fonts.ready, heroImg.decode().catch(() => {}), whenLoaded()];
  if (option === 3) tasks.push(...frames.map(loadImage));

  await trackProgress(tasks, (shown) => {
    count.textContent = String(Math.floor(shown)).padStart(2, '0');
    if (option === 2) fluid!.setVeil(1 - (shown / 100) * 0.3);
    if (option === 3 && frames.length) {
      const i = Math.min(frames.length - 1, Math.floor((shown / 100) * frames.length));
      frameImg.hidden = shown >= 100;
      if (!frameImg.hidden && !frameImg.src.endsWith(frames[i])) frameImg.src = frames[i];
    }
  });

  const exit = gsap.timeline();
  exit.to(count, { yPercent: -110, duration: 0.6, ease: 'expo.in' }, 0);

  if (option === 1) {
    // Erase from the centre outward while outward kicks stir the edge
    const burst = { r: 0 };
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      fluid!.splatAt(0.5 + Math.cos(a) * 0.04, 0.5 + Math.sin(a) * 0.04, {
        dx: Math.cos(a) * 2500,
        dy: Math.sin(a) * 2500,
        amount: 0,
        radius: 0.004,
      });
    }
    let lastErase = 0;
    exit.to(
      burst,
      {
        r: 0.9,
        duration: 1.1,
        ease: 'power2.in',
        onStart: () => (lastErase = performance.now()),
        onComplete: () => fluid!.clampInk(),
        onUpdate: () => {
          // Erase rate per second, independent of frame rate
          const now = performance.now();
          const dt = Math.min((now - lastErase) / 1000, 0.1);
          lastErase = now;
          fluid!.splatAt(0.5, 0.5, { amount: -60 * dt, radius: 0.0005 + burst.r * burst.r });
        },
      },
      0.2,
    );
    exit.add(() => fluid!.update({ densityDissipation: 6 }), 1.1);
    exit.add(landing, 0.7);
  } else if (option === 2) {
    const v = { veil: 0.7 };
    exit.to(v, { veil: 0, duration: 1.8, ease: 'power2.inOut', onUpdate: () => fluid!.setVeil(v.veil) }, 0.1);
    exit.add(landing, 0.7);
  } else if (option === 3) {
    exit.add(landing, 0.15);
  } else {
    const curtain = loader.querySelector<HTMLElement>('[data-loader-cover]');
    const drip = loader.querySelector<HTMLElement>('[data-loader-drip]');
    exit
      .to(curtain, { yPercent: -100, duration: 1.2, ease: 'expo.inOut' }, 0.25)
      .fromTo(drip, { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: 'power2.in' }, 0.25)
      .to(drip, { scaleY: 0, duration: 0.7, ease: 'power3.out' }, 0.85);
    exit.add(landing, 0.85);
  }

  await exit.then();
  // Restore the trail's own fade once the loader's ink has cleared
  if (option === 1 || option === 2) {
    gsap.delayedCall(1.2, () => {
      fluid!.update({ densityDissipation: baseDissipation });
      fluid!.setVeil(0);
    });
  }

  function landing() {
    const titleParts = gsap.utils.toArray<HTMLElement>('.home__title > span');
    // The two footer lines stay up through loading; only the © line enters
    const foot = gsap.utils.toArray<HTMLElement>('.home__copy');
    const tl = gsap.timeline({ onComplete: finish });
    tl.add(() => introHeader(headerIntro, fluid, baseDissipation), 0.55);

    tl.fromTo(
      titleParts,
      { clipPath: 'inset(0% 0% 100% 0%)', y: 40 },
      { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12, clearProps: 'clipPath,transform' },
      0,
    );
    if (option !== 3) {
      tl.fromTo(
        portrait,
        { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.inOut', clearProps: 'clipPath' },
        0.05,
      );
    }
    tl.add(() => portraitFx?.ripple(), option === 3 ? 0 : 0.5);
    tl.fromTo(foot, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.08 }, 0.35);

    root.classList.remove('is-loading');
  }

  function finish() {
    root.classList.remove('is-loading', 'loader-inked', 'header-pending');
    delete root.dataset.loaderOption;
    loader?.remove();
    fluid?.setInput(true);
  }
}
