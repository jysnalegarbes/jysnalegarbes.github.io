/*
  Page transitions (Figma 1:869 Work, 1:927 About, 1:986 In Progress,
  1:1044 Contact: "Intro Transition - Nav On Click")
  -------------------------------------------------------------------
  Leaving, on a nav link click:
    - black ink rises over the page through the About wipe (Codrops noise
      wipe, bottom → top, about-wipe.ts)
    - the italic word condenses out of goo (the About titles' goo-1)
    - the caps word, upside down as in Figma, rises out of a mask
    - then the browser goes to the page
  Arriving (BaseLayout's head script has put the same screen up before
  first paint):
    - the caps word tumbles the right way up through a goo pulse
    - both words melt back into goo as the ink lifts off the top of the
      screen, uncovering the page from the bottom up

  Nav links only (the logo goes home, which has its own loader; Work's
  cards morph into their case studies). Modified clicks, the current page
  and reduced motion keep plain links. Without WebGL the ink is a fade.
*/
import gsap from 'gsap';
import { mountAboutWipe, type AboutWipe } from './about-wipe';

export const TRANSITION_KEY = 'page-transition';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GOO_BLUR = 0.08; // em at the peak
const WIPE_IN = 0.9; // s
const WIPE_OUT = 1.1; // s

export function mountPageTransition() {
  const root = document.querySelector<HTMLElement>('[data-pt-root]');
  if (!root) return;
  const html = document.documentElement;
  const black = root.querySelector<HTMLElement>('[data-pt-black]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-pt-wipe]')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Goo filter for the words
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
  svg.innerHTML = `
    <filter id="pt-goo" x="-20%" y="-40%" width="140%" height="180%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="0" result="blur" />
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
      <feComposite in="SourceGraphic" in2="goo" operator="atop" />
    </filter>`;
  document.body.append(svg);
  const blurEl = svg.querySelector('feGaussianBlur')!;

  let wipe: AboutWipe | null | undefined;
  const getWipe = () => {
    if (wipe === undefined) wipe = mountAboutWipe(canvas);
    wipe?.resize(window.innerWidth, window.innerHeight);
    return wipe;
  };

  const screenOf = (key: string) => root.querySelector<HTMLElement>(`[data-pt-screen="${key}"]`);
  const parts = (screen: HTMLElement) => ({
    lead: screen.querySelector<HTMLElement>('[data-pt-lead]')!,
    mask: screen.querySelector<HTMLElement>('.pt__mask')!,
    word: screen.querySelector<HTMLElement>('[data-pt-word]')!,
  });

  // Blur (px) through the goo filter on the given elements
  const goo = (els: HTMLElement[], em: number) => {
    const state = { v: 0 };
    els.forEach((el) => (el.style.filter = 'url(#pt-goo)'));
    return {
      state,
      peak: GOO_BLUR * em,
      set: () => blurEl.setAttribute('stdDeviation', state.v.toFixed(2)),
      clear: () => els.forEach((el) => (el.style.filter = '')),
    };
  };

  function reset() {
    root!.classList.remove('is-on');
    html.classList.remove('pt-arriving');
    html.removeAttribute('data-pt');
    root!.querySelectorAll('.is-current').forEach((el) => el.classList.remove('is-current'));
    black.style.opacity = '';
    wipe?.draw(0);
  }

  /* ---------- Leaving ---------- */

  function leave(key: string, href: string) {
    const screen = screenOf(key);
    if (!screen) return false;
    const { lead, mask, word } = parts(screen);
    const em = parseFloat(getComputedStyle(screen).fontSize);
    screen.classList.add('is-current');
    root!.classList.add('is-on');
    mask.classList.add('is-masked');
    gsap.set(lead, { opacity: 0 });
    gsap.set(word, { '--rise': '-110%', '--flip': '180deg' }); // upside down: its foot is on top

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
    // The About ending's goo-1: condenses out of the blur while fading in
    const g = goo([lead], em);
    tl.fromTo(
      g.state,
      { v: g.peak },
      { v: 0, duration: 1, ease: 'power1.out', onStart: g.set, onUpdate: g.set, onComplete: g.clear },
      WIPE_IN * 0.55,
    );
    tl.to(lead, { opacity: 1, duration: 1, ease: 'none' }, WIPE_IN * 0.55);
    tl.to(word, { '--rise': '0%', duration: 0.9, ease: 'expo.out' }, WIPE_IN * 0.7);
    tl.add(() => mask.classList.remove('is-masked'));
    tl.to({}, { duration: 0.15 }); // a beat on the finished screen
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

  /* ---------- Arriving ---------- */

  function arrive() {
    const key = html.dataset.pt;
    const screen = key ? screenOf(key) : null;
    if (!html.classList.contains('pt-arriving') || !screen) return reset();
    const { lead, word } = parts(screen);
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

    const tl = gsap.timeline({ delay: 0.15, onComplete: reset });
    // Turn the right way up through a goo pulse
    const g = goo([lead, word], em);
    tl.to(word, { '--flip': '0deg', duration: 0.9, ease: 'power3.inOut' }, 0);
    tl.to(g.state, { v: g.peak * 0.6, duration: 0.45, ease: 'power1.in', onStart: g.set, onUpdate: g.set }, 0);
    tl.to(g.state, { v: 0, duration: 0.45, ease: 'power1.out', onUpdate: g.set }, 0.45);
    // ...then melt away as the ink lifts
    tl.to(g.state, { v: g.peak, duration: 0.6, ease: 'power1.in', onUpdate: g.set }, 1.05);
    tl.to([lead, word], { opacity: 0, duration: 0.6, ease: 'none', onComplete: g.clear }, 1.05);
    if (w) {
      const p = { v: 0.999 };
      tl.to(
        p,
        { v: 0, duration: WIPE_OUT, ease: 'power2.inOut', onStart: () => (black.style.opacity = '0'), onUpdate: () => w.draw(p.v) },
        1.1,
      );
    } else {
      tl.to(black, { opacity: 0, duration: WIPE_OUT * 0.7, ease: 'power1.inOut' }, 1.1);
    }
    tl.add(() => {
      canvas.style.transform = '';
      gsap.set([lead, word], { clearProps: 'opacity,--flip' });
    });
  }

  arrive();

  // Back / forward from the bfcache would show the leaving screen: clear it
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) reset();
  });
  window.addEventListener('resize', () => wipe?.resize(window.innerWidth, window.innerHeight));
}
