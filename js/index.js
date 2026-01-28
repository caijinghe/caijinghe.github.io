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
    initCursorAndOverlayHints();
    initProjectFilter();
    initLogoTicker();    
    initIconHoverSwap();  
});

/* -------------------------------------------------------------------------- */
/* ✅ 5. Showreel 覆盖层功能（修复黑色画面 Bug 版） **/
/* -------------------------------------------------------------------------- */
function initShowreelOverlay() {
  const overlay = document.getElementById("showreelOverlay");
  const mainVideo = document.getElementById("showreelVideo");
  const loadingVideo = document.getElementById("loadingVideo");
  const videoContainer = document.querySelector(".video-container");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const soundBtn = document.getElementById("soundToggleBtn");
  const closeBtn = document.getElementById("closeShowreelBtn");
  
  // 确保绑定到 HTML 里的卡片 ID
  const openShowreelBtn = document.getElementById("open-showreel"); 
  const videoControls = document.querySelector(".video-controls");

  if (!overlay || !mainVideo || !loadingVideo || !videoContainer) return;

  overlay.classList.remove("preload");
  const hasShown = sessionStorage.getItem("showreelShown") === "true";

  const hideControls = () => {
    if (videoControls) videoControls.classList.add("hidden");
    videoContainer.classList.remove("force-show-sound");
  };

  const showControls = () => {
    if (videoControls) videoControls.classList.remove("hidden");
    updateSoundIcon();
  };

  // 网页首次加载自动播放 Loading 逻辑
  if (!hasShown) {
    overlay.classList.remove("hidden");
    loadingVideo.style.display = "block";
    loadingVideo.loop = false;
    hideControls();
    
    // 初始状态：主视频完全透明并置于底层
    mainVideo.style.opacity = "0"; 
    mainVideo.style.zIndex = 1;
    mainVideo.muted = true;
    mainVideo.pause();
    
    loadingVideo.currentTime = 0;
    loadingVideo.play().catch(e => console.log("Auto-play blocked"));

    loadingVideo.addEventListener("ended", () => {
      loadingVideo.style.display = "none";
      
      // 🔥 核心修复：强制主视频可见
      mainVideo.style.display = "block";
      mainVideo.style.opacity = "1"; 
      mainVideo.style.zIndex = 2;
      
      mainVideo.muted = true;
      mainVideo.currentTime = 0;
      mainVideo.play();
      showControls();
      sessionStorage.setItem("showreelShown", "true");
    });
  }

  // 点击卡片手动播放逻辑
  if (openShowreelBtn) {
    openShowreelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const currentShown = sessionStorage.getItem("showreelShown") === "true";
      overlay.classList.remove("hidden");
      
      // 🔥 核心修复：手动打开时也强制主视频可见
      loadingVideo.style.display = "none";
      mainVideo.style.display = "block";
      mainVideo.style.opacity = "1";
      mainVideo.style.zIndex = 2;
      
      mainVideo.muted = !currentShown ? true : false;
      mainVideo.currentTime = 0;
      mainVideo.play();
      showControls();
    });
  }

  // 控制按钮逻辑（保持原样）
  playPauseBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    mainVideo.paused ? mainVideo.play() : mainVideo.pause();
    updatePlayPauseIcon();
  });

  soundBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    mainVideo.muted = !mainVideo.muted;
    updateSoundIcon();
  });

  videoContainer.addEventListener("click", (e) => {
    if (e.target.closest(".video-controls")) return;
    mainVideo.paused ? mainVideo.play() : mainVideo.pause();
    updatePlayPauseIcon();
  });

  const stopShowreel = () => {
    overlay.classList.add("hidden");
    mainVideo.pause();
    sessionStorage.setItem("showreelShown", "true");
    updatePlayPauseIcon();
  };

  closeBtn?.addEventListener("click", (e) => { e.stopPropagation(); stopShowreel(); });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) stopShowreel(); });

  function updatePlayPauseIcon() {
    if (!playPauseBtn) return;
    playPauseBtn.src = mainVideo.paused ? "media/video_play.svg" : "media/video_pause.svg";
  }

  function updateSoundIcon() {
    if (!soundBtn) return;
    soundBtn.src = mainVideo.muted ? "media/video_noaudio.svg" : "media/video_audio.svg";
    if (mainVideo.muted && loadingVideo.style.display === "none") {
      videoContainer.classList.add("force-show-sound");
    } else {
      videoContainer.classList.remove("force-show-sound");
    }
  }

  mainVideo.addEventListener("ended", stopShowreel);
  updatePlayPauseIcon();
  updateSoundIcon();
}

