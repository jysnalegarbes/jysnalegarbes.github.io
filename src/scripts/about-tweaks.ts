/*
  About motion tweak panel
  ------------------------
  Live controls for the About scroll timing and the goo text (everything in
  src/config/about-motion.json). Opens with `?tweak`, bottom left, clear
  of the pinned titles (the portrait's panel takes the top right).
    - Holds: how many screens a section stays pinned, and which share of
      that the highlight / line reveal runs over. More screens = slower.
    - Goo: the title intros' blur, contrast, threshold and slide; Replay
      runs the goo on whatever titles are showing.
    - Ink edge: roughness > 0 pushes the goo's edge around with noise while
      it's blurred (comic ink); 0 is the clean Codrops goo. "Comic ink"
      loads a starting point for that.
    - Save to project (dev server only) writes the config file; Copy JSON
      and Reset as in the portrait panel.
*/
import { Pane } from 'tweakpane';
import type { AboutMotion, AboutSections } from './about-sections';

const COMIC: Partial<AboutMotion> = {
  gooTitles: { duration: 1.2, blur: 0.12, contrast: 28, threshold: -11, slide: 0.5 },
  gooFade: { duration: 1.8, blur: 0.09, contrast: 26, threshold: -11 },
  inkEdge: { roughness: 0.6, grain: 1.4, octaves: 3, seed: 7 },
};

export function mountAboutTweaks(about: AboutSections, saved: AboutMotion, saveUrl: string | null) {
  const m = about.motion;
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '12px',
    left: '12px',
    zIndex: '10000',
    width: '300px',
    maxHeight: 'calc(55svh - 24px)',
    overflowY: 'auto',
  });
  document.body.append(container);

  const pane = new Pane({ container, title: 'About scroll & goo' });

  const approach = pane.addFolder({ title: 'my APPROACH · hold' });
  approach.addBinding(m.approach, 'hold', { label: 'hold screens', min: 0, max: 6, step: 0.1 });
  approach.addBinding(m.approach, 'revealFrom', { label: 'lines from', min: 0, max: 1, step: 0.01 });
  approach.addBinding(m.approach, 'revealTo', { label: 'lines to', min: 0, max: 1, step: 0.01 });

  const beyond = pane.addFolder({ title: 'beyond DESIGN · hold' });
  beyond.addBinding(m.beyond, 'hold', { label: 'hold screens', min: 0, max: 8, step: 0.1 });
  beyond.addBinding(m.beyond, 'highlightFrom', { label: 'highlight from', min: 0, max: 1, step: 0.01 });
  beyond.addBinding(m.beyond, 'highlightTo', { label: 'highlight to', min: 0, max: 1, step: 0.01 });

  [approach, beyond].forEach((f) => f.on('change', () => about.refresh()));

  const titles = pane.addFolder({ title: 'Goo · section titles' });
  titles.addBinding(m.gooTitles, 'duration', { label: 'duration s', min: 0.2, max: 4, step: 0.05 });
  titles.addBinding(m.gooTitles, 'blur', { label: 'blur (em)', min: 0, max: 0.4, step: 0.002 });
  titles.addBinding(m.gooTitles, 'contrast', { label: 'contrast', min: 2, max: 60, step: 1 });
  titles.addBinding(m.gooTitles, 'threshold', { label: 'threshold', min: -30, max: 0, step: 0.5 });
  titles.addBinding(m.gooTitles, 'slide', { label: 'slide (em)', min: 0, max: 2, step: 0.05 });

  const fade = pane.addFolder({ title: 'Goo · greeting & ending' });
  fade.addBinding(m.gooFade, 'duration', { label: 'duration s', min: 0.2, max: 4, step: 0.05 });
  fade.addBinding(m.gooFade, 'blur', { label: 'blur (em)', min: 0, max: 0.4, step: 0.002 });
  fade.addBinding(m.gooFade, 'contrast', { label: 'contrast', min: 2, max: 60, step: 1 });
  fade.addBinding(m.gooFade, 'threshold', { label: 'threshold', min: -30, max: 0, step: 0.5 });
  fade.addBinding(m.gooEnding, 'duration', { label: 'ending duration s', min: 0.2, max: 6, step: 0.05 });
  fade.addBinding(m.gooEnding, 'blur', { label: 'ending blur ×', min: 0.2, max: 4, step: 0.05 });

  const ink = pane.addFolder({ title: 'Ink edge' });
  ink.addBinding(m.inkEdge, 'roughness', { label: 'roughness (em)', min: 0, max: 2, step: 0.01 });
  ink.addBinding(m.inkEdge, 'grain', { label: 'grain / em', min: 0.1, max: 6, step: 0.05 });
  ink.addBinding(m.inkEdge, 'octaves', { label: 'octaves', min: 1, max: 5, step: 1 });
  ink.addBinding(m.inkEdge, 'seed', { label: 'seed', min: 0, max: 99, step: 1 });

  pane.addButton({ title: 'Replay titles on screen' }).on('click', () => about.replayGoo());
  pane.addButton({ title: 'Load "comic ink" preset' }).on('click', () => {
    for (const [key, value] of Object.entries(COMIC)) Object.assign(m[key as keyof AboutMotion], value);
    pane.refresh();
    about.replayGoo();
  });

  pane.addBlade({ view: 'separator' });
  const json = () => JSON.stringify(m, null, 2) + '\n';

  if (saveUrl) {
    const save = pane.addButton({ title: 'Save to project' });
    save.on('click', async () => {
      save.title = 'Saving…';
      try {
        const res = await fetch(saveUrl, { method: 'POST', body: json() });
        if (!res.ok) throw new Error(await res.text());
        Object.assign(saved, structuredClone(m));
        save.title = 'Saved ✓';
      } catch (err) {
        console.error('[about-tweaks]', err);
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
    for (const key of Object.keys(saved) as (keyof AboutMotion)[]) Object.assign(m[key], structuredClone(saved[key]));
    pane.refresh();
    about.refresh();
  });
}
