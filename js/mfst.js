function initMfstCarousels() {
  // 1. 获取页面上所有的轮播图组件
  const carousels = document.querySelectorAll(".poster-carousel");

  // 2. 遍历每一个轮播图，给它们单独绑定逻辑
  carousels.forEach(carousel => {
    const slides = carousel.querySelectorAll(".carousel-frame img");
    const dots = carousel.querySelectorAll(".dot");
    // 获取当前这个轮播图里的箭头
    const leftArrow = carousel.querySelector(".arrow.left");
    const rightArrow = carousel.querySelector(".arrow.right");

    let index = 0;

    // 核心切换函数
    function goToSlide(i) {
      // 安全检查
      if (i >= 0 && i < slides.length) {
        // 更新 slide 和 dot 的状态
        slides.forEach(slide => slide.classList.remove("active"));
        dots.forEach(dot => dot.classList.remove("active"));
        slides[i].classList.add("active");
        dots[i].classList.add("active");
        
        index = i;

        // --- 箭头显示/隐藏逻辑 (新增) ---
        
        // 如果存在左箭头元素
        if (leftArrow) {
          // 第一页(0)时隐藏，否则显示
          leftArrow.style.display = index === 0 ? "none" : "";
        }

        // 如果存在右箭头元素
        if (rightArrow) {
          // 最后一页时隐藏，否则显示
          rightArrow.style.display = index === slides.length - 1 ? "none" : "";
        }
      }
    }

    // --- 事件监听 ---

    // 1. 点点点击
    dots.forEach(dot => {
      dot.addEventListener("click", () => {
        goToSlide(Number(dot.dataset.index));
      });
    });

    // 2. 左箭头点击 (新增)
    if (leftArrow) {
      leftArrow.addEventListener("click", () => {
        if (index > 0) {
          goToSlide(index - 1);
        }
      });
    }

    // 3. 右箭头点击 (新增)
    if (rightArrow) {
      rightArrow.addEventListener("click", () => {
        if (index < slides.length - 1) {
          goToSlide(index + 1);
        }
      });
    }

    // 初始化显示第一张（这会自动触发隐藏左箭头的逻辑）
    goToSlide(0);
  });
}

// 内容加密后，正文是解锁时才注入的，所以在解锁事件里初始化。
// 同时保留 DOMContentLoaded（未加密页面时仍可用；加密页会安全退出）。
document.addEventListener("DOMContentLoaded", initMfstCarousels);
document.addEventListener("protected:unlocked", initMfstCarousels);