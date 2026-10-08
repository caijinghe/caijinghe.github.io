(() => {
  'use strict';

  const overlay = document.getElementById('site-preloader');
  const label = document.getElementById('preloader-percent');
  if (!overlay || !label) return;

  const started = performance.now();
  const minDuration = 2000;
  let pageLoaded = document.readyState === 'complete';
  let imagesReady = false;
  let complete = false;
  let rendered = -1;

  if (!pageLoaded) {
    window.addEventListener('load', () => { pageLoaded = true; }, { once: true });
  }

  // CSS backgrounds are not guaranteed to finish before window.load. Decode
  // the room layers and the device image before revealing the archive.
  const sceneImages = [
    'assets/intro-room.webp?v=568',
    'assets/hub-room-1.webp?v=574',
    'assets/hub-room-2.webp?v=441',
    'assets/hub-room-3.webp?v=625',
    'assets/device/device1.webp',
  ];
  Promise.all(sceneImages.map((src) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (image.decode) image.decode().catch(() => {}).then(resolve);
      else resolve();
    };
    image.onerror = resolve; // A failed asset must not trap the visitor.
    image.src = src;
  }))).then(() => { imagesReady = true; });

  function tick(now) {
    if (complete) return;
    const elapsed = now - started;
    const hubReady = !!window.hub3d; // true or an explicit WebGL fallback
    const ready = pageLoaded && imagesReady && hubReady;
    const progress = Math.min(1, elapsed / minDuration);
    const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    const percent = Math.min(ready ? 100 : 99, Math.floor(eased * 100));
    if (percent !== rendered) {
      label.textContent = percent + '%';
      rendered = percent;
    }
    if (ready && elapsed >= minDuration) {
      complete = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setTimeout(() => {
          overlay.classList.add('is-loaded');
          setTimeout(() => overlay.remove(), 700);
        }, 180);
      }));
      return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // A blocked script or WebGL failure can leave hub3d unset. Keep the
  // original flat fallback accessible instead of showing an endless loader.
  setTimeout(() => {
    if (!window.hub3d) window.hub3d = { ok: false, why: 'loading-timeout' };
  }, 30000);
})();
