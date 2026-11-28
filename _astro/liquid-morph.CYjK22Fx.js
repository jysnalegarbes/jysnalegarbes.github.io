import{i as e,r as t}from"./ink-halftone.DDtCBRyx.js";var n=1.3,r=e=>e<.5?4*e*e*e:1-(-2*e+2)**3/2,i=`
precision highp float;
attribute vec2 aUv;
uniform vec2 uViewport;
uniform vec4 uFrom;
uniform vec4 uTo;
uniform float uT;
uniform float uTime;
varying vec2 vUv;
varying float vShade;

const float PI = 3.14159265;

float ease(float x) {
  return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) * 0.5;
}

void main() {
  // Lead with the edge facing the destination
  vec2 travel = (uTo.xy + uTo.zw * 0.5) - (uFrom.xy + uFrom.zw * 0.5);
  vec2 dir = travel / max(length(travel), 1.0);
  float lead = clamp(0.5 + dot(aUv - 0.5, dir) * 0.9, 0.0, 1.0);
  float lag = 0.42;
  float p = ease(clamp((uT - (1.0 - lead) * lag) / (1.0 - lag), 0.0, 1.0));

  vec4 r = mix(uFrom, uTo, p);
  vec2 pos = r.xy + aUv * r.zw;

  // Faint cloth ripple mid-flight
  float amp = sin(PI * uT) * 0.2;
  float phase = uTime * 5.0;
  pos.y += sin(aUv.x * PI * 1.8 - phase + aUv.y * 1.2) * amp * r.w * 0.075;
  pos.x += sin(aUv.y * PI * 1.4 - phase * 0.8) * amp * r.z * 0.035;
  vShade = cos(aUv.x * PI * 1.8 - phase + aUv.y * 1.2) * amp;

  vUv = aUv;
  vec2 clip = pos / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`,a={in:[0,.22],out:[.5,.92]};function o(e){let t=(t,n)=>{let r=Math.min(1,Math.max(0,(e-t)/(n-t)));return r*r*(3-2*r)};return t(a.in[0],a.in[1])*(1-t(a.out[0],a.out[1]))}var s=`
precision highp float;
uniform sampler2D uTex;
uniform vec2 uImg;
uniform vec2 uBox;
uniform float uAlpha;
uniform float uInk;
varying vec2 vUv;
varying float vShade;
${t}

vec2 cover(vec2 uv) {
  float rb = uBox.x / uBox.y;
  float ri = uImg.x / uImg.y;
  vec2 scale = rb > ri ? vec2(1.0, ri / rb) : vec2(rb / ri, 1.0);
  return (uv - 0.5) * scale + 0.5;
}

void main() {
  vec3 col = texture2D(uTex, cover(vUv)).rgb;
  // Unconditional sample: no texture reads under per-pixel branching
  vec2 g = inkGrid(vUv, uBox, uInk);
  vec3 c = texture2D(uTex, cover(inkCentre(g, uBox, uInk))).rgb;
  col = mix(col, inkDots(g, uInk, c), smoothstep(0.0, 1.0, inkFront(uInk, vUv.y)));
  col *= 1.0 + vShade * 0.12;
  gl_FragColor = vec4(col * uAlpha, uAlpha);
}
`;function c(e=48,t=32){let n=[];for(let r=0;r<=t;r++)for(let i=0;i<=e;i++)n.push(i/e,r/t);let r=[];for(let n=0;n<t;n++)for(let t=0;t<e;t++){let i=n*(e+1)+t;r.push(i,i+1,i+e+1,i+1,i+e+2,i+e+1)}return{verts:new Float32Array(n),idx:new Uint16Array(r)}}function l(e,t,n,r){let i=(t,n)=>{let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw Error(e.getShaderInfoLog(r)??`shader`);return r},a=e.createProgram();if(e.attachShader(a,i(e.VERTEX_SHADER,t)),e.attachShader(a,i(e.FRAGMENT_SHADER,n)),e.linkProgram(a),!e.getProgramParameter(a,e.LINK_STATUS))throw Error(e.getProgramInfoLog(a)??`link`);return{program:a,u:Object.fromEntries(r.map(t=>[t,e.getUniformLocation(a,t)])),aUv:e.getAttribLocation(a,`aUv`)}}function u(e,t){let n=e.createTexture();return e.bindTexture(e.TEXTURE_2D,n),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),n}async function d(t,{zIndex:n=25}={}){let a=document.createElement(`canvas`);a.setAttribute(`aria-hidden`,`true`),Object.assign(a.style,{position:`fixed`,top:`0`,left:`0`,width:`100%`,height:`100%`,zIndex:String(n),pointerEvents:`none`});let d=a.getContext(`webgl`,{alpha:!0,antialias:!0,premultipliedAlpha:!0});if(!d)return null;let f=new Image;f.src=t.currentSrc||t.src;try{await f.decode()}catch{return null}let p=l(d,i,s,[`uViewport`,`uFrom`,`uTo`,`uT`,`uTime`,`uTex`,`uImg`,`uBox`,`uAlpha`,`uInk`]);e(d,p.program);let{verts:m,idx:h}=c();d.bindBuffer(d.ARRAY_BUFFER,d.createBuffer()),d.bufferData(d.ARRAY_BUFFER,m,d.STATIC_DRAW),d.bindBuffer(d.ELEMENT_ARRAY_BUFFER,d.createBuffer()),d.bufferData(d.ELEMENT_ARRAY_BUFFER,h,d.STATIC_DRAW),d.useProgram(p.program),d.enableVertexAttribArray(p.aUv),d.vertexAttribPointer(p.aUv,2,d.FLOAT,!1,0,0),d.enable(d.BLEND),d.blendFunc(d.ONE,d.ONE_MINUS_SRC_ALPHA),u(d,f),d.uniform1i(p.u.uTex,0),d.uniform1f(p.u.uAlpha,1),d.uniform2f(p.u.uImg,f.naturalWidth,f.naturalHeight),document.body.append(a);let g=Math.min(window.devicePixelRatio||1,2),_=a.clientWidth,v=a.clientHeight;return a.width=Math.round(_*g),a.height=Math.round(v*g),d.viewport(0,0,a.width,a.height),d.uniform2f(p.u.uViewport,_,v),{draw(e,t,n){let i=r(n);d.clearColor(0,0,0,0),d.clear(d.COLOR_BUFFER_BIT),d.uniform4f(p.u.uFrom,e.x,e.y,e.w,e.h),d.uniform4f(p.u.uTo,t.x,t.y,t.w,t.h),d.uniform2f(p.u.uBox,e.w+(t.w-e.w)*i,e.h+(t.h-e.h)*i),d.uniform1f(p.u.uT,n),d.uniform1f(p.u.uInk,o(n)),d.uniform1f(p.u.uTime,performance.now()/1e3),d.drawElements(d.TRIANGLES,h.length,d.UNSIGNED_SHORT,0)},destroy(){a.remove()}}}export{i as a,c,l as i,u as l,r as n,o,s as r,d as s,n as t};