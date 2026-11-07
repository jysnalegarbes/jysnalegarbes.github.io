/*
  Work "View Project" tooltip
  ---------------------------
  Over the left-most card (the main slot, the one that opens on click)
  "(View Project) →" follows the cursor, no background, its letters rising
  in one after another through a mask; it inverts over the photo
  (difference blend), so it reads on light and dark. Chosen 2026-11-07 from
  three styles (lab/portfolio/work/06-view-project-tooltip).

  The cards move under a still cursor too, so what's under it is checked
  every frame while the pointer is on the page. Hidden while dragging and
  once you press. Settings: src/config/work-tooltip.json; /work/?tweak
  opens a panel. Fine pointers only; off under reduced motion.
*/
import gsap from 'gsap';
import defaults from '../config/work-tooltip.json';

export type WorkTooltipSettings = typeof defaults;

export interface WorkTooltip {
  settings: WorkTooltipSettings;
  refresh(): void;
}

const LABEL = '(View Project)';

export function mountWorkTooltip(root: HTMLElement): WorkTooltip | null {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  const settings: WorkTooltipSettings = structuredClone(defaults);

  const tip = document.createElement('div');
  tip.className = 'work-tip';
  tip.setAttribute('aria-hidden', 'true');
  const letters = LABEL.split('')
    .map((c) => `<span class="work-tip__char">${c === ' ' ? '&nbsp;' : c}</span>`)
    .join('');
  tip.innerHTML = `<span class="work-tip__text">${letters}</span><span class="work-tip__arrow">→</span>`;
  const chars = [...tip.querySelectorAll<HTMLElement>('.work-tip__char, .work-tip__arrow')];
  document.body.append(tip);
  gsap.set(tip, { autoAlpha: 0 });

  /* ---------- In / out ---------- */

  let shown = false;

  function show() {
    if (shown) return;
    shown = true;
    gsap.killTweensOf([tip, ...chars]);
    gsap.set(tip, { autoAlpha: 1 });
    gsap.fromTo(chars, { yPercent: 110 }, { yPercent: 0, duration: 0.5, ease: 'expo.out', stagger: 0.018 });
  }

  function hide(fast = false) {
    if (!shown) return;
    shown = false;
    gsap.killTweensOf([tip, ...chars]);
    const d = fast ? 0.12 : 1;
    gsap.to(chars, { yPercent: -110, duration: 0.25 * d, ease: 'power2.in', stagger: 0.01 * d });
    gsap.to(tip, { autoAlpha: 0, duration: 0.1, delay: 0.25 * d });
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
      const k = settings.follow > 0 ? 1 - Math.exp(-dt / settings.follow) : 1;
      pos.x += (pointer.x + settings.offsetX - pos.x) * k;
      pos.y += (pointer.y + settings.offsetY - pos.y) * k;
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
  window.addEventListener('pointerup', () => {
    if (!opening) pressed = false;
  });
  // Opening a project: stay hidden through the morph and the page change
  // (until the page is shown again from the back/forward cache)
  let opening = false;
  root.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab etc.
    if ((e.target as Element).closest('.work-item.is-current')) {
      opening = true;
      pressed = true;
      hide(true);
    }
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) opening = pressed = false;
  });

  const apply = () => tip.style.setProperty('--tip-size', String(settings.size));
  apply();

  const api: WorkTooltip = { settings, refresh: apply };

  if (new URLSearchParams(location.search).has('tweak')) {
    import('./work-tooltip-tweaks').then(({ mountWorkTooltipTweaks }) =>
      mountWorkTooltipTweaks(api, defaults, import.meta.env.DEV ? '/__work-tooltip' : null),
    );
  }
  return api;
}
