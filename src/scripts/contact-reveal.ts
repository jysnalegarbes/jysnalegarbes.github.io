/*
  Contact name reveal (Figma 1:493, "Jayson Alegarbes" 1:552)
  -----------------------------------------------------------
  The area under "GOT a project IN MIND?" looks blank. Moving the cursor
  over it lays down the home page's ink brush (fluid-trail.ts, reveal
  mode), and wherever the ink flows the name shows in the brand green, then
  fades with it. Inspired by the Produx footer (produx.design); the earlier
  pixel-block version is in lab/portfolio/contact/01-name-reveal.

  The name stays in the page as the hidden .contact__name (aria-hidden, in
  the background colour), which also gives the canvas its type and
  position. Desktop fine pointers only; off under reduced motion.
  Settings: src/config/contact-reveal.json (same keys as the home fluid);
  /contact/?tweak opens the fluid panel for it.
*/
import { mountFluidTrail, type FluidTrail } from './fluid-trail';
import saved from '../config/contact-reveal.json';

export function mountContactReveal(section: HTMLElement): FluidTrail | null {
  const name = section.querySelector<HTMLElement>('[data-contact-name]');
  const hero = section.querySelector<HTMLElement>('[data-contact-hero]');
  const foot = section.querySelector<HTMLElement>('[data-contact-foot]');
  if (!name || !hero || !foot) return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const able = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
  if (!able.matches) return null;

  const canvas = document.createElement('canvas');
  canvas.className = 'contact__reveal';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', left: '0', pointerEvents: 'none' });
  section.append(canvas);

  // Off the ink the canvas paints the page background (--bg)
  const paper = () => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#e1e8e8';

  // The area: from under the heading to above the footer, full width
  function place() {
    const s = section.getBoundingClientRect();
    const top = hero!.getBoundingClientRect().bottom - s.top;
    const bottom = foot!.getBoundingClientRect().top - s.top;
    Object.assign(canvas.style, {
      top: `${top}px`,
      width: `${s.width}px`,
      height: `${Math.max(1, bottom - top)}px`,
    });
  }

  // The name in its own type, where .contact__name sits, at the canvas size
  function typeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const area = canvas.getBoundingClientRect();
    const box = name!.getBoundingClientRect();
    const style = getComputedStyle(name!);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(area.width * dpr));
    c.height = Math.max(1, Math.round(area.height * dpr));
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const text = (name!.textContent ?? '').trim().toUpperCase();
    const m = ctx.measureText(text);
    const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
    const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
    const cy = box.top - area.top + box.height / 2;
    ctx.fillText(text, box.left - area.left + box.width / 2, cy + (ascent - descent) / 2);
    return c;
  }

  place();
  const fluid = mountFluidTrail({
    canvas,
    tint: saved.tint,
    config: structuredClone(saved.config),
    reveal: { source: typeCanvas(), paper: paper() },
  });
  if (!fluid) {
    canvas.remove();
    return null;
  }
  fluid.renderNow();

  const refresh = () => {
    if (!able.matches) {
      canvas.style.display = 'none';
      return;
    }
    canvas.style.display = '';
    place();
    fluid.setReveal(typeCanvas(), paper());
  };
  window.addEventListener('resize', refresh);
  able.addEventListener('change', refresh);
  document.fonts?.ready.then(refresh);

  if (new URLSearchParams(location.search).has('tweak')) {
    import('./fluid-tweaks').then(({ mountFluidTweaks }) =>
      mountFluidTweaks(fluid, structuredClone(saved), {
        title: 'Name reveal · ink brush',
        saveUrl: import.meta.env.DEV ? '/__contact-reveal' : undefined,
      }),
    );
  }
  return fluid;
}
