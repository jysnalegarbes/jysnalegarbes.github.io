const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["_astro/portrait-tweaks.BeZyJrVX.js","_astro/tweakpane.B9yL4GGH.js"])))=>i.map(i=>d[i]);
import{i as e}from"./liquid-morph.CYjK22Fx.js";import{t}from"./about-wipe.7SsKyXbq.js";import{t as n}from"./preload-helper.DHhhL8Zf.js";import{n as r}from"./lab-demo.CDV4dKc2.js";var i={inkEdge:{reach:3,blotSize:1.35,speckle:3,pool:0,drift:6.2},lensSettle:{zoom:.3,blur:.6},lensWarp:{base:.3,speedForFull:3,bulge:.09,magnify:.28,rgbSplit:.025},shutterStrips:{count:7,stagger:.045,duration:.36000000000000004,gap:.18000000000000002,offset:.18},ripple:{speedForFull:.7,height:5.3,frequency:6,waveSpeed:19,rgbSplit:.35},inkDevelop:{startLevels:2,endLevels:10,grain:.07,coarseGrain:.05,grainSize:2.2,fullTonesAt:.55},settle:.3},a=[`None`,`Ink Edge`,`Lens Settle`,`Lens Warp`,`Shutter Strips`,`Ripple`,`Ink Develop`,`Ripple + Ink`],o=a.length-1,s=32,c=(e,t=0,n=1)=>Math.min(n,Math.max(t,e)),l=`
  attribute vec2 aUv;
  void main() { gl_Position = vec4(aUv * 2.0 - 1.0, 0.0, 1.0); }
`,u=`
  precision highp float;
  uniform sampler2D tex;
  uniform vec2 res;      // canvas, device px
  uniform float dpr;
  uniform vec4 rect;     // portrait box: x, y, w, h in CSS px from the top left
  uniform float aspect;  // image width / height
  uniform float mode;
  uniform float amt;     // 1 at the start, 0 once it fills the screen
  uniform float u;       // progress through the growth, 0 → 1
  uniform float warp;    // 3: strength, from scroll speed
  uniform vec4 pa;       // the current effect's settings (see draw())
  uniform vec4 pb;

  // 2D simplex noise (Ashima / Stefan Gustavson)
  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  float fbm(vec2 p) {
    return 0.6 * snoise(p) + 0.3 * snoise(p * 2.1 + 7.3) + 0.1 * snoise(p * 4.3 - 3.1);
  }

  // object-fit: cover, centred
  vec4 cover(vec2 uv) {
    float box = rect.z / rect.w;
    vec2 s = box > aspect ? vec2(1.0, aspect / box) : vec2(box / aspect, 1.0);
    return texture2D(tex, 0.5 + (clamp(uv, 0.0, 1.0) - 0.5) * s);
  }

  void main() {
    vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
    vec2 uv = (px - rect.xy) / rect.zw;
    vec2 c = uv - 0.5;
    float side = min(rect.z, rect.w);
    vec4 col = vec4(0.0);

    if (mode < 1.5) {
      // 1 Ink Edge: the box edge pushed in (and now and then out) by noise
      vec2 q = abs(c * rect.zw) - rect.zw * 0.5;
      float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      float reach = amt * (8.0 + 0.1 * side) * pa.x;
      float n = fbm(px / ((24.0 + 0.12 * side) * pa.y) + u * pb.x);
      float speck = snoise(px / 3.5 + u * 9.0);
      float edge = sd + reach * (0.5 + 0.8 * n) + amt * pa.z * speck;
      float a = 1.0 - smoothstep(-0.75, 0.75, edge);
      // ink pooling a little darker just inside the edge
      float pool = smoothstep(-reach * 0.7, 0.0, edge) * amt;
      col = cover(uv);
      col.rgb *= 1.0 - pa.w * pool;
      col *= a;
    } else if (mode < 3.5) {
      // 3 Lens Warp: pillow-shaped outline, magnified centre, RGB split at the rim
      vec2 b = 0.5 * (1.0 + pa.x * warp * (1.0 - 4.0 * c.yx * c.yx));
      vec2 d = (abs(c) - b) * rect.zw;
      float a = clamp(0.5 - max(d.x, d.y), 0.0, 1.0);
      vec2 cn = c / b * 0.5;
      float r2 = clamp(dot(cn, cn) * 2.0, 0.0, 1.0);
      vec2 s = cn * (1.0 - pa.y * warp * (1.0 - r2));
      vec2 split = cn * pa.z * warp * r2;
      col.r = cover(0.5 + s + split).r;
      col.ga = cover(0.5 + s).ga;
      col.b = cover(0.5 + s - split).b;
      col *= a;
    } else if (mode < 4.5) {
      // 4 Shutter Strips: alternate strips open from the top and the bottom
      float n = pa.x;
      float i = floor(clamp(uv.x, 0.0, 0.9999) * n);
      float r = smoothstep(i * pa.y, i * pa.y + pa.z, u);
      float down = mod(i, 2.0) < 0.5 ? 1.0 : -1.0;
      float v = down > 0.0 ? uv.y : 1.0 - uv.y;
      float sw = rect.z / n;
      float lx = fract(clamp(uv.x, 0.0, 0.9999) * n) * sw;
      float gap = 0.5 * sw * pa.w * (1.0 - smoothstep(0.5, 1.0, u));
      float ax = min(lx - gap, sw - gap - lx);
      float ay = (r - v) * rect.w;
      vec2 o = abs(c * rect.zw) - rect.zw * 0.5;
      float a = clamp(min(min(ax, ay), -max(o.x, o.y)) + 0.5, 0.0, 1.0);
      col = cover(uv + vec2(0.0, down * (1.0 - r) * pb.x)) * a;
    } else {
      // 6 Ink Develop: two-tone ink print, then posterised, then full tones
      vec4 src = cover(uv);
      float l = dot(src.rgb, vec3(0.299, 0.587, 0.114));
      float grain = pa.z * snoise(px / pb.x + u * 7.0) + pa.w * snoise(px / 9.0);
      float dev = 1.0 - amt;
      float n = mix(pa.x, pa.y, pow(dev, 1.5));
      float q = clamp(floor((l + grain) * n) / (n - 1.0), 0.0, 1.0);
      vec3 tone = mix(vec3(0.078, 0.098, 0.094), vec3(0.843, 0.871, 0.871), q);
      vec2 o = abs(c * rect.zw) - rect.zw * 0.5;
      float a = clamp(0.5 - max(o.x, o.y), 0.0, 1.0);
      col = vec4(mix(tone, src.rgb, smoothstep(pb.y, 1.0, dev)), 1.0) * a;
    }
    gl_FragColor = col;
  }
`,d=`
  attribute vec2 aUv; // plane uv, top-left origin
  uniform vec4 rect;
  uniform vec2 view;  // stage, CSS px
  uniform float amp;
  uniform float phase;
  uniform float height;
  uniform float freq;
  varying vec2 vUv;
  varying float vWave;
  void main() {
    vUv = aUv;
    float z = sin((aUv.y - 0.5) * freq + phase) * amp * height;
    vWave = z;
    vec2 p = rect.xy + aUv * rect.zw;
    vec2 centre = view * 0.5;
    p = centre + (p - centre) * (50.0 / (50.0 - z));
    vec2 ndc = p / view * 2.0 - 1.0;
    gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  }
`,f=`
  precision highp float;
  uniform sampler2D tex;
  uniform vec4 rect;
  uniform float aspect;
  uniform float split;
  uniform float develop; // 7: 1 to tone it like Ink Develop
  uniform vec2 res;
  uniform float dpr;
  uniform float amt;
  uniform float u;
  uniform vec4 pa;       // Ink Develop's settings, as in the main shader
  uniform vec4 pb;
  varying vec2 vUv;
  varying float vWave;
  // 2D simplex noise (Ashima / Stefan Gustavson)
  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  vec3 cover(vec2 uv) {
    float box = rect.z / rect.w;
    vec2 s = box > aspect ? vec2(1.0, aspect / box) : vec2(box / aspect, 1.0);
    return texture2D(tex, 0.5 + (clamp(uv, 0.0, 1.0) - 0.5) * s).rgb;
  }
  void main() {
    float w = vWave;
    vec3 base = cover(vUv);
    vec3 shifted = vec3(cover(vUv + w * 0.04).r, cover(vUv + w * 0.01).g, cover(vUv - w * 0.03).b);
    vec3 col = mix(base, shifted, split);
    if (develop > 0.5) {
      vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      float grain = pa.z * snoise(px / pb.x + u * 7.0) + pa.w * snoise(px / 9.0);
      float dev = 1.0 - amt;
      float n = mix(pa.x, pa.y, pow(dev, 1.5));
      float q = clamp(floor((l + grain) * n) / (n - 1.0), 0.0, 1.0);
      vec3 tone = mix(vec3(0.078, 0.098, 0.094), vec3(0.843, 0.871, 0.871), q);
      col = mix(tone, col, smoothstep(pb.y, 1.0, dev));
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;function p(e){let t=[];for(let n=0;n<e;n++)for(let r=0;r<e;r++){let[i,a,o,s]=[r/e,(r+1)/e,n/e,(n+1)/e];t.push(i,o,a,o,i,s,i,s,a,o,a,s)}return new Float32Array(t)}function m(){let e=Number(new URLSearchParams(location.search).get(`pfx`));if(e>=0&&e<=o&&location.search.includes(`pfx`))return e;try{let e=Number(localStorage.getItem(`about-pfx`));if(e>=0&&e<=o)return e}catch{}return 1}function h(t,r,o){let h=r.querySelector(`img`);if(!h)return null;let g=m(),_=structuredClone(i),v=[],y=document.createElement(`canvas`);y.setAttribute(`aria-hidden`,`true`),Object.assign(y.style,{position:`absolute`,inset:`0`,width:`100%`,height:`100%`,pointerEvents:`none`,visibility:`hidden`}),r.after(y);let b=y.getContext(`webgl`,{alpha:!0,premultipliedAlpha:!0,antialias:!1}),x=null,S=null;if(b)try{x=e(b,l,u,[`tex`,`res`,`dpr`,`rect`,`aspect`,`mode`,`amt`,`u`,`warp`,`pa`,`pb`]),S=e(b,d,f,[`tex`,`rect`,`view`,`aspect`,`amp`,`phase`,`height`,`freq`,`split`,`develop`,`res`,`dpr`,`amt`,`u`,`pa`,`pb`])}catch(e){console.warn(`[portrait-expand]`,e)}let C=!1,w=1,T=b?.createBuffer()??null,E=b?.createBuffer()??null,D=p(s);b&&x&&(b.bindBuffer(b.ARRAY_BUFFER,T),b.bufferData(b.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),b.STATIC_DRAW),b.bindBuffer(b.ARRAY_BUFFER,E),b.bufferData(b.ARRAY_BUFFER,D,b.STATIC_DRAW),b.clearColor(0,0,0,0),h.decode().then(()=>{w=h.naturalWidth/h.naturalHeight;let e=b.getParameter(b.MAX_TEXTURE_SIZE),t=document.createElement(`canvas`);t.width=Math.min(2048,e),t.height=Math.min(4096,e),t.getContext(`2d`).drawImage(h,0,0,t.width,t.height);let n=b.createTexture();b.bindTexture(b.TEXTURE_2D,n),b.texImage2D(b.TEXTURE_2D,0,b.RGBA,b.RGBA,b.UNSIGNED_BYTE,t),b.generateMipmap(b.TEXTURE_2D),b.texParameteri(b.TEXTURE_2D,b.TEXTURE_MIN_FILTER,b.LINEAR_MIPMAP_LINEAR),b.texParameteri(b.TEXTURE_2D,b.TEXTURE_MAG_FILTER,b.LINEAR),b.texParameteri(b.TEXTURE_2D,b.TEXTURE_WRAP_S,b.CLAMP_TO_EDGE),b.texParameteri(b.TEXTURE_2D,b.TEXTURE_WRAP_T,b.CLAMP_TO_EDGE),C=!0,o()}).catch(e=>console.warn(`[portrait-expand]`,e)));let O=1,k=0,A=-1,j=0,M={w:0,h:0,cx:0,cy:0},N=0,P=0,F=0;function I(){h.style.transform=``,h.style.filter=``}let L={resize(e,t){O=Math.min(window.devicePixelRatio||1,2),y.width=Math.round(e*O),y.height=Math.round(t*O),b?.viewport(0,0,y.width,y.height)},render(e,t){let n=performance.now();if(A>=0){let t=Math.max(.001,(n-j)/1e3),r=Math.min(5,Math.abs(e-A)/t);k+=(r-k)*.25}A=e,j=n,M=t,V(),z()&&!F&&(F=requestAnimationFrame(B))},settings:_,mode:()=>g,setMode(e){g=e;try{localStorage.setItem(`about-pfx`,String(e))}catch{}v.forEach(t=>t(e)),o()},onMode(e){v.push(e)},refresh:()=>o()},R=e=>1-e*e*(3-2*e),z=()=>(g===3||g===5||g===7)&&k>.01&&R(A)>.002;function B(e){let t=Math.min(.1,(e-j)/1e3);e-j>50&&(k*=Math.exp(-t/Math.max(.01,_.settle))),k<.01&&(k=0),V(),F=z()?requestAnimationFrame(B):0}function V(){let e=performance.now();N+=Math.min(.1,(e-P)/1e3)*_.ripple.waveSpeed,P=e;let t=Math.max(0,A),n=M,r=R(t),i=r>.002&&n.w>.5;if(g===2&&i){let{zoom:e,blur:t}=_.lensSettle;h.style.transform=`scale(${1+e*r})`,h.style.filter=r>.02?`blur(${(t/100*n.w*r).toFixed(2)}px)`:``}else I();let a=g!==0&&g!==2&&i&&C&&b&&x&&S;if(y.style.visibility=a?`visible`:`hidden`,h.style.opacity=a?`0`:``,!a)return;let o=b,s=n.cx-n.w/2,l=n.cy-n.h/2;if(o.clear(o.COLOR_BUFFER_BIT),g===5||g===7){let{program:e,u:i,aUv:a}=S;o.useProgram(e),o.bindBuffer(o.ARRAY_BUFFER,E),o.enableVertexAttribArray(a),o.vertexAttribPointer(a,2,o.FLOAT,!1,0,0),o.uniform1i(i.tex,0),o.uniform4f(i.rect,s,l,n.w,n.h),o.uniform2f(i.view,y.width/O,y.height/O),o.uniform1f(i.aspect,w);let u=_.ripple;o.uniform1f(i.amp,r*c(k/u.speedForFull)),o.uniform1f(i.phase,N),o.uniform1f(i.height,u.height),o.uniform1f(i.freq,u.frequency),o.uniform1f(i.split,u.rgbSplit),o.uniform1f(i.develop,+(g===7)),o.uniform2f(i.res,y.width,y.height),o.uniform1f(i.dpr,O),o.uniform1f(i.amt,r),o.uniform1f(i.u,t);let[d,f]=H();o.uniform4f(i.pa,...d),o.uniform4f(i.pb,...f),o.drawArrays(o.TRIANGLES,0,D.length/2);return}let{program:u,u:d,aUv:f}=x;o.useProgram(u),o.bindBuffer(o.ARRAY_BUFFER,T),o.enableVertexAttribArray(f),o.vertexAttribPointer(f,2,o.FLOAT,!1,0,0),o.uniform1i(d.tex,0),o.uniform2f(d.res,y.width,y.height),o.uniform1f(d.dpr,O),o.uniform4f(d.rect,s,l,n.w,n.h),o.uniform1f(d.aspect,w),o.uniform1f(d.mode,g),o.uniform1f(d.amt,r),o.uniform1f(d.u,t);let p=_.lensWarp;o.uniform1f(d.warp,r*c(p.base+(1-p.base)*(k/p.speedForFull)));let[m,v]=H();o.uniform4f(d.pa,...m),o.uniform4f(d.pb,...v),o.drawArrays(o.TRIANGLE_STRIP,0,4)}function H(){let{inkEdge:e,lensWarp:t,shutterStrips:n,inkDevelop:r}=_;return g===1?[[e.reach,e.blotSize,e.speckle,e.pool],[e.drift,0,0,0]]:g===3?[[t.bulge,t.magnify,t.rgbSplit,0],[0,0,0,0]]:g===4?[[Math.round(n.count),n.stagger,n.duration,n.gap],[n.offset,0,0,0]]:[[r.startLevels,r.endLevels,r.grain,r.coarseGrain],[r.grainSize,r.fullTonesAt,0,0]]}new URLSearchParams(location.search).has(`embed`)||(U(),n(async()=>{let{mountPortraitTweaks:e}=await import(`./portrait-tweaks.BeZyJrVX.js`);return{mountPortraitTweaks:e}},__vite__mapDeps([0,1])).then(({mountPortraitTweaks:e})=>e(L,i,null)));function U(){let e=document.createElement(`div`);Object.assign(e.style,{position:`fixed`,left:`16px`,bottom:`16px`,zIndex:`9999`,display:`flex`,flexWrap:`wrap`,gap:`4px`,padding:`6px`,maxWidth:`calc(100vw - 32px)`,background:`rgba(20,25,24,.85)`,borderRadius:`8px`,font:`12px/1 system-ui, sans-serif`});let t=a.map((t,n)=>{let r=document.createElement(`button`);return r.type=`button`,r.textContent=n?`${n} ${t}`:t,Object.assign(r.style,{padding:`7px 10px`,border:`0`,borderRadius:`5px`,cursor:`pointer`,font:`inherit`}),r.addEventListener(`click`,()=>L.setMode(n)),e.append(r),r}),n=()=>t.forEach((e,t)=>{e.style.background=t===g?`#d7dede`:`transparent`,e.style.color=t===g?`#141918`:`#d7dede`});n(),L.onMode(n),document.body.append(e)}return L}var g=.15,_=.42,v=.66,y=.7,b=.97,x={left:.205,right:.36},S={left:.68,right:.6},C=87/110,w=1090/613,T=1090,E=.09,D=(e,t=0,n=1)=>Math.min(n,Math.max(t,e)),O=(e,t,n)=>e+(t-e)*n,k=(e,t,n)=>D((e-t)/(n-t)),A=e=>e<.5?4*e*e*e:1-(-2*e+2)**3/2;function j(e){let n=e.querySelector(`[data-about-stage]`),r=e.querySelector(`[data-about-media]`),i=e.querySelector(`[data-about-half="left"]`),a=e.querySelector(`[data-about-half="right"]`),o=e.querySelector(`[data-about-wipe]`),s=e.querySelector(`[data-about-black]`);if(!n||!r||!i||!a||!s)return;let c=o?t(o):null,l=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,u=window.matchMedia(`(min-width: 1024px)`),d=l?null:h(n,r,()=>z>=0&&L(z));e.classList.add(`is-scrub`);let f=0,p=0,m=0,j=0,M=0,N=[];function P(){i.style.transform=``,a.style.transform=``;let e=n.getBoundingClientRect();f=e.width,p=e.height,m=parseFloat(getComputedStyle(i).fontSize);let t=i.getBoundingClientRect(),r=a.getBoundingClientRect();j=t.right-e.left,M=r.left-e.left;let o=r.top+r.height/2-e.top,s=C*m,l;if(u.matches)l=f/1920*T;else{let e=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--gutter`))||24;l=f-2*e}N=[{w:0,h:0,cx:f/2,cy:o},{w:s*w,h:s,cx:f/2,cy:o},{w:l,h:l/w,cx:f/2,cy:p/2},{w:f,h:p,cx:f/2,cy:p/2}],c?.resize(f,p),d?.resize(f,p)}function F(e){let t,n,r;e<=g?[t,n,r]=[N[0],N[1],k(e,0,g)]:e<=_?[t,n,r]=[N[1],N[2],k(e,g,_)]:[t,n,r]=[N[2],N[3],k(e,_,v)];let i=A(r);return{w:O(t.w,n.w,i),h:O(t.h,n.h,i),cx:O(t.cx,n.cx,i),cy:O(t.cy,n.cy,i)}}function I(e,t){let n=e<=g?x:{left:O(x.left,S.left,A(k(e,g,_))),right:O(x.right,S.right,A(k(e,g,_)))},r=t.cx-t.w/2-n.left*m-j,i=t.cx+t.w/2+n.right*m-M;if(e>=g)return{dl:r,dr:i};let a=A(k(e,0,g)),o=F(g),s=o.cx-o.w/2-x.left*m-j,c=o.cx+o.w/2+x.right*m-M;return{dl:s*a,dr:c*a}}function L(e){let t=F(e);r.style.width=`${t.w}px`,r.style.height=`${t.h}px`,r.style.transform=`translate3d(${t.cx-t.w/2}px, ${t.cy-t.h/2}px, 0)`,r.style.visibility=t.w<.5?`hidden`:`visible`,d?.render(k(e,0,v),t);let{dl:n,dr:l}=I(e,t);i.style.transform=`translate3d(${n}px, 0, 0)`,a.style.transform=`translate3d(${l}px, 0, 0)`;let u=k(e,y,b),f=u>0&&u<1;o&&(o.style.visibility=c&&f?`visible`:`hidden`),c&&f&&c.draw(u),u>=1?(s.style.visibility=`visible`,s.style.clipPath=`none`):!c&&u>0?(s.style.visibility=`visible`,s.style.clipPath=`inset(${(1-A(u))*100}% 0 0 0)`):s.style.visibility=`hidden`,document.body.classList.toggle(`is-header-dark`,u>=.92)}function R(){let t=e.getBoundingClientRect(),n=t.height-p,r=n>0?D(-t.top/n):0;return l?[0,g,_,v,1].reduce((e,t)=>Math.abs(t-r)<Math.abs(e-r)?t:e,0):r}let z=-1,B=0,V=0,H=0;function U(e){let t=Math.min(.1,(e-H)/1e3);H=e,z+=(B-z)*(1-Math.exp(-t/E)),Math.abs(B-z)<5e-4&&(z=B),L(z),V=z===B?0:requestAnimationFrame(U)}function W(){B=R(),l||z<0?(z=B,L(z)):!V&&B!==z&&(H=performance.now(),V=requestAnimationFrame(U))}function G(){P(),B=R(),z=B,L(z)}P(),W(),document.fonts?.ready.then(G),window.addEventListener(`scroll`,W,{passive:!0}),window.addEventListener(`resize`,G),u.addEventListener(`change`,G)}var M=document.querySelector(`[data-about-intro]`);M&&(j(M),r(()=>{let e=M.offsetHeight-innerHeight;return[e*.02,e*.68]}));export{a as t};