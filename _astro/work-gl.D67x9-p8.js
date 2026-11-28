import{i as e}from"./ink-halftone.DDtCBRyx.js";import{a as t,c as n,i as r,l as i,n as a,o,r as s}from"./liquid-morph.CYjK22Fx.js";var c=`
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
`,l=`
precision highp float;
uniform sampler2D uTex;
uniform vec2 uImg;
uniform vec2 uBox;
uniform float uAlpha;
varying vec2 vUv;
varying float vShade;

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
`;function u(u,d,{onReady:f}){let p=u.getContext(`webgl`,{alpha:!0,antialias:!0,premultipliedAlpha:!0});if(!p)return null;let m=[`uViewport`,`uTime`,`uTex`,`uImg`,`uBox`,`uAlpha`],h=r(p,c,l,[...m,`uRect`,`uVelo`]),g=r(p,t,s,[...m,`uFrom`,`uTo`,`uT`,`uInk`]);e(p,g.program);let{verts:_,idx:v}=n();p.bindBuffer(p.ARRAY_BUFFER,p.createBuffer()),p.bufferData(p.ARRAY_BUFFER,_,p.STATIC_DRAW),p.bindBuffer(p.ELEMENT_ARRAY_BUFFER,p.createBuffer()),p.bufferData(p.ELEMENT_ARRAY_BUFFER,v,p.STATIC_DRAW),p.enable(p.BLEND),p.blendFunc(p.ONE,p.ONE_MINUS_SRC_ALPHA);let y=e=>{p.useProgram(e.program),p.enableVertexAttribArray(e.aUv),p.vertexAttribPointer(e.aUv,2,p.FLOAT,!1,0,0),p.uniform1i(e.u.uTex,0)},b=null,x=e=>(e.srcset||``).split(`,`).map(e=>e.trim().split(/\s+/)).filter(e=>e[0]).sort((e,t)=>parseFloat(t[1]??`0`)-parseFloat(e[1]??`0`))[0]?.[0]||e.currentSrc||e.src,S=new Map,C=d.map(()=>null),w=d.map((e,t)=>{let n=x(e);if(!S.has(n)){let e=new Image;e.decoding=`async`,e.src=n,S.set(n,e.decode().then(()=>({tex:i(p,e),size:[e.naturalWidth,e.naturalHeight]})))}return S.get(n).then(e=>C[t]=e).catch(()=>null)});Promise.all(w).then(()=>{d.forEach((e,t)=>C[t]&&f(t)),b&&D(b)});let T={w:1,h:1};function E(){let e=Math.min(window.devicePixelRatio||1,2);T={w:u.clientWidth||1,h:u.clientHeight||1},u.width=Math.round(T.w*e),u.height=Math.round(T.h*e),p.viewport(0,0,u.width,u.height),b&&D(b)}function D(e){b=e,p.clearColor(0,0,0,0),p.clear(p.COLOR_BUFFER_BIT),y(h),p.uniform2f(h.u.uViewport,T.w,T.h),p.uniform1f(h.u.uVelo,e.velocity),p.uniform1f(h.u.uTime,e.time),e.cards.forEach((t,n)=>{let r=C[n],i=t.alpha??1;!r||i<=0||n===e.travel?.index||t.x>T.w+40||t.x+t.w<-40||(p.bindTexture(p.TEXTURE_2D,r.tex),p.uniform2f(h.u.uImg,r.size[0],r.size[1]),p.uniform2f(h.u.uBox,t.w,t.h),p.uniform4f(h.u.uRect,t.x,t.y,t.w,t.h),p.uniform1f(h.u.uAlpha,i),p.drawElements(p.TRIANGLES,v.length,p.UNSIGNED_SHORT,0))});let t=e.travel,n=t&&C[t.index];if(!t||!n)return;y(g);let r=a(t.t);p.uniform2f(g.u.uViewport,T.w,T.h),p.uniform1f(g.u.uTime,e.time),p.uniform2f(g.u.uImg,n.size[0],n.size[1]),p.uniform2f(g.u.uBox,t.from.w+(t.to.w-t.from.w)*r,t.from.h+(t.to.h-t.from.h)*r),p.uniform4f(g.u.uFrom,t.from.x,t.from.y,t.from.w,t.from.h),p.uniform4f(g.u.uTo,t.to.x,t.to.y,t.to.w,t.to.h),p.uniform1f(g.u.uT,t.t),p.uniform1f(g.u.uInk,o(t.t)),p.uniform1f(g.u.uAlpha,1),p.bindTexture(p.TEXTURE_2D,n.tex),p.drawElements(p.TRIANGLES,v.length,p.UNSIGNED_SHORT,0)}return E(),window.addEventListener(`resize`,E),{render:D,destroy(){window.removeEventListener(`resize`,E)}}}export{u as mountWorkGl};