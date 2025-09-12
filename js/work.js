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

// === Helper function to create buttons ===
function createButton(text, link, isExternal) {
  const btn = document.createElement('button');
  btn.className = 'read-btn';

  const front = document.createElement('span');
  front.className = 'face front';
  front.textContent = text;

  const top = document.createElement('span');
  top.className = 'face top';
  top.textContent = text;

  btn.appendChild(front);
  btn.appendChild(top);

  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (isExternal) {
      window.open(link, '_blank');
    } else {
      window.location.href = link;
    }
  });
  return btn;
}


// === Hover 行为（仅渐变高亮 + 切换 preview 图）===
items.forEach(item => {
  item.addEventListener('mouseenter', () => {
    const img = item.getAttribute('data-img');
    preview.src = `media/${img}`;

    if (!item.classList.contains('expanded')) {
      item.classList.add('hover-highlight'); // 加渐变背景
    }
  });

  item.addEventListener('mouseleave', () => {
    preview.src = defaultImg;
    if (!item.classList.contains('expanded')) {
      item.classList.remove('hover-highlight'); // 移除渐变背景
    }
  });

  // === Click 行为（展开/收起 + 灰掉其他）===
  item.addEventListener('click', (e) => {
    // Stop if clicking on a button inside the item
    if (e.target.closest('.read-btn')) return;

    const alreadyExpanded = item.classList.contains('expanded');

    // 收起所有展开项
    items.forEach(other => {
      other.classList.remove('expanded', 'hovering', 'hover-highlight');
      const btnContainer = other.querySelector('.button-container');
      if (btnContainer) btnContainer.remove();
    });
    listWrapper.classList.remove('hovering');

    if (!alreadyExpanded) {
      // 展开当前项
      item.classList.add('expanded');
      item.classList.remove('hover-highlight'); // 展开后取消 hover 色

      // 触发全局灰：让其他项灰掉
      listWrapper.classList.add('hovering');
      item.classList.add('hovering'); // 当前展开项保持正常色

      // --- 修改后的按钮插入逻辑 ---
      const desc = item.querySelector('.work-description');
      if (desc) {
        const link = item.getAttribute('data-link');

        if (link) {
          const linkType = item.getAttribute('data-link-type') || 'internal';
          const isExternal = linkType === 'external';
          const buttonText = isExternal ? 'VIEW LIVE' : 'UNFOLD';

          const buttonContainer = document.createElement('div');
          buttonContainer.className = 'button-container';
          
          const button = createButton(buttonText, link, isExternal);
          
          buttonContainer.appendChild(button);
          desc.appendChild(buttonContainer);
        }
      }
    }
  });
});

// 点击外部时，收起并恢复正常
document.addEventListener('click', (e) => {
  if (!e.target.closest('.work-item')) {
    listWrapper.classList.remove('hovering');
    items.forEach(item => {
      item.classList.remove('expanded', 'hovering', 'hover-highlight');
      const btnContainer = item.querySelector('.button-container');
      if (btnContainer) btnContainer.remove();
    });
  }
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

  const optionElements = filterOptionsContainer.querySelectorAll('.filter-option');
  optionElements.forEach(option => {
    option.addEventListener('click', () => {
      const newSelected = option.getAttribute('data-filter');
      if (newSelected === currentSelection) return;
      currentSelection = newSelected;

      const rect = workPreview.getBoundingClientRect();
      workPreview.style.minWidth = `${rect.width}px`;
      workPreview.style.minHeight = `${rect.height}px`;
      workPreview.style.transition = 'none';

      renderFilterOptions(newSelected);

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
        item.classList.remove('first-visible', 'last-hovering', 'expanded', 'hovering', 'hover-highlight');
        const btnContainer = item.querySelector('.button-container');
        if (btnContainer) btnContainer.remove();
      });

      const visibleItems = Array.from(workItems).filter(item => item.style.visibility !== 'hidden');
      if (visibleItems.length > 0) {
        visibleItems[0].classList.add('first-visible');
        visibleItems[visibleItems.length - 1].classList.add('last-hovering');
      }

      applyStaggeredFadeIn();

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
    item.offsetHeight;
    item.style.animation = `fadeUp 0.6s ease forwards`;
    item.style.animationDelay = `${index * 100}ms`;
  });
}

