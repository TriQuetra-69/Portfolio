/* =====================================================================
   3D SCENE: Grand Line ocean + Straw Hat ship (Three.js r149)
   ===================================================================== */
(function () {
  'use strict';
  const canvas = document.getElementById('scene');
  const API = { ready: false, setNight() {}, onProgress: null };
  window.SEA = API;

  if (typeof THREE === 'undefined') { fail(); return; }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { fail(); return; }

  function fail() {
    document.body.classList.add('no-webgl');
    if (canvas) canvas.style.display = 'none';
    API.ready = true;
  }

  const isMobile = matchMedia('(max-width: 900px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(14, 5, 18);

  /* ---------------- PALETTES (day = golden sunset, night) ---------------- */
  const C = (h) => new THREE.Color(h);
  const PAL = {
    day: {
      zenith: C('#2a4d8f'), horizon: C('#ffb27a'), fog: C('#f3b48a'), sun: C('#fff0c8'),
      sunDir: new THREE.Vector3(-0.35, 0.16, -1).normalize(),
      deep: C('#0a3a5e'), shallow: C('#2a86a8'), hemiSky: C('#ffe2c2'), hemiGround: C('#26496e'),
      hemiI: 0.95, dirI: 1.35, dirC: C('#ffd9a8'), stars: 0, lantern: 0.25
    },
    night: {
      zenith: C('#030819'), horizon: C('#1c3160'), fog: C('#132446'), sun: C('#dfe9ff'),
      sunDir: new THREE.Vector3(0.45, 0.28, -1).normalize(),
      deep: C('#020b1a'), shallow: C('#0f3456'), hemiSky: C('#6f88c0'), hemiGround: C('#050d1c'),
      hemiI: 0.45, dirI: 0.55, dirC: C('#bcd0ff'), stars: 1, lantern: 2.6
    }
  };
  const cur = {
    zenith: PAL.day.zenith.clone(), horizon: PAL.day.horizon.clone(), fog: PAL.day.fog.clone(), sun: PAL.day.sun.clone(),
    sunDir: PAL.day.sunDir.clone(), deep: PAL.day.deep.clone(), shallow: PAL.day.shallow.clone(),
    hemiSky: PAL.day.hemiSky.clone(), hemiGround: PAL.day.hemiGround.clone(), dirC: PAL.day.dirC.clone(),
    hemiI: PAL.day.hemiI, dirI: PAL.day.dirI, stars: 0, lantern: PAL.day.lantern
  };
  let nightTarget = 0, nightMix = 0;

  scene.fog = new THREE.Fog(cur.fog, 70, 380);

  /* ---------------- LIGHTS ---------------- */
  const hemi = new THREE.HemisphereLight(cur.hemiSky, cur.hemiGround, cur.hemiI);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(cur.dirC, cur.dirI);
  scene.add(sunLight);

  /* ---------------- SKY ---------------- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uZenith: { value: cur.zenith }, uHorizon: { value: cur.horizon }, uSun: { value: cur.sun },
      uSunDir: { value: cur.sunDir }, uNight: { value: 0 }
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; }`,
    fragmentShader: `
      uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSun; uniform vec3 uSunDir; uniform float uNight;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float y = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(y, 0.55));
        float s = max(dot(d, uSunDir), 0.0);
        float disc = smoothstep(0.9975, 0.9986, s);
        col += uSun * (disc * 1.2 + pow(s, 180.0) * 0.55 + pow(s, 10.0) * mix(0.28, 0.08, uNight));
        if (d.y < 0.0) col = uHorizon;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMat);
  scene.add(sky);

  /* ---------------- STARS ---------------- */
  const starGeo = new THREE.BufferGeometry();
  const starCount = 1400, sp = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.92);
    const r = 520;
    sp[i * 3] = r * Math.sin(ph) * Math.cos(th); sp[i * 3 + 1] = r * Math.cos(ph) + 10; sp[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* ---------------- OCEAN ---------------- */
  // Waves: direction(x,z), amplitude, wavenumber; speeds separately. Shared by shader and JS.
  const WAVES = [
    [1.0, 0.3, 0.34, 0.16, 0.95],
    [-0.45, 1.0, 0.24, 0.25, 1.25],
    [0.7, -0.7, 0.12, 0.52, 1.9],
    [0.2, 0.95, 0.07, 0.95, 2.6]
  ].map(w => { const l = Math.hypot(w[0], w[1]); return [w[0] / l, w[1] / l, w[2], w[3], w[4]]; });

  function waveHeight(x, z, t) {
    let h = 0;
    for (const w of WAVES) h += w[2] * Math.sin((w[0] * x + w[1] * z) * w[3] + t * w[4]);
    return h;
  }

  const oceanMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uW: { value: WAVES.map(w => new THREE.Vector4(w[0], w[1], w[2], w[3])) },
      uS: { value: WAVES.map(w => w[4]) },
      uDeep: { value: cur.deep }, uShallow: { value: cur.shallow }, uSky: { value: cur.horizon },
      uSun: { value: cur.sun }, uSunDir: { value: cur.sunDir }, uFog: { value: cur.fog },
      uFogNear: { value: 60 }, uFogFar: { value: 360 }, uSpec: { value: 1 }
    },
    vertexShader: `
      uniform float uTime; uniform vec4 uW[4]; uniform float uS[4];
      varying vec3 vPos; varying vec3 vN; varying float vH;
      void main(){
        vec3 p = position;
        float h = 0.0, dx = 0.0, dz = 0.0;
        for (int i = 0; i < 4; i++) {
          vec4 w = uW[i];
          float ph = dot(w.xy, p.xz) * w.w + uTime * uS[i];
          h += w.z * sin(ph);
          float c = w.z * w.w * cos(ph);
          dx += c * w.x; dz += c * w.y;
        }
        p.y += h;
        vH = h; vN = normalize(vec3(-dx, 1.0, -dz));
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSun;
      uniform vec3 uSunDir; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; uniform float uSpec;
      varying vec3 vPos; varying vec3 vN; varying float vH;
      void main(){
        vec3 ripple = vec3(
          sin(vPos.x * 1.7 + uTime * 1.3) * 0.045 + sin(vPos.z * 2.6 - uTime * 1.7) * 0.03 + sin((vPos.x+vPos.z) * 4.1 + uTime*2.3)*0.02,
          0.0,
          cos(vPos.z * 1.9 + uTime * 1.5) * 0.045 + cos(vPos.x * 2.9 - uTime) * 0.03 + cos((vPos.x-vPos.z) * 3.7 - uTime*2.1)*0.02);
        vec3 n = normalize(vN + ripple);
        vec3 v = normalize(cameraPosition - vPos);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 base = mix(uDeep, uShallow, clamp(vH * 0.8 + 0.45, 0.0, 1.0));
        float diff = max(dot(n, uSunDir), 0.0);
        vec3 col = base * (0.6 + 0.55 * diff);
        col = mix(col, uSky, clamp(fres * 0.75, 0.0, 1.0));
        vec3 r = reflect(-uSunDir, n);
        float spec = pow(max(dot(r, v), 0.0), 140.0);
        float glitter = pow(max(dot(r, v), 0.0), 18.0) * 0.18;
        col += uSun * (spec * 1.8 + glitter) * uSpec;
        float foam = smoothstep(0.48, 0.72, vH);
        col = mix(col, vec3(0.93, 0.96, 1.0), foam * 0.55);
        float d = length(cameraPosition - vPos);
        col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const oceanGeo = new THREE.PlaneGeometry(900, 900, isMobile ? 160 : 256, isMobile ? 160 : 256);
  oceanGeo.rotateX(-Math.PI / 2);
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  scene.add(ocean);

  /* ---------------- CANVAS TEXTURES ---------------- */
  function drawJollyRoger(ctx, cx, cy, s, onDark) {
    const bone = onDark ? '#f5f1e6' : '#fbf8ef';
    const line = '#141414';
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    ctx.lineWidth = 6; ctx.strokeStyle = line; ctx.lineCap = 'round';
    // crossbones
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      ctx.save(); ctx.rotate(a);
      ctx.fillStyle = bone; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-110, -11, 220, 22, 11) : ctx.rect(-110, -11, 220, 22); ctx.fill(); ctx.stroke();
      for (const x of [-110, 110]) for (const y of [-12, 12]) { ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    }
    // skull
    ctx.fillStyle = bone;
    ctx.beginPath(); ctx.ellipse(0, -10, 62, 58, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-34, 30, 68, 38, 10) : ctx.rect(-34, 30, 68, 38); ctx.fill(); ctx.stroke();
    ctx.fillStyle = line;
    ctx.beginPath(); ctx.ellipse(-24, 2, 15, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(24, 2, 15, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(-7, 34); ctx.lineTo(7, 34); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 4; for (const x of [-16, 0, 16]) { ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, 66); ctx.stroke(); }
    // straw hat
    ctx.lineWidth = 6;
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath(); ctx.ellipse(0, -46, 100, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-58, -46); ctx.quadraticCurveTo(-60, -118, 0, -120); ctx.quadraticCurveTo(60, -118, 58, -46); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d62828';
    ctx.beginPath(); ctx.moveTo(-59, -66); ctx.quadraticCurveTo(0, -54, 59, -66); ctx.lineTo(58, -48); ctx.quadraticCurveTo(0, -36, -58, -48); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function sailTexture(withEmblem) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#fbf6e8'); g.addColorStop(1, '#e8dcc0');
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    x.strokeStyle = 'rgba(120,90,50,.25)'; x.lineWidth = 3;
    for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(i * 512 / 6, 0); x.lineTo(i * 512 / 6, 512); x.stroke(); }
    if (withEmblem) {
      x.fillStyle = '#141414';
      x.beginPath(); x.arc(256, 270, 190, 0, Math.PI * 2); x.fill();
      drawJollyRoger(x, 256, 285, 1.25, true);
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function flagTexture() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 340;
    const x = c.getContext('2d'); x.fillStyle = '#121212'; x.fillRect(0, 0, 512, 340);
    drawJollyRoger(x, 256, 190, 1.05, true);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  function woodTexture(base, dark) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 16) {
      x.fillStyle = dark; x.fillRect(0, i, 256, 2);
      for (let k = 0; k < 18; k++) { x.globalAlpha = 0.12; x.fillRect(Math.random() * 256, i + Math.random() * 14, 30 + Math.random() * 60, 1); }
      x.globalAlpha = 1;
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; return t;
  }

  /* ---------------- SHIP (Thousand Sunny inspired) ---------------- */
  const ship = new THREE.Group();
  const shipInner = new THREE.Group();
  ship.add(shipInner);
  scene.add(ship);

  const hullTex = woodTexture('#8a5a2e', '#5a3615'); hullTex.repeat.set(0.25, 0.6);
  const deckTex = woodTexture('#c89a62', '#8a6236'); deckTex.repeat.set(0.3, 0.3);
  const M = {
    hull: new THREE.MeshStandardMaterial({ map: hullTex, roughness: 0.8, metalness: 0.05 }),
    deck: new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.9 }),
    rail: new THREE.MeshStandardMaterial({ color: '#f1e3c0', roughness: 0.7 }),
    trim: new THREE.MeshStandardMaterial({ color: '#e0a82e', roughness: 0.4, metalness: 0.4 }),
    mast: new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.8 }),
    cabin: new THREE.MeshStandardMaterial({ color: '#f4e6c8', roughness: 0.7 }),
    roof: new THREE.MeshStandardMaterial({ color: '#2e7d4f', roughness: 0.6 }),
    lionMane: new THREE.MeshStandardMaterial({ color: '#f07c1e', roughness: 0.6, flatShading: true }),
    lionFace: new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.5 }),
    black: new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.4 }),
    grass: new THREE.MeshStandardMaterial({ color: '#4caf50', roughness: 1 }),
    red: new THREE.MeshStandardMaterial({ color: '#c62828', roughness: 0.6 })
  };

  // hull outline (top view): x = length (bow at +x), y = width
  function hullShape(scale) {
    const s = new THREE.Shape();
    const L = 5.2 * scale, W = 1.75 * scale;
    s.moveTo(-L, -W * 0.85);
    s.quadraticCurveTo(-L - 0.35 * scale, 0, -L, W * 0.85);
    s.bezierCurveTo(-1.5 * scale, W * 1.08, 2.2 * scale, W * 1.05, L * 0.62, W * 0.62);
    s.quadraticCurveTo(L * 0.92, W * 0.25, L, 0);
    s.quadraticCurveTo(L * 0.92, -W * 0.25, L * 0.62, -W * 0.62);
    s.bezierCurveTo(2.2 * scale, -W * 1.05, -1.5 * scale, -W * 1.08, -L, -W * 0.85);
    return s;
  }
  {
    const depth = 2.3;
    const g = new THREE.ExtrudeGeometry(hullShape(1), { depth, bevelEnabled: false, curveSegments: 18 });
    g.rotateX(Math.PI / 2); // extrude goes down (-y), shape y -> z
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), x = pos.getX(i);
      const t = -y / depth; // 0 top, 1 bottom
      pos.setZ(i, pos.getZ(i) * (1 - 0.62 * t * t));
      pos.setX(i, x * (1 - 0.1 * t) + (x > 0 ? -0.6 * t * t : 0.25 * t));
      // sheer: bow and stern rise
      const sheer = Math.max(0, x - 2.5) * 0.12 + Math.max(0, -x - 3.4) * 0.3;
      if (t < 0.01) pos.setY(i, y + sheer);
    }
    g.computeVertexNormals();
    const hull = new THREE.Mesh(g, [M.deck, M.hull]);
    shipInner.add(hull);

    // gold trim band
    const band = new THREE.ExtrudeGeometry(hullShape(1.012), { depth: 0.16, bevelEnabled: false, curveSegments: 18 });
    band.rotateX(Math.PI / 2); band.translate(0, -0.35, 0);
    const bp = band.attributes.position;
    for (let i = 0; i < bp.count; i++) { const t = 0.35 / depth + (-(bp.getY(i) + 0.35)) / depth; bp.setZ(i, bp.getZ(i) * (1 - 0.62 * t * t)); }
    band.computeVertexNormals();
    shipInner.add(new THREE.Mesh(band, M.trim));

    // railing / bulwark (ring shape)
    const outer = hullShape(1.0); const hole = new THREE.Path(hullShape(0.92).getPoints(60));
    outer.holes.push(hole);
    const rg = new THREE.ExtrudeGeometry(outer, { depth: 0.5, bevelEnabled: false, curveSegments: 18 });
    rg.rotateX(-Math.PI / 2);
    const rp = rg.attributes.position;
    for (let i = 0; i < rp.count; i++) { const x = rp.getX(i); rp.setY(i, rp.getY(i) + Math.max(0, x - 2.5) * 0.12 + Math.max(0, -x - 3.4) * 0.3); }
    rg.computeVertexNormals();
    shipInner.add(new THREE.Mesh(rg, M.rail));
  }

  // grass deck patch (Sunny has a lawn!)
  {
    const lawn = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.06, 28), M.grass);
    lawn.scale.set(1.8, 1, 1); lawn.position.set(0.6, 0.04, 0); shipInner.add(lawn);
  }

  // Stern cabin
  {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.3, 2.4), M.cabin);
    cab.position.set(-3.9, 0.95, 0); shipInner.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 2.7), M.roof);
    roof.position.set(-3.9, 1.68, 0); shipInner.add(roof);
    const winMat = new THREE.MeshStandardMaterial({ color: '#ffcf6b', emissive: '#ff9d2e', emissiveIntensity: 0.4 });
    M.window = winMat;
    for (const z of [-0.6, 0, 0.6]) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), winMat);
      w.position.set(-4.86, 1.0, z); w.rotation.y = -Math.PI / 2; shipInner.add(w);
    }
    for (const z of [-1.21, 1.21]) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), winMat);
      w.position.set(-3.5, 1.0, z); w.rotation.y = z > 0 ? 0 : Math.PI; shipInner.add(w);
    }
  }

  // Masts, yards, sails
  const sailMeshes = [];
  function addMast(x, h, sailW, sailH, sailY, emblem) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, h, 10), M.mast);
    mast.position.set(x, h / 2, 0); shipInner.add(mast);
    for (const yy of [sailY + sailH / 2, sailY - sailH / 2]) {
      const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, sailW + 0.6, 8), M.mast);
      yard.rotation.x = Math.PI / 2; yard.position.set(x + 0.05, yy, 0); shipInner.add(yard);
    }
    const g = new THREE.PlaneGeometry(sailW, sailH, 14, 10);
    const base = g.attributes.position.array.slice();
    const tex = sailTexture(emblem);
    const sail = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
    sail.rotation.y = Math.PI / 2;
    sail.position.set(x + 0.12, sailY, 0);
    shipInner.add(sail);
    sailMeshes.push({ mesh: sail, base, w: sailW, h: sailH });
    return mast;
  }
  addMast(0.9, 7.6, 4.6, 3.6, 4.5, true);   // main mast
  addMast(3.2, 5.0, 2.8, 2.0, 3.25, false); // fore mast

  // crow's nest
  {
    const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.55, 16, 1, true), M.hull);
    nest.material = M.hull; nest.position.set(0.9, 6.9, 0); shipInner.add(nest);
    const nestFloor = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16), M.deck);
    nestFloor.position.set(0.9, 6.65, 0); shipInner.add(nestFloor);
  }

  // Jolly Roger flag on top of main mast
  const flagGeo = new THREE.PlaneGeometry(1.7, 1.1, 12, 6);
  flagGeo.translate(0.85, 0, 0);
  const flagBase = flagGeo.attributes.position.array.slice();
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.set(0.9, 7.9, 0); flag.rotation.y = Math.PI; // streams toward stern
  shipInner.add(flag);
  {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), M.mast);
    pole.position.set(0.9, 7.9, 0); shipInner.add(pole);
  }

  // Bowsprit
  {
    const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 2.6, 8), M.mast);
    bs.rotation.z = -Math.PI / 2 + 0.35; bs.position.set(5.6, 1.05, 0); shipInner.add(bs);
  }

  // Lion figurehead
  {
    const lion = new THREE.Group();
    const mane = new THREE.Group();
    const petals = 14;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 6), M.lionMane);
      cone.position.set(0, Math.sin(a) * 0.72, Math.cos(a) * 0.72);
      cone.rotation.x = -a + Math.PI / 2;
      mane.add(cone);
    }
    const maneDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.3, 20), M.lionMane);
    maneDisc.rotation.z = Math.PI / 2; mane.add(maneDisc);
    lion.add(mane);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 18), M.lionFace);
    face.scale.set(0.8, 1, 1); face.position.x = 0.18; lion.add(face);
    for (const z of [-0.22, 0.22]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.black);
      eye.position.set(0.66, 0.16, z); lion.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), M.lionMane);
    nose.position.set(0.7, -0.04, 0); lion.add(nose);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16, Math.PI), M.black);
    smile.rotation.set(0, Math.PI / 2, Math.PI); smile.position.set(0.66, -0.2, 0); lion.add(smile);
    lion.position.set(5.05, 0.95, 0);
    shipInner.add(lion);
  }

  // Lanterns (glow at night)
  const lanterns = [];
  {
    const lMat = new THREE.MeshStandardMaterial({ color: '#ffcf6b', emissive: '#ffa53a', emissiveIntensity: 0.5 });
    M.lantern = lMat;
    for (const [x, y, z] of [[-4.9, 1.9, 1.1], [-4.9, 1.9, -1.1], [4.1, 1.3, 0]]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), lMat);
      l.position.set(x, y, z); shipInner.add(l);
      const pl = new THREE.PointLight('#ffae4a', 0, 9, 2);
      pl.position.set(x, y, z); shipInner.add(pl); lanterns.push(pl);
    }
  }

  shipInner.position.y = 1.15; // waterline

  /* ---------------- ISLANDS ---------------- */
  function palm(x, z, h) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, h, 6), new THREE.MeshStandardMaterial({ color: '#7a5230', flatShading: true }));
    trunk.position.y = h / 2; trunk.rotation.z = 0.15; g.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({ color: '#2f8f3a', flatShading: true, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 4), leafMat);
      leaf.position.set(Math.sin(0.15) * h * -1 + 0, h, 0);
      leaf.rotation.set(0, (i / 6) * Math.PI * 2, 1.9);
      leaf.translateY(1.1);
      g.add(leaf);
    }
    g.position.set(x, 0, z); return g;
  }
  function island(x, z, s, peaks) {
    const g = new THREE.Group();
    const sand = new THREE.Mesh(new THREE.CylinderGeometry(9 * s, 11 * s, 1.6, 20), new THREE.MeshStandardMaterial({ color: '#e9cf95', flatShading: true }));
    sand.position.y = 0.2; g.add(sand);
    const hillMat = new THREE.MeshStandardMaterial({ color: '#3f8f4a', flatShading: true });
    peaks.forEach(([px, pz, ph, pr]) => {
      const hill = new THREE.Mesh(new THREE.ConeGeometry(pr * s, ph * s, 7), hillMat);
      hill.position.set(px * s, ph * s / 2 + 0.8, pz * s); g.add(hill);
    });
    g.add(palm(5 * s, 3 * s, 4.5 * s)); g.add(palm(-5.5 * s, 2 * s, 3.8 * s));
    g.position.set(x, -0.3, z); scene.add(g); return g;
  }
  island(-95, -150, 1.6, [[0, 0, 16, 7], [4, -2, 10, 5], [-4, 1, 8, 4.5]]);
  island(130, -190, 2.1, [[0, 0, 12, 8], [-5, 1, 7, 5]]);
  island(-190, 60, 1.8, [[0, 0, 14, 7], [3, 3, 9, 5]]);
  // Reverse Mountain-ish spire far away
  {
    const m = new THREE.Mesh(new THREE.ConeGeometry(18, 90, 8), new THREE.MeshStandardMaterial({ color: '#56617a', flatShading: true }));
    m.position.set(40, 40, -330); scene.add(m);
  }

  /* ---------------- CLOUDS ---------------- */
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffd9b8', emissiveIntensity: 0.25, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const n = 4 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + Math.random() * 3.5, 1), cloudMat);
      b.position.set(k * 4 - n * 2, Math.random() * 2.5, (Math.random() - 0.5) * 5);
      b.scale.y = 0.7; g.add(b);
    }
    const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 180;
    g.position.set(Math.cos(a) * r, 38 + Math.random() * 30, Math.sin(a) * r);
    g.userData.speed = 0.6 + Math.random() * 0.8;
    scene.add(g); clouds.push(g);
  }

  /* ---------------- SEAGULLS ---------------- */
  const gulls = [];
  const gullMat = new THREE.MeshStandardMaterial({ color: '#f7f7f7', side: THREE.DoubleSide, roughness: 0.8 });
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const wingGeo = new THREE.PlaneGeometry(0.9, 0.28); wingGeo.translate(0.45, 0, 0);
    const l = new THREE.Mesh(wingGeo, gullMat), r = new THREE.Mesh(wingGeo, gullMat);
    l.rotation.x = r.rotation.x = -Math.PI / 2; r.rotation.y = Math.PI;
    const wl = new THREE.Group(), wr = new THREE.Group(); wl.add(l); wr.add(r);
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 6), gullMat); body.rotation.x = Math.PI / 2;
    g.add(wl, wr, body);
    g.userData = { wl, wr, r: 9 + Math.random() * 9, h: 8 + Math.random() * 5, s: 0.25 + Math.random() * 0.2, o: Math.random() * 6.28 };
    scene.add(g); gulls.push(g);
  }

  /* ---------------- CAMERA PATH (driven by scroll) ---------------- */
  const KEYS = [
    { p: new THREE.Vector3(13, 4.2, 16), t: new THREE.Vector3(0.5, 3.0, 0) },   // hero: 3/4 bow view
    { p: new THREE.Vector3(-4, 7.5, 19), t: new THREE.Vector3(0, 3.0, 0) },     // about: side broadside
    { p: new THREE.Vector3(-17, 9, 6), t: new THREE.Vector3(0, 3.2, 0) },       // skills: stern quarter
    { p: new THREE.Vector3(-9, 18, -15), t: new THREE.Vector3(0, 2, 0) },       // projects: high above
    { p: new THREE.Vector3(12, 5, -16), t: new THREE.Vector3(1, 3.5, 0) },      // education: far side
    { p: new THREE.Vector3(22, 7, 6), t: new THREE.Vector3(2, 3, 0) }           // contact: ahead of bow
  ];
  const posCurve = new THREE.CatmullRomCurve3(KEYS.map(k => k.p), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(KEYS.map(k => k.t), false, 'centripetal');

  let scrollP = 0, smoothP = 0;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  API.setScroll = (p) => { scrollP = Math.max(0, Math.min(1, p)); };
  window.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  API.setNight = (on) => { nightTarget = on ? 1 : 0; };

  let W = window.innerWidth, H = window.innerHeight;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H);
    camera.aspect = W / H;
    camera.fov = W < 700 ? 62 : 50;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------------- ANIMATE ---------------- */
  const clock = new THREE.Clock();
  const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3();
  const lerpC = (dst, a, b, t) => dst.copy(a).lerp(b, t);

  function applyPalette(m) {
    const D = PAL.day, N = PAL.night;
    for (const k of ['zenith', 'horizon', 'fog', 'sun', 'deep', 'shallow', 'hemiSky', 'hemiGround', 'dirC']) lerpC(cur[k], D[k], N[k], m);
    cur.sunDir.copy(D.sunDir).lerp(N.sunDir, m).normalize();
    hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGround);
    hemi.intensity = D.hemiI + (N.hemiI - D.hemiI) * m;
    sunLight.color.copy(cur.dirC); sunLight.intensity = D.dirI + (N.dirI - D.dirI) * m;
    sunLight.position.copy(cur.sunDir).multiplyScalar(100);
    scene.fog.color.copy(cur.fog);
    skyMat.uniforms.uNight.value = m;
    oceanMat.uniforms.uSpec.value = 1 - m * 0.6;
    starMat.opacity = m;
    cloudMat.color.setRGB(1 - m * 0.72, 1 - m * 0.68, 1 - m * 0.55);
    cloudMat.emissiveIntensity = 0.25 * (1 - m);
    const lant = D.lantern + (N.lantern - D.lantern) * m;
    lanterns.forEach(l => l.intensity = lant);
    M.lantern.emissiveIntensity = 0.5 + m * 2.5;
    M.window.emissiveIntensity = 0.4 + m * 1.6;
  }
  applyPalette(0);

  let first = true;
  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // day/night blend
    if (Math.abs(nightMix - nightTarget) > 0.001) {
      nightMix += (nightTarget - nightMix) * Math.min(1, dt * 2.2);
      applyPalette(nightMix);
    }

    oceanMat.uniforms.uTime.value = t;

    // ship bobbing: sample waves at bow/stern/port/starboard
    const hc = waveHeight(0, 0, t);
    const hb = waveHeight(4, 0, t), hs = waveHeight(-4, 0, t);
    const hp = waveHeight(0, 1.6, t), hsb = waveHeight(0, -1.6, t);
    ship.position.y += ((hc * 0.8) - ship.position.y) * Math.min(1, dt * 4);
    ship.rotation.z += (Math.atan2(hb - hs, 8) * 0.9 - ship.rotation.z) * Math.min(1, dt * 3);
    ship.rotation.x += (-Math.atan2(hp - hsb, 3.2) * 0.9 - ship.rotation.x) * Math.min(1, dt * 3);

    // sails billow
    for (const s of sailMeshes) {
      const pos = s.mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = s.base[i * 3], by = s.base[i * 3 + 1];
        const u = bx / (s.w / 2), v = by / (s.h / 2);
        const bulge = (1 - u * u) * (1 - 0.35 * v * v) * (0.55 + 0.08 * Math.sin(t * 1.6 + v * 2));
        pos.setZ(i, bulge);
      }
      pos.needsUpdate = true;
      s.mesh.geometry.computeVertexNormals();
    }
    // flag waves
    {
      const pos = flag.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = flagBase[i * 3];
        pos.setZ(i, Math.sin(x * 3 - t * 6) * 0.12 * x);
      }
      pos.needsUpdate = true; flag.geometry.computeVertexNormals();
    }

    // clouds drift
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 320) c.position.x = -320;
    }
    // gulls circle
    for (const g of gulls) {
      const u = g.userData, a = t * u.s + u.o;
      g.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 0.8 + u.o) * 0.8, Math.sin(a) * u.r);
      g.rotation.y = -a;
      const f = Math.sin(t * 7 + u.o) * 0.5;
      u.wl.rotation.z = f; u.wr.rotation.z = -f;
    }

    // camera: follow scroll with damping + mouse parallax
    smoothP += (scrollP - smoothP) * (first ? 1 : Math.min(1, dt * 2.6));
    mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 2.5);
    mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 2.5);
    posCurve.getPoint(smoothP, tmpP);
    tgtCurve.getPoint(smoothP, tmpT);
    const narrow = W < 900;
    if (narrow) tmpP.multiplyScalar(1.25);
    tmpP.x += mouse.sx * 1.6; tmpP.y += -mouse.sy * 0.9;
    tmpP.y = Math.max(tmpP.y, 2.2);
    camera.position.copy(tmpP);
    camera.lookAt(tmpT);

    // frame the ship on the right half during hero (desktop), centered on narrow screens
    const heroFactor = Math.max(0, 1 - smoothP * 6);
    if (!narrow && heroFactor > 0.001) camera.setViewOffset(W, H, -W * 0.2 * heroFactor, 0, W, H);
    else if (narrow) camera.setViewOffset(W, H, 0, -H * 0.12 * heroFactor, W, H);
    else camera.clearViewOffset();

    sky.position.copy(camera.position);
    stars.position.copy(camera.position);

    renderer.render(scene, camera);
    if (first) { first = false; API.ready = true; if (API.onReady) API.onReady(); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
