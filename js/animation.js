document.addEventListener("DOMContentLoaded", function () {
  initSmoothScroll();      // ✅ 加入丝滑滚动
  initImageFallback();     // ✅ 图片加载兜底
});

/** ✅ 0. 阻尼滚动（Lenis） **/
function initSmoothScroll() {
  if (window.lenis) return;
  const lenis = new Lenis({
  duration: 1.8, // 更长的滚动动画
  easing: t => 1 - Math.pow(1 - t, 4), // easeOutQuart，比 easeOutExpo 更「黏」
  smooth: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);
}

/** ✅ 1. 图片加载错误兜底 **/
function initImageFallback() {
  document.querySelectorAll("img").forEach(img => {
    img.onerror = () => {
      img.src = "media/work_snap.svg";
    };
  });
}
