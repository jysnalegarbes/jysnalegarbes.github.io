/*
  Fluid tweak panel
  -----------------
  Live controls for the homepage fluid. Opens when the URL has `?tweak`
  (e.g. http://localhost:4321/?tweak).
    - Save to project (dev only) writes src/config/fluid-trail.json
    - Copy JSON puts the same settings on the clipboard
*/
import { Pane } from 'tweakpane';
import type { FluidConfig, FluidTrail } from './fluid-trail';

export interface FluidSettings {
  tint: string;
  config: FluidConfig;
}

export function mountFluidTweaks(fluid: FluidTrail, saved: FluidSettings) {
  const state: FluidSettings = structuredClone(saved);
  const { config } = state;

  const container = document.createElement('div');
  container.className = 'fluid-tweaks';
  Object.assign(container.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: '1000',
    width: '300px',
    maxHeight: 'calc(100svh - 24px)',
    overflowY: 'auto',
  });
  document.body.append(container);

  const pane = new Pane({ container, title: 'Fluid background' });

  const apply = () => fluid.update(config, state.tint);

  const ink = pane.addFolder({ title: 'Ink' });
  ink.addBinding(state, 'tint', { label: 'color' });
  ink.addBinding(config, 'mode', { options: { soft: 0, ink: 1 } });
  ink.addBinding(config, 'intensity', { min: 0.1, max: 5, step: 0.05 });
  ink.addBinding(config, 'inkEdge', { label: 'edge', min: 0.01, max: 1, step: 0.01 });
  ink.addBinding(config, 'inkSoftness', { label: 'softness', min: 0, max: 0.5, step: 0.005 });
  ink.addBinding(config, 'shading');

  const motion = pane.addFolder({ title: 'Motion' });
  motion.addBinding(config, 'splatRadius', { label: 'radius', min: 0.05, max: 2, step: 0.01 });
  motion.addBinding(config, 'splatForce', { label: 'force', min: 0, max: 15000, step: 50 });
  motion.addBinding(config, 'curl', { min: 0, max: 50, step: 0.5 });
  motion.addBinding(config, 'densityDissipation', { label: 'ink fade', min: 0, max: 6, step: 0.05 });
  motion.addBinding(config, 'velocityDissipation', { label: 'flow fade', min: 0, max: 6, step: 0.05 });

  const quality = pane.addFolder({ title: 'Quality', expanded: false });
  quality.addBinding(config, 'simResolution', {
    label: 'sim res',
    options: { 32: 32, 64: 64, 96: 96, 128: 128, 256: 256 },
  });
  quality.addBinding(config, 'dyeResolution', {
    label: 'ink res',
    options: { 256: 256, 512: 512, 1024: 1024, 2048: 2048 },
  });
  quality.addBinding(config, 'pressure', { min: 0, max: 1, step: 0.01 });
  quality.addBinding(config, 'pressureIterations', { label: 'iterations', min: 1, max: 60, step: 1 });

  pane.on('change', apply);

  pane.addBlade({ view: 'separator' });
  pane.addButton({ title: 'Splash (preview)' }).on('click', () => fluid.splash());

  const json = () => JSON.stringify(state, null, 2) + '\n';

  if (import.meta.env.DEV) {
    const save = pane.addButton({ title: 'Save to project' });
    save.on('click', async () => {
      save.title = 'Saving…';
      try {
        const res = await fetch('/__fluid-config', { method: 'POST', body: json() });
        if (!res.ok) throw new Error(await res.text());
        save.title = 'Saved ✓';
      } catch (err) {
        console.error('[fluid-tweaks]', err);
        save.title = 'Save failed (see console)';
      }
      setTimeout(() => (save.title = 'Save to project'), 2000);
    });
  }

  const copy = pane.addButton({ title: 'Copy JSON' });
  copy.on('click', async () => {
    await navigator.clipboard.writeText(json());
    copy.title = 'Copied ✓';
    setTimeout(() => (copy.title = 'Copy JSON'), 1500);
  });

  pane.addButton({ title: 'Reset to saved' }).on('click', () => {
    state.tint = saved.tint;
    Object.assign(config, saved.config);
    pane.refresh();
    apply();
  });

  return pane;
}
