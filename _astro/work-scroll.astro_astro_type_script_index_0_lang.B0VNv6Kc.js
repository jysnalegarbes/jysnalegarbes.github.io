function e(e,t,{fx:n,onReady:r}){let i=e.getContext(`webgl`,{alpha:!0,antialias:!0,premultipliedAlpha:!0});if(!i)return null;let a=(e,t)=>{let n=i.createShader(e);if(i.shaderSource(n,t),i.compileShader(n),!i.getShaderParameter(n,i.COMPILE_STATUS))throw Error(i.getShaderInfoLog(n)??`shader`);return n},o=i.createProgram();if(i.attachShader(o,a(i.VERTEX_SHADER,`
precision highp float;
attribute vec2 aUv;
uniform vec2 uViewport;
uniform vec4 uRect;
uniform float uVelo;
uniform float uTime;
uniform float uFx;
uniform float uMargin;
varying vec2 vUv;
varying float vShade;

const float PI = 3.14159265;

void main() {
  vec2 size = uRect.zw + 2.0 * uMargin;
  vec2 pos = uRect.xy - uMargin + aUv * size;
  vec2 uv = (pos - uRect.xy) / uRect.zw;
  float a = abs(uVelo);
  vShade = 0.0;

  if (uFx < 1.5) {
    // Flag: two travelling waves, pinned softly at the corners
    float phase = uTime * 5.0;
    float wy = sin(uv.x * PI * 1.8 - phase + uv.y * 1.2);
    float wx = sin(uv.y * PI * 1.4 - phase * 0.8);
    pos.y += wy * a * uRect.w * 0.075;
    pos.x += wx * a * uRect.z * 0.035;
    vShade = cos(uv.x * PI * 1.8 - phase + uv.y * 1.2) * a;
  } else if (uFx < 2.5) {
    // Bend: the middle lags behind the edges
    pos.x += sin(clamp(uv.y, 0.0, 1.0) * PI) * uVelo * uRect.z * 0.12;
  }

  vUv = uv;
  vec2 clip = pos / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`)),i.attachShader(o,a(i.FRAGMENT_SHADER,`
precision highp float;
uniform sampler2D uTex;
uniform vec2 uImg;
uniform vec4 uRect;
uniform float uVelo;
uniform float uTime;
uniform float uFx;
uniform float uFocus;
uniform vec3 uInk;
uniform vec3 uPaper;
varying vec2 vUv;
varying float vShade;

vec2 cover(vec2 uv, float zoom) {
  vec2 box = uRect.zw;
  float rb = box.x / box.y;
  float ri = uImg.x / uImg.y;
  vec2 scale = rb > ri ? vec2(1.0, ri / rb) : vec2(rb / ri, 1.0);
  return (uv - 0.5) * scale * zoom + 0.5;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < 4; i++) { v += amp * noise(p); p *= 2.03; amp *= 0.5; }
  return v;
}

void main() {
  vec2 uv = vUv;
  float a = abs(uVelo);
  bool inside = uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
  vec3 col;
  float alpha = 1.0;

  if (uFx < 1.5) {
    if (!inside) discard;
    col = texture2D(uTex, cover(uv, 1.0)).rgb;
    col *= 1.0 + vShade * 0.12;
  } else if (uFx < 2.5) {
    if (!inside) discard;
    vec2 t = cover(uv, mix(0.82, 1.0, uFocus));
    col.r = texture2D(uTex, t).r;
    col.g = texture2D(uTex, t + vec2(0.025 * uVelo, 0.0)).g;
    col.b = texture2D(uTex, t + vec2(0.045 * uVelo, 0.0)).b;
  } else if (uFx < 3.5) {
    // Ink drag. Distance to the card edge in px (negative outside)
    vec2 px = uv * uRect.zw;
    float edge = min(min(px.x, uRect.z - px.x), min(px.y, uRect.w - px.y));
    float trailing = uVelo > 0.0 ? uv.x : 1.0 - uv.x;
    // Streaky noise (stretched along x) reads as drag marks
    float n = fbm(vec2(uv.x * 2.5 + uTime * 0.5, uv.y * 26.0));
    float sideways = (px.x < 0.0 || px.x > uRect.z) ? 1.0 : 0.15;
    float reach = a * (6.0 + 56.0 * trailing * sideways) * n * n * 1.6;
    if (edge < 0.0 && -edge > reach) discard;

    vec3 sum = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      float s = float(i) / 11.0 - 0.15;
      sum += texture2D(uTex, cover(uv - vec2(s * uVelo * 0.1, 0.0), 1.0)).rgb;
    }
    col = sum / 12.0;
    // Ink creeps in from the edge and soaks the trailing side
    float soak = smoothstep(reach * 0.9, reach * 0.2, edge) * step(0.001, a);
    col = mix(col, uInk, max(soak, a * trailing * 0.35));
    if (edge < 0.0) col = uInk;
  } else {
    if (!inside) discard;
    float amt = smoothstep(0.03, 0.45, a);
    vec3 img = texture2D(uTex, cover(uv, 1.0)).rgb;
    // 45-degree screen; cells grow with speed
    float cell = mix(5.0, 14.0, amt);
    vec2 px = uv * uRect.zw;
    mat2 rot = mat2(0.7071, -0.7071, 0.7071, 0.7071);
    mat2 unrot = mat2(0.7071, 0.7071, -0.7071, 0.7071);
    vec2 q = rot * px;
    vec2 centre = (floor(q / cell) + 0.5) * cell;
    vec2 cuv = (unrot * centre) / uRect.zw;
    vec3 s = texture2D(uTex, cover(clamp(cuv, 0.0, 1.0), 1.0)).rgb;
    float lum = dot(s, vec3(0.299, 0.587, 0.114));
    float r = sqrt(1.0 - lum) * cell * 0.72;
    float d = length(q - centre);
    float dotMask = 1.0 - smoothstep(r - 0.8, r + 0.8, d);
    vec3 tone = mix(uPaper, uInk, dotMask);
    col = mix(img, tone, amt);
  }

  gl_FragColor = vec4(col * alpha, alpha);
}
`)),i.linkProgram(o),!i.getProgramParameter(o,i.LINK_STATUS))throw Error(i.getProgramInfoLog(o)??`link`);i.useProgram(o);let s=[];for(let e=0;e<=32;e++)for(let t=0;t<=48;t++)s.push(t/48,e/32);let c=[];for(let e=0;e<32;e++)for(let t=0;t<48;t++){let n=e*49+t;c.push(n,n+1,n+48+1,n+1,n+48+2,n+48+1)}i.bindBuffer(i.ARRAY_BUFFER,i.createBuffer()),i.bufferData(i.ARRAY_BUFFER,new Float32Array(s),i.STATIC_DRAW),i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,i.createBuffer()),i.bufferData(i.ELEMENT_ARRAY_BUFFER,new Uint16Array(c),i.STATIC_DRAW);let l=i.getAttribLocation(o,`aUv`);i.enableVertexAttribArray(l),i.vertexAttribPointer(l,2,i.FLOAT,!1,0,0);let u=Object.fromEntries([`uViewport`,`uRect`,`uVelo`,`uTime`,`uFx`,`uMargin`,`uTex`,`uImg`,`uFocus`,`uInk`,`uPaper`].map(e=>[e,i.getUniformLocation(o,e)])),d=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16)/255),f=getComputedStyle(document.documentElement);i.uniform3fv(u.uInk,d(f.getPropertyValue(`--black`).trim()||`#141918`)),i.uniform3fv(u.uPaper,d(f.getPropertyValue(`--bg`).trim()||`#e1e8e8`)),i.uniform1i(u.uTex,0),i.enable(i.BLEND),i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA);let p=n,m=null,h=t.map((e,t)=>{let n={tex:null,size:[1,1]},a=(e.srcset||``).split(`,`).map(e=>e.trim().split(/\s+/)).filter(e=>e[0]).sort((e,t)=>parseFloat(t[1]??`0`)-parseFloat(e[1]??`0`))[0]?.[0]||e.currentSrc||e.src,o=new Image;return o.decoding=`async`,o.src=a,o.decode().then(()=>{let e=i.createTexture();i.bindTexture(i.TEXTURE_2D,e),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.texImage2D(i.TEXTURE_2D,0,i.RGBA,i.RGBA,i.UNSIGNED_BYTE,o),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MAG_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE),n.tex=e,n.size=[o.naturalWidth,o.naturalHeight],m&&v(m),r(t)}).catch(()=>{}),n}),g={w:1,h:1};function _(){let t=Math.min(window.devicePixelRatio||1,2);g={w:e.clientWidth||1,h:e.clientHeight||1},e.width=Math.round(g.w*t),e.height=Math.round(g.h*t),i.viewport(0,0,e.width,e.height),m&&v(m)}function v(e){m=e,i.clearColor(0,0,0,0),i.clear(i.COLOR_BUFFER_BIT),i.uniform2f(u.uViewport,g.w,g.h),i.uniform1f(u.uVelo,e.velocity),i.uniform1f(u.uTime,e.time),i.uniform1f(u.uFx,p),i.uniform1f(u.uMargin,p===3?140:0),e.cards.forEach((e,t)=>{let n=h[t];n.tex&&(e.x>g.w+140||e.x+e.w<-140||(i.bindTexture(i.TEXTURE_2D,n.tex),i.uniform2f(u.uImg,n.size[0],n.size[1]),i.uniform4f(u.uRect,e.x,e.y,e.w,e.h),i.uniform1f(u.uFocus,e.focus),i.drawElements(i.TRIANGLES,c.length,i.UNSIGNED_SHORT,0)))})}return _(),window.addEventListener(`resize`,_),{render:v,setFx(e){p=e,m&&v(m)},destroy(){window.removeEventListener(`resize`,_)}}}var t=Number(new URLSearchParams(location.search).get(`pfx`)),n=[1,2,3,4].includes(t)?t:1,r=document.querySelector(`[data-strip-gl]`),i=[...document.querySelectorAll(`.strip__src`)],a=e(r,i,{fx:n,onReady:()=>{}}),o=2.1,s=.85,c=e=>e<.5?4*e*e*e:1-(-2*e+2)**3/2,l=e=>e%3==2?2:1,u=e=>{let t=Math.floor(e/o),n=0;for(let e=0;e<t;e++)n+=l(e);return n+l(t)*c(Math.min(1,e%o/s))},d=!1;addEventListener(`message`,e=>{e.origin===location.origin&&(e.data?.lab===`pause`&&(d=!0),e.data?.lab===`play`&&(d=!1))});var f=i.length,p=0,m=0,h=0,g=0;function _(e){let t=m?Math.min(.1,(e-m)/1e3):0;m=e,d||(p+=t);let n=u(p),r=t>0?(n-h)/t:0;h=n,g+=(Math.max(-1,Math.min(1,r/3))-g)*(1-Math.exp(-t*8));let o=innerWidth,s=innerHeight,c=o*.36,l=c*.68,v=c+o*.025,y=o*.06,b=i.map((e,t)=>{let r=((t-n+2)%f+f)%f-2;return{x:y+r*v,y:(s-l)/2,w:c,h:l,focus:Math.max(0,1-Math.abs(r))}});a?.render({cards:b,velocity:g,time:e/1e3}),requestAnimationFrame(_)}requestAnimationFrame(_);