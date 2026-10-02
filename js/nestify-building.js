/* Two curious eyes look around from a quiet little doorway. */
(() => {
  const svg = document.querySelector('.nestify-building__icon');
  const eyes = svg?.querySelector('.nestify-hole-eyes');
  const pupils = svg?.querySelector('.nestify-hole-pupils');
  if (!eyes || !pupils) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame, start;
  let dizzyStart = null;
  const button = svg.closest('.nestify-building__button');
  // Hold each glance before gently moving to the next one.
  const glances = [[0, 0, 0], [0.6, 0, 0], [1, 1.5, 0.3], [2, 1.5, 0.3],
    [2.5, -1.5, -0.5], [3.6, -1.5, -0.5], [4.1, 0.4, -1],
    [4.8, 0.4, -1], [5.3, 0, 0], [6.4, 0, 0]];
  const smooth = t => t * t * (3 - 2 * t);
  function draw(t, now = performance.now()) {
    let x = 0, y = 0, blink = 0;
    if (!reducedMotion.matches) {
      const index = glances.findIndex((pose, i) => i > 0 && t <= pose[0]);
      const a = glances[Math.max(0, index - 1)], b = glances[index > 0 ? index : 0];
      const progress = smooth(Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0] || 1))));
      x = a[1] + (b[1] - a[1]) * progress;
      y = a[2] + (b[2] - a[2]) * progress;
      for (const at of [2.14, 5.55]) {
        const phase = (t - at) / 0.18;
        if (phase > 0 && phase < 1) blink = Math.sin(phase * Math.PI);
      }
    }
    if (dizzyStart !== null && !reducedMotion.matches) {
      const elapsed = (now - dizzyStart) / 1000;
      const duration = 1.35;
      if (elapsed < duration) {
        const strength = Math.sin(Math.PI * Math.min(1, elapsed / 0.1) / 2) * Math.pow(1 - elapsed / duration, 0.7);
        const angle = elapsed * Math.PI * 16;
        x = x * (1 - strength) + Math.cos(angle) * 1.8 * strength;
        y = y * (1 - strength) + Math.sin(angle) * 1.5 * strength;
        blink = Math.max(0, Math.sin(elapsed * Math.PI * 10)) * 0.25 * strength;
      } else {
        dizzyStart = null;
      }
    }
    pupils.setAttribute('transform', `translate(${x} ${y})`);
    eyes.setAttribute('transform', `translate(0 33) scale(1 ${1 - blink * 0.96}) translate(0 -33)`);
  }
  function tick(now) {
    if (start === undefined) start = now;
    draw(((now - start) % 6400) / 1000, now);
    frame = requestAnimationFrame(tick);
  }
  function updateMotion() {
    cancelAnimationFrame(frame);
    start = undefined;
    dizzyStart = null;
    draw(0);
    if (!reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(tick);
  }
  button?.addEventListener('click', () => {
    if (reducedMotion.matches) return;
    dizzyStart = performance.now();
  });
  reducedMotion.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', updateMotion);
  updateMotion();
})();
