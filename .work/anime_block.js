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
  const ELB = new THREE.Vector3(-876, 0, -539);
  for (const [dx, dz, y] of [[-170, 60, 210], [160, 120, 250], [40, -150, 190]]) cumulus(ELB.x + dx, ELB.z + dz, y, 230, 80);
  {
    const geo = new THREE.SphereGeometry(1, 18, 12);
    const im = new THREE.InstancedMesh(geo, cloudMat, blobs.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
    blobs.forEach((b, i) => { pv.set(b[0], b[1], b[2]); sv.set(b[3], b[3] * b[4], b[3]); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); });
    im.frustumCulled = false; scene.add(im);
  }
  function farMat(hex, haze) {
    return new THREE.ShaderMaterial({
      uniforms: Object.assign({}, SU, { uCol: { value: new THREE.Color(hex) }, uHaze: { value: haze } }), extensions: { derivatives: true },
      vertexShader: `varying vec3 vN; varying vec3 vW;
        void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform vec3 uCol; uniform float uHaze;
        ${GLSL_SKY}
        varying vec3 vN; varying vec3 vW;
        void main(){
          vec3 n = normalize(vN);
          float l = dot(n, normalize(uSunDir));
          float lit = smoothstep(0.0, fwidth(l) + 0.01, l);
          vec3 c = uCol * mix(0.6, 1.0, lit) * mix(1.0, 0.25, uNight);
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
    const trunkG = new THREE.CylinderGeometry(52, 95, 520, 32, 12);
    const tp = trunkG.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
      const a = Math.atan2(z, x) + y * 0.0022, r = Math.hypot(x, z) * (1 + 0.09 * Math.sin(Math.atan2(z, x) * 6 + y * 0.012));
      tp.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
    }
    trunkG.computeVertexNormals();
    const trunk = new THREE.Mesh(trunkG, farMat('#9a7456', 0.5)); trunk.position.y = 260; E.add(trunk);
    const isle = new THREE.Mesh(new THREE.CylinderGeometry(150, 290, 60, 30), farMat('#7f8a6c', 0.6)); isle.position.y = 10; E.add(isle);
    const canopyM = farMat('#57a55a', 0.46), branchM = farMat('#8c6a50', 0.5);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3, len = 170 + rnd() * 80;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(9, 22, len, 8), branchM);
      b.position.set(Math.cos(a) * len * 0.35, 470 + rnd() * 40, Math.sin(a) * len * 0.35);
      b.lookAt(E.position.x + Math.cos(a) * 900, 900, E.position.z + Math.sin(a) * 900); b.rotateX(Math.PI / 2);
      E.add(b);
    }
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * 230, r = 70 + rnd() * 80;
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), canopyM);
      c.position.set(Math.cos(a) * d, 540 + rnd() * 110 - d * 0.25, Math.sin(a) * d); c.scale.y = 0.72; E.add(c);
    }
  }

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
      spVel[i * 3 + 1] = (2.5 + Math.random() * 3.5) * s;
      spVel[i * 3 + 2] = side * (1.5 + Math.random() * 3.0) * s;
      spMax[i] = spLife[i] = 0.7 + Math.random() * 0.8;
      spInfo[i * 2] = (0.18 + Math.random() * 0.4) * (power > 1 ? 1.2 : 1);
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
  inkOutline(sunny); inkOutline(merry);
  scene.children.filter(c => c.isGroup && c !== sunny && c !== merry).forEach(inkOutline);

