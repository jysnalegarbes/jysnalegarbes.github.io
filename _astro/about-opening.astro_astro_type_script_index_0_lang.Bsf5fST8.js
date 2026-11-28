import{i as e}from"./liquid-morph.CYjK22Fx.js";import{n as t}from"./lab-demo.CDV4dKc2.js";var n=.16,r=.5,i=.8,a=.96,o={left:.205,right:.36},s={left:.68,right:.6},c=87/110,l=1090/613,u=1090,d=.75,f=.09,p=(e,t=0,n=1)=>Math.min(n,Math.max(t,e)),m=(e,t,n)=>e+(t-e)*n,h=(e,t,n)=>p((e-t)/(n-t)),g=e=>e<.5?4*e*e*e:1-(-2*e+2)**3/2;function _(e){let t=e.querySelector(`[data-about-stage]`),_=e.querySelector(`[data-about-media]`),v=e.querySelector(`[data-about-half="left"]`),y=e.querySelector(`[data-about-half="right"]`),b=[...e.querySelectorAll(`[data-about-dark]`)];if(!t||!_||!v||!y)return;let x=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,S=window.matchMedia(`(min-width: 1024px)`);e.classList.add(`is-scrub`);let C=0,w=0,T=0,E=0,D=0,O=[],k=i,A=0;function j(){v.style.transform=``,y.style.transform=``;let e=t.getBoundingClientRect();C=e.width,w=e.height,T=parseFloat(getComputedStyle(v).fontSize);let n=v.getBoundingClientRect(),a=y.getBoundingClientRect();E=n.right-e.left,D=a.left-e.left;let o=a.top+a.height/2-e.top,s=c*T,f;if(S.matches)f=C/1920*u;else{let e=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--gutter`))||24;f=C-2*e}O=[{w:0,h:0,cx:C/2,cy:o},{w:s*l,h:s,cx:C/2,cy:o},{w:f,h:f/l,cx:C/2,cy:w/2},{w:C,h:w,cx:C/2,cy:w/2}],k=i;for(let e=0;e<=200;e++){let t=m(r,i,e/200);if(M(t).w>=C*d){k=t;break}}A=Math.hypot(C/2,w/2)+2}function M(e){let t,a,o;e<=n?[t,a,o]=[O[0],O[1],h(e,0,n)]:e<=r?[t,a,o]=[O[1],O[2],h(e,n,r)]:[t,a,o]=[O[2],O[3],h(e,r,i)];let s=g(o);return{w:m(t.w,a.w,s),h:m(t.h,a.h,s),cx:m(t.cx,a.cx,s),cy:m(t.cy,a.cy,s)}}function N(e,t){let i=e<=n?o:{left:m(o.left,s.left,g(h(e,n,r))),right:m(o.right,s.right,g(h(e,n,r)))},a=t.cx-t.w/2-i.left*T-E,c=t.cx+t.w/2+i.right*T-D;if(e>=n)return{dl:a,dr:c};let l=g(h(e,0,n)),u=M(n),d=u.cx-u.w/2-o.left*T-E,f=u.cx+u.w/2+o.right*T-D;return{dl:d*l,dr:f*l}}function P(e){let t=M(e);_.style.width=`${t.w}px`,_.style.height=`${t.h}px`,_.style.transform=`translate3d(${t.cx-t.w/2}px, ${t.cy-t.h/2}px, 0)`,_.style.visibility=t.w<.5?`hidden`:`visible`;let{dl:n,dr:r}=N(e,t);v.style.transform=`translate3d(${n}px, 0, 0)`,y.style.transform=`translate3d(${r}px, 0, 0)`;let i=g(h(e,k,a)),o=i<=0?`circle(0px at 50% 50%)`:i>=1?`none`:`circle(${i*A}px at 50% 50%)`;b.forEach(e=>{e.style.clipPath=o,e.style.visibility=i<=0?`hidden`:`visible`})}function F(){let t=e.getBoundingClientRect(),i=t.height-w,a=i>0?p(-t.top/i):0;return x?[0,n,r,1].reduce((e,t)=>Math.abs(t-a)<Math.abs(e-a)?t:e,0):a}let I=-1,L=0,R=0,z=0;function B(e){let t=Math.min(.1,(e-z)/1e3);z=e,I+=(L-I)*(1-Math.exp(-t/f)),Math.abs(L-I)<5e-4&&(I=L),P(I),R=I===L?0:requestAnimationFrame(B)}function V(){L=F(),x||I<0?(I=L,P(I)):!R&&L!==I&&(z=performance.now(),R=requestAnimationFrame(B))}function H(){j(),L=F(),I=L,P(I)}j(),V(),document.fonts?.ready.then(H),window.addEventListener(`scroll`,V,{passive:!0}),window.addEventListener(`resize`,H),S.addEventListener(`change`,H)}var v=2.8,y=16.21,b=11.66,x=[20/255,25/255,24/255],S=`
  attribute vec2 aUv;
  varying vec2 vUv;
  void main() {
    vUv = aUv;
    gl_Position = vec4(aUv * 2.0 - 1.0, 0.0, 1.0);
  }
`,C=`
  precision highp float;
  uniform float progress;
  uniform float width;
  uniform float scaleX;
  uniform float scaleY;
  uniform vec3 color;
  varying vec2 vUv;

  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  vec4 fade(vec4 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

  float cnoise(vec4 P) {
    vec4 Pi0 = floor(P);
    vec4 Pi1 = Pi0 + 1.0;
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec4 Pf0 = fract(P);
    vec4 Pf1 = Pf0 - 1.0;
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = vec4(Pi0.zzzz);
    vec4 iz1 = vec4(Pi1.zzzz);
    vec4 iw0 = vec4(Pi0.wwww);
    vec4 iw1 = vec4(Pi1.wwww);

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);
    vec4 ixy00 = permute(ixy0 + iw0);
    vec4 ixy01 = permute(ixy0 + iw1);
    vec4 ixy10 = permute(ixy1 + iw0);
    vec4 ixy11 = permute(ixy1 + iw1);

    vec4 gx00 = ixy00 / 7.0;
    vec4 gy00 = floor(gx00) / 7.0;
    vec4 gz00 = floor(gy00) / 6.0;
    gx00 = fract(gx00) - 0.5;
    gy00 = fract(gy00) - 0.5;
    gz00 = fract(gz00) - 0.5;
    vec4 gw00 = vec4(0.75) - abs(gx00) - abs(gy00) - abs(gz00);
    vec4 sw00 = step(gw00, vec4(0.0));
    gx00 -= sw00 * (step(0.0, gx00) - 0.5);
    gy00 -= sw00 * (step(0.0, gy00) - 0.5);

    vec4 gx01 = ixy01 / 7.0;
    vec4 gy01 = floor(gx01) / 7.0;
    vec4 gz01 = floor(gy01) / 6.0;
    gx01 = fract(gx01) - 0.5;
    gy01 = fract(gy01) - 0.5;
    gz01 = fract(gz01) - 0.5;
    vec4 gw01 = vec4(0.75) - abs(gx01) - abs(gy01) - abs(gz01);
    vec4 sw01 = step(gw01, vec4(0.0));
    gx01 -= sw01 * (step(0.0, gx01) - 0.5);
    gy01 -= sw01 * (step(0.0, gy01) - 0.5);

    vec4 gx10 = ixy10 / 7.0;
    vec4 gy10 = floor(gx10) / 7.0;
    vec4 gz10 = floor(gy10) / 6.0;
    gx10 = fract(gx10) - 0.5;
    gy10 = fract(gy10) - 0.5;
    gz10 = fract(gz10) - 0.5;
    vec4 gw10 = vec4(0.75) - abs(gx10) - abs(gy10) - abs(gz10);
    vec4 sw10 = step(gw10, vec4(0.0));
    gx10 -= sw10 * (step(0.0, gx10) - 0.5);
    gy10 -= sw10 * (step(0.0, gy10) - 0.5);

    vec4 gx11 = ixy11 / 7.0;
    vec4 gy11 = floor(gx11) / 7.0;
    vec4 gz11 = floor(gy11) / 6.0;
    gx11 = fract(gx11) - 0.5;
    gy11 = fract(gy11) - 0.5;
    gz11 = fract(gz11) - 0.5;
    vec4 gw11 = vec4(0.75) - abs(gx11) - abs(gy11) - abs(gz11);
    vec4 sw11 = step(gw11, vec4(0.0));
    gx11 -= sw11 * (step(0.0, gx11) - 0.5);
    gy11 -= sw11 * (step(0.0, gy11) - 0.5);

    vec4 g0000 = vec4(gx00.x, gy00.x, gz00.x, gw00.x);
    vec4 g1000 = vec4(gx00.y, gy00.y, gz00.y, gw00.y);
    vec4 g0100 = vec4(gx00.z, gy00.z, gz00.z, gw00.z);
    vec4 g1100 = vec4(gx00.w, gy00.w, gz00.w, gw00.w);
    vec4 g0010 = vec4(gx10.x, gy10.x, gz10.x, gw10.x);
    vec4 g1010 = vec4(gx10.y, gy10.y, gz10.y, gw10.y);
    vec4 g0110 = vec4(gx10.z, gy10.z, gz10.z, gw10.z);
    vec4 g1110 = vec4(gx10.w, gy10.w, gz10.w, gw10.w);
    vec4 g0001 = vec4(gx01.x, gy01.x, gz01.x, gw01.x);
    vec4 g1001 = vec4(gx01.y, gy01.y, gz01.y, gw01.y);
    vec4 g0101 = vec4(gx01.z, gy01.z, gz01.z, gw01.z);
    vec4 g1101 = vec4(gx01.w, gy01.w, gz01.w, gw01.w);
    vec4 g0011 = vec4(gx11.x, gy11.x, gz11.x, gw11.x);
    vec4 g1011 = vec4(gx11.y, gy11.y, gz11.y, gw11.y);
    vec4 g0111 = vec4(gx11.z, gy11.z, gz11.z, gw11.z);
    vec4 g1111 = vec4(gx11.w, gy11.w, gz11.w, gw11.w);

    vec4 norm00 = taylorInvSqrt(vec4(dot(g0000, g0000), dot(g0100, g0100), dot(g1000, g1000), dot(g1100, g1100)));
    g0000 *= norm00.x; g0100 *= norm00.y; g1000 *= norm00.z; g1100 *= norm00.w;
    vec4 norm01 = taylorInvSqrt(vec4(dot(g0001, g0001), dot(g0101, g0101), dot(g1001, g1001), dot(g1101, g1101)));
    g0001 *= norm01.x; g0101 *= norm01.y; g1001 *= norm01.z; g1101 *= norm01.w;
    vec4 norm10 = taylorInvSqrt(vec4(dot(g0010, g0010), dot(g0110, g0110), dot(g1010, g1010), dot(g1110, g1110)));
    g0010 *= norm10.x; g0110 *= norm10.y; g1010 *= norm10.z; g1110 *= norm10.w;
    vec4 norm11 = taylorInvSqrt(vec4(dot(g0011, g0011), dot(g0111, g0111), dot(g1011, g1011), dot(g1111, g1111)));
    g0011 *= norm11.x; g0111 *= norm11.y; g1011 *= norm11.z; g1111 *= norm11.w;

    float n0000 = dot(g0000, Pf0);
    float n1000 = dot(g1000, vec4(Pf1.x, Pf0.yzw));
    float n0100 = dot(g0100, vec4(Pf0.x, Pf1.y, Pf0.zw));
    float n1100 = dot(g1100, vec4(Pf1.xy, Pf0.zw));
    float n0010 = dot(g0010, vec4(Pf0.xy, Pf1.z, Pf0.w));
    float n1010 = dot(g1010, vec4(Pf1.x, Pf0.y, Pf1.z, Pf0.w));
    float n0110 = dot(g0110, vec4(Pf0.x, Pf1.yz, Pf0.w));
    float n1110 = dot(g1110, vec4(Pf1.xyz, Pf0.w));
    float n0001 = dot(g0001, vec4(Pf0.xyz, Pf1.w));
    float n1001 = dot(g1001, vec4(Pf1.x, Pf0.yz, Pf1.w));
    float n0101 = dot(g0101, vec4(Pf0.x, Pf1.y, Pf0.z, Pf1.w));
    float n1101 = dot(g1101, vec4(Pf1.xy, Pf0.z, Pf1.w));
    float n0011 = dot(g0011, vec4(Pf0.xy, Pf1.zw));
    float n1011 = dot(g1011, vec4(Pf1.x, Pf0.y, Pf1.zw));
    float n0111 = dot(g0111, vec4(Pf0.x, Pf1.yzw));
    float n1111 = dot(g1111, Pf1);

    vec4 fade_xyzw = fade(Pf0);
    vec4 n_0w = mix(vec4(n0000, n1000, n0100, n1100), vec4(n0001, n1001, n0101, n1101), fade_xyzw.w);
    vec4 n_1w = mix(vec4(n0010, n1010, n0110, n1110), vec4(n0011, n1011, n0111, n1111), fade_xyzw.w);
    vec4 n_zw = mix(n_0w, n_1w, fade_xyzw.z);
    vec2 n_yzw = mix(n_zw.xy, n_zw.zw, fade_xyzw.y);
    float n_xyzw = mix(n_yzw.x, n_yzw.y, fade_xyzw.x);
    return 2.2 * n_xyzw;
  }

  float parabola(float x, float k) { return pow(4.0 * x * (1.0 - x), k); }

  void main() {
    float dt = parabola(progress, 1.0);
    float realnoise = 0.5 * (cnoise(vec4(vUv.x * scaleX, vUv.y * scaleY, 0.0, 0.0)) + 1.0);
    float w = width * dt;
    // Demo: vUv.x (sideways). 1 - y: the bottom edge goes first
    float lead = 1.0 - vUv.y;
    float maskvalue = smoothstep(1.0 - w, 1.0, lead + mix(-w / 2.0, 1.0 - w / 2.0, progress));
    float mask = maskvalue + maskvalue * realnoise;
    float cover = smoothstep(1.0, 1.01, mask);
    gl_FragColor = vec4(color * cover, cover);
  }
`;function w(t){let n=t.getContext(`webgl`,{alpha:!0,premultipliedAlpha:!0,antialias:!1});if(!n)return null;let r;try{r=e(n,S,C,[`progress`,`width`,`scaleX`,`scaleY`,`color`])}catch{return null}let{program:i,u:a,aUv:o}=r,s=n.createBuffer();return n.bindBuffer(n.ARRAY_BUFFER,s),n.bufferData(n.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),n.STATIC_DRAW),n.useProgram(i),n.enableVertexAttribArray(o),n.vertexAttribPointer(o,2,n.FLOAT,!1,0,0),n.uniform1f(a.width,v),n.uniform1f(a.scaleX,y),n.uniform1f(a.scaleY,b),n.uniform3fv(a.color,x),n.clearColor(0,0,0,0),{resize(e,r){let i=Math.min(window.devicePixelRatio||1,1.5);t.width=Math.round(e*i),t.height=Math.round(r*i),n.viewport(0,0,t.width,t.height)},draw(e){n.clear(n.COLOR_BUFFER_BIT),n.uniform1f(a.progress,e),n.drawArrays(n.TRIANGLE_STRIP,0,4)}}}var T=.15,E=.42,D=.66,O=.7,k=.97,A={left:.205,right:.36},j={left:.68,right:.6},M=87/110,N=1090/613,P=1090,F=.09,I=(e,t=0,n=1)=>Math.min(n,Math.max(t,e)),L=(e,t,n)=>e+(t-e)*n,R=(e,t,n)=>I((e-t)/(n-t)),z=e=>e<.5?4*e*e*e:1-(-2*e+2)**3/2;function B(e){let t=e.querySelector(`[data-about-stage]`),n=e.querySelector(`[data-about-media]`),r=e.querySelector(`[data-about-half="left"]`),i=e.querySelector(`[data-about-half="right"]`),a=e.querySelector(`[data-about-wipe]`),o=e.querySelector(`[data-about-black]`);if(!t||!n||!r||!i||!o)return;let s=a?w(a):null,c=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,l=window.matchMedia(`(min-width: 1024px)`);e.classList.add(`is-scrub`);let u=0,d=0,f=0,p=0,m=0,h=[];function g(){r.style.transform=``,i.style.transform=``;let e=t.getBoundingClientRect();u=e.width,d=e.height,f=parseFloat(getComputedStyle(r).fontSize);let n=r.getBoundingClientRect(),a=i.getBoundingClientRect();p=n.right-e.left,m=a.left-e.left;let o=a.top+a.height/2-e.top,c=M*f,g;if(l.matches)g=u/1920*P;else{let e=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--gutter`))||24;g=u-2*e}h=[{w:0,h:0,cx:u/2,cy:o},{w:c*N,h:c,cx:u/2,cy:o},{w:g,h:g/N,cx:u/2,cy:d/2},{w:u,h:d,cx:u/2,cy:d/2}],s?.resize(u,d)}function _(e){let t,n,r;e<=T?[t,n,r]=[h[0],h[1],R(e,0,T)]:e<=E?[t,n,r]=[h[1],h[2],R(e,T,E)]:[t,n,r]=[h[2],h[3],R(e,E,D)];let i=z(r);return{w:L(t.w,n.w,i),h:L(t.h,n.h,i),cx:L(t.cx,n.cx,i),cy:L(t.cy,n.cy,i)}}function v(e,t){let n=e<=T?A:{left:L(A.left,j.left,z(R(e,T,E))),right:L(A.right,j.right,z(R(e,T,E)))},r=t.cx-t.w/2-n.left*f-p,i=t.cx+t.w/2+n.right*f-m;if(e>=T)return{dl:r,dr:i};let a=z(R(e,0,T)),o=_(T),s=o.cx-o.w/2-A.left*f-p,c=o.cx+o.w/2+A.right*f-m;return{dl:s*a,dr:c*a}}function y(e){let t=_(e);n.style.width=`${t.w}px`,n.style.height=`${t.h}px`,n.style.transform=`translate3d(${t.cx-t.w/2}px, ${t.cy-t.h/2}px, 0)`,n.style.visibility=t.w<.5?`hidden`:`visible`;let{dl:c,dr:l}=v(e,t);r.style.transform=`translate3d(${c}px, 0, 0)`,i.style.transform=`translate3d(${l}px, 0, 0)`;let u=R(e,O,k),d=u>0&&u<1;a&&(a.style.visibility=s&&d?`visible`:`hidden`),s&&d&&s.draw(u),u>=1?(o.style.visibility=`visible`,o.style.clipPath=`none`):!s&&u>0?(o.style.visibility=`visible`,o.style.clipPath=`inset(${(1-z(u))*100}% 0 0 0)`):o.style.visibility=`hidden`,document.body.classList.toggle(`is-header-dark`,u>=.92)}function b(){let t=e.getBoundingClientRect(),n=t.height-d,r=n>0?I(-t.top/n):0;return c?[0,T,E,D,1].reduce((e,t)=>Math.abs(t-r)<Math.abs(e-r)?t:e,0):r}let x=-1,S=0,C=0,B=0;function V(e){let t=Math.min(.1,(e-B)/1e3);B=e,x+=(S-x)*(1-Math.exp(-t/F)),Math.abs(S-x)<5e-4&&(x=S),y(x),C=x===S?0:requestAnimationFrame(V)}function H(){S=b(),c||x<0?(x=S,y(x)):!C&&S!==x&&(B=performance.now(),C=requestAnimationFrame(V))}function U(){g(),S=b(),x=S,y(x)}g(),H(),document.fonts?.ready.then(U),window.addEventListener(`scroll`,H,{passive:!0}),window.addEventListener(`resize`,U),l.addEventListener(`change`,U)}var V=Number(new URLSearchParams(location.search).get(`pfx`))===1,H=document.querySelector(`[data-about-intro]`);H&&(H.classList.toggle(`is-circle`,V),(V?_:B)(H),t(()=>{let e=H.offsetHeight-innerHeight;return[e*(V?.5:.42),e]}));