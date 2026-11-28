/*
  Layout 5: Table
  ---------------
  The images lie scattered like prints on a desk. Pick any one up (it
  lifts and comes to the top), drag it around and throw it: it slides on
  with friction, spins a little and bounces off the screen edges. "Tidy
  up" lays them out in a neat row, "Scatter" throws them back. Hover: the
  title follows the cursor. Click without dragging: focus view.
*/
import gsap from 'gsap';
import {
  bindInput,
  clamp,
  cursorLabel,
  loop,
  openFocus,
  reduced,
  repeat,
  tile,
  type IpItem,
  type Layout,
  type LayoutSettings,
} from './common';

interface Card {
  el: HTMLElement;
  item: IpItem;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  vr: number;
  z: number;
  s: number; // scale (prints shrink to fit when tidied)
}

export function mountTable(stage: HTMLElement, items: IpItem[], all: LayoutSettings): Layout {
  const s = all.table;
  stage.classList.add('ipx-table');
  const desk = document.createElement('div');
  desk.className = 'ipx-table__desk';
  const tools = document.createElement('div');
  tools.className = 'ipx-table__tools';
  tools.setAttribute('data-ip-ignore', '');
  tools.innerHTML = '<button type="button" data-act="tidy">Tidy up</button><button type="button" data-act="scatter">Scatter</button>';
  stage.append(desk, tools);

  const list = repeat(items, Math.max(9, items.length));
  const seed = (i: number, k: number) => {
    const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  let zTop = list.length;
  const cards: Card[] = list.map((item, i) => {
    const el = tile(item, 'ipx-tile ipx-table__card');
    desk.append(el);
    return { el, item, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0, z: i, s: 1 };
  });

  const label = cursorLabel(stage);
  let w = 0;
  let h = 0;
  let held: Card | null = null;
  const d = reduced() ? 0.01 : 1;

  const render = (c: Card) => {
    c.el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0) rotate(${c.r.toFixed(2)}deg) scale(${c.s.toFixed(4)})`;
    c.el.style.zIndex = String(c.z);
  };

  /** Loose scatter over the free part of the screen (right of the intro on desktop) */
  function scatterPoses() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const desktop = W >= 1024;
    const x0 = desktop ? W * 0.3 : 0;
    const y0 = desktop ? 0 : H * 0.36;
    return cards.map((_, i) => ({
      x: x0 + seed(i, 2) * (W - x0 - w),
      y: y0 + seed(i, 3) * (H - y0 - h),
      r: (seed(i, 4) * 2 - 1) * 16,
      s: 1,
    }));
  }

  function tidyPoses() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const desktop = W >= 1024;
    // The free area: right of the intro title and left of the nav on
    // desktop, under the intro text on phones; above the buttons
    const x0 = desktop ? W * 0.45 : W * 0.04;
    const x1 = desktop ? W * 0.87 : W * 0.96;
    const y0 = desktop ? H * 0.1 : H * 0.36;
    const y1 = H * 0.88;
    const gap = 16;
    // The column count that lets the prints be largest
    let best = { cols: 1, s: 0 };
    for (let cols = 1; cols <= cards.length; cols++) {
      const rows = Math.ceil(cards.length / cols);
      const s = Math.min(1, (x1 - x0) / (cols * (w + gap)), (y1 - y0) / (rows * (h + gap)));
      if (s > best.s) best = { cols, s };
    }
    const { cols, s: k } = best;
    const rows = Math.ceil(cards.length / cols);
    const cw = (w + gap) * k;
    const ch = (h + gap) * k;
    const ox = x0 + (x1 - x0 - cols * cw) / 2;
    const oy = y0 + (y1 - y0 - rows * ch) / 2;
    return cards.map((_, i) => ({
      // Scaled about the card's centre: offset the top-left to match
      x: ox + (i % cols) * cw + (cw - w) / 2,
      y: oy + Math.floor(i / cols) * ch + (ch - h) / 2,
      r: 0,
      s: k,
    }));
  }

  function moveTo(poses: { x: number; y: number; r: number; s: number }[]) {
    cards.forEach((c, i) => {
      c.vx = c.vy = c.vr = 0;
      gsap.to(c, {
        x: poses[i].x,
        y: poses[i].y,
        r: poses[i].r,
        s: poses[i].s,
        duration: 1.1 * d,
        delay: i * 0.03 * d,
        ease: 'expo.inOut',
        onUpdate: () => render(c),
      });
    });
  }

  function layout(first = false) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    h = Math.min(vh * s.size, vw * 0.36);
    w = h * 0.88;
    cards.forEach((c) => Object.assign(c.el.style, { width: `${w}px`, height: `${h}px` }));
    if (first) {
      const poses = scatterPoses();
      cards.forEach((c, i) => Object.assign(c, poses[i]));
      // Dealt onto the table
      cards.forEach((c, i) => {
        render(c);
        const at = { delay: 0.15 + i * 0.05 * d, duration: 0.8 * d, ease: 'power3.out' };
        gsap.from(c.el, { opacity: 0, ...at });
        gsap.from(c, { y: c.y - 60, r: c.r + 24, ...at, onUpdate: () => render(c) });
      });
    } else cards.forEach(render);
  }

  const cardAt = (x: number, y: number) => {
    const el = document.elementsFromPoint(x, y).find((e) => e.classList.contains('ipx-table__card'));
    return cards.find((c) => c.el === el) ?? null;
  };

  bindInput(stage, {
    down: (x, y) => {
      held = cardAt(x, y);
      if (!held) return false;
      gsap.killTweensOf(held);
      held.vx = held.vy = held.vr = 0;
      held.z = ++zTop;
      held.el.classList.add('is-held');
      render(held);
    },
    move: (dx, dy) => {
      if (!held) return;
      held.x += dx;
      held.y += dy;
      held.r = clamp(held.r + dx * s.spin * 0.2, -40, 40);
      render(held);
    },
    up: (vx, vy, moved, e) => {
      if (!held) return;
      const c = held;
      held = null;
      c.el.classList.remove('is-held');
      if (!moved) {
        openFocus(c.item, c.el.getBoundingClientRect());
        return;
      }
      c.vx = clamp(vx, -4000, 4000);
      c.vy = clamp(vy, -4000, 4000);
      c.vr = clamp(vx * s.spin * 0.05, -360, 360);
      void e;
    },
    hover: (x, y) => {
      label.move(x, y);
      label.show(held ? null : (cardAt(x, y)?.item.title ?? null));
    },
  });
  stage.addEventListener('pointerleave', () => label.show(null));

  tools.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'tidy') moveTo(tidyPoses());
    if (act === 'scatter') moveTo(scatterPoses());
  });

  // Thrown cards slide on with friction and bounce off the edges
  loop((dt) => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const f = Math.exp(-s.friction * dt);
    cards.forEach((c) => {
      if (c === held || (!c.vx && !c.vy && !c.vr)) return;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.r += c.vr * dt;
      c.vx *= f;
      c.vy *= f;
      c.vr *= f;
      if (c.x < -w * 0.3 || c.x > W - w * 0.7) {
        c.x = clamp(c.x, -w * 0.3, W - w * 0.7);
        c.vx *= -s.bounce;
      }
      if (c.y < -h * 0.3 || c.y > H - h * 0.7) {
        c.y = clamp(c.y, -h * 0.3, H - h * 0.7);
        c.vy *= -s.bounce;
      }
      if (Math.hypot(c.vx, c.vy) < 4 && Math.abs(c.vr) < 2) c.vx = c.vy = c.vr = 0;
      render(c);
    });
  });

  layout(true);
  window.addEventListener('resize', () => layout());
  return { refresh: () => layout() };
}
