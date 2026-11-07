/*
  Contact reveal tweak panel (/contact/?tweak)
    - Save to project (dev server only) writes src/config/contact-reveal.json
    - Copy JSON puts the same settings on the clipboard
    - Reset puts everything back to the saved values
*/
import { Pane } from 'tweakpane';
import type { ContactReveal, ContactRevealSettings } from './contact-reveal';

export function mountContactRevealTweaks(fx: ContactReveal, saved: ContactRevealSettings, saveUrl: string | null) {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: '10000',
    width: '280px',
  });
  document.body.append(container);

  const s = fx.settings;
  const pane = new Pane({ container, title: 'Name reveal' });
  pane.addBinding(s, 'block', { label: 'block px', min: 4, max: 48, step: 1 });
  pane.addBinding(s, 'brush', { label: 'brush (blocks)', min: 0.5, max: 8, step: 0.1 });
  pane.addBinding(s, 'fade', { label: 'fade s', min: 0.1, max: 4, step: 0.05 });
  pane.addBinding(s, 'edge', { label: 'ragged edge', min: 0, max: 1, step: 0.01 });
  pane.addBinding(s, 'shade', { label: 'green shades', min: 0, max: 0.6, step: 0.01 });
  pane.addBinding(s, 'darkBlocks', { label: 'dark blocks', min: 0, max: 0.6, step: 0.01 });
  pane.on('change', () => fx.refresh());

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
        console.error('[contact-reveal-tweaks]', err);
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
    fx.refresh();
  });
}
