/*
  Portrait-expand tweak panel
  ---------------------------
  Live controls for the About portrait effect (Ripple + Ink Develop). Opens
  when the URL has `?tweak` (e.g. http://localhost:4321/about/?tweak);
  scroll the page to see the change.
    - Save to project (dev server only) writes src/config/portrait-expand.json
    - Copy JSON puts the same settings on the clipboard
    - Reset puts everything back to the saved values
*/
import { Pane } from 'tweakpane';
import type { PortraitExpand, PortraitSettings } from './portrait-expand';

/** saveUrl: the dev endpoint that writes the config file, or null (no Save) */
export function mountPortraitTweaks(fx: PortraitExpand, saved: PortraitSettings, saveUrl: string | null) {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: '10000',
    width: '300px',
    maxHeight: 'calc(100svh - 24px)',
    overflowY: 'auto',
  });
  document.body.append(container);

  const { ripple, inkDevelop } = fx.settings;
  const pane = new Pane({ container, title: 'Portrait effect' });

  const wave = pane.addFolder({ title: 'Ripple' });
  wave.addBinding(ripple, 'speedForFull', { label: 'speed for full', min: 0.2, max: 5, step: 0.05 });
  wave.addBinding(ripple, 'height', { label: 'wave height', min: 0, max: 10, step: 0.1 });
  wave.addBinding(ripple, 'frequency', { label: 'wave count', min: 1, max: 20, step: 0.1 });
  wave.addBinding(ripple, 'waveSpeed', { label: 'wave speed', min: 0, max: 30, step: 0.5 });
  wave.addBinding(ripple, 'rgbSplit', { label: 'rgb split', min: 0, max: 1, step: 0.01 });
  wave.addBinding(fx.settings, 'settle', { label: 'settle time s', min: 0.05, max: 2, step: 0.05 });

  const ink = pane.addFolder({ title: 'Ink Develop' });
  ink.addBinding(inkDevelop, 'startLevels', { label: 'start tones', min: 2, max: 6, step: 1 });
  ink.addBinding(inkDevelop, 'endLevels', { label: 'end tones', min: 3, max: 24, step: 1 });
  ink.addBinding(inkDevelop, 'grain', { label: 'fine grain', min: 0, max: 0.3, step: 0.005 });
  ink.addBinding(inkDevelop, 'coarseGrain', { label: 'coarse grain', min: 0, max: 0.3, step: 0.005 });
  ink.addBinding(inkDevelop, 'grainSize', { label: 'grain size', min: 0.5, max: 8, step: 0.1 });
  ink.addBinding(inkDevelop, 'fullTonesAt', { label: 'full tones from', min: 0, max: 0.95, step: 0.01 });

  pane.on('change', () => fx.refresh());

  pane.addBlade({ view: 'separator' });
  const json = () => JSON.stringify(fx.settings, null, 2) + '\n';

  if (saveUrl) {
    const save = pane.addButton({ title: 'Save to project' });
    save.on('click', async () => {
      save.title = 'Saving…';
      try {
        const res = await fetch(saveUrl, { method: 'POST', body: json() });
        if (!res.ok) throw new Error(await res.text());
        Object.assign(saved, structuredClone(fx.settings));
        save.title = 'Saved ✓';
      } catch (err) {
        console.error('[portrait-tweaks]', err);
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
    Object.assign(ripple, structuredClone(saved.ripple));
    Object.assign(inkDevelop, structuredClone(saved.inkDevelop));
    fx.settings.settle = saved.settle;
    pane.refresh();
    fx.refresh();
  });
}
