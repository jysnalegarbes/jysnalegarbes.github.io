/*
  Waterfront ripple (hand-written WebGL, no library).

  window.RippleGL.mount(sceneEl, opts) -> null, or
    { ready: Promise, set(name, value), drop(x, y, strength), destroy() }

  The scene's <img data-ripple-img> stays in the DOM as the texture source and
  the fallback; the canvas [data-ripple-gl] draws over it, laid out like the
  image (object-fit: cover, centred), so the two match at every size.

  The look: the photo breathes like a reflection on calm water (slow domain
  warp + a faint caustic shimmer on the highlights). The pointer leaves
  expanding rings that bend the image with a slight RGB split. Uniforms the
  page drives:
    intro   1 -> 0  the image "settles" out of a wavy blur on load
    scroll  0 -> 1  warp and zoom grow as the section leaves the screen
  It renders only while on screen and the tab is visible.
*/
(function () {
  'use strict';

  var MAX_RIPPLES = 8;

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
    'uniform sampler2D u_tex;',
    'uniform vec4 u_map;', // px -> uv: uv = p * xy + zw
    'uniform vec2 u_size;', // canvas size in CSS px
    'uniform float u_time;',
    'uniform float u_intro;',
    'uniform float u_scroll;',
    'uniform float u_calm;', // overall strength of the idle water motion
    'uniform vec4 u_rip[' + MAX_RIPPLES + '];', // x, y (px), age (s), strength
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'void main() {',
    '  vec2 p = v_uv * u_size;',
    '  float k = min(u_size.x, u_size.y);',
    '  vec2 q = p / k;',
    // Idle water: two slow noise fields warp each other
    '  float t = u_time * 0.12;',
    '  vec2 w = vec2(noise(q * 3.0 + vec2(t, -t * 0.7)), noise(q * 3.0 + vec2(-t * 0.8, t) + 7.3));',
    '  vec2 flow = (vec2(noise(q * 2.2 + w * 1.6 + t), noise(q * 2.2 + w * 1.6 - t + 3.1)) - 0.5);',
    '  float amp = k * (0.006 * u_calm + 0.05 * u_intro + 0.03 * u_scroll);',
    '  vec2 disp = flow * amp;',
    // Pointer rings
    '  float ringSum = 0.0;',
    '  for (int i = 0; i < ' + MAX_RIPPLES + '; i++) {',
    '    vec4 r = u_rip[i];',
    '    vec2 d = p - r.xy;',
    '    float dist = length(d) + 0.0001;',
    '    float front = r.z * k * 0.55;',
    '    float x = (dist - front) / (k * 0.06);',
    '    float env = exp(-x * x) * exp(-r.z * 1.8) * r.w;',
    '    float wave = sin(x * 6.2832) * env;',
    '    disp += (d / dist) * wave * k * 0.018;',
    '    ringSum += abs(wave);',
    '  }',
    // Zoom out of centre while leaving
    '  vec2 c = u_size * 0.5;',
    '  vec2 pz = c + (p - c) / (1.0 + u_scroll * 0.08 + u_intro * 0.06);',
    '  vec2 uv = (pz + disp) * u_map.xy + u_map.zw;',
    '  float split = (ringSum * 0.004 + u_intro * 0.004) ;',
    '  vec2 o = vec2(split, 0.0);',
    '  vec3 col = vec3(texture2D(u_tex, uv + o).r, texture2D(u_tex, uv).g, texture2D(u_tex, uv - o).b);',
    // Caustic shimmer, only where the photo is already bright
    '  float lum = dot(col, vec3(0.299, 0.587, 0.114));',
    '  float caust = pow(abs(sin((w.x - w.y) * 9.0 + u_time * 0.6)), 14.0);',
    '  col += caust * smoothstep(0.35, 0.85, lum) * 0.10 * u_calm;',
    '  col += ringSum * 0.05;',
    // Soft fade-in from the page background during the intro
    '  col *= 1.0 - u_intro * 0.55;',
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

  function mount(scene, opts) {
    opts = opts || {};
    var canvas = scene.querySelector('[data-ripple-gl]');
    var img = scene.querySelector('[data-ripple-img]');
    var gl = canvas && canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl || !img) return null;

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
    ['u_tex', 'u_map', 'u_size', 'u_time', 'u_intro', 'u_scroll', 'u_calm', 'u_rip'].forEach(function (n) {
      loc[n] = gl.getUniformLocation(prog, n);
    });
    gl.uniform1i(loc.u_tex, 0);

    var state = { intro: opts.intro != null ? opts.intro : 0, scroll: 0, calm: opts.calm != null ? opts.calm : 1 };
    var ripples = new Float32Array(MAX_RIPPLES * 4); // all strength 0 to start
    var next = 0;
    var tex = null;
    var w = 0, h = 0, dpr = 1;
    var time = 0, last = 0, raf = 0;
    var onScreen = false, alive = true;

    function layout() {
      var r = canvas.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(loc.u_size, w, h);
      // object-fit: cover, centred
      var iw = img.naturalWidth, ih = img.naturalHeight;
      var s = Math.max(w / iw, h / ih);
      var dw = iw * s, dh = ih * s;
      var ox = (w - dw) / 2, oy = (h - dh) / 2;
      gl.uniform4f(loc.u_map, 1 / dw, 1 / dh, -ox / dw, -oy / dh);
    }

    function frame(now) {
      raf = 0;
      if (!alive) return;
      var dt = last ? (now - last) / 1000 : 0;
      last = now;
      // Never snap: clamp odd frame gaps (tab switches, negative dt)
      dt = Math.min(Math.max(dt, 0), 1 / 20);
      time += dt;
      for (var i = 0; i < MAX_RIPPLES; i++) ripples[i * 4 + 2] += dt;
      gl.uniform1f(loc.u_time, time);
      gl.uniform1f(loc.u_intro, state.intro);
      gl.uniform1f(loc.u_scroll, state.scroll);
      gl.uniform1f(loc.u_calm, state.calm);
      gl.uniform4fv(loc.u_rip, ripples);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    }

    function kick() {
      if (!raf && alive) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    }

    function drop(x, y, strength) {
      var r = canvas.getBoundingClientRect();
      var i = next * 4;
      ripples[i] = x - r.left;
      ripples[i + 1] = y - r.top;
      ripples[i + 2] = 0;
      ripples[i + 3] = strength == null ? 1 : strength;
      next = (next + 1) % MAX_RIPPLES;
      kick();
    }

    // Pointer: a ring every so often while moving, a big one on press
    var lx = -1e4, ly = -1e4, lt = 0;
    function move(e) {
      if (e.pointerType === 'touch') return;
      var dx = e.clientX - lx, dy = e.clientY - ly;
      var now = performance.now();
      if (dx * dx + dy * dy > 90 * 90 || now - lt > 900) {
        drop(e.clientX, e.clientY, 0.45);
        lx = e.clientX; ly = e.clientY; lt = now;
      }
    }
    function press(e) {
      if (e.target.closest('a, button')) return;
      drop(e.clientX, e.clientY, 1.2);
    }
    if (opts.pointer !== false) {
      scene.addEventListener('pointermove', move);
      scene.addEventListener('pointerdown', press);
    }

    var io = new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      if (onScreen) kick();
    });
    io.observe(scene);
    function vis() { if (!document.hidden) kick(); }
    document.addEventListener('visibilitychange', vis);

    var ro;
    var ready = loaded(img).then(function () {
      tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      layout();
      ro = new ResizeObserver(function () { layout(); kick(); });
      ro.observe(canvas);
      scene.classList.add('is-gl');
      kick();
    });

    return {
      ready: ready,
      set: function (name, value) {
        state[name] = value;
        kick();
      },
      drop: drop,
      destroy: function () {
        alive = false;
        io.disconnect();
        if (ro) ro.disconnect();
        document.removeEventListener('visibilitychange', vis);
        scene.removeEventListener('pointermove', move);
        scene.removeEventListener('pointerdown', press);
        scene.classList.remove('is-gl');
      },
    };
  }

  window.RippleGL = { mount: mount };
})();
