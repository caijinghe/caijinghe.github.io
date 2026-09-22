(() => {
  function initScrollIndicator() {
    // Prevent duplicate initialization
    if (document.querySelector('.page-scroll-indicator')) return;

    const indicator = document.createElement('div');
    indicator.className = 'page-scroll-indicator';
    indicator.setAttribute('aria-hidden', 'true');

    const thumb = document.createElement('div');
    thumb.className = 'page-scroll-thumb';

    indicator.appendChild(thumb);
    document.body.appendChild(indicator);

    let isDragging = false;
    let dragStartPointerY = 0;
    let dragStartScrollTop = 0;
    let currentThumbY = 0;
    let currentThumbHeight = 36;
    let currentMaxTravel = 100;
    let ticking = false;
    let hideTimer = null;
    let isHovered = false;

    // Helper: Determine if a background color is dark
    function isColorDark(rgbString) {
      const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return false;
      const r = Number(match[1]);
      const g = Number(match[2]);
      const b = Number(match[3]);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return lum < 0.46;
    }

    // Determine current theme (dark or light) based on element under the thumb
    function detectTheme() {
      const rootTheme = document.documentElement.dataset.theme;
      const bodyTheme = document.body.dataset.theme;
      if (rootTheme === 'dark' || bodyTheme === 'dark' || document.body.classList.contains('dark-theme')) {
        return 'dark';
      }
      if (rootTheme === 'light' || bodyTheme === 'light') {
        return 'light';
      }

      // Sample element behind the thumb's current vertical position
      const thumbRect = thumb.getBoundingClientRect();
      const sampleY = Math.max(10, Math.min(window.innerHeight - 10, thumbRect.top + (thumbRect.height || 36) / 2));
      const sampleX = Math.max(10, window.innerWidth - 24);
      const el = document.elementFromPoint(sampleX, sampleY);

      let cur = el;
      while (cur && cur !== document.documentElement) {
        const style = window.getComputedStyle(cur);
        const bg = style.backgroundColor;
        if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
          return isColorDark(bg) ? 'dark' : 'light';
        }
        cur = cur.parentElement;
      }

      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      if (bodyBg && bodyBg !== 'transparent' && bodyBg !== 'rgba(0, 0, 0, 0)') {
        return isColorDark(bodyBg) ? 'dark' : 'light';
      }

      return 'light';
    }

    function showIndicator() {
      indicator.classList.add('is-active');
      clearTimeout(hideTimer);
      if (!isDragging && !isHovered) {
        hideTimer = setTimeout(() => {
          indicator.classList.remove('is-active');
        }, 1000);
      }
    }

    indicator.addEventListener('mouseenter', () => {
      isHovered = true;
      indicator.classList.add('is-active');
      clearTimeout(hideTimer);
    });

    indicator.addEventListener('mouseleave', () => {
      isHovered = false;
      if (!isDragging) {
        hideTimer = setTimeout(() => {
          indicator.classList.remove('is-active');
        }, 800);
      }
    });

    function update() {
      ticking = false;

      // Check if a modal dialog is currently open
      if (document.querySelector('dialog[open]')) {
        indicator.classList.remove('is-visible');
        return;
      }

      const docEl = document.documentElement;
      const body = document.body;
      const scrollHeight = Math.max(
        docEl.scrollHeight,
        body.scrollHeight,
        docEl.offsetHeight,
        body.offsetHeight
      );
      const clientHeight = window.innerHeight || docEl.clientHeight;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= 20) {
        indicator.classList.remove('is-visible');
        return;
      }

      indicator.classList.add('is-visible');

      const availableHeight = indicator.clientHeight || (clientHeight - 64);
      const rawThumbHeight = (clientHeight / scrollHeight) * availableHeight;
      currentThumbHeight = Math.max(36, Math.min(availableHeight * 0.85, rawThumbHeight));
      currentMaxTravel = Math.max(1, availableHeight - currentThumbHeight);

      const scrollTop = window.pageYOffset || docEl.scrollTop || body.scrollTop || 0;
      const fraction = Math.max(0, Math.min(1, scrollTop / maxScroll));
      currentThumbY = fraction * currentMaxTravel;

      thumb.style.height = `${currentThumbHeight}px`;
      thumb.style.transform = `translateY(${currentThumbY}px)`;

      // Theme detection
      const theme = detectTheme();
      indicator.classList.toggle('page-scroll-indicator--dark', theme === 'dark');
    }

    function requestUpdate() {
      showIndicator();
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }

    // Scroll directly by fraction
    function scrollToFraction(fraction, immediate = false) {
      const docEl = document.documentElement;
      const scrollHeight = Math.max(docEl.scrollHeight, document.body.scrollHeight);
      const maxScroll = scrollHeight - window.innerHeight;
      const targetScroll = Math.max(0, Math.min(maxScroll, fraction * maxScroll));

      if (window.lenis && typeof window.lenis.scrollTo === 'function') {
        window.lenis.scrollTo(targetScroll, { immediate });
      } else {
        window.scrollTo({ top: targetScroll, behavior: immediate ? 'auto' : 'smooth' });
      }
    }

    // Pointer down on container or thumb
    indicator.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      isDragging = true;
      indicator.classList.add('is-dragging');
      clearTimeout(hideTimer);
      try { indicator.setPointerCapture(e.pointerId); } catch (_) {}

      const rect = indicator.getBoundingClientRect();
      const pointerY = e.clientY - rect.top;

      // If clicked outside the thumb, jump to that position
      if (pointerY < currentThumbY || pointerY > currentThumbY + currentThumbHeight) {
        const fraction = Math.max(0, Math.min(1, (pointerY - currentThumbHeight / 2) / currentMaxTravel));
        scrollToFraction(fraction, false);
      }

      dragStartPointerY = e.clientY;
      const docEl = document.documentElement;
      dragStartScrollTop = window.pageYOffset || docEl.scrollTop || document.body.scrollTop || 0;
    });

    indicator.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const deltaY = e.clientY - dragStartPointerY;
      const docEl = document.documentElement;
      const scrollHeight = Math.max(docEl.scrollHeight, document.body.scrollHeight);
      const maxScroll = scrollHeight - window.innerHeight;
      const scrollPerPixel = maxScroll / currentMaxTravel;
      const targetScroll = dragStartScrollTop + deltaY * scrollPerPixel;
      const fraction = Math.max(0, Math.min(1, targetScroll / maxScroll));
      scrollToFraction(fraction, true);
    });

    function endDrag(e) {
      if (!isDragging) return;
      isDragging = false;
      indicator.classList.remove('is-dragging');
      try { indicator.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!isHovered) {
        hideTimer = setTimeout(() => {
          indicator.classList.remove('is-active');
        }, 800);
      }
    }

    indicator.addEventListener('pointerup', endDrag);
    indicator.addEventListener('pointercancel', endDrag);

    // Event listeners for window scroll and resize
    window.addEventListener('scroll', requestUpdate, { passive: true });
    let resizeDebounceTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeDebounceTimer);
      resizeDebounceTimer = setTimeout(requestUpdate, 150);
    }, { passive: true });

    // Hook Lenis if present
    if (window.lenis && typeof window.lenis.on === 'function') {
      window.lenis.on('scroll', requestUpdate);
    } else {
      let checkLenisCount = 0;
      const checkLenis = setInterval(() => {
        checkLenisCount++;
        if (window.lenis && typeof window.lenis.on === 'function') {
          window.lenis.on('scroll', requestUpdate);
          clearInterval(checkLenis);
        } else if (checkLenisCount > 20) {
          clearInterval(checkLenis);
        }
      }, 200);
    }

    document.querySelectorAll('dialog').forEach(dlg => {
      dlg.addEventListener('close', requestUpdate);
    });

    // Initial update
    requestUpdate();
    setTimeout(requestUpdate, 300);
    setTimeout(requestUpdate, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollIndicator, { once: true });
  } else {
    initScrollIndicator();
  }
})();
