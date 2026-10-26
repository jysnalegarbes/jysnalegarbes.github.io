/*
  Work → case study transition
  ----------------------------
  Clicking the card in the main slot morphs it, in the Work page's WebGL
  layer, to exactly where the case study's cover will be, then navigates.

  - The target comes from a hidden "ghost" of the case study's opening
    (components/CaseIntro.astro, the same markup and CSS the case page
    uses), so the card always lands on the cover's real rect.
  - The page change is a cross-document view transition with no
    animation (global.css): the old page's last frame is held until the
    case page paints, and that first paint has the cover in the very same
    spot, so there is no seam. Browsers without it fall back to a normal
    load.
  - The case page knows it was arrived at this way (sessionStorage) and
    holds everything but the cover until playCaseIntro() brings it in.

  Four motions for review (preview switcher on the Work page):
    1 Glide   2 Liquid   3 Strips   4 Ink   (see work-gl.ts)
*/
import gsap from 'gsap';
import type { WorkGallery, Rect } from './work-gallery';
import { mountInkWipe } from './ink-wipe';
import { easeMorph, type CaseFx, type GlFrame, type WorkGl } from './work-gl';

export const CASE_FX: Record<CaseFx, string> = { 1: 'Glide', 2: 'Liquid', 3: 'Strips', 4: 'Ink' };
const ARRIVAL_KEY = 'case-arrival';
const DURATION: Record<CaseFx, number> = { 1: 1.1, 2: 1.3, 3: 1.35, 4: 1.4 };
const CASE_SIZES = '(min-width: 1024px) 55vw, 90vw';

interface OpenOptions {
  gallery: WorkGallery;
  gl: WorkGl;
  root: HTMLElement;
  index: number;
  link: HTMLAnchorElement;
  fx: CaseFx;
}

let opened = false;

/** Morph the main card into the case cover, then go to the case study. */
export function openCase({ gallery, gl, root, index, link, fx }: OpenOptions): boolean {
  const slug = new URL(link.href).pathname.split('/').filter(Boolean).pop();
  const ghost = document.querySelector<HTMLElement>(`[data-case-ghost="${slug}"]`);
  const from = gallery.frame()?.cards[index];
  if (!slug || !ghost || !from) return false;

  // Where the cover lands, in the stage's coordinates
  ghost.hidden = false;
  const c = ghost.querySelector('[data-case-cover]')!.getBoundingClientRect();
  ghost.hidden = true;
  const base = root.getBoundingClientRect();
  const to: Rect = { x: c.left - base.left, y: c.top - base.top, w: c.width, h: c.height };

  opened = true;
  gallery.lock();
  root.classList.add('is-opening');

  // Warm the case page and the exact cover file it will pick
  const prefetch = document.createElement('link');
  prefetch.rel = 'prefetch';
  prefetch.href = link.href;
  document.head.append(prefetch);
  const cardImg = gallery.images[index];
  const cover = new Image();
  cover.sizes = CASE_SIZES;
  cover.srcset = cardImg.srcset;
  cover.src = cardImg.src;
  const coverReady = cover.decode().catch(() => {});

  // Details and intro step aside
  gsap.to(root.querySelectorAll('[data-work-details], .work__intro'), { opacity: 0, duration: 0.35, ease: 'power2.out' });

  const ink = fx === 4 ? mountInkWipe('spread', { zIndex: 30 }) : null;
  // The reserved scrollbar gutter sits outside any fixed layer; ink it too
  if (ink) document.documentElement.style.background = 'var(--black)';
  const frame0 = gallery.frame()!;
  const state = { t: 0 };
  const duration = DURATION[fx];

  const draw = () => {
    const t = state.t;
    const fade = Math.max(0, 1 - t / 0.45);
    const drift = easeMorph(Math.min(1, t / 0.8));
    const frame: GlFrame = {
      time: performance.now() / 1000,
      // Glide lets the other cards ripple as they clear out
      velocity: fx === 1 ? Math.sin(Math.PI * Math.min(1, t * 1.6)) * 0.5 : 0,
      cards: frame0.cards.map((r, i) =>
        i === index ? r : { ...r, x: r.x - drift * (fx === 1 ? 160 : 60), alpha: fade },
      ),
      travel: { index, from, to, t, fx },
    };
    gl.render(frame);

    if (ink) {
      const e = easeMorph(t);
      const rect = {
        x: base.left + from.x + (to.x - from.x) * e,
        y: base.top + from.y + (to.y - from.y) * e,
        w: from.w + (to.w - from.w) * e,
        h: from.h + (to.h - from.h) * e,
      };
      ink.draw(rect, inkEase(Math.min(1, Math.max(0, (t - 0.08) / 0.92))));
    }
  };

  gsap.to(state, {
    t: 1,
    duration,
    ease: 'none',
    onUpdate: draw,
    onComplete: async () => {
      draw();
      // Don't hand over before the cover can paint, but never hang
      await Promise.race([coverReady, new Promise((r) => setTimeout(r, 1200))]);
      try {
        sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify({ slug, fx, t: Date.now() }));
      } catch {}
      location.assign(link.href);
    },
  });

  return true;
}

const inkEase = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/** Back/forward cache: a restored Work page would still show the morph's end */
export function resetOnRestore() {
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && opened) location.reload();
  });
}

/* ---------- Case study side ---------- */

/** Bring in the case study around the already-placed cover. */
export function playCaseIntro() {
  const html = document.documentElement;
  if (!html.classList.contains('case-arriving')) return;
  const fx = Number(html.dataset.caseFx) as CaseFx;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const title = document.querySelector<HTMLElement>('[data-case-title] > span');
  const meta = [...document.querySelectorAll<HTMLElement>('[data-case-meta] > *')];
  const rest = [...document.querySelectorAll<HTMLElement>('.case__media > :not([data-case-cover]), .next')];
  const done = () => {
    html.classList.remove('case-arriving', 'case-ink');
    delete html.dataset.caseFx;
    gsap.set([title, ...meta, ...rest], { clearProps: 'all' });
  };

  if (reduced) {
    done();
    html.classList.remove('case-ink-bg');
    return;
  }

  let delay = 0.05;

  if (fx === 4) {
    const cover = document.querySelector<HTMLElement>('[data-case-cover]');
    const ink = cover && mountInkWipe('recede', { zIndex: 30 });
    if (ink && cover) {
      const state = { p: 0 };
      const draw = () => {
        const r = cover.getBoundingClientRect();
        ink.draw({ x: r.left, y: r.top, w: r.width, h: r.height }, state.p);
      };
      draw();
      // The canvas now matches the solid pre-paint layer; drop the latter
      html.classList.remove('case-ink');
      gsap.to(state, {
        p: 1,
        duration: 1.3,
        ease: 'power2.inOut',
        onUpdate: draw,
        onComplete: () => {
          ink.destroy();
          html.classList.remove('case-ink-bg');
        },
      });
      delay = 0.3;
    } else {
      html.classList.remove('case-ink', 'case-ink-bg');
    }
  }

  const tl = gsap.timeline({ delay, onComplete: done });
  if (title) {
    tl.fromTo(
      title,
      { opacity: 1, clipPath: 'inset(0% 0% 100% 0%)', y: 40 },
      { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 1.1, ease: 'expo.out' },
      0,
    );
  }
  tl.fromTo(meta, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.07 }, 0.15);
  tl.fromTo(rest, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 0.4);
}
