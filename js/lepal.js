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


