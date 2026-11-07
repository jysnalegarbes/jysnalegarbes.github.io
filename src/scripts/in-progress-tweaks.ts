/*
  In Progress tweak panel
  -----------------------
  /in-progress/?tweak: pick the scroll and hover effects on test and tune
  them live.
    - Save to project (dev server only) writes src/config/in-progress.json
    - Copy JSON puts the same settings on the clipboard
    - Reset puts everything back to the saved values
*/
import { Pane } from 'tweakpane';
import { HOVER_FX, SCROLL_FX, type InProgressApi, type InProgressSettings } from './in-progress';

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

  pane.addBinding(s, 'scrollFx', { label: 'scroll effect', options: SCROLL_FX });
  pane.addBinding(s, 'hoverFx', { label: 'hover effect', options: HOVER_FX });

  const scroll = pane.addFolder({ title: 'Scroll' });
  scroll.addBinding(s.scroll, 'smoothing', { label: 'smoothing s', min: 0, max: 0.6, step: 0.01 });
  scroll.addBinding(s.scroll, 'wheel', { label: 'wheel speed', min: 0.2, max: 3, step: 0.05 });

  const skew = pane.addFolder({ title: '1 · Velocity Skew', expanded: false });
  skew.addBinding(s.skew, 'maxDeg', { label: 'max lean °', min: 0, max: 20, step: 0.5 });
  skew.addBinding(s.skew, 'perSpeed', { label: 'lean per speed', min: 0, max: 0.02, step: 0.0005 });
  skew.addBinding(s.skew, 'stretch', { label: 'stretch', min: 0, max: 0.4, step: 0.01 });

  const drum = pane.addFolder({ title: '2 · Drum Roll', expanded: false });
  drum.addBinding(s.drum, 'angle', { label: 'tilt °', min: 0, max: 80, step: 1 });
  drum.addBinding(s.drum, 'shrink', { label: 'shrink', min: 0, max: 0.5, step: 0.01 });
  drum.addBinding(s.drum, 'perspective', { label: 'perspective px', min: 300, max: 4000, step: 50 });

  const drift = pane.addFolder({ title: '3 · Column Drift', expanded: false });
  drift.addBinding(s.drift, 'slow', { label: 'left column speed', min: 0.3, max: 1, step: 0.01 });
  drift.addBinding(s.drift, 'fast', { label: 'right column speed', min: 1, max: 2, step: 0.01 });
  drift.addBinding(s.drift, 'lag', { label: 'extra lag s', min: 0, max: 1, step: 0.01 });

  const lens = pane.addFolder({ title: 'Hover 1 · Halftone Lens', expanded: false });
  lens.addBinding(s.halftone, 'radius', { label: 'radius (card h)', min: 0.05, max: 1, step: 0.01 });
  lens.addBinding(s.halftone, 'cell', { label: 'dot cell px', min: 3, max: 30, step: 0.5 });
  lens.addBinding(s.halftone, 'follow', { label: 'follow lag s', min: 0, max: 0.6, step: 0.01 });

  const pixel = pane.addFolder({ title: 'Hover 2 · Pixel Trail', expanded: false });
  pixel.addBinding(s.pixel, 'block', { label: 'block px', min: 6, max: 60, step: 1 });
  pixel.addBinding(s.pixel, 'radius', { label: 'brush (blocks)', min: 0.5, max: 6, step: 0.1 });
  pixel.addBinding(s.pixel, 'fade', { label: 'fade s', min: 0.1, max: 3, step: 0.05 });

  const liquid = pane.addFolder({ title: 'Hover 3 · Liquid RGB', expanded: false });
  liquid.addBinding(s.liquid, 'radius', { label: 'radius (card h)', min: 0.05, max: 1, step: 0.01 });
  liquid.addBinding(s.liquid, 'strength', { label: 'smear', min: 0, max: 0.3, step: 0.005 });
  liquid.addBinding(s.liquid, 'split', { label: 'rgb split', min: 0, max: 3, step: 0.05 });

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
    const fresh = structuredClone(saved) as Record<string, unknown>;
    for (const [key, value] of Object.entries(fresh)) {
      const target = s as unknown as Record<string, unknown>;
      if (value && typeof value === 'object') Object.assign(target[key] as object, value);
      else target[key] = value;
    }
    pane.refresh();
    api.refresh();
  });
}
