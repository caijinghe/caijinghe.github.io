(() => {
    const cover = document.querySelector('.nestify-cover');
    if (!cover) return;
    const screens = [...cover.querySelectorAll('.nestify-cover__screen')];
    if (screens.length < 2) return;

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let current = 0;
    let visible = false;
    let timer;

    function show(next) {
        if (!screens[next]?.complete || !screens[next].naturalWidth) return;
        current = next;
        screens.forEach((screen, index) => {
            const active = index === current;
            screen.classList.toggle('is-active', active);
            screen.setAttribute('aria-hidden', String(!active));
        });
    }

    function schedule() {
        clearInterval(timer);
        if (visible && !document.hidden && !reduceMotion.matches) {
            timer = setInterval(() => show((current + 1) % screens.length), 3000);
        }
    }

    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        schedule();
    }, { threshold: 0.15 }).observe(cover);
    document.addEventListener('visibilitychange', schedule);
    reduceMotion.addEventListener('change', schedule);
})();
