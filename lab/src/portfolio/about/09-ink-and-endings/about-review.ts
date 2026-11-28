/*
  About review panel (dev server, ?review): switch the ink option and the
  ending, and tune the ink live. Choices go in the URL (?ink=a|b|c|off,
  ?end=1|2|3) so a reload keeps them; switching the ending reloads, since
  it changes the page's structure. Copy JSON puts the ink settings on the
  clipboard.
*/
import { Pane } from 'tweakpane';
import { INK_OPTIONS, type AboutInk, type InkOption } from './about-ink';

export function mountAboutReview(ink: AboutInk | null, option: InkOption, end: number) {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '12px',
    right: '12px',
    zIndex: '10000',
    width: '300px',
    maxHeight: 'calc(100svh - 24px)',
    overflowY: 'auto',
  });
  document.body.append(container);

  const pane = new Pane({ container, title: 'About review' });
  const state = { ink: option, end };

  const reload = (key: string, value: string) => {
    const url = new URL(location.href);
    url.searchParams.set(key, value);
    location.href = url.href;
  };

  pane
    .addBinding(state, 'ink', {
      label: 'ink',
      options: { 'A · Smoke': 'a', 'B · Ink drops': 'b', 'C · A + B': 'c', Off: 'off' },
    })
    .on('change', ({ value }) => {
      // Live when the ink is mounted; turning it on or off needs a reload
      if (!ink || value === 'off') return reload('ink', value);
      Object.assign(ink.settings, INK_OPTIONS[value as keyof typeof INK_OPTIONS]);
      const url = new URL(location.href);
      url.searchParams.set('ink', value);
      history.replaceState(null, '', url);
    });

  pane
    .addBinding(state, 'end', { label: 'ending', options: { '1 · Last word': 1, '2 · Curtain': 2, '3 · Next page': 3 } })
    .on('change', ({ value }) => reload('end', String(value)));

  if (!ink) return;
  const s = ink.settings;
  const look = pane.addFolder({ title: 'Ink look', expanded: false });
  look.addBinding(s, 'smoke', { label: 'smoke opacity', min: 0, max: 0.6, step: 0.01 });
  look.addBinding(s, 'green', { label: 'green opacity', min: 0, max: 1, step: 0.01 });
  look.addBinding(s, 'tones', { label: 'print tones', min: 2, max: 16, step: 1 });
  look.addBinding(s, 'grain', { label: 'grain', min: 0, max: 0.4, step: 0.005 });
  look.addBinding(s, 'grainSize', { label: 'grain size', min: 1, max: 6, step: 0.5 });
  const motion = pane.addFolder({ title: 'Ink motion', expanded: false });
  motion.addBinding(s, 'dissipation', { label: 'fade (lower = lingers)', min: 0.05, max: 3, step: 0.05 });
  motion.addBinding(s, 'curl', { label: 'swirl', min: 0, max: 50, step: 1 });
  motion.addBinding(s, 'radius', { label: 'cursor size', min: 0.05, max: 1.5, step: 0.01 });
  motion.addBinding(s, 'force', { label: 'cursor push', min: 500, max: 12000, step: 100 });
  pane.on('change', () => ink.refresh());

  const copy = pane.addButton({ title: 'Copy JSON' });
  copy.on('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(s, null, 2) + '\n');
      copy.title = 'Copied ✓';
    } catch {
      copy.title = 'Copy failed';
    }
    setTimeout(() => (copy.title = 'Copy JSON'), 1600);
  });
}
