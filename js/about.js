document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM loaded");

  /** -------------------------------
   * Sticky 图像切换
   -------------------------------- */
  const img1 = document.getElementById("photo1");
  const img2 = document.getElementById("photo2");
  const panels = document.querySelectorAll(".about-panel");

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
   * Panel 1 滚动吸附 (Pinning) 效果
   * -------------------------------- */
function initPanelPinning() {
    const panel = document.getElementById('panel1');
    if (!panel) return;

    // 1. 创建轨道
    const track = document.createElement('div');
    track.classList.add('pin-track');
    panel.parentNode.insertBefore(track, panel);
    track.appendChild(panel);

    // 🔴 修改这里：减小数值
    // 原来是 '160vh' (停顿很久)
    // 改成 '120vh' (稍微停顿一下) 或者 '110vh' (几乎不停顿)
    track.style.height = '120vh'; 
    
    track.style.position = 'relative';

    // 3. 设置 Panel 样式
    panel.style.position = 'sticky';
    panel.style.width = '100%';
    
    // 居中设置 (保持不变)
    panel.style.height = '80vh';  
    panel.style.top = '10vh';     
    
    // 4. 清理干扰
    panel.style.marginTop = '0';
    panel.style.marginBottom = '0';
    panel.style.paddingTop = '0'; 
  }
  // 运行这个函数
  initPanelPinning();

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
   * 自动轮播 & Hover 展示年份 info
   -------------------------------- */
  const bookSvgs = document.querySelectorAll('.book-svg');
  const infoBoxes = document.querySelectorAll('.year-info');
  const yearLabels = document.querySelectorAll('.year-label');
  const allTicks = document.querySelectorAll('.tick');
  const booksRow = document.querySelector('.svg-books-row');

  const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];
  let autoHoverTimer = null;
  let autoHoverStopped = false;
  let currentIndex = 0;

  function showYearInfo(year) {
    bookSvgs.forEach(b => {
      const match = b.alt.includes(year);
      b.classList.toggle('faded', !match);
    });
    infoBoxes.forEach(box => {
      box.classList.toggle('active', box.id === `info-${year}`);
    });
    yearLabels.forEach(label => {
      label.classList.toggle('highlighted', label.dataset.year === year);
      label.classList.toggle('faded', label.dataset.year !== year);
    });
    allTicks.forEach(tick => {
      tick.classList.toggle('highlighted', tick.dataset.year === year);
      tick.classList.toggle('faded', tick.dataset.year !== year);
    });
  }

  function clearYearInfo() {
    bookSvgs.forEach(b => b.classList.remove('faded'));
    infoBoxes.forEach(box => box.classList.remove('active'));
    yearLabels.forEach(label => label.classList.remove('highlighted', 'faded'));
    allTicks.forEach(tick => tick.classList.remove('highlighted', 'faded'));
  }

function startAutoHover() {
  stopAutoHover(); // 🔁 先清除旧的，防止多个定时器叠加
  autoHoverStopped = false;
  autoHoverTimer = setInterval(() => {
    if (autoHoverStopped) return;
    const year = years[currentIndex % years.length];
    showYearInfo(year);
    currentIndex++;
  }, 3000);
}

function stopAutoHover() {
  autoHoverStopped = true;
  clearInterval(autoHoverTimer);
}



  // ruler label hover 展示年份 info
  yearLabels.forEach(label => {
    const year = label.dataset.year;
    if (year) {
      label.addEventListener('mouseenter', () => {
        stopAutoHover();
        currentIndex = (years.indexOf(year) + 1) % years.length;
        showYearInfo(year);
      });
      label.addEventListener('mouseleave', () => {
        clearYearInfo();
        startAutoHover();
      });
    }
  });


  // tick major hover 展示 info
  allTicks.forEach(tick => {
    const year = tick.dataset.year;
    if (year) {
      tick.addEventListener('mouseenter', () => {
        stopAutoHover();
        currentIndex = (years.indexOf(year) + 1) % years.length;
        showYearInfo(year);
      });
      tick.addEventListener('mouseleave', () => {
        clearYearInfo();
        startAutoHover();
      });
    }
  });




  startAutoHover();

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
  const shelfSection = document.querySelector(".shelf-section");

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
   * 鼠标跟随 & hover 放大指针
   -------------------------------- */
  if (navigator.platform.toLowerCase().includes('win')) {
    document.documentElement.classList.add('windows');
  }

  const cursor = document.getElementById('custom-cursor');

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

  const hoverTargets = document.querySelectorAll(
    
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


