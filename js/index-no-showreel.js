document.addEventListener("DOMContentLoaded", () => {
  initIconHoverSwap();
  initMoreSectionIntersection();
  initMoreButtonScroll();
  initLogoTicker();
  initShowreelOverlay();
  initCursorAndOverlayHints();
  initMoreIconHover();

});



/** ✅ 1. 小图标悬停切换效果 **/
function initIconHoverSwap() {
  document.querySelectorAll('.inline-icon').forEach((icon) => {
    let toggled = false;
    const defaultImg = icon.querySelector('.icon-default');
    const hoverImg = icon.querySelector('.icon-hover');

    icon.addEventListener('mouseenter', () => {
      if (!toggled) {
        defaultImg.style.opacity = '0';
        hoverImg.style.opacity = '1';
        toggled = true;
      } else {
        defaultImg.style.opacity = '1';
        hoverImg.style.opacity = '0';
        toggled = false;
      }
    });
  });
}

/** ✅ 2. 作品区进入视口时触发动画 **/
function initMoreSectionIntersection() {
  const section = document.querySelector('.more-section');
  const button = document.querySelector('.more-wrapper');

  if (!section || !button) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        button.classList.add('visible');
      } else {
        button.classList.remove('visible');
      }
    },
    {
      threshold: 0.5
    }
  );

  observer.observe(section);
}

/** ✅ 3. 滚动到底部时显示 "More" 按钮 **/
function initMoreButtonScroll() {
  const moreBtn = document.getElementById("moreButton");
  if (!moreBtn) return;

  window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const pageHeight = document.body.scrollHeight;

    if (scrollTop + windowHeight >= pageHeight - 120) {
      moreBtn.classList.add("visible");
    } else {
      moreBtn.classList.remove("visible");
    }
  });
}

/** ✅ 4. 循环滚动品牌 Ticker **/
function initLogoTicker() {
  const ticker = document.getElementById("logoTicker");
  if (!ticker) return;

  const track = ticker.querySelector(".logo-track");
  let scrollX = 0;
  const speed = 0.5;
  let paused = false;

  ticker.addEventListener("mouseenter", () => paused = true);
  ticker.addEventListener("mouseleave", () => paused = false);

  function animate() {
    if (!paused) {
      scrollX += speed;
      if (scrollX >= track.scrollWidth / 2) scrollX = 0;
      ticker.scrollLeft = scrollX;
    }
    requestAnimationFrame(animate);
  }

  animate();
}

/** ✅ 5. Showreel 覆盖层功能（播放控制等） **/
function initShowreelOverlay() {
  const overlay = document.getElementById("showreelOverlay");
  const mainVideo = document.getElementById("showreelVideo");
  const loadingVideo = document.getElementById("loadingVideo");
  const videoContainer = document.querySelector(".video-container");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const soundBtn = document.getElementById("soundToggleBtn");
  const closeBtn = document.getElementById("closeShowreelBtn");
  const openShowreelBtn = document.getElementById("openShowreelBtn");
  const videoControls = document.querySelector(".video-controls");

  if (!overlay || !mainVideo || !loadingVideo || !videoContainer) return;

  overlay.classList.remove("preload");

  const hideControls = () => {
    videoControls.classList.add("hidden");
    videoContainer.classList.remove("force-show-sound");
  };

  const showControls = () => {
    videoControls.classList.remove("hidden");
    updateSoundIcon();
  };

  // 初始状态全部暂停
  mainVideo.pause();
  loadingVideo.pause();
  loadingVideo.loop = false;
  hideControls();

  // ✅ 点击按钮后播放 loading.mp4，结束后无缝切换到 showreel.mp4（有声）
  if (openShowreelBtn) {
    openShowreelBtn.addEventListener("click", (e) => {
      e.preventDefault();

      overlay.classList.remove("hidden");
      loadingVideo.style.display = "block";
      mainVideo.style.zIndex = 1;

      mainVideo.pause();
      mainVideo.muted = false;

      loadingVideo.currentTime = 0;
      loadingVideo.play();

      hideControls();

      loadingVideo.addEventListener("ended", () => {
        loadingVideo.style.display = "none";
        mainVideo.style.zIndex = 2;
        mainVideo.currentTime = 0;
        mainVideo.muted = false; // ✅ 不静音
        mainVideo.play();
        showControls();
        sessionStorage.setItem("showreelShown", "true");
      }, { once: true });
    });
  }

  // 播放/暂停控制
  playPauseBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (mainVideo.paused) {
      mainVideo.muted = false;
      mainVideo.play();
    } else {
      mainVideo.pause();
    }
    updatePlayPauseIcon();
    updateSoundIcon();
  });

  soundBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    mainVideo.muted = !mainVideo.muted;
    updateSoundIcon();
  });

  videoContainer.addEventListener("click", (e) => {
    const isOnControls = e.target.closest(".video-controls");
    if (isOnControls) return;
    if (mainVideo.paused) {
      mainVideo.muted = false;
      mainVideo.play();
    } else {
      mainVideo.pause();
    }
    updatePlayPauseIcon();
    updateSoundIcon();
  });

  closeBtn?.addEventListener("click", () => {
    overlay.classList.add("hidden");
    mainVideo.pause();
    sessionStorage.setItem("showreelShown", "true");
    updatePlayPauseIcon();
    updateSoundIcon();
  });

  function updatePlayPauseIcon() {
    if (!playPauseBtn) return;
    playPauseBtn.src = mainVideo.paused
      ? "media/video_play.svg"
      : "media/video_pause.svg";
  }

  function updateSoundIcon() {
    if (!soundBtn) return;
    const isMuted = mainVideo.muted;
    soundBtn.src = isMuted
      ? "media/video_audio.svg"
      : "media/video_noaudio.svg";
    if (isMuted && loadingVideo.style.display === "none") {
      videoContainer.classList.add("force-show-sound");
    } else {
      videoContainer.classList.remove("force-show-sound");
    }
  }

  mainVideo.addEventListener("ended", () => {
    overlay.classList.add("hidden");
    sessionStorage.setItem("showreelShown", "true");
    updatePlayPauseIcon();
    updateSoundIcon();
  });

  updatePlayPauseIcon();
  updateSoundIcon();
}





/** ✅ 6. 自定义鼠标文字提示 + 视频外部点击关闭功能合并 **/
function initCursorAndOverlayHints() {
  const cursor = document.getElementById('custom-cursor');
  const cursorText = document.getElementById('customCursorText');
  const overlay = document.getElementById('showreelOverlay');
  const videoContainer = document.querySelector('.video-container');
  const video = document.getElementById('showreelVideo');
  const closeBtn = document.getElementById('closeShowreelBtn');




  document.addEventListener('mousemove', (e) => {
    const insideOverlay = overlay && !overlay.classList.contains('hidden');
    const rect = videoContainer?.getBoundingClientRect();
    const insideVideo = rect &&
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    // 控制文字提示与光标显示
    const isOnControls = e.target.closest('.showreel-frame');

    if (insideOverlay && !insideVideo && !isOnControls) {
      cursorText.textContent =
        sessionStorage.getItem('showreelShown') === 'true' ? 'BACK' : 'MORE';
      cursorText.style.left = `${e.clientX}px`;
      cursorText.style.top = `${e.clientY}px`;
      cursorText.style.opacity = 1;
      cursor.style.opacity = 0;
      document.body.style.cursor = 'none';
    } else {
      cursorText.style.opacity = 0;
      cursor.style.opacity = 1;
      document.body.style.cursor = 'none';
    }


    const hoverTargets = document.querySelectorAll(
      // 'a, button, [role="button"], [onclick], .cube-button, .logo, .tab, .inline-icon, .work-item, .more-text'
      'a, button, [role="button"], [onclick], .cube-button, .logo, .tab, .more-wrapper, .filter-wrapper, .showreel-controls, .showreel-frame'
    );


    hoverTargets.forEach(el => {
      el.addEventListener('mouseenter', () => {
        document.body.classList.add('hovering-ui');
      });
      el.addEventListener('mouseleave', () => {
        document.body.classList.remove('hovering-ui');
      });
    });

    // 自定义 cursor 跟随鼠标
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  });

  document.addEventListener('mouseenter', () => {
    cursor.style.opacity = 1;
  });

  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = 0;
    cursorText.style.opacity = 0;
  });







  // ✅ 点击视频外部关闭 overlay
  // ✅ 仅点击 overlay 背景自身时关闭
  // ✅ 点击视频外部区域 或关闭按钮 关闭 overlay
  if (overlay && video) {
    // ✅ 预加载关闭图标，防止首次 hover 时图片 404 裂图
    const preloadCloseIcon = new Image();
    preloadCloseIcon.src = "media/video_next_close.svg";

    // ✅ 点击 overlay 背景区域关闭
    overlay.addEventListener("click", (e) => {
      const isInsideFrame = e.target.closest(".showreel-frame");
      if (!isInsideFrame) {
        overlay.classList.add("hidden");
        video.pause();
        sessionStorage.setItem("showreelShown", "true");
      }
    });

    // ✅ 点击关闭按钮关闭
    closeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      overlay.classList.add("hidden");
      video.pause();
      sessionStorage.setItem("showreelShown", "true");
    });

    // ✅ Hover 切换关闭按钮图标
    closeBtn?.addEventListener("mouseenter", () => {
      closeBtn.src = "media/video_next_close.svg";
    });
    closeBtn?.addEventListener("mouseleave", () => {
      closeBtn.src = "media/video_next.svg";
    });
  }


}



/** ✅ 7. Hover 更换 more icon **/
function initMoreIconHover() {
  const moreWrapper = document.querySelector('.more-wrapper');
  const moreIcon = document.querySelector('.more-icon');
  if (!moreWrapper || !moreIcon) return;

  const hoverGif = moreIcon.dataset.hover;
  const originalSrc = moreIcon.src;

  let gifLoadSuccess = false;

  // ⬇️ 删除 isSafari 检测，允许所有浏览器尝试加载 hover 图
  const testImage = new Image();
  testImage.src = hoverGif;

  testImage.onload = () => {
    gifLoadSuccess = true;
  };

  testImage.onerror = () => {
    gifLoadSuccess = false;
    console.warn("⚠️ Hover image failed to load — will not be used.");
  };

  moreWrapper.addEventListener('mouseenter', () => {
    if (gifLoadSuccess) {
      moreIcon.src = hoverGif;
      moreIcon.classList.add("is-gif");
    } else {
      moreIcon.src = originalSrc;
      moreIcon.classList.remove("is-gif");
    }
  });

  moreWrapper.addEventListener('mouseleave', () => {
    moreIcon.src = originalSrc;
    moreIcon.classList.remove("is-gif");
  });
}



// ------------------------


document.addEventListener("DOMContentLoaded", function () {
  initScrollFade();
  initCardBounce();
  initHeroIcons();

});

/** ✅ 1. 淡入动画 **/
function initScrollFade() {
  const sections = document.querySelectorAll(".fade-section");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("visible", entry.isIntersecting);
    });
  }, { threshold: 0.2 });
  sections.forEach((section) => observer.observe(section));
}

/** ✅ 2. 卡片弹回动画 **/
function initCardBounce() {
  const cards = document.querySelectorAll(".work-image-inner");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("animate-rebound");
        entry.target.addEventListener("animationend", () => {
          entry.target.classList.remove("animate-rebound");
        }, { once: true });
      }
    });
  }, { threshold: 0.6 });
  cards.forEach(card => observer.observe(card));
}

/** ✅ 3. hero section icon 弹跳动画 **/
function initHeroIcons() {
  const heroSection = document.querySelector(".hero-section");
  const icons = heroSection?.querySelectorAll(".inline-icon") || [];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        icons.forEach((icon, index) => {
          icon.style.animationDelay = `${index * 0.1}s`;
          icon.classList.add("animate-bounce");
          setTimeout(() => {
            icon.classList.remove("animate-bounce");
            icon.style.animationDelay = "";
          }, 800 + index * 100);
        });
      }
    });
  }, { threshold: 0.3 });
  if (heroSection) observer.observe(heroSection);
}