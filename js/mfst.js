document.addEventListener("DOMContentLoaded", () => {
  const carousels = document.querySelectorAll(".poster-carousel");

  carousels.forEach(carousel => {
    const slides = carousel.querySelectorAll(".carousel-frame img");
    const dots = carousel.querySelectorAll(".dot");
    let index = 0;
    let interval;

    function goToSlide(i) {
      // 优化：添加一个安全检查，确保索引在范围内
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
});