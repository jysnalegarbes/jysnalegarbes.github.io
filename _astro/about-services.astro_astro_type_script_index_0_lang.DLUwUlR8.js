import{t as e}from"./gsap.CvDoa17S.js";import{i as t}from"./liquid-morph.CYjK22Fx.js";import{t as n}from"./lab-demo.CDV4dKc2.js";var r=[15/255,177/255,42/255],i=1/2.184,a=1,o=.5,s=1.5,c=32,l=`
  attribute vec2 aUv;    // plane uv, three.js convention (0,0 bottom left)
  uniform vec2 uView;    // canvas, CSS px
  uniform vec2 uPos;     // plane centre, CSS px from the top left
  uniform vec2 uSize;    // plane size, CSS px
  uniform vec2 uOffset;  // drag offset, CSS px (y up)
  varying vec2 vUv;
  void main() {
    vUv = aUv;
    // The demo's deformationCurve: bow the plane against the drag
    vec2 p = (aUv - 0.5) * uSize;
    p.x += sin(aUv.y * 3.14159265) * uOffset.x;
    p.y += sin(aUv.x * 3.14159265) * uOffset.y;
    vec2 px = vec2(uPos.x + p.x, uPos.y - p.y);
    vec2 ndc = px / uView * 2.0 - 1.0;
    gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  }
`,u=`
  precision highp float;
  uniform sampler2D uTexture;
  uniform vec2 uTextureSize;
  uniform vec2 uElementSize;
  uniform vec3 uFillColor;
  uniform float uProgress;
  uniform float uTime;
  uniform float uAlpha;
  uniform vec2 uShift;   // red channel shift, in uv (the demo's uOffset)
  varying vec2 vUv;

  float hashwithoutsine12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // Classic Perlin 2D noise, Stefan Gustavson
  vec2 fade(vec2 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float cnoise(vec2 P) {
    vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
    vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
    Pi = mod(Pi, 289.0);
    vec4 ix = Pi.xzxz;
    vec4 iy = Pi.yyww;
    vec4 fx = Pf.xzxz;
    vec4 fy = Pf.yyww;
    vec4 i = permute(permute(ix) + iy);
    vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0;
    vec4 gy = abs(gx) - 0.5;
    vec4 tx = floor(gx + 0.5);
    gx = gx - tx;
    vec2 g00 = vec2(gx.x, gy.x);
    vec2 g10 = vec2(gx.y, gy.y);
    vec2 g01 = vec2(gx.z, gy.z);
    vec2 g11 = vec2(gx.w, gy.w);
    vec4 norm = 1.79284291400159 - 0.85373472095314 *
      vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11));
    g00 *= norm.x;
    g01 *= norm.y;
    g10 *= norm.z;
    g11 *= norm.w;
    float n00 = dot(g00, vec2(fx.x, fy.x));
    float n10 = dot(g10, vec2(fx.y, fy.y));
    float n01 = dot(g01, vec2(fx.z, fy.z));
    float n11 = dot(g11, vec2(fx.w, fy.w));
    vec2 fade_xy = fade(Pf.xy);
    vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
    float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
    return 2.3 * n_xy;
  }

  float cubicInOut(float t) {
    return t < 0.5 ? 4.0 * t * t * t : 0.5 * pow(2.0 * t - 2.0, 3.0) + 1.0;
  }
  float parabola(float x, float k) { return pow(4. * x * (1. - x), k); }

  void main() {
    // texture cover
    vec2 uv = vUv - vec2(0.5);
    float aspect1 = uTextureSize.x / uTextureSize.y;
    float aspect2 = uElementSize.x / uElementSize.y;
    if (aspect1 > aspect2) { uv *= vec2(aspect2 / aspect1, 1.); }
    else { uv *= vec2(1., aspect1 / aspect2); }
    uv += vec2(0.5);

    // Variation 2 (uType 1)
    float hash = hashwithoutsine12(vUv * 1000. + floor(uTime * 3.) * 0.1);
    vec3 fillColor = uFillColor + (vec3(hash) - vec3(0.5)) * 0.2;
    float n = (cnoise(vUv * vec2(35., 1.)) + 1.) * 0.5;
    float dt = parabola(cubicInOut(uProgress), 1.);
    vec2 distUV = uv;
    distUV.y = 1. - (1. - uv.y) * (1. - dt * 0.3);

    // Motion Hover: the red channel trails by the drag offset
    vec3 image = vec3(texture2D(uTexture, distUV + uShift).r, texture2D(uTexture, distUV).gb);

    // Done: the band's width is 0 here and smoothstep(1, 1, x) is undefined
    if (uProgress >= 1.) {
      gl_FragColor = vec4(image * uAlpha, uAlpha);
      return;
    }

    float w = dt;
    float maskvalue = smoothstep(1. - w, 1., vUv.y + mix(-w / 2., 1. - w / 2., cubicInOut(uProgress)));
    float mask = maskvalue + maskvalue * n;
    float final = smoothstep(1., 1. + 0.01, mask);
    float final1 = smoothstep(1., 1. + 0.01, mask + 0.5);
    if (final1 == 0.) discard;

    vec3 color = mix(fillColor, image, final);
    gl_FragColor = vec4(color * uAlpha, uAlpha);
  }
`;function d(e){let t=[];for(let n=0;n<e;n++)for(let r=0;r<e;r++){let[i,a,o,s]=[r/e,(r+1)/e,n/e,(n+1)/e];t.push(i,o,a,o,i,s,i,s,a,o,a,s)}return new Float32Array(t)}function f(n,f){if(!f.length||!window.matchMedia(`(hover: hover) and (pointer: fine)`).matches||window.matchMedia(`(prefers-reduced-motion: reduce)`).matches)return;let p=document.createElement(`canvas`);p.className=`service-hover`,p.setAttribute(`aria-hidden`,`true`);let m=p.getContext(`webgl`,{alpha:!0,premultipliedAlpha:!0,antialias:!0});if(!m)return;let h;try{h=t(m,l,u,[`uView`,`uPos`,`uSize`,`uOffset`,`uTexture`,`uTextureSize`,`uElementSize`,`uFillColor`,`uProgress`,`uTime`,`uAlpha`,`uShift`])}catch(e){console.warn(`[service-hover]`,e);return}n.prepend(p);let g=d(c);m.bindBuffer(m.ARRAY_BUFFER,m.createBuffer()),m.bufferData(m.ARRAY_BUFFER,g,m.STATIC_DRAW),m.useProgram(h.program),m.enableVertexAttribArray(h.aUv),m.vertexAttribPointer(h.aUv,2,m.FLOAT,!1,0,0),m.enable(m.BLEND),m.blendFunc(m.ONE,m.ONE_MINUS_SRC_ALPHA),m.clearColor(0,0,0,0),m.pixelStorei(m.UNPACK_FLIP_Y_WEBGL,!0),m.uniform3fv(h.u.uFillColor,r),m.uniform1i(h.u.uTexture,0);let _=f.map(({src:e})=>{let t={tex:null,w:1,h:1},n=new Image;return n.decoding=`async`,n.src=e,n.decode().then(()=>{t.tex=m.createTexture(),m.bindTexture(m.TEXTURE_2D,t.tex),m.texImage2D(m.TEXTURE_2D,0,m.RGBA,m.RGBA,m.UNSIGNED_BYTE,n),m.texParameteri(m.TEXTURE_2D,m.TEXTURE_MIN_FILTER,m.LINEAR),m.texParameteri(m.TEXTURE_2D,m.TEXTURE_MAG_FILTER,m.LINEAR),m.texParameteri(m.TEXTURE_2D,m.TEXTURE_WRAP_S,m.CLAMP_TO_EDGE),m.texParameteri(m.TEXTURE_2D,m.TEXTURE_WRAP_T,m.CLAMP_TO_EDGE),[t.w,t.h]=[n.naturalWidth,n.naturalHeight]}).catch(e=>console.warn(`[service-hover]`,e)),t}),v=0,y=0,b=1,x={x:0,y:0},S={x:0,y:0},C={from:0,to:0,at:0},w=-1/0,T=e=>{let t=Math.min(1,(e-C.at)/1e3/o);return C.from+(C.to-C.from)*(1-(1-t)**4)},E=e=>{let t=performance.now();Object.assign(C,{from:T(t),to:e,at:t})},D=e=>e-C.at<o*1e3,O=-1,k=0,A=0,j=0;function M(){let e=p.getBoundingClientRect();[v,y]=[e.width,e.height],b=Math.min(window.devicePixelRatio||1,2),p.width=Math.round(v*b),p.height=Math.round(y*b),m.viewport(0,0,p.width,p.height)}function N(e){A+=j?Math.min(.1,(e-j)/1e3):0,j=e,m.clear(m.COLOR_BUFFER_BIT);let t=_[O],n=T(e),r=Math.min(1,Math.max(0,(e-w)/1e3/s));if(t?.tex&&n>.001){let e=y*i,a=e*(t.w/t.h),o=(S.x-x.x)*-.25,s=-(S.y-x.y)*-.25,c=h.u;m.bindTexture(m.TEXTURE_2D,t.tex),m.uniform2f(c.uView,v,y),m.uniform2f(c.uPos,S.x,S.y),m.uniform2f(c.uSize,a,e),m.uniform2f(c.uOffset,o,s),m.uniform2f(c.uShift,o/e,s/e),m.uniform2f(c.uTextureSize,t.w,t.h),m.uniform2f(c.uElementSize,a,e),m.uniform1f(c.uProgress,r),m.uniform1f(c.uTime,A),m.uniform1f(c.uAlpha,n),m.drawArrays(m.TRIANGLES,0,g.length/2)}k=n>.001||D(e)?requestAnimationFrame(N):0}let P=()=>{k||=(j=0,requestAnimationFrame(N))};function F(t,n=!1){let r=p.getBoundingClientRect();x.x=t.clientX-r.left,x.y=t.clientY-r.top,n?e.set(S,{x:x.x,y:x.y}):e.to(S,{x:x.x,y:x.y,duration:a,ease:`power4.out`,overwrite:!0})}f.forEach(({el:e},t)=>{e.addEventListener(`pointerenter`,e=>{let n=T(performance.now())<.01;F(e,n),(t!==O||n)&&(O=t,w=performance.now()),E(1),P()})}),n.addEventListener(`pointermove`,e=>{O>=0&&C.to>0&&F(e)});let I=()=>{E(0),P()};f[0].el.parentElement.addEventListener(`pointerleave`,I),new MutationObserver(()=>{!n.classList.contains(`is-active`)&&C.to>0&&I()}).observe(n,{attributes:!0,attributeFilter:[`class`]}),M(),window.addEventListener(`resize`,M)}var p=document.querySelector(`[data-demo]`),m=document.querySelector(`[data-list]`);if(p&&m){let e=[...p.querySelectorAll(`[data-service-img]`)];f(p,e.map(e=>({el:e,src:e.dataset.serviceImg})));let t=e=>{let t=e.getBoundingClientRect();return[t.left+t.width*.45,t.top+t.height/2]},r=e=>e*e*(3-2*e),i=-1;n(9,n=>{let a=m.getBoundingClientRect(),o=[[a.left-a.width*.4,a.top+a.height/2],...e.map(t)];o.push(o[0]);let s=Math.min(Math.floor(n/2.4),o.length-2),c=r(Math.min(1,(n-s*2.4)/1.5)),[l,u]=o[s],[d,f]=o[s+1],h=l+(d-l)*c,g=u+(f-u)*c,_=e.findIndex(e=>{let t=e.getBoundingClientRect();return h>=t.left&&h<=t.right&&g>=t.top&&g<=t.bottom});if(_!==i){i>=0&&e[i].dispatchEvent(new PointerEvent(`pointerleave`,{clientX:h,clientY:g})),_>=0&&e[_].dispatchEvent(new PointerEvent(`pointerenter`,{clientX:h,clientY:g}));let t=h>=a.left&&h<=a.right&&g>=a.top&&g<=a.bottom;_<0&&!t&&m.dispatchEvent(new PointerEvent(`pointerleave`,{clientX:h,clientY:g})),i=_}p.dispatchEvent(new PointerEvent(`pointermove`,{clientX:h,clientY:g}))})}