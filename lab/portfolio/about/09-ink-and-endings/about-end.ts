/*
  About ending: what happens after "beyond DESIGN". Three options on review
  (?end=1|2|3), the markup for each is in about.astro under [data-end]:

    1  Last word   one more screen inside the pinned story: "what's NEXT"
                   comes in like the other headings (with its green drop),
                   then two big links to Work and Contact. The page ends there.
    2  Curtain     the story unpins and scrolls away like a curtain over a
                   light closing screen (a contact call and links), whose
                   content rises out of the dark edge with a slight lag.
    3  Next page   a last screen, "next WORK", with a line that fills as you
                   keep scrolling; at the very end ink surges up from the
                   bottom and the Work page opens. Also a plain link.

  pick() keeps the chosen variant and removes the others before the
  sections engine reads the page; mount() wires its behaviour.
*/
import type { AboutInk } from './about-ink';

export type EndVariant = 1 | 2 | 3;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/** Keep one variant's markup; 1 and 3 live in the story, so beyond DESIGN exits */
export function pickAboutEnd(variant: EndVariant) {
  document.querySelectorAll<HTMLElement>('[data-end]').forEach((el) => {
    if (el.dataset.end !== String(variant)) el.remove();
  });
  if (variant !== 2) document.querySelector('[data-about-section][data-no-exit]:not([data-end])')?.removeAttribute('data-no-exit');
  document.documentElement.dataset.aboutEnd = String(variant);
}

export function mountAboutEnd(variant: EndVariant, ink: AboutInk | null, lastStart: () => number) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (variant === 2) {
    const end = document.querySelector<HTMLElement>('[data-end="2"]');
    const inner = end?.querySelector<HTMLElement>('[data-end-inner]');
    if (!end || !inner) return;
    let raf = 0;
    const render = () => {
      raf = 0;
      const top = end.getBoundingClientRect().top;
      const H = window.innerHeight;
      // 0 as the curtain starts lifting, 1 once it's gone
      const p = clamp(1 - top / H);
      if (!reduced) inner.style.transform = `translate3d(0, ${((1 - p) * -35).toFixed(2)}%, 0)`;
      inner.style.opacity = String(reduced ? 1 : clamp(p * 1.4 - 0.2));
      // Light-page colours (the blended ones, which read on both) once it's
      // half up, so the folio at the bottom never sits light on light
      if (top < H * 0.5) document.body.classList.remove('is-header-dark');
      else if (top < H) document.body.classList.add('is-header-dark');
    };
    const onScroll = () => (raf ||= requestAnimationFrame(render));
    render();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return;
  }

  if (variant === 3) {
    const end = document.querySelector<HTMLElement>('[data-end="3"]');
    const bar = end?.querySelector<HTMLElement>('[data-end-bar]');
    const link = end?.querySelector<HTMLAnchorElement>('a[href]');
    if (!end || !bar || !link) return;
    let fired = false;
    let lastY = window.scrollY;

    const go = () => {
      if (fired) return;
      fired = true;
      end.classList.add('is-leaving');
      if (reduced || !ink) {
        location.href = link.href;
        return;
      }
      ink.surge(0.7, 0.8);
      setTimeout(() => (location.href = link.href), 750);
    };

    const render = () => {
      const y = window.scrollY;
      const down = y > lastY;
      lastY = y;
      const start = lastStart() + window.innerHeight * 0.35;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = clamp((y - start) / Math.max(1, max - start));
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
      // Only on the way down, and never under reduced motion (link only)
      if (p >= 0.999 && down && !reduced) go();
    };
    render();
    window.addEventListener('scroll', render, { passive: true });
    link.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      go();
    });
    // Back from Work (page restored from the cache): reset
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      fired = false;
      end.classList.remove('is-leaving');
    });
  }
}
