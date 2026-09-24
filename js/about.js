document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM loaded");

  /** -------------------------------
   * Sticky 图像切换 (Section 1 -> photo1 Detect, Section 2 -> photo2 Dance)
   -------------------------------- */
  const img1 = document.getElementById("photo1");
  const img2 = document.getElementById("photo2");
  const panels = document.querySelectorAll(".about-panel");
  const panel2 = document.getElementById("panel2");

  function updateStickyPhotos() {
    if (!img1 || !img2 || !panel2) return;
    const rect2 = panel2.getBoundingClientRect();
    const isPanel2Active = rect2.top <= window.innerHeight * 0.5;
    img1.style.opacity = isPanel2Active ? '0' : '1';
    img2.style.opacity = isPanel2Active ? '1' : '0';
  }

  if (img1 && img2 && panels.length > 0) {
    img1.style.opacity = 1;
    img2.style.opacity = 0;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const panelId = entry.target.id;
        if (entry.isIntersecting) {
          img1.style.opacity = panelId === "panel1" ? 1 : 0;
          img2.style.opacity = panelId === "panel2" ? 1 : 0;
        }
      });
    }, { threshold: 0.5 });
    panels.forEach(panel => observer.observe(panel));
  }

  /** -------------------------------
   * Timeline 尺寸标尺生成
   -------------------------------- */
  function generateTimeline(startYear = 2019, endYear = 2025) {
    const timeline = document.getElementById("timelineRuler");
    if (!timeline) return;
    timeline.innerHTML = '';
    for (let year = startYear; year <= endYear; year++) {
      const major = document.createElement("div");
      major.className = "tick major";
      major.dataset.year = year;
      const label = document.createElement("span");
      label.className = "year-label";
      label.dataset.year = year;
      label.innerText = year;
      major.appendChild(label);
      timeline.appendChild(major);
      if (year !== endYear) {
        for (let i = 0; i < 11; i++) {
          const minor = document.createElement("div");
          minor.className = "tick minor";
          timeline.appendChild(minor);
        }
      }
    }
  }

  generateTimeline();

  /** -------------------------------
   * 滚动下拉驱动年份切换 & 细刻度滑尺波纹
   -------------------------------- */
  const bookSvgs = document.querySelectorAll('.book-svg');
  const infoBoxes = document.querySelectorAll('.year-info');
  const yearLabels = document.querySelectorAll('.year-label');
  const allTicks = Array.from(document.querySelectorAll('.tick'));
  const shelfSection = document.querySelector('.shelf-section');

  const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];
  let currentActiveYear = null;
  let currentYearIndex = 0;
  let targetProgress = 0;
  let dampedProgress = 0;
  let rafId = null;
  let lastActiveTickIndex = -1;
  let isFullShelfMode = false;

  function showFullShelf() {
    if (isFullShelfMode) return;
    isFullShelfMode = true;
    currentActiveYear = null;
    currentYearIndex = -1;

    // 初始状态：书架所有书籍完整呈现，不隐藏任何一本
    bookSvgs.forEach(b => {
      b.classList.remove('faded');
    });

    // 关闭所有年份卡片，书架保持干净完整
    infoBoxes.forEach(box => {
      box.classList.remove('active');
    });

    // 年份标尺待命状态
    yearLabels.forEach(label => {
      label.classList.remove('highlighted', 'faded');
    });

    // 细刻度清除高亮
    allTicks.forEach(t => {
      t.classList.remove('active-tick', 'near-active');
    });
    lastActiveTickIndex = -1;
  }

  function showYearInfo(year) {
    isFullShelfMode = false;
    if (currentActiveYear === year) return;
    currentActiveYear = year;

    bookSvgs.forEach(b => {
      const match = b.alt && b.alt.includes(year);
      b.classList.toggle('faded', !match);
    });
    infoBoxes.forEach(box => {
      box.classList.toggle('active', box.id === `info-${year}`);
    });
    yearLabels.forEach(label => {
      label.classList.toggle('highlighted', label.dataset.year === year);
      label.classList.toggle('faded', label.dataset.year !== year);
    });
  }

  function calculateTargetProgress() {
    if (!shelfSection) return 0;
    const rect = shelfSection.getBoundingClientRect();
    const scrollDistance = shelfSection.offsetHeight - window.innerHeight;
    if (scrollDistance <= 0) return 0;
    const scrolled = -rect.top;
    return Math.max(0, Math.min(1, scrolled / scrollDistance));
  }

  function updateTickIndicators(progress) {
    if (!allTicks.length) return;
    const floatTick = progress * (allTicks.length - 1);
    const centerTick = Math.round(floatTick);

    if (centerTick !== lastActiveTickIndex) {
      lastActiveTickIndex = centerTick;
      for (let i = 0; i < allTicks.length; i++) {
        const dist = Math.abs(i - centerTick);
        const t = allTicks[i];
        if (dist === 0) {
          t.classList.add('active-tick');
          t.classList.remove('near-active');
        } else if (dist === 1) {
          t.classList.add('near-active');
          t.classList.remove('active-tick');
        } else {
          t.classList.remove('active-tick', 'near-active');
        }
      }
    }
  }

  function tick() {
    // 阻尼平滑插值 (Damping Lerp)，产生柔和有分量的机械阻尼感
    const diff = targetProgress - dampedProgress;
    if (Math.abs(diff) > 0.0004) {
      dampedProgress += diff * 0.12;
    } else {
      dampedProgress = targetProgress;
    }

    // 初始静止态（0 ~ 0.025 缓冲）：完整呈现书架，未开始滑动时间轴
    if (dampedProgress <= 0.025) {
      showFullShelf();
      if (dampedProgress !== targetProgress) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
      return;
    }

    // 用户往下滑动后（> 0.025）：正式启动年份剧情模式与细刻度指示
    const timelineProgress = Math.max(0, Math.min(1, (dampedProgress - 0.025) / 0.975));

    // 更新细刻度滑动指示波纹（随滑动距离动态反应）
    updateTickIndicators(timelineProgress);

    const floatIndex = timelineProgress * (years.length - 1);

    // 档位阻尼门槛（Hysteresis Detent），每个年份都有缓冲带，避免抖动并提供停留感
    let newIndex = (currentYearIndex < 0) ? 0 : currentYearIndex;
    if (Math.abs(floatIndex - newIndex) >= 1.5) {
      newIndex = Math.max(0, Math.min(years.length - 1, Math.round(floatIndex)));
    } else if (floatIndex >= newIndex + 0.65 && newIndex < years.length - 1) {
      newIndex = newIndex + 1;
    } else if (floatIndex <= newIndex - 0.35 && newIndex > 0) {
      newIndex = newIndex - 1;
    }

    if (newIndex !== currentYearIndex || currentActiveYear === null || isFullShelfMode) {
      currentYearIndex = newIndex;
      showYearInfo(years[currentYearIndex]);
    }

    if (dampedProgress !== targetProgress) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  }

  const heroTitle = document.querySelector('.shelf-section h1');

  function checkScrollState() {
    const isScrolled = window.scrollY > 30 || targetProgress > 0.01;
    if (isScrolled) {
      if (!document.documentElement.classList.contains('is-scrolled')) {
        document.documentElement.classList.add('is-scrolled');
      }
      if (heroTitle) {
        heroTitle.style.display = 'none';
        heroTitle.style.animation = 'none';
      }
    }
  }

  function onScroll() {
    targetProgress = calculateTargetProgress();
    checkScrollState();
    if (!rafId) {
      rafId = requestAnimationFrame(tick);
    }
    updateStickyPhotos();
  }

  // 监听滚动与尺寸变化
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  if (window.lenis) {
    window.lenis.on('scroll', onScroll);
  } else {
    requestAnimationFrame(() => {
      if (window.lenis) {
        window.lenis.on('scroll', onScroll);
      }
    });
  }

  // 初始加载：在页面最顶端时完整展示整个书架
  targetProgress = calculateTargetProgress();
  dampedProgress = targetProgress;
  checkScrollState();
  if (dampedProgress <= 0.025) {
    showFullShelf();
  } else {
    const timelineProgress = Math.max(0, Math.min(1, (dampedProgress - 0.025) / 0.975));
    currentYearIndex = Math.max(0, Math.min(years.length - 1, Math.round(timelineProgress * (years.length - 1))));
    showYearInfo(years[currentYearIndex]);
    updateTickIndicators(timelineProgress);
  }
  updateStickyPhotos();

  /** -------------------------------
   * ticker 滚动动画
   -------------------------------- */
  const tickerTrack = document.getElementById("tickerTrack");
  if (tickerTrack) {
    const originalContent = tickerTrack.innerHTML;
    tickerTrack.innerHTML += originalContent;
    requestAnimationFrame(() => {
      const contentWidth = tickerTrack.scrollWidth / 2;
      tickerTrack.style.setProperty('--scroll-width', `${contentWidth}px`);
      tickerTrack.classList.add('animate-scroll');
    });
  }

  /** -------------------------------
   * ticker 滑到底部时淡出
   -------------------------------- */
  const ticker = document.getElementById("infiniteTicker");

  if (ticker && shelfSection) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        ticker.classList.toggle("fade-out", entry.isIntersecting);
      },
      { threshold: 0.5 }
    );
    observer.observe(shelfSection);
  }

  /** -------------------------------
   * 社交图标 滑入/淡出控制
   -------------------------------- */
  const socialIcons = document.querySelector('.social-icons-fixed');
  const trigger1 = document.querySelector('#footer-trigger');
  const trigger2 = document.querySelector('.shelf-section');

  let footerVisible = false;
  let shelfVisible = false;

  function updateIconVisibility() {
    if (!footerVisible && !shelfVisible) {
      socialIcons.classList.add('slide-in');
    } else {
      socialIcons.classList.remove('slide-in');
    }
  }

  if (socialIcons && trigger1 && trigger2) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.target === trigger1) footerVisible = entry.isIntersecting;
        if (entry.target === trigger2) shelfVisible = entry.isIntersecting;
        updateIconVisibility();
      });
    }, { threshold: 0.1 });
    observer.observe(trigger1);
    observer.observe(trigger2);
  }

  /** -------------------------------
   * 鼠标跟随 & hover 放大指针
   -------------------------------- */
  if (navigator.platform.toLowerCase().includes('win')) {
    document.documentElement.classList.add('windows');
  }

  const cursor = document.getElementById('custom-cursor');
  if (cursor) {
    document.addEventListener('mousemove', (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    });

    document.addEventListener('mouseenter', () => {
      cursor.style.opacity = 1;
    });
    document.addEventListener('mouseleave', () => {
      cursor.style.opacity = 0;
    });
  }

  const hoverTargets = document.querySelectorAll(
    'a, button, [role="button"], [onclick], .cube-button, .logo, .tab, .more-wrapper, .filter-wrapper, .showreel-controls, .year-label, .work-item'
  );

  hoverTargets.forEach(el => {
    el.addEventListener('mouseenter', () => {
      document.body.classList.add('hovering-ui');
    });
    el.addEventListener('mouseleave', () => {
      document.body.classList.remove('hovering-ui');
    });
  });
});
