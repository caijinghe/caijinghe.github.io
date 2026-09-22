(() => {
  function initConceptGallery(dialogId = 'concept-gallery', triggerId = 'open-concept-gallery') {
    const dialog = document.getElementById(dialogId);
    const trigger = document.getElementById(triggerId);
    if (!dialog || !trigger) return;
    const stage = dialog.querySelector('.concept-gallery__stage');
    const slides = [...dialog.querySelectorAll('.concept-gallery__slide')];
    const steps = [...dialog.querySelectorAll('.concept-gallery__step')];
    const expandButton = dialog.querySelector('.concept-gallery__expand');
    const breadcrumbs = dialog.querySelector('.concept-gallery__breadcrumbs');
    const loading = document.createElement('div');
    loading.className = 'concept-gallery__loading';
    loading.setAttribute('aria-label', 'Loading project');
    loading.innerHTML = '<div class="concept-gallery__loading-dots" aria-hidden="true"><span></span><span></span><span></span></div>';
    dialog.appendChild(loading);
    dialog.querySelector('.concept-gallery__back').addEventListener('click', () => dialog.close());
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let previousOverflow;
    let previousBodyOverflow;
    let paintFrame = 0;
    let layout = [];
    let viewportWidth = 0;
    let scrollFrame = 0;
    let scrollTarget = 0;
    let lastFrameTime = 0;
    function measure() {
      viewportWidth = stage.clientWidth;
      const expanded = dialog.classList.contains('concept-gallery--expanded');
      const headerH = expanded ? 68 : 56;
      const height = stage.clientHeight - headerH;
      layout = slides.map(slide => {
        const width = slide.offsetWidth;
        const ratio = Number(slide.dataset.aspect) || 1;
        const isInfo = slide.classList.contains('concept-gallery__info-slide');
        const heightFactor = expanded ? (isInfo ? 1 : .82) : (isInfo ? .88 : .78);
        const maxWidth = isInfo ? width : width * (expanded ? 1 : .88);
        const imageWidth = Math.min(maxWidth, height * heightFactor * ratio);
        return { origin: slide.offsetLeft + width / 2, width, imageWidth, imageHeight: imageWidth / ratio };
      });
      layout.forEach((item, i) => {
        slides[i].style.setProperty('--image-width', `${item.imageWidth}px`);
        slides[i].style.setProperty('--image-height', `${item.imageHeight}px`);
      });
    }
    function stopScroll() {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
      lastFrameTime = 0;
    }
    function animateScroll(time) {
      const elapsed = lastFrameTime ? Math.min(64, time - lastFrameTime) : 16;
      lastFrameTime = time;
      const remaining = scrollTarget - stage.scrollLeft;
      stage.scrollLeft += Math.abs(remaining) < .5 ? remaining : remaining * (1 - Math.exp(-elapsed / 75));
      paint();
      if (Math.abs(scrollTarget - stage.scrollLeft) > .5) scrollFrame = requestAnimationFrame(animateScroll);
      else { stage.scrollLeft = scrollTarget; paint(); stopScroll(); }
    }
    function moveTo(target) {
      scrollTarget = Math.max(0, Math.min(layout[layout.length - 1].origin - viewportWidth / 2, target));
      if (reduceMotion.matches) { stopScroll(); stage.scrollLeft = scrollTarget; paint(); }
      else if (!scrollFrame) scrollFrame = requestAnimationFrame(animateScroll);
    }
    function paint() {
      paintFrame = 0;
      const center = stage.scrollLeft + viewportWidth / 2;
      let selected = 0, nearest = Infinity;
      const geometry = layout.map((item, i) => {
        const distance = Math.abs(item.origin - center);
        if (distance < nearest) { selected = i; nearest = distance; }
        const relative = distance / item.width;
        const scale = Math.max(.3, Math.pow(.72, relative));
        return { ...item, scale, width: item.imageWidth * scale, relative };
      });
      // Pack the visible image edges, not the unscaled slide boxes. This also
      // removes the extra blank space around portrait/square illustrations.
      const packed = [0];
      const gap = 6;
      for (let i = 1; i < geometry.length; i++) {
        packed[i] = packed[i - 1] + (geometry[i - 1].width + geometry[i].width) / 2 + gap;
      }
      let anchor = packed[selected];
      for (let i = 0; i < geometry.length - 1; i++) {
        if (center >= geometry[i].origin && center <= geometry[i + 1].origin) {
          const progress = (center - geometry[i].origin) / (geometry[i + 1].origin - geometry[i].origin);
          anchor = packed[i] + progress * (packed[i + 1] - packed[i]);
          break;
        }
      }
      // Information pages have a clean canvas; neighboring art fades in only
      // as the visitor scrolls toward the artwork pages.
      const last = geometry.length - 1;
      const fromStart = Math.max(0, Math.min(1, (center - geometry[0].origin) / (geometry[1].origin - geometry[0].origin)));
      const fromEnd = Math.max(0, Math.min(1, (geometry[last].origin - center) / (geometry[last].origin - geometry[last - 1].origin)));
      const edgeProgress = Math.min(fromStart, fromEnd);
      const artworkVisibility = edgeProgress * edgeProgress * (3 - 2 * edgeProgress);
      slides.forEach((slide, i) => {
        const item = geometry[i];
        slide.style.setProperty('--shift', `${packed[i] - anchor - (item.origin - center)}px`);
        slide.style.setProperty('--scale', String(item.scale));
        const visibility = (i === 0 || i === last) ? 1 : artworkVisibility;
        slide.style.setProperty('--opacity', String(visibility * Math.max(.18, Math.exp(-1.35 * item.relative * item.relative))));
      });
      steps.forEach((step, i) => step.setAttribute('aria-current', String(i === selected)));
    }
    function schedulePaint() { if (!paintFrame) paintFrame = requestAnimationFrame(paint); }
    function goTo(index) {
      const item = layout[Math.max(0, Math.min(slides.length - 1, index))];
      moveTo(item.origin - viewportWidth / 2);
    }
    trigger.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      previousOverflow = document.documentElement.style.overflow;
      previousBodyOverflow = document.body.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      loading.classList.remove('is-hidden');
      dialog.showModal();
      stopScroll();
      measure();
      stage.scrollLeft = 0;
      paint();
      stage.focus({ preventScroll: true });
      const firstImage = dialog.querySelector('.concept-gallery__slide img');
      const imageReady = firstImage && !firstImage.complete
        ? new Promise(resolve => firstImage.addEventListener('load', resolve, { once: true }))
        : Promise.resolve();
      Promise.race([imageReady, new Promise(resolve => setTimeout(resolve, 420))]).then(() => {
        setTimeout(() => loading.classList.add('is-hidden'), 180);
      });
    });
    expandButton.addEventListener('click', () => {
      const index = Math.max(0, steps.findIndex(step => step.getAttribute('aria-current') === 'true'));
      stopScroll();
      const expanded = dialog.classList.toggle('concept-gallery--expanded');
      breadcrumbs.inert = !expanded;
      expandButton.setAttribute('aria-pressed', String(expanded));
      expandButton.setAttribute('aria-label', expanded ? 'Restore gallery size' : 'Expand gallery');
      measure();
      stage.scrollLeft = layout[index].origin - viewportWidth / 2;
      paint();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      stopScroll();
      cancelAnimationFrame(paintFrame);
      paintFrame = 0;
      dialog.classList.remove('concept-gallery--expanded');
      breadcrumbs.inert = true;
      expandButton.setAttribute('aria-pressed', 'false');
      expandButton.setAttribute('aria-label', 'Expand gallery');
      document.documentElement.style.overflow = previousOverflow;
      document.body.style.overflow = previousBodyOverflow;
      trigger.focus({ preventScroll: true });
      loading.classList.remove('is-hidden');
    });
    // Accumulate wheel input and ease toward it on animation frames.
    dialog.addEventListener('wheel', (event) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const unit = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? stage.clientWidth : 1;
      moveTo((scrollFrame ? scrollTarget : stage.scrollLeft) + delta * unit);
    }, { passive: false });
    stage.addEventListener('pointerdown', stopScroll);
    stage.addEventListener('scroll', () => { if (!scrollFrame) schedulePaint(); }, { passive: true });
    stage.addEventListener('keydown', (event) => {
      const index = steps.findIndex(step => step.getAttribute('aria-current') === 'true');
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      goTo(event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : index + (event.key === 'ArrowRight' ? 1 : -1));
    });
    steps.forEach((step, i) => step.addEventListener('click', () => goTo(i)));
    new ResizeObserver(() => {
      if (!dialog.open) return;
      const index = Math.max(0, steps.findIndex(step => step.getAttribute('aria-current') === 'true'));
      stopScroll();
      measure();
      stage.scrollLeft = layout[index].origin - viewportWidth / 2;
      paint();
    }).observe(stage);
  }
  const init = () => {
    initConceptGallery('concept-gallery', 'open-concept-gallery');
    initConceptGallery('bibf-dialog', 'open-bibf');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
