// Presents the 240-pixel-wide game canvas through a CRT: curved corners, scanlines, aperture grille, bloom,
// colour fringing, vignette and noise. The shader is carried over from One-Armed Hero. Falls back to a plain
// pixelated canvas when WebGL is missing.

const VS = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv=aPos*.5+.5; gl_Position=vec4(aPos,0.,1.); }`;
const FS_BRIGHT = `precision mediump float; uniform sampler2D uTex; varying vec2 vUv;
void main(){ vec3 c=texture2D(uTex,vec2(vUv.x,1.-vUv.y)).rgb; float l=max(c.r,max(c.g,c.b)); gl_FragColor=vec4(c*smoothstep(.5,.95,l),1.); }`;
const FS_BLUR = `precision mediump float; uniform sampler2D uTex; uniform vec2 uDir; varying vec2 vUv;
void main(){ vec3 c=texture2D(uTex,vUv).rgb*.227;
  c+=(texture2D(uTex,vUv+uDir*1.385).rgb+texture2D(uTex,vUv-uDir*1.385).rgb)*.316;
  c+=(texture2D(uTex,vUv+uDir*3.231).rgb+texture2D(uTex,vUv-uDir*3.231).rgb)*.07; gl_FragColor=vec4(c,1.); }`;
const FS_CRT = `precision highp float;
uniform sampler2D uScene; uniform sampler2D uBloom; uniform vec2 uSrc; uniform vec2 uOut; uniform float uTime;
uniform float uCurve; uniform float uScan; uniform float uMask; uniform float uBloomAmt; uniform vec2 uShake; uniform vec3 uTint;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 c=vUv*2.-1.; float r2=dot(c,c);
  c*=1.+uCurve*c.x*c.x*c.y*c.y; vec2 uv=c*.5+.5;
  uv+=uShake/uSrc;
  vec2 edge=smoothstep(vec2(0.),vec2(.012,.012*uSrc.x/uSrc.y),uv)*smoothstep(vec2(0.),vec2(.012,.012*uSrc.x/uSrc.y),1.-uv);
  float inside=edge.x*edge.y;
  vec2 p=vec2(uv.x,1.-uv.y)*uSrc; vec2 f=fract(p); vec2 k=uOut/uSrc;
  vec2 t=floor(p)+clamp((f-.5)*k,-.5,.5)+.5; vec2 s=t/uSrc;
  vec2 ab=vec2(c.x,-c.y)*.6/uSrc;
  vec3 col=vec3(texture2D(uScene,s+ab).r, texture2D(uScene,s).g, texture2D(uScene,s-ab).b);
  col+=texture2D(uBloom,uv).rgb*uBloomAmt;
  float scan=.5+.5*cos(6.2831853*p.y);
  col*=1.-uScan*(1.-scan)*min(1.,k.y/3.);
  float m=mod(gl_FragCoord.x,3.);
  col*=1.-uMask+uMask*3.*vec3(step(m,1.),step(1.,m)*step(m,2.),step(2.,m))*.62+uMask*.38;
  col*=1.-.22*pow(r2*.5,1.8);
  col*=.97+.03*sin(uTime*7.)+.035*(hash(uv*uOut+uTime)-.5);
  col=mix(col,uTint,clamp(length(uTint),0.,.6)*.5);
  gl_FragColor=vec4(col*1.18*inside,1.);
}`;

function program(gl, fs) {
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}

/** out: the visible canvas. Returns { present(src, fx), resize(W,H), fallback } */
export function createPresenter(out) {
  const gl = out.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
  const P = { view: { x: 0, y: 0, w: 1, h: 1 }, fallback: !gl, crt: true };
  if (!gl) {
    const ctx2 = out.getContext('2d');
    P.present = src => { ctx2.imageSmoothingEnabled = false; ctx2.fillStyle = '#06050a'; ctx2.fillRect(0, 0, out.width, out.height); const v = P.view; ctx2.drawImage(src, v.x, v.y, v.w, v.h); };
    P.resize = fit;
    return P;
  }
  const progs = { bright: program(gl, FS_BRIGHT), blur: program(gl, FS_BLUR), crt: program(gl, FS_CRT) };
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const mkTex = (w, h, filter) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const mkFbo = (w, h) => { const tex = mkTex(w, h, gl.LINEAR), fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); return { fbo, tex, w, h }; };
  const scene = mkTex(0, 0, gl.NEAREST);
  let F = null, SW = 0, SH = 0;
  const draw = (pr, target, w, h) => {
    gl.useProgram(pr.p); gl.bindFramebuffer(gl.FRAMEBUFFER, target); gl.viewport(0, 0, w, h);
    const loc = gl.getAttribLocation(pr.p, 'aPos'); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  P.resize = (W, H) => { fit(W, H); if (W !== SW || H !== SH) { SW = W; SH = H; F = { b1: mkFbo(W >> 1, H >> 1), b2: mkFbo(W >> 1, H >> 1) }; } };
  P.present = (src, fx = {}) => {
    gl.bindTexture(gl.TEXTURE_2D, scene); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.activeTexture(gl.TEXTURE0);
    // bloom
    gl.bindTexture(gl.TEXTURE_2D, scene); gl.useProgram(progs.bright.p); gl.uniform1i(progs.bright.u.uTex, 0); draw(progs.bright, F.b1.fbo, F.b1.w, F.b1.h);
    for (let i = 0; i < 2; i++) {
      gl.useProgram(progs.blur.p); gl.uniform1i(progs.blur.u.uTex, 0);
      gl.bindTexture(gl.TEXTURE_2D, F.b1.tex); gl.uniform2f(progs.blur.u.uDir, 1 / F.b1.w, 0); draw(progs.blur, F.b2.fbo, F.b2.w, F.b2.h);
      gl.bindTexture(gl.TEXTURE_2D, F.b2.tex); gl.uniform2f(progs.blur.u.uDir, 0, 1 / F.b1.h); draw(progs.blur, F.b1.fbo, F.b1.w, F.b1.h);
    }
    // the tube
    const c = progs.crt, v = P.view, crt = P.crt;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, out.width, out.height); gl.clearColor(0.024, 0.02, 0.04, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(c.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene); gl.uniform1i(c.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, F.b1.tex); gl.uniform1i(c.u.uBloom, 1);
    gl.uniform2f(c.u.uSrc, SW, SH); gl.uniform2f(c.u.uOut, v.w, v.h); gl.uniform1f(c.u.uTime, performance.now() / 1000);
    gl.uniform1f(c.u.uCurve, crt ? 0.03 : 0); gl.uniform1f(c.u.uScan, crt ? 0.3 : 0); gl.uniform1f(c.u.uMask, crt ? 0.14 : 0); gl.uniform1f(c.u.uBloomAmt, 0.75);
    gl.uniform2f(c.u.uShake, fx.shake ? fx.shake[0] : 0, fx.shake ? fx.shake[1] : 0);
    gl.uniform3f(c.u.uTint, ...(fx.tint || [0, 0, 0]));
    const loc = gl.getAttribLocation(c.p, 'aPos'); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(v.x, out.height - v.y - v.h, v.w, v.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.activeTexture(gl.TEXTURE0);
  };
  function fit(W, H) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), cw = Math.max(1, Math.round(out.clientWidth * dpr)), ch = Math.max(1, Math.round(out.clientHeight * dpr));
    if (out.width !== cw || out.height !== ch) { out.width = cw; out.height = ch; }
    const scale = Math.min(cw / W, ch / H), vw = Math.round(W * scale), vh = Math.round(H * scale);
    P.view = { x: Math.floor((cw - vw) / 2), y: Math.floor((ch - vh) / 2), w: vw, h: vh, scale };
  }
  return P;
}
