/*
  Page transitions into a case study
  ----------------------------------
  Opening a case study morphs the clicked image (liquid-morph.ts) to
  exactly where the case study's cover will be, then navigates:

    openCase       Work page: the card in the main slot, drawn in the
                   gallery's own WebGL layer
    mountNextCase  case study page: the "Next project" thumbnail, drawn in
                   a full-screen overlay while the page fades out around it

  - The target comes from a hidden "ghost" of the case study's opening
    (components/CaseIntro.astro, the same markup and CSS the case page
    uses), so the image always lands on the cover's real rect.
  - The page change is a cross-document view transition with no
    animation (global.css): the old page's last frame is held until the
    case page paints, and that first paint has the cover in the very same
    spot, so there is no seam. Browsers without it do a normal load.
  - The case page knows it was arrived at this way (sessionStorage) and
    holds everything but the cover until playCaseIntro() brings it in.
*/
import gsap from 'gsap';
import { RETURN_KEY, type WorkGallery, type Rect } from './work-gallery';
import type { GlFrame, WorkGl } from './work-gl';
import { MORPH_DURATION, mountMorphOverlay } from './liquid-morph';

const ARRIVAL_KEY = 'case-arrival';

let opened = false;

const slugOf = (href: string) => new URL(href, location.href).pathname.split('/').filter(Boolean).pop() ?? '';

/**
  Where the case cover lands, in viewport coordinates of the new page
  (which opens scrolled to the top), plus a preload of the exact file the
  page will pick for it.
*/
function measureLanding(slug: string) {
  const ghost = document.querySelector<HTMLElement>(`[data-case-ghost="${slug}"]`);
  if (!ghost) return null;
  ghost.hidden = false;
  const c = ghost.querySelector('[data-case-cover]')!.getBoundingClientRect();
  const ghostImg = ghost.querySelector('img');
  ghost.hidden = true;
  const to: Rect = { x: c.left + window.scrollX, y: c.top + window.scrollY, w: c.width, h: c.height };

  let ready: Promise<unknown> = Promise.resolve();
  if (ghostImg) {
    const cover = new Image();
    cover.sizes = ghostImg.sizes;
    cover.srcset = ghostImg.srcset;
    cover.src = ghostImg.src;
    ready = cover.decode().catch(() => {});
  }
  return { to, ready };
}

function prefetch(href: string) {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.append(link);
}

/** Hand over to the case page once its cover can paint (never hang) */
async function handOver(href: string, ready: Promise<unknown>) {
  await Promise.race([ready, new Promise((r) => setTimeout(r, 1200))]);
  try {
    sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify({ slug: slugOf(href), t: Date.now() }));
  } catch {}
  location.assign(href);
}

/** Back/forward cache: a restored page would still show the morph's end */
export function resetOnRestore() {
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted || !opened) return;
    // Work: the reload should still land on the project that was opened
    try {
      sessionStorage.setItem(RETURN_KEY, '1');
    } catch {}
    location.reload();
  });
}

/* ---------- Work page ---------- */

interface OpenOptions {
  gallery: WorkGallery;
  gl: WorkGl;
  root: HTMLElement;
  index: number;
  link: HTMLAnchorElement;
}

/** Morph the main card into the case cover, then go to the case study. */
export function openCase({ gallery, gl, root, index, link }: OpenOptions): boolean {
  const landing = measureLanding(slugOf(link.href));
  const from = gallery.frame()?.cards[index];
  if (!landing || !from) return false;

  // The gallery's canvas is laid out from the stage's origin
  const base = root.getBoundingClientRect();
  const to: Rect = { ...landing.to, x: landing.to.x - base.left, y: landing.to.y - base.top };

  opened = true;
  gallery.lock();
  // Back from the case study should reopen Work on this project
  try {
    sessionStorage.setItem(RETURN_KEY, '1');
  } catch {}
  root.classList.add('is-opening');
  prefetch(link.href);

  // Details and intro step aside
  gsap.to(root.querySelectorAll('[data-work-details], .work__intro'), { opacity: 0, duration: 0.35, ease: 'power2.out' });

  const frame0 = gallery.frame()!;
  const state = { t: 0 };
  const draw = () => {
    const t = state.t;
    const fade = Math.max(0, 1 - t / 0.45);
    const drift = Math.min(1, t / 0.8);
    const frame: GlFrame = {
      time: performance.now() / 1000,
      velocity: 0,
      cards: frame0.cards.map((r, i) => (i === index ? r : { ...r, x: r.x - drift * drift * 60, alpha: fade })),
      travel: { index, from, to, t },
    };
    gl.render(frame);
  };

  gsap.to(state, {
    t: 1,
    duration: MORPH_DURATION,
    ease: 'none',
    onUpdate: draw,
    onComplete: () => {
      draw();
      handOver(link.href, landing.ready);
    },
  });

  return true;
}

/* ---------- Case study page: next project ---------- */

/** Wire the "Next project" link to morph its thumbnail into the next cover. */
export function mountNextCase() {
  const link = document.querySelector<HTMLAnchorElement>('[data-next-link]');
  const media = link?.querySelector<HTMLElement>('[data-next-media]');
  const img = media?.querySelector('img');
  if (!link || !media || !img) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  link.addEventListener('pointerenter', () => prefetch(link.href), { once: true });

  let busy = false;
  link.addEventListener('click', async (e) => {
    if (busy || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const landing = measureLanding(slugOf(link.href));
    if (!landing) return;
    e.preventDefault();
    busy = true;

    const overlay = await mountMorphOverlay(img);
    if (!overlay) {
      location.assign(link.href);
      return;
    }

    opened = true;
    const html = document.documentElement;
    // Hold the page still (the scrollbar gutter is reserved, so no shift)
    html.style.overflow = 'hidden';

    const r = media.getBoundingClientRect();
    const from: Rect = { x: r.left, y: r.top, w: r.width, h: r.height };
    const to = landing.to; // the new page opens at the top: viewport = page coords
    const state = { t: 0 };
    const draw = () => overlay.draw(from, to, state.t);
    draw();
    media.style.visibility = 'hidden';

    // The page dissolves around the image; the fixed header stays, exactly
    // where the next page paints it
    gsap.to('main', { opacity: 0, duration: 0.5, ease: 'power2.out' });

    gsap.to(state, {
      t: 1,
      duration: MORPH_DURATION,
      ease: 'none',
      onUpdate: draw,
      onComplete: () => {
        draw();
        handOver(link.href, landing.ready);
      },
    });
  });
}

/* ---------- Case study page: arrival ---------- */

/** Bring in the case study around the already-placed cover. */
export function playCaseIntro() {
  const html = document.documentElement;
  if (!html.classList.contains('case-arriving')) return;

  // The page's own case study (a next-case ghost sits deeper in main)
  const page = document.querySelector<HTMLElement>('main > .case');
  if (!page) return;
  const title = page.querySelector<HTMLElement>('.case__title-big');
  const meta = [...page.querySelectorAll<HTMLElement>('[data-case-meta] > *')];
  const rest = [
    ...page.querySelectorAll<HTMLElement>('.case__media > :not([data-case-cover])'),
    ...document.querySelectorAll<HTMLElement>('.next'),
  ];
  const done = () => {
    html.classList.remove('case-arriving');
    gsap.set([title, ...meta, ...rest], { clearProps: 'all' });
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    done();
    return;
  }

  const tl = gsap.timeline({ delay: 0.05, onComplete: done });
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
