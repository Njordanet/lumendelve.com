(function () {
  'use strict';

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let prefersReducedMotion = reducedMotionQuery.matches;

  /* ------------------------------------------------------------------------
     1. Subtle Ambient Lumen Glow + Canvas Particle Embers
     ------------------------------------------------------------------------ */
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('lumen-embers');

  if (hero) {
    hero.addEventListener(
      'pointermove',
      function (event) {
        if (prefersReducedMotion || event.pointerType === 'touch') return;
        const rect = hero.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = (((event.clientX - rect.left) / rect.width) * 100).toFixed(2);
        const y = (((event.clientY - rect.top) / rect.height) * 100).toFixed(2);
        hero.style.setProperty('--glow-x', x + '%');
        hero.style.setProperty('--glow-y', y + '%');
      },
      { passive: true }
    );
  }

  function initEmberCanvas() {
    if (!canvas || !hero) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const palette = [
      { color: '251, 191, 36', weight: 0.56 }, // warm lumen gold
      { color: '245, 158, 11', weight: 0.24 }, // deep amber
      { color: '45, 212, 191', weight: 0.12 }, // arcane teal
      { color: '167, 139, 250', weight: 0.08 }, // arcane violet
    ];

    let width = 0;
    let height = 0;
    let particles = [];
    let rafId = 0;
    let lastTime = 0;

    function pickColor() {
      const r = Math.random();
      let acc = 0;
      for (let i = 0; i < palette.length; i += 1) {
        acc += palette[i].weight;
        if (r <= acc) return palette[i].color;
      }
      return palette[0].color;
    }

    function createParticle(spawnAtBottom) {
      const radius = 1.1 + Math.random() * 2.1;
      return {
        x: Math.random() * width,
        y: spawnAtBottom ? height + Math.random() * 40 : Math.random() * height,
        vy: -(12 + Math.random() * 22),
        vx: (Math.random() - 0.5) * 9,
        swayAmp: 6 + Math.random() * 14,
        swayFreq: 0.4 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
        radius: radius,
        alpha: 0.28 + Math.random() * 0.52,
        rgb: pickColor(),
      };
    }

    function resize() {
      const rect = hero.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const targetCount = width < 640 ? 22 : width < 1024 ? 34 : 44;
      particles = [];
      for (let i = 0; i < targetCount; i += 1) {
        particles.push(createParticle(false));
      }
      drawStaticFrame();
    }

    function drawStaticFrame() {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        const glowRadius = p.radius * 3.4;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
        grad.addColorStop(0, 'rgba(' + p.rgb + ', ' + p.alpha.toFixed(3) + ')');
        grad.addColorStop(0.45, 'rgba(' + p.rgb + ', ' + (p.alpha * 0.36).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(' + p.rgb + ', 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function tick(now) {
      if (prefersReducedMotion || document.hidden) {
        rafId = 0;
        return;
      }

      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
      lastTime = now;
      const elapsedSec = now * 0.001;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.y += p.vy * dt;
        p.x += (p.vx + Math.sin(elapsedSec * p.swayFreq + p.phase) * p.swayAmp) * dt;

        if (p.y < -20 || p.x < -30 || p.x > width + 30) {
          particles[i] = createParticle(true);
        }

        const fadeTop = Math.min(1, Math.max(0, p.y / (height * 0.25)));
        const currentAlpha = p.alpha * (0.25 + 0.75 * fadeTop);
        const glowRadius = p.radius * 3.4;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
        grad.addColorStop(0, 'rgba(' + p.rgb + ', ' + currentAlpha.toFixed(3) + ')');
        grad.addColorStop(0.45, 'rgba(' + p.rgb + ', ' + (currentAlpha * 0.36).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(' + p.rgb + ', 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = window.requestAnimationFrame(tick);
    }

    function start() {
      if (prefersReducedMotion || document.hidden || rafId) return;
      lastTime = 0;
      rafId = window.requestAnimationFrame(tick);
    }

    function stop() {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      drawStaticFrame();
    }

    resize();
    if (!prefersReducedMotion) start();

    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else start();
    });

    const onMotionChange = function (event) {
      prefersReducedMotion = event.matches;
      if (prefersReducedMotion) stop();
      else start();
    };
    if (typeof reducedMotionQuery.addEventListener === 'function') {
      reducedMotionQuery.addEventListener('change', onMotionChange);
    }
  }

  initEmberCanvas();

  /* ------------------------------------------------------------------------
     2. World Atlas: Realm Filter + City -> Biome Spotlight
     ------------------------------------------------------------------------ */
  const filterButtons = Array.from(document.querySelectorAll('[data-realm-filter]'));
  const cityButtons = Array.from(document.querySelectorAll('.city-row[data-city]'));
  const biomeCards = Array.from(document.querySelectorAll('.biome-card[data-city]'));

  let activeFilter = 'all';
  let selectedCity = 'steel_watch';

  function renderWorldAtlas() {
    filterButtons.forEach(function (btn) {
      const isActive = btn.dataset.realmFilter === activeFilter;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    cityButtons.forEach(function (btn) {
      const tier = btn.dataset.tier;
      const matchesFilter = activeFilter === 'all' || tier === activeFilter;
      const isSelected = btn.dataset.city === selectedCity;
      btn.classList.toggle('is-selected', isSelected);
      btn.classList.toggle('is-dimmed', !matchesFilter);
      btn.setAttribute('aria-pressed', String(isSelected));
    });

    biomeCards.forEach(function (card) {
      const tier = card.dataset.tier;
      const matchesFilter = activeFilter === 'all' || tier === activeFilter;
      const matchesCity = card.dataset.city === selectedCity;
      card.classList.toggle('is-highlighted', matchesCity && matchesFilter);
      card.classList.toggle('is-dimmed', !matchesFilter);
    });
  }

  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeFilter = btn.dataset.realmFilter || 'all';
      if (activeFilter === 'solstice') {
        selectedCity = 'solstice';
      } else if (activeFilter === 'starter' && selectedCity === 'solstice') {
        selectedCity = 'steel_watch';
      }
      renderWorldAtlas();
    });
  });

  cityButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectedCity = btn.dataset.city || 'steel_watch';
      if (activeFilter !== 'all' && btn.dataset.tier !== activeFilter) {
        activeFilter = 'all';
      }
      renderWorldAtlas();
    });
  });

  /* ------------------------------------------------------------------------
     3. Elemental Affinity Matrix Inspector
     ------------------------------------------------------------------------ */
  const AFFINITY_DATA = {
    fire:     { label: 'Fire',     color: '#f97316', strong: '1.5× vs Ice, Wind',        weak: '0.75× vs Fire, Water' },
    water:    { label: 'Water',    color: '#38bdf8', strong: '1.5× vs Fire, Earth',      weak: '0.75× vs Water, Ice' },
    ice:      { label: 'Ice',      color: '#a5f3fc', strong: '1.5× vs Earth, Wind',      weak: '0.75× vs Fire, Ice' },
    earth:    { label: 'Earth',    color: '#fbbf24', strong: '1.5× vs Fire',             weak: '0.75× vs Water, Earth, Wind' },
    wind:     { label: 'Wind',     color: '#34d399', strong: '1.5× vs Water, Earth',     weak: '0.75× vs Ice, Wind' },
    light:    { label: 'Light',    color: '#fde047', strong: '1.25× vs Dark',            weak: '0.75× vs Light' },
    dark:     { label: 'Dark',     color: '#c084fc', strong: '1.25× vs Light',           weak: '0.75× vs Dark' },
    physical: { label: 'Physical', color: '#cbd5e1', strong: '1.0× Neutral vs Most',     weak: '0.75× vs Earth' },
  };

  const affinityButtons = Array.from(document.querySelectorAll('.affinity-btn[data-element]'));
  const affName = document.getElementById('aff-name');
  const affStrong = document.getElementById('aff-strong');
  const affWeak = document.getElementById('aff-weak');

  function selectAffinity(elementKey) {
    const info = AFFINITY_DATA[elementKey];
    if (!info || !affName || !affStrong || !affWeak) return;

    affinityButtons.forEach(function (btn) {
      const active = btn.dataset.element === elementKey;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    affName.textContent = info.label;
    affName.style.color = info.color;
    affStrong.textContent = info.strong;
    affWeak.textContent = info.weak;
  }

  affinityButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectAffinity(btn.dataset.element);
    });
  });

  renderWorldAtlas();
})();
