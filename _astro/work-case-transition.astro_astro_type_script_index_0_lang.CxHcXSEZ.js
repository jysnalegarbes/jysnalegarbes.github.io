import{t as e}from"./gsap.CvDoa17S.js";var t=12,n=`
precision highp float;
attribute vec2 aUv;
uniform vec2 uViewport;
uniform vec4 uRect;
uniform float uVelo;
uniform float uTime;
varying vec2 vUv;
varying float vShade;

const float PI = 3.14159265;

void main() {
  vec2 pos = uRect.xy + aUv * uRect.zw;
  float a = abs(uVelo);
  float phase = uTime * 5.0;
  float wy = sin(aUv.x * PI * 1.8 - phase + aUv.y * 1.2);
  float wx = sin(aUv.y * PI * 1.4 - phase * 0.8);
  pos.y += wy * a * uRect.w * 0.075;
  pos.x += wx * a * uRect.z * 0.035;
  vShade = cos(aUv.x * PI * 1.8 - phase + aUv.y * 1.2) * a;

  vUv = aUv;
  vec2 clip = pos / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`,r=`
precision highp float;
attribute vec2 aUv;
uniform vec2 uViewport;
uniform vec4 uFrom;
uniform vec4 uTo;
uniform float uT;
uniform float uFx;
uniform float uTime;
uniform vec2 uStrip;
uniform float uStripIndex;
varying vec2 vUv;
varying float vShade;

const float PI = 3.14159265;
const float STRIPS = ${t.toFixed(1)};

// power3.inOut, matching the JS side
float ease(float x) {
  return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) * 0.5;
}

void main() {
  vec2 uv = vec2(aUv.x, mix(uStrip.x, uStrip.y, aUv.y));
  float p;
  vec2 shift = vec2(0.0);

  if (uFx > 1.5 && uFx < 2.5) {
    // Liquid: lead with the edge facing the destination
    vec2 travel = (uTo.xy + uTo.zw * 0.5) - (uFrom.xy + uFrom.zw * 0.5);
    vec2 dir = travel / max(length(travel), 1.0);
    float lead = clamp(0.5 + dot(uv - 0.5, dir) * 0.9, 0.0, 1.0);
    float lag = 0.42;
    p = ease(clamp((uT - (1.0 - lead) * lag) / (1.0 - lag), 0.0, 1.0));
  } else if (uFx > 2.5 && uFx < 3.5) {
    // Strips: top strip first, alternate strips sway left and right
    float k = uStripIndex / (STRIPS - 1.0);
    float lag = 0.38;
    float lt = clamp((uT - k * lag) / (1.0 - lag), 0.0, 1.0);
    p = ease(lt);
    float side = mod(uStripIndex, 2.0) < 0.5 ? -1.0 : 1.0;
    shift.x = sin(lt * PI) * side * uTo.z * 0.06;
  } else {
    p = ease(uT);
  }

  vec4 r = mix(uFrom, uTo, p);
  vec2 pos = r.xy + uv * r.zw + shift;

  // Cloth ripple swelling mid-flight (strongest on Glide)
  float amp = sin(PI * uT) * (uFx < 1.5 ? 0.55 : uFx < 2.5 ? 0.2 : 0.0);
  float phase = uTime * 5.0;
  pos.y += sin(uv.x * PI * 1.8 - phase + uv.y * 1.2) * amp * r.w * 0.075;
  pos.x += sin(uv.y * PI * 1.4 - phase * 0.8) * amp * r.z * 0.035;
  vShade = cos(uv.x * PI * 1.8 - phase + uv.y * 1.2) * amp;

  vUv = uv;
  vec2 clip = pos / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`,i=`
precision highp float;
uniform sampler2D uTex;
uniform vec2 uImg;
uniform vec2 uBox;
uniform float uAlpha;
varying vec2 vUv;
varying float vShade;

// object-fit: cover for a box of size uBox
vec2 cover(vec2 uv) {
  float rb = uBox.x / uBox.y;
  float ri = uImg.x / uImg.y;
  vec2 scale = rb > ri ? vec2(1.0, ri / rb) : vec2(rb / ri, 1.0);
  return (uv - 0.5) * scale + 0.5;
}

void main() {
  vec3 col = texture2D(uTex, cover(vUv)).rgb;
  col *= 1.0 + vShade * 0.12;
  gl_FragColor = vec4(col * uAlpha, uAlpha);
}
`,a=e=>e<.5?4*e*e*e:1-(-2*e+2)**3/2;function o(e,o,{onReady:s}){let c=e.getContext(`webgl`,{alpha:!0,antialias:!0,premultipliedAlpha:!0});if(!c)return null;let l=(e,t)=>{let n=c.createShader(e);if(c.shaderSource(n,t),c.compileShader(n),!c.getShaderParameter(n,c.COMPILE_STATUS))throw Error(c.getShaderInfoLog(n)??`shader`);return n},u=(e,t)=>{let n=c.createProgram();if(c.attachShader(n,l(c.VERTEX_SHADER,e)),c.attachShader(n,l(c.FRAGMENT_SHADER,i)),c.linkProgram(n),!c.getProgramParameter(n,c.LINK_STATUS))throw Error(c.getProgramInfoLog(n)??`link`);return{program:n,u:Object.fromEntries(t.map(e=>[e,c.getUniformLocation(n,e)])),aUv:c.getAttribLocation(n,`aUv`)}},d=[`uViewport`,`uTime`,`uTex`,`uImg`,`uBox`,`uAlpha`],f=u(n,[...d,`uRect`,`uVelo`]),p=u(r,[...d,`uFrom`,`uTo`,`uT`,`uFx`,`uStrip`,`uStripIndex`]),m=[];for(let e=0;e<=32;e++)for(let t=0;t<=48;t++)m.push(t/48,e/32);let h=[];for(let e=0;e<32;e++)for(let t=0;t<48;t++){let n=e*49+t;h.push(n,n+1,n+48+1,n+1,n+48+2,n+48+1)}c.bindBuffer(c.ARRAY_BUFFER,c.createBuffer()),c.bufferData(c.ARRAY_BUFFER,new Float32Array(m),c.STATIC_DRAW),c.bindBuffer(c.ELEMENT_ARRAY_BUFFER,c.createBuffer()),c.bufferData(c.ELEMENT_ARRAY_BUFFER,new Uint16Array(h),c.STATIC_DRAW),c.enable(c.BLEND),c.blendFunc(c.ONE,c.ONE_MINUS_SRC_ALPHA);let g=e=>{c.useProgram(e.program),c.enableVertexAttribArray(e.aUv),c.vertexAttribPointer(e.aUv,2,c.FLOAT,!1,0,0),c.uniform1i(e.u.uTex,0)},_=null,v=e=>(e.srcset||``).split(`,`).map(e=>e.trim().split(/\s+/)).filter(e=>e[0]).sort((e,t)=>parseFloat(t[1]??`0`)-parseFloat(e[1]??`0`))[0]?.[0]||e.currentSrc||e.src,y=new Map,b=o.map(()=>null);o.forEach((e,t)=>{let n=v(e);if(!y.has(n)){let e=new Image;e.decoding=`async`,e.src=n,y.set(n,e.decode().then(()=>{let t=c.createTexture();return c.bindTexture(c.TEXTURE_2D,t),c.texImage2D(c.TEXTURE_2D,0,c.RGBA,c.RGBA,c.UNSIGNED_BYTE,e),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MIN_FILTER,c.LINEAR),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MAG_FILTER,c.LINEAR),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_S,c.CLAMP_TO_EDGE),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_WRAP_T,c.CLAMP_TO_EDGE),{tex:t,size:[e.naturalWidth,e.naturalHeight]}}))}y.get(n).then(e=>{b[t]=e,_&&C(_),s(t)}).catch(()=>{})});let x={w:1,h:1};function S(){let t=Math.min(window.devicePixelRatio||1,2);x={w:e.clientWidth||1,h:e.clientHeight||1},e.width=Math.round(x.w*t),e.height=Math.round(x.h*t),c.viewport(0,0,e.width,e.height),_&&C(_)}function C(e){_=e,c.clearColor(0,0,0,0),c.clear(c.COLOR_BUFFER_BIT),g(f),c.uniform2f(f.u.uViewport,x.w,x.h),c.uniform1f(f.u.uVelo,e.velocity),c.uniform1f(f.u.uTime,e.time),e.cards.forEach((t,n)=>{let r=b[n],i=t.alpha??1;!r||i<=0||n===e.travel?.index||t.x>x.w+40||t.x+t.w<-40||(c.bindTexture(c.TEXTURE_2D,r.tex),c.uniform2f(f.u.uImg,r.size[0],r.size[1]),c.uniform2f(f.u.uBox,t.w,t.h),c.uniform4f(f.u.uRect,t.x,t.y,t.w,t.h),c.uniform1f(f.u.uAlpha,i),c.drawElements(c.TRIANGLES,h.length,c.UNSIGNED_SHORT,0))});let n=e.travel,r=n&&b[n.index];if(!n||!r)return;g(p);let i=a(n.t);c.uniform2f(p.u.uViewport,x.w,x.h),c.uniform1f(p.u.uTime,e.time),c.uniform2f(p.u.uImg,r.size[0],r.size[1]),c.uniform2f(p.u.uBox,n.from.w+(n.to.w-n.from.w)*i,n.from.h+(n.to.h-n.from.h)*i),c.uniform4f(p.u.uFrom,n.from.x,n.from.y,n.from.w,n.from.h),c.uniform4f(p.u.uTo,n.to.x,n.to.y,n.to.w,n.to.h),c.uniform1f(p.u.uT,n.t),c.uniform1f(p.u.uFx,n.fx),c.uniform1f(p.u.uAlpha,1),c.bindTexture(c.TEXTURE_2D,r.tex);let o=n.fx===3?t:1;for(let e=0;e<o;e++)c.uniform2f(p.u.uStrip,e/o,(e+1)/o),c.uniform1f(p.u.uStripIndex,e),c.drawElements(c.TRIANGLES,h.length,c.UNSIGNED_SHORT,0)}return S(),window.addEventListener(`resize`,S),{render:C,destroy(){window.removeEventListener(`resize`,S)}}}var s=`
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`,c=`
precision highp float;
uniform vec2 uViewport;
uniform vec4 uRect;
uniform float uReach;
uniform float uRecede;
uniform float uTime;
uniform vec3 uInk;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; }
  return v;
}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uViewport;
  vec2 c = uRect.xy + uRect.zw * 0.5;
  vec2 q = abs(px - c) - uRect.zw * 0.5;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  if (d <= 0.0) discard;

  // Blotted contour: broad lobes plus fine bleed, slowly drifting
  float scale = 1.0 / max(uViewport.x, uViewport.y);
  float n = fbm(px * scale * 6.0 + vec2(uTime * 0.12, -uTime * 0.08));
  float fine = fbm(px * scale * 28.0 - uTime * 0.2);
  float edge = uReach + (n - 0.5) * 220.0 + (fine - 0.5) * 40.0;

  float inked = uRecede > 0.5 ? smoothstep(edge - 1.0, edge + 1.0, d) : 1.0 - smoothstep(edge - 1.0, edge + 1.0, d);
  if (inked <= 0.0) discard;
  gl_FragColor = vec4(uInk * inked, inked);
}
`;function l(e,{zIndex:t=30}={}){let n=document.createElement(`canvas`);n.setAttribute(`aria-hidden`,`true`),Object.assign(n.style,{position:`fixed`,top:`0`,left:`0`,width:`100vw`,height:`100vh`,zIndex:String(t),pointerEvents:`none`});let r=n.getContext(`webgl`,{alpha:!0,premultipliedAlpha:!0,antialias:!1});if(!r)return null;let i=(e,t)=>{let n=r.createShader(e);if(r.shaderSource(n,t),r.compileShader(n),!r.getShaderParameter(n,r.COMPILE_STATUS))throw Error(r.getShaderInfoLog(n)??`shader`);return n},a=r.createProgram();r.attachShader(a,i(r.VERTEX_SHADER,s)),r.attachShader(a,i(r.FRAGMENT_SHADER,c)),r.linkProgram(a),r.useProgram(a),r.bindBuffer(r.ARRAY_BUFFER,r.createBuffer()),r.bufferData(r.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),r.STATIC_DRAW);let o=r.getAttribLocation(a,`aPos`);r.enableVertexAttribArray(o),r.vertexAttribPointer(o,2,r.FLOAT,!1,0,0);let l=Object.fromEntries([`uViewport`,`uRect`,`uReach`,`uRecede`,`uTime`,`uInk`].map(e=>[e,r.getUniformLocation(a,e)])),u=getComputedStyle(document.documentElement).getPropertyValue(`--black`).trim()||`#141918`;r.uniform3f(l.uInk,...[1,3,5].map(e=>parseInt(u.slice(e,e+2),16)/255)),r.uniform1f(l.uRecede,+(e===`recede`));let d=1,f=1,p=()=>{let e=Math.min(window.devicePixelRatio||1,1.5);d=n.clientWidth||window.innerWidth,f=n.clientHeight||window.innerHeight,n.width=Math.round(d*e),n.height=Math.round(f*e),r.viewport(0,0,n.width,n.height)};return document.body.append(n),p(),window.addEventListener(`resize`,p),{canvas:n,draw(e,t,n=performance.now()/1e3){let i=-140+t*(Math.hypot(d,f)+260);r.clearColor(0,0,0,0),r.clear(r.COLOR_BUFFER_BIT),r.uniform2f(l.uViewport,d,f),r.uniform4f(l.uRect,e.x,e.y,e.w,e.h),r.uniform1f(l.uReach,i),r.uniform1f(l.uTime,n),r.drawArrays(r.TRIANGLE_STRIP,0,4)},destroy(){window.removeEventListener(`resize`,p),n.remove()}}}var u=Number(new URLSearchParams(location.search).get(`pfx`)),d=[1,2,3,4].includes(u)?u:2,f={1:1.1,2:1.3,3:1.35,4:1.4},p=document.querySelector(`[data-gl]`),m=[...document.querySelectorAll(`.src`)],h=document.querySelector(`[data-work-ui]`),g=document.querySelector(`[data-case-title]`),_=document.querySelector(`[data-case-meta]`),v=o(p,m,{onReady:()=>{}}),y=()=>{let e=innerWidth,t=innerHeight,n={x:e*.05,y:t*.24,w:e*.4,h:e*.4*.663},r={x:n.x+n.w+e*.017,y:t*.36,w:e*.235,h:e*.235*.83},i={x:r.x+r.w+e*.017,y:t*.48,w:r.w,h:r.h},a={x:e*.3,y:t*.32,w:e*.6,h:e*.6*.592};return{main:n,sides:[r,i],cover:a}},b={t:0},x=null,S=null,C={p:0},w=e=>e<.5?2*e*e:1-(-2*e+2)**2/2,T=e=>{e!==S&&(x?.destroy(),x=e?l(e,{zIndex:30}):null,S=e)};function E(){let{main:e,sides:t,cover:n}=y(),r=b.t,i=Math.max(0,1-r/.45),o=a(Math.min(1,r/.8)),s={time:performance.now()/1e3,velocity:d===1?Math.sin(Math.PI*Math.min(1,r*1.6))*.5:0,cards:[{...e,focus:1},...t.map(e=>({...e,x:e.x-o*(d===1?160:60),alpha:i,focus:0}))],travel:r>0?{index:0,from:e,to:n,t:r,fx:d}:void 0};if(v?.render(s),x){let t=a(r),i=S===`recede`?n:{x:e.x+(n.x-e.x)*t,y:e.y+(n.y-e.y)*t,w:e.w+(n.w-e.w)*t,h:e.h+(n.h-e.h)*t};x.draw(i,S===`spread`?w(C.p):C.p)}}function D(){let t=e.timeline({onComplete:D,onUpdate:E});b.t=0,C.p=0,e.set(h,{opacity:1}),e.set([g,_],{opacity:0,y:30}),t.to({},{duration:.9}),t.to(h,{opacity:0,duration:.35,ease:`power2.out`}),d===4&&(t.add(()=>T(`spread`)),t.to(C,{p:1,duration:f[d]*.92,ease:`none`},`<+0.11`)),t.to(b,{t:1,duration:f[d],ease:`none`},d===4?`<-0.11`:`<`),d===4&&(t.add(()=>{C.p=0,T(`recede`)}),t.to(C,{p:1,duration:1.3,ease:`power2.inOut`}),t.add(()=>T(null))),t.to(g,{opacity:1,y:0,duration:1,ease:`expo.out`},d===4?`<-1`:`>`),t.to(_,{opacity:1,y:0,duration:.8,ease:`power3.out`},`<+0.15`),t.to({},{duration:1.8}),t.to([g,_],{opacity:0,duration:.4})}addEventListener(`message`,t=>{t.origin===location.origin&&(t.data?.lab===`pause`&&e.globalTimeline.pause(),t.data?.lab===`play`&&e.globalTimeline.resume())}),addEventListener(`resize`,E),Promise.race([Promise.all(m.map(e=>e.decode().catch(()=>{}))),new Promise(e=>setTimeout(e,2500))]).then(()=>setTimeout(D,300)),E();