/*
  Page transitions (Figma 1:869 Work, 1:927 About, 1:986 In Progress,
  1:1044 Contact: "Intro Transition - Nav On Click")
  -------------------------------------------------------------------
  Leaving, on a nav link click:
    - black ink rises over the page through the About wipe (Codrops noise
      wipe, bottom → top, about-wipe.ts)
    - the italic word condenses out of the ink goo, the caps word (upside
      down, as in Figma) slides in through it: About's title goo, settings
      from about-motion.json gooTitles + inkEdge (ink-goo.ts)
    - the moment the words have formed, the browser goes to the page
  Arriving: BaseLayout's head script puts the same finished screen up
  before first paint, and a cross-document view transition keeps the old
  frame on screen until then, so the hand-over doesn't flash. Straight
  away the words melt back into goo (the caps word sliding on) while the
  ink lifts off the top, uncovering the page from the bottom up.

  The next page is prefetched when a nav link is hovered, focused or
  touched (and at the click at the latest), so the hand-over is short.

  Nav links only (the logo goes home, which has its own loader; Work's
  cards morph into their case studies). Modified clicks, the current page
  and reduced motion keep plain links. Without WebGL the ink is a fade.
*/
import gsap from 'gsap';
import { mountAboutWipe, type AboutWipe } from './about-wipe';
import { makeInkGoo, motion } from './ink-goo';

export const TRANSITION_KEY = 'page-transition';

const WIPE_IN = 0.9; // s
const WIPE_OUT = 1.1; // s
const LEAD_AT = 0.35; // s into the wipe the italic word starts
const WORD_AT = 0.45; // ...and the caps word

export function mountPageTransition() {
  const root = document.querySelector<HTMLElement>('[data-pt-root]');
  if (!root) return;
  const html = document.documentElement;
  const black = root.querySelector<HTMLElement>('[data-pt-black]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-pt-wipe]')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let leaving = false;

  let wipe: AboutWipe | null | undefined;
  const getWipe = () => {
    if (wipe === undefined) wipe = mountAboutWipe(canvas);
    wipe?.resize(window.innerWidth, window.innerHeight);
    return wipe;
  };

  const screenOf = (key: string) => root.querySelector<HTMLElement>(`[data-pt-screen="${key}"]`);

  // Each word through its own ink goo, blur in px
  function gooOn(el: HTMLElement, em: number) {
    const ink = makeInkGoo('pt-goo');
    const { duration, slide, ...style } = motion.gooTitles;
    const state = { v: 0 };
    el.style.filter = ink.filter;
    return {
      state,
      duration,
      slide: slide * em,
      peak: style.blur * em,
      set: () => ink.set(state.v, em, style),
      clear: () => (el.style.filter = ''),
    };
  }

  function reset() {
    root!.classList.remove('is-on');
    html.classList.remove('pt-arriving');
    html.removeAttribute('data-pt');
    root!.querySelectorAll('.is-current').forEach((el) => el.classList.remove('is-current'));
    root!.querySelectorAll<HTMLElement>('[data-pt-lead], [data-pt-word]').forEach((el) => {
      el.style.filter = '';
      gsap.set(el, { clearProps: 'opacity,--fx-x' });
    });
    black.style.opacity = '';
    canvas.style.transform = '';
    wipe?.draw(0);
    leaving = false;
  }

  /* ---------- Prefetch ---------- */

  const fetched = new Set<string>();
  function prefetch(href: string) {
    if (fetched.has(href)) return;
    fetched.add(href);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.append(link);
  }
  const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')];
  navLinks.forEach((a) =>
    ['pointerenter', 'focus', 'touchstart'].forEach((t) => a.addEventListener(t, () => prefetch(a.href), { passive: true })),
  );

  /* ---------- Leaving ---------- */

  function leave(key: string, href: string) {
    const screen = screenOf(key);
    if (!screen) return false;
    const lead = screen.querySelector<HTMLElement>('[data-pt-lead]')!;
    const word = screen.querySelector<HTMLElement>('[data-pt-word]')!;
    const em = parseFloat(getComputedStyle(screen).fontSize);
    prefetch(href);
    leaving = true;
    screen.classList.add('is-current');
    root!.classList.add('is-on');
    gsap.set([lead, word], { opacity: 0 });

    const go = () => {
      try {
        sessionStorage.setItem(TRANSITION_KEY, JSON.stringify({ key, path: new URL(href, location.href).pathname, t: Date.now() }));
      } catch {}
      location.href = href;
    };

    const tl = gsap.timeline({ onComplete: go });
    const w = getWipe();
    if (w) {
      const p = { v: 0 };
      tl.to(p, { v: 1, duration: WIPE_IN, ease: 'power2.inOut', onUpdate: () => w.draw(p.v) }, 0);
      tl.set(black, { opacity: 1 }, WIPE_IN);
    } else {
      tl.to(black, { opacity: 1, duration: WIPE_IN * 0.7, ease: 'power1.inOut' }, 0);
    }

    // Italic word: condenses out of the goo while fading in
    const a = gooOn(lead, em);
    tl.fromTo(
      a.state,
      { v: a.peak },
      { v: 0, duration: a.duration, ease: 'power1.out', onStart: a.set, onUpdate: a.set, onComplete: a.clear },
      LEAD_AT,
    );
    tl.to(lead, { opacity: 1, duration: a.duration, ease: 'none' }, LEAD_AT);

    // Caps word: the titles' goo-2, sliding in from the left through a blur pulse
    const b = gooOn(word, em);
    const half = b.duration / 2;
    tl.fromTo(b.state, { v: 0 }, { v: b.peak, duration: half, ease: 'none', onStart: b.set, onUpdate: b.set }, WORD_AT);
    tl.to(b.state, { v: 0, duration: half, ease: 'none', onUpdate: b.set, onComplete: b.clear }, WORD_AT + half);
    tl.fromTo(word, { '--fx-x': `${-b.slide}px` }, { '--fx-x': '0px', duration: b.duration, ease: 'power2.inOut' }, WORD_AT);
    tl.to(word, { opacity: 1, duration: b.duration, ease: 'none' }, WORD_AT);
    return true;
  }

  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest<HTMLAnchorElement>('[data-nav-link]');
    if (!link || reduced || e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target === '_blank') return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) return;
    const key = url.pathname.split('/').filter(Boolean)[0];
    if (key && leave(key, link.href)) e.preventDefault();
  });

  // Only our hand-over gets the view transition (it holds the inked frame)
  window.addEventListener('pageswap', (e) => {
    const vt = (e as Event & { viewTransition?: { skipTransition(): void } }).viewTransition;
    if (!leaving) vt?.skipTransition();
  });

  /* ---------- Arriving ---------- */

  function arrive() {
    const key = html.dataset.pt;
    const screen = key ? screenOf(key) : null;
    if (!html.classList.contains('pt-arriving') || !screen) return reset();
    const lead = screen.querySelector<HTMLElement>('[data-pt-lead]')!;
    const word = screen.querySelector<HTMLElement>('[data-pt-word]')!;
    const em = parseFloat(getComputedStyle(screen).fontSize);
    screen.classList.add('is-current');
    root!.classList.add('is-on');
    html.classList.remove('pt-arriving');
    html.removeAttribute('data-pt');

    // The black div holds the screen until the ink starts to lift; the
    // canvas, flipped and run back from (almost) full cover, lifts it off
    // the top, uncovering the page from the bottom up. (At exactly 1 the
    // wipe's edge has no width and draws nothing.)
    const w = getWipe();
    black.style.opacity = '1';
    canvas.style.transform = 'scaleY(-1)';
    w?.draw(0.999);

    // Straight on from where the leaving page stopped: both words melt back
    // into the goo (the caps word sliding on), the ink lifting as they go
    const tl = gsap.timeline({ onComplete: reset });
    const a = gooOn(lead, em);
    const b = gooOn(word, em);
    [a, b].forEach((g) => tl.to(g.state, { v: g.peak, duration: g.duration, ease: 'power1.in', onUpdate: g.set }, 0));
    tl.to([lead, word], { opacity: 0, duration: a.duration, ease: 'none' }, 0);
    tl.to(word, { '--fx-x': `${b.slide}px`, duration: b.duration, ease: 'power2.inOut' }, 0);
    if (w) {
      const p = { v: 0.999 };
      tl.to(
        p,
        { v: 0, duration: WIPE_OUT, ease: 'power2.inOut', onStart: () => (black.style.opacity = '0'), onUpdate: () => w.draw(p.v) },
        0.2,
      );
    } else {
      tl.to(black, { opacity: 0, duration: WIPE_OUT * 0.7, ease: 'power1.inOut' }, 0.2);
    }
  }

  arrive();

  // Back / forward from the bfcache would show the leaving screen: clear it
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) reset();
  });
  window.addEventListener('resize', () => wipe?.resize(window.innerWidth, window.innerHeight));
}
