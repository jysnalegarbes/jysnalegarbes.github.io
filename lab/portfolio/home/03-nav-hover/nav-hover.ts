/*
  Nav hover options (previews)
  ----------------------------
  The CSS in SiteHeader.astro animates each option between the default
  state and the "on" state (hover, keyboard focus, active page, or just
  clicked). This module:
    - picks the option: ?nav=1..4, remembered for the session so it holds
      while you click around; otherwise the default set in the markup
    - drives the goo filter pulse for option 1 (Codrops Gooey Text Hover)
    - marks a clicked link active straight away, so the on state holds
      through the page change instead of snapping back on mouseleave
*/
import gsap from 'gsap';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STORAGE_KEY = 'nav-hover';

function pickOption(menu: HTMLElement) {
  const fromUrl = Number(new URLSearchParams(location.search).get('nav'));
  try {
    if (fromUrl >= 1 && fromUrl <= 4) sessionStorage.setItem(STORAGE_KEY, String(fromUrl));
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) menu.dataset.navHover = stored;
  } catch {
    if (fromUrl >= 1 && fromUrl <= 4) menu.dataset.navHover = String(fromUrl);
  }
  return Number(menu.dataset.navHover);
}

/** Option 1: blur + alpha-threshold goo, pulsed while the layers cross. */
function mountGoo(links: HTMLAnchorElement[]) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
  document.body.append(svg);

  links.forEach((link, i) => {
    const label = link.querySelector<HTMLElement>('.menu__label');
    if (!label) return;

    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.id = `nav-goo-${i}`;
    filter.setAttribute('x', '-20%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '140%');
    filter.setAttribute('height', '200%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    blur.setAttribute('in', 'SourceGraphic');
    blur.setAttribute('stdDeviation', '0');
    blur.setAttribute('result', 'blur');
    const goo = document.createElementNS(SVG_NS, 'feColorMatrix');
    goo.setAttribute('in', 'blur');
    goo.setAttribute('type', 'matrix');
    goo.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -7');
    goo.setAttribute('result', 'goo');
    const composite = document.createElementNS(SVG_NS, 'feComposite');
    composite.setAttribute('in', 'SourceGraphic');
    composite.setAttribute('in2', 'goo');
    composite.setAttribute('operator', 'atop');
    filter.append(blur, goo, composite);
    svg.append(filter);

    // Peak blur scales with the type (Codrops used 1.5 at 10px)
    const peak = () => parseFloat(getComputedStyle(link).fontSize) * 0.15;
    const state = { blur: 0 };
    let tween: gsap.core.Timeline | null = null;

    const pulse = () => {
      if (link.classList.contains('is-active')) return;
      tween?.kill();
      label.style.filter = `url(#${filter.id})`;
      tween = gsap
        .timeline({
          onUpdate: () => blur.setAttribute('stdDeviation', String(state.blur)),
          onComplete: () => (label.style.filter = ''),
        })
        .to(state, { blur: peak(), duration: 0.4, ease: 'none' })
        .to(state, { blur: 0, duration: 0.4, ease: 'none' });
    };

    link.addEventListener('mouseenter', pulse);
    link.addEventListener('mouseleave', pulse);
    link.addEventListener('focus', pulse);
    link.addEventListener('blur', pulse);
  });
}

export function mountNavHover(menu: HTMLElement) {
  const option = pickOption(menu);
  const links = [...menu.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (option === 1 && !reducedMotion) mountGoo(links);

  links.forEach((link) =>
    link.addEventListener('click', () => {
      links.forEach((l) => l.classList.toggle('is-active', l === link));
    }),
  );
}
