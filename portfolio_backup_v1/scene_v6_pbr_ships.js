/* =====================================================================
   3D SCENE v2: Cinematic Grand Line ocean + Straw Hat ship (Three.js r149)
   - Gerstner-wave ocean with sky reflections, subsurface glow, crest,
     hull & wake foam, seamless horizon
   - Procedural sky: atmospheric gradient, sun/moon, lit volumetric-style
     clouds, twinkling stars
   - ACES filmic tone mapping, PMREM sky environment lighting, soft shadows
   - Cinematic camera: intro fly-in, section-driven path, idle drift
   - Adaptive quality for smooth frame rates
   ===================================================================== */
(function () {
  'use strict';
  const canvas = document.getElementById('scene');
  const API = { ready: false, setNight() {}, setScroll() {}, intro() {}, onReady: null };
  window.SEA = API;
  API._debug = {};

  function fail() {
    document.body.classList.add('no-webgl');
    if (canvas) canvas.style.display = 'none';
    API.ready = true;
    if (API.onReady) API.onReady();
  }
  if (typeof THREE === 'undefined') { fail(); return; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  } catch (e) { fail(); return; }

  THREE.ColorManagement.legacyMode = false;          // proper linear workflow
  const isMobile = matchMedia('(max-width: 900px)').matches || /Mobi|Android/i.test(navigator.userAgent);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let DPR = Math.min(window.devicePixelRatio || 1, 2);                 // full native sharpness
  const MIN_DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75);   // never drop below this
  renderer.setPixelRatio(DPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // filmic response for the physically-shaded ships
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 4000);

  /* ======================= PALETTES ======================= */
  const C = (h) => new THREE.Color(h);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
  const PAL = {
    day: {   // bright Elbaph-arc daytime: saturated azure sky, ultramarine sea
      zenith: C('#1a5fd0'), horizon: C('#a8ddff'), glow: C('#effaff'), sun: C('#fffaf0'), sunI: 1.0,
      sunDir: V3(-0.55, 0.62, 0.56),
      deep: C('#0b3f99'), scatter: C('#2aa3ea'), foam: C('#ffffff'),
      cloudLit: C('#ffffff'), cloudDark: C('#b3c2ec'), cloudCover: 0.33,
      light: C('#fff0d6'), lightI: 1.55, hemiSky: C('#cfe0ff'), hemiGround: C('#6d5a48'), hemiI: 0.38,
      fillI: 0.22, envI: 0.5, stars: 0, lantern: 0.2, motes: C('#ffffff'), motesO: 0.12, exposure: 0.92
    },
    night: {  // moonlit anime night
      zenith: C('#020822'), horizon: C('#1b2f60'), glow: C('#2b4586'), sun: C('#e4ecff'), sunI: 1.0,
      sunDir: V3(0.42, 0.26, -1),
      deep: C('#021636'), scatter: C('#10427c'), foam: C('#b2c7e6'),
      cloudLit: C('#5b6a93'), cloudDark: C('#1d2748'), cloudCover: 0.35,
      light: C('#9fb6ff'), lightI: 0.9, hemiSky: C('#4d66ad'), hemiGround: C('#0a1020'), hemiI: 0.4,
      fillI: 0.12, envI: 0.35, stars: 1, lantern: 2.6, motes: C('#ffc45e'), motesO: 1.0, exposure: 1.0
    }
  };
  const COLOR_KEYS = ['zenith', 'horizon', 'glow', 'sun', 'deep', 'scatter', 'foam', 'cloudLit', 'cloudDark', 'light', 'hemiSky', 'hemiGround', 'motes'];
  const NUM_KEYS = ['sunI', 'cloudCover', 'lightI', 'hemiI', 'fillI', 'envI', 'stars', 'lantern', 'motesO', 'exposure'];

  /* Shared uniforms (same objects referenced by sky + ocean) */
  const SU = {
    uTime: { value: 0 },
    uZenith: { value: PAL.day.zenith.clone() }, uHorizon: { value: PAL.day.horizon.clone() }, uGlow: { value: PAL.day.glow.clone() },
    uSunCol: { value: PAL.day.sun.clone() }, uSunI: { value: PAL.day.sunI }, uSunDir: { value: PAL.day.sunDir.clone() },
    uNight: { value: 0 }, uCloudLit: { value: PAL.day.cloudLit.clone() }, uCloudDark: { value: PAL.day.cloudDark.clone() },
    uCloudCover: { value: PAL.day.cloudCover }
  };

  /* ======================= GLSL LIBRARY ======================= */
  const GLSL_NOISE = `
    float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
    vec3 noised(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); vec2 du = 6.0*f*(1.0-f);
      float a = hash12(i), b = hash12(i+vec2(1,0)), c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1));
      return vec3(a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y, du*(vec2(b-a,c-a)+(a-b-c+d)*u.yx)); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = m * p; a *= 0.5; } return v; }
  `;
  const GLSL_SKY = `
    uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uSunCol; uniform float uSunI;
    uniform vec3 uSunDir; uniform float uNight;
    vec3 skyBase(vec3 d, float gk){
      float y = max(d.y, 0.0);
      vec3 col = mix(uHorizon, uZenith, pow(y, 0.55));
      col = mix(col, uGlow, exp(-y * 16.0) * 0.5 * gk);                  // luminous band on the horizon
      float s = max(dot(d, uSunDir), 0.0);
      col += uSunCol * uSunI * (pow(s, 14.0) * 0.1 + pow(s, 220.0) * 0.35);
      return col;
    }
  `;

  /* ======================= LIGHTS ======================= */
  const hemi = new THREE.HemisphereLight(PAL.day.hemiSky, PAL.day.hemiGround, PAL.day.hemiI);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(PAL.day.light, PAL.day.lightI);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(isMobile ? 2048 : 4096, isMobile ? 2048 : 4096);
  const sc = sunLight.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 150;
  sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.03; sunLight.shadow.radius = 4;
  scene.add(sunLight); scene.add(sunLight.target);
  const fill = new THREE.DirectionalLight(C('#ffd9b0'), PAL.day.fillI);   // soft front fill (keeps the ship readable against the sun)
  fill.position.set(18, 10, 22); scene.add(fill);

  /* ======================= PHYSICALLY-BASED MATERIALS (realistic ships) ======================= */
  const PBR_MATS = [];
  function toon(o) {
    o = Object.assign({ roughness: 0.62, metalness: 0 }, o);
    const m = new THREE.MeshStandardMaterial(o); PBR_MATS.push(m); return m;
  }

  /* ======================= SKY ======================= */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, extensions: { derivatives: true },
    uniforms: SU,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uCloudLit; uniform vec3 uCloudDark; uniform float uCloudCover;
      varying vec3 vDir;
      ${GLSL_NOISE}
      ${GLSL_SKY}
      void main(){
        vec3 d = normalize(vDir);
        vec3 col = skyBase(d, 1.0);
        float s = max(dot(d, uSunDir), 0.0);
        float cov = 0.0;
        if (d.y > 0.0) {
          // anime cloud layer: crisp silhouettes + two-tone cel shading
          vec2 uv = d.xz / (d.y + 0.12) * 0.42 + vec2(uTime * 0.005, uTime * 0.0015);
          float n = fbm(uv);
          float n2 = fbm(uv + normalize(uSunDir.xz + 1e-4) * 0.06 + vec2(0.0, 0.02));
          float th = 1.0 - uCloudCover;
          float aa = fwidth(n) * 1.5 + 0.003;
          cov = smoothstep(th, th + aa, n) * smoothstep(0.03, 0.2, d.y);
          float sh = (n2 - n) * 4.0 + (n - th) * 1.6;
          float lit = smoothstep(0.02, 0.02 + aa * 4.0, sh);
          vec3 cc = mix(uCloudDark, uCloudLit, lit);
          cc = mix(cc, uHorizon, pow(1.0 - d.y, 7.0) * 0.45);
          col = mix(col, cc, cov * 0.96);
        }
        float disc = smoothstep(0.99925, 0.9995, s);
        col = mix(col, uSunCol * 1.15, disc * (1.0 - cov * 0.9));
        if (uNight > 0.01 && d.y > 0.0) {
          vec3 sd = d * 260.0; vec3 cell = floor(sd);
          float h = hash13(cell);
          float star = smoothstep(0.9955, 1.0, h) * smoothstep(0.45, 0.0, length(fract(sd) - 0.5));
          star *= 0.55 + 0.45 * sin(uTime * (1.5 + h * 4.0) + h * 60.0);
          col += vec3(0.85, 0.9, 1.0) * star * 2.2 * uNight * (1.0 - cov) * smoothstep(0.03, 0.25, d.y);
        }
        if (d.y < 0.0) col = skyBase(normalize(vec3(d.x, 0.0, d.z)), 1.0);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`
  });
  const skyGeo = new THREE.SphereGeometry(1000, 48, 24);
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  /* Environment map from the sky → realistic ambient light & reflections on the ship */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(skyGeo, skyMat));
  let envRT = null, envDirty = true, envLast = 0;
  function updateEnv() {
    const old = envRT;
    envRT = pmrem.fromScene(envScene, 0, 0.1, 2000);
    scene.environment = envRT.texture;
    if (old) old.dispose();
    envDirty = false;
  }

  /* ======================= OCEAN ======================= */
  // Gerstner waves: dir.x, dir.y, steepness, wavelength
  const WAVES = [
    [1.0, 0.25, 0.10, 46], [-0.35, 1.0, 0.09, 27], [0.75, -0.6, 0.085, 16.5],
    [0.2, 0.95, 0.075, 9.5], [-0.8, 0.45, 0.06, 5.8], [0.55, 0.8, 0.05, 3.4]
  ].map(w => { const l = Math.hypot(w[0], w[1]); return [w[0] / l, w[1] / l, w[2], w[3]]; });
  const WAVE_TIME = 0.55, FLOW = 1.6;   // FLOW = apparent forward speed of the ship

  function waveHeight(x, z, t) {
    let h = 0; const px = x + FLOW * t;
    for (const w of WAVES) {
      const k = 6.28318 / w[3], c = Math.sqrt(9.8 / k), a = w[2] / k;
      h += a * Math.sin(k * (w[0] * px + w[1] * z - c * t * WAVE_TIME));
    }
    return h;
  }

  const oceanUniforms = Object.assign({}, SU, {
    uWaves: { value: WAVES.map(w => new THREE.Vector4(w[0], w[1], w[2], w[3])) },
    uFlow: { value: FLOW }, uWaveTime: { value: WAVE_TIME },
    uDeep: { value: PAL.day.deep.clone() }, uScatter: { value: PAL.day.scatter.clone() }, uFoam: { value: PAL.day.foam.clone() },
    uShipA: { value: new THREE.Vector4(0, 0, 8.3, 2.8) }, uShipB: { value: new THREE.Vector4(-25, -12, 5.4, 1.7) }, uSpecK: { value: 1.0 },
    uRip: { value: Array.from({ length: 10 }, () => new THREE.Vector4(0, 0, -100, 0)) }
  });
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: oceanUniforms, extensions: { derivatives: true },
    vertexShader: `
      uniform float uTime; uniform float uFlow; uniform float uWaveTime; uniform vec4 uWaves[6];
      varying vec3 vWorld; varying vec3 vNormal; varying float vHeight; varying float vCrest;
      void main(){
        vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
        vec2 p = wp.xz + vec2(uFlow * uTime, 0.0);
        vec3 disp = vec3(0.0); vec3 T = vec3(1.0, 0.0, 0.0); vec3 B = vec3(0.0, 0.0, 1.0); float crest = 0.0; float qsum = 0.0;
        for (int i = 0; i < 6; i++) {
          vec4 w = uWaves[i];
          float k = 6.28318 / w.w; float c = sqrt(9.8 / k); float a = w.z / k;
          float f = k * (dot(w.xy, p) - c * uTime * uWaveTime);
          float s = sin(f), co = cos(f);
          disp += vec3(w.x * a * co, a * s, w.y * a * co);
          T += vec3(-w.x * w.x * w.z * s, w.x * w.z * co, -w.x * w.y * w.z * s);
          B += vec3(-w.x * w.y * w.z * s, w.y * w.z * co, -w.y * w.y * w.z * s);
          crest += w.z * s; qsum += w.z;
        }
        float att = 1.0 - smoothstep(260.0, 900.0, length(wp.xz - cameraPosition.xz));
        wp += disp * att;
        vec3 n = normalize(cross(B, T));
        vNormal = normalize(mix(vec3(0.0, 1.0, 0.0), n, att));
        vHeight = disp.y * att; vCrest = crest / qsum * att; vWorld = wp;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime; uniform float uFlow; uniform vec3 uDeep; uniform vec3 uScatter; uniform vec3 uFoam;
      uniform vec4 uShipA; uniform vec4 uShipB; uniform float uSpecK; uniform vec4 uRip[10];
      varying vec3 vWorld; varying vec3 vNormal; varying float vHeight; varying float vCrest;
      ${GLSL_NOISE}
      ${GLSL_SKY}
      vec2 detail(vec2 p, float t){
        vec2 g = vec2(0.0); float amp = 1.0, fr = 1.0;
        mat2 m = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 3; i++) {
          vec3 a = noised(p * fr + vec2(t * 0.35, t * 0.12));
          vec3 b = noised(m * p * fr * 1.3 - vec2(t * 0.18, -t * 0.3));
          g += (a.yz + b.yz) * amp * fr;
          amp *= 0.48; fr *= 2.05; p = m * p;
        }
        return g;
      }
      float shipFoamAt(vec4 S){
        vec2 q = (vWorld.xz - S.xy) / (S.z / 5.2);
        float e = length(vec2(q.x / 5.7, q.y / 2.0));
        float hull = smoothstep(1.55, 1.0, e) * smoothstep(0.8, 1.0, e);
        float bx = -(q.x + 4.6);
        float wake = 0.0;
        if (bx > 0.0) {
          float w = 1.6 + bx * 0.3;
          wake = smoothstep(1.4 + bx * 0.05, 0.0, abs(abs(q.y) - w)) * exp(-bx * 0.028);
          wake += smoothstep(w * 0.55, 0.0, abs(q.y)) * exp(-bx * 0.07) * 0.8;
        }
        float bow = smoothstep(1.2, 0.0, length(vec2((q.x - 5.6) * 0.8, q.y))) * 0.9;
        return max(max(hull, wake), bow);
      }
      void main(){
        vec3 toCam = cameraPosition - vWorld;
        float dist = length(toCam);
        vec3 V = toCam / dist;
        vec2 p = vWorld.xz + vec2(uFlow * uTime, 0.0);
        float fade = exp(-dist * 0.03);
        vec2 g = detail(p * 0.42, uTime);

        // cursor ripples
        vec2 rip = vec2(0.0); float ripF = 0.0;
        for (int i = 0; i < 10; i++) {
          vec4 r = uRip[i];
          float age = uTime - r.z;
          if (age < 0.0 || age > 3.2 || r.w <= 0.0) continue;
          vec2 c = r.xy - vec2(uFlow * age, 0.0);
          vec2 dv = vWorld.xz - c; float dd = length(dv) + 1e-3;
          float rad = 0.25 + age * (1.5 + 0.9 * r.w);
          float x = dd - rad;
          float env = exp(-age * 1.25) * r.w * smoothstep(0.0, 0.15, age);
          rip += (dv / dd) * cos(x * 6.0) * exp(-x * x * 1.1) * env;
          ripF += (exp(-x * x * 9.0) + exp(-(x + 0.9) * (x + 0.9) * 12.0) * 0.6) * env;
        }
        vec3 N = normalize(vNormal + vec3(-g.x, 0.0, -g.y) * 0.05 * (0.15 + 0.85 * fade) + vec3(rip.x, 0.0, rip.y) * 0.3);
        vec3 L = normalize(uSunDir);
        float h = clamp(vHeight * 0.9 + 0.4, 0.0, 1.0);

        // ---- anime water body: flat colour bands, no gradients soup ----
        float far = smoothstep(12.0, 460.0, dist);
        vec3 mid = mix(uDeep, uScatter, 0.5);
        vec3 col = mix(uDeep, mid, far * 0.9);
        // light / shadow side of each swell (hard cel terminator)
        vec2 Lh = normalize(L.xz + 1e-4);
        float sl = dot(N.xz, Lh) + (h - 0.5) * 0.12;
        float aaS = fwidth(sl) + 0.004;
        float litSide = smoothstep(-0.03, -0.03 + aaS, sl);
        col *= mix(0.8, 1.0, litSide);
        // lighter swell patches
        float pn = vnoise(p * 0.07 + vec2(uTime * 0.02, 0.0)) * 0.5 + h * 0.7 + (g.x + g.y) * 0.015 * fade;
        float aa1 = fwidth(pn) + 0.003;
        col = mix(col, uScatter, smoothstep(0.8, 0.8 + aa1, pn) * 0.6 * (1.0 - far * 0.7));

        // stylised ripple line network (classic anime sea)
        vec2 lp = p * 0.16;
        float nv = vnoise(lp + vec2(uTime * 0.05, uTime * 0.03)) * 0.65 + vnoise(lp * 2.3 - vec2(uTime * 0.07, 0.0)) * 0.35;
        float lw = fwidth(nv);
        float lines = 1.0 - smoothstep(0.012, 0.012 + lw * 1.6, abs(nv - 0.5));
        lines *= smoothstep(0.3, 0.55, vnoise(p * 0.045 + 3.1)) * smoothstep(170.0, 18.0, dist);
        col = mix(col, mix(uScatter, uFoam, 0.4), lines * 0.7);

        // sky reflection toward grazing angles
        float NdV = max(dot(N, V), 0.0);
        float F = pow(1.0 - NdV, 4.0);
        vec3 horizon = skyBase(normalize(vec3(-V.x, 0.0, -V.z)), 1.0);
        col = mix(col, horizon, clamp(F, 0.0, 1.0) * 0.5);

        // sun / moon glints: crisp shapes, not blur
        vec3 H = normalize(L + V);
        float NdH = max(dot(N, H), 0.0);
        float spec = pow(NdH, 700.0) * 5.0 + pow(NdH, 90.0) * 0.4;
        float up = smoothstep(-0.05, 0.1, L.y);
        col = mix(col, uSunCol * 1.1, smoothstep(0.45, 0.5, spec) * uSpecK * up);
        col += uSunCol * pow(NdH, 30.0) * 0.1 * uSpecK * up;

        // twinkling 4-point sparkles on the swell tops
        vec2 sc = p * 0.8; vec2 ci = floor(sc); vec2 cf = fract(sc) - 0.5;
        float hr = hash12(ci);
        vec2 off = vec2(hash12(ci + 7.1), hash12(ci + 3.7)) - 0.5;
        vec2 dd = cf - off * 0.5;
        float tw = max(0.0, sin(uTime * (2.0 + hr * 3.0) + hr * 40.0)); tw = tw * tw * tw;
        float star = max(0.0, 1.0 - (abs(dd.x * dd.y) * 700.0 + length(dd) * 5.0));
        col += vec3(1.0) * step(0.9, hr) * tw * star * smoothstep(0.35, 0.8, h) * smoothstep(80.0, 8.0, dist) * 1.3;

        // foam: crisp white shapes with a pale-blue rim
        float fn = vnoise(p * 1.4) * 0.6 + vnoise(p * 3.7 + uTime * 0.2) * 0.4;
        float cv = vCrest + (fn - 0.5) * 0.45;
        float crest = smoothstep(0.7, 0.7 + fwidth(cv) + 0.008, cv) * (0.15 + 0.85 * fade);
        float sf = max(shipFoamAt(uShipA), shipFoamAt(uShipB));
        float sv = sf * (fn + 0.35);
        float aw = fwidth(sv) + 0.008;
        float shipF = smoothstep(0.45, 0.45 + aw, sv);
        float shipRim = smoothstep(0.3, 0.3 + aw, sv) - shipF;
        vec3 foamCol = mix(mix(uFoam, uScatter, 0.3), uFoam, litSide);
        col = mix(col, mix(uScatter, uFoam, 0.55), shipRim * 0.7);
        col = mix(col, foamCol, max(crest * 0.85, shipF));
        float ring = smoothstep(0.35, 0.35 + fwidth(ripF) + 0.01, ripF);
        col = mix(col, uFoam, ring * 0.75 * (0.35 + 0.65 * fade));

        // seamless horizon
        float fogF = pow(smoothstep(80.0, 1150.0, dist), 0.8);
        col = mix(col, horizon, fogF);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`
  });

  // Polar grid → dense detail near the ship, sparse toward the horizon
  function oceanGeometry(rings, segs, rMax, power) {
    const pos = [0, 0, 0], idx = [];
    for (let i = 1; i <= rings; i++) {
      const r = rMax * Math.pow(i / rings, power);
      for (let j = 0; j < segs; j++) { const a = (j / segs) * Math.PI * 2; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
    }
    for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
    for (let i = 1; i < rings; i++) {
      const a0 = 1 + (i - 1) * segs, b0 = 1 + i * segs;
      for (let j = 0; j < segs; j++) {
        const j1 = (j + 1) % segs;
        idx.push(a0 + j, a0 + j1, b0 + j, a0 + j1, b0 + j1, b0 + j);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }
  const ocean = new THREE.Mesh(oceanGeometry(isMobile ? 150 : 220, isMobile ? 220 : 320, 1600, 2.6), oceanMat);
  ocean.frustumCulled = false;
  scene.add(ocean);

  /* ======================= TEXTURES ======================= */
  // inv = true → black skull painted on a white sail (as on the Merry / Sunny main sails)
  function drawJollyRoger(ctx, cx, cy, s, inv) {
    const bone = inv ? '#171717' : '#f7f2e6', line = '#141414', hole = inv ? '#fbf7ec' : '#141414';
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    ctx.lineWidth = 6; ctx.strokeStyle = line; ctx.lineCap = 'round';
    const rr = (x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      ctx.save(); ctx.rotate(a); ctx.fillStyle = bone;
      rr(-110, -11, 220, 22, 11); ctx.fill(); ctx.stroke();
      for (const x of [-110, 110]) for (const y of [-12, 12]) { ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    }
    ctx.fillStyle = bone;
    ctx.beginPath(); ctx.ellipse(0, -10, 62, 58, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    rr(-34, 30, 68, 38, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hole;
    ctx.beginPath(); ctx.ellipse(-24, 2, 15, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(24, 2, 15, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(-7, 34); ctx.lineTo(7, 34); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hole; ctx.lineWidth = 4; for (const x of [-16, 0, 16]) { ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, 66); ctx.stroke(); }
    ctx.strokeStyle = line; ctx.lineWidth = 6; ctx.fillStyle = '#f2c14e';
    ctx.beginPath(); ctx.ellipse(0, -46, 100, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-58, -46); ctx.quadraticCurveTo(-60, -118, 0, -120); ctx.quadraticCurveTo(60, -118, 58, -46); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d62828';
    ctx.beginPath(); ctx.moveTo(-59, -66); ctx.quadraticCurveTo(0, -54, 59, -66); ctx.lineTo(58, -48); ctx.quadraticCurveTo(0, -36, -58, -48); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function canvasTex(c, repeat) {
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = maxAniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  // kind: 'jolly' | 'plain' | 'stripes'
  function sailTexture(kind) {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 2048; const x0 = c.getContext('2d'); x0.scale(2, 2);
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 1024); g.addColorStop(0, '#fdfaf1'); g.addColorStop(1, '#ecdfc4');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
    if (kind === 'viking') {
      for (let i = 0; i < 8; i += 2) { x.fillStyle = '#b8322a'; x.fillRect(0, i * 128 + 64, 1024, 128); }
    }
    if (kind === 'stripes') {
      for (let i = 0; i < 8; i += 2) { x.fillStyle = '#c8322b'; x.fillRect(i * 128 + 64, 0, 128, 1024); }
    }
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(120,95,60,${Math.random() * 0.05})`; x.fillRect(Math.random() * 1024, Math.random() * 1024, 2 + Math.random() * 30, 1); }
    x.strokeStyle = 'rgba(120,90,50,.2)'; x.lineWidth = 4;
    for (let i = 1; i < 7; i++) { x.beginPath(); x.moveTo(0, i * 1024 / 7); x.lineTo(1024, i * 1024 / 7); x.stroke(); }
    x.strokeStyle = 'rgba(52,32,18,.9)'; x.lineWidth = 16; x.strokeRect(8, 8, 1008, 1008);
    if (kind === 'jolly') drawJollyRoger(x, 512, 590, 2.9, true);
    return canvasTex(c);
  }
  function flagTexture() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 340;
    const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, 512, 340);
    drawJollyRoger(x, 256, 190, 1.05, false);
    return canvasTex(c);
  }
  // procedural hardwood planks: per-plank tone, flowing grain, knots, seams and treenails (colour + matching bump map)
  function woodTexture(base, dark, planks, opts) {
    opts = opts || {};
    const S = 1024, c = document.createElement('canvas'), b = document.createElement('canvas'); c.width = c.height = b.width = b.height = S;
    const x = c.getContext('2d'), y = b.getContext('2d');
    const bc = new THREE.Color(base), step = S / planks;
    y.fillStyle = '#b4b4b4'; y.fillRect(0, 0, S, S);
    for (let i = 0; i < planks; i++) {
      const top = i * step, hsl = {}; bc.getHSL(hsl);
      const pc = new THREE.Color().setHSL(hsl.h + (Math.random() - 0.5) * 0.02, hsl.s * (0.85 + Math.random() * 0.3), hsl.l * (0.82 + Math.random() * 0.36));
      x.fillStyle = '#' + pc.getHexString(); x.fillRect(0, top, S, step);
      // grain: long wavy strokes
      const ph = Math.random() * 10, amp = 1 + Math.random() * 3;
      for (let k = 0; k < 34; k++) {
        const gy = top + Math.random() * step, dk = Math.random();
        x.strokeStyle = dk > 0.5 ? `rgba(30,14,4,${0.06 + Math.random() * 0.14})` : `rgba(255,225,180,${0.03 + Math.random() * 0.06})`;
        x.lineWidth = 0.6 + Math.random() * 1.6;
        y.strokeStyle = dk > 0.5 ? 'rgba(90,90,90,.35)' : 'rgba(215,215,215,.25)'; y.lineWidth = x.lineWidth;
        for (const ctx of [x, y]) {
          ctx.beginPath();
          for (let px = 0; px <= S; px += 16) { const py = gy + Math.sin(px * 0.006 + ph + k * 0.3) * amp + Math.sin(px * 0.021 + k) * 0.8; px ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.stroke();
        }
      }
      // knots
      if (Math.random() < 0.55) {
        const kx = Math.random() * S, ky = top + step * (0.3 + Math.random() * 0.4);
        for (let r = 7; r > 0; r -= 1.4) {
          x.strokeStyle = `rgba(40,18,6,${0.25 - r * 0.02})`; x.lineWidth = 1.1; x.beginPath(); x.ellipse(kx, ky, r * 3.2, r * 0.9, 0, 0, Math.PI * 2); x.stroke();
          y.strokeStyle = 'rgba(70,70,70,.4)'; y.lineWidth = 1.1; y.beginPath(); y.ellipse(kx, ky, r * 3.2, r * 0.9, 0, 0, Math.PI * 2); y.stroke();
        }
      }
      // seams: dark gap with a lit edge below, plank butt-joints and treenails
      x.fillStyle = dark; x.fillRect(0, top, S, 3); x.fillStyle = 'rgba(255,230,190,.12)'; x.fillRect(0, top + 3, S, 1.5);
      y.fillStyle = '#1e1e1e'; y.fillRect(0, top, S, 3); y.fillStyle = '#d8d8d8'; y.fillRect(0, top + 3, S, 1.5);
      const joins = [Math.random() * S * 0.5, S * 0.5 + Math.random() * S * 0.5];
      for (const jx of joins) {
        x.fillStyle = dark; x.fillRect(jx, top, 2.5, step); y.fillStyle = '#262626'; y.fillRect(jx, top, 2.5, step);
        for (const ny of [0.3, 0.7]) for (const nx of [-7, 9]) {
          x.fillStyle = 'rgba(30,18,10,.75)'; x.beginPath(); x.arc(jx + nx, top + step * ny, 2.2, 0, 7); x.fill();
          y.fillStyle = '#505050'; y.beginPath(); y.arc(jx + nx, top + step * ny, 2.2, 0, 7); y.fill();
        }
      }
    }
    // weathering: salt stains and wear
    for (let i = 0; i < 90; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); x.save(); x.translate(Math.random() * S, Math.random() * S); x.scale(40 + Math.random() * 120, 8 + Math.random() * 30); g.addColorStop(0, `rgba(${opts.salt ? '230,225,210' : '20,10,4'},${Math.random() * 0.07})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(-1, -1, 2, 2); x.restore(); }
    const t = canvasTex(c, [1, 1]);
    const bt = new THREE.CanvasTexture(b); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.anisotropy = maxAniso;
    t.userData = { bump: bt };
    return t;
  }
  // fine canvas weave for sails (bump only)
  const weaveBump = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 4) { x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, i, 256, 2); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(i, 0, 2, 256); }
    for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},.08)`; x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 6, 1); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); t.anisotropy = maxAniso; return t;
  })();
  function woodMat(tex, o) {
    return toon(Object.assign({ map: tex, bumpMap: tex.userData.bump, bumpScale: 0.9, roughness: 0.72 }, o || {}));
  }
  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,220,160,.6)'); g.addColorStop(1, 'rgba(255,160,60,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }

  /* ======================= SHIPS: Thousand Sunny + Going Merry ======================= */
  const hullTex = woodTexture('#8a4f22', '#3d2009', 10); hullTex.repeat.set(0.18, 0.45);
  const merryHullTex = woodTexture('#4b2d18', '#211108', 12); merryHullTex.repeat.set(0.2, 0.5);
  const deckTex = woodTexture('#c69763', '#7a5430', 14); deckTex.repeat.set(0.22, 0.22);
  const paintTex = woodTexture('#ffffff', '#9a9a9a', 12, { salt: true }); paintTex.repeat.set(0.3, 0.6);
  const mastTex = woodTexture('#7a4c28', '#3a2210', 5); mastTex.repeat.set(1, 1); mastTex.rotation = Math.PI / 2;
  const barrelTex = woodTexture('#8f5e36', '#3c2210', 10); barrelTex.repeat.set(1, 1); barrelTex.rotation = Math.PI / 2;
  const M = {
    hull: woodMat(hullTex, { roughness: 0.6 }),
    merryHull: woodMat(merryHullTex, { roughness: 0.62 }),
    merryBand: woodMat(paintTex, { color: '#c9ced3', roughness: 0.45, bumpScale: 0.5 }),
    deck: woodMat(deckTex, { roughness: 0.78 }),
    rail: woodMat(paintTex, { color: '#e2d3b0', roughness: 0.5, bumpScale: 0.45 }),
    white: woodMat(paintTex, { color: '#e9e4d8', roughness: 0.42, bumpScale: 0.35 }),
    trim: toon({ color: '#e7a93a', metalness: 1.0, roughness: 0.3 }),
    mast: woodMat(mastTex, { roughness: 0.66 }),
    cabin: woodMat(paintTex, { color: '#e6d6b4', roughness: 0.55, bumpScale: 0.45 }),
    roof: woodMat(paintTex, { color: '#23874a', roughness: 0.5, bumpScale: 0.5 }),
    brown: woodMat(barrelTex, { roughness: 0.7 }),
    lionMane: toon({ color: '#ff5a06', roughness: 0.55 }),
    lionMane2: toon({ color: '#ff9a0a', roughness: 0.5, flatShading: true }),
    lionFace: toon({ color: '#ffbf00', roughness: 0.4 }),
    wool: toon({ color: '#f7f3e8', roughness: 0.8 }),
    sheepFace: toon({ color: '#f1dcaa', roughness: 0.55 }),
    horn: toon({ color: '#e9d6a2', roughness: 0.5 }),
    black: toon({ color: '#141414', roughness: 0.35, metalness: 0.2 }),
    grass: toon({ color: '#48b03e', roughness: 0.95 }),
    leaf: toon({ color: '#3f8f3a', roughness: 0.9, flatShading: true }),
    mikan: toon({ color: '#ff9a1f', roughness: 0.35 }),
    rope: toon({ color: '#6b5236', roughness: 0.95 }),
    window: toon({ color: '#ffe2a8', emissive: '#ff9d2e', emissiveIntensity: 0.4, roughness: 0.08, metalness: 0.1 }),
    lantern: toon({ color: '#ffd27a', emissive: '#ffa53a', emissiveIntensity: 0.5 }),
    vikingHull: woodMat(woodTexture('#7a4a28', '#3a200d', 9)),
    vikingBand: toon({ color: '#d6a843', metalness: 1, roughness: 0.35 }),
    dragon: toon({ color: '#3f8a4a' }),
    shieldR: woodMat(paintTex, { color: '#c8352b', bumpScale: 0.6 }), shieldY: woodMat(paintTex, { color: '#f0c23a', bumpScale: 0.6 }), shieldB: woodMat(paintTex, { color: '#2f5fb0', bumpScale: 0.6 }),
    iron: toon({ color: '#4a4f58', metalness: 0.9, roughness: 0.42 }),
    skin: toon({ color: '#eab48b' }), beardO: toon({ color: '#d9722e' }), beardW: toon({ color: '#eeeae0' }),
    tunicR: toon({ color: '#a8342c' }), tunicB: toon({ color: '#35558f' }), tunicG: toon({ color: '#4f7a3a' }), fur: toon({ color: '#8a6a4a' })
  };

  const sailMeshes = [], flags = [], lanterns = [], glowSprites = [];
  const gt = glowTexture();
  const flagTex = flagTexture();
  const SAIL_TEX = { jolly: sailTexture('jolly'), stripes: sailTexture('stripes'), plain: sailTexture('plain'), viking: sailTexture('viking') };
  function hullHalfWidth(L, Wd, x) {
    let best = 0, bd = 1e9;
    for (const p of hullShape(L, Wd).getSpacedPoints(400)) if (p.y > 0 && Math.abs(p.x - x) < bd) { bd = Math.abs(p.x - x); best = p.y; }
    return best;
  }
  // brass-ringed portholes that follow the tapered hull
  function portholes(P, L, Wd, depth, xs, y) {
    const t = -y / depth;
    for (const x0 of xs) {
      const hw = hullHalfWidth(L, Wd, x0) * (1 - 0.62 * t * t), x = x0 * (1 - 0.1 * t) + (x0 > 0 ? -0.6 * t * t : 0.25 * t);
      for (const s of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 22), M.trim); ring.position.set(x, y, s * (hw + 0.03)); ring.userData.ink = false; P.add(ring);
        const glass = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), M.window); glass.position.set(x, y, s * (hw + 0.035)); glass.rotation.y = s > 0 ? 0 : Math.PI; P.add(glass);
      }
    }
  }
  function barrel(P, x, y, z, s) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.52, 16), M.brown); b.position.set(x, y + 0.26, z); P.add(b);
    const bulge = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.2, 16), M.brown); bulge.position.set(x, y + 0.26, z); P.add(bulge);
    for (const h of [0.08, 0.44]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.018, 6, 20), M.iron); hoop.rotation.x = Math.PI / 2; hoop.position.set(x, y + h, z); hoop.userData.ink = false; P.add(hoop); }
    if (s) { b.parent.children.slice(-4).forEach(o => o.scale.multiplyScalar(s)); }
  }
  function crate(P, x, y, z, s, r) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), M.deck); c.position.set(x, y + s / 2, z); c.rotation.y = r || 0; P.add(c);
  }
  function anchor(P, x, y, z, side) {
    const g = new THREE.Group();
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8), M.iron); g.add(shank);
    const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), M.iron); stock.rotation.x = Math.PI / 2; stock.position.y = 0.4; g.add(stock);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 16), M.iron); ring.position.y = 0.58; g.add(ring);
    const arms = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 20, Math.PI), M.iron); arms.rotation.z = Math.PI; arms.position.y = -0.2; g.add(arms);
    for (const sx of [-0.32, 0.32]) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), M.iron); fl.position.set(sx, -0.14, 0); g.add(fl); }
    g.position.set(x, y, z); g.rotation.y = side > 0 ? 0 : Math.PI; g.rotation.z = 0.12; P.add(g);
  }
  // ratlines: shrouds with climbing rungs
  function ratlines(P, top, feet, y0, y1, step) {
    for (const f of feet) rope(P, top, f, 0.016);
    const A = new THREE.Vector3(...top), F0 = new THREE.Vector3(...feet[0]), F1 = new THREE.Vector3(...feet[feet.length - 1]);
    for (let h = y0; h <= y1; h += step) {
      const k0 = (h - F0.y) / (A.y - F0.y), k1 = (h - F1.y) / (A.y - F1.y);
      const p0 = F0.clone().lerp(A, k0), p1 = F1.clone().lerp(A, k1);
      rope(P, p0.toArray(), p1.toArray(), 0.011);
    }
  }

  function hullShape(L, W) {
    const s = new THREE.Shape();
    s.moveTo(-L, -W * 0.85);
    s.quadraticCurveTo(-L - 0.07 * L, 0, -L, W * 0.85);
    s.bezierCurveTo(-0.29 * L, W * 1.08, 0.42 * L, W * 1.05, L * 0.62, W * 0.62);
    s.quadraticCurveTo(L * 0.92, W * 0.25, L, 0);
    s.quadraticCurveTo(L * 0.92, -W * 0.25, L * 0.62, -W * 0.62);
    s.bezierCurveTo(0.42 * L, -W * 1.05, -0.29 * L, -W * 1.08, -L, -W * 0.85);
    return s;
  }
  // o: { L, W, depth, sheer(x), hullMat, bands:[{mat,y,h,k}], rail:'wall'|'balusters', railMat, railH }
  function buildHull(parent, o) {
    const { L, W, depth, sheer } = o;
    const taper = (g) => {
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), x = pos.getX(i), t = Math.max(0, -y / depth);
        pos.setZ(i, pos.getZ(i) * (1 - 0.62 * t * t));
        pos.setX(i, x * (1 - 0.1 * t) + (x > 0 ? -0.6 * t * t : 0.25 * t));
      }
    };
    const g = new THREE.ExtrudeGeometry(hullShape(L, W), { depth, bevelEnabled: false, curveSegments: 28, steps: 5 });
    g.rotateX(Math.PI / 2); taper(g);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > -0.01) pos.setY(i, pos.getY(i) + sheer(pos.getX(i)));
    g.computeVertexNormals();
    parent.add(new THREE.Mesh(g, [M.deck, o.hullMat]));
    for (const b of o.bands) {
      const bg = new THREE.ExtrudeGeometry(hullShape(L * b.k, W * b.k), { depth: b.h, bevelEnabled: false, curveSegments: 28 });
      bg.rotateX(Math.PI / 2); bg.translate(0, b.y, 0); taper(bg);
      if (b.follow) { const bp = bg.attributes.position; for (let i = 0; i < bp.count; i++) bp.setY(i, bp.getY(i) + sheer(bp.getX(i))); }
      bg.computeVertexNormals();
      parent.add(new THREE.Mesh(bg, b.mat));
    }
    const lift = (geo) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + sheer(p.getX(i))); geo.computeVertexNormals(); };
    if (o.rail === 'wall') {
      const outer = hullShape(L, W); outer.holes.push(new THREE.Path(hullShape(L * 0.92, W * 0.92).getPoints(90)));
      const rg = new THREE.ExtrudeGeometry(outer, { depth: o.railH, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2, curveSegments: 28 });
      rg.rotateX(-Math.PI / 2); lift(rg);
      parent.add(new THREE.Mesh(rg, o.railMat));
    } else {
      // Merry style: white balustrade = cap rail + turned posts
      const outer = hullShape(L * 0.99, W * 0.99); outer.holes.push(new THREE.Path(hullShape(L * 0.94, W * 0.94).getPoints(90)));
      const cap = new THREE.ExtrudeGeometry(outer, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2, curveSegments: 28 });
      cap.rotateX(-Math.PI / 2); cap.translate(0, o.railH, 0); lift(cap);
      parent.add(new THREE.Mesh(cap, o.railMat));
      const kick = new THREE.ExtrudeGeometry(outer, { depth: 0.12, bevelEnabled: false, curveSegments: 28 });
      kick.rotateX(-Math.PI / 2); lift(kick);
      parent.add(new THREE.Mesh(kick, o.railMat));
      const pts = hullShape(L * 0.965, W * 0.965).getSpacedPoints(70);
      const postGeo = new THREE.CylinderGeometry(0.035, 0.05, o.railH, 6);
      const posts = new THREE.InstancedMesh(postGeo, o.railMat, pts.length);
      const m4 = new THREE.Matrix4();
      pts.forEach((p, i) => { m4.makeTranslation(p.x, sheer(p.x) + o.railH / 2, -p.y); posts.setMatrixAt(i, m4); });
      parent.add(posts);
    }
  }
  function mastWithSail(parent, x, h, sailW, sailH, sailY, tex, r) {
    r = r || 0.12;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 1.15, h, 14), M.mast); mast.position.set(x, h / 2, 0); parent.add(mast);
    for (const yy of [sailY + sailH / 2, sailY - sailH / 2]) {
      const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, sailW + 0.7, 10), M.mast);
      yard.rotation.x = Math.PI / 2; yard.position.set(x + 0.08, yy, 0); parent.add(yard);
    }
    const g = new THREE.PlaneGeometry(sailW, sailH, 22, 16);
    const base = g.attributes.position.array.slice();
    const sail = new THREE.Mesh(g, toon({ map: tex, side: THREE.DoubleSide, roughness: 0.92 }));
    sail.rotation.y = Math.PI / 2; sail.position.set(x + 0.14, sailY, 0);
    parent.add(sail);
    sailMeshes.push({ mesh: sail, base, w: sailW, h: sailH, phase: Math.random() * 6, k: sailW / 4.6 });
    return mast;
  }
  function rope(parent, a, b, r) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r || 0.018, r || 0.018, va.distanceTo(vb), 5), M.rope);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    m.castShadow = false; parent.add(m);
  }
  function addFlag(parent, x, y, w) {
    w = w || 1.7;
    const fg = new THREE.PlaneGeometry(w, w * 0.65, 16, 8); fg.translate(w / 2, 0, 0);
    const f = new THREE.Mesh(fg, toon({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }));
    f.position.set(x, y, 0); f.rotation.y = Math.PI; parent.add(f);
    flags.push({ mesh: f, base: fg.attributes.position.array.slice() });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, w * 0.8, 8), M.mast); pole.position.set(x, y, 0); parent.add(pole);
  }
  function addLantern(parent, x, y, z, dist) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), M.lantern); l.position.set(x, y, z); parent.add(l);
    const pl = new THREE.PointLight('#ffae4a', 0, dist || 16, 2); pl.position.set(x, y, z); parent.add(pl); lanterns.push(pl);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: '#ffb35c', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.set(1.6, 1.6, 1); sp.position.set(x, y, z); parent.add(sp); glowSprites.push(sp);
  }
  function mikanTree(parent, x, y, z, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.5, 6), M.brown); trunk.position.y = 0.25; g.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), M.leaf); crown.position.y = 0.72; crown.scale.set(1, 0.85, 1); g.add(crown);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, e = (i % 3 - 1) * 0.35;
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M.mikan);
      o.position.set(Math.cos(a) * 0.42 * Math.cos(e), 0.72 + Math.sin(e) * 0.38, Math.sin(a) * 0.42 * Math.cos(e)); g.add(o);
    }
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.26, 12), M.brown); pot.position.y = 0.05; g.add(pot);
    g.position.set(x, y, z); g.scale.setScalar(s || 1); parent.add(g);
  }
  function helm(parent, x, y, z) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 28), M.brown));
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5), M.brown); sp.rotation.z = i * Math.PI / 8; g.add(sp);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 12), M.trim); hub.rotation.x = Math.PI / 2; g.add(hub);
    g.rotation.y = Math.PI / 2; g.position.set(x, y, z); parent.add(g);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, y, 8), M.brown); post.position.set(x - 0.08, y / 2, z); parent.add(post);
  }

  /* ---------- THOUSAND SUNNY (hero ship, built at scale 1 then enlarged) ---------- */
  const SUNNY_S = 1.6;
  const sunny = new THREE.Group(), sunnyIn = new THREE.Group(); sunny.add(sunnyIn); scene.add(sunny);
  sunny.scale.setScalar(SUNNY_S);
  {
    const P = sunnyIn;
    const sheer = (x) => Math.max(0, x - 2.5) * 0.12 + Math.max(0, -x - 3.4) * 0.3;
    buildHull(P, {
      L: 5.2, W: 1.75, depth: 2.3, sheer, hullMat: M.hull, rail: 'wall', railMat: M.rail, railH: 0.5,
      bands: [{ mat: M.trim, y: -0.35, h: 0.16, k: 1.014 }, { mat: M.trim, y: -0.02, h: 0.07, k: 1.01, follow: true }]
    });
    const lawn = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.06, 40), M.grass); lawn.scale.set(1.8, 1, 1); lawn.position.set(0.6, 0.04, 0); P.add(lawn);
    // aft castle: two-storey cabin, stern gallery windows, helm + mikan grove on the roof
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.3, 2.5), M.cabin); cab.position.set(-3.9, 0.95, 0); P.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 2.8), M.roof); roof.position.set(-3.9, 1.66, 0); P.add(roof);
    const upRail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, 0.06), M.rail);
    for (const z of [-1.37, 1.37]) { const r = upRail.clone(); r.position.set(-3.9, 1.88, z); P.add(r); }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.85), M.brown); door.position.set(-2.94, 0.72, 0); door.rotation.y = Math.PI / 2; P.add(door);
    for (const z of [-0.8, 0.8]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.19, 20), M.window); w.position.set(-2.94, 1.02, z); w.rotation.y = Math.PI / 2; P.add(w); }
    for (const z of [-0.78, -0.26, 0.26, 0.78]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.6), M.window); w.position.set(-4.86, 1.0, z); w.rotation.y = -Math.PI / 2; P.add(w); }
    for (const z of [-1.26, 1.26]) for (const x of [-4.4, -3.5]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), M.window); w.position.set(x, 1.0, z); w.rotation.y = z > 0 ? 0 : Math.PI; P.add(w); }
    helm(P, -3.25, 2.25, 0);
    mikanTree(P, -4.45, 1.74, 0.75, 0.9); mikanTree(P, -4.45, 1.74, -0.75, 0.9); mikanTree(P, -4.5, 1.74, 0, 0.75);
    // main mast (Jolly Roger sail) + foremast (red-white stripes)
    mastWithSail(P, 0.9, 7.8, 4.8, 3.8, 4.4, SAIL_TEX.jolly, 0.14);
    mastWithSail(P, 3.25, 5.2, 2.9, 2.1, 3.3, SAIL_TEX.stripes, 0.1);
    // crow's nest observation room (round, windowed) on the main mast
    const room = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.6, 0.7, 28), M.cabin); room.position.set(0.9, 7.05, 0); P.add(room);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.735, 0.7, 0.24, 28, 1, true), M.window); band.position.set(0.9, 7.12, 0); P.add(band);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.74, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.roof); dome.scale.y = 0.55; dome.position.set(0.9, 7.4, 0); P.add(dome);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.35, 0.25, 24), M.hull); floor.position.set(0.9, 6.6, 0); P.add(floor);
    addFlag(P, 0.9, 8.35);
    // rigging
    rope(P, [0.9, 7.6, 0], [6.4, 1.6, 0]); rope(P, [0.9, 6.9, 0], [-4.9, 1.8, 0]); rope(P, [3.25, 5.1, 0], [6.1, 1.4, 0]);
    for (const z of [-1, 1]) { rope(P, [0.9, 6.5, 0], [0.2, 0.5, 1.72 * z]); rope(P, [0.9, 6.5, 0], [1.9, 0.5, 1.72 * z]); rope(P, [3.25, 4.8, 0], [3.25, 0.5, 1.45 * z]); }
    // swing hanging from the main-mast yard (Sunny detail)
    for (const z of [-0.25, 0.25]) rope(P, [1.05, 2.5, z], [1.05, 1.1, z], 0.012);
    { const seat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.6), M.brown); seat.position.set(1.05, 1.1, 0); P.add(seat); }
    // bowsprit
    const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 2.6, 10), M.mast); bs.rotation.z = -Math.PI / 2 + 0.35; bs.position.set(5.6, 1.05, 0); P.add(bs);
    // lion figurehead with a two-tone sunflower mane
    const lion = new THREE.Group(); const mane = new THREE.Group();
    for (let ring = 0; ring < 2; ring++) {
      const n = ring ? 14 : 18, rad = ring ? 0.62 : 0.8, len = ring ? 0.6 : 0.85;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.17;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(ring ? 0.2 : 0.26, len, 7), ring ? M.lionMane2 : M.lionMane);
        cone.position.set(ring * 0.08, Math.sin(a) * rad, Math.cos(a) * rad); cone.rotation.x = -a + Math.PI / 2; mane.add(cone);
      }
    }
    const md = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.3, 28), M.lionMane); md.rotation.z = Math.PI / 2; mane.add(md); lion.add(mane);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 24), M.lionFace); face.scale.set(0.8, 1, 1); face.position.x = 0.18; lion.add(face);
    for (const z of [-0.22, 0.22]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), M.black); eye.position.set(0.66, 0.17, z); lion.add(eye);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), M.lionFace); cheek.position.set(0.6, -0.12, z * 0.9); lion.add(cheek);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), M.lionMane); nose.position.set(0.72, 0.0, 0); lion.add(nose);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 20, Math.PI), M.black); smile.rotation.set(0, Math.PI / 2, Math.PI); smile.position.set(0.68, -0.2, 0); lion.add(smile);
    lion.position.set(5.05, 0.95, 0); P.add(lion);
    addLantern(P, -4.9, 1.95, 1.2); addLantern(P, -4.9, 1.95, -1.2); addLantern(P, 4.2, 1.35, 0); addLantern(P, 0.9, 7.8, 0);
    portholes(P, 5.2, 1.75, 2.3, [-2.7, -1.7, -0.7, 0.3, 1.3, 2.3, 3.2], -0.78);
    for (const z of [-1, 1]) ratlines(P, [0.9, 6.45, 0], [[-0.25, 0.5, 1.7 * z], [0.35, 0.5, 1.74 * z], [1.2, 0.5, 1.74 * z], [1.95, 0.5, 1.7 * z]], 1.0, 5.6, 0.42);
    for (const z of [-1, 1]) ratlines(P, [3.25, 4.75, 0], [[2.85, 0.5, 1.5 * z], [3.65, 0.5, 1.42 * z]], 1.0, 4.1, 0.42);
    barrel(P, -2.55, 0, 1.05); barrel(P, -2.55, 0, 0.6); barrel(P, -2.55, 0, -1.05); barrel(P, -2.5, 0.52, 0.82, 0.9);
    crate(P, 2.4, 0, -1.0, 0.5, 0.3); crate(P, 2.45, 0.5, -1.0, 0.38, -0.2); crate(P, 2.3, 0, 1.05, 0.46, 0.5);
    for (const z of [-1, 1]) anchor(P, 3.6, -0.55, z * (hullHalfWidth(5.2, 1.75, 3.6) * 0.95 + 0.12), z);
    P.position.y = 1.15;
  }

  /* ---------- GOING MERRY (sails in the Sunny's company) ---------- */
  const MERRY_S = 1.12;
  const merry = new THREE.Group(), merryIn = new THREE.Group(); merry.add(merryIn); scene.add(merry);
  merry.scale.setScalar(MERRY_S);
  const MERRY_HOME = new THREE.Vector3(-25, 0, -12);
  merry.position.copy(MERRY_HOME);
  {
    const P = merryIn;
    const sheer = (x) => Math.max(0, x - 2.2) * 0.2 + Math.max(0, -x - 2.4) * 0.42;
    buildHull(P, {
      L: 4.8, W: 1.5, depth: 2.1, sheer, hullMat: M.merryHull, rail: 'balusters', railMat: M.white, railH: 0.55,
      bands: [{ mat: M.merryBand, y: -0.42, h: 0.32, k: 1.012 }, { mat: M.white, y: -0.02, h: 0.12, k: 1.012, follow: true }]
    });
    // raised aft deck with cabin door + mikan trees
    const aft = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 2.3), M.merryHull); aft.position.set(-3.75, 0.45 + 0.6, 0); P.add(aft);
    const aftTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 2.4), M.deck); aftTop.position.set(-3.75, 1.54, 0); P.add(aftTop);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.7), M.brown); door.position.set(-2.89, 0.95, 0); door.rotation.y = Math.PI / 2; P.add(door);
    for (const z of [-0.65, 0.65]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.13, 18), M.window); w.position.set(-2.89, 1.05, z); w.rotation.y = Math.PI / 2; P.add(w); }
    for (const z of [-0.5, 0, 0.5]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), M.window); w.position.set(-4.62, 1.0, z); w.rotation.y = -Math.PI / 2; P.add(w); }
    mikanTree(P, -3.55, 1.58, 0.55, 0.85); mikanTree(P, -3.55, 1.58, -0.55, 0.85); mikanTree(P, -4.1, 1.58, 0, 0.7);
    // main mast (big white sail with the black Jolly Roger) + aft mast (red-white stripes)
    mastWithSail(P, 0.35, 7.3, 4.3, 3.9, 4.0, SAIL_TEX.jolly, 0.13);
    mastWithSail(P, -3.1, 4.9, 2.1, 1.9, 3.6, SAIL_TEX.stripes, 0.09);
    const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.38, 0.5, 20, 1, true), M.brown); nest.material.side = THREE.DoubleSide; nest.position.set(0.35, 6.55, 0); P.add(nest);
    const nf = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 20), M.deck); nf.position.set(0.35, 6.32, 0); P.add(nf);
    addFlag(P, 0.35, 7.6, 1.4);
    rope(P, [0.35, 7.1, 0], [5.7, 1.9, 0]); rope(P, [0.35, 6.4, 0], [-3.1, 4.8, 0]);
    for (const z of [-1, 1]) { rope(P, [0.35, 6.3, 0], [-0.3, 0.55, 1.48 * z]); rope(P, [0.35, 6.3, 0], [1.2, 0.55, 1.45 * z]); rope(P, [-3.1, 4.6, 0], [-3.1, 1.6, 1.2 * z]); }
    // bowsprit
    const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 2.4, 10), M.mast); bs.rotation.z = -Math.PI / 2 + 0.4; bs.position.set(5.1, 1.2, 0); P.add(bs);
    // sheep figurehead: curved white neck, woolly head, curled horns
    const neckCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(4.2, 0.2, 0), new THREE.Vector3(4.85, 0.7, 0), new THREE.Vector3(5.05, 1.4, 0), new THREE.Vector3(4.95, 1.85, 0)]);
    P.add(new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 24, 0.16, 12, false), M.white));
    const head = new THREE.Group();
    const wool = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), M.wool); wool.scale.set(0.95, 0.85, 1.05); head.add(wool);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const puff = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), M.wool); puff.position.set(-0.12, Math.sin(a) * 0.3 + 0.12, Math.cos(a) * 0.36); head.add(puff); }
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.3, 22, 16), M.sheepFace); snout.scale.set(1.25, 0.8, 0.85); snout.position.set(0.3, -0.06, 0); head.add(snout);
    for (const z of [-0.18, 0.18]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), M.black); eye.position.set(0.32, 0.14, z); head.add(eye);
      const pts = [];
      for (let i = 0; i <= 26; i++) { const a = i * 0.36, r = 0.3 * (1 - i / 26 * 0.75); pts.push(new THREE.Vector3(-0.05 + Math.cos(a + 1.2) * r, 0.1 + Math.sin(a + 1.2) * r, Math.sign(z) * (0.34 + i * 0.006))); }
      const horn = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.07, 8, false), M.horn); head.add(horn);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 6, 14, Math.PI), M.black); mouth.rotation.set(0, Math.PI / 2, Math.PI); mouth.position.set(0.63, -0.14, 0); head.add(mouth);
    head.position.set(5.05, 2.1, 0); P.add(head);
    addLantern(P, -4.62, 1.7, 0.9, 12); addLantern(P, -4.62, 1.7, -0.9, 12); addLantern(P, 0.35, 6.9, 0, 12);
    portholes(P, 4.8, 1.5, 2.1, [-1.9, -0.9, 0.1, 1.1, 2.1], -1.0);
    for (const z of [-1, 1]) ratlines(P, [0.35, 6.2, 0], [[-0.35, 0.55, 1.45 * z], [0.35, 0.55, 1.5 * z], [1.1, 0.55, 1.45 * z]], 1.0, 5.4, 0.45);
    barrel(P, -2.2, 0, 0.9); barrel(P, -2.2, 0, -0.9); crate(P, 2.2, 0, 0.8, 0.45, 0.4); crate(P, 2.3, 0, -0.75, 0.4, -0.3);
    // side cannons
    for (const z of [-1, 1]) for (const x of [-0.9, 1.6]) { const cn = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.8, 12), M.iron); cn.rotation.x = Math.PI / 2; cn.position.set(x, 0.35, z * (hullHalfWidth(4.8, 1.5, x) * 0.97 + 0.25)); P.add(cn); }
    for (const z of [-1, 1]) anchor(P, 3.3, -0.5, z * (hullHalfWidth(4.8, 1.5, 3.3) * 0.95 + 0.12), z);
    P.position.y = 1.05;
  }

  const ships = [
    { g: sunny, halfL: 5.2 * SUNNY_S, halfW: 1.75 * SUNNY_S, sink: 0.85, uni: null },
    { g: merry, halfL: 4.8 * MERRY_S, halfW: 1.5 * MERRY_S, sink: 0.9, uni: null }
  ];
  const ship = sunny;   // camera, sun & shadows follow the Sunny
  const SUNNY_BOW = new THREE.Vector3(5.3, 0.9, 0), MERRY_BOW = new THREE.Vector3(4.7, 0.8, 0);
  sunny.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
  merry.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
  sunLight.target = ship;

  /* ======================= ISLANDS ======================= */
  function palm(x, z, h) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, h, 6), toon({ color: '#7a5230', flatShading: true }));
    trunk.position.y = h / 2; trunk.rotation.z = 0.15; g.add(trunk);
    const leafMat = toon({ color: '#2f8f3a', flatShading: true, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) { const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 4), leafMat); leaf.position.set(-Math.sin(0.15) * h, h, 0); leaf.rotation.set(0, (i / 6) * Math.PI * 2, 1.9); leaf.translateY(1.1); g.add(leaf); }
    g.position.set(x, 0, z); return g;
  }
  function island(x, z, s, peaks) {
    const g = new THREE.Group();
    const sand = new THREE.Mesh(new THREE.CylinderGeometry(9 * s, 11.5 * s, 1.6, 24), toon({ color: '#e6cc92', flatShading: true, roughness: 1 }));
    sand.position.y = 0.2; g.add(sand);
    const hillMat = toon({ color: '#2f6e45', flatShading: true, roughness: 0.95 });
    peaks.forEach(([px, pz, ph, pr]) => { const hill = new THREE.Mesh(new THREE.ConeGeometry(pr * s, ph * s, 8), hillMat); hill.position.set(px * s, ph * s / 2 + 0.8, pz * s); g.add(hill); });
    g.add(palm(5 * s, 3 * s, 4.5 * s)); g.add(palm(-5.5 * s, 2 * s, 3.8 * s));
    g.position.set(x, -0.4, z); scene.add(g); return g;
  }
  island(-170, -250, 1.8, [[0, 0, 16, 7], [4, -2, 10, 5], [-4, 1, 8, 4.5]]);
  island(130, -190, 2.1, [[0, 0, 12, 8], [-5, 1, 7, 5]]);
  island(-190, 60, 1.8, [[0, 0, 14, 7], [3, 3, 9, 5]]);
  island(210, 120, 1.4, [[0, 0, 11, 6]]);
  scene.fog = new THREE.Fog(PAL.day.horizon.clone(), 160, 1150);

  /* ======================= SEAGULLS ======================= */
  const gulls = [];
  const gullMat = toon({ color: '#f5f5f5', side: THREE.DoubleSide, roughness: 0.8 });
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    const wingGeo = new THREE.PlaneGeometry(0.9, 0.26); wingGeo.translate(0.45, 0, 0);
    const l = new THREE.Mesh(wingGeo, gullMat), r = new THREE.Mesh(wingGeo, gullMat);
    l.rotation.x = r.rotation.x = -Math.PI / 2; r.rotation.y = Math.PI;
    const wl = new THREE.Group(), wr = new THREE.Group(); wl.add(l); wr.add(r);
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 6), gullMat); body.rotation.x = Math.PI / 2;
    g.add(wl, wr, body);
    g.userData = { wl, wr, r: 15 + Math.random() * 18, h: 16 + Math.random() * 8, s: 0.16 + Math.random() * 0.14, o: Math.random() * 6.28 };
    scene.add(g); gulls.push(g);
  }

  /* ======================= LIGHT MOTES (sun dust by day, fireflies at night) ======================= */
  const MOTES = isMobile ? 160 : 320;
  const mg = new THREE.BufferGeometry();
  const mp = new Float32Array(MOTES * 3), ms = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    mp[i * 3] = (Math.random() - 0.5) * 90; mp[i * 3 + 1] = 1 + Math.random() * 20; mp[i * 3 + 2] = (Math.random() - 0.5) * 80;
    ms[i] = Math.random();
  }
  mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  mg.setAttribute('aSeed', new THREE.BufferAttribute(ms, 1));
  const motesMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: SU.uTime, uColor: { value: PAL.day.motes.clone() }, uOpacity: { value: PAL.day.motesO }, uPR: { value: DPR } },
    vertexShader: `
      uniform float uTime; uniform float uPR; attribute float aSeed; varying float vA;
      void main(){
        vec3 p = position;
        p.x = mod(p.x - uTime * (0.6 + aSeed * 0.8) + 45.0, 90.0) - 45.0;
        p.y += sin(uTime * (0.4 + aSeed) + aSeed * 30.0) * 0.6;
        p.z += cos(uTime * (0.3 + aSeed * 0.6) + aSeed * 12.0) * 0.8;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.0 + aSeed * 4.0) * uPR * (22.0 / -mv.z);
        vA = (0.4 + 0.6 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 40.0) * 0.5 + 0.5) * smoothstep(80.0, 14.0, -mv.z);
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(uColor * a * a, a * vA * uOpacity); }`
  });
  const motes = new THREE.Points(mg, motesMat); motes.frustumCulled = false; scene.add(motes);

  /* ======================= ANIME LAYER: clouds, Elbaph, splashes, wind lines, ink outlines ======================= */
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // --- towering cel-shaded cumulus (One Piece signature skies) ---
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: SU, extensions: { derivatives: true },
    vertexShader: `varying vec3 vN; varying vec3 vW;
      void main(){ vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uCloudLit; uniform vec3 uCloudDark;
      ${GLSL_SKY}
      varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 n = normalize(vN); vec3 V = normalize(cameraPosition - vW);
        float l = dot(n, normalize(uSunDir)) * 0.7 + n.y * 0.55 + 0.05;
        float lit = smoothstep(0.0, fwidth(l) + 0.01, l);
        vec3 col = mix(uCloudDark, uCloudLit, lit);
        float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        col = mix(col, uCloudDark, rim * 0.3 * lit);
        vec3 dir = normalize(vW - cameraPosition);
        vec3 hz = skyBase(normalize(vec3(dir.x, 0.0, dir.z)), 1.0);
        col = mix(col, hz, (1.0 - smoothstep(0.0, 0.3, dir.y)) * 0.4 + 0.06);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`
  });
  const blobs = [];
  function cumulus(cx, cz, baseY, w, hgt) {
    const a = Math.atan2(cz, cx), tx = -Math.sin(a), tz = Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
    const n = 12 + ((w / 20) | 0);
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1 + (rnd() - 0.5) * 0.15, prof = Math.max(0.05, 1 - u * u);
      const r = (0.3 + 0.7 * prof) * hgt * 0.5 * (0.75 + rnd() * 0.45);
      const y = baseY + prof * hgt * (0.35 + rnd() * 0.6);
      const d = (rnd() - 0.5) * r * 0.8;
      blobs.push([cx + tx * u * w * 0.5 + rx * d, y, cz + tz * u * w * 0.5 + rz * d, r, 1]);
    }
    for (let i = 0; i < 7; i++) {   // flat bases
      const u = (i / 6) * 2 - 1, r = hgt * (0.28 + rnd() * 0.12);
      blobs.push([cx + tx * u * w * 0.42, baseY + r * 0.35, cz + tz * u * w * 0.42, r, 0.55]);
    }
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rnd() * 0.3, d = 540 + rnd() * 260;
    cumulus(Math.cos(a) * d, Math.sin(a) * d, 16 + rnd() * 30, 120 + rnd() * 160, 45 + rnd() * 70);
  }
  for (const a of [0.6, 2.4, 4.0]) cumulus(Math.cos(a) * 880, Math.sin(a) * 880, 30, 260, 170 + rnd() * 60);
  // Elbaph: the giant Treasure Tree Adam rising far beyond the clouds
  const ELB = new THREE.Vector3(-330, 0, -760);
  for (let i = 0; i < 11; i++) {           // the sea of clouds wrapping the trunk between the Underworld and the Sun World
    const a = (i / 11) * Math.PI * 2 + rnd() * 0.3, d = 250 + rnd() * 230;
    cumulus(ELB.x + Math.cos(a) * d, ELB.z + Math.sin(a) * d, 175 + rnd() * 50, 150 + rnd() * 110, 45 + rnd() * 30);
  }
  const CAM_A = Math.atan2(18 - ELB.z, 14.5 - ELB.x), FALL_ANGLES = [CAM_A - 0.05, CAM_A + 0.55, CAM_A - 0.62];
  for (const a of FALL_ANGLES) for (let k = 0; k < 5; k++) {   // mist where the waterfalls land
    const r = 18 + rnd() * 16; blobs.push([ELB.x + Math.cos(a) * 195 + (rnd() - 0.5) * 50, 26 + rnd() * 10, ELB.z + Math.sin(a) * 195 + (rnd() - 0.5) * 50, r, 0.7]);
  }
  {
    const geo = new THREE.SphereGeometry(1, 18, 12);
    const im = new THREE.InstancedMesh(geo, cloudMat, blobs.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
    blobs.forEach((b, i) => { pv.set(b[0], b[1], b[2]); sv.set(b[3], b[3] * b[4], b[3]); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); });
    im.frustumCulled = false; scene.add(im);
  }
  function farMat(hex, haze, map) {
    return new THREE.ShaderMaterial({
      uniforms: Object.assign({}, SU, { uCol: { value: new THREE.Color(hex) }, uHaze: { value: haze }, uMap: { value: map || null }, uUseMap: { value: map ? 1 : 0 } }), extensions: { derivatives: true },
      vertexShader: `varying vec3 vN; varying vec3 vW; varying vec2 vUv;
        void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform vec3 uCol; uniform float uHaze; uniform sampler2D uMap; uniform float uUseMap; uniform vec2 uRep;
        ${GLSL_SKY}
        varying vec3 vN; varying vec3 vW; varying vec2 vUv;
        void main(){
          vec3 n = normalize(vN);
          float l = dot(n, normalize(uSunDir));
          float lit = smoothstep(0.0, fwidth(l) + 0.01, l);
          vec3 base = uCol;
          if (uUseMap > 0.5) base *= texture2D(uMap, vUv * vec2(5.0, 1.0)).rgb;
          vec3 c = base * mix(0.6, 1.0, lit) * mix(1.0, 0.25, uNight);
          vec3 dir = normalize(vW - cameraPosition);
          vec3 hz = skyBase(normalize(vec3(dir.x, 0.0, dir.z)), 1.0);
          gl_FragColor = vec4(mix(c, hz, uHaze * (1.0 - smoothstep(0.0, 0.6, dir.y) * 0.3)), 1.0);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`
    });
  }
  {
    const E = new THREE.Group(); E.position.copy(ELB); scene.add(E);
    E.userData.ink = false;
    const TR = 150;
    // bark with the carved Harley mural band near the base
    const barkTex = (() => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 2048; const x = c.getContext('2d');
      x.fillStyle = '#8f6a4b'; x.fillRect(0, 0, 1024, 2048);
      for (let i = 0; i < 240; i++) {
        const px = Math.random() * 1024, w = 4 + Math.random() * 20;
        x.fillStyle = Math.random() < 0.55 ? 'rgba(58,36,20,.5)' : 'rgba(186,146,106,.42)';
        x.beginPath(); x.moveTo(px, 0);
        for (let y = 0; y <= 2048; y += 64) x.lineTo(px + Math.sin(y * 0.004 + i) * 16, y);
        for (let y = 2048; y >= 0; y -= 64) x.lineTo(px + w + Math.sin(y * 0.004 + i) * 16, y);
        x.fill();
      }
      const my = 1560;
      x.fillStyle = 'rgba(48,28,14,.7)'; x.fillRect(0, my - 10, 1024, 10); x.fillRect(0, my + 236, 1024, 10);
      x.strokeStyle = 'rgba(42,24,10,.85)'; x.lineWidth = 8; x.lineCap = 'round'; x.lineJoin = 'round';
      for (let k = 0; k < 6; k++) {
        const cx = 85 + k * 170, cy = my + 115;
        x.beginPath();
        if (k % 3 === 0) {           // the sun (Nika)
          x.arc(cx, cy, 40, 0, 6.283);
          for (let r = 0; r < 12; r++) { const a = r * 0.5236; x.moveTo(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52); x.lineTo(cx + Math.cos(a) * 80, cy + Math.sin(a) * 80); }
        } else if (k % 3 === 1) {    // a giant warrior
          x.moveTo(cx + 20, cy - 62); x.arc(cx, cy - 62, 20, 0, 6.283);
          x.moveTo(cx, cy - 40); x.lineTo(cx, cy + 40); x.moveTo(cx - 42, cy - 22); x.lineTo(cx + 42, cy - 8); x.lineTo(cx + 60, cy - 80);
          x.moveTo(cx, cy + 40); x.lineTo(cx - 30, cy + 98); x.moveTo(cx, cy + 40); x.lineTo(cx + 30, cy + 98);
        } else {                     // a longship
          x.moveTo(cx - 72, cy + 30); x.quadraticCurveTo(cx, cy + 78, cx + 72, cy + 30); x.moveTo(cx - 72, cy + 30); x.lineTo(cx - 82, cy - 8);
          x.moveTo(cx + 72, cy + 30); x.lineTo(cx + 84, cy - 10); x.moveTo(cx, cy + 46); x.lineTo(cx, cy - 64); x.rect(cx - 36, cy - 58, 72, 56);
        }
        x.stroke();
      }
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 1); t.anisotropy = maxAniso; return t;
    })();
    const barkM = farMat('#ffffff', 0.22, barkTex), rootM = farMat('#8a6446', 0.24);
    const rockM = farMat('#5f6c84', 0.26), snowM = farMat('#f3f8ff', 0.2), landM = farMat('#6d7768', 0.28);
    const leafA = farMat('#4c9d52', 0.24), leafB = farMat('#6cbf5c', 0.22), leafC = farMat('#3d8248', 0.26);
    const wallM = farMat('#a0714a', 0.24), roofR = farMat('#b3452f', 0.22), roofD = farMat('#5e4938', 0.24), steelM = farMat('#e3ebf5', 0.18), goldM = farMat('#d9a93e', 0.2), gripM = farMat('#5a3a22', 0.24);

    // trunk: gnarled, twisted, ridged
    const tg = new THREE.CylinderGeometry(TR * 0.72, TR * 1.3, 700, 56, 30);
    const tp = tg.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i), a0 = Math.atan2(z, x);
      const a = a0 + y * 0.0016, r = Math.hypot(x, z) * (1 + 0.06 * Math.sin(a0 * 9 + y * 0.01) + 0.035 * Math.sin(a0 * 23 - y * 0.02));
      tp.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
    }
    tg.computeVertexNormals();
    const trunk = new THREE.Mesh(tg, barkM); trunk.position.y = 340; E.add(trunk);
    // flaring roots plunging into the Underworld
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + rnd() * 0.3, len = 230 + rnd() * 110;
      const r = new THREE.Mesh(new THREE.CylinderGeometry(14, 46, len, 10), rootM);
      r.position.set(Math.cos(a) * (TR * 1.15 + len * 0.3), 36, Math.sin(a) * (TR * 1.15 + len * 0.3));
      r.lookAt(E.position.x + Math.cos(a) * 2000, -400, E.position.z + Math.sin(a) * 2000); r.rotateX(Math.PI / 2);
      E.add(r);
    }
    // Underworld landmass + snow-capped mountain range
    const land = new THREE.Mesh(new THREE.CylinderGeometry(330, 470, 40, 48), landM); land.position.y = 2; E.add(land);
    const away = Math.atan2(ELB.z, ELB.x);     // mountains only on the far side of the tree (never between it and the fleet)
    for (let i = 0; i < 34; i++) {
      const a = away + (rnd() - 0.5) * 3.4, d = 230 + rnd() * 330, h = 55 + rnd() * 120, r = h * (0.6 + rnd() * 0.35);
      const g = new THREE.ConeGeometry(r, h, 8, 4);
      const gp = g.attributes.position;
      for (let k = 0; k < gp.count; k++) if (gp.getY(k) < h / 2 - 1) { const j = 1 + (rnd() - 0.5) * 0.25; gp.setX(k, gp.getX(k) * j); gp.setZ(k, gp.getZ(k) * j); }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, rockM); m.position.set(Math.cos(a) * d, h / 2 + 10, Math.sin(a) * d); m.rotation.y = rnd() * 6; E.add(m);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.42, h * 0.42, 8, 1), snowM); cap.position.set(m.position.x, 10 + h - h * 0.21 + 0.5, m.position.z); cap.rotation.y = m.rotation.y; E.add(cap);
    }
    // Sun World: great branches carrying the giants' Viking villages
    const roofShape = new THREE.Shape(); roofShape.moveTo(-9, 0); roofShape.lineTo(0, 11); roofShape.lineTo(9, 0); roofShape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 30, bevelEnabled: false }); roofGeo.translate(0, 0, -15);
    const wallGeo = new THREE.BoxGeometry(16, 11, 28);
    function longhouse(p, yaw, big) {
      const h = new THREE.Group();
      const w = new THREE.Mesh(wallGeo, wallM); w.position.y = 5.5; h.add(w);
      const r = new THREE.Mesh(roofGeo, rnd() < 0.6 ? roofR : roofD); r.position.y = 11; r.scale.set(1.08, 1, 1.04); h.add(r);
      h.position.copy(p); h.rotation.y = yaw; h.scale.setScalar(big ? 1.6 : 1); E.add(h);
    }
    function sword(p, tiltX, tiltZ, s) {
      const g = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(12, 170, 3), steelM); blade.position.y = 60; g.add(blade);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(8.5, 22, 4), steelM); tip.rotation.y = Math.PI / 4; tip.scale.z = 0.35; tip.position.y = -36; tip.rotation.x = Math.PI; g.add(tip);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(46, 7, 9), goldM); guard.position.y = 147; g.add(guard);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 34, 10), gripM); grip.position.y = 168; g.add(grip);
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 10), goldM); pommel.position.y = 188; g.add(pommel);
      g.position.copy(p); g.rotation.set(tiltX, rnd() * 6, tiltZ); g.scale.setScalar(s); E.add(g);
    }
    const tmpV = new THREE.Vector3();
    const branchDirs = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rnd() * 0.35, len = 300 + rnd() * 160, y0 = 300 + rnd() * 70, rise = 0.12 + rnd() * 0.12;
      const dir = new THREE.Vector3(Math.cos(a), rise, Math.sin(a)).normalize();
      const start = new THREE.Vector3(Math.cos(a) * TR * 0.8, y0, Math.sin(a) * TR * 0.8);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(12, 40, len, 14, 4), rootM);
      b.position.copy(start).addScaledVector(dir, len / 2);
      b.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);   // thick end at the trunk
      E.add(b);
      branchDirs.push({ a, dir, start, len });
      // village along the top of the branch
      const n = 3 + ((rnd() * 4) | 0);
      for (let k = 0; k < n; k++) {
        const f = 0.3 + (k / n) * 0.55, rad = 40 - 28 * f;
        tmpV.copy(start).addScaledVector(dir, len * f); tmpV.y += rad * 0.85;
        longhouse(tmpV.clone(), -a + Math.PI / 2 + (rnd() - 0.5) * 0.3, k === 0);
      }
      // leafy crowns at the branch tips
      const tip = start.clone().addScaledVector(dir, len);
      for (let k = 0; k < 5; k++) {
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(45 + rnd() * 45, 2), [leafA, leafB, leafC][k % 3]);
        c.position.set(tip.x + (rnd() - 0.5) * 110, tip.y + 20 + rnd() * 60, tip.z + (rnd() - 0.5) * 110); c.scale.y = 0.7; E.add(c);
      }
    }
    // enormous swords driven into the tree
    sword(new THREE.Vector3(TR * 0.95, 430, 30), 0.18, -0.35, 1.25);
    sword(new THREE.Vector3(-TR * 0.6, 470, TR * 0.7), -0.2, 0.28, 1.1);
    sword(branchDirs[2].start.clone().addScaledVector(branchDirs[2].dir, branchDirs[2].len * 0.2).add(new THREE.Vector3(0, 40, 0)), 0.1, 0.22, 0.9);
    sword(new THREE.Vector3(TR * 0.2, 820, -TR * 0.5), 0.25, -0.15, 1.6);
    // Heaven World: the canopy above the clouds
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4, len = 260;
      const dir = new THREE.Vector3(Math.cos(a), 0.45, Math.sin(a)).normalize();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(8, 30, len, 10), rootM);
      b.position.set(0, 640, 0).addScaledVector(dir, len / 2); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); E.add(b);
    }
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * 380, r = 80 + rnd() * 100;
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), [leafA, leafB, leafC][i % 3]);
      c.position.set(Math.cos(a) * d, 760 + rnd() * 150 - d * 0.2, Math.sin(a) * d); c.scale.y = 0.68; E.add(c);
    }
    // waterfalls pouring from the roots
    const fallMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: Object.assign({}, SU, { uWater: oceanUniforms.uScatter, uFoamC: oceanUniforms.uFoam }),
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform vec3 uWater; uniform vec3 uFoamC;
        ${GLSL_NOISE}
        ${GLSL_SKY}
        uniform float uTime; varying vec2 vUv; varying vec3 vW;
        void main(){
          float n = vnoise(vec2(vUv.x * 18.0, vUv.y * 5.0 + uTime * 1.8)) * 0.65 + vnoise(vec2(vUv.x * 40.0, vUv.y * 11.0 + uTime * 2.6)) * 0.35;
          float st = smoothstep(0.46, 0.52, n);
          vec3 c = mix(mix(uWater, uFoamC, 0.35), uFoamC, st * 0.85 + (1.0 - vUv.y) * 0.35);
          vec3 dir = normalize(vW - cameraPosition);
          c = mix(c, skyBase(normalize(vec3(dir.x, 0.0, dir.z)), 1.0), 0.25);
          float a = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(1.0, 0.94, vUv.y);
          gl_FragColor = vec4(c, a * 0.95);
          #include <encodings_fragment>
        }`
    });
    for (const a of FALL_ANGLES) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(30, 240, 1, 1), fallMat);
      f.position.set(Math.cos(a) * (TR * 1.28), 150, Math.sin(a) * (TR * 1.28));
      f.lookAt(E.position.x + Math.cos(a) * 3000, 150, E.position.z + Math.sin(a) * 3000);
      E.add(f);
    }
    mergeStatic(E);
  }


  // merge every static Elbaph mesh that shares a material into one draw call (hundreds → ~15)
  function mergeStatic(root) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), byMat = new Map(), kill = [];
    root.traverse(o => {
      if (!o.isMesh || o.material.transparent || Array.isArray(o.material)) return;
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if (!byMat.has(o.material)) byMat.set(o.material, []);
      byMat.get(o.material).push(g); kill.push(o);
    });
    kill.forEach(o => o.parent.remove(o));
    for (const [mat, gs] of byMat) {
      let n = 0; gs.forEach(g => n += g.attributes.position.count);
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let off = 0;
      for (const g of gs) {
        pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3); uv.set(g.attributes.uv.array, off * 2);
        off += g.attributes.position.count; g.dispose();
      }
      const mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const m = new THREE.Mesh(mg, mat); m.frustumCulled = false; root.add(m);
    }
  }

  /* ---------- Giant Warrior Pirates: Viking longships of Elbaph ---------- */
  const giants = [];
  // an Elbaph giant warrior: horned helmet, braided beard, fur cloak
  function giantWarrior(P, x, z, tunic, beard, pose) {
    const G = new THREE.Group(); G.position.set(x, 0, z); P.add(G);
    for (const sz of [-0.13, 0.13]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.62, 10), M.brown); leg.position.set(0, 0.31, sz); G.add(leg); }
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.78, 14), tunic); torso.position.y = 1.0; torso.scale.z = 1.15; G.add(torso);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.09, 14), M.brown); belt.position.y = 0.72; belt.scale.z = 1.15; G.add(belt);
    const cloak = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 18), M.fur); cloak.rotation.x = Math.PI / 2; cloak.position.y = 1.36; cloak.scale.set(1, 1.2, 1); G.add(cloak);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), M.skin); head.position.y = 1.62; G.add(head);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), M.skin); nose.rotation.z = -Math.PI / 2; nose.position.set(0.2, 1.62, 0); G.add(nose);
    const bd = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 12), beard); bd.rotation.z = Math.PI + 0.25; bd.position.set(0.12, 1.36, 0); G.add(bd);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.215, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.iron); helm.position.y = 1.66; G.add(helm);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.03, 6, 20), M.vikingBand); rim.rotation.x = Math.PI / 2; rim.position.y = 1.66; G.add(rim);
    for (const sz of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 8), M.horn); horn.position.set(0, 1.86, sz * 0.24); horn.rotation.x = -sz * 0.9; G.add(horn);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.62, 8), M.skin);
      const up = pose === 'point' && sz > 0;
      arm.position.set(up ? 0.22 : 0.02, up ? 1.45 : 1.05, sz * 0.36); arm.rotation.z = up ? -1.3 : 0.15; arm.rotation.x = sz * 0.12; G.add(arm);
    }
    if (pose === 'axe') {
      const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), M.mast); haft.position.set(0.15, 1.2, -0.42); haft.rotation.z = -0.35; G.add(haft);
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16, 1, false, 0, Math.PI), M.iron); blade.rotation.x = Math.PI / 2; blade.position.set(0.36, 1.78, -0.42); G.add(blade);
    }
    return G;
  }
  function vikingShip(scale) {
    const g = new THREE.Group(), P = new THREE.Group(); g.add(P);
    const L = 5.4, Wd = 1.25;
    const sheer = (x) => Math.pow(Math.abs(x) / L, 5) * 1.8;
    buildHull(P, { L, W: Wd, depth: 1.5, sheer, hullMat: M.vikingHull, rail: 'wall', railMat: M.vikingHull, railH: 0.3, bands: [{ mat: M.vikingBand, y: -0.1, h: 0.14, k: 1.01, follow: true }] });
    // high curling stem (dragon) and stern posts
    const stem = new THREE.CatmullRomCurve3([new THREE.Vector3(4.9, 1.5, 0), new THREE.Vector3(5.6, 2.5, 0), new THREE.Vector3(5.7, 3.4, 0), new THREE.Vector3(5.3, 3.8, 0)]);
    P.add(new THREE.Mesh(new THREE.TubeGeometry(stem, 20, 0.16, 10), M.vikingHull));
    const head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), M.dragon); skull.scale.set(1.3, 0.9, 0.8); head.add(skull);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 10), M.dragon); snout.rotation.z = -Math.PI / 2; snout.position.x = 0.45; head.add(snout);
    for (const z of [-0.14, 0.14]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.45, 8), M.horn); horn.position.set(-0.2, 0.3, z); horn.rotation.z = 0.6; head.add(horn); }
    head.position.set(5.45, 3.95, 0); P.add(head);
    const stern = new THREE.CatmullRomCurve3([new THREE.Vector3(-4.9, 1.5, 0), new THREE.Vector3(-5.6, 2.4, 0), new THREE.Vector3(-5.5, 3.2, 0), new THREE.Vector3(-5.0, 3.3, 0)]);
    P.add(new THREE.Mesh(new THREE.TubeGeometry(stern, 20, 0.14, 10), M.vikingHull));
    // round shields along both gunwales
    const shieldCols = [M.shieldR, M.shieldY, M.shieldB, M.white];
    for (let i = 0; i < 9; i++) {
      const x = -3.6 + i * 0.9, hw = hullHalfWidth(L, Wd, x) * 0.99 + 0.05;
      for (const s of [-1, 1]) {
        const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 20), shieldCols[(i + (s > 0 ? 0 : 2)) % 4]);
        sh.rotation.x = Math.PI / 2; sh.position.set(x, 0.28 + sheer(x), s * hw); P.add(sh);
        const boss = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), M.trim); boss.position.set(x, 0.28 + sheer(x), s * (hw + 0.05)); P.add(boss);
        const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), M.mast);
        oar.position.set(x + 0.45, -0.25, s * (hw + 0.8)); oar.rotation.x = s * 1.05; P.add(oar);
      }
    }
    // mast, yard and the striped square sail
    mastWithSail(P, 0.2, 6.2, 4.2, 3.0, 3.9, SAIL_TEX.viking, 0.13);
    rope(P, [0.2, 6.0, 0], [5.3, 3.6, 0]); rope(P, [0.2, 6.0, 0], [-5.0, 3.2, 0]);
    for (const z of [-1, 1]) { rope(P, [0.2, 5.6, 0], [-0.6, 0.3, 1.15 * z]); rope(P, [0.2, 5.6, 0], [1.0, 0.3, 1.15 * z]); }
    giantWarrior(P, 3.4, 0, M.tunicR, M.beardO, 'point');
    giantWarrior(P, 1.5, 0.35, M.tunicB, M.beardW, 'axe');
    giantWarrior(P, -1.3, -0.3, M.tunicG, M.beardO);
    giantWarrior(P, -3.7, 0, M.tunicB, M.beardW);   // helmsman
    P.position.y = 0.55;
    g.scale.setScalar(scale); scene.add(g);
    giants.push({ g, ph: rnd() * 6 });
    return g;
  }
  { const v1 = vikingShip(7); v1.position.set(-120, 0, -250); v1.rotation.y = 0.35; }
  { const v2 = vikingShip(8); v2.position.set(-300, 0, -420); v2.rotation.y = -0.2; }


  // --- bow spray: anime foam droplets thrown up where the bows cut the swell ---
  const SPL = isMobile ? 180 : 360;
  const spPos = new Float32Array(SPL * 3), spInfo = new Float32Array(SPL * 2), spVel = new Float32Array(SPL * 3), spLife = new Float32Array(SPL), spMax = new Float32Array(SPL);
  const spG = new THREE.BufferGeometry();
  spG.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  spG.setAttribute('aInfo', new THREE.BufferAttribute(spInfo, 2));
  const sprayMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 400 }, uFoam: { value: new THREE.Color('#ffffff') }, uShade: { value: new THREE.Color('#9fd3ff') } },
    vertexShader: `uniform float uScale; attribute vec2 aInfo; varying float vL;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = aInfo.x * uScale / max(-mv.z, 0.5); vL = aInfo.y; }`,
    fragmentShader: `uniform vec3 uFoam; uniform vec3 uShade; varying float vL;
      void main(){
        if (vL <= 0.0) discard;
        vec2 c = gl_PointCoord - 0.5; float d = length(c);
        if (d > 0.5) discard;
        float sh = smoothstep(0.28, 0.32, length(c + vec2(0.13, 0.13)));
        vec3 col = mix(uFoam, uShade, sh * 0.85);
        float a = smoothstep(0.5, 0.44, d) * min(1.0, vL * 4.0);
        gl_FragColor = vec4(col, a);
        #include <encodings_fragment>
      }`
  });
  const spray = new THREE.Points(spG, sprayMat); spray.frustumCulled = false; scene.add(spray);
  let spIdx = 0;
  const bowL = new THREE.Vector3(), bowPrev = [0, 0];
  function emitSpray(ship, local, n, power) {
    for (let k = 0; k < n; k++) {
      const i = spIdx; spIdx = (spIdx + 1) % SPL;
      const side = Math.random() < 0.5 ? -1 : 1;
      bowL.set(local.x - Math.random() * 1.2, local.y, side * (0.3 + Math.random() * 0.9)); ship.localToWorld(bowL);
      spPos[i * 3] = bowL.x; spPos[i * 3 + 1] = bowL.y; spPos[i * 3 + 2] = bowL.z;
      const s = power * (0.7 + Math.random() * 0.6);
      spVel[i * 3] = -FLOW * 0.8 + (Math.random() - 0.3) * 2.0 * s;
      spVel[i * 3 + 1] = (1.8 + Math.random() * 2.6) * s;
      spVel[i * 3 + 2] = side * (1.5 + Math.random() * 3.0) * s;
      spMax[i] = spLife[i] = 0.6 + Math.random() * 0.6;
      spInfo[i * 2] = 0.12 + Math.random() * 0.26;
    }
  }
  function updateSpray(dt) {
    for (let i = 0; i < SPL; i++) {
      if (spLife[i] <= 0) { spInfo[i * 2 + 1] = 0; continue; }
      spLife[i] -= dt;
      spVel[i * 3 + 1] -= 9.8 * dt;
      spPos[i * 3] += spVel[i * 3] * dt; spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt; spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt;
      if (spPos[i * 3 + 1] < -0.3 && spVel[i * 3 + 1] < 0) spLife[i] = 0;
      spInfo[i * 2 + 1] = Math.max(0, spLife[i] / spMax[i]);
    }
    spG.attributes.position.needsUpdate = true; spG.attributes.aInfo.needsUpdate = true;
  }

  // --- anime wind lines streaking past the fleet ---
  const windMat = (o) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uStart: { value: new THREE.Vector3() }, uLen: { value: 30 }, uT: { value: -1 }, uW: { value: 0.08 }, uAmp: { value: 1 }, uSeed: { value: 0 }, uO: o },
    vertexShader: `uniform vec3 uStart; uniform float uLen; uniform float uW; uniform float uAmp; uniform float uSeed; varying float vU;
      vec3 P(float u){ return uStart + vec3(-u * uLen, sin(u * 5.0 + uSeed) * uAmp, sin(u * 2.6 + uSeed * 2.0) * uAmp * 1.6); }
      void main(){
        float u = uv.x; vec3 p = P(u); vec3 T = normalize(P(u + 0.01) - p);
        vec3 S = normalize(cross(T, normalize(cameraPosition - p)));
        p += S * (uv.y - 0.5) * uW * (0.4 + 0.6 * sin(u * 3.14159));
        vU = u; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform float uT; uniform float uO; varying float vU;
      void main(){
        float a = smoothstep(uT - 0.45, uT - 0.12, vU) * smoothstep(uT, uT - 0.04, vU);
        gl_FragColor = vec4(1.0, 1.0, 1.0, a * uO);
        #include <encodings_fragment>
      }`
  });
  const windO = { value: 0.55 };
  const winds = [];
  for (let i = 0; i < (isMobile ? 7 : 12); i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 48, 1), windMat(windO));
    m.frustumCulled = false; scene.add(m);
    winds.push({ m, t: -Math.random() * 3, dur: 2.4 + Math.random() * 1.6 });
  }
  function resetWind(w) {
    const u = w.m.material.uniforms;
    u.uStart.value.set(26 + Math.random() * 22, 3 + Math.random() * 18, -22 + Math.random() * 44);
    u.uLen.value = 26 + Math.random() * 26; u.uW.value = 0.05 + Math.random() * 0.07;
    u.uAmp.value = 0.4 + Math.random() * 1.2; u.uSeed.value = Math.random() * 20;
    w.t = 0; w.dur = 2.2 + Math.random() * 1.8;
  }
  function updateWind(dt, boost) {
    for (const w of winds) {
      w.t += dt * (1 + boost * 1.5);
      if (w.t < 0) { w.m.material.uniforms.uT.value = -1; continue; }
      const k = w.t / w.dur;
      if (k > 1.5) { resetWind(w); w.t = -Math.random() * 2.5; continue; }
      w.m.material.uniforms.uT.value = k;
    }
  }

  // --- ink outlines (inverted hull, constant pixel width, fades with fog) ---
  const OUT_PX = { value: 0.002 };
  function smoothOutNormals(g) {
    if (g.attributes.aOut || !g.attributes.normal) return;
    const p = g.attributes.position, n = g.attributes.normal, acc = new Map(), keys = new Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const k = Math.round(p.getX(i) * 500) + ',' + Math.round(p.getY(i) * 500) + ',' + Math.round(p.getZ(i) * 500);
      keys[i] = k; const a = acc.get(k) || [0, 0, 0];
      a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); acc.set(k, a);
    }
    const out = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const a = acc.get(keys[i]); const l = Math.hypot(a[0], a[1], a[2]) || 1; out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l; }
    g.setAttribute('aOut', new THREE.BufferAttribute(out, 3));
  }
  const inkMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uPx: OUT_PX, uCol: { value: new THREE.Color('#2a1a14') }, uFogCol: { value: scene.fog.color }, uFog: { value: new THREE.Vector2(scene.fog.near, scene.fog.far) } },
    vertexShader: `attribute vec3 aOut; uniform float uPx; varying float vD;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * aOut);
        mv.xyz += n * uPx * max(-mv.z, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform vec3 uFogCol; uniform vec2 uFog; varying float vD;
      void main(){ gl_FragColor = vec4(mix(uCol, uFogCol, smoothstep(uFog.x, uFog.y, vD)), 1.0);
        #include <encodings_fragment>
      }`
  });
  function inkOutline(root) {
    const list = [];
    root.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.ink === false) return;
      const g = o.geometry, t = g.type;
      if (t === 'PlaneGeometry' || t === 'CircleGeometry') return;
      if (o.material === M.rope || (o.material && o.material.isShaderMaterial)) return;
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (g.boundingSphere.radius < 0.09) return;
      list.push(o);
    });
    for (const o of list) {
      smoothOutNormals(o.geometry);
      const ol = new THREE.Mesh(o.geometry, inkMat); ol.castShadow = false; ol.receiveShadow = false; ol.userData.ink = false;
      o.add(ol);
    }
  }
  // (ships are physically shaded now — no cartoon ink outlines)

  /* ======================= PALETTE BLENDING ======================= */
  const cur = {};
  COLOR_KEYS.forEach(k => cur[k] = PAL.day[k].clone());
  const curSunDir = PAL.day.sunDir.clone();
  let nightTarget = 0, nightMix = 0;
  function applyPalette(m) {
    const D = PAL.day, N = PAL.night;
    COLOR_KEYS.forEach(k => cur[k].copy(D[k]).lerp(N[k], m));
    const n = {}; NUM_KEYS.forEach(k => n[k] = D[k] + (N[k] - D[k]) * m);
    curSunDir.copy(D.sunDir).lerp(N.sunDir, m).normalize();
    SU.uZenith.value.copy(cur.zenith); SU.uHorizon.value.copy(cur.horizon); SU.uGlow.value.copy(cur.glow);
    SU.uSunCol.value.copy(cur.sun); SU.uSunI.value = n.sunI; SU.uSunDir.value.copy(curSunDir);
    SU.uCloudLit.value.copy(cur.cloudLit); SU.uCloudDark.value.copy(cur.cloudDark); SU.uCloudCover.value = n.cloudCover;
    SU.uNight.value = m;
    oceanUniforms.uDeep.value.copy(cur.deep); oceanUniforms.uScatter.value.copy(cur.scatter); oceanUniforms.uFoam.value.copy(cur.foam);
    oceanUniforms.uSpecK.value = 1 - m * 0.45;
    sunLight.color.copy(cur.light); sunLight.intensity = n.lightI;
    hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGround); hemi.intensity = n.hemiI;
    fill.intensity = n.fillI;
    scene.fog.color.copy(cur.horizon);
    renderer.toneMappingExposure = n.exposure;
    PBR_MATS.forEach(mat => { mat.envMapIntensity = n.envI; });
    lanterns.forEach(l => l.intensity = n.lantern);
    glowSprites.forEach(s => s.material.opacity = Math.min(1, n.lantern / 3.2) * 0.9 + 0.05);
    M.lantern.emissiveIntensity = 0.5 + m * 3; M.window.emissiveIntensity = 0.4 + m * 2.2;
    motesMat.uniforms.uColor.value.copy(cur.motes); motesMat.uniforms.uOpacity.value = n.motesO;
    sprayMat.uniforms.uFoam.value.copy(cur.foam); sprayMat.uniforms.uShade.value.copy(cur.scatter).lerp(cur.foam, 0.45);
    windO.value = 0.55 - m * 0.33;
    inkMat.uniforms.uCol.value.set(m > 0.5 ? '#070b18' : '#2a1a14');
    envDirty = true;
  }
  applyPalette(0);
  API.setNight = (on) => { nightTarget = on ? 1 : 0; };

  /* ======================= CAMERA ======================= */
  const KEYS = [
    { p: [14.5, 3.0, 18], t: [1.2, 6.4, 0] },      // hero: low three-quarter bow view (ship towers overhead)
    { p: [-4, 9.5, 30], t: [-4, 5.0, -4] },        // about: broadside, Merry in the background
    { p: [-30, 11, 14], t: [-6, 5.0, -4] },        // skills: stern quarter between both ships
    { p: [-16, 30, -26], t: [-6, 2.5, -4] },       // projects: high aerial over the fleet
    { p: [20, 7.5, -26], t: [1.5, 5.5, 0] },       // education: far side
    { p: [34, 8.5, 11], t: [3, 5.0, 0] }           // contact: ahead of the bow
  ].map(k => ({ p: new THREE.Vector3(...k.p), t: new THREE.Vector3(...k.t) }));
  const posCurve = new THREE.CatmullRomCurve3(KEYS.map(k => k.p), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(KEYS.map(k => k.t), false, 'centripetal');
  const INTRO_FROM = { p: new THREE.Vector3(70, 44, 120), t: new THREE.Vector3(-6, 8, 0) };

  let scrollU = 0, smoothU = 0;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0, moved: false, speed: 0, wind: 0, lx: 0, ly: 0, lt: 0, click: false };
  API.setScroll = (u) => { scrollU = Math.max(0, Math.min(1, u)); };
  window.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      const now = performance.now(), d = Math.hypot(e.clientX - mouse.lx, e.clientY - mouse.ly);
      const dtm = Math.max(8, now - mouse.lt);
      mouse.speed = Math.max(mouse.speed, Math.min(1, (d / dtm) / 2.5));
      mouse.lx = e.clientX; mouse.ly = e.clientY; mouse.lt = now; mouse.moved = true;
    }
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    mouse.click = true;
  }, { passive: true });

  /* cursor → water ripples (ray cast onto the sea plane) */
  const RIP = oceanUniforms.uRip.value; let ripIdx = 0, ripLastT = -1;
  const ripLast = new THREE.Vector2(1e5, 1e5), rayC = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function emitRipple(t, strength) {
    ndc.set(mouse.x, -mouse.y);
    rayC.setFromCamera(ndc, camera);
    const o = rayC.ray.origin, d = rayC.ray.direction;
    if (d.y > -0.02) return;
    const k = -o.y / d.y; if (k > 260) return;
    const x = o.x + d.x * k, z = o.z + d.z * k;
    if (strength < 1 && Math.hypot(x - ripLast.x, z - ripLast.y) < 0.6 + k * 0.035) return;
    ripLast.set(x, z); ripLastT = t;
    RIP[ripIdx].set(x, z, t, strength); ripIdx = (ripIdx + 1) % RIP.length;
  }

  let introStart = -1, introDone = reduceMotion;
  API.intro = () => { if (introStart < 0 && !introDone) introStart = clock.elapsedTime; };

  let W = window.innerWidth, H = window.innerHeight;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H);
    camera.aspect = W / H; camera.fov = W < 700 ? 60 : 48; camera.updateProjectionMatrix();
    const tf = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    OUT_PX.value = (W < 700 ? 1.25 : 1.6) * tf / H;
    sprayMat.uniforms.uScale.value = H * renderer.getPixelRatio() / tf;
  }
  window.addEventListener('resize', resize); resize();

  /* ======================= ADAPTIVE QUALITY ======================= */
  const perf = { frames: 0, time: 0, checks: 0 };
  function adapt(dt) {
    if (!introDone || perf.checks > 6) return;
    perf.frames++; perf.time += dt;
    if (perf.time < 1.5) return;
    const fps = perf.frames / perf.time; perf.frames = 0; perf.time = 0; perf.checks++;
    if (fps < 40 && DPR > MIN_DPR) { DPR = Math.max(MIN_DPR, DPR - 0.25); renderer.setPixelRatio(DPR); motesMat.uniforms.uPR.value = DPR; resize(); }
    else if (fps < 24 && renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; scene.traverse(o => { if (o.material && o.material.isMaterial) o.material.needsUpdate = true; }); }
  }

  /* ======================= LOOP ======================= */
  const clock = new THREE.Clock();
  const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3(), camP = new THREE.Vector3(), camT = new THREE.Vector3();
  const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  let first = true, flagPhase = 0;

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    SU.uTime.value = t;

    if (Math.abs(nightMix - nightTarget) > 0.0005) {
      nightMix = damp(nightMix, nightTarget, 2.0, dt);
      if (Math.abs(nightMix - nightTarget) < 0.002) nightMix = nightTarget;
      applyPalette(nightMix);
    }
    // sky reflections on the ships (rebuilt only when the sky changes, throttled)
    if (envDirty && t - envLast > 0.8) { updateEnv(); envLast = t; }

    // cursor wind: fast mouse movement fills the sails and snaps the flags
    mouse.wind = damp(mouse.wind, mouse.speed, 3.0, dt); mouse.speed *= Math.exp(-dt * 2.2);
    mouse.sx = damp(mouse.sx, mouse.x, 2.2, dt); mouse.sy = damp(mouse.sy, mouse.y, 2.2, dt);

    // Merry weaves gently through the Sunny's wake
    merry.position.x = MERRY_HOME.x + Math.sin(t * 0.07) * 2.5;
    merry.position.z = MERRY_HOME.z + Math.sin(t * 0.05 + 1.0) * 2.0;

    for (const gs of giants) {
      const g = gs.g, hx = waveHeight(g.position.x, g.position.z, t);
      g.position.y = damp(g.position.y, hx * 0.6, 2, dt);
      g.rotation.z = Math.sin(t * 0.45 + gs.ph) * 0.02; g.rotation.x = Math.sin(t * 0.37 + gs.ph * 2) * 0.015;
    }
    // buoyancy for both ships (sampled across hull length & beam)
    for (const s of ships) {
      const g = s.g, x = g.position.x, z = g.position.z, L = s.halfL * 0.87, B = s.halfW;
      const hc = waveHeight(x, z, t), hb = waveHeight(x + L, z, t), hs = waveHeight(x - L, z, t);
      const hp = waveHeight(x, z + B, t), hsb = waveHeight(x, z - B, t);
      g.position.y = damp(g.position.y, hc * s.sink, 3.5, dt);
      g.rotation.z = damp(g.rotation.z, Math.atan2(hb - hs, 2 * L) * 0.9, 2.5, dt);
      g.rotation.x = damp(g.rotation.x, -Math.atan2(hp - hsb, 2 * B) * 0.9 + (s.g === sunny ? mouse.sy * 0.018 : 0), 2.5, dt);
    }
    // the Sunny turns its bow slightly toward the cursor; the Merry answers a beat later
    sunny.rotation.y = Math.sin(t * 0.17) * 0.035 - mouse.sx * 0.11;
    merry.rotation.y = Math.sin(t * 0.13 + 2.0) * 0.05 - Math.sin(t * 0.07) * 0.06 - mouse.sx * 0.05;
    oceanUniforms.uShipA.value.set(sunny.position.x, sunny.position.z, ships[0].halfL, ships[0].halfW);
    oceanUniforms.uShipB.value.set(merry.position.x, merry.position.z, ships[1].halfL, ships[1].halfW);

    // sails billow (stronger in cursor wind) + flags
    const wind = mouse.wind;
    for (const s of sailMeshes) {
      const pos = s.mesh.geometry.attributes.position;
      const amp = s.k * (0.55 + wind * 0.35);
      for (let i = 0; i < pos.count; i++) {
        const u = s.base[i * 3] / (s.w / 2), v = s.base[i * 3 + 1] / (s.h / 2);
        const bulge = (1 - u * u) * (1 - 0.3 * v * v) * (amp + (0.07 + wind * 0.08) * Math.sin(t * (1.4 + wind * 2) + v * 2.2 + s.phase) + 0.03 * Math.sin(t * 3.1 + u * 4));
        pos.setZ(i, bulge);
      }
      pos.needsUpdate = true; s.mesh.geometry.computeVertexNormals();
    }
    flagPhase += dt * (6.5 + wind * 7);
    for (const f of flags) {
      const pos = f.mesh.geometry.attributes.position, fb = f.base;
      for (let i = 0; i < pos.count; i++) { const x = fb[i * 3], y = fb[i * 3 + 1]; pos.setZ(i, (Math.sin(x * 3.2 - flagPhase) * (0.12 + wind * 0.08) + Math.sin(x * 5 + y * 2 - flagPhase * 1.4) * 0.04) * x); }
      pos.needsUpdate = true; f.mesh.geometry.computeVertexNormals();
    }
    // bow spray: continuous + bursts when a bow plunges into a swell
    {
      const sb = waveHeight(sunny.position.x + ships[0].halfL, sunny.position.z, t), mb = waveHeight(merry.position.x + ships[1].halfL, merry.position.z, t);
      const dS = (bowPrev[0] - sb) / Math.max(dt, 1e-3), dM = (bowPrev[1] - mb) / Math.max(dt, 1e-3);
      bowPrev[0] = sb; bowPrev[1] = mb;
      if (!reduceMotion) {
        const rS = (14 + Math.min(2, Math.max(0, dS)) * 40) * dt, rM = (8 + Math.min(2, Math.max(0, dM)) * 25) * dt;
        emitSpray(sunny, SUNNY_BOW, Math.min(3, Math.floor(rS) + (Math.random() < rS % 1 ? 1 : 0)), Math.min(1.35, 1 + Math.max(0, dS) * 0.3));
        emitSpray(merry, MERRY_BOW, Math.min(2, Math.floor(rM) + (Math.random() < rM % 1 ? 1 : 0)), Math.min(1.1, 0.8 + Math.max(0, dM) * 0.25));
      }
      updateSpray(dt);
      updateWind(dt, mouse.wind);
    }
    for (const g of gulls) {
      const u = g.userData, a = t * u.s + u.o;
      g.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 0.7 + u.o) * 1.0, Math.sin(a) * u.r);
      g.rotation.set(0, -a, Math.sin(t * 0.7 + u.o) * 0.25);
      const f = Math.sin(t * 6 + u.o) * 0.55; u.wl.rotation.z = f; u.wr.rotation.z = -f;
    }

    // camera
    smoothU = first ? scrollU : damp(smoothU, scrollU, 3.2, dt);
    posCurve.getPoint(smoothU, tmpP); tgtCurve.getPoint(smoothU, tmpT);
    const narrow = W < 900;
    if (narrow) tmpP.sub(tmpT).multiplyScalar(1.85).add(tmpT);
    // idle drift ("breathing" camera) + mouse parallax
    tmpP.x += Math.sin(t * 0.21) * 0.6 + mouse.sx * 2.4;
    tmpP.y += Math.sin(t * 0.33) * 0.3 - mouse.sy * 1.2;
    tmpP.z += Math.cos(t * 0.17) * 0.5;
    if (!introDone) {
      const k = introStart < 0 ? 0 : Math.min(1, (t - introStart) / 3.6);
      const e = ease(k);
      camP.copy(INTRO_FROM.p).lerp(tmpP, e); camT.copy(INTRO_FROM.t).lerp(tmpT, e);
      if (k >= 1) introDone = true;
    } else { camP.copy(tmpP); camT.copy(tmpT); }
    camP.y = Math.max(camP.y, 2.0 + waveHeight(camP.x, camP.z, t));
    camera.position.copy(camP);
    camera.lookAt(camT);
    camera.rotateZ(ship.rotation.z * 0.12);   // subtle roll with the swell

    const heroFactor = Math.max(0, 1 - smoothU * 5);
    if (!narrow && heroFactor > 0.001) camera.setViewOffset(W, H, -W * 0.2 * heroFactor, 0, W, H);
    else if (narrow && heroFactor > 0.001) camera.setViewOffset(W, H, 0, -H * 0.32 * heroFactor, W, H);
    else camera.clearViewOffset();

    sky.position.copy(camera.position);
    sunLight.position.copy(ship.position).addScaledVector(curSunDir.y < 0.25 ? tmpT.set(curSunDir.x, 0.45, curSunDir.z).normalize() : curSunDir, 60);

    // ripples need the final camera matrices
    camera.updateMatrixWorld();
    if (mouse.click) { mouse.click = false; emitRipple(t, 2.0); }
    else if (mouse.moved && !reduceMotion && t - ripLastT > 0.07) { mouse.moved = false; emitRipple(t, 0.55 + Math.min(0.5, mouse.wind)); }

    API._debug.cam = camera;
    renderer.render(scene, camera);
    adapt(dt);
    if (first) { first = false; API.ready = true; if (API.onReady) API.onReady(); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
