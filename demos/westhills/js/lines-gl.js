/*
  Flowing line backgrounds (hand-written WebGL, no library).

  Each <canvas data-lines-gl="image.webp"> draws the Figma line pattern as a
  texture, laid out like the <img> beside it (object-fit: cover, top-left).
  The shader only bends where it samples: a slow silk-like flow plus a soft
  lens that pushes the lines away from the cursor. The still <img> stays as
  the fallback (no WebGL, reduced motion, or before the texture loads).
*/
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var shot = new URLSearchParams(location.search).has('shot');
  if (reduce || shot) return;

  var VERT = [
    'attribute vec2 a_pos;',
    'varying vec2 v_uv;',
    'void main() {',
    '  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);', // top-left origin
    '  gl_Position = vec4(a_pos, 0.0, 1.0);',
    '}',
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'varying vec2 v_uv;',
    'uniform sampler2D u_tex;',
    'uniform vec2 u_scale;', // canvas px -> image uv (cover, top-left)
    'uniform float u_time;',
    'uniform vec2 u_mouse;', // canvas uv
    'uniform float u_hover;', // 0..1, eased
    'uniform float u_aspect;', // canvas width / height
    'void main() {',
    '  vec2 uv = v_uv;',
    '  float t = u_time;',
    // Slow flow: two layered low-frequency waves, like fabric settling
    '  vec2 flow = vec2(',
    '    sin(uv.y * 5.0 + t * 0.55 + sin(uv.x * 2.5 + t * 0.25)),',
    '    cos(uv.x * 4.0 - t * 0.45 + sin(uv.y * 3.5 - t * 0.2))',
    '  );',
    '  uv += flow * 0.0045;',
    // Cursor lens: sample nearer the cursor so lines bow away from it
    '  vec2 d = uv - u_mouse;',
    '  d.x *= u_aspect;',
    '  float r2 = dot(d, d);',
    '  float k = u_hover * exp(-r2 / 0.018);',
    '  vec2 dir = d * inversesqrt(r2 + 1e-5);',
    '  uv -= vec2(dir.x / u_aspect, dir.y) * k * 0.028;',
    '  vec2 st = uv * u_scale;',
    // Outside the image: transparent (no smeared edge pixels from the clamp)
    '  vec2 inside = step(vec2(0.0), st) * step(st, vec2(1.0));',
    '  gl_FragColor = texture2D(u_tex, st) * inside.x * inside.y;',
    '}',
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function mount(canvas) {
    var holder = canvas.parentElement;
    var gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;

    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) {
      return; // keep the still image
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var loc = {
      scale: gl.getUniformLocation(prog, 'u_scale'),
      time: gl.getUniformLocation(prog, 'u_time'),
      mouse: gl.getUniformLocation(prog, 'u_mouse'),
      hover: gl.getUniformLocation(prog, 'u_hover'),
      aspect: gl.getUniformLocation(prog, 'u_aspect'),
    };

    var img = new Image();
    var tex = null;
    var iw = 1;
    var ih = 1;
    var visible = false;
    var running = false;
    var last = 0;
    var time = 0;
    var mouse = { x: -10, y: -10 };
    var hover = 0;
    var hoverTarget = 0;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      // object-fit: cover, anchored top-left
      var cw = canvas.clientWidth;
      var ch = canvas.clientHeight;
      var s = Math.max(cw / iw, ch / ih);
      gl.uniform2f(loc.scale, cw / (iw * s), ch / (ih * s));
      gl.uniform1f(loc.aspect, cw / Math.max(1, ch));
    }

    function frame(now) {
      if (!visible) {
        running = false;
        return;
      }
      var dt = Math.min(Math.max((now - last) / 1000, 0), 0.05); // never snap, never go back
      last = now;
      time += dt;
      hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 6));
      gl.uniform1f(loc.time, time);
      gl.uniform1f(loc.hover, hover);
      gl.uniform2f(loc.mouse, mouse.x, mouse.y);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(frame);
    }

    function start() {
      if (running || !tex) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }

    img.onload = function () {
      iw = img.naturalWidth;
      ih = img.naturalHeight;
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      resize();
      holder.classList.add('is-gl');
      start();
    };
    img.src = canvas.getAttribute('data-lines-gl');

    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
    }).observe(canvas);

    window.addEventListener('resize', function () {
      if (tex) resize();
    });

    // The section, not the canvas, receives the pointer (canvas has no events)
    var section = holder.parentElement;
    section.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width;
      mouse.y = (e.clientY - r.top) / r.height;
      hoverTarget = 1;
    });
    section.addEventListener('pointerleave', function () {
      hoverTarget = 0;
    });
  }

  document.querySelectorAll('[data-lines-gl]').forEach(mount);
})();
