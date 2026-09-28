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
