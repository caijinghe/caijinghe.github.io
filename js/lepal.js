// =========================
// 🎬 Video auto play / pause
// =========================
const videos = document.querySelectorAll('.lepal-video');

const obs = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting && e.intersectionRatio >= 0.75) {
      v.play().catch(() => {/* iOS 权限问题忽略 */});
    } else {
      v.pause();
    }
  });
}, {
  threshold: [0, .25, .5, .75, 1],
  rootMargin: '0px'
});

videos.forEach(v => obs.observe(v));

// 标签页不可见时暂停，恢复时按可见度决定是否播放
document.addEventListener('visibilitychange', () => {
  videos.forEach(v => {
    if (document.hidden) {
      v.pause();
    } else {
      const rect = v.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const visibleH = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
      const ratio = visibleH / Math.max(1, rect.height);
      if (ratio >= 0.75) v.play().catch(() => {});
    }
  });
});

// =========================
// 🖼 Image fallback
// =========================
document.querySelectorAll('img').forEach(img => {
  img.addEventListener('error', () => {
    console.warn('Image failed to load:', img.src);
    img.style.opacity = 0.3;
    img.alt = (img.alt || 'image') + ' (missing)';
  });
});

// =========================
// 🌠 Shooting Stars (for .block.cover[data-meteors])
// =========================
const PREFERS_REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX_DPR = 2; 
const METEOR_DIR = 'ltr'; // 'ltr' 左→右；改成 'rtl' 即右→左
const METEOR_TOP_RATIO = 0.35;  
const METEOR_TOP_MARGIN = 0.08; 

class MeteorLayer {
  constructor(section) {
    this.section = section;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'meteor-canvas';
    this.ctx = this.canvas.getContext('2d');
    this.running = false;
    this.stars = [];
    this.meteors = [];
    this.lastTime = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    section.prepend(this.canvas);

    this.handleResize = this.resize.bind(this);
    this.handleVis = this.onVisibility.bind(this);
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVis);

    this.resize();
    this.seedStars();
  }

  resize() {
    const rect = this.section.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.seedStars();
  }

  seedStars() {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    const area = w * h;
    const density = 0.00035; 
    const count = Math.max(40, Math.floor(area * density));

    this.stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 0.9 + 0.5,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 0.8
    }));
  }

  spawnMeteor() {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    const angle = 28 * (Math.PI / 180);
    const sgn = (METEOR_DIR === 'rtl') ? -1 : 1;
    const speed = w * (0.45 + Math.random() * 0.25);
    const vx = Math.cos(angle) * speed * sgn;
    const vy = Math.sin(angle) * speed;

    let x, y;
    if (Math.random() < METEOR_TOP_RATIO) {
      y = -METEOR_TOP_MARGIN * h;
      if (METEOR_DIR === 'ltr') {
        x = (-0.05 + Math.random() * 0.72) * w;
      } else {
        x = (0.33 + Math.random() * 0.75) * w;
      }
    } else {
      x = (METEOR_DIR === 'rtl') ? (1 + METEOR_TOP_MARGIN) * w : -METEOR_TOP_MARGIN * w;
      y = Math.random() * (0.50 * h);
    }

    const length = 60 + Math.random() * 80;
    const life = 0.9 + Math.random() * 0.6;

    this.meteors.push({ x, y, vx, vy, length, life, age: 0 });
  }

  drawStars(t) {
    const ctx = this.ctx;
    ctx.save();
    for (const s of this.stars) {
      const alpha = 0.4 + 0.6 * Math.abs(Math.sin(s.twinkle + t * 0.0015 * s.speed));
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  }

  drawMeteors(dt) {
    const ctx = this.ctx;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.age += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const progress = Math.min(1, m.age / m.life);
      const opacity = (1 - progress) * 0.9;

      const dir = Math.atan2(m.vy, m.vx);
      const tx = m.x - Math.cos(dir) * m.length;
      const ty = m.y - Math.sin(dir) * m.length;

      const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
      grad.addColorStop(0, `rgba(255,255,255,${opacity})`);
      grad.addColorStop(1, `rgba(255,255,255,0)`);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = grad;
      ctx.shadowColor = 'rgba(170,160,255,0.6)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.shadowBlur = 12;
      ctx.fillStyle = `rgba(255,255,255,${opacity})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (m.age > m.life || m.x - m.length > w + 40 || m.y > h + 40) {
        this.meteors.splice(i, 1);
      }
    }

    this.meteorTimer = (this.meteorTimer || 0) - dt;
    if (this.meteorTimer <= 0) {
      this.spawnMeteor();
      if (Math.random() < 0.35) this.spawnMeteor();
      this.meteorTimer = 0.5 + Math.random() * 0.8;
    }
  }

  frame = (ts) => {
    if (!this.running) return;
    if (!this.lastTime) this.lastTime = ts;

    const dt = Math.min(0.05, (ts - this.lastTime) / 1000);
    this.lastTime = ts;

    const ctx = this.ctx;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;

    ctx.clearRect(0, 0, w, h);
    this.drawStars(ts);
    this.drawMeteors(dt);

    this.rafId = requestAnimationFrame(this.frame);
  };

  start() {
    if (this.running || PREFERS_REDUCED) return;
    this.running = true;
    this.lastTime = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  onVisibility() {
    if (document.hidden) this.stop();
    else this.start();
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVis);
    this.canvas.remove();
    this.stars = [];
    this.meteors = [];
  }
}

// =========================
// 🌠 Shooting Stars (for .block.cover[data-meteors])
// =========================
function initMeteorSections() {
  if (PREFERS_REDUCED) return;

  const sections = document.querySelectorAll('.block.cover[data-meteors]');
  const layers = new Map();

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const sec = e.target;
      let layer = layers.get(sec);
      if (!layer) {
        layer = new MeteorLayer(sec);
        layers.set(sec, layer);
      }

      // ⚡ 进入视口时启动，离开时停止
      if (e.isIntersecting) {
        layer.resize(); // 强制更新一次尺寸
        layer.start();
      } else {
        layer.stop();
      }
    }
  }, { threshold: 0.25 });

  sections.forEach(sec => {
    io.observe(sec);

    // ✅ 延迟检查一次，防止初始高度没加载好
    setTimeout(() => {
      const rect = sec.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        let layer = layers.get(sec);
        if (!layer) {
          layer = new MeteorLayer(sec);
          layers.set(sec, layer);
        }
        layer.resize();
        layer.start();
      }
    }, 500);
  });

  window.addEventListener('beforeunload', () => {
    layers.forEach(l => l.destroy());
    io.disconnect();
  });
}

// ✅ 改成 load 而不是 DOMContentLoaded
window.addEventListener("load", initMeteorSections);



// =========================
// ❤️ Heartbeat animation
// =========================
document.addEventListener("DOMContentLoaded", () => {
  const textEl = document.getElementById("animated-text");
  const fullText = textEl.textContent.trim();
  textEl.textContent = "";

  // ✅ 创建光标
  const cursor = document.createElement("span");
  cursor.classList.add("cursor");
  cursor.textContent = "|";
  textEl.appendChild(cursor);

  let typing = false; // 防止重复触发

  function typeWriter() {
    if (typing) return;
    typing = true;
    textEl.innerHTML = ""; // 清空
    textEl.appendChild(cursor);

    let i = 0;
    function typeLetter() {
      if (i < fullText.length) {
        const char = fullText[i] === " " ? "\u00A0" : fullText[i];
        const span = document.createElement("span");
        span.textContent = char;
        textEl.insertBefore(span, cursor);
        i++;
        setTimeout(typeLetter, 120);
      } else {
        // ✅ 打字完成后，隐藏光标
        cursor.style.display = "none";
        typing = false;
      }
    }
    cursor.style.display = "inline-block"; // 重新显示光标
    typeLetter();
  }

  // ✅ 渐变背景流动
  gsap.to("#animated-text", {
    backgroundPosition: "200% center",
    duration: 6,
    ease: "linear",
    repeat: -1
  });

  // ✅ IntersectionObserver 检测进入视口时重新打字
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        typeWriter();
      }
    });
  }, { threshold: 0.6 });

  observer.observe(textEl);
});


document.addEventListener("DOMContentLoaded", () => {
  const carousel = document.querySelector(".poster-carousel");
  const slides = document.querySelectorAll(".poster-carousel .carousel-frame img");
  const dots = document.querySelectorAll(".poster-carousel .dot");
  let index = 0;
  let interval;

  function goToSlide(i) {
    slides.forEach(slide => slide.classList.remove("active"));
    dots.forEach(dot => dot.classList.remove("active"));
    slides[i].classList.add("active");
    dots[i].classList.add("active");
    index = i;
  }

  function startAutoPlay() {
    if (interval) return; // 避免重复启动
    interval = setInterval(() => {
      index = (index + 1) % slides.length;
      goToSlide(index);
    }, 3000);
  }

  function stopAutoPlay() {
    clearInterval(interval);
    interval = null;
  }

  // 点点点击
  dots.forEach(dot => {
    dot.addEventListener("click", () => {
      stopAutoPlay();
      goToSlide(Number(dot.dataset.index));
      startAutoPlay();
    });
  });

  // 初始化第一个 slide
  goToSlide(0);

  // ✅ 只在进入视口时才播放
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        startAutoPlay();
      } else {
        stopAutoPlay();
      }
    });
  }, { threshold: 0.5 }); // 50% 可见才算进入

  observer.observe(carousel);
});




function setupSequentialLoop(video1Id, video2Id) {
  const v1 = document.getElementById(video1Id);
  const v2 = document.getElementById(video2Id);

  function playSequential(first, second) {
    first.currentTime = 0;
    first.play();
    first.addEventListener("ended", () => {
      first.style.display = "none";
      second.style.display = "block";
      second.currentTime = 0;
      second.play();
    }, { once: true });
  }

  // 初始从 v1 开始
  playSequential(v1, v2);

  // v2 结束后回到 v1
  v2.addEventListener("ended", () => {
    v2.style.display = "none";
    v1.style.display = "block";
    playSequential(v1, v2);
  });
}

// ✅ 页面加载后执行
document.addEventListener("DOMContentLoaded", () => {
  setupSequentialLoop("video1", "video2");
});
