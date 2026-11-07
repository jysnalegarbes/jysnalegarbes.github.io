/*
  Work tooltip panel (/work/?tweak)
    - Save to project (dev server only) writes src/config/work-tooltip.json
    - Copy JSON puts the same settings on the clipboard
    - Reset puts everything back to the saved values
*/
import { Pane } from 'tweakpane';
import type { WorkTooltip, WorkTooltipSettings } from './work-tooltip';

export function mountWorkTooltipTweaks(tip: WorkTooltip, saved: WorkTooltipSettings, saveUrl: string | null) {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '12px',
    right: '12px',
    zIndex: '10000',
    width: '280px',
  });
  document.body.append(container);

  const s = tip.settings;
  const pane = new Pane({ container, title: 'View Project tooltip' });
  pane.addBinding(s, 'size', { label: 'size', min: 0.6, max: 2, step: 0.05 });
  pane.addBinding(s, 'follow', { label: 'follow lag s', min: 0, max: 0.5, step: 0.01 });
  pane.addBinding(s, 'offsetX', { label: 'offset x', min: -60, max: 80, step: 1 });
  pane.addBinding(s, 'offsetY', { label: 'offset y', min: -60, max: 80, step: 1 });
  pane.on('change', () => tip.refresh());

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
        console.error('[work-tooltip-tweaks]', err);
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
    Object.assign(s, structuredClone(saved));
    pane.refresh();
    tip.refresh();
  });
}
