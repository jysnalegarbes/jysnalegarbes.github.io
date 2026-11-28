const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["_astro/portrait-fx.9pn35qgp.js","_astro/rolldown-runtime.BCiCTKAo.js","_astro/ink-halftone.DDtCBRyx.js","_astro/page-loader.DLQNlqoP.js","_astro/gsap.CvDoa17S.js","_astro/config-pane.xgM-6VZV.js","_astro/tweakpane.B9yL4GGH.js","_astro/fluid-tweaks.kmmJ96KD.js"])))=>i.map(i=>d[i]);
import{t as e}from"./gsap.CvDoa17S.js";import{n as t,t as n}from"./ink-goo.siIIh3zL.js";import{t as r}from"./preload-helper.DHhhL8Zf.js";var i=4,a=`
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
`,o=`
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  uniform sampler2D uTexture;

  void main () {
    gl_FragColor = max(texture2D(uTexture, vUv), 0.0);
  }
`,s=`
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  uniform sampler2D uTexture;
  uniform float value;

  void main () {
    gl_FragColor = value * texture2D(uTexture, vUv);
  }
`,c=`
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
`,l=`
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
`,d=`
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
`,ee=`
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
`,te=`
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
`,f=`
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
`,ne=`
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

  void main () {
    float d = texture2D(uTexture, vUv).r;
    float mask = uMode > 0.5
      ? smoothstep(uEdge - uSoftness, uEdge + uSoftness, d)
      : clamp(d, 0.0, 1.0);

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
`,p=`
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uTexture;
  uniform sampler2D uText;
  uniform vec2 texelSize;
  uniform vec3 uColor;
  uniform vec3 uPaper;
  uniform float uMode;
  uniform float uEdge;
  uniform float uSoftness;
  uniform float uShading;

  void main () {
    float d = texture2D(uTexture, vUv).r;
    float mask = uMode > 0.5
      ? smoothstep(uEdge - uSoftness, uEdge + uSoftness, d)
      : clamp(d, 0.0, 1.0);
    float dx = min(texture2D(uTexture, vR).r, 1.0) - min(texture2D(uTexture, vL).r, 1.0);
    float dy = min(texture2D(uTexture, vT).r, 1.0) - min(texture2D(uTexture, vB).r, 1.0);
    vec3 n = normalize(vec3(dx, dy, length(texelSize)));
    float shade = mix(1.0, clamp(n.z + 0.7, 0.7, 1.0), uShading);
    // The type canvas is uploaded top row first: flip to the dye's uv
    float text = texture2D(uText, vec2(vUv.x, 1.0 - vUv.y)).a;
    gl_FragColor = vec4(mix(uPaper, uColor * shade, mask * text), 1.0);
  }
`;function m(e){let t=parseInt(e.replace(`#`,``),16);return[(t>>16&255)/255,(t>>8&255)/255,(t&255)/255]}function h({canvas:e,tintCanvas:t,tint:n,config:r,reveal:h}){let g={alpha:!1,depth:!1,stencil:!1,antialias:!1,preserveDrawingBuffer:!1},_=e.getContext(`webgl2`,g),v=_??e.getContext(`webgl`,g),y=t?.getContext(`2d`,{alpha:!1})??null;if(!v||!y&&!h)return null;let b=!!_,x,S;if(b)v.getExtension(`EXT_color_buffer_float`),x=v.HALF_FLOAT,S=!0;else{let e=v.getExtension(`OES_texture_half_float`);if(!e)return null;x=e.HALF_FLOAT_OES,S=!!v.getExtension(`OES_texture_half_float_linear`)}let C=(e,t)=>{let n=v.createTexture();v.bindTexture(v.TEXTURE_2D,n),v.texParameteri(v.TEXTURE_2D,v.TEXTURE_MIN_FILTER,v.NEAREST),v.texParameteri(v.TEXTURE_2D,v.TEXTURE_MAG_FILTER,v.NEAREST),v.texParameteri(v.TEXTURE_2D,v.TEXTURE_WRAP_S,v.CLAMP_TO_EDGE),v.texParameteri(v.TEXTURE_2D,v.TEXTURE_WRAP_T,v.CLAMP_TO_EDGE),v.texImage2D(v.TEXTURE_2D,0,e,4,4,0,t,x,null);let r=v.createFramebuffer();v.bindFramebuffer(v.FRAMEBUFFER,r),v.framebufferTexture2D(v.FRAMEBUFFER,v.COLOR_ATTACHMENT0,v.TEXTURE_2D,n,0);let i=v.checkFramebufferStatus(v.FRAMEBUFFER)===v.FRAMEBUFFER_COMPLETE;return v.deleteFramebuffer(r),v.deleteTexture(n),i},w=e=>{if(!b)return C(v.RGBA,v.RGBA)?{internalFormat:v.RGBA,format:v.RGBA}:null;let t=v;return[{internalFormat:t.R16F,format:t.RED},{internalFormat:t.RG16F,format:t.RG},{internalFormat:t.RGBA16F,format:t.RGBA}].slice(e===1?0:e===2?1:2).find(e=>C(e.internalFormat,e.format))??null},T=w(1),E=w(2);if(!T||!E)return null;let D=(e,t,n=[])=>{let r=v.createShader(e);if(v.shaderSource(r,n.map(e=>`#define ${e}\n`).join(``)+t),v.compileShader(r),!v.getShaderParameter(r,v.COMPILE_STATUS))throw Error(v.getShaderInfoLog(r)??`Shader compile failed`);return r},O=D(v.VERTEX_SHADER,a),k=(e,t=[])=>{let n=v.createProgram();if(v.attachShader(n,O),v.attachShader(n,D(v.FRAGMENT_SHADER,e,t)),v.bindAttribLocation(n,0,`aPosition`),v.linkProgram(n),!v.getProgramParameter(n,v.LINK_STATUS))throw Error(v.getProgramInfoLog(n)??`Program link failed`);let r={},i=v.getProgramParameter(n,v.ACTIVE_UNIFORMS);for(let e=0;e<i;e++){let t=v.getActiveUniform(n,e).name;r[t]=v.getUniformLocation(n,t)}return{p:n,u:r,bind:()=>v.useProgram(n)}},A;try{A={clear:k(s),clamp:k(o),splat:k(c),advection:k(l,S?[]:[`MANUAL_FILTERING`]),divergence:k(u),curl:k(d),vorticity:k(ee),pressure:k(te),gradientSubtract:k(f),display:k(ne),reveal:h?k(p):null}}catch(e){return console.warn(`[fluid-trail]`,e),null}v.bindBuffer(v.ARRAY_BUFFER,v.createBuffer()),v.bufferData(v.ARRAY_BUFFER,new Float32Array([-1,-1,-1,1,1,1,1,-1]),v.STATIC_DRAW),v.bindBuffer(v.ELEMENT_ARRAY_BUFFER,v.createBuffer()),v.bufferData(v.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,0,2,3]),v.STATIC_DRAW),v.vertexAttribPointer(0,2,v.FLOAT,!1,0,0),v.enableVertexAttribArray(0);let j=e=>{e?(v.viewport(0,0,e.width,e.height),v.bindFramebuffer(v.FRAMEBUFFER,e.fbo)):(v.viewport(0,0,v.drawingBufferWidth,v.drawingBufferHeight),v.bindFramebuffer(v.FRAMEBUFFER,null)),v.drawElements(v.TRIANGLES,6,v.UNSIGNED_SHORT,0)},M=[],N=[],P=(e,t,{internalFormat:n,format:r},i)=>{v.activeTexture(v.TEXTURE0);let a=v.createTexture();v.bindTexture(v.TEXTURE_2D,a),v.texParameteri(v.TEXTURE_2D,v.TEXTURE_MIN_FILTER,i),v.texParameteri(v.TEXTURE_2D,v.TEXTURE_MAG_FILTER,i),v.texParameteri(v.TEXTURE_2D,v.TEXTURE_WRAP_S,v.CLAMP_TO_EDGE),v.texParameteri(v.TEXTURE_2D,v.TEXTURE_WRAP_T,v.CLAMP_TO_EDGE),v.texImage2D(v.TEXTURE_2D,0,n,e,t,0,r,x,null);let o=v.createFramebuffer();return v.bindFramebuffer(v.FRAMEBUFFER,o),v.framebufferTexture2D(v.FRAMEBUFFER,v.COLOR_ATTACHMENT0,v.TEXTURE_2D,a,0),v.viewport(0,0,e,t),v.clearColor(0,0,0,1),v.clear(v.COLOR_BUFFER_BIT),M.push(a),N.push(o),{texture:a,fbo:o,width:e,height:t,texelSizeX:1/e,texelSizeY:1/t,attach(e){return v.activeTexture(v.TEXTURE0+e),v.bindTexture(v.TEXTURE_2D,a),e}}},F=(e,t,n,r)=>{let i=P(e,t,n,r),a=P(e,t,n,r);return{width:e,height:t,texelSizeX:i.texelSizeX,texelSizeY:i.texelSizeY,get read(){return i},get write(){return a},swap(){[i,a]=[a,i]}}},I=e=>{let t=v.drawingBufferWidth,n=v.drawingBufferHeight,r=t>n?t/n:n/t,i=Math.round(e),a=Math.round(e*r);return t>n?{width:a,height:i}:{width:i,height:a}},L,R,z,B,V,re=()=>{M.splice(0).forEach(e=>v.deleteTexture(e)),N.splice(0).forEach(e=>v.deleteFramebuffer(e));let e=S?v.LINEAR:v.NEAREST,t=Math.min(v.drawingBufferWidth,v.drawingBufferHeight),n=I(r.simResolution),i=I(Math.min(r.dyeResolution,t));v.disable(v.BLEND),L=F(i.width,i.height,T,e),R=F(n.width,n.height,E,e),z=P(n.width,n.height,T,v.NEAREST),B=P(n.width,n.height,T,v.NEAREST),V=F(n.width,n.height,T,v.NEAREST)},H=()=>{let n=Math.min(window.devicePixelRatio||1,1.5),r=Math.max(1,Math.round(e.clientWidth*n)),i=Math.max(1,Math.round(e.clientHeight*n));e.width===r&&e.height===i&&L||(e.width=r,e.height=i,t&&(t.width=r,t.height=i),re())},U=()=>e.width/e.height,W=(e,t,n,i,a=r.intensity,o=r.splatRadius/100)=>{let{splat:s}=A;s.bind(),v.uniform1i(s.u.uTarget,R.read.attach(0)),v.uniform1f(s.u.aspectRatio,U()),v.uniform2f(s.u.point,e,t),v.uniform3f(s.u.color,n,i,0),v.uniform1f(s.u.radius,U()>1?o*U():o),j(R.write),R.swap(),v.uniform1i(s.u.uTarget,L.read.attach(0));let c=a;v.uniform3f(s.u.color,c,c,c),j(L.write),L.swap()},ie=e=>{let t=A;v.disable(v.BLEND),t.curl.bind(),v.uniform2f(t.curl.u.texelSize,R.texelSizeX,R.texelSizeY),v.uniform1i(t.curl.u.uVelocity,R.read.attach(0)),j(B),t.vorticity.bind(),v.uniform2f(t.vorticity.u.texelSize,R.texelSizeX,R.texelSizeY),v.uniform1i(t.vorticity.u.uVelocity,R.read.attach(0)),v.uniform1i(t.vorticity.u.uCurl,B.attach(1)),v.uniform1f(t.vorticity.u.curl,r.curl),v.uniform1f(t.vorticity.u.dt,e),j(R.write),R.swap(),t.divergence.bind(),v.uniform2f(t.divergence.u.texelSize,R.texelSizeX,R.texelSizeY),v.uniform1i(t.divergence.u.uVelocity,R.read.attach(0)),j(z),t.clear.bind(),v.uniform1i(t.clear.u.uTexture,V.read.attach(0)),v.uniform1f(t.clear.u.value,r.pressure),j(V.write),V.swap(),t.pressure.bind(),v.uniform2f(t.pressure.u.texelSize,R.texelSizeX,R.texelSizeY),v.uniform1i(t.pressure.u.uDivergence,z.attach(0));for(let e=0;e<r.pressureIterations;e++)v.uniform1i(t.pressure.u.uPressure,V.read.attach(1)),j(V.write),V.swap();t.gradientSubtract.bind(),v.uniform2f(t.gradientSubtract.u.texelSize,R.texelSizeX,R.texelSizeY),v.uniform1i(t.gradientSubtract.u.uPressure,V.read.attach(0)),v.uniform1i(t.gradientSubtract.u.uVelocity,R.read.attach(1)),j(R.write),R.swap(),t.advection.bind(),v.uniform2f(t.advection.u.texelSize,R.texelSizeX,R.texelSizeY),S||v.uniform2f(t.advection.u.dyeTexelSize,R.texelSizeX,R.texelSizeY);let n=R.read.attach(0);v.uniform1i(t.advection.u.uVelocity,n),v.uniform1i(t.advection.u.uSource,n),v.uniform1f(t.advection.u.dt,e),v.uniform1f(t.advection.u.dissipation,r.velocityDissipation),j(R.write),R.swap(),S||v.uniform2f(t.advection.u.dyeTexelSize,L.texelSizeX,L.texelSizeY),v.uniform1i(t.advection.u.uVelocity,R.read.attach(0)),v.uniform1i(t.advection.u.uSource,L.read.attach(1)),v.uniform1f(t.advection.u.dissipation,r.densityDissipation),j(L.write),L.swap()},G=m(n),ae=(e,t)=>{let{display:n}=A;n.bind(),v.uniform2f(n.u.texelSize,L.texelSizeX,L.texelSizeY),v.uniform1i(n.u.uTexture,L.read.attach(0)),v.uniform3f(n.u.uColor,...e),v.uniform1f(n.u.uMode,r.mode),v.uniform1f(n.u.uEdge,r.inkEdge),v.uniform1f(n.u.uSoftness,r.inkSoftness),v.uniform1f(n.u.uShading,+!!t),j(null)},K=null,oe=h?m(h.paper):[0,0,0],se=e=>{v.activeTexture(v.TEXTURE0+2),K||(K=v.createTexture(),v.bindTexture(v.TEXTURE_2D,K),v.texParameteri(v.TEXTURE_2D,v.TEXTURE_MIN_FILTER,v.LINEAR),v.texParameteri(v.TEXTURE_2D,v.TEXTURE_MAG_FILTER,v.LINEAR),v.texParameteri(v.TEXTURE_2D,v.TEXTURE_WRAP_S,v.CLAMP_TO_EDGE),v.texParameteri(v.TEXTURE_2D,v.TEXTURE_WRAP_T,v.CLAMP_TO_EDGE)),v.bindTexture(v.TEXTURE_2D,K),v.texImage2D(v.TEXTURE_2D,0,v.RGBA,v.RGBA,v.UNSIGNED_BYTE,e)};h&&se(h.source);let ce=()=>{let e=A.reveal;e.bind(),v.uniform2f(e.u.texelSize,L.texelSizeX,L.texelSizeY),v.uniform1i(e.u.uTexture,L.read.attach(0)),v.activeTexture(v.TEXTURE0+2),v.bindTexture(v.TEXTURE_2D,K),v.uniform1i(e.u.uText,2),v.uniform3f(e.u.uColor,...G),v.uniform3f(e.u.uPaper,...oe),v.uniform1f(e.u.uMode,r.mode),v.uniform1f(e.u.uEdge,r.inkEdge),v.uniform1f(e.u.uSoftness,r.inkSoftness),v.uniform1f(e.u.uShading,+!!r.shading),j(null)},q=()=>{h?ce():(ae(G,r.shading),y.drawImage(e,0,0),ae([1,1,1],!1))},J={x:0,y:0,dx:0,dy:0,inside:!1,moved:!1},le=!0,ue=(t,n)=>{if(!le){J.inside=!1;return}let r=e.getBoundingClientRect(),i=(t-r.left)/Math.max(1,r.width),a=1-(n-r.top)/Math.max(1,r.height);if(i<-.1||i>1.1||a<-.1||a>1.1)J.inside=!1;else{if(J.inside){let e=U(),t=i-J.x,n=a-J.y;e<1&&(t*=e),e>1&&(n/=e),J.dx+=t,J.dy+=n,J.moved=!0}J.x=i,J.y=a,J.inside=!0,Q=0,$()}},de=e=>{e.pointerType!==`touch`&&ue(e.clientX,e.clientY)},Y=e=>{let t=e.touches[0];t&&ue(t.clientX,t.clientY)},fe=e=>{J.inside=!1,Y(e)},pe=e=>{e.relatedTarget||(J.inside=!1)},X=0,Z=0,Q=1/0,me=e=>{X=0,H();let t=Math.min((e-Z)/1e3,1/60);Z=e,Q+=t,J.moved&&=(W(J.x,J.y,J.dx*r.splatForce,J.dy*r.splatForce),J.dx=J.dy=0,!1),ie(t),q(),Q<i&&(X=requestAnimationFrame(me))};function $(){X||document.hidden||(Z=performance.now(),X=requestAnimationFrame(me))}let he=()=>{document.hidden&&X?(cancelAnimationFrame(X),X=0):$()},ge=()=>$();return H(),window.addEventListener(`pointermove`,de,{passive:!0}),window.addEventListener(`touchstart`,fe,{passive:!0}),window.addEventListener(`touchmove`,Y,{passive:!0}),document.addEventListener(`pointerout`,pe),document.addEventListener(`visibilitychange`,he),window.addEventListener(`resize`,ge),{update(e,t){let n=e.simResolution!==void 0&&e.simResolution!==r.simResolution||e.dyeResolution!==void 0&&e.dyeResolution!==r.dyeResolution;Object.assign(r,e),t&&(G=m(t)),n&&re(),Q=0,$()},splash(e=5){for(let t=0;t<e;t++){let e=Math.random()*Math.PI*2;W(Math.random(),Math.random(),Math.cos(e)*1e3,Math.sin(e)*1e3)}Q=0,$()},splatAt(e,t,n={}){W(e,t,n.dx??0,n.dy??0,n.amount??r.intensity,n.radius??r.splatRadius/100),Q=0,$()},clampInk(){let{clamp:e}=A;e.bind(),v.uniform1i(e.u.uTexture,L.read.attach(0)),j(L.write),L.swap(),Q=0,$()},flood(e=4){W(.5,.5,0,0,e,1e4),Q=0,$()},setInput(e){le=e},setReveal(e,t){h&&(se(e),t&&(oe=m(t)),H(),q())},renderNow(){H(),q()},destroy(){X&&cancelAnimationFrame(X),window.removeEventListener(`pointermove`,de),window.removeEventListener(`touchstart`,fe),window.removeEventListener(`touchmove`,Y),document.removeEventListener(`pointerout`,pe),document.removeEventListener(`visibilitychange`,he),window.removeEventListener(`resize`,ge),M.forEach(e=>v.deleteTexture(e)),N.forEach(e=>v.deleteFramebuffer(e))}}}var g={tint:`#141918`,config:{mode:1,curl:4,densityDissipation:2.05,velocityDissipation:1.05,pressure:1,pressureIterations:22,splatRadius:.24,splatForce:500,shading:!1,simResolution:96,dyeResolution:1024,intensity:.85,inkEdge:.35,inkSoftness:.01}},_={hold:.5,duration:1.1,stagger:.03,cardSize:.3,spread:1,rotate:12,parallax:22,backdrop:.88},v={...t.gooTitles,blur:Math.max(.16,t.gooTitles.blur*1.5)},y=411/655,b=[[-.8,-.62],[-.42,-1.04],[.4,-1],[.82,-.58],[-1,.06],[1,.1],[-.76,.66],[-.4,1.04],[.42,1],[.8,.62]],x=[[-.72,-.92],[.02,-1.04],[.74,-.88],[-.7,.9],[0,1.04],[.72,.94]];function S(t,r){let i=structuredClone(_),a=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,o=[...r.querySelectorAll(`[data-burst-card]`)],s=[...r.querySelectorAll(`[data-burst-line]`)],c=[...r.querySelectorAll(`[data-burst-fade]`)],l=[...r.querySelectorAll(`[data-burst-btn]`)],u=r.querySelector(`.burst__label`),d=r.querySelector(`[data-burst-star]`),ee=[...r.querySelectorAll(`[data-burst-goo]`)].map(e=>({el:e,ink:n(`cta`)}));a||l.forEach(t=>{let r=t.querySelector(`[data-burst-btn-label]`);if(!r)return;let i=n(`cta-btn`),a={b:0},o=null,s=()=>{o?.kill();let n=parseFloat(getComputedStyle(t).fontSize),s={...v,blur:.15};r.style.filter=i.filter,o=e.timeline({onUpdate:()=>i.set(a.b*s.blur*n,n,s),onComplete:()=>r.style.filter=``}).to(a,{b:1,duration:.4,ease:`none`}).to(a,{b:0,duration:.4,ease:`none`})};[`mouseenter`,`mouseleave`,`focus`,`blur`].forEach(e=>t.addEventListener(e,s))});let te=r.querySelector(`[data-burst-backdrop]`),f=t.querySelector(`[data-burst-hint]`),ne=o.map((e,t)=>{let n=e=>{let n=Math.sin((t+1)*12.9898+e*78.233)*43758.5453;return n-Math.floor(n)};return{rot:n(1)*2-1,dx:n(2)*2-1,dy:n(3)*2-1,depth:.4+n(4)*.9}}),p=null,m=!1;t.setAttribute(`role`,`button`),t.setAttribute(`tabindex`,`0`),t.setAttribute(`aria-label`,`Open: start a project with me`),t.setAttribute(`aria-haspopup`,`dialog`),r.inert=!0;function h(){let n=window.innerWidth,f=window.innerHeight,m=t.getBoundingClientRect(),h=m.left+m.width/2,g=m.top+m.height/2,_=n<1024&&f>n,S=_?x:b,C=_?n*.23/y:Math.min(f*i.cardSize,n*.48/y),w=C*y,T=(n-w)/2-Math.max(16,n*.02),E=(f-C)/2-Math.max(16,f*.03);p?.kill(),p=e.timeline({paused:!0,onReverseComplete:()=>{r.classList.remove(`is-open`),e.set(t,{clearProps:`opacity`}),t.style.scale=``}});let D=a?.01:i.duration,O={s:1};p.to(te,{opacity:i.backdrop,duration:D*.5,ease:`power2.out`},0),p.fromTo(O,{s:1},{s:1.12,duration:D*.35,ease:`power2.out`,onUpdate:()=>t.style.scale=O.s.toFixed(4)},0),p.to(t,{opacity:0,duration:D*.3,ease:`power2.in`},.05*D),o.forEach((e,t)=>{if(e.hidden=t>=S.length,e.hidden)return;let[r,a]=S[t],o=ne[t],s=n/2+(r*T+o.dx*w*.12)*i.spread,c=f/2+(a*E+o.dy*C*.08)*i.spread;Object.assign(e.style,{width:`${w}px`,height:`${C}px`,left:`${s-w/2}px`,top:`${c-C/2}px`}),e.style.setProperty(`--depth`,o.depth.toFixed(3)),p.fromTo(e.firstElementChild,{x:h-s,y:g-c,scale:m.height/C,rotation:0,opacity:0},{x:0,y:0,scale:1,rotation:o.rot*i.rotate,opacity:1,duration:D,ease:`expo.out`,immediateRender:!1},.04*D+t*i.stagger)});let k={k:1},A=()=>ee.forEach(({el:e,ink:t})=>{let n=parseFloat(getComputedStyle(e).fontSize);t.set(k.k*v.blur*n,n,v),e.style.filter=k.k>.001&&k.k<.999?t.filter:``});p.fromTo(k,{k:1},{k:0,duration:D*.9,ease:`power2.out`,onUpdate:A,onComplete:A,immediateRender:!1},D*.3),u&&p.fromTo(u,{opacity:0,y:10},{opacity:1,y:0,duration:D*.5,ease:`power2.out`,immediateRender:!1},D*.25),d&&p.fromTo(d,{scale:0,rotation:-120},{scale:1,rotation:0,duration:D*.9,ease:`elastic.out(1, 0.5)`,immediateRender:!1},D*.4),p.fromTo(s,{yPercent:110},{yPercent:0,duration:D*.8,ease:`expo.out`,stagger:.09,immediateRender:!1},D*.28),p.fromTo(l,{opacity:0,y:18,scale:.92},{opacity:1,y:0,scale:1,duration:D*.7,ease:`back.out(1.8)`,stagger:.08,immediateRender:!1},D*.55),p.fromTo(c,{opacity:0},{opacity:1,duration:D*.5,ease:`power2.out`,immediateRender:!1},D*.6)}function g(){m||document.documentElement.classList.contains(`is-loading`)||(m=!0,D(!1),h(),r.classList.add(`is-open`),r.inert=!1,p.timeScale(1).play(0),r.querySelector(`[data-burst-primary]`)?.focus({preventScroll:!0}))}function S(){m&&(m=!1,r.inert=!0,p?.timeScale(1.7).reverse(),t.focus({preventScroll:!0}))}let C=null,w={k:0},T=()=>{t.style.scale=(1-w.k*.07).toFixed(4),f?.style.setProperty(`--fill`,w.k.toFixed(3))};function E(){m||(C?.kill(),e.killTweensOf(w),C=e.to(w,{k:1,duration:i.hold,ease:`power1.in`,onUpdate:T,onComplete:g}))}function D(t){C&&(C.kill(),C=null,t&&g(),m?(w.k=0,f?.style.setProperty(`--fill`,`0`)):e.to(w,{k:0,duration:.6,ease:`elastic.out(1, 0.45)`,onUpdate:T}))}t.addEventListener(`pointerdown`,e=>{e.button===0&&E()}),t.addEventListener(`pointerup`,()=>D(!1)),t.addEventListener(`pointerleave`,()=>D(!1)),t.addEventListener(`pointercancel`,()=>D(!1)),t.addEventListener(`contextmenu`,e=>e.preventDefault()),t.addEventListener(`keydown`,e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),g())}),r.querySelectorAll(`[data-burst-close]`).forEach(e=>e.addEventListener(`click`,S)),document.addEventListener(`keydown`,e=>{e.key===`Escape`&&m&&S()});let O=window.matchMedia(`(hover: hover) and (pointer: fine)`).matches;if(f&&O&&t.addEventListener(`pointermove`,e=>{let n=t.getBoundingClientRect();f.style.translate=`${e.clientX-n.left}px ${e.clientY-n.top}px`}),O&&!a){let e={x:0,y:0},t={x:0,y:0},n=0,a=()=>{t.x+=(e.x-t.x)*.08,t.y+=(e.y-t.y)*.08,r.style.setProperty(`--px-x`,`${(t.x*i.parallax).toFixed(2)}px`),r.style.setProperty(`--px-y`,`${(t.y*i.parallax).toFixed(2)}px`),n=Math.abs(e.x-t.x)+Math.abs(e.y-t.y)>.001?requestAnimationFrame(a):0};r.addEventListener(`pointermove`,t=>{e.x=t.clientX/innerWidth*2-1,e.y=t.clientY/innerHeight*2-1,n||=requestAnimationFrame(a)})}return window.addEventListener(`resize`,()=>{m&&(h(),p.progress(1))}),{settings:i,open:g,close:S,refresh:()=>m&&(h(),p.progress(1))}}var C=new URLSearchParams(location.search),w=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,T=window.matchMedia(`(hover: hover) and (pointer: fine)`).matches,E=document.documentElement.classList.contains(`is-loading`),D=document.querySelector(`[data-fluid]`),O=document.querySelector(`[data-fluid-tint]`),k=null;D&&O&&!w&&(k=h({canvas:D,tintCanvas:O,tint:g.tint,config:structuredClone(g.config)}));var A=document.querySelector(`[data-portrait]`),j=A?.querySelector(`[data-portrait-frame]`),M=A?.querySelector(`.home__hero`),N=JSON.parse(A?.dataset.frames??`[]`),P={dentDepth:1,dentRadius:.08,rgbSplit:.12},F=null,I=A&&!w?r(async()=>{let{mountPortraitFx:e}=await import(`./portrait-fx.9pn35qgp.js`).then(e=>e.n);return{mountPortraitFx:e}},__vite__mapDeps([0,1,2])).then(({mountPortraitFx:e})=>F=e(A,P,{interactive:T})):Promise.resolve(null);E&&A&&M?Promise.all([r(()=>import(`./page-loader.DLQNlqoP.js`),__vite__mapDeps([3,4])),I]).then(([{runLoader:e},t])=>e({fluid:k,portraitFx:t,portrait:A,heroImg:M,baseDissipation:g.config.densityDissipation})):I.then(e=>e?.ink());var L=document.querySelector(`.home`);if(L&&T&&!w){let e={x:0,y:0},t={x:0,y:0},n=0,r=()=>{t.x+=(e.x-t.x)*.06,t.y+=(e.y-t.y)*.06,L.style.setProperty(`--mx`,t.x.toFixed(4)),L.style.setProperty(`--my`,t.y.toFixed(4)),n=Math.abs(e.x-t.x)+Math.abs(e.y-t.y)>1e-4?requestAnimationFrame(r):0},i=(t,i)=>{[e.x,e.y]=[t,i],n||=requestAnimationFrame(r)};window.addEventListener(`pointermove`,e=>i(e.clientX/innerWidth*2-1,e.clientY/innerHeight*2-1),{passive:!0}),document.documentElement.addEventListener(`pointerleave`,()=>i(0,0))}var R=document.querySelector(`[data-burst]`),z=A&&R?S(A,R):null;if(z&&C.has(`tweak`)&&r(async()=>{let{mountConfigPane:e}=await import(`./config-pane.xgM-6VZV.js`);return{mountConfigPane:e}},__vite__mapDeps([5,6])).then(({mountConfigPane:e})=>{let t=z.settings;e({title:`Portrait CTA burst`,settings:t,saved:structuredClone(_),saveUrl:null,side:`left`,build(e){e.addBinding(t,`hold`,{label:`hold s`,min:.15,max:1.5,step:.05}),e.addBinding(t,`duration`,{label:`burst s`,min:.4,max:2.5,step:.05}),e.addBinding(t,`stagger`,{min:0,max:.12,step:.005}),e.addBinding(t,`cardSize`,{label:`card size (vh)`,min:.15,max:.45,step:.01}),e.addBinding(t,`spread`,{min:.6,max:1.2,step:.01}),e.addBinding(t,`rotate`,{label:`rotate deg`,min:0,max:30,step:.5}),e.addBinding(t,`parallax`,{label:`parallax px`,min:0,max:60,step:1}),e.addBinding(t,`backdrop`,{min:0,max:1,step:.01}),e.addButton({title:`Open`}).on(`click`,()=>z.open())},onChange:()=>z.refresh()})}),k&&C.has(`tweak`)&&r(async()=>{let{mountFluidTweaks:e}=await import(`./fluid-tweaks.kmmJ96KD.js`);return{mountFluidTweaks:e}},__vite__mapDeps([7,6])).then(({mountFluidTweaks:e})=>{let t=e(k,g).addFolder({title:`Portrait dent`,index:3});t.addBinding(P,`dentDepth`,{label:`depth`,min:0,max:3,step:.05}),t.addBinding(P,`dentRadius`,{label:`radius`,min:.01,max:.5,step:.01}),t.addBinding(P,`rgbSplit`,{label:`rgb split`,min:0,max:1,step:.01}),t.addButton({title:`Play intro ripple`}).on(`click`,()=>F?.ripple()),t.on(`change`,()=>F?.refresh())}),A&&j&&T&&!w){let e=-1,t=0,n=()=>N.forEach(e=>new Image().src=e);`requestIdleCallback`in window?requestIdleCallback(n,{timeout:3e3}):setTimeout(n,1500);let r=t=>{e=t,j.hidden=t<0,t>=0&&(j.src=N[t])};A.addEventListener(`mouseenter`,()=>{clearInterval(t),t=window.setInterval(()=>r(e+1<N.length?e+1:-1),100)}),A.addEventListener(`mouseleave`,()=>{clearInterval(t),r(-1)})}