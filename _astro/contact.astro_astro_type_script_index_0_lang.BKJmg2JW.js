const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["_astro/config-pane.xgM-6VZV.js","_astro/tweakpane.B9yL4GGH.js"])))=>i.map(i=>d[i]);
import{r as e}from"./rolldown-runtime.BCiCTKAo.js";import{t}from"./gsap.CvDoa17S.js";import{t as n}from"./preload-helper.DHhhL8Zf.js";import{t as r}from"./SplitText.D2RYeBm1.js";var i=e({default:()=>a,follow:()=>1,gloss:()=>1,size:()=>1,speed:()=>1}),a={size:1,speed:1,follow:1,gloss:1};t.registerPlugin(r);var o=`
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`,s=`
precision highp float;
uniform vec2 u_res, u_mouse;
uniform float u_time, u_grow, u_burst, u_size, u_gloss, u_follow;
uniform vec3 u_bg, u_ink, u_green;

// Field and its gradient from 6 drops (5 drifting + the cursor's)
void drop(vec2 p, vec2 c, float r, inout float f, inout vec2 g) {
  vec2 d = p - c;
  float q = dot(d, d) + 1e-4;
  f += r * r / q;
  g += -2.0 * r * r * d / (q * q);
}

void main() {
  float asp = u_res.x / u_res.y;
  vec2 p = gl_FragCoord.xy / u_res.y;
  vec2 centre = vec2(asp * 0.5, 0.5);
  vec2 m = u_mouse / u_res.y;
  float t = u_time * 0.35;
  float R = 0.085 * u_size * u_grow;
  float spread = 0.26 + u_burst * 0.5;

  float f = 0.0;
  vec2 g = vec2(0.0);
  for (int i = 0; i < 5; i++) {
    float k = float(i);
    vec2 orbit = vec2(cos(t * (0.7 + k * 0.13) + k * 1.9) * asp * 0.55, sin(t * (0.9 + k * 0.11) + k * 2.7)) * spread;
    drop(p, centre + orbit, R * (0.8 + 0.25 * sin(k * 3.1)), f, g);
  }
  drop(p, mix(centre, m, u_follow), R * 1.25, f, g);

  float inside = smoothstep(0.96, 1.04, f);
  // Light it like wet ink: normal from the field's slope
  vec3 n = normalize(vec3(-g * 0.02, 1.0));
  vec3 l = normalize(vec3(-0.5, 0.6, 0.8));
  float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0) * u_gloss;
  vec3 ink = u_ink + spec * 0.9;
  // A thin green rim (wide, it turns pink under the inverted text)
  ink = mix(ink, u_green, (1.0 - smoothstep(1.0, 1.1, f)) * 0.75 * u_gloss);
  gl_FragColor = vec4(mix(u_bg, ink, inside), 1.0);
}`,c=(e,t)=>{let n=getComputedStyle(document.documentElement).getPropertyValue(e).trim()||t,r=parseInt(n.replace(`#`,``),16);return[(r>>16&255)/255,(r>>8&255)/255,(r&255)/255]};function l(e){let n=structuredClone(a),i=n,l=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,u=document.createElement(`canvas`);u.className=`contact__gl`,u.setAttribute(`aria-hidden`,`true`),e.prepend(u);let d=u.getContext(`webgl`,{alpha:!1,antialias:!1});if(!d)return u.remove(),null;let f=(e,t)=>{let n=d.createShader(e);return d.shaderSource(n,t),d.compileShader(n),d.getShaderParameter(n,d.COMPILE_STATUS)||console.error(d.getShaderInfoLog(n)),n},p=d.createProgram();d.attachShader(p,f(d.VERTEX_SHADER,o)),d.attachShader(p,f(d.FRAGMENT_SHADER,s)),d.linkProgram(p),d.useProgram(p),d.bindBuffer(d.ARRAY_BUFFER,d.createBuffer()),d.bufferData(d.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),d.STATIC_DRAW);let m=d.getAttribLocation(p,`a_pos`);d.enableVertexAttribArray(m),d.vertexAttribPointer(m,2,d.FLOAT,!1,0,0);let h=e=>d.getUniformLocation(p,e);d.uniform3fv(h(`u_bg`),c(`--bg`,`#e1e8e8`)),d.uniform3fv(h(`u_ink`),c(`--black`,`#141918`)),d.uniform3fv(h(`u_green`),c(`--green`,`#0fb12a`)),e.classList.add(`has-drops`);let g=1,_=()=>{g=Math.min(2,window.devicePixelRatio||1),u.width=Math.max(1,Math.round(u.clientWidth*g)),u.height=Math.max(1,Math.round(u.clientHeight*g))};_(),window.addEventListener(`resize`,_);let v={x:innerWidth/2,y:innerHeight/2,tx:innerWidth/2,ty:innerHeight/2};window.addEventListener(`pointermove`,e=>{v.tx=e.clientX,v.ty=e.clientY},{passive:!0});let y={grow:+!!l,burst:0},b=0,x=performance.now(),S=e=>{let t=Math.min(.1,Math.max(0,(e-x)/1e3));x=e;let n=1-Math.exp(-t/.25);v.x+=(v.tx-v.x)*n,v.y+=(v.ty-v.y)*n,l||(b+=t*i.speed),d.viewport(0,0,u.width,u.height),d.uniform2f(h(`u_res`),u.width,u.height),d.uniform2f(h(`u_mouse`),v.x*g,u.height-v.y*g),d.uniform1f(h(`u_time`),b),d.uniform1f(h(`u_grow`),y.grow),d.uniform1f(h(`u_burst`),y.burst),d.uniform1f(h(`u_size`),i.size*(u.clientWidth<1024?.8:1)),d.uniform1f(h(`u_gloss`),i.gloss),d.uniform1f(h(`u_follow`),l?0:i.follow),d.drawArrays(d.TRIANGLE_STRIP,0,4),requestAnimationFrame(S)};if(requestAnimationFrame(S),e.addEventListener(`click`,e=>{e.target.closest(`a, button`)||l||(t.killTweensOf(y,`burst`),t.timeline().to(y,{burst:1,duration:.35,ease:`power3.out`}).to(y,{burst:0,duration:2.2,ease:`elastic.out(1, 0.4)`}))}),!l){let n=e.querySelectorAll(`[data-drops-pill]`),i=e.querySelectorAll(`[data-drops-fade]`);t.set([n,i],{opacity:0}),document.fonts.ready.then(()=>{let a=[...e.querySelectorAll(`[data-drops-split]`)].flatMap(e=>r.create(e,{type:`lines`,mask:`lines`}).lines);t.timeline({delay:.1}).to(y,{grow:1,duration:1.8,ease:`elastic.out(1, 0.55)`},0).from(a,{yPercent:110,duration:1.1,ease:`expo.out`,stagger:.1},.25).fromTo(n,{y:20,opacity:0},{y:0,opacity:1,duration:.8,ease:`back.out(1.7)`,stagger:.06},.7).to(i,{opacity:1,duration:.8},1)})}return{settings:n,refresh:_}}var u=document.querySelector(`[data-contact]`),d=u?l(u):null;d&&new URLSearchParams(location.search).has(`tweak`)&&Promise.all([n(()=>import(`./config-pane.xgM-6VZV.js`),__vite__mapDeps([0,1])),n(()=>Promise.resolve().then(()=>i),void 0)]).then(([{mountConfigPane:e},t])=>{let n=d.settings;e({title:`Contact · ink drops`,settings:n,saved:structuredClone(t.default),saveUrl:null,build(e){e.addBinding(n,`size`,{min:.4,max:2,step:.01}),e.addBinding(n,`speed`,{min:0,max:3,step:.01}),e.addBinding(n,`follow`,{label:`cursor follow`,min:0,max:1,step:.01}),e.addBinding(n,`gloss`,{min:0,max:2,step:.01})},onChange:()=>d.refresh()})});