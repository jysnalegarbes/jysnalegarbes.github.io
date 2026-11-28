var e=[20/255,25/255,24/255],t=[215/255,222/255,222/255];function n(e,t=.55,n=.9){let r=Math.min(1,Math.max(0,(e-t)/n));return 1-r*r*(3-2*r)}var r=1.4500000000000002,i=`
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
`;function a(n,r){n.useProgram(r),n.uniform3fv(n.getUniformLocation(r,`uInkColor`),e),n.uniform3fv(n.getUniformLocation(r,`uPaper`),t)}export{a as i,n,i as r,r as t};