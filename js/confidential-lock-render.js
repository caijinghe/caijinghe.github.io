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

    function draw() {
      // At the minimum 48px icon size, the resting U has 5px sides
      // and whole-pixel inner/outer edges instead of 4.4px fractional sides.
      const px = value => +(21 + (value - 21) * x).toFixed(4);
      const py = value => +(value + y).toFixed(4);
      const arc = (radius, sweep, endX, endY) =>
        `A${+(radius * Math.abs(x)).toFixed(4)} ${radius} 0 0 ${x < 0 ? 1 - sweep : sweep} ${px(endX)} ${py(endY)}`;
      path.setAttribute('d',
        `M${px(17.5)} ${py(34)}V${py(18.5)}` +
        arc(12.5, 1, 42.5, 18.5) + `V${py(30)}` +
        arc(3.125, 1, 36.25, 30) + `V${py(18.5)}` +
        arc(6.25, 0, 23.75, 18.5) + `V${py(34)}` +
        arc(3.125, 1, 17.5, 34) + 'Z');
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
