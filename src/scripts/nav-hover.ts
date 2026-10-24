/*
  Nav hover
  ---------
  The CSS in SiteHeader.astro moves each link between the default state and
  the hover state (hover or keyboard focus, active link included),
  cross-fading the label into a copy, and pins a star left of the active
  link. This module:
    - pulses a gooey ink filter while the copies cross (after Codrops'
      Gooey Text Hover, demo 2), so the label melts into its new spot
    - marks a clicked link active straight away, so its star shows
      through the page change
*/
import gsap from 'gsap';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Blur + alpha-threshold goo, pulsed while the label copies cross. */
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
  const links = [...menu.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reducedMotion) mountGoo(links);

  links.forEach((link) =>
    link.addEventListener('click', () => {
      links.forEach((l) => l.classList.toggle('is-active', l === link));
    }),
  );
}
