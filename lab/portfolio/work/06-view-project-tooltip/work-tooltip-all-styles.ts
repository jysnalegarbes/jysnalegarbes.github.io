/*
  Work "View Project" tooltip
  ---------------------------
  Over the left-most card (the main slot, the one that opens on click) a
  "View Project" tooltip follows the cursor. The cards move under a still
  cursor too, so what's under it is checked every frame while the pointer
  is on the page. Hidden while dragging and once you press.

  Styles on test (style, ?ttfx=1..3):
    1 Pill         a small black pill with a green dot, "VIEW PROJECT" and
                   an arrow; springs in, trails the cursor
    2 Ink Disc     a black disc that takes the cursor's place, "view
                   PROJECT" inside; grows in through the site's ink goo
                   (ink-goo.ts) and drains back out
    3 Split Label  no background: "(View Project) →" beside the cursor, its
                   letters rising in one after another; it inverts over the
                   photo (difference blend), so it reads on light and dark
  Settings: src/config/work-tooltip.json; /work/?tweak opens a panel.
  Fine pointers only; off under reduced motion.
*/
import gsap from 'gsap';
import { makeInkGoo, motion } from './ink-goo';
import defaults from '../config/work-tooltip.json';

export type WorkTooltipSettings = typeof defaults;
export const TOOLTIP_STYLES = { Pill: 1, 'Ink Disc': 2, 'Split Label': 3 };

export interface WorkTooltip {
  settings: WorkTooltipSettings;
  refresh(): void;
}

const LABEL = 'View Project';

export function mountWorkTooltip(root: HTMLElement): WorkTooltip | null {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  const settings: WorkTooltipSettings = structuredClone(defaults);
  const params = new URLSearchParams(location.search);
  const pick = Number(params.get('ttfx'));
  if (Object.values(TOOLTIP_STYLES).includes(pick)) settings.style = pick;

  const tip = document.createElement('div');
  tip.className = 'work-tip';
  tip.setAttribute('aria-hidden', 'true');
  document.body.append(tip);

  const goo = makeInkGoo('work-tip');
  const gooState = { blur: 0 };
  let chars: HTMLElement[] = [];

  function build() {
    tip.dataset.style = String(settings.style);
    tip.style.setProperty('--tip-size', String(settings.size));
    tip.style.filter = '';
    if (settings.style === 1) {
      tip.innerHTML = `<span class="work-tip__dot"></span><span class="work-tip__text">${LABEL}</span><span class="work-tip__arrow">↗</span>`;
    } else if (settings.style === 2) {
      tip.innerHTML = `<span class="work-tip__disc"></span><span class="work-tip__text"><span class="serif-italic">view</span> PROJECT</span>`;
    } else {
      const letters = `(${LABEL})`
        .split('')
        .map((c) => `<span class="work-tip__char">${c === ' ' ? '&nbsp;' : c}</span>`)
        .join('');
      tip.innerHTML = `<span class="work-tip__text">${letters}</span><span class="work-tip__arrow">→</span>`;
    }
    chars = [...tip.querySelectorAll<HTMLElement>('.work-tip__char, .work-tip__arrow')];
    gsap.killTweensOf([tip, ...chars, gooState]);
    gsap.set(tip, { autoAlpha: 0, scale: 1 });
    shown = false;
    root.classList.toggle('has-tip-disc', settings.style === 2);
  }

  /* ---------- In / out ---------- */

  let shown = false;

  function show() {
    if (shown) return;
    shown = true;
    gsap.killTweensOf([tip, ...chars, gooState]);
    root.classList.add('is-tip');
    if (settings.style === 1) {
      gsap.fromTo(tip, { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2.2)' });
    } else if (settings.style === 2) {
      const em = tip.offsetWidth / 6 || 16;
      const peak = { ...motion.gooTitles, blur: motion.gooTitles.blur * 2.5 };
      tip.style.filter = goo.filter;
      gsap.fromTo(tip, { autoAlpha: 1, scale: 0.15 }, { scale: 1, duration: 0.55, ease: 'expo.out' });
      gsap.fromTo(
        gooState,
        { blur: peak.blur * em },
        {
          blur: 0,
          duration: 0.6,
          ease: 'power2.out',
          onUpdate: () => goo.set(gooState.blur, em, peak),
          onComplete: () => (tip.style.filter = ''),
        },
      );
    } else {
      gsap.set(tip, { autoAlpha: 1 });
      gsap.fromTo(chars, { yPercent: 110 }, { yPercent: 0, duration: 0.5, ease: 'expo.out', stagger: 0.018 });
    }
  }

  function hide(fast = false) {
    if (!shown) return;
    shown = false;
    gsap.killTweensOf([tip, ...chars, gooState]);
    root.classList.remove('is-tip');
    const d = fast ? 0.12 : 1;
    if (settings.style === 1) {
      gsap.to(tip, { autoAlpha: 0, scale: 0.6, duration: 0.2 * d, ease: 'power2.in' });
    } else if (settings.style === 2) {
      const em = tip.offsetWidth / 6 || 16;
      const peak = { ...motion.gooTitles, blur: motion.gooTitles.blur * 2.5 };
      tip.style.filter = goo.filter;
      gsap.to(gooState, { blur: peak.blur * em, duration: 0.3 * d, ease: 'power2.in', onUpdate: () => goo.set(gooState.blur, em, peak) });
      gsap.to(tip, { scale: 0.1, autoAlpha: 0, duration: 0.32 * d, ease: 'power3.in' });
    } else {
      gsap.to(chars, { yPercent: -110, duration: 0.25 * d, ease: 'power2.in', stagger: 0.01 * d });
      gsap.to(tip, { autoAlpha: 0, duration: 0.1, delay: 0.25 * d });
    }
  }

  /* ---------- Follow ---------- */

  let pointer: { x: number; y: number } | null = null;
  let pos = { x: 0, y: 0 };
  let raf = 0;
  let lastT = 0;
  let pressed = false;

  function overMain() {
    if (!pointer || pressed || root.classList.contains('is-dragging')) return false;
    const hit = document.elementFromPoint(pointer.x, pointer.y);
    const media = hit?.closest('[data-work-media]');
    return !!media && root.contains(media) && !!media.closest('.work-item.is-current');
  }

  function frame(now: number) {
    const dt = Math.max(0, Math.min(0.1, (now - lastT) / 1000));
    lastT = now;
    if (pointer) {
      const disc = settings.style === 2;
      const gx = pointer.x + (disc ? 0 : settings.offsetX);
      const gy = pointer.y + (disc ? 0 : settings.offsetY);
      const k = settings.follow > 0 ? 1 - Math.exp(-dt / settings.follow) : 1;
      pos.x += (gx - pos.x) * k;
      pos.y += (gy - pos.y) * k;
      tip.style.translate = `${pos.x.toFixed(1)}px ${pos.y.toFixed(1)}px`;
      if (overMain()) show();
      else hide();
    } else {
      hide();
    }
    raf = pointer ? requestAnimationFrame(frame) : 0;
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      if (!pointer) pos = { x: e.clientX + settings.offsetX, y: e.clientY + settings.offsetY };
      pointer = { x: e.clientX, y: e.clientY };
      if (!raf) {
        lastT = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    pointer = null;
    hide();
  });
  window.addEventListener('pointerdown', () => {
    pressed = true;
    hide(true);
  });
  window.addEventListener('pointerup', () => (pressed = false));

  build();

  const api: WorkTooltip = {
    settings,
    refresh: build,
  };

  if (params.has('tweak')) {
    import('./work-tooltip-tweaks').then(({ mountWorkTooltipTweaks }) =>
      mountWorkTooltipTweaks(api, defaults, import.meta.env.DEV ? '/__work-tooltip' : null),
    );
  }
  return api;
}
