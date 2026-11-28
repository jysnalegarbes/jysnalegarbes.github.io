/*
  Contact: layout options (2026-11-28, under review)
  --------------------------------------------------
  /contact/?layout=N swaps the page (0, the current design with the ink
  name reveal) for one of five recompositions, each with its own shader
  and GSAP arrival. /contact/?tweak opens a panel with the switch and the
  open layout's settings (src/config/contact-layouts.json).
    1 liquid    the email, huge, as liquid type over a marble
    2 dots      the question in halftone dots that scatter from the cursor
    3 seam      black / grey split along a living ink edge
    4 marquee   bands of moving type in a wave, the card in the middle
    5 orb       glossy ink drops that follow the cursor and burst on click
*/
import defaults from '../../config/contact-layouts.json';
import type { ContactContent, ContactLayout, ContactSettings } from './gl';

export const LAYOUTS = {
  'Current (name reveal)': '0',
  '1 Liquid email': '1',
  '2 Halftone field': '2',
  '3 Ink seam': '3',
  '4 Wave marquee': '4',
  '5 Ink drops': '5',
};

export async function mountContactLayout(section: HTMLElement, which: string) {
  const settings: ContactSettings = structuredClone(defaults);
  const content: ContactContent = JSON.parse(section.dataset.content ?? '{}');
  const root = document.createElement('div');
  root.className = 'cx';
  section.after(root);

  let layout: ContactLayout | null = null;
  if (which === '1') layout = (await import('./liquid')).mountLiquid(root, content, settings);
  if (which === '2') layout = (await import('./dots')).mountDots(root, content, settings);
  if (which === '3') layout = (await import('./seam')).mountSeam(root, content, settings);
  if (which === '4') layout = (await import('./marquee')).mountMarquee(root, content, settings);
  if (which === '5') layout = (await import('./orb')).mountOrb(root, content, settings);
  return { settings, layout };
}

export async function mountContactLayoutTweaks(which: string, settings: ContactSettings | null, layout: ContactLayout | null) {
  const { mountConfigPane } = await import('../config-pane');
  const s = settings ?? structuredClone(defaults);
  mountConfigPane({
    title: 'Contact layout',
    settings: s,
    saved: structuredClone(defaults),
    saveUrl: import.meta.env.DEV ? '/__contact-layouts' : null,
    side: 'left',
    switches: [{ param: 'layout', label: 'layout', value: which, options: LAYOUTS }],
    build(pane) {
      if (which === '1') {
        const f = pane.addFolder({ title: 'Liquid email' });
        f.addBinding(s.liquid, 'flow', { label: 'marble flow', min: 0, max: 2, step: 0.01 });
        f.addBinding(s.liquid, 'warp', { label: 'marble warp', min: 0, max: 3, step: 0.01 });
        f.addBinding(s.liquid, 'lens', { label: 'lens size', min: 0.05, max: 0.6, step: 0.01 });
        f.addBinding(s.liquid, 'ripple', { min: 0, max: 3, step: 0.01 });
        f.addBinding(s.liquid, 'split', { label: 'rgb split', min: 0, max: 3, step: 0.01 });
      }
      if (which === '2') {
        const f = pane.addFolder({ title: 'Halftone field' });
        f.addBinding(s.dots, 'cell', { label: 'dot grid px', min: 6, max: 30, step: 1 });
        f.addBinding(s.dots, 'push', { label: 'cursor push', min: 0, max: 3, step: 0.01 });
        f.addBinding(s.dots, 'radius', { label: 'cursor radius', min: 0.05, max: 0.6, step: 0.01 });
        f.addBinding(s.dots, 'wave', { min: 0, max: 2, step: 0.01 });
        f.addBinding(s.dots, 'green', { label: 'green', min: 0, max: 1, step: 0.01 });
      }
      if (which === '3') {
        const f = pane.addFolder({ title: 'Ink seam' });
        f.addBinding(s.seam, 'split', { label: 'edge position', min: 0.3, max: 0.7, step: 0.005 });
        f.addBinding(s.seam, 'wobble', { min: 0, max: 3, step: 0.01 });
        f.addBinding(s.seam, 'bulge', { label: 'cursor pull', min: 0, max: 2, step: 0.01 });
        f.addBinding(s.seam, 'speed', { min: 0, max: 2, step: 0.01 });
      }
      if (which === '4') {
        const f = pane.addFolder({ title: 'Wave marquee' });
        f.addBinding(s.marquee, 'speed', { min: 0, max: 4, step: 0.01 });
        f.addBinding(s.marquee, 'wave', { min: 0, max: 3, step: 0.01 });
        f.addBinding(s.marquee, 'lens', { min: 0, max: 2, step: 0.01 });
        f.addBinding(s.marquee, 'size', { label: 'type size', min: 0.5, max: 1.4, step: 0.01 });
      }
      if (which === '5') {
        const f = pane.addFolder({ title: 'Ink drops' });
        f.addBinding(s.orb, 'size', { min: 0.4, max: 2, step: 0.01 });
        f.addBinding(s.orb, 'speed', { min: 0, max: 3, step: 0.01 });
        f.addBinding(s.orb, 'follow', { label: 'cursor follow', min: 0, max: 1, step: 0.01 });
        f.addBinding(s.orb, 'gloss', { min: 0, max: 2, step: 0.01 });
      }
    },
    onChange: () => layout?.refresh(),
  });
}
