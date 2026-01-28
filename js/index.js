document.addEventListener("DOMContentLoaded", () => {

    // =========================================
    // 1. Lenis 平滑滚动 (新版逻辑)
    // =========================================
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);


    // =========================================
    // 2. 下滑浮现动画 (Scroll Reveal) (新版逻辑)
    // =========================================
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);


    // =========================================
    // 3. Work Items 核心逻辑 (标签定位 + 视频悬停)
    // =========================================
    const workItems = document.querySelectorAll('.work-item');

    workItems.forEach((item, index) => {
        // --- A. 绑定浮现动画 ---
        item.style.transitionDelay = `${index % 3 * 0.1}s`;
        revealObserver.observe(item);

        // --- B. 绑定智能标签定位 ---
        item.addEventListener('mouseenter', () => {
            const tags = item.querySelector('.work-tags-container');
            if (!tags) return;

            const rect = item.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const threshold = windowHeight - 20;

            if (rect.bottom > threshold) {
                tags.classList.add('pos-top');
            } else {
                tags.classList.remove('pos-top');
            }
        });

        // --- C. 绑定悬停播放视频 ---
        const hoverVideo = item.querySelector('.hover-video');
        if (hoverVideo) {
            hoverVideo.pause();
            item.addEventListener('mouseenter', () => {
                const playPromise = hoverVideo.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => console.log('Video playback error:', error));
                }
            });
            item.addEventListener('mouseleave', () => {
                hoverVideo.pause();
                hoverVideo.currentTime = 0;
            });
        }
    });


    // =========================================
    // 4. Showreel Overlay 逻辑 (从旧版移植并修复)
    // =========================================
    initShowreelOverlay();


    // =========================================
    // 5. 其他辅助功能 (光标、Logo滚动等)
    // =========================================
    initCursorAndOverlayHints();
    initLogoTicker(); // 如果页面上有 Logo 条的话
    initIconHoverSwap(); // 如果页面上有小图标的话

});



/* -------------------------------------------------------------------------- */
/* 功能函数定义区                               */
/* -------------------------------------------------------------------------- */

/** * ✅ Showreel 覆盖层功能 
 * 包含了：打开/关闭、Loading视频切换、静音控制、Session记录
 */
/** * ✅ Showreel 覆盖层功能 
 * 包含了：首次自动打开、点击打开/关闭、Loading视频切换、静音控制、Session记录
 */
function initShowreelOverlay() {
    const overlay = document.getElementById("showreelOverlay");
    const mainVideo = document.getElementById("showreelVideo");
    const loadingVideo = document.getElementById("loadingVideo");
    const videoContainer = document.querySelector(".video-container");
    
    const playPauseBtn = document.getElementById("playPauseBtn");
    const soundBtn = document.getElementById("soundToggleBtn");
    const closeBtn = document.getElementById("closeShowreelBtn");
    const openShowreelBtn = document.getElementById("open-showreel"); 
    
    const videoControls = document.querySelector(".video-controls");

    if (!overlay || !mainVideo || !loadingVideo || !videoContainer) return;

    overlay.classList.remove("preload");

    // 1. 检查是否已经看过
    const hasShown = sessionStorage.getItem("showreelShown") === "true";

    // 辅助函数：隐藏控件
    const hideControls = () => {
        if(videoControls) videoControls.classList.add("hidden");
        videoContainer.classList.remove("force-show-sound");
    };

    // 辅助函数：显示控件
    const showControls = () => {
        if(videoControls) videoControls.classList.remove("hidden");
        updateSoundIcon();
    };

    // ============================================================
    // ✅ 新增逻辑：如果是第一次访问（hasShown 为 false），自动打开
    // ============================================================
    if (!hasShown) {
        overlay.classList.remove("hidden"); // 立即显示遮罩
        
        // 设置为 Loading 模式
        loadingVideo.style.display = "block";
        mainVideo.style.zIndex = 1; 
        loadingVideo.currentTime = 0;
        
        // 尝试自动播放 Loading
        const playPromise = loadingVideo.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => console.log("Auto-play blocked:", error));
        }
        
        hideControls();

        // Loading 播完后切主视频
        loadingVideo.onended = () => {
            loadingVideo.style.display = "none";
            mainVideo.style.zIndex = 2;
            
            // ⚠️ 浏览器策略：自动播放的主视频通常必须静音
            mainVideo.muted = true; 
            mainVideo.currentTime = 0;
            mainVideo.play();
            
            showControls();
            
            // 标记为已看过，下次刷新就不会自动弹出了
            sessionStorage.setItem("showreelShown", "true");
        };
    }

    // ============================================================
    // ✅ 点击按钮打开逻辑 (手动触发)
    // ============================================================
    if (openShowreelBtn) {
        openShowreelBtn.addEventListener("click", (e) => {
            e.preventDefault(); 
            // 重新获取状态（因为可能刚刚自动播放过变成了 true）
            const currentHasShown = sessionStorage.getItem("showreelShown") === "true";

            overlay.classList.remove("hidden");
            
            // 如果是手动点击，且之前没看完 loading（极少情况），或者想重置逻辑：
            // 这里我们简化逻辑：手动点击一律直接看主视频，或者你可以保留 Loading 逻辑
            
            if (!currentHasShown) {
                // 如果极其快速地点击了按钮，导致自动播放还没记录 session
                loadingVideo.style.display = "block";
                mainVideo.style.zIndex = 1;
                loadingVideo.currentTime = 0;
                loadingVideo.play();
                hideControls();
                
                loadingVideo.onended = () => {
                    loadingVideo.style.display = "none";
                    mainVideo.style.zIndex = 2;
                    mainVideo.muted = false; // 手动点击可以开启声音
                    mainVideo.currentTime = 0;
                    mainVideo.play();
                    showControls();
                    sessionStorage.setItem("showreelShown", "true");
                };
            } else {
                // 以前看过，直接播主视频
                loadingVideo.style.display = "none";
                mainVideo.style.zIndex = 2;
                mainVideo.muted = false; // 手动点击，开启声音
                mainVideo.currentTime = 0;
                mainVideo.play();
                showControls();
            }
        });
    }

    // --- 播放/暂停按钮 ---
    playPauseBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (mainVideo.paused) {
            mainVideo.play();
        } else {
            mainVideo.pause();
        }
        updatePlayPauseIcon();
    });

    // --- 静音按钮 ---
    soundBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        mainVideo.muted = !mainVideo.muted;
        updateSoundIcon();
    });

    // --- 点击视频区域控制播放 ---
    videoContainer.addEventListener("click", (e) => {
        const isOnControls = e.target.closest(".video-controls");
        if (isOnControls) return;
        if (mainVideo.paused) {
            mainVideo.play();
        } else {
            mainVideo.pause();
        }
        updatePlayPauseIcon();
    });

    // --- 关闭功能 ---
    const closeOverlay = () => {
        overlay.classList.add("hidden");
        mainVideo.pause();
        sessionStorage.setItem("showreelShown", "true"); // 确保关闭时记录已看过
    };

    closeBtn?.addEventListener("click", closeOverlay);
    
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
            closeOverlay();
        }
    });

    // --- 图标更新逻辑 ---
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
            ? "media/video_noaudio.svg"
            : "media/video_audio.svg";
    }

    mainVideo.addEventListener("ended", closeOverlay);
}

/** ✅ 自定义鼠标文字提示 (BACK / MORE) */
function initCursorAndOverlayHints() {
    const cursor = document.getElementById('custom-cursor');
    const cursorText = document.getElementById('customCursorText');
    const overlay = document.getElementById('showreelOverlay');
    const videoContainer = document.querySelector('.video-container');

    // 如果页面没放 cursor 元素，直接返回，防报错
    if (!cursor || !cursorText) return;

    document.addEventListener('mousemove', (e) => {
        const insideOverlay = overlay && !overlay.classList.contains('hidden');
        
        let insideVideo = false;
        if (videoContainer) {
            const rect = videoContainer.getBoundingClientRect();
            insideVideo = e.clientX >= rect.left && e.clientX <= rect.right &&
                          e.clientY >= rect.top && e.clientY <= rect.bottom;
        }

        const isOnControls = e.target.closest('.showreel-frame');

        // 如果在 Overlay 上，但不在视频区域内 -> 显示 "BACK"
        if (insideOverlay && !insideVideo && !isOnControls) {
            cursorText.textContent = 'BACK';
            cursorText.style.left = `${e.clientX}px`;
            cursorText.style.top = `${e.clientY}px`;
            cursorText.style.opacity = 1;
            cursor.style.opacity = 0;
            document.body.style.cursor = 'none';
        } else {
            cursorText.style.opacity = 0;
            cursor.style.opacity = 1;
            // 恢复默认光标逻辑，或者让 CSS 控制
            // document.body.style.cursor = 'auto'; 
        }

        // 简单的跟随
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
    });
}


/** ✅ Logo Ticker 循环滚动 */
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
        if (!paused && track) {
            scrollX += speed;
            // 简单循环逻辑：假设内容足够长
            if (scrollX >= track.scrollWidth / 2) scrollX = 0;
            ticker.scrollLeft = scrollX;
        }
        requestAnimationFrame(animate);
    }
    animate();
}

/** ✅ 小图标悬停切换 */
function initIconHoverSwap() {
    document.querySelectorAll('.inline-icon').forEach((icon) => {
        const defaultImg = icon.querySelector('.icon-default');
        const hoverImg = icon.querySelector('.icon-hover');
        if(!defaultImg || !hoverImg) return;

        icon.addEventListener('mouseenter', () => {
            defaultImg.style.opacity = '0';
            hoverImg.style.opacity = '1';
        });
        icon.addEventListener('mouseleave', () => {
            defaultImg.style.opacity = '1';
            hoverImg.style.opacity = '0';
        });
    });
}