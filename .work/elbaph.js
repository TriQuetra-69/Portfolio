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
    const land = new THREE.Mesh(new THREE.CylinderGeometry(430, 600, 46, 48), landM); land.position.y = 4; E.add(land);
    for (let i = 0; i < 34; i++) {
      const a = rnd() * Math.PI * 2, d = 240 + rnd() * 330, h = 70 + rnd() * 170, r = h * (0.55 + rnd() * 0.3);
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
  }

  /* ---------- Giant Warrior Pirates: Viking longships of Elbaph ---------- */
  const giants = [];
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
    P.position.y = 0.55;
    g.scale.setScalar(scale); scene.add(g);
    giants.push({ g, ph: rnd() * 6 });
    return g;
  }
  { const v1 = vikingShip(7); v1.position.set(-150, 0, -240); v1.rotation.y = 0.1; }
  { const v2 = vikingShip(8); v2.position.set(-60, 0, -470); v2.rotation.y = -0.25; }

