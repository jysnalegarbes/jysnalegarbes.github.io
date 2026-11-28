import{t as e}from"./gsap.CvDoa17S.js";import{r as t}from"./lab-demo.CDV4dKc2.js";import{t as n}from"./portrait-fx.9pn35qgp.js";var r=4,i=`
  precision highp float;
  attribute vec2 aPosition;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform vec2 texelSize;

  void main () {
    vUv = aPosition * 0.5 + 0.5;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`,a=`
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  uniform sampler2D uTexture;

  void main () {
    gl_FragColor = max(texture2D(uTexture, vUv), 0.0);
  }
`,o=`
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  uniform sampler2D uTexture;
  uniform float value;

  void main () {
    gl_FragColor = value * texture2D(uTexture, vUv);
  }
`,s=`
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;

  void main () {
    vec2 p = vUv - point.xy;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
  }
`,c=`
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform vec2 dyeTexelSize;
  uniform float dt;
  uniform float dissipation;

  vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
    vec2 st = uv / tsize - 0.5;
    vec2 iuv = floor(st);
    vec2 fuv = fract(st);
    vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
    vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
    vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
    vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
    return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
  }

  void main () {
  #ifdef MANUAL_FILTERING
    vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
    vec4 result = bilerp(uSource, coord, dyeTexelSize);
  #else
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    vec4 result = texture2D(uSource, coord);
  #endif
    float decay = 1.0 + dissipation * dt;
    gl_FragColor = result / decay;
  }
`,l=`
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uVelocity;

  void main () {
    float L = texture2D(uVelocity, vL).x;
    float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y;
    float B = texture2D(uVelocity, vB).y;
    vec2 C = texture2D(uVelocity, vUv).xy;
    if (vL.x < 0.0) { L = -C.x; }
    if (vR.x > 1.0) { R = -C.x; }
    if (vT.y > 1.0) { T = -C.y; }
    if (vB.y < 0.0) { B = -C.y; }
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`,u=`
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uVelocity;

  void main () {
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    float vorticity = R - L - T + B;
    gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
  }
`,d=`
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform float curl;
  uniform float dt;

  void main () {
    float L = texture2D(uCurl, vL).x;
    float R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x;
    float B = texture2D(uCurl, vB).x;
    float C = texture2D(uCurl, vUv).x;
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity += force * dt;
    velocity = min(max(velocity, -1000.0), 1000.0);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`,f=`
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;

  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`,p=`
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;

  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`,m=`
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uTexture;
  uniform vec2 texelSize;
  uniform vec3 uColor;
  uniform float uMode;
  uniform float uEdge;
  uniform float uSoftness;
  uniform float uShading;
  uniform float uVeil;   // 0..1 noise-edged ink cover (page loader)
  uniform float uTime;
  uniform float uAspect;

  float hash (vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise (vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm (vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main () {
    float d = texture2D(uTexture, vUv).r;
    float mask = uMode > 0.5
      ? smoothstep(uEdge - uSoftness, uEdge + uSoftness, d)
      : clamp(d, 0.0, 1.0);

    // Veil: domain-warped noise thresholded with the same ink edge, so the
    // cover lifts in blotches (noise dissolve, as in gl-transitions).
    if (uVeil > 0.0) {
      vec2 q = vec2(vUv.x * uAspect, vUv.y) * 2.5;
      vec2 warp = vec2(fbm(q + uTime * 0.12), fbm(q + 5.2 - uTime * 0.08));
      float n = fbm(q + warp * 1.6);
      float threshold = mix(-0.05, 1.05, uVeil);
      float softness = max(uSoftness, 0.004);
      mask = max(mask, 1.0 - smoothstep(threshold - softness, threshold + softness, n));
    }

    // Shading reads density clamped to 1, so dense interiors stay flat (the
    // true tint) and only the thinning rim picks up a soft bevel.
    float shade = 1.0;
    if (uShading > 0.5) {
      float dx = min(texture2D(uTexture, vR).r, 1.0) - min(texture2D(uTexture, vL).r, 1.0);
      float dy = min(texture2D(uTexture, vT).r, 1.0) - min(texture2D(uTexture, vB).r, 1.0);
      vec3 n = normalize(vec3(dx, dy, length(texelSize)));
      shade = clamp(n.z + 0.7, 0.7, 1.0);
    }

    gl_FragColor = vec4(uColor * mask * shade, 1.0);
  }
`;function h(e){let t=parseInt(e.replace(`#`,``),16);return[(t>>16&255)/255,(t>>8&255)/255,(t&255)/255]}function g({canvas:e,tintCanvas:t,tint:n,config:g}){let _={alpha:!1,depth:!1,stencil:!1,antialias:!1,preserveDrawingBuffer:!1},v=e.getContext(`webgl2`,_),y=v??e.getContext(`webgl`,_),b=t.getContext(`2d`,{alpha:!1});if(!y||!b)return null;let x=!!v,S,C;if(x)y.getExtension(`EXT_color_buffer_float`),S=y.HALF_FLOAT,C=!0;else{let e=y.getExtension(`OES_texture_half_float`);if(!e)return null;S=e.HALF_FLOAT_OES,C=!!y.getExtension(`OES_texture_half_float_linear`)}let w=(e,t)=>{let n=y.createTexture();y.bindTexture(y.TEXTURE_2D,n),y.texParameteri(y.TEXTURE_2D,y.TEXTURE_MIN_FILTER,y.NEAREST),y.texParameteri(y.TEXTURE_2D,y.TEXTURE_MAG_FILTER,y.NEAREST),y.texParameteri(y.TEXTURE_2D,y.TEXTURE_WRAP_S,y.CLAMP_TO_EDGE),y.texParameteri(y.TEXTURE_2D,y.TEXTURE_WRAP_T,y.CLAMP_TO_EDGE),y.texImage2D(y.TEXTURE_2D,0,e,4,4,0,t,S,null);let r=y.createFramebuffer();y.bindFramebuffer(y.FRAMEBUFFER,r),y.framebufferTexture2D(y.FRAMEBUFFER,y.COLOR_ATTACHMENT0,y.TEXTURE_2D,n,0);let i=y.checkFramebufferStatus(y.FRAMEBUFFER)===y.FRAMEBUFFER_COMPLETE;return y.deleteFramebuffer(r),y.deleteTexture(n),i},T=e=>{if(!x)return w(y.RGBA,y.RGBA)?{internalFormat:y.RGBA,format:y.RGBA}:null;let t=y;return[{internalFormat:t.R16F,format:t.RED},{internalFormat:t.RG16F,format:t.RG},{internalFormat:t.RGBA16F,format:t.RGBA}].slice(e===1?0:e===2?1:2).find(e=>w(e.internalFormat,e.format))??null},E=T(1),D=T(2);if(!E||!D)return null;let O=(e,t,n=[])=>{let r=y.createShader(e);if(y.shaderSource(r,n.map(e=>`#define ${e}\n`).join(``)+t),y.compileShader(r),!y.getShaderParameter(r,y.COMPILE_STATUS))throw Error(y.getShaderInfoLog(r)??`Shader compile failed`);return r},k=O(y.VERTEX_SHADER,i),A=(e,t=[])=>{let n=y.createProgram();if(y.attachShader(n,k),y.attachShader(n,O(y.FRAGMENT_SHADER,e,t)),y.bindAttribLocation(n,0,`aPosition`),y.linkProgram(n),!y.getProgramParameter(n,y.LINK_STATUS))throw Error(y.getProgramInfoLog(n)??`Program link failed`);let r={},i=y.getProgramParameter(n,y.ACTIVE_UNIFORMS);for(let e=0;e<i;e++){let t=y.getActiveUniform(n,e).name;r[t]=y.getUniformLocation(n,t)}return{p:n,u:r,bind:()=>y.useProgram(n)}},j;try{j={clear:A(o),clamp:A(a),splat:A(s),advection:A(c,C?[]:[`MANUAL_FILTERING`]),divergence:A(l),curl:A(u),vorticity:A(d),pressure:A(f),gradientSubtract:A(p),display:A(m)}}catch(e){return console.warn(`[fluid-trail]`,e),null}y.bindBuffer(y.ARRAY_BUFFER,y.createBuffer()),y.bufferData(y.ARRAY_BUFFER,new Float32Array([-1,-1,-1,1,1,1,1,-1]),y.STATIC_DRAW),y.bindBuffer(y.ELEMENT_ARRAY_BUFFER,y.createBuffer()),y.bufferData(y.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,0,2,3]),y.STATIC_DRAW),y.vertexAttribPointer(0,2,y.FLOAT,!1,0,0),y.enableVertexAttribArray(0);let M=e=>{e?(y.viewport(0,0,e.width,e.height),y.bindFramebuffer(y.FRAMEBUFFER,e.fbo)):(y.viewport(0,0,y.drawingBufferWidth,y.drawingBufferHeight),y.bindFramebuffer(y.FRAMEBUFFER,null)),y.drawElements(y.TRIANGLES,6,y.UNSIGNED_SHORT,0)},N=[],P=[],F=(e,t,{internalFormat:n,format:r},i)=>{y.activeTexture(y.TEXTURE0);let a=y.createTexture();y.bindTexture(y.TEXTURE_2D,a),y.texParameteri(y.TEXTURE_2D,y.TEXTURE_MIN_FILTER,i),y.texParameteri(y.TEXTURE_2D,y.TEXTURE_MAG_FILTER,i),y.texParameteri(y.TEXTURE_2D,y.TEXTURE_WRAP_S,y.CLAMP_TO_EDGE),y.texParameteri(y.TEXTURE_2D,y.TEXTURE_WRAP_T,y.CLAMP_TO_EDGE),y.texImage2D(y.TEXTURE_2D,0,n,e,t,0,r,S,null);let o=y.createFramebuffer();return y.bindFramebuffer(y.FRAMEBUFFER,o),y.framebufferTexture2D(y.FRAMEBUFFER,y.COLOR_ATTACHMENT0,y.TEXTURE_2D,a,0),y.viewport(0,0,e,t),y.clearColor(0,0,0,1),y.clear(y.COLOR_BUFFER_BIT),N.push(a),P.push(o),{texture:a,fbo:o,width:e,height:t,texelSizeX:1/e,texelSizeY:1/t,attach(e){return y.activeTexture(y.TEXTURE0+e),y.bindTexture(y.TEXTURE_2D,a),e}}},I=(e,t,n,r)=>{let i=F(e,t,n,r),a=F(e,t,n,r);return{width:e,height:t,texelSizeX:i.texelSizeX,texelSizeY:i.texelSizeY,get read(){return i},get write(){return a},swap(){[i,a]=[a,i]}}},ee=e=>{let t=y.drawingBufferWidth,n=y.drawingBufferHeight,r=t>n?t/n:n/t,i=Math.round(e),a=Math.round(e*r);return t>n?{width:a,height:i}:{width:i,height:a}},L,R,z,B,V,H=()=>{N.splice(0).forEach(e=>y.deleteTexture(e)),P.splice(0).forEach(e=>y.deleteFramebuffer(e));let e=C?y.LINEAR:y.NEAREST,t=Math.min(y.drawingBufferWidth,y.drawingBufferHeight),n=ee(g.simResolution),r=ee(Math.min(g.dyeResolution,t));y.disable(y.BLEND),L=I(r.width,r.height,E,e),R=I(n.width,n.height,D,e),z=F(n.width,n.height,E,y.NEAREST),B=F(n.width,n.height,E,y.NEAREST),V=I(n.width,n.height,E,y.NEAREST)},U=()=>{let n=Math.min(window.devicePixelRatio||1,1.5),r=Math.max(1,Math.round(e.clientWidth*n)),i=Math.max(1,Math.round(e.clientHeight*n));e.width===r&&e.height===i&&L||(e.width=t.width=r,e.height=t.height=i,H())},W=()=>e.width/e.height,G=(e,t,n,r,i=g.intensity,a=g.splatRadius/100)=>{let{splat:o}=j;o.bind(),y.uniform1i(o.u.uTarget,R.read.attach(0)),y.uniform1f(o.u.aspectRatio,W()),y.uniform2f(o.u.point,e,t),y.uniform3f(o.u.color,n,r,0),y.uniform1f(o.u.radius,W()>1?a*W():a),M(R.write),R.swap(),y.uniform1i(o.u.uTarget,L.read.attach(0));let s=i;y.uniform3f(o.u.color,s,s,s),M(L.write),L.swap()},te=e=>{let t=j;y.disable(y.BLEND),t.curl.bind(),y.uniform2f(t.curl.u.texelSize,R.texelSizeX,R.texelSizeY),y.uniform1i(t.curl.u.uVelocity,R.read.attach(0)),M(B),t.vorticity.bind(),y.uniform2f(t.vorticity.u.texelSize,R.texelSizeX,R.texelSizeY),y.uniform1i(t.vorticity.u.uVelocity,R.read.attach(0)),y.uniform1i(t.vorticity.u.uCurl,B.attach(1)),y.uniform1f(t.vorticity.u.curl,g.curl),y.uniform1f(t.vorticity.u.dt,e),M(R.write),R.swap(),t.divergence.bind(),y.uniform2f(t.divergence.u.texelSize,R.texelSizeX,R.texelSizeY),y.uniform1i(t.divergence.u.uVelocity,R.read.attach(0)),M(z),t.clear.bind(),y.uniform1i(t.clear.u.uTexture,V.read.attach(0)),y.uniform1f(t.clear.u.value,g.pressure),M(V.write),V.swap(),t.pressure.bind(),y.uniform2f(t.pressure.u.texelSize,R.texelSizeX,R.texelSizeY),y.uniform1i(t.pressure.u.uDivergence,z.attach(0));for(let e=0;e<g.pressureIterations;e++)y.uniform1i(t.pressure.u.uPressure,V.read.attach(1)),M(V.write),V.swap();t.gradientSubtract.bind(),y.uniform2f(t.gradientSubtract.u.texelSize,R.texelSizeX,R.texelSizeY),y.uniform1i(t.gradientSubtract.u.uPressure,V.read.attach(0)),y.uniform1i(t.gradientSubtract.u.uVelocity,R.read.attach(1)),M(R.write),R.swap(),t.advection.bind(),y.uniform2f(t.advection.u.texelSize,R.texelSizeX,R.texelSizeY),C||y.uniform2f(t.advection.u.dyeTexelSize,R.texelSizeX,R.texelSizeY);let n=R.read.attach(0);y.uniform1i(t.advection.u.uVelocity,n),y.uniform1i(t.advection.u.uSource,n),y.uniform1f(t.advection.u.dt,e),y.uniform1f(t.advection.u.dissipation,g.velocityDissipation),M(R.write),R.swap(),C||y.uniform2f(t.advection.u.dyeTexelSize,L.texelSizeX,L.texelSizeY),y.uniform1i(t.advection.u.uVelocity,R.read.attach(0)),y.uniform1i(t.advection.u.uSource,L.read.attach(1)),y.uniform1f(t.advection.u.dissipation,g.densityDissipation),M(L.write),L.swap()},K=h(n),q=(e,t)=>{let{display:n}=j;n.bind(),y.uniform2f(n.u.texelSize,L.texelSizeX,L.texelSizeY),y.uniform1i(n.u.uTexture,L.read.attach(0)),y.uniform3f(n.u.uColor,...e),y.uniform1f(n.u.uMode,g.mode),y.uniform1f(n.u.uEdge,g.inkEdge),y.uniform1f(n.u.uSoftness,g.inkSoftness),y.uniform1f(n.u.uShading,+!!t),y.uniform1f(n.u.uVeil,ie),y.uniform1f(n.u.uTime,ae),y.uniform1f(n.u.uAspect,W()),M(null)},ne=()=>{q(K,g.shading),b.drawImage(e,0,0),q([1,1,1],!1)},J={x:0,y:0,dx:0,dy:0,inside:!1,moved:!1},re=!0,ie=0,ae=0,oe=(e,t)=>{if(!re){J.inside=!1;return}let n=e/window.innerWidth,r=1-t/window.innerHeight;if(J.inside){let e=W(),t=n-J.x,i=r-J.y;e<1&&(t*=e),e>1&&(i/=e),J.dx+=t,J.dy+=i,J.moved=!0}J.x=n,J.y=r,J.inside=!0,Q=0,$()},se=e=>{e.pointerType!==`touch`&&oe(e.clientX,e.clientY)},Y=e=>{let t=e.touches[0];t&&oe(t.clientX,t.clientY)},ce=e=>{J.inside=!1,Y(e)},le=e=>{e.relatedTarget||(J.inside=!1)},X=0,Z=0,Q=1/0,ue=e=>{X=0,U();let t=Math.min((e-Z)/1e3,1/60);Z=e,Q+=t,ae+=t,J.moved&&=(G(J.x,J.y,J.dx*g.splatForce,J.dy*g.splatForce),J.dx=J.dy=0,!1),te(t),ne(),Q<r&&(X=requestAnimationFrame(ue))};function $(){X||document.hidden||(Z=performance.now(),X=requestAnimationFrame(ue))}let de=()=>{document.hidden&&X?(cancelAnimationFrame(X),X=0):$()},fe=()=>$();return U(),window.addEventListener(`pointermove`,se,{passive:!0}),window.addEventListener(`touchstart`,ce,{passive:!0}),window.addEventListener(`touchmove`,Y,{passive:!0}),document.addEventListener(`pointerout`,le),document.addEventListener(`visibilitychange`,de),window.addEventListener(`resize`,fe),{update(e,t){let n=e.simResolution!==void 0&&e.simResolution!==g.simResolution||e.dyeResolution!==void 0&&e.dyeResolution!==g.dyeResolution;Object.assign(g,e),t&&(K=h(t)),n&&H(),Q=0,$()},splash(e=5){for(let t=0;t<e;t++){let e=Math.random()*Math.PI*2;G(Math.random(),Math.random(),Math.cos(e)*1e3,Math.sin(e)*1e3)}Q=0,$()},splatAt(e,t,n={}){G(e,t,n.dx??0,n.dy??0,n.amount??g.intensity,n.radius??g.splatRadius/100),Q=0,$()},clampInk(){let{clamp:e}=j;e.bind(),y.uniform1i(e.u.uTexture,L.read.attach(0)),M(L.write),L.swap(),Q=0,$()},setVeil(e){ie=e,Q=0,$()},flood(e=4){G(.5,.5,0,0,e,1e4),Q=0,$()},setInput(e){re=e},renderNow(){U(),ne()},destroy(){X&&cancelAnimationFrame(X),window.removeEventListener(`pointermove`,se),window.removeEventListener(`touchstart`,ce),window.removeEventListener(`touchmove`,Y),document.removeEventListener(`pointerout`,le),document.removeEventListener(`visibilitychange`,de),window.removeEventListener(`resize`,fe),N.forEach(e=>y.deleteTexture(e)),P.forEach(e=>y.deleteFramebuffer(e))}}}var _=`http://www.w3.org/2000/svg`;function v(){let e=document.querySelector(`.site-header`);return e?[`.brand__mark`,`.brand__wordmark`,`.badge__lottie`,`.badge__text`,`.menu__title`,`.menu__link`].flatMap(t=>[...e.querySelectorAll(t)]).filter(e=>e.getClientRects().length>0):[]}function y(e){let t=window.innerWidth/2,n=e=>{let n=e.getBoundingClientRect();return Math.hypot(n.left+n.width/2-t,n.top+n.height/2)};return[...e].sort((e,t)=>n(e)-n(t))}function b(t,n,r){let i=y(v()),a=()=>S.classList.remove(`header-pending`);if(!i.length)return a();if(t===1){let t=document.createElementNS(_,`svg`);t.setAttribute(`aria-hidden`,`true`),Object.assign(t.style,{position:`absolute`,width:`0`,height:`0`}),document.body.append(t);let n=i.map((e,n)=>{let r=document.createElementNS(_,`filter`);r.id=`ink-goo-${n}`,r.setAttribute(`x`,`-50%`),r.setAttribute(`y`,`-50%`),r.setAttribute(`width`,`200%`),r.setAttribute(`height`,`200%`),r.setAttribute(`color-interpolation-filters`,`sRGB`);let i=document.createElementNS(_,`feGaussianBlur`);i.setAttribute(`in`,`SourceGraphic`),i.setAttribute(`stdDeviation`,`10`);let a=document.createElementNS(_,`feColorMatrix`);return a.setAttribute(`type`,`matrix`),a.setAttribute(`values`,`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8`),r.append(i,a),t.append(r),e.style.filter=`url(#${r.id})`,i});e.set(i,{opacity:0}),a();let r=e.timeline({onComplete:()=>{i.forEach(e=>e.style.filter=``),t.remove()}});i.forEach((e,t)=>{let i=t*.07;r.to(e,{opacity:1,duration:.25,ease:`power1.out`},i),r.fromTo(e,{scale:.92},{scale:1,duration:1.1,ease:`elastic.out(1, 0.6)`,clearProps:`transform`},i),r.fromTo(n[t],{attr:{stdDeviation:10}},{attr:{stdDeviation:0},duration:1.1,ease:`power3.out`},i)});return}if(t===2){e.set(i,{clipPath:`inset(0% 0% 100% 0%)`,yPercent:60}),a(),e.to(i,{clipPath:`inset(0% 0% 0% 0%)`,yPercent:0,duration:.9,ease:`expo.out`,stagger:.07,clearProps:`clipPath,transform`});return}e.set(i,{opacity:0}),a(),n&&(n.clampInk(),n.update({densityDissipation:3.5}));let o=window.innerWidth/window.innerHeight;i.forEach((t,r)=>{e.delayedCall(r*.09,()=>{let r=t.getBoundingClientRect(),i=(r.left+r.width/2)/window.innerWidth,a=1-(r.top+r.height/2)/window.innerHeight,s=.55*Math.max(r.width,r.height,18)/window.innerHeight;n?.splatAt(i,a,{amount:2,radius:s*s/(o*Math.log(2/.35))}),e.to(t,{opacity:1,duration:.2,ease:`power1.out`})})}),e.delayedCall(i.length*.09+2,()=>n?.update({densityDissipation:r}))}var x=1.8,S=document.documentElement,C=e=>new Promise(t=>{let n=new Image;n.onload=n.onerror=()=>t(),n.src=e}),w=()=>new Promise(e=>{document.readyState===`complete`?e():window.addEventListener(`load`,()=>e(),{once:!0})});function T(t,n){let r=0;t.forEach(e=>e.finally(()=>r++));let i=performance.now(),a=i,o=0;return new Promise(s=>{let c=()=>{let l=performance.now(),u=(l-i)/1e3,d=Math.min((l-a)/1e3,.25);a=l;let f=Math.min(r/t.length,u/x)*100;o+=(f-o)*(1-Math.exp(-d*8)),f>=100&&o>99.5&&(o=100),n(o),o>=100&&(e.ticker.remove(c),s())};e.ticker.add(c)})}async function E({option:t,fluid:n,portraitFx:r,portrait:i,frameImg:a,heroImg:o,frames:s,baseDissipation:c,headerIntro:l=1}){let u=document.querySelector(`[data-loader]`),d=u?.querySelector(`[data-loader-count]`),f=u?.querySelector(`[data-loader-cover]`);if(!u||!d)return g();n?.setInput(!1),(t===1||t===2)&&!n&&(t=4),S.dataset.loaderOption=String(t),(t===1||t===2)&&(n.update({densityDissipation:0}),t===1?n.flood(4):n.setVeil(1),n.renderNow(),f?.remove(),S.classList.add(`loader-inked`));let p=[document.fonts.ready,o.decode().catch(()=>{}),w()];t===3&&p.push(...s.map(C)),await T(p,e=>{if(d.textContent=String(Math.floor(e)).padStart(2,`0`),t===2&&n.setVeil(1-e/100*.3),t===3&&s.length){let t=Math.min(s.length-1,Math.floor(e/100*s.length));a.hidden=e>=100,!a.hidden&&!a.src.endsWith(s[t])&&(a.src=s[t])}});let m=e.timeline();if(m.to(d,{yPercent:-110,duration:.6,ease:`expo.in`},0),t===1){let e={r:0};for(let e=0;e<10;e++){let t=e/10*Math.PI*2;n.splatAt(.5+Math.cos(t)*.04,.5+Math.sin(t)*.04,{dx:Math.cos(t)*2500,dy:Math.sin(t)*2500,amount:0,radius:.004})}let t=0;m.to(e,{r:.9,duration:1.1,ease:`power2.in`,onStart:()=>t=performance.now(),onComplete:()=>n.clampInk(),onUpdate:()=>{let r=performance.now(),i=Math.min((r-t)/1e3,.1);t=r,n.splatAt(.5,.5,{amount:-60*i,radius:5e-4+e.r*e.r})}},.2),m.add(()=>n.update({densityDissipation:6}),1.1),m.add(h,.7)}else if(t===2){let e={veil:.7};m.to(e,{veil:0,duration:1.8,ease:`power2.inOut`,onUpdate:()=>n.setVeil(e.veil)},.1),m.add(h,.7)}else if(t===3)m.add(h,.15);else{let e=u.querySelector(`[data-loader-cover]`),t=u.querySelector(`[data-loader-drip]`);m.to(e,{yPercent:-100,duration:1.2,ease:`expo.inOut`},.25).fromTo(t,{scaleY:0},{scaleY:1,duration:.6,ease:`power2.in`},.25).to(t,{scaleY:0,duration:.7,ease:`power3.out`},.85),m.add(h,.85)}await m.then(),(t===1||t===2)&&e.delayedCall(1.2,()=>{n.update({densityDissipation:c}),n.setVeil(0)});function h(){let a=e.utils.toArray(`.home__title > span`),o=e.utils.toArray(`.home__copy`),s=e.timeline({onComplete:g});s.add(()=>b(l,n,c),.55),s.fromTo(a,{clipPath:`inset(0% 0% 100% 0%)`,y:40},{clipPath:`inset(0% 0% 0% 0%)`,y:0,duration:1.1,ease:`expo.out`,stagger:.12,clearProps:`clipPath,transform`},0),t!==3&&s.fromTo(i,{clipPath:`inset(100% 0% 0% 0%)`},{clipPath:`inset(0% 0% 0% 0%)`,duration:1.1,ease:`expo.inOut`,clearProps:`clipPath`},.05),s.add(()=>r?.ripple(),t===3?0:.5),s.fromTo(o,{opacity:0,y:12},{opacity:1,y:0,duration:.8,ease:`power2.out`,stagger:.08},.35),S.classList.remove(`is-loading`)}function g(){S.classList.remove(`is-loading`,`loader-inked`,`header-pending`),delete S.dataset.loaderOption,u?.remove(),n?.setInput(!0)}}var D=document.documentElement,O=document.querySelector(`[data-fluid]`),k=document.querySelector(`[data-fluid-tint]`),A=document.querySelector(`[data-portrait]`),j=A?.querySelector(`[data-portrait-frame]`),M=A?.querySelector(`.home__hero`),N=2.05,P=O&&k?g({canvas:O,tintCanvas:k,tint:`#141918`,config:{mode:1,curl:4,densityDissipation:N,velocityDissipation:1.05,pressure:1,pressureIterations:22,splatRadius:.24,splatForce:500,shading:!1,simResolution:96,dyeResolution:1024,intensity:.85,inkEdge:.35,inkSoftness:.01}}):null,F=A?n(A,{dentDepth:1,dentRadius:.08,rgbSplit:.12}):null;if(D.classList.contains(`is-loading`)&&A&&j&&M){let e=E({option:Number(D.dataset.loaderOption),headerIntro:Number(D.dataset.headerIntro),fluid:P,portraitFx:F,portrait:A,frameImg:j,heroImg:M,frames:JSON.parse(A.dataset.frames??`[]`),baseDissipation:N});t(e,3.5)}