/* Animate native SVG coordinates so the shackle stays vector-rendered in motion. */
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const mix = (a, b, t) => a + (b - a) * t;

  for (const svg of document.querySelectorAll('.animated-lock')) {
    const path = svg.querySelector('.lock-shackle');
    const pose = svg.querySelector('.lock-shackle-pose');
    if (!path || !pose) continue;
    let state;
    let frame;
    let x = -1;
    let y = -5;
    path.setAttribute('data-settled', '');

    function draw() {
      pose.setAttribute('transform', `translate(${21 * (1 - x)} ${y}) scale(${x} 1)`);
    }

    function update() {
      const nextState = svg.classList.contains('is-locked') ? 'locked' : 'unlocked';
      if (nextState === state) return;
      cancelAnimationFrame(frame);
      const initial = state === undefined;
      state = nextState;
      const locked = state === 'locked';
      const targetX = locked ? 1 : -1;
      const targetY = locked ? 4 : -5;
      if (initial || reducedMotion.matches) {
        x = targetX;
        y = targetY;
        draw();
        return;
      }
      const startX = x;
      const startY = y;
      const start = performance.now();
      const duration = locked ? 650 : 400;
      function tick(now) {
        const t = Math.min(1, (now - start) / duration);
        if (locked) {
          x = mix(startX, targetX, easeOut(Math.min(1, t / 0.55)));
          y = t < 0.55 ? startY : t < 0.75
            ? mix(startY, 4.5, easeOut((t - 0.55) / 0.2))
            : mix(4.5, targetY, easeOut((t - 0.75) / 0.25));
        } else {
          x = mix(startX, targetX, easeOut(t));
          y = mix(startY, targetY, easeOut(t));
        }
        if (t === 1) {
          x = targetX;
          y = targetY;
        }
        draw();
        if (t < 1) frame = requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);
    }

    new MutationObserver(update).observe(svg, { attributes: true, attributeFilter: ['class'] });
    update();
  }
})();
