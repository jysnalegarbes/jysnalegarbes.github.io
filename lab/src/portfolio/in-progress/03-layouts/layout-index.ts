/*
  In Progress: layout options (2026-11-28, under review)
  ------------------------------------------------------
  /in-progress/?layout=N swaps the page's card loop (0, the current
  design) for one of five interactive galleries. /in-progress/?tweak opens
  a panel with the switch and the open layout's settings
  (src/config/in-progress-layouts.json).
    1 hallway   walk down a 3D corridor of images (CSS 3D)
    2 canvas    drag an endless wall that bends with the speed (WebGL)
    3 ring      spin a tilted ring of images (CSS 3D)
    4 deck      throw cards off a stack
    5 table     pick up, drag and throw scattered prints
*/
import defaults from '../../config/in-progress-layouts.json';
import { readItems, type Layout, type LayoutSettings } from './common';

export const LAYOUTS = {
  'Current (card loop)': '0',
  '1 Hallway': '1',
  '2 Infinite canvas': '2',
  '3 Ring': '3',
  '4 Deck': '4',
  '5 Table': '5',
};

export async function mountLayout(root: HTMLElement, which: string) {
  const settings: LayoutSettings = structuredClone(defaults);
  const items = readItems(root);
  const stage = document.createElement('div');
  stage.className = 'ipx-stage';
  root.classList.add('is-layout');
  root.append(stage);

  let layout: Layout | null = null;
  if (which === '1') layout = (await import('./hallway')).mountHallway(stage, items, settings);
  if (which === '2') layout = (await import('./canvas')).mountCanvas(stage, items, settings);
  if (which === '3') layout = (await import('./ring')).mountRing(stage, items, settings);
  if (which === '4') layout = (await import('./deck')).mountDeck(stage, items, settings);
  if (which === '5') layout = (await import('./table')).mountTable(stage, items, settings);
  return { settings, layout };
}

/** The ?tweak panel: layout switch + the open layout's settings */
export async function mountLayoutTweaks(which: string, settings: LayoutSettings | null, layout: Layout | null) {
  const { mountConfigPane } = await import('../config-pane');
  const s = settings ?? structuredClone(defaults);
  mountConfigPane({
    title: 'In Progress layout',
    settings: s,
    saved: structuredClone(defaults),
    saveUrl: import.meta.env.DEV ? '/__in-progress-layouts' : null,
    side: 'left',
    switches: [{ param: 'layout', label: 'layout', value: which, options: LAYOUTS }],
    build(pane) {
      if (which === '1') {
        const f = pane.addFolder({ title: 'Hallway' });
        f.addBinding(s.hallway, 'perspective', { min: 300, max: 2000, step: 10 });
        f.addBinding(s.hallway, 'depth', { label: 'spacing px', min: 200, max: 1200, step: 10 });
        f.addBinding(s.hallway, 'width', { label: 'width (vw)', min: 0.4, max: 2, step: 0.01 });
        f.addBinding(s.hallway, 'angle', { label: 'wall angle', min: 20, max: 90, step: 1 });
        f.addBinding(s.hallway, 'size', { label: 'image (vh)', min: 0.2, max: 0.7, step: 0.01 });
        f.addBinding(s.hallway, 'look', { label: 'head turn deg', min: 0, max: 20, step: 0.5 });
        f.addBinding(s.hallway, 'wheel', { min: 0.2, max: 4, step: 0.05 });
        f.addBinding(s.hallway, 'smoothing', { min: 0, max: 0.6, step: 0.01 });
      }
      if (which === '2') {
        const f = pane.addFolder({ title: 'Infinite canvas' });
        f.addBinding(s.canvas, 'size', { label: 'tile (vh)', min: 0.15, max: 0.7, step: 0.01 });
        f.addBinding(s.canvas, 'gap', { label: 'gap (vh)', min: 0, max: 0.2, step: 0.005 });
        f.addBinding(s.canvas, 'bend', { min: 0, max: 2, step: 0.01 });
        f.addBinding(s.canvas, 'aberration', { label: 'rgb split', min: 0, max: 2, step: 0.01 });
        f.addBinding(s.canvas, 'smoothing', { min: 0, max: 0.5, step: 0.01 });
        f.addBinding(s.canvas, 'friction', { label: 'glide', min: 0.8, max: 0.99, step: 0.005 });
      }
      if (which === '3') {
        const f = pane.addFolder({ title: 'Ring' });
        f.addBinding(s.ring, 'radius', { min: 0.8, max: 2, step: 0.01 });
        f.addBinding(s.ring, 'size', { label: 'image (vh)', min: 0.2, max: 0.6, step: 0.01 });
        f.addBinding(s.ring, 'tilt', { label: 'tilt deg', min: 0, max: 30, step: 0.5 });
        f.addBinding(s.ring, 'smoothing', { min: 0, max: 0.5, step: 0.01 });
        f.addBinding(s.ring, 'wheel', { min: 0.01, max: 0.4, step: 0.005 });
        f.addBinding(s.ring, 'count', { label: 'count (save + reload)', min: 6, max: 24, step: 1 });
      }
      if (which === '4') {
        const f = pane.addFolder({ title: 'Deck' });
        f.addBinding(s.deck, 'size', { label: 'card (vh)', min: 0.3, max: 0.8, step: 0.01 });
        f.addBinding(s.deck, 'spread', { label: 'pile offset px', min: 0, max: 20, step: 0.5 });
        f.addBinding(s.deck, 'tilt', { label: 'pile tilt deg', min: 0, max: 30, step: 0.5 });
        f.addBinding(s.deck, 'fling', { label: 'throw distance', min: 0.1, max: 1, step: 0.01 });
      }
      if (which === '5') {
        const f = pane.addFolder({ title: 'Table' });
        f.addBinding(s.table, 'size', { label: 'print (vh)', min: 0.15, max: 0.5, step: 0.01 });
        f.addBinding(s.table, 'friction', { min: 0.5, max: 10, step: 0.1 });
        f.addBinding(s.table, 'bounce', { min: 0, max: 1, step: 0.01 });
        f.addBinding(s.table, 'spin', { min: 0, max: 1, step: 0.01 });
      }
    },
    onChange: () => layout?.refresh(),
  });
}
