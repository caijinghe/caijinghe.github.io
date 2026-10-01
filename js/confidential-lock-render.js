/* Draw the shackle in its final coordinates, without a transformed SVG layer. */
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const mix = (a, b, t) => a + (b - a) * t;

  const cardObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.offsetHeight;
      entry.target.style.setProperty('--confidential-card-offset', `${height / 2}px`);
    }
  });
  document.querySelectorAll('.confidential-card').forEach(card => cardObserver.observe(card));

  for (const svg of document.querySelectorAll('.animated-lock')) {
    const path = svg.querySelector('.lock-shackle');
    const pose = svg.querySelector('.lock-shackle-pose');
    if (!path || !pose) continue;
    let state;
    let frame;
    let x = -1;
    let y = -5;
    path.setAttribute('data-settled', '');
    path.setAttribute('stroke', path.getAttribute('fill'));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-width', '6.25');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    function draw() {
      // Project the U's centerline, keeping its thickness constant even edge-on.
      // Scaling a filled outline also shrank its sides below one screen pixel.
      const px = value => +(21 + (value - 21) * x).toFixed(4);
      const py = value => +(value + y).toFixed(4);
      const point = (a, b) => `${px(a)} ${py(b)}`;
      const radius = 9.375;
      const handle = radius * 0.5522847498;
      path.setAttribute('d',
        `M${point(20.625, 34)}V${py(18.5)}` +
        `C${point(20.625, 18.5 - handle)} ${point(30 - handle, 9.125)} ${point(30, 9.125)}` +
        `C${point(30 + handle, 9.125)} ${point(39.375, 18.5 - handle)} ${point(39.375, 18.5)}` +
        `V${py(30)}`);
      pose.removeAttribute('transform');
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
