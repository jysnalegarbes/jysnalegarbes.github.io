/*
  Portrait-expand tweak panel
  ---------------------------
  Live controls for the About portrait effect (Ripple + Halftone Develop). Opens
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

  const { ripple, halftone, wipe } = fx.settings;
  const pane = new Pane({ container, title: 'Portrait effect' });


  const wave = pane.addFolder({ title: 'Ripple' });
  wave.addBinding(ripple, 'speedForFull', { label: 'speed for full', min: 0.2, max: 5, step: 0.05 });
  wave.addBinding(ripple, 'height', { label: 'wave height', min: 0, max: 10, step: 0.1 });
  wave.addBinding(ripple, 'frequency', { label: 'wave count', min: 1, max: 20, step: 0.1 });
  wave.addBinding(ripple, 'waveSpeed', { label: 'wave speed', min: 0, max: 30, step: 0.5 });
  wave.addBinding(ripple, 'rgbSplit', { label: 'rgb split', min: 0, max: 1, step: 0.01 });
  wave.addBinding(fx.settings, 'settle', { label: 'settle time s', min: 0.05, max: 2, step: 0.05 });

  const dots = pane.addFolder({ title: 'Halftone Develop' });
  dots.addBinding(halftone, 'cellStart', { label: 'dot size small', min: 3, max: 40, step: 0.5 });
  dots.addBinding(halftone, 'cellEnd', { label: 'dot size full', min: 2, max: 30, step: 0.5 });
  dots.addBinding(halftone, 'resolveFrom', { label: 'resolve from', min: 0, max: 0.99, step: 0.01 });
  dots.addBinding(halftone, 'dotsAtEnd', { label: 'dots at end', min: 0, max: 1, step: 0.01 });

  const edge = pane.addFolder({ title: 'Ink wipe (after full screen)' });
  edge.addBinding(wipe, 'width', { label: 'edge width', min: 0.1, max: 6, step: 0.01 });
  edge.addBinding(wipe, 'scaleX', { label: 'noise scale x', min: 0.5, max: 60, step: 0.01 });
  edge.addBinding(wipe, 'scaleY', { label: 'noise scale y', min: 0.5, max: 60, step: 0.01 });
  edge.addBinding(wipe, 'start', { label: 'starts at scroll', min: 0.5, max: 0.95, step: 0.005 });
  edge.addBinding(wipe, 'end', { label: 'ends at scroll', min: 0.6, max: 1, step: 0.005 });

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
    Object.assign(halftone, structuredClone(saved.halftone));
    Object.assign(wipe, structuredClone(saved.wipe));
    fx.settings.settle = saved.settle;
    pane.refresh();
    fx.refresh();
  });
}
