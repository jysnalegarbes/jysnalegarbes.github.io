/*
  Ink halftone
  ------------
  The "photo breaks into black ink dots, then resolves back" treatment,
  shared by every WebGL image on the site (About services hover and beyond
  photos, the home hero, the Work gallery). First made for the services
  hover (2026-11-04):
    - one dot per cell of a 45° screen, sampled at the cell's centre, its
      area following how dark the photo is there
    - black ink (--black) on paper (--white)
    - it resolves from the top down, the cells getting finer (12 → 4 px)
      as the dots fade into the photo

  GLSL use, in a fragment shader that has the photo's sampler:
    float ink = inkFront(uInk, fromTop);          // fromTop: 0 top, 1 bottom
    vec2 g = inkGrid(uv, sizePx, ink);            // uv: 0..1 over the image box
    vec3 c = texture2D(tex, <texture uv of inkCentre(g, sizePx, ink)>).rgb;
    color = mix(color, inkDots(g, ink, c), smoothstep(0., 1., ink));
  No branch around the sample: a texture read under per-pixel control flow
  can come back black.
*/

export const INK_HOLD = 0.55; // s the dots hold before resolving
export const INK_RESOLVE = 0.9; // s to resolve into the photo
export const INK_COLOR = [0x14 / 255, 0x19 / 255, 0x18 / 255]; // --black
export const INK_PAPER = [0xd7 / 255, 0xde / 255, 0xde / 255]; // --white

/** uInk for a halftone that started `seconds` ago: 1 all dots, 0 the photo
    (a frame stamped a hair before the start counts as the start). hold and
    resolve default to INK_HOLD / INK_RESOLVE. */
export function inkAt(seconds: number, hold = INK_HOLD, resolve = INK_RESOLVE) {
  const k = Math.min(1, Math.max(0, (seconds - hold) / resolve));
  return 1 - k * k * (3 - 2 * k); // smoothstep
}

export const INK_DONE = INK_HOLD + INK_RESOLVE;

export const inkGlsl = /* glsl */ `
  uniform vec3 uInkColor;
  uniform vec3 uPaper;

  const mat2 INK_ROT = mat2(0.7071, 0.7071, -0.7071, 0.7071);

  // How much of the halftone shows here; the top resolves first
  float inkFront(float amount, float fromTop) {
    return clamp(amount * 1.4 - (1. - fromTop) * 0.4, 0., 1.);
  }
  float inkCell(float ink) { return mix(4., 12., ink); } // CSS px

  // The same screen with the cell size given directly (CSS px), for effects
  // that drive it themselves (the About portrait)
  vec2 inkGridPx(vec2 uv, vec2 size, float cell) {
    return INK_ROT * (uv * size) / cell;
  }
  vec2 inkCentrePx(vec2 g, vec2 size, float cell) {
    return (floor(g) + 0.5) * cell * INK_ROT / size;
  }
  vec3 inkDotsPx(vec2 g, float cell, vec3 c) {
    float dark = 1. - dot(c, vec3(0.299, 0.587, 0.114));
    float r = sqrt(dark) * 0.62; // dot area follows darkness
    float aa = 1.2 / cell;
    float dotMask = 1. - smoothstep(r - aa, r + aa, length(fract(g) - 0.5));
    return mix(uPaper, uInkColor, dotMask);
  }

  // Position in the 45° screen, in cells
  vec2 inkGrid(vec2 uv, vec2 size, float ink) { return inkGridPx(uv, size, inkCell(ink)); }
  // The cell's centre, back in 0..1 image uv: sample the photo there
  vec2 inkCentre(vec2 g, vec2 size, float ink) { return inkCentrePx(g, size, inkCell(ink)); }
  // The dot for a cell whose centre colour is c
  vec3 inkDots(vec2 g, float ink, vec3 c) { return inkDotsPx(g, inkCell(ink), c); }
`;

/** Sets the ink and paper colours on a linked program */
export function setInkColors(gl: WebGLRenderingContext, program: WebGLProgram) {
  gl.useProgram(program);
  gl.uniform3fv(gl.getUniformLocation(program, 'uInkColor'), INK_COLOR);
  gl.uniform3fv(gl.getUniformLocation(program, 'uPaper'), INK_PAPER);
}
