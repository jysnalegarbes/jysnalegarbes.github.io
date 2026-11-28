import{r as e}from"./rolldown-runtime.BCiCTKAo.js";import{i as t,n,r}from"./ink-halftone.DDtCBRyx.js";var i=e({mountPortraitFx:()=>p}),a=64,o=32,s=.8,c=.8,l=`
  precision highp float;
  attribute vec2 aPosition; // figure uv, top-left origin
  uniform vec2 uMouse;
  uniform float uRadius;
  uniform float uAmp;
  uniform float uRipple;
  uniform float uTime;
  uniform vec4 uFig;     // figure rect in viewport px (x, y, w, h)
  uniform vec4 uCanvas;  // canvas rect in viewport px
  uniform vec2 uViewport;
  varying vec2 vUv;
  varying float vWave;

  void main () {
    vUv = aPosition;
    vec2 c = aPosition - uMouse;
    c.x *= uFig.z / uFig.w;
    float mask = smoothstep(uRadius, uRadius * 5.0, length(c));
    float z = (mask - 1.0) * 0.5 * uAmp * 15.0;

    // Intro wave travelling down the plane (the pen's uTranslating)
    z += sin((aPosition.y - 0.5) * 6.0 + uTime * 10.0) * uRipple * 3.5;
    vWave = z;

    // Perspective from a camera centred on the viewport, 50 units away
    vec2 p = uFig.xy + aPosition * uFig.zw;
    vec2 centre = uViewport * 0.5;
    p = centre + (p - centre) * (50.0 / (50.0 - z));

    vec2 ndc = (p - uCanvas.xy) / uCanvas.zw * 2.0 - 1.0;
    gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  }
`,u=`
  precision highp float;
  uniform sampler2D uTex;
  uniform vec4 uSrc; // where the image sits in figure uv (x, y, w, h)
  uniform float uSplit;
  uniform vec2 uFigSize; // CSS px
  uniform float uInk;
  varying vec2 vUv;
  varying float vWave;
  ${r}

  void main () {
    vec2 t = (vUv - uSrc.xy) / uSrc.zw;
    float w = vWave;
    vec3 base = texture2D(uTex, t).rgb;
    vec3 split = vec3(
      texture2D(uTex, t + w * 0.04).r,
      texture2D(uTex, t + w * 0.01).g,
      texture2D(uTex, t - w * 0.03).b
    );
    vec3 color = mix(base, split, uSplit);
    float ink = inkFront(uInk, vUv.y);
    vec2 g = inkGrid(vUv, uFigSize, uInk);
    vec3 c = texture2D(uTex, (inkCentre(g, uFigSize, uInk) - uSrc.xy) / uSrc.zw).rgb;
    gl_FragColor = vec4(mix(color, inkDots(g, uInk, c), smoothstep(0., 1., ink)), 1.0);
  }
`,d=e=>e>=1?1:1-2**(-10*e),f=e=>Math.sin(Math.min(e,1)*Math.PI/2);function p(e,r,{interactive:i=!0}={}){let p=e.querySelector(`.home__hero`),m=e.querySelector(`[data-portrait-frame]`);if(!p||!m)return null;let h=document.createElement(`canvas`);h.className=`portrait-fx`,h.setAttribute(`aria-hidden`,`true`),Object.assign(h.style,{position:`absolute`,top:`-${a}px`,left:`-${a}px`,width:`calc(100% + 128px)`,height:`calc(100% + 128px)`,pointerEvents:`none`});let g=h.getContext(`webgl`,{premultipliedAlpha:!0,antialias:!0,alpha:!0});if(!g)return null;let _=(e,t)=>{let n=g.createShader(e);if(g.shaderSource(n,t),g.compileShader(n),!g.getShaderParameter(n,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(n)??`compile failed`);return n},v=g.createProgram();try{if(g.attachShader(v,_(g.VERTEX_SHADER,l)),g.attachShader(v,_(g.FRAGMENT_SHADER,u)),g.bindAttribLocation(v,0,`aPosition`),g.linkProgram(v),!g.getProgramParameter(v,g.LINK_STATUS))throw Error(g.getProgramInfoLog(v)??`link failed`)}catch(e){return console.warn(`[portrait-fx]`,e),null}let y=e=>g.getUniformLocation(v,e),b=[];for(let e=0;e<=o;e++)for(let t=0;t<=o;t++)b.push(t/o,e/o);let x=[];for(let e=0;e<o;e++)for(let t=0;t<o;t++){let n=e*33+t;x.push(n,n+1,n+o+1,n+1,n+o+2,n+o+1)}g.bindBuffer(g.ARRAY_BUFFER,g.createBuffer()),g.bufferData(g.ARRAY_BUFFER,new Float32Array(b),g.STATIC_DRAW),g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,g.createBuffer()),g.bufferData(g.ELEMENT_ARRAY_BUFFER,new Uint16Array(x),g.STATIC_DRAW),g.vertexAttribPointer(0,2,g.FLOAT,!1,0,0),g.enableVertexAttribArray(0);let S=g.createTexture();g.bindTexture(g.TEXTURE_2D,S),g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR),g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR),g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE),g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE),g.useProgram(v),g.uniform1i(y(`uTex`),0),t(g,v);let C=``,w={x:0,y:0,w:1,h:1},T={x:0,y:0,over:!1,down:!1},E={x:.5,y:.5},D=0,O=r.dentRadius,k=0,A=-1,j=-1,M=e=>{let t=m.hidden?p:m;if(!t.complete||!t.naturalWidth)return C!==``;let n=t.getBoundingClientRect(),r=`${t.currentSrc}|${Math.round(n.left-e.left)}|${Math.round(n.width)}`;return r!==C&&(g.bindTexture(g.TEXTURE_2D,S),g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,t),w.x=(n.left-e.left)/e.width,w.y=(n.top-e.top)/e.height,w.w=n.width/e.width,w.h=n.height/e.height,C=r),!0},N=(e,t,n)=>{let i=t=>1-(1-t)**(e*60),a=!1;if(T.over){let e=(T.x-n.left)/n.width,t=(T.y-n.top)/n.height;E.x+=(e-E.x)*i(.1),E.y+=(t-E.y)*i(.1),a||=Math.abs(e-E.x)+Math.abs(t-E.y)>1e-4}let o=+!!T.over;D+=(o-D)*i(.08);let s=T.over&&T.down,c=s?1:r.dentRadius;return O+=(c-O)*i(s?.01:.08),a||=Math.abs(o-D)>.001||Math.abs(c-O)>.001,A>=0&&(A+=t,A>=1.6?A=-1:a=!0),j>=0&&(j+=t,j>=1.4500000000000002?j=-1:a=!0),a},P=()=>A<0?0:A<s?d(A/s):1-f((A-s)/c),F=e=>{let t=Math.min(window.devicePixelRatio||1,2),i=e.width+128,o=e.height+128,s=Math.round(i*t),c=Math.round(o*t);(h.width!==s||h.height!==c)&&(h.width=s,h.height=c),g.viewport(0,0,s,c),g.clearColor(0,0,0,0),g.clear(g.COLOR_BUFFER_BIT),g.uniform4f(y(`uSrc`),w.x,w.y,w.w,w.h),g.uniform1f(y(`uSplit`),r.rgbSplit),g.uniform2f(y(`uFigSize`),e.width,e.height),g.uniform1f(y(`uInk`),j<0?0:n(j)),g.uniform2f(y(`uMouse`),E.x,E.y),g.uniform1f(y(`uRadius`),O),g.uniform1f(y(`uAmp`),D*r.dentDepth),g.uniform1f(y(`uRipple`),P()),g.uniform1f(y(`uTime`),k),g.uniform4f(y(`uFig`),e.left,e.top,e.width,e.height),g.uniform4f(y(`uCanvas`),e.left-a,e.top-a,i,o),g.uniform2f(y(`uViewport`),window.innerWidth,window.innerHeight),g.drawElements(g.TRIANGLES,x.length,g.UNSIGNED_SHORT,0)},I=0,L=0,R=!1,z=t=>{I=0;let n=Math.min(Math.max(0,(t-L)/1e3),.25),r=Math.min(n,1/30);L=t,k+=n;let i=e.getBoundingClientRect();if(!M(i)){I=requestAnimationFrame(z);return}let a=N(r,n,i);F(i),R||(R=!0,e.classList.add(`has-fx`)),a&&(I=requestAnimationFrame(z))},B=()=>{I||=(L=performance.now(),requestAnimationFrame(z))},V=e=>{T.x=e.clientX,T.y=e.clientY,T.over&&B()},H=()=>(T.over=!0,B()),U=()=>(T.over=!1,T.down=!1,B()),W=()=>(T.down=!0,B()),G=()=>(T.down=!1,B());i&&(window.addEventListener(`pointermove`,V,{passive:!0}),window.addEventListener(`pointerup`,G),e.addEventListener(`pointerenter`,H),e.addEventListener(`pointerleave`,U),e.addEventListener(`pointerdown`,W)),window.addEventListener(`resize`,B),window.addEventListener(`scroll`,B,{passive:!0}),m.addEventListener(`load`,B),p.addEventListener(`load`,B);let K=new MutationObserver(B);return K.observe(m,{attributes:!0,attributeFilter:[`hidden`,`src`]}),e.append(h),B(),{ripple(){A=0,B()},ink(){j=0,B()},refresh(){O=r.dentRadius,B()},destroy(){cancelAnimationFrame(I),K.disconnect(),window.removeEventListener(`pointermove`,V),window.removeEventListener(`pointerup`,G),window.removeEventListener(`resize`,B),window.removeEventListener(`scroll`,B),e.removeEventListener(`pointerenter`,H),e.removeEventListener(`pointerleave`,U),e.removeEventListener(`pointerdown`,W),m.removeEventListener(`load`,B),p.removeEventListener(`load`,B),e.classList.remove(`has-fx`),h.remove()}}}export{i as n,p as t};