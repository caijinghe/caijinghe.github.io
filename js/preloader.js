(() => {
  'use strict';

  const preloader = document.getElementById('site-preloader');
  const percentEl = document.getElementById('preloader-percent');
  const videoEl = preloader ? preloader.querySelector('video.preloader-logo') : null;

  if (!preloader || !percentEl) return;

  // Avoid replaying the full-screen loader when returning to the homepage in this tab.
  try {
    if (sessionStorage.getItem('site-preloader-seen') === '1') {
      preloader.classList.add('is-loaded');
      preloader.style.display = 'none';
      return;
    }
  } catch (_) {}

  // Make sure video plays immediately
  if (videoEl) {
    videoEl.currentTime = 0;
    videoEl.play().catch(() => {});
  }

  let currentPercent = 0;
  percentEl.textContent = '0%';

  let isWindowLoaded = document.readyState === 'complete';
  if (!isWindowLoaded) {
    window.addEventListener('load', () => {
      isWindowLoaded = true;
    }, { once: true });
  }

  // Full animation duration: 2000ms (2.0 seconds) for a complete, rhythmic progression
  const TOTAL_DURATION = 2000;
  const startTime = performance.now();
  let hasFinished = false;

  // Smooth easing function: starts with gentle momentum, accelerates through middle, glides into 100%
  function ease(t) {
    return t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function finish() {
    if (hasFinished) return;
    hasFinished = true;

    percentEl.textContent = '100%';
    try {
      sessionStorage.setItem('site-preloader-seen', '1');
    } catch (_) {}

    // Hold at 100% briefly (180ms) so user registers completion
    setTimeout(() => {
      preloader.classList.add('is-loaded');
      document.dispatchEvent(new CustomEvent('site:preloaded'));

      setTimeout(() => {
        preloader.style.display = 'none';
      }, 700);
    }, 180);
  }

  // Kick off project prefetching immediately during the 0%-100% animation
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIdlePrefetch, { once: true });
  } else {
    initIdlePrefetch();
  }

  function tick(now) {
    if (hasFinished) return;

    const elapsed = now - startTime;
    const rawProgress = Math.min(1, elapsed / TOTAL_DURATION);
    const easedProgress = ease(rawProgress);

    // Compute target percent (0 -> 100)
    let target = Math.floor(easedProgress * 100);

    // If page is still loading near the end, hold at 99% until window.load fires
    if (target >= 100 && !isWindowLoaded) {
      target = 99;
    }

    if (target > currentPercent) {
      currentPercent = target;
      percentEl.textContent = `${currentPercent}%`;
    }

    if (currentPercent >= 100 && isWindowLoaded && rawProgress >= 1) {
      finish();
    } else {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);

  // Safety fallback after 4 seconds
  setTimeout(() => {
    if (!hasFinished) {
      isWindowLoaded = true;
      currentPercent = 100;
      finish();
    }
  }, 4000);

  /**
   * Background prefetching of project dialog pages to eliminate preview delay
   */
  function initIdlePrefetch() {
    const dialogFrames = document.querySelectorAll('dialog.project-preview iframe[data-src]');
    if (!dialogFrames.length) return;

    const prefetchUrl = (url) => {
      if (!url) return;
      try {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        link.as = 'document';
        document.head.appendChild(link);
      } catch (_) {}
    };

    const prefetchAll = () => {
      dialogFrames.forEach((frame) => {
        prefetchUrl(frame.dataset.src);
      });
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(prefetchAll, { timeout: 2500 });
    } else {
      setTimeout(prefetchAll, 1200);
    }

    const triggerCards = [
      { triggerId: 'open-samsung', frameSelector: '#samsung-dialog iframe' },
      { triggerId: 'open-lepal', frameSelector: '#lepal-dialog iframe' },
      { triggerId: 'open-microsoft', frameSelector: '#microsoft-dialog iframe' },
      { triggerId: 'open-thermopal', frameSelector: '#thermopal-dialog iframe' },
      { triggerId: 'open-naivevil', frameSelector: '#naivevil-dialog iframe' },
    ];

    triggerCards.forEach(({ triggerId, frameSelector }) => {
      const trigger = document.getElementById(triggerId);
      const frame = document.querySelector(frameSelector);
      if (trigger && frame) {
        trigger.addEventListener('mouseenter', () => {
          if (!frame.getAttribute('src') && frame.dataset.src) {
            frame.src = frame.dataset.src;
          }
        }, { once: true });
      }
    });
  }
})();
