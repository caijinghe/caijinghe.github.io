document.addEventListener("DOMContentLoaded", () => {
    // 0. 注册插件
    if (typeof Flip !== 'undefined') gsap.registerPlugin(Flip);

    // 1. Lenis 平滑滚动
    const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);

    // 2. Scroll Reveal (保持不变)
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold: 0.1 });

    // 3. Work Items (保持不变)
    const workItems = document.querySelectorAll('.work-item');
    workItems.forEach((item, index) => {
        item.style.transitionDelay = `${index % 3 * 0.1}s`;
        revealObserver.observe(item);
        
        item.addEventListener('mouseenter', () => {
            const tags = item.querySelector('.work-tags-container');
            if (tags && item.getBoundingClientRect().bottom > window.innerHeight - 20) tags.classList.add('pos-top');
            else if (tags) tags.classList.remove('pos-top');
        });

        const v = item.querySelector('.hover-video');
        if (v) {
            v.pause();
            item.addEventListener('mouseenter', () => v.play().catch(() => {}));
            item.addEventListener('mouseleave', () => { v.pause(); v.currentTime = 0; });
        }
    });

    // 4. Showreel & 5. 辅助功能
    initShowreelOverlay();
    initCursorAndOverlayHints();
    initLogoTicker();
    initIconHoverSwap();

    // =========================================
    // ✅ 6. 核心：简单暴力的筛选 (display: none)
    // =========================================
    initProjectFilter();
});


/* -------------------------------------------------------------------------- */
/* ✅ 核心修改区：直接 none 掉不需要的卡片                                  */
/* -------------------------------------------------------------------------- */
function initProjectFilter() {
    const workItems = document.querySelectorAll('.work-item');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const nameLogo = document.querySelector('.my-name');
    const gridContainer = document.querySelector('.grid-container');

    if (!gridContainer || workItems.length === 0) return;

    // 记录原始索引
    workItems.forEach((item, index) => {
        item.dataset.originalIndex = index;
    });

    function filterProjects(category) {
        // 1. 记录动画前状态
        const state = Flip.getState(workItems);

        // 2. 排序：把符合条件的排在数组前面 (为了让它们在瀑布流里靠上)
        const sortedItems = Array.from(workItems).sort((a, b) => {
            const catA = a.getAttribute('data-category');
            const catB = b.getAttribute('data-category');
            const isShowreelA = a.id === 'open-showreel';
            const isShowreelB = b.id === 'open-showreel';

            const isMatchA = category === 'all' || (catA && catA.includes(category)) || isShowreelA;
            const isMatchB = category === 'all' || (catB && catB.includes(category)) || isShowreelB;

            // Showreel 永远第一
            if (isShowreelA && !isShowreelB) return -1;
            if (!isShowreelA && isShowreelB) return 1;

            // 匹配的在前
            if (isMatchA && !isMatchB) return -1;
            if (!isMatchA && isMatchB) return 1;

            // 原始顺序
            return a.dataset.originalIndex - b.dataset.originalIndex;
        });

        // 3. DOM 操作：关键在这里！
        sortedItems.forEach(item => {
            const itemCategory = item.getAttribute('data-category');
            const isShowreel = item.id === 'open-showreel';
            
            // 判断是否匹配
            const isMatch = category === 'all' || (itemCategory && itemCategory.includes(category)) || isShowreel;

            if (isMatch) {
                // ✅ 匹配：显示出来！
                // inline-block 是配合 column-count 最好的属性
                item.style.display = 'inline-block'; 
                item.classList.remove('is-inactive');
            } else {
                // ❌ 不匹配：直接消失！不占位置！
                // 这样 CSS 瀑布流就会自动把下面的顶上来，没有任何缝隙
                item.style.display = 'none'; 
                item.classList.add('is-inactive');
            }

            // 重新插入 DOM (为了让匹配的跑到最上面)
            gridContainer.appendChild(item);
        });

        // 4. 动画
        // Flip 会检测到有的元素 display 变成了 none，有的位置变了，自动做动画
        Flip.from(state, {
            duration: 0.8,
            ease: "power2.inOut",
            absolute: false, // ⚠️ 瀑布流布局不要开 absolute: true，容易崩
            
            // 简单的淡入淡出
            onEnter: el => gsap.fromTo(el, {opacity: 0, scale: 0.9}, {opacity: 1, scale: 1, duration: 0.8}),
            onLeave: el => gsap.to(el, {opacity: 0, duration: 0.5}) 
        });
    }

    // 绑定事件
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const filterType = btn.getAttribute('data-filter');
            filterProjects(filterType);
            filterBtns.forEach(b => b.style.opacity = '0.4');
            btn.style.opacity = '1';
        });
    });

    if (nameLogo) {
        nameLogo.addEventListener('click', (e) => {
            e.preventDefault();
            filterProjects('all');
            filterBtns.forEach(b => b.style.opacity = '1');
        });
    }
}