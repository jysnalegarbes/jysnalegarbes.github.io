/*
  Portrait-expand tweak panel
  ---------------------------
  Live controls for the About portrait effects. Library copy: opens on the
  full-screen demo, without Save (copy the JSON instead). Shows the controls of
  the effect that's selected; scroll the page to see the change.
    - Save to project (dev server only) writes src/config/portrait-expand.json
    - Copy JSON puts the same settings on the clipboard
    - Reset puts the current effect back to the saved values
*/
import { Pane } from 'tweakpane';
import type { FolderApi } from 'tweakpane';
import { MODE_NAMES, type PortraitExpand, type PortraitMode, type PortraitSettings } from './portrait-expand';

type Key = Exclude<keyof PortraitSettings, 'settle'>;

// One folder per effect: [setting, label, min, max, step]
const CONTROLS: Record<Key, { mode: PortraitMode; rows: [string, string, number, number, number][] }> = {
  inkEdge: {
    mode: 1,
    rows: [
      ['reach', 'edge depth', 0, 3, 0.05],
      ['blotSize', 'blot size', 0.2, 4, 0.05],
      ['speckle', 'speckle', 0, 12, 0.1],
      ['pool', 'ink pooling', 0, 1, 0.01],
      ['drift', 'edge drift', 0, 10, 0.1],
    ],
  },
  lensSettle: {
    mode: 2,
    rows: [
      ['zoom', 'start zoom', 0, 1, 0.01],
      ['blur', 'start blur %', 0, 3, 0.05],
    ],
  },
  lensWarp: {
    mode: 3,
    rows: [
      ['base', 'warp at rest', 0, 1, 0.01],
      ['speedForFull', 'speed for full', 0.2, 8, 0.1],
      ['bulge', 'outline bulge', 0, 0.4, 0.005],
      ['magnify', 'centre zoom', 0, 0.8, 0.01],
      ['rgbSplit', 'rgb split', 0, 0.1, 0.001],
    ],
  },
  shutterStrips: {
    mode: 4,
    rows: [
      ['count', 'strips', 2, 20, 1],
      ['stagger', 'stagger', 0, 0.12, 0.005],
      ['duration', 'open time', 0.05, 0.8, 0.01],
      ['gap', 'gap', 0, 0.6, 0.01],
      ['offset', 'image slide', 0, 0.5, 0.01],
    ],
  },
  ripple: {
    mode: 5,
    rows: [
      ['speedForFull', 'speed for full', 0.2, 5, 0.05],
      ['height', 'wave height', 0, 10, 0.1],
      ['frequency', 'wave count', 1, 20, 0.1],
      ['waveSpeed', 'wave speed', 0, 30, 0.5],
      ['rgbSplit', 'rgb split', 0, 1, 0.01],
    ],
  },
  inkDevelop: {
    mode: 6,
    rows: [
      ['startLevels', 'start tones', 2, 6, 1],
      ['endLevels', 'end tones', 3, 24, 1],
      ['grain', 'fine grain', 0, 0.3, 0.005],
      ['coarseGrain', 'coarse grain', 0, 0.3, 0.005],
      ['grainSize', 'grain size', 0.5, 8, 0.1],
      ['fullTonesAt', 'full tones from', 0, 0.95, 0.01],
    ],
  },
};

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

  const pane = new Pane({ container, title: 'Portrait effect' });
  const pick = { effect: fx.mode() };
  pane
    .addBinding(pick, 'effect', { options: Object.fromEntries(MODE_NAMES.map((n, i) => [n, i])) })
    .on('change', (e) => fx.setMode(e.value as PortraitMode));

  const folders = new Map<PortraitMode, FolderApi>();
  for (const [key, { mode, rows }] of Object.entries(CONTROLS) as [Key, (typeof CONTROLS)[Key]][]) {
    const target = fx.settings[key] as Record<string, number>;
    const folder = pane.addFolder({ title: MODE_NAMES[mode] });
    for (const [prop, label, min, max, step] of rows) folder.addBinding(target, prop, { label, min, max, step });
    folder.addButton({ title: 'Reset this effect' }).on('click', () => {
      Object.assign(target, structuredClone(saved[key]));
      pane.refresh();
      fx.refresh();
    });
    folders.set(mode, folder);
  }

  const settle = pane.addFolder({ title: 'Settling', expanded: false });
  settle.addBinding(fx.settings, 'settle', { label: 'settle time s', min: 0.05, max: 2, step: 0.05 });

  const show = (m: PortraitMode) => {
    pick.effect = m;
    folders.forEach((f, mode) => (f.hidden = mode !== m));
    settle.hidden = m !== 3 && m !== 5;
    pane.refresh();
  };
  show(fx.mode());
  fx.onMode(show);

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
}
