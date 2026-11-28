/*
  Layout 1: Hallway
  -----------------
  A corridor seen from the inside: the images hang on the left and right
  walls, one after another into the distance, between floor and ceiling
  lines. Scroll, drag or the arrow keys walk you down it (endless: the
  hallway wraps); the cursor turns your head a little. Hover: the image
  turns toward you and its title follows the cursor. Click: focus view.
  CSS 3D only (perspective + preserve-3d).
*/
import {
  bindInput,
  clamp,
  cursorLabel,
  ease,
  loop,
  mod,
  openFocus,
  reduced,
  repeat,
  tile,
  type IpItem,
  type Layout,
  type LayoutSettings,
} from './common';

export function mountHallway(stage: HTMLElement, items: IpItem[], all: LayoutSettings): Layout {
  const s = all.hallway;
  stage.classList.add('ipx-hall');
  const view = document.createElement('div');
  view.className = 'ipx-hall__view';
  const world = document.createElement('div');
  world.className = 'ipx-hall__world';
  view.append(world);
  stage.append(view);

  // Floor and ceiling: short line segments (a cross line and two rail
  // pieces per rung). Huge 3D planes would blank the whole layer.
  const rungs = Array.from({ length: 28 }, () => {
    const make = (cls: string) => {
      const el = document.createElement('div');
      el.className = `ipx-hall__line ${cls}`;
      world.append(el);
      return el;
    };
    return {
      lines: [make('is-cross'), make('is-cross'), make('is-rail'), make('is-rail'), make('is-rail'), make('is-rail')],
    };
  });

  const list = repeat(items, 12);
  const cards = list.map((item, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'ipx-hall__card';
    const t = tile(item);
    wrap.append(t);
    world.append(wrap);
    return { wrap, tile: t, item, side: i % 2 ? 1 : -1 };
  });

  const label = cursorLabel(stage);
  let travel = 0;
  let target = 0;
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  let W = 0;
  let w = 0;
  let h = 0;

  function layout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    h = Math.min(vh * s.size, vw * 0.42);
    w = h * 1.25;
    W = s.width * vw + w * 0.6;
    view.style.perspective = `${s.perspective}px`;
    cards.forEach((c) => {
      c.wrap.style.width = `${w}px`;
      c.wrap.style.height = `${h}px`;
      c.wrap.style.margin = `${-h / 2}px 0 0 ${-w / 2}px`;
      c.wrap.style.setProperty('--turn', `${c.side * s.angle * 0.45}deg`);
    });
    const r = s.depth / 2;
    rungs.forEach(({ lines }) => {
      lines.slice(0, 2).forEach((el) => (el.style.width = `${W}px`));
      lines.slice(2).forEach((el) => (el.style.height = `${r}px`));
    });
  }

  function placeLines() {
    const r = s.depth / 2;
    const L = rungs.length * r;
    const fy = h / 2 + h * 0.2;
    rungs.forEach(({ lines }, j) => {
      const d = mod(j * r - travel, L);
      const fade = clamp(d / r, 0, 1) * clamp((L - d) / (L * 0.5), 0, 1);
      const [cf, cc, ...rails] = lines;
      cf.style.transform = `translate3d(${-W / 2}px, ${fy}px, ${-d}px)`;
      cc.style.transform = `translate3d(${-W / 2}px, ${-fy}px, ${-d}px)`;
      // Rail pieces run from this rung toward the camera, to the next one
      rails.forEach((el, k) => {
        const x = k % 2 ? W / 2 : -W / 2;
        const y = k < 2 ? fy : -fy;
        el.style.transform = `translate3d(${x}px, ${y}px, ${-d}px) rotateX(90deg)`;
      });
      lines.forEach((el) => (el.style.opacity = fade.toFixed(3)));
    });
  }

  function place() {
    const L = cards.length * s.depth;
    cards.forEach((c, i) => {
      // Distance ahead of the camera, wrapping
      const d = mod(i * s.depth - travel, L);
      const near = clamp((d - s.depth * 0.15) / (s.depth * 0.45), 0, 1);
      const far = clamp((L - d) / (s.depth * 1.5), 0, 1);
      const x = c.side * (W / 2 - w * 0.3);
      c.wrap.style.transform = `translate3d(${x.toFixed(1)}px, 0, ${(-d).toFixed(1)}px) rotateY(${c.side * -s.angle}deg)`;
      c.wrap.style.opacity = (near * far).toFixed(3);
      c.wrap.style.visibility = near * far < 0.01 ? 'hidden' : '';
    });
    placeLines();
    world.style.transform = `rotateY(${(look.x * s.look).toFixed(3)}deg) rotateX(${(-look.y * s.look * 0.5).toFixed(3)}deg)`;
  }

  const cardAt = (x: number, y: number) => {
    const el = document.elementsFromPoint(x, y).find((n) => n.classList.contains('ipx-tile'));
    return cards.find((c) => c.tile === el) ?? null;
  };

  let hovered: (typeof cards)[number] | null = null;
  const setHover = (c: typeof hovered) => {
    if (c === hovered) return;
    hovered?.wrap.classList.remove('is-hover');
    hovered = c;
    c?.wrap.classList.add('is-hover');
    label.show(c?.item.title ?? null);
  };

  bindInput(stage, {
    wheel: (dx, dy) => (target += (Math.abs(dy) > Math.abs(dx) ? dy : dx) * s.wheel),
    move: (dx, dy) => (target -= (dy + dx * 0.5) * 2),
    up: (vx, vy, moved, e) => {
      if (moved) target -= (vy + vx * 0.5) * 0.35;
      else {
        const c = cardAt(e.clientX, e.clientY);
        if (c) openFocus(c.item, c.tile.getBoundingClientRect());
      }
    },
    hover: (x, y) => {
      label.move(x, y);
      setHover(cardAt(x, y));
      look.tx = (x / window.innerWidth) * 2 - 1;
      look.ty = (y / window.innerHeight) * 2 - 1;
    },
  });
  stage.addEventListener('pointerleave', () => setHover(null));
  window.addEventListener('keydown', (e) => {
    const by: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!(e.key in by)) return;
    e.preventDefault();
    target += by[e.key] * s.depth;
  });

  const still = reduced();
  loop((dt) => {
    if (!still) target += dt * 14; // a slow walk while idle
    travel += (target - travel) * (still ? 1 : ease(s.smoothing, dt));
    look.x += (look.tx - look.x) * ease(0.25, dt);
    look.y += (look.ty - look.y) * ease(0.25, dt);
    place();
  });

  layout();
  window.addEventListener('resize', layout);
  return { refresh: layout };
}
