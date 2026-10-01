/* CSS handles the original motion; native SVG handles each resting pose. */
(() => {
  for (const svg of document.querySelectorAll('.animated-lock')) {
    const path = svg.querySelector('.lock-shackle');
    const pose = svg.querySelector('.lock-shackle-pose');
    if (!path || !pose) continue;
    let state;
    let settleTimer;

    function settle() {
      clearTimeout(settleTimer);
      pose.setAttribute('transform', state === 'locked'
        ? 'translate(0 4)'
        : 'translate(42 -5) scale(-1 1)');
      path.setAttribute('data-settled', '');
    }

    function update() {
      const nextState = svg.classList.contains('is-locked') ? 'locked' : 'unlocked';
      if (nextState === state) return;
      state = nextState;
      clearTimeout(settleTimer);
      path.removeAttribute('data-settled');
      pose.removeAttribute('transform');
      settleTimer = setTimeout(settle, state === 'locked' ? 700 : 450);
    }

    path.addEventListener('animationend', event => {
      if (state === 'locked' && event.target === path && event.animationName === 'shackleLockSequence') settle();
    });
    path.addEventListener('transitionend', event => {
      if (state === 'unlocked' && event.target === path && event.propertyName === 'transform') settle();
    });
    new MutationObserver(update).observe(svg, { attributes: true, attributeFilter: ['class'] });
    update();
  }
})();
