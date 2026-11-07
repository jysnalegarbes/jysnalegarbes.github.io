/*
  In Progress tweak panel
  -----------------------
  /in-progress/?tweak: tune the Drum Roll + skew scroll and the liquid ink
  hover live.
    - Save to project (dev server only) writes src/config/in-progress.json
    - Copy JSON puts the same settings on the clipboard
    - Reset puts everything back to the saved values
*/
import { Pane } from 'tweakpane';
import type { InProgressApi, InProgressSettings } from './in-progress';

export function mountInProgressTweaks(api: InProgressApi, saved: InProgressSettings, saveUrl: string | null) {
  const container = document.createElement('div');
  container.setAttribute('data-ip-ignore', '');
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '12px',
    left: '12px',
    zIndex: '10000',
    width: '300px',
    maxHeight: 'calc(100svh - 24px)',
    overflowY: 'auto',
  });
  document.body.append(container);

  const s = api.settings;
  const pane = new Pane({ container, title: 'In Progress effects' });

  const scroll = pane.addFolder({ title: 'Scroll' });
  scroll.addBinding(s.scroll, 'smoothing', { label: 'smoothing s', min: 0, max: 0.6, step: 0.01 });
  scroll.addBinding(s.scroll, 'wheel', { label: 'wheel speed', min: 0.2, max: 3, step: 0.05 });

  const drum = pane.addFolder({ title: 'Drum Roll' });
  drum.addBinding(s.drum, 'angle', { label: 'tilt °', min: 0, max: 80, step: 1 });
  drum.addBinding(s.drum, 'shrink', { label: 'shrink', min: 0, max: 0.5, step: 0.01 });
  drum.addBinding(s.drum, 'perspective', { label: 'perspective px', min: 300, max: 4000, step: 50 });

  const skew = pane.addFolder({ title: 'Skew (while scrolling)' });
  skew.addBinding(s.skew, 'maxDeg', { label: 'max lean °', min: 0, max: 20, step: 0.5 });
  skew.addBinding(s.skew, 'perSpeed', { label: 'lean per speed', min: 0, max: 0.02, step: 0.0005 });
  skew.addBinding(s.skew, 'stretch', { label: 'stretch', min: 0, max: 0.4, step: 0.01 });
  skew.addBinding(s.skew, 'settle', { label: 'settle s', min: 0, max: 1.5, step: 0.01 });

  const ink = pane.addFolder({ title: 'Hover · Liquid Ink' });
  ink.addBinding(s.ink, 'radius', { label: 'size (card h)', min: 0.05, max: 1, step: 0.01 });
  ink.addBinding(s.ink, 'tail', { label: 'tail', min: 0, max: 6, step: 0.05 });
  ink.addBinding(s.ink, 'amount', { label: 'ink per speed', min: 0, max: 6, step: 0.05 });
  ink.addBinding(s.ink, 'edge', { label: 'ink edge', min: 0.02, max: 0.95, step: 0.01 });
  ink.addBinding(s.ink, 'softness', { label: 'edge softness', min: 0, max: 0.4, step: 0.005 });
  ink.addBinding(s.ink, 'wobble', { label: 'wobble', min: 0, max: 3, step: 0.05 });
  ink.addBinding(s.ink, 'smear', { label: 'photo smear', min: 0, max: 0.3, step: 0.005 });
  ink.addBinding(s.ink, 'linger', { label: 'linger s', min: 0.02, max: 1.5, step: 0.01 });

  pane.on('change', () => api.refresh());

  pane.addBlade({ view: 'separator' });
  const json = () => JSON.stringify(s, null, 2) + '\n';

  if (saveUrl) {
    const save = pane.addButton({ title: 'Save to project' });
    save.on('click', async () => {
      save.title = 'Saving…';
      try {
        const res = await fetch(saveUrl, { method: 'POST', body: json() });
        if (!res.ok) throw new Error(await res.text());
        Object.assign(saved, structuredClone(s));
        save.title = 'Saved ✓';
      } catch (err) {
        console.error('[in-progress-tweaks]', err);
        save.title = 'Save failed';
      }
      setTimeout(() => (save.title = 'Save to project'), 1600);
    });
  }

  const copy = pane.addButton({ title: 'Copy JSON' });
  copy.on('click', async () => {
    try {
      await navigator.clipboard.writeText(json());
      copy.title = 'Copied ✓';
    } catch {
      copy.title = 'Copy failed';
    }
    setTimeout(() => (copy.title = 'Copy JSON'), 1600);
  });

  pane.addButton({ title: 'Reset to saved' }).on('click', () => {
    const target = s as unknown as Record<string, Record<string, number>>;
    for (const [key, value] of Object.entries(structuredClone(saved))) Object.assign(target[key], value);
    pane.refresh();
    api.refresh();
  });
}
