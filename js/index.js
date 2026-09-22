document.addEventListener("DOMContentLoaded", () => {
    // 0. 注册插件
    if (typeof Flip !== 'undefined') gsap.registerPlugin(Flip);

    // 1. Lenis 平滑滚动
    const lenis = new Lenis({ 
        duration: 1.2, 
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
        smoothWheel: true 
    });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);

    // 2. Scroll Reveal (卡片淡入)
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold: 0.1 });

    // 3. Work Items 初始化
    const workItems = document.querySelectorAll('.work-item');
    workItems.forEach((item, index) => {
        item.style.transitionDelay = `${index % 3 * 0.1}s`;
        revealObserver.observe(item);
        
        item.addEventListener('mouseenter', () => {
            const tags = item.querySelector('.work-tags-container');
            if (tags && item.getBoundingClientRect().bottom > window.innerHeight - 20) tags.classList.add('pos-top');
            else if (tags) tags.classList.remove('pos-top');
        });

        const v = item.querySelector('.hover-video');
        if (v) {
            v.pause();
            item.addEventListener('mouseenter', () => v.play().catch(() => {}));
            item.addEventListener('mouseleave', () => { v.pause(); v.currentTime = 0; });
        }
    });

    // 4. 执行所有初始化
    initShowreelOverlay();
    initCursorAndOverlayHints?.();
    initProjectFilter?.();
    initLogoTicker?.();    
    initIconHoverSwap?.();  
});

/* -------------------------------------------------------------------------- */
/* ✅ 5. Showreel 覆盖层功能 **/
/* -------------------------------------------------------------------------- */
function initShowreelOverlay() {
  const overlay = document.getElementById('showreelOverlay');
  const mainVideo = document.getElementById('showreelVideo');
  const loadingVideo = document.getElementById('loadingVideo');
  const container = document.querySelector('.video-container');
  const play = document.getElementById('playPauseBtn');
  const sound = document.getElementById('soundToggleBtn');
  const open = document.getElementById('open-showreel');
  const progress = document.getElementById('showreelProgress');
  const elapsed = document.getElementById('showreelElapsed');
  const duration = document.getElementById('showreelDuration');
  if (!overlay || !mainVideo || !loadingVideo || !container) return;

  let activeVideo = mainVideo;
  let opened = false;
  let controlsTimer;
  let initialTitleTimer = null;
  let dragging = false;
  const frame = overlay.querySelector('.showreel-frame');

  function controlsInUse() {
    return dragging || (frame.contains(document.activeElement) && document.activeElement.matches(':focus-visible'));
  }

  function hideControls() {
    if (!opened) return;
    if (controlsInUse()) {
      controlsTimer = setTimeout(hideControls, 2400);
      return;
    }
    overlay.classList.remove('showreel-controls-visible');
  }

  function showControlsBriefly(duration = 2400) {
    if (!opened) return;
    clearTimeout(controlsTimer);
    overlay.classList.add('showreel-controls-visible');
    controlsTimer = setTimeout(hideControls, duration);
  }

  for (const event of ['pointerenter', 'pointermove', 'pointerdown', 'focusin', 'keydown']) {
    frame.addEventListener(event, () => showControlsBriefly());
  }

  frame.addEventListener('pointerleave', () => {
    clearTimeout(controlsTimer);
    hideControls();
  });

  frame.addEventListener('focusout', () => showControlsBriefly());

  let previouslyFocused;

  const formatTime = (value) => {
    const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };

  function sync() {
    play.querySelector('img').src = activeVideo.paused ? 'media/player-play.svg?v=filled-1' : 'media/player-pause.svg?v=filled-1';
    play.setAttribute('aria-label', activeVideo.paused ? 'Play' : 'Pause');
    sound.querySelector('img').src = activeVideo.muted ? 'media/player-muted.svg?v=filled-1' : 'media/player-sound.svg?v=filled-1';
    sound.setAttribute('aria-label', activeVideo.muted ? 'Unmute' : 'Mute');
    const ready = Number.isFinite(activeVideo.duration) && activeVideo.duration > 0;
    progress.disabled = !ready;
    if (!dragging) {
      progress.value = ready ? activeVideo.currentTime / activeVideo.duration * 100 : 0;
      progress.style.setProperty('--progress', `${progress.value}%`);
    }
    elapsed.textContent = formatTime(activeVideo.currentTime);
    duration.textContent = formatTime(activeVideo.duration);
    progress.setAttribute('aria-valuetext', `${elapsed.textContent} of ${duration.textContent}`);
  }

  function start(video, muted) {
    mainVideo.pause();
    loadingVideo.pause();
    activeVideo = video;
    loadingVideo.style.display = video === loadingVideo ? 'block' : 'none';
    mainVideo.style.opacity = video === mainVideo ? '1' : '0';
    mainVideo.style.display = 'block';
    video.currentTime = 0;
    video.muted = muted;
    sync();
    video.play().catch(sync);
  }

  function show(video, muted) {
    previouslyFocused = document.activeElement;
    opened = true;
    overlay.classList.remove('hidden');
    overlay.inert = false;

    // 初始展示顶部标题 5 秒，之后自动淡出；5 秒期间不被 hover 控制条计时器覆盖
    overlay.classList.add('showreel-title-visible');
    clearTimeout(initialTitleTimer);
    initialTitleTimer = setTimeout(() => {
      overlay.classList.remove('showreel-title-visible');
      initialTitleTimer = null;
    }, 5000);

    if (video !== loadingVideo) {
      showControlsBriefly(2400);
    }
    start(video, muted);
  }

  function stop() {
    opened = false;
    clearTimeout(controlsTimer);
    clearTimeout(initialTitleTimer);
    initialTitleTimer = null;
    overlay.classList.remove('showreel-controls-visible');
    overlay.classList.remove('showreel-title-visible');
    dragging = false;
    overlay.classList.add('hidden');
    overlay.inert = true;
    mainVideo.pause();
    loadingVideo.pause();
    sessionStorage.setItem('showreelShown', 'true');
    previouslyFocused?.focus?.({ preventScroll: true });
  }

  function togglePlayback() {
    if (activeVideo.paused) activeVideo.play().catch(sync);
    else activeVideo.pause();
  }

  play.addEventListener('click', togglePlayback);
  sound.addEventListener('click', () => { activeVideo.muted = !activeVideo.muted; });
  container.addEventListener('click', (event) => {
    if (!event.target.closest('.video-controls, .player-control')) togglePlayback();
  });
  overlay.addEventListener('click', (event) => { if (event.target === overlay) stop(); });
  document.addEventListener('keydown', (event) => { if (opened && event.key === 'Escape') stop(); });

  progress.addEventListener('pointerdown', () => { dragging = true; });
  const endDrag = () => { if (dragging) showControlsBriefly(); dragging = false; sync(); };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  progress.addEventListener('change', endDrag);
  progress.addEventListener('input', () => {
    if (!Number.isFinite(activeVideo.duration) || activeVideo.duration <= 0) return;
    activeVideo.currentTime = Number(progress.value) / 100 * activeVideo.duration;
    progress.style.setProperty('--progress', `${progress.value}%`);
    sync();
  });

  for (const video of [mainVideo, loadingVideo]) {
    for (const event of ['play', 'pause', 'volumechange', 'timeupdate', 'loadedmetadata', 'durationchange', 'seeked']) {
      video.addEventListener(event, () => { if (video === activeVideo) sync(); });
    }
  }

  loadingVideo.loop = false;
  loadingVideo.addEventListener('ended', () => {
    if (!opened || activeVideo !== loadingVideo) return;
    const muted = loadingVideo.muted;
    start(mainVideo, muted);
    sessionStorage.setItem('showreelShown', 'true');
  });

  loadingVideo.addEventListener('error', () => { if (opened && activeVideo === loadingVideo) start(mainVideo, loadingVideo.muted); });
  mainVideo.addEventListener('ended', () => { if (opened && activeVideo === mainVideo) stop(); });

  open?.addEventListener('click', (event) => {
    event.preventDefault();
    const firstVisit = sessionStorage.getItem('showreelShown') !== 'true';
    show(firstVisit ? loadingVideo : mainVideo, firstVisit);
    sessionStorage.setItem('showreelShown', 'true');
  });

  overlay.classList.remove('preload');
  overlay.inert = true;
  mainVideo.pause();
  loadingVideo.pause();
  sync();
  if (!window.siteLocked && sessionStorage.getItem('showreelShown') !== 'true') show(loadingVideo, true);
}
