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
