/*
  Case study title: big → small on scroll
  ---------------------------------------
  On desktop the big project name would otherwise sit behind the scrolling
  images. As soon as the page scrolls, it melts into a small copy at the
  top of the left column, level with the first nav link: the big name
  shrinks and travels into the small one's spot while the two cross-fade
  through a gooey blur + alpha-threshold filter (the same goo as the Work
  details). Scrolling back to the top plays it in reverse.
*/
import gsap from 'gsap';

const SVG_NS = 'http://www.w3.org/2000/svg';
const THRESHOLD = 8; // px of scroll before the title tucks away

export function mountTitleMorph(page: HTMLElement) {
  const title = page.querySelector<HTMLElement>('[data-case-title]');
  const big = title?.querySelector<HTMLElement>('.case__title-big');
  const mini = title?.querySelector<HTMLElement>('.case__title-mini');
  if (!title || !big || !mini) return;

  const desktop = window.matchMedia('(min-width: 1024px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Goo filter, pulsed while the two copies cross
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

  let tl: gsap.core.Timeline | null = null;
  let small = false;

  function build() {
    const progress = tl ? tl.progress() : small ? 1 : 0;
    tl?.kill();
    tl = null;
    gsap.set([big, mini], { clearProps: 'transform,opacity' });
    title!.style.filter = '';
    if (!desktop.matches) return;

    // Small copy's box top level with the first nav label's
    const nav = document.querySelector('[data-header="main"] .menu__link .menu__text');
    const t = title!.getBoundingClientRect();
    const miniY = nav ? nav.getBoundingClientRect().top - t.top : 0;
    title!.style.setProperty('--mini-y', `${miniY}px`);

    const scale = parseFloat(getComputedStyle(mini!).fontSize) / parseFloat(getComputedStyle(big!).fontSize);
    const state = { blur: 0 };
    const peak = 2.4;
    const ease = 'power3.inOut';

    tl = gsap
      .timeline({
        paused: true,
        onStart: () => (title!.style.filter = 'url(#case-title-goo)'),
        onUpdate: () => blur.setAttribute('stdDeviation', String(state.blur)),
        onComplete: () => (title!.style.filter = ''),
        onReverseComplete: () => (title!.style.filter = ''),
      })
      .to(state, { blur: peak, duration: 0.45, ease: 'none' }, 0)
      .to(state, { blur: 0, duration: 0.45, ease: 'none' }, 0.45)
      // The big name shrinks into the small one's spot and fades out...
      .fromTo(big, { y: 0, scale: 1 }, { y: miniY, scale, duration: 0.9, ease }, 0)
      .fromTo(big, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: 'none' }, 0.3)
      // ...while the small one grows out of the big one and fades in
      .fromTo(mini, { y: -miniY, scale: 1 / scale }, { y: 0, scale: 1, duration: 0.9, ease }, 0)
      .fromTo(mini, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'none' }, 0.3);

    tl.progress(progress);
    // Restore the filter state for a mid-way rebuild
    if (progress > 0 && progress < 1) title!.style.filter = 'url(#case-title-goo)';
  }

  function update() {
    const next = window.scrollY > THRESHOLD;
    if (next === small) return;
    small = next;
    if (!tl) return;
    if (reduced) tl.progress(small ? 1 : 0);
    else {
      title!.style.filter = 'url(#case-title-goo)';
      small ? tl.play() : tl.reverse();
    }
  }

  small = window.scrollY > THRESHOLD;
  build();
  document.fonts.ready.then(build);
  window.addEventListener('resize', build);
  desktop.addEventListener('change', build);
  window.addEventListener('scroll', update, { passive: true });
}

/*
  Outro: as the "Next project" section scrolls in, the pinned title and
  meta melt away: blur rises through the goo filter while they fade, so
  the letters break into ink blobs and vanish. It is tied to scroll: it
  starts when the section's top enters the lower 15% of the screen and is
  done by the time the meta would unpin (the section reaching its bottom
  edge), so they never move while visible, at any scroll speed. Scrolling
  back up brings them back. Desktop only (where they're pinned).
*/
export function mountPinnedOutro(page: HTMLElement) {
  const next = document.querySelector<HTMLElement>('.next');
  const title = page.querySelector<HTMLElement>('[data-case-title]');
  const meta = page.querySelector<HTMLElement>('[data-case-meta]');
  if (!next || !title || !meta) return;

  const desktop = window.matchMedia('(min-width: 1024px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
  svg.innerHTML = `
    <filter id="case-outro-goo" x="-10%" y="-40%" width="120%" height="180%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="0" result="blur" />
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -6" result="goo" />
      <feComposite in="SourceGraphic" in2="goo" operator="atop" />
    </filter>`;
  document.body.append(svg);
  const blur = svg.querySelector('feGaussianBlur')!;

  const targets = [title, meta];
  const state = { blur: 0 };
  const tl = gsap
    .timeline({ paused: true, onUpdate: () => blur.setAttribute('stdDeviation', String(state.blur)) })
    .to(state, { blur: 4, duration: 1, ease: 'power2.in' }, 0)
    .to(targets, { opacity: 0, duration: 0.9, ease: 'power2.in', stagger: 0.1 }, 0)
    .to(targets, { y: -14, duration: 0.9, ease: 'power2.in', stagger: 0.1 }, 0);

  let shown = -1;
  const update = () => {
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
    // The filter only while melting; pointer events off once gone
    const filter = p > 0 && p < 1 ? 'url(#case-outro-goo)' : '';
    targets.forEach((el) => {
      el.style.filter = filter;
      el.style.pointerEvents = p > 0.5 ? 'none' : '';
    });
  };

  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  desktop.addEventListener('change', update);
}
