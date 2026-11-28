/*
  Hero slide transition (hand-written WebGL, no library).

  window.HeroGL.mount(heroEl) -> null, or { ready: Promise, show(i), transition(from, to, dir) }
  Each slide's <img> stays in the DOM as the texture source and the fallback.
  Textures are laid out exactly like their <img> (its box + object-fit: cover
  + object-position), so the canvas matches the CSS layout at every size.
  The effect: a slanted, noise-edged slash wipe; the outgoing image slides
  away, the incoming one slides in, with a brief RGB split along the edge.
  It only renders while a transition runs (and on resize).
*/
(function () {
  'use strict';

  var VERT = [
    'attribute vec2 a_pos;',
    'varying vec2 v_uv;',
    'void main() {',
    '  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);',
    '  gl_Position = vec4(a_pos, 0.0, 1.0);',
    '}',
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'varying vec2 v_uv;',
    'uniform sampler2D u_a;',
    'uniform sampler2D u_b;',
    'uniform vec4 u_ma;', // px -> uv for image A: uv = p * xy + zw
    'uniform vec4 u_mb;',
    'uniform vec2 u_size;', // canvas size in CSS px
    'uniform float u_t;', // 0..1
    'uniform float u_dir;', // 1 = next, -1 = previous
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'void main() {',
    '  vec2 p = v_uv * u_size;',
    // Position along the wipe, slanted like a slash; mirrored when going back
    '  float x = mix(1.0 - v_uv.x, v_uv.x, step(0.0, u_dir));',
    '  float coord = (x + (1.0 - v_uv.y) * 0.28) / 1.28;',
    '  float n = (noise(p * 0.008 + u_t * 2.5) - 0.5) * 0.14;',
    '  float w = 0.16;',
    '  float edge = u_t * (1.0 + w) - w;',
    '  float reveal = 1.0 - smoothstep(edge, edge + w, coord + n);',
    // Old image slides out, new slides in from the other side
    '  float slide = u_size.x * 0.08;',
    '  vec2 pa = p - vec2(u_dir * u_t * slide, 0.0);',
    '  vec2 pb = p + vec2(u_dir * (1.0 - u_t) * slide, 0.0);',
    '  vec2 uva = pa * u_ma.xy + u_ma.zw;',
    '  vec2 uvb = pb * u_mb.xy + u_mb.zw;',
    // RGB split, strongest right at the edge
    '  float band = reveal * (1.0 - reveal) * 4.0;',
    '  vec2 oa = vec2(u_dir * band * 10.0 * u_ma.x, 0.0);',
    '  vec2 ob = vec2(u_dir * band * 10.0 * u_mb.x, 0.0);',
    '  vec3 a = vec3(texture2D(u_a, uva + oa).r, texture2D(u_a, uva).g, texture2D(u_a, uva - oa).b);',
    '  vec3 b = vec3(texture2D(u_b, uvb + ob).r, texture2D(u_b, uvb).g, texture2D(u_b, uvb - ob).b);',
    // A thin bright seam rides the edge
    '  float seam = smoothstep(0.42, 0.5, reveal) * smoothstep(0.58, 0.5, reveal);',
    '  vec3 col = mix(a, b, reveal) + seam * 0.18;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}',
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function loaded(img) {
    if (img.complete && img.naturalWidth) return Promise.resolve();
    img.loading = 'eager';
    return new Promise(function (resolve, reject) {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', reject, { once: true });
    });
  }

  function mount(hero) {
    var canvas = hero.querySelector('[data-hero-gl]');
    var imgs = Array.prototype.slice.call(hero.querySelectorAll('[data-slide] img'));
    var gl = canvas && canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl || imgs.length < 2) return null;

    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) {
      return null;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var loc = {};
    ['u_a', 'u_b', 'u_ma', 'u_mb', 'u_size', 'u_t', 'u_dir'].forEach(function (n) {
      loc[n] = gl.getUniformLocation(prog, n);
    });
    gl.uniform1i(loc.u_a, 0);
    gl.uniform1i(loc.u_b, 1);

    var textures = [];
    var state = { a: 0, b: 0, t: 0, dir: 1 };

    function upload(img) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    }

    // Maps canvas CSS px to the image's uv, mirroring the <img> layout
    function mapping(img) {
      var h = hero.getBoundingClientRect();
      var r = img.getBoundingClientRect();
      var iw = img.naturalWidth;
      var ih = img.naturalHeight;
      var s = Math.max(r.width / iw, r.height / ih);
      var dw = iw * s;
      var dh = ih * s;
      var pos = getComputedStyle(img).objectPosition.split(' ');
      var px = parseFloat(pos[0]) / 100;
      var py = parseFloat(pos[1] || '50%') / 100;
      if (isNaN(px)) px = 0.5;
      if (isNaN(py)) py = 0.5;
      var ox = r.left - h.left + (r.width - dw) * px;
      var oy = r.top - h.top + (r.height - dh) * py;
      return [1 / dw, 1 / dh, -ox / dw, -oy / dh];
    }

    function draw() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = hero.clientWidth;
      var hgt = hero.clientHeight;
      var cw = Math.round(w * dpr);
      var ch = Math.round(hgt * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      gl.viewport(0, 0, cw, ch);
      gl.uniform2f(loc.u_size, w, hgt);
      gl.uniform4fv(loc.u_ma, mapping(imgs[state.a]));
      gl.uniform4fv(loc.u_mb, mapping(imgs[state.b]));
      gl.uniform1f(loc.u_t, state.t);
      gl.uniform1f(loc.u_dir, state.dir);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textures[state.a]);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, textures[state.b]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    var ready = Promise.all(imgs.map(loaded)).then(function () {
      imgs.forEach(function (img) { textures.push(upload(img)); });
      draw();
      hero.classList.add('is-gl');
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (textures.length) draw(); }, 60);
    });

    return {
      ready: ready,
      show: function (i) {
        state.a = state.b = i;
        state.t = 0;
        draw();
      },
      // Returns a GSAP tween driving the transition
      transition: function (from, to, dir) {
        state.a = from;
        state.b = to;
        state.dir = dir;
        state.t = 0;
        return gsap.to(state, {
          t: 1,
          duration: 1.3,
          ease: 'power3.inOut',
          onUpdate: draw,
          onComplete: function () {
            state.a = to;
            state.t = 0;
            draw();
          },
        });
      },
    };
  }

  window.HeroGL = { mount: mount };
})();
