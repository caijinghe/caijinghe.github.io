const cursor = document.getElementById('custom-cursor');

// 跟踪鼠标位置
document.addEventListener('mousemove', (e) => {
  cursor.style.left = `${e.clientX}px`;
  cursor.style.top = `${e.clientY}px`;
});

// 鼠标进入页面时显示
document.addEventListener('mouseenter', () => {
  cursor.style.opacity = 1;
});

document.addEventListener('mouseleave', () => {
  cursor.style.opacity = 0;
});

// ✅ 所有可点击元素 hover 时放大 cursor
const hoverTargets = document.querySelectorAll(
  'a, button, [role="button"], [onclick], .cube-button, .logo, .tab, .more-wrapper, .filter-wrapper, .showreel-controls, .work-item, .back-button, .grid-item img, .lightbox, .dot'
);


hoverTargets.forEach(el => {
  el.addEventListener('mouseenter', () => {
    document.body.classList.add('hovering-ui');
  });
  el.addEventListener('mouseleave', () => {
    document.body.classList.remove('hovering-ui');
  });
});
