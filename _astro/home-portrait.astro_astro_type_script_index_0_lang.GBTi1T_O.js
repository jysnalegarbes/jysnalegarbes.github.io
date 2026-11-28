import{t as e}from"./lab-demo.CDV4dKc2.js";var t={dentDepth:1,dentRadius:.08,rgbSplit:.12,lensSize:.3,lensEdge:.5,blur:18,feather:48,corner:0},n=64,r=32,i=`
  precision highp float;
  attribute vec2 aPosition; // figure uv, top-left origin
  uniform vec2 uMouse;
  uniform float uRadius;
  uniform float uAmp;
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
    vWave = z;

    // Perspective from a camera centred on the viewport, 50 units away
    vec2 p = uFig.xy + aPosition * uFig.zw;
    vec2 centre = uViewport * 0.5;
    p = centre + (p - centre) * (50.0 / (50.0 - z));

    vec2 ndc = (p - uCanvas.xy) / uCanvas.zw * 2.0 - 1.0;
    gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  }
`,a=`
  precision mediump float;
  uniform sampler2D uTex;
  uniform vec4 uSrc; // where the image sits in figure uv (x, y, w, h)
  uniform float uSplit;
  varying vec2 vUv;
  varying float vWave;

  void main () {
    vec2 t = (vUv - uSrc.xy) / uSrc.zw;
    float w = vWave;
    vec3 base = texture2D(uTex, t).rgb;
    vec3 split = vec3(
      texture2D(uTex, t + w * 0.04).r,
      texture2D(uTex, t + w * 0.01).g,
      texture2D(uTex, t - w * 0.03).b
    );
    gl_FragColor = vec4(mix(base, split, uSplit), 1.0);
  }
`,o=`
  precision highp float;
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main () {
    vUv = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`,s=`
  precision highp float;
  uniform sampler2D uTex;
  uniform vec4 uSrc;
  uniform vec4 uFig;      // figure rect in viewport px
  uniform float uPad;
  uniform vec2 uMouse;    // damped, viewport px
  uniform float uVmin;
  uniform float uLensSize;
  uniform float uLensEdge;
  uniform float uBlur;
  uniform float uFeather;
  uniform float uCorner;
  varying vec2 vUv;

  vec3 sampleFigure (vec2 px) {
    vec2 uv = clamp(px / uFig.zw, 0.0, 1.0);
    return texture2D(uTex, (uv - uSrc.xy) / uSrc.zw).rgb;
  }

  float sdRoundBox (vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main () {
    vec2 px = vUv * (uFig.zw + 2.0 * uPad) - uPad; // figure-space px

    // Lens: soft circle around the cursor (sdCircle + fill from the demo)
    float x = length(uFig.xy + px - uMouse) / uVmin * 2.0;
    float lens = 1.0 - smoothstep(uLensSize - uLensEdge, uLensSize + uLensEdge, x);

    // Defocus: Vogel disk, radius driven by the lens
    float r = lens * uBlur;
    vec3 col = vec3(0.0);
    for (int i = 0; i < 32; i++) {
      float fi = float(i);
      float rr = sqrt((fi + 0.5) / 32.0) * r;
      float a = fi * 2.39996323;
      col += sampleFigure(px + vec2(cos(a), sin(a)) * rr);
    }
    col /= 32.0;

    // Frame: rounded rect whose edge softness is the lens (variation 1)
    float d = sdRoundBox(px - uFig.zw * 0.5, uFig.zw * 0.5, uCorner);
    float e = max(lens * uFeather, 0.75);
    float alpha = 1.0 - smoothstep(-e, e, d);

    gl_FragColor = vec4(col * alpha, alpha);
  }
`;function c(e,t,c){let l=e.querySelector(`.home__hero`),u=e.querySelector(`[data-portrait-frame]`);if(!l||!u)return null;let d=document.createElement(`canvas`);d.className=`portrait-fx`,d.setAttribute(`aria-hidden`,`true`),Object.assign(d.style,{position:`absolute`,top:`-${n}px`,left:`-${n}px`,width:`calc(100% + 128px)`,height:`calc(100% + 128px)`,pointerEvents:`none`});let f=d.getContext(`webgl`,{premultipliedAlpha:!0,antialias:!0,alpha:!0});if(!f)return null;let p=(e,t)=>{let n=f.createShader(e);if(f.shaderSource(n,t),f.compileShader(n),!f.getShaderParameter(n,f.COMPILE_STATUS))throw Error(f.getShaderInfoLog(n)??`compile failed`);return n},m=(e,t)=>{let n=f.createProgram();if(f.attachShader(n,p(f.VERTEX_SHADER,e)),f.attachShader(n,p(f.FRAGMENT_SHADER,t)),f.bindAttribLocation(n,0,`aPosition`),f.linkProgram(n),!f.getProgramParameter(n,f.LINK_STATUS))throw Error(f.getProgramInfoLog(n)??`link failed`);return{p:n,u:e=>f.getUniformLocation(n,e)}},h,g;try{h=m(i,a),g=m(o,s)}catch(e){return console.warn(`[portrait-fx]`,e),null}let _=[];for(let e=0;e<=r;e++)for(let t=0;t<=r;t++)_.push(t/r,e/r);let v=[];for(let e=0;e<r;e++)for(let t=0;t<r;t++){let n=e*33+t;v.push(n,n+1,n+r+1,n+1,n+r+2,n+r+1)}let y=f.createBuffer();f.bindBuffer(f.ARRAY_BUFFER,y),f.bufferData(f.ARRAY_BUFFER,new Float32Array(_),f.STATIC_DRAW);let b=f.createBuffer();f.bindBuffer(f.ELEMENT_ARRAY_BUFFER,b),f.bufferData(f.ELEMENT_ARRAY_BUFFER,new Uint16Array(v),f.STATIC_DRAW);let x=f.createBuffer();f.bindBuffer(f.ARRAY_BUFFER,x),f.bufferData(f.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),f.STATIC_DRAW),f.enableVertexAttribArray(0);let S=f.createTexture();f.bindTexture(f.TEXTURE_2D,S),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_MIN_FILTER,f.LINEAR),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_MAG_FILTER,f.LINEAR),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_WRAP_S,f.CLAMP_TO_EDGE),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_WRAP_T,f.CLAMP_TO_EDGE);let C=t,w=``,T={x:0,y:0,w:1,h:1},E={x:-1e5,y:-1e5,over:!1,down:!1},D={x:-1e5,y:-1e5},O={x:.5,y:.5},k=0,A=c.dentRadius,j=e=>{let t=u.hidden?l:u;if(!t.complete||!t.naturalWidth)return w!==``;let n=t.getBoundingClientRect(),r=`${t.currentSrc}|${Math.round(n.left-e.left)}|${Math.round(n.width)}`;return r!==w&&(f.bindTexture(f.TEXTURE_2D,S),f.texImage2D(f.TEXTURE_2D,0,f.RGBA,f.RGBA,f.UNSIGNED_BYTE,t),T.x=(n.left-e.left)/e.width,T.y=(n.top-e.top)/e.height,T.w=n.width/e.width,T.h=n.height/e.height,w=r),!0},M=e=>{let t=Math.min(window.devicePixelRatio||1,2),r=e.width+128,i=e.height+128,a=Math.round(r*t),o=Math.round(i*t);if((d.width!==a||d.height!==o)&&(d.width=a,d.height=o),f.viewport(0,0,a,o),f.clearColor(0,0,0,0),f.clear(f.COLOR_BUFFER_BIT),f.activeTexture(f.TEXTURE0),f.bindTexture(f.TEXTURE_2D,S),C===1){let{p:t,u:a}=h;f.useProgram(t),f.uniform1i(a(`uTex`),0),f.uniform4f(a(`uSrc`),T.x,T.y,T.w,T.h),f.uniform1f(a(`uSplit`),c.rgbSplit),f.uniform2f(a(`uMouse`),O.x,O.y),f.uniform1f(a(`uRadius`),A),f.uniform1f(a(`uAmp`),k*c.dentDepth),f.uniform4f(a(`uFig`),e.left,e.top,e.width,e.height),f.uniform4f(a(`uCanvas`),e.left-n,e.top-n,r,i),f.uniform2f(a(`uViewport`),window.innerWidth,window.innerHeight),f.bindBuffer(f.ARRAY_BUFFER,y),f.vertexAttribPointer(0,2,f.FLOAT,!1,0,0),f.bindBuffer(f.ELEMENT_ARRAY_BUFFER,b),f.drawElements(f.TRIANGLES,v.length,f.UNSIGNED_SHORT,0)}else{let{p:t,u:r}=g;f.useProgram(t),f.uniform1i(r(`uTex`),0),f.uniform4f(r(`uSrc`),T.x,T.y,T.w,T.h),f.uniform4f(r(`uFig`),e.left,e.top,e.width,e.height),f.uniform1f(r(`uPad`),n),f.uniform2f(r(`uMouse`),D.x,D.y),f.uniform1f(r(`uVmin`),Math.min(window.innerWidth,window.innerHeight)),f.uniform1f(r(`uLensSize`),c.lensSize),f.uniform1f(r(`uLensEdge`),c.lensEdge),f.uniform1f(r(`uBlur`),c.blur),f.uniform1f(r(`uFeather`),c.feather),f.uniform1f(r(`uCorner`),c.corner),f.bindBuffer(f.ARRAY_BUFFER,x),f.vertexAttribPointer(0,2,f.FLOAT,!1,0,0),f.drawArrays(f.TRIANGLE_STRIP,0,4)}},N=(e,t)=>{let n=!1;if(C===1){let r=1-.9**(e*60);if(E.over){let e=(E.x-t.left)/t.width,i=(E.y-t.top)/t.height;O.x+=(e-O.x)*r,O.y+=(i-O.y)*r,n||=Math.abs(e-O.x)+Math.abs(i-O.y)>1e-4}let i=+!!E.over;k+=(i-k)*(1-.92**(e*60));let a=E.over&&E.down?1:c.dentRadius,o=E.over&&E.down?.01:.08;A+=(a-A)*(1-(1-o)**(e*60)),n||=Math.abs(i-k)>.001||Math.abs(a-A)>.001}else{let t=1-Math.exp(-8*e);D.x+=(E.x-D.x)*t,D.y+=(E.y-D.y)*t,n||=Math.abs(E.x-D.x)+Math.abs(E.y-D.y)>.5}return n},P=0,F=0,I=!1,L=t=>{P=0;let n=Math.min((t-F)/1e3,1/30);if(F=t,C===0)return;let r=e.getBoundingClientRect();if(!j(r)){P=requestAnimationFrame(L);return}let i=N(n,r);M(r),I||(I=!0,e.classList.add(`has-fx`)),i&&(P=requestAnimationFrame(L))},R=()=>{P||C===0||(F=performance.now(),P=requestAnimationFrame(L))},z=e=>{E.x=e.clientX,E.y=e.clientY,D.x===-1e5&&(D.x=e.clientX,D.y=e.clientY),R()},B=()=>(E.over=!0,R()),V=()=>(E.over=!1,E.down=!1,R()),H=()=>(E.down=!0,R()),U=()=>(E.down=!1,R());window.addEventListener(`pointermove`,z,{passive:!0}),window.addEventListener(`pointerup`,U),window.addEventListener(`resize`,R),window.addEventListener(`scroll`,R,{passive:!0}),e.addEventListener(`pointerenter`,B),e.addEventListener(`pointerleave`,V),e.addEventListener(`pointerdown`,H),u.addEventListener(`load`,R),l.addEventListener(`load`,R);let W=new MutationObserver(R);return W.observe(u,{attributes:!0,attributeFilter:[`hidden`,`src`]}),e.append(d),R(),{setEffect(t){C=t,t===0?(e.classList.remove(`has-fx`),I=!1,d.hidden=!0):(d.hidden=!1,R())},refresh(){A=c.dentRadius,R()},destroy(){cancelAnimationFrame(P),W.disconnect(),window.removeEventListener(`pointermove`,z),window.removeEventListener(`pointerup`,U),window.removeEventListener(`resize`,R),window.removeEventListener(`scroll`,R),e.removeEventListener(`pointerenter`,B),e.removeEventListener(`pointerleave`,V),e.removeEventListener(`pointerdown`,H),u.removeEventListener(`load`,R),l.removeEventListener(`load`,R),e.classList.remove(`has-fx`),d.remove()}}}var l=Number(new URLSearchParams(location.search).get(`pfx`))===2?2:1,u=document.querySelector(`[data-portrait]`);if(u){c(u,l,{...t});let n=!1,r=!1,i=e=>e*e*(3-2*e);e(7,e=>{let t=u.getBoundingClientRect(),a=t.left+t.width*.5,o=t.top+t.height*.35,s,c;if(e<1){let n=i(e);s=t.left-t.width*1.2+(a-(t.left-t.width*1.2))*n,c=o+t.height*.3*(1-n)}else if(e<4.5){let n=(e-1)/3.5*Math.PI*4;s=a+Math.sin(n)*t.width*.28,c=o+(1-Math.cos(n))*t.height*.18}else if(e<5.7)s=a,c=o;else{let n=i((e-5.7)/1.3);s=a+(t.right+t.width*1.2-a)*n,c=o-t.height*.2*n}let l=s>=t.left&&s<=t.right&&c>=t.top&&c<=t.bottom;l&&!n&&u.dispatchEvent(new PointerEvent(`pointerenter`,{clientX:s,clientY:c})),!l&&n&&u.dispatchEvent(new PointerEvent(`pointerleave`,{clientX:s,clientY:c})),n=l,window.dispatchEvent(new PointerEvent(`pointermove`,{clientX:s,clientY:c}));let d=e>=4.6&&e<5.6;d&&!r&&n&&u.dispatchEvent(new PointerEvent(`pointerdown`,{clientX:s,clientY:c})),!d&&r&&window.dispatchEvent(new PointerEvent(`pointerup`,{clientX:s,clientY:c})),r=d&&n})}