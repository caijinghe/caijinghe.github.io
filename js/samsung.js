document.addEventListener("DOMContentLoaded", () => {
  const carousel = document.querySelector(".poster-carousel");
  
  // 安全检查：如果没有找到轮播图元素，直接返回，避免报错
  if (!carousel) return; 

  const slides = carousel.querySelectorAll(".carousel-frame img");
  const dots = carousel.querySelectorAll(".dot");
  const leftArrow = carousel.querySelector(".arrow.left");
  const rightArrow = carousel.querySelector(".arrow.right");

  let index = 0;

  function goToSlide(i) {
    // 1. 更新 Slide 和 Dot 的 active 状态
    slides.forEach(slide => slide.classList.remove("active"));
    dots.forEach(dot => dot.classList.remove("active"));
    
    // 确保索引在安全范围内
    if (slides[i]) slides[i].classList.add("active");
    if (dots[i]) dots[i].classList.add("active");
    
    index = i;

    // 2. 核心逻辑：控制箭头的显示与隐藏
    // 如果是第一页 (index 0)，隐藏左箭头
    if (index === 0) {
      leftArrow.style.display = "none";
    } else {
      leftArrow.style.display = ""; // 恢复默认显示方式 (block/flex等)
    }

    // 如果是最后一页，隐藏右箭头
    if (index === slides.length - 1) {
      rightArrow.style.display = "none";
    } else {
      rightArrow.style.display = ""; // 恢复默认显示方式
    }
  }

  // --- 事件监听 ---

  // 点点点击
  dots.forEach(dot => {
    dot.addEventListener("click", () => {
      goToSlide(Number(dot.dataset.index));
    });
  });

  // 左箭头点击
  leftArrow.addEventListener("click", () => {
    // 只有当索引大于0时才允许往前翻
    if (index > 0) {
      goToSlide(index - 1);
    }
  });

  // 右箭头点击
  rightArrow.addEventListener("click", () => {
    // 只有当索引不是最后一个时才允许往后翻
    if (index < slides.length - 1) {
      goToSlide(index + 1);
    }
  });

  // 初始化：显示第一张，这也会自动触发隐藏左箭头的逻辑
  goToSlide(0);
});