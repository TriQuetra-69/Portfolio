/* Manga speed lines: flash in from the screen edges on fast scrolls (e.g. nav jumps) */
(function () {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.id = 'speedFx'; cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, lastY = window.scrollY, sT = performance.now(), lastT = performance.now(), energy = 0, running = false, frameN = 0, lines = [];
  function size() { const d = Math.min(window.devicePixelRatio || 1, 1.5); W = window.innerWidth; H = window.innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
  size(); window.addEventListener('resize', size);
  function regen() {
    lines = [];
    const n = W < 700 ? 34 : 60;
    for (let i = 0; i < n; i++) lines.push({ a: Math.random() * Math.PI * 2, w: 0.004 + Math.random() * 0.012, r: 0.55 + Math.random() * 0.3 });
  }
  function frame() {
    const now = performance.now();
    energy *= Math.exp(-(now - lastT) / 1000 * 5); lastT = now;
    ctx.clearRect(0, 0, W, H);
    if (energy > 0.02) {
      if (frameN++ % 3 === 0) regen();          // redraw every few frames: hand-drawn flicker
      const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) * 0.62;
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, energy * 0.5)})`;
      ctx.beginPath();
      for (const l of lines) {
        const r0 = R * (l.r + (1 - Math.min(1, energy)) * 0.25);
        ctx.moveTo(cx + Math.cos(l.a - l.w) * R * 1.3, cy + Math.sin(l.a - l.w) * R * 1.3);
        ctx.lineTo(cx + Math.cos(l.a) * r0, cy + Math.sin(l.a) * r0);
        ctx.lineTo(cx + Math.cos(l.a + l.w) * R * 1.3, cy + Math.sin(l.a + l.w) * R * 1.3);
      }
      ctx.fill();
      requestAnimationFrame(frame);
    } else { running = false; ctx.clearRect(0, 0, W, H); }
  }
  window.addEventListener('scroll', () => {
    const now = performance.now(), y = window.scrollY;
    const v = Math.abs(y - lastY) / Math.max(8, now - sT) * 1000;   // px per second
    lastY = y; sT = now;
    if (v > 2600) { energy = Math.min(1.2, energy + (v - 2600) / 6000); if (!running) { running = true; lastT = now; requestAnimationFrame(frame); } }
  }, { passive: true });
})();

/* =====================================================================
   Cursor FX: gold star burst + shockwave ring on click (no movement trail).
   Runs only on devices with a real mouse; respects reduced-motion.
   ===================================================================== */
(function () {
  'use strict';
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduce) return;

  const cv = document.createElement('canvas');
  cv.id = 'cursorFx'; cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  size(); window.addEventListener('resize', size);

  // pre-rendered sprites (fast): soft glow + 4-point star
  function sprite(draw, s) { const c = document.createElement('canvas'); c.width = c.height = s; draw(c.getContext('2d'), s); return c; }
  const COLORS = ['255,214,102', '255,236,170', '255,178,64', '255,110,80'];
  const glow = COLORS.map(rgb => sprite((x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.25, `rgba(${rgb},.55)`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  }, 64));
  const star = COLORS.map(rgb => sprite((x, s) => {
    const c = s / 2; x.translate(c, c);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, c);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, `rgba(${rgb},1)`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? c * 0.16 : c; const a = i * Math.PI / 4; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    x.closePath(); x.fill();
  }, 64));

  const P = []; const MAX = 260;
  const trail = []; const TRAIL_LEN = 22;
  let mx = -100, my = -100, lx = -100, ly = -100, active = false, running = false, last = performance.now();

  function spawn(x, y, vx, vy, big) {
    if (P.length >= MAX) P.shift();
    const c = Math.random() < 0.08 ? 3 : (Math.random() * 3) | 0;
    P.push({
      x, y, vx, vy, life: 0, max: (big ? 0.9 : 0.55) + Math.random() * 0.6,
      s: (big ? 10 : 5) + Math.random() * (big ? 16 : 9), c, rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 6, starry: Math.random() < (big ? 0.6 : 0.4)
    });
  }
  function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }

  // (movement trail removed at the owner's request; only click bursts remain)

  const rings = [];
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.2, sp = 120 + Math.random() * 260;
      spawn(e.clientX, e.clientY, Math.cos(a) * sp, Math.sin(a) * sp, true);
    }
    rings.push({ x: e.clientX, y: e.clientY, life: 0 });
    kick();
  }, { passive: true });

  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    // ribbon: smooth tapered glow following the cursor

    if (trail.length > 2) {
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i < trail.length; i++) {
          const k = i / trail.length, a = trail[i - 1], b = trail[i];
          ctx.strokeStyle = pass ? `rgba(255,244,210,${k * 0.55})` : `rgba(255,190,70,${k * 0.22})`;
          ctx.lineWidth = pass ? k * 2.2 : k * 9;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }

    // particles
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life += dt;
      if (p.life >= p.max) { P.splice(i, 1); continue; }
      const f = Math.exp(-dt * 3.2);
      p.vx *= f; p.vy = p.vy * f - 18 * dt;      // gentle upward drift like embers
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const k = p.life / p.max, alpha = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
      const s = p.s * (1 - k * 0.5) * (0.85 + 0.15 * Math.sin(now * 0.02 + i));
      ctx.globalAlpha = alpha * 0.9;
      if (p.starry) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.drawImage(star[p.c], -s, -s, s * 2, s * 2); ctx.restore();
      } else ctx.drawImage(glow[p.c], p.x - s, p.y - s, s * 2, s * 2);
    }
    // click shockwave rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.life += dt;
      if (r.life > 0.7) { rings.splice(i, 1); continue; }
      const k = Math.min(1, Math.max(0, r.life / 0.7)), e = 1 - Math.pow(1 - k, 3);
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = 'rgba(255,214,102,1)'; ctx.lineWidth = 2.5 * (1 - k) + 0.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, 8 + e * 70, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.35; ctx.lineWidth = 8 * (1 - k);
      ctx.beginPath(); ctx.arc(r.x, r.y, 4 + e * 48, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    if (P.length || rings.length || trail.length) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, W, H); }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { P.length = 0; rings.length = 0; trail.length = 0; } });
})();
