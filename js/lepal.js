// =========================
// 🎬 Video auto play / pause
// =========================
const videos = document.querySelectorAll('.lepal-video');

const obs = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting && e.intersectionRatio >= 0.75) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  });
}, {
  threshold: [0, .25, .5, .75, 1],
  rootMargin: '0px'
});

videos.forEach(v => obs.observe(v));

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
const METEOR_DIR = 'ltr';
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

      if (e.isIntersecting) {
        layer.resize();
        layer.start();
      } else {
        layer.stop();
      }
    }
  }, { threshold: 0.25 });

  sections.forEach(sec => {
    io.observe(sec);

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

window.addEventListener("load", initMeteorSections);

// =========================
// ❤️ Heartbeat animation
// =========================
document.addEventListener("DOMContentLoaded", () => {
  const textEl = document.getElementById("animated-text");
  const fullText = textEl.textContent.trim();
  textEl.textContent = "";

  const cursor = document.createElement("span");
  cursor.classList.add("cursor");
  cursor.textContent = "|";
  textEl.appendChild(cursor);

  let typing = false;

  function typeWriter() {
    if (typing) return;
    typing = true;
    textEl.innerHTML = "";
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
        cursor.style.display = "none";
        typing = false;
      }
    }
    cursor.style.display = "inline-block";
    typeLetter();
  }

  gsap.to("#animated-text", {
    backgroundPosition: "200% center",
    duration: 6,
    ease: "linear",
    repeat: -1
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        typeWriter();
      }
    });
  }, { threshold: 0.6 });

  observer.observe(textEl);
});

// =========================
// Poster Carousel
// =========================
document.addEventListener("DOMContentLoaded", () => {
  const carousel = document.querySelector(".poster-carousel");
  const slides = document.querySelectorAll(".poster-carousel .carousel-frame img");
  const dots = document.querySelectorAll(".poster-carousel .dot");
  let index = 0;
  let interval;

  function goToSlide(i) {
    if (i >= 0 && i < slides.length) {
      slides.forEach(slide => slide.classList.remove("active"));
      dots.forEach(dot => dot.classList.remove("active"));
      slides[i].classList.add("active");
      dots[i].classList.add("active");
      index = i;
    }
  }

  function startAutoPlay() {
    if (interval) return;
    interval = setInterval(() => {
      index = (index + 1) % slides.length;
      goToSlide(index);
    }, 3000);
  }

  function stopAutoPlay() {
    clearInterval(interval);
    interval = null;
  }

  dots.forEach(dot => {
    dot.addEventListener("click", () => {
      stopAutoPlay();
      goToSlide(Number(dot.dataset.index));
      startAutoPlay();
    });
  });

  goToSlide(0);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        startAutoPlay();
      } else {
        stopAutoPlay();
      }
    });
  }, { threshold: 0.5 });

  observer.observe(carousel);
});


// =========================
// Showcase 3 视频交互
// =========================
document.addEventListener("DOMContentLoaded", () => {
  const mainVideo = document.getElementById("main-video");
  const overlays = document.querySelectorAll(".video-overlay-grid .video-overlay");

  const sources = [
    "media/lepal/onboard1.mov",
    "media/lepal/onboard2.mov",
    "media/lepal/onboard3.mov",
    "media/lepal/onboard4.mov",
    "media/lepal/onboard5.mov"
  ];

  let currentIndex = 0;
  let autoPlay = true;

  function playVideo(index) {
    if (index < 0 || index >= sources.length) return;
    currentIndex = index;

    mainVideo.src = sources[index];
    mainVideo.currentTime = 0;
    mainVideo.play().catch(() => {});

    updateActiveOverlay();
  }

  function updateActiveOverlay() {
    overlays.forEach((el, i) => {
      el.classList.toggle("active", i === currentIndex);
    });
  }

  mainVideo.addEventListener("ended", () => {
    if (autoPlay) {
      currentIndex = (currentIndex + 1) % sources.length;
      playVideo(currentIndex);
    }
  });

  overlays.forEach((el, i) => {
    el.addEventListener("mouseenter", () => {
      autoPlay = false;
      playVideo(i);
    });
    el.addEventListener("mouseleave", () => {
      autoPlay = true;
    });
  });

  playVideo(0);
});

// =========================
// Page Loading Animation
// =========================
const overlay = document.getElementById("loading-overlay");
const loadingVideo = document.getElementById("loading-video");

let videoDone = false;
let pageDone = false;

function tryRemoveOverlay() {
  if (videoDone && pageDone) {
    overlay.style.transition = "opacity 0.6s ease";
    overlay.style.opacity = 0;
    setTimeout(() => overlay.remove(), 600);
    document.body.style.overflow = "";
  }
}

loadingVideo.addEventListener("ended", () => {
  videoDone = true;
  tryRemoveOverlay();
});

loadingVideo.addEventListener("canplaythrough", () => {
  if (!videoDone) {
    setTimeout(() => {
      videoDone = true;
      tryRemoveOverlay();
    }, 1000);
  }
});

loadingVideo.addEventListener("error", () => {
  videoDone = true;
  tryRemoveOverlay();
});

window.addEventListener("load", () => {
  pageDone = true;
  tryRemoveOverlay();
});

// 禁止滚动
document.body.style.overflow = "hidden";