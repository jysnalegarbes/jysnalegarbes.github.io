/*
  Pixel trail
  -----------
  A coarse grid that remembers where the cursor has been: each cell holds
  0..1, stamped along the cursor's path and fading back to 0. Uploaded as a
  small LUMINANCE texture (NEAREST, so every cell stays a hard block), it
  masks a shader effect to the cursor's trail, Produx footer style
  (produx.design). Used by the In Progress "Pixel Trail" hover and the
  Contact name reveal.
*/

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export class PixelTrail {
  cols = 1;
  rows = 1;
  private cells = new Float32Array(1);
  private bytes = new Uint8Array(1);
  private last: { x: number; y: number } | null = null;

  /** cols × rows cells */
  resize(cols: number, rows: number) {
    cols = Math.max(1, Math.round(cols));
    rows = Math.max(1, Math.round(rows));
    if (cols === this.cols && rows === this.rows) return;
    this.cols = cols;
    this.rows = rows;
    this.cells = new Float32Array(cols * rows);
    this.bytes = new Uint8Array(cols * rows);
    this.last = null;
  }

  /** Lift the pen: the next point starts a new stroke */
  lift() {
    this.last = null;
  }

  /**
   * Cursor at (x, y) in 0..1 of the area. Stamps a soft disc of `radius`
   * cells at every half cell along the path from the previous point.
   * `jitter` (0..1) roughens the disc's edge per cell, for a ragged block
   * edge rather than a clean circle.
   */
  move(x: number, y: number, radius: number, jitter = 0) {
    const p = { x: x * this.cols, y: y * this.rows };
    const from = this.last ?? p;
    this.last = p;
    const dist = Math.hypot(p.x - from.x, p.y - from.y);
    const steps = Math.max(1, Math.ceil(dist / 0.5));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      this.stamp(from.x + (p.x - from.x) * t, from.y + (p.y - from.y) * t, radius, jitter);
    }
  }

  private stamp(cx: number, cy: number, r: number, jitter: number) {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.cols - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.rows - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / Math.max(0.5, r);
        const edge = 1 - jitter * Math.random() * 0.6;
        const v = clamp((1 - d) * 1.6 * edge);
        const i = y * this.cols + x;
        if (v > this.cells[i]) this.cells[i] = v;
      }
    }
  }

  /** Fade every cell by dt / fade seconds. Returns whether any is still on. */
  decay(dt: number, fade: number) {
    const k = Math.max(0, dt) / Math.max(0.01, fade);
    let on = false;
    for (let i = 0; i < this.cells.length; i++) {
      const v = Math.max(0, this.cells[i] - k);
      this.cells[i] = v;
      if (v > 0) on = true;
    }
    return on;
  }

  clear() {
    this.cells.fill(0);
    this.last = null;
  }

  /** Writes the grid into `tex` (bound to the current texture unit) */
  upload(gl: WebGLRenderingContext, tex: WebGLTexture) {
    for (let i = 0; i < this.cells.length; i++) this.bytes[i] = Math.round(this.cells[i] * 255);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.cols, this.rows, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.bytes);
  }
}

/** A texture set up for PixelTrail.upload: hard blocks, clamped */
export function createTrailTexture(gl: WebGLRenderingContext) {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
