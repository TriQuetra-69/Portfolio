/* =====================================================================
   UI / INTERACTIONS
   ===================================================================== */
(function () {
  'use strict';
  const CFG = window.PORTFOLIO_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- Toast ---------- */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  /* ---------- Buttery smooth scrolling (desktop wheel/trackpad, Lenis-style) ---------- */
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const Scroller = (() => {
    let target = window.scrollY, current = window.scrollY, running = false, last = 0;
    const maxY = () => document.documentElement.scrollHeight - window.innerHeight;
    const enabled = finePointer && !reduceMotion;
    function frame(now) {
      const dt = Math.min((now - last) / 1000 || 0.016, 0.05); last = now;
      current += (target - current) * (1 - Math.exp(-dt * 9));
      if (Math.abs(target - current) < 0.4) { current = target; running = false; }
      window.scrollTo({ top: current, behavior: 'instant' });
      if (running) requestAnimationFrame(frame);
    }
    function start() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
    if (enabled) {
      window.addEventListener('wheel', (e) => {
        if (e.ctrlKey || document.body.style.overflow === 'hidden' || e.target.closest('.modal, textarea, select')) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault();
        if (!running) { current = window.scrollY; target = current; }
        const d = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
        target = Math.max(0, Math.min(maxY(), target + d));
        start();
      }, { passive: false });
      window.addEventListener('scroll', () => { if (!running) { current = target = window.scrollY; } }, { passive: true });
    }
    return {
      to(y) {
        y = Math.max(0, Math.min(maxY(), y));
        if (!enabled) { window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' }); return; }
        if (!running) current = window.scrollY;
        target = y; start();
      }
    };
  })();

  /* ---------- Wire all social / contact links from config ---------- */
  const linkFor = {
    email: 'mailto:' + CFG.email + '?subject=' + encodeURIComponent('Opportunity for ' + (CFG.name || 'you')),
    phone: 'tel:' + CFG.phoneRaw,
    ...(CFG.socials || {})
  };
  $$('[data-social]').forEach(a => {
    const key = a.dataset.social;
    const href = linkFor[key];
    if (!href) return;
    a.setAttribute('href', href);
    if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  });
  $$('[data-text="email"], [data-text-target="email"]').forEach(el => el.textContent = CFG.email);
  $$('[data-text="phone"], [data-text-target="phone"]').forEach(el => el.textContent = CFG.phone);
  $$('[data-repo]').forEach(a => {
    const url = (CFG.repos || {})[a.dataset.repo] || (CFG.socials || {}).github;
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  });
  if (CFG.photo) {
    const img = new Image();
    img.alt = CFG.name; img.src = CFG.photo;
    img.onload = () => { const box = $('#wPhoto'); box.innerHTML = ''; box.appendChild(img); };
  }
  $('#year').textContent = new Date().getFullYear();

  /* ---------- Split hero name into animated letters ---------- */
  (function () {
    const el = document.querySelector('.hero-title .name'); if (!el) return;
    const text = el.textContent; el.setAttribute('aria-label', text); el.textContent = '';
    [...text].forEach((ch, i) => {
      const s = document.createElement('span'); s.className = 'ch'; s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--i', i); s.textContent = ch === ' ' ? '\u00a0' : ch; el.appendChild(s);
    });
  })();

  /* ---------- Resume download (feedback toast) ---------- */
  $$('[data-resume]').forEach(a => a.addEventListener('click', () => toast('📜 Downloading resume…')));

  /* ---------- Loader ---------- */
  const loader = $('#loader'), fill = $('#loaderFill');
  let prog = 0, loaded = false;
  const progTimer = setInterval(() => {
    prog = Math.min(prog + Math.random() * 18, loaded ? 100 : 88);
    fill.style.width = prog + '%';
    if (prog >= 100) { clearInterval(progTimer); setTimeout(hideLoader, 250); }
  }, 120);
  function markLoaded() { loaded = true; }
  function hideLoader() { loader.classList.add('done'); document.body.classList.add('ready'); if (window.SEA && window.SEA.intro) window.SEA.intro(); revealInView(); setTimeout(startTyping, 900); }
  if (window.SEA && window.SEA.ready) markLoaded(); else if (window.SEA) window.SEA.onReady = markLoaded; else markLoaded();
  setTimeout(markLoaded, 4000); // safety net

  /* ---------- Header / nav ---------- */
  const header = $('#header'), burger = $('#burger'), navLinks = $('#navLinks');
  function closeMenu() { navLinks.classList.remove('open'); burger.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu'); }
  burger.addEventListener('click', () => {
    const open = !navLinks.classList.contains('open');
    navLinks.classList.toggle('open', open); burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open)); burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  $$('#navLinks a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('click', (e) => { if (!header.contains(e.target)) closeMenu(); });

  // Smooth scroll for all in-page anchors (works even where CSS smooth-scroll isn't supported)
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#' ? null : $(id);
    if (!target) return;
    e.preventDefault();
    const y = target.getBoundingClientRect().top + window.scrollY - (id === '#home' ? 0 : header.offsetHeight - 1);
    Scroller.to(id === '#home' ? 0 : y);
    history.replaceState(null, '', id);
  }));

  /* ---------- Theme (day / night sea) ---------- */
  const themeBtn = $('#themeToggle');
  function setNight(on, silent) {
    document.body.classList.toggle('night', on);
    themeBtn.setAttribute('aria-label', on ? 'Switch to day sea' : 'Switch to night sea');
    if (window.SEA) window.SEA.setNight(on);
    try { localStorage.setItem('sea-night', on ? '1' : '0'); } catch (e) {}
    if (!silent) toast(on ? '🌙 Night voyage: lanterns lit' : '☀️ Golden hour on the Grand Line');
  }
  themeBtn.addEventListener('click', () => setNight(!document.body.classList.contains('night')));
  try { if (localStorage.getItem('sea-night') === '1') setNight(true, true); } catch (e) {}

  /* ---------- Scroll: progress, header, active link, 3D camera ---------- */
  const progressEl = $('#progress'), shade = $('#sceneShade');
  const sections = $$('main section[id]');
  const navMap = new Map($$('#navLinks a[href^="#"]').map(a => [a.getAttribute('href').slice(1), a]));
  let ticking = false;
  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const y = window.scrollY;
    const p = max > 0 ? y / max : 0;
    progressEl.style.width = (p * 100) + '%';
    header.classList.toggle('scrolled', y > 30);
    shade.style.opacity = Math.min(1, y / (window.innerHeight * 0.8)).toFixed(3);
    if (window.SEA && window.SEA.setScroll) {
      // map scroll to camera keyframes so each section gets its own composed shot
      const probe = y + window.innerHeight * 0.3;
      let i = 0; for (let k = 0; k < sections.length; k++) if (sections[k].offsetTop <= probe) i = k;
      const top = sections[i].offsetTop, next = sections[i + 1] ? sections[i + 1].offsetTop : top + sections[i].offsetHeight;
      const local = Math.max(0, Math.min(1, (probe - top) / Math.max(1, next - top)));
      const eased = local * local * (3 - 2 * local);
      window.SEA.setScroll((i + (i === 0 ? local : eased)) / (sections.length - 1));
    }
    // active section
    let current = sections[0].id;
    const mid = y + window.innerHeight * 0.35;
    for (const s of sections) if (s.offsetTop <= mid) current = s.id;
    navMap.forEach((a, id) => a.classList.toggle('active', id === current));
    ticking = false;
  }
  window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  $('#toTop').addEventListener('click', () => Scroller.to(0));

  /* ---------- Reveal on scroll + counters ---------- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        const num = en.target.querySelector('[data-count]');
        if (num) countUp(num);
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }) : null;
  function revealInView() {
    $$('.reveal').forEach((el, i) => {
      if (!io) { el.classList.add('in'); return; }
      const group = el.parentElement;
      const idx = group ? Array.prototype.indexOf.call(group.children, el) : 0;
      el.style.setProperty('--d', (Math.min(idx, 6) * 90) + 'ms');
      io.observe(el);
    });
  }
  function countUp(el) {
    const end = +el.dataset.count, suf = el.dataset.suffix || '';
    const t0 = performance.now(), dur = 1400;
    (function step(now) {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + (k === 1 ? suf : '');
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- Typing effect ---------- */
  const roles = ['Cloud Engineer', 'Linux Enthusiast', 'Python Developer', 'Web Developer', 'DevOps Learner'];
  const typedEl = $('#typed');
  let typingStarted = false;
  function startTyping() {
    if (typingStarted) return; typingStarted = true;
    let r = 0, c = 0, del = false;
    (function loop() {
      const word = roles[r];
      typedEl.textContent = word.slice(0, c);
      let delay = del ? 45 : 95;
      if (!del && c === word.length) { delay = 1700; del = true; }
      else if (del && c === 0) { del = false; r = (r + 1) % roles.length; delay = 350; }
      c += del ? -1 : 1;
      if (del && c < 0) c = 0;
      setTimeout(loop, delay);
    })();
  }

  /* ---------- Skill filter ---------- */
  $$('[data-skill-filter]').forEach(btn => btn.addEventListener('click', () => {
    const f = btn.dataset.skillFilter;
    $$('[data-skill-filter]').forEach(b => { b.classList.toggle('active', b === btn); b.setAttribute('aria-selected', String(b === btn)); });
    $$('#skillsGrid .skill-card').forEach(card => {
      const show = f === 'all' || card.dataset.cat === f;
      card.classList.toggle('hide', !show);
      if (show) { card.classList.add('in'); }
    });
  }));

  /* ---------- Project filter ---------- */
  $$('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
    const f = btn.dataset.filter;
    $$('[data-filter]').forEach(b => { b.classList.toggle('active', b === btn); b.setAttribute('aria-selected', String(b === btn)); });
    $$('#projectsGrid .project').forEach(p => {
      const show = f === 'all' || p.dataset.tags.split(' ').includes(f);
      p.classList.toggle('hide', !show);
      if (show) p.classList.add('in');
    });
  }));

  /* ---------- Chess thumbnail board ---------- */
  (function () {
    const g = document.getElementById('board'); if (!g) return;
    const ns = 'http://www.w3.org/2000/svg', s = 20;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', c * s); rect.setAttribute('y', r * s); rect.setAttribute('width', s); rect.setAttribute('height', s);
      rect.setAttribute('fill', (r + c) % 2 ? '#8b5a2b' : '#f3e2b8'); g.appendChild(rect);
    }
  })();

  /* ---------- Project modal ---------- */
  const PROJECTS = {
    weather: {
      kicker: 'Treasure #1 · API Web App', title: 'Weather WebApp',
      desc: 'A responsive weather application that fetches real-time weather data from the OpenWeatherMap public API. Users can search for any city in the world and instantly see the current conditions.',
      features: ['Search weather for any city worldwide', 'Live temperature, weather conditions, humidity and wind speed', 'Asynchronous REST API calls with the Fetch API and error handling for invalid cities', 'Fully responsive layout for mobile, tablet and desktop'],
      tech: ['HTML5', 'CSS3', 'JavaScript (ES6)', 'OpenWeatherMap API', 'Fetch / JSON']
    },
    tmovies: {
      kicker: 'Treasure #2 · API Web App', title: 'tmovies: Movie Explorer',
      desc: 'A movie discovery web app that lets users search for films and view detailed information fetched from a public movie database API, with a clean UI and dynamic rendering.',
      features: ['Search movies by title', 'Poster gallery with ratings and descriptions', 'Dynamic DOM rendering of API results', 'Clean, minimal and responsive interface'],
      tech: ['HTML5', 'CSS3', 'JavaScript (ES6)', 'Movie Database API', 'Fetch / JSON']
    },
    chess: {
      kicker: 'Treasure #3 · Browser Game', title: 'Chess Game',
      desc: 'A web-based chess game for two players on the same device, with standard chess rules and a user-friendly, interactive board. Built to sharpen logical thinking and front-end skills.',
      features: ['Two-player real-time gameplay', 'Standard piece movements and chess rules', 'Move validation and turn management', 'Interactive board UI with piece selection and highlighting'],
      tech: ['HTML5', 'CSS3', 'JavaScript (ES6)', 'Game Logic', 'DOM Events']
    }
  };
  const modal = $('#modal');
  let lastFocus = null;
  function openModal(key) {
    const p = PROJECTS[key]; if (!p) return;
    $('#modalKicker').textContent = p.kicker;
    $('#modalTitle').textContent = p.title;
    $('#modalDesc').textContent = p.desc;
    $('#modalFeatures').innerHTML = p.features.map(f => `<li>${f}</li>`).join('');
    $('#modalTech').innerHTML = p.tech.map(t => `<li>${t}</li>`).join('');
    const repo = $('#modalRepo');
    repo.href = (CFG.repos || {})[key] || (CFG.socials || {}).github; repo.target = '_blank'; repo.rel = 'noopener noreferrer';
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('.modal-close', modal).focus(), 30);
  }
  function closeModal() {
    modal.hidden = true; document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  $$('[data-open]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.open)));
  $$('[data-close]', modal).forEach(b => b.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Tab') { // focus trap
      const f = $$('a[href], button', modal).filter(el => el.offsetParent !== null);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- 3D tilt (spring-smoothed) ---------- */
  const fine = finePointer && !reduceMotion;
  function tilt(el, max, lift) {
    if (!fine || !el) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, hover = false, raf = 0;
    function loop() {
      cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
      el.style.transform = `perspective(1000px) rotateY(${cx * max}deg) rotateX(${-cy * max}deg) translateY(${hover ? -lift : 0}px)`;
      if (hover || Math.abs(cx) > 0.001 || Math.abs(cy) > 0.001) raf = requestAnimationFrame(loop);
      else { el.style.transform = ''; raf = 0; }
    }
    el.addEventListener('pointerenter', () => { hover = true; if (!raf) raf = requestAnimationFrame(loop); });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5;
    });
    el.addEventListener('pointerleave', () => { hover = false; tx = ty = 0; });
  }
  tilt($('#wanted'), 18, 6);
  $$('.project').forEach(p => tilt(p, 7, 8));

  /* ---------- Spotlight glow that follows the cursor on cards ---------- */
  if (fine) {
    $$('.skill-card, .project, .tl-card, .ci-card, .card, .stat').forEach(el => {
      el.classList.add('spot');
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------- Magnetic buttons ---------- */
  if (fine) {
    $$('.btn, .socials a, .icon-btn, .to-top').forEach(el => {
      el.classList.add('magnetic');
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        el.style.setProperty('--tx', (x * 0.22).toFixed(1) + 'px');
        el.style.setProperty('--ty', (y * 0.3).toFixed(1) + 'px');
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--tx', '0px'); el.style.setProperty('--ty', '0px'); });
    });
  }

  /* ---------- Copy email ---------- */
  $('#copyEmail').addEventListener('click', async () => {
    const text = CFG.email;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (err) {}
      ta.remove();
    }
    toast(ok ? '✅ Email copied: ' + text : 'Email: ' + text);
  });

  /* ---------- External links: go straight to the profile / app ----------
     1) open in a new tab (on phones, Instagram/WhatsApp/LinkedIn links hand off to the app)
     2) if new tabs are blocked, send the whole browser window to the profile
     Sites like Instagram refuse to load inside frames, so we NEVER load them inside this page. */
  const framed = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();
  let leaving = false;
  window.addEventListener('pagehide', () => { leaving = true; });
  function redirectTo(url, label) {
    if (!framed) { window.location.href = url; return; }           // normal tab: same-tab redirect
    try { window.top.location.href = url; } catch (err) {}           // inside a frame: redirect the top window
    setTimeout(() => {
      if (!leaving) toast(`Open this site in a full browser tab to visit ${label}.`);
    }, 700);
  }
  const NAMES = { linkedin: 'LinkedIn', github: 'GitHub', instagram: 'Instagram', x: 'X', whatsapp: 'WhatsApp' };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[target="_blank"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = a.href;
    if (!/^https?:/i.test(url)) return;
    e.preventDefault();
    let win = null;
    try { win = window.open(url, '_blank'); } catch (err) { win = null; }
    if (win) { try { win.opener = null; } catch (err) {} return; }
    redirectTo(url, NAMES[a.dataset.social] || (a.dataset.repo ? 'GitHub' : 'this link'));
  });

  /* ---------- Contact form → opens mail client with prefilled message ---------- */
  const form = $('#contactForm');
  function setErr(input, msg) {
    const f = input.closest('.field'); f.classList.toggle('invalid', !!msg);
    f.querySelector('.err').textContent = msg || '';
  }
  ['cf-name', 'cf-email', 'cf-msg'].forEach(id => $('#' + id).addEventListener('input', (e) => setErr(e.target, '')));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#cf-name'), email = $('#cf-email'), msg = $('#cf-msg'), subj = $('#cf-subject');
    let ok = true;
    if (name.value.trim().length < 2) { setErr(name, 'Please enter your name.'); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { setErr(email, 'Please enter a valid email.'); ok = false; }
    if (msg.value.trim().length < 10) { setErr(msg, 'Message should be at least 10 characters.'); ok = false; }
    if (!ok) { toast('⚠️ Please fix the highlighted fields'); return; }
    const subject = `${subj.value} | from ${name.value.trim()}`;
    const body = `Hi Sanskar,\n\n${msg.value.trim()}\n\nRegards,\n${name.value.trim()}\n${email.value.trim()}`;
    const href = `mailto:${CFG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const a = document.createElement('a'); a.href = href; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    toast('📨 Opening your email app…');
    setTimeout(() => form.reset(), 800);
  });
})();
