/* Nestify case study: reveal on scroll, play videos only while visible, draw charts, count up stats. */
(() => {
  const root = document.querySelector('.nestify-case');
  if (!root) return;
  document.documentElement.classList.add('nf-js');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Children of a stagger group enter one after another.
  root.querySelectorAll('[data-nf-stagger]').forEach(group => {
    [...group.children].forEach((child, index) => {
      child.setAttribute('data-nf-reveal', '');
      child.style.setProperty('--nf-i', index);
    });
  });

  // Charts draw from the start of the line; measure each path once.
  root.querySelectorAll('.nestify-stat__chart path').forEach(path => {
    path.style.setProperty('--nf-len', Math.ceil(path.getTotalLength()));
  });

  function countUp(element) {
    const target = parseFloat(element.dataset.nfCount);
    const decimals = (element.dataset.nfCount.split('.')[1] || '').length;
    const suffix = element.dataset.nfSuffix || '';
    if (reducedMotion.matches) {
      element.textContent = target.toFixed(decimals) + suffix;
      return;
    }
    const from = parseFloat(element.dataset.nfFrom || '0');
    const duration = 1200;
    const start = performance.now();
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      element.textContent = (from + (target - from) * easeOut(t)).toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      entry.target.querySelectorAll('[data-nf-count]').forEach(countUp);
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

  root.querySelectorAll('[data-nf-reveal]').forEach(element => revealObserver.observe(element));

  // Videos load on approach and only play while on screen.
  const videos = [...root.querySelectorAll('video[data-nf-video]')];
  const loadObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const video = entry.target;
      video.preload = 'auto';
      video.load();
      loadObserver.unobserve(video);
    });
  }, { rootMargin: '600px 0px' });

  const playObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting && !reducedMotion.matches) video.play().catch(() => {});
      else video.pause();
    });
  }, { threshold: 0.35 });

  videos.forEach(video => {
    loadObserver.observe(video);
    playObserver.observe(video);
  });
})();
