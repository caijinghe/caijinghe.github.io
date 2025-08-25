const preview = document.getElementById('previewImage');
const defaultImg = 'media/work_snap.svg';
const items = document.querySelectorAll('.work-item');
const listWrapper = document.querySelector('.work-list');
const filterLabel = document.querySelector('.filter-label');
const filterOptionsContainer = document.querySelector('.filter-options');
const workItems = document.querySelectorAll('.work-item');
const workPreview = document.querySelector('.work-preview');

const filterOrder = ['all', 'design', 'research', 'visual'];
let currentSelection = 'all';

// 页面加载默认图和初始渲染
window.addEventListener('DOMContentLoaded', () => {
  preview.src = defaultImg;
  renderFilterOptions(currentSelection);
  applyStaggeredFadeIn();
});

// 项目卡片 hover 和点击逻辑
items.forEach(item => {
  item.addEventListener('click', () => {
    const link = item.getAttribute('data-link');
    if (link) window.location.href = link;
  });

  item.addEventListener('mouseenter', () => {
    const img = item.getAttribute('data-img');
    preview.src = `media/${img}`;
    listWrapper.classList.add('hovering');
    item.classList.add('hovering');
    items.forEach(other => {
      if (other !== item) other.classList.add('dimmed');
    });
  });

  item.addEventListener('mouseleave', () => {
    listWrapper.classList.remove('hovering');
    item.classList.remove('hovering');
    items.forEach(other => other.classList.remove('dimmed'));
    preview.src = defaultImg;
  });
});

// 渲染所有 filter 选项并标记选中项
function renderFilterOptions(selected) {
  filterLabel.textContent = selected.charAt(0).toUpperCase() + selected.slice(1);

  filterOptionsContainer.innerHTML = '';

  filterOrder.forEach(category => {
    const option = document.createElement('div');
    option.classList.add('filter-option');
    option.setAttribute('data-filter', category);
    option.textContent = category.charAt(0).toUpperCase() + category.slice(1);

    if (category === selected) {
      option.classList.add('selected');
    }

    filterOptionsContainer.appendChild(option);
  });

  // 绑定点击事件
  const optionElements = filterOptionsContainer.querySelectorAll('.filter-option');
  optionElements.forEach(option => {
    option.addEventListener('click', () => {
      const newSelected = option.getAttribute('data-filter');
      if (newSelected === currentSelection) return;
      currentSelection = newSelected;

      // 锁定 preview 尺寸防跳动
      const rect = workPreview.getBoundingClientRect();
      workPreview.style.minWidth = `${rect.width}px`;
      workPreview.style.minHeight = `${rect.height}px`;
      workPreview.style.transition = 'none';

      renderFilterOptions(newSelected);

      // 项目筛选逻辑
      workItems.forEach(item => {
        const categories = item.getAttribute('data-category').split(' ');
        const shouldShow = newSelected === 'all' || categories.includes(newSelected);

        if (shouldShow) {
          item.style.position = 'relative';
          item.style.visibility = 'visible';
          item.style.height = 'auto';
          item.style.pointerEvents = 'auto';
        } else {
          item.style.position = 'absolute';
          item.style.visibility = 'hidden';
          item.style.height = '0';
          item.style.pointerEvents = 'none';
        }

        item.classList.remove('first-visible', 'last-hovering');
      });

      const visibleItems = Array.from(workItems).filter(item => item.style.visibility !== 'hidden');
      if (visibleItems.length > 0) {
        visibleItems[0].classList.add('first-visible');
        visibleItems[visibleItems.length - 1].classList.add('last-hovering');
      }

      applyStaggeredFadeIn();

      // 解锁 preview 尺寸
      setTimeout(() => {
        workPreview.style.minWidth = '';
        workPreview.style.minHeight = '';
        workPreview.style.transition = '';
      }, 200);
    });
  });
}

// 淡入动画触发
function applyStaggeredFadeIn() {
  const visibleItems = Array.from(workItems).filter(item => item.style.visibility !== 'hidden');

  visibleItems.forEach((item, index) => {
    item.style.animation = 'none';
    item.offsetHeight; // 强制重排
    item.style.animation = `fadeUp 0.6s ease forwards`;
    item.style.animationDelay = `${index * 100}ms`;
  });
}


const hoverSound = document.getElementById('hoverSound');

