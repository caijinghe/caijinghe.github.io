/* Nestify case study: reveal on scroll, play videos only while visible, count up stats. */
(() => {
  const root = document.querySelector('.nestify-case');
  if (!root) return;
  document.documentElement.classList.add('nf-js');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Children of a stagger group enter one after another.
  root.querySelectorAll('[data-nf-stagger]').forEach(group => {
    [...group.children].forEach((child, index) => {
      child.setAttribute('data-nf-reveal', '');
      child.style.setProperty('--nf-i', index);
    });
  });

  function countUp(element) {
    const target = parseFloat(element.dataset.nfCount);
    const decimals = (element.dataset.nfCount.split('.')[1] || '').length;
    const suffix = element.dataset.nfSuffix || '';
    if (reducedMotion.matches) {
      element.textContent = target.toFixed(decimals) + suffix;
      return;
    }
    const from = parseFloat(element.dataset.nfFrom || '0');
    const duration = 1200;
    const delay = parseFloat(element.dataset.nfDelay || '0');   // e.g. the 91% waits for its callout line
    if (delay) element.textContent = from.toFixed(decimals) + suffix;
    const start = performance.now() + delay;
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    function tick(now) {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      element.textContent = (from + (target - from) * easeOut(t)).toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // V1 / V2: a click stops the loop and keeps the chosen version.
  root.querySelectorAll('.nestify-v1v2').forEach(figure => {
    const tags = figure.querySelectorAll('.nestify-v1v2__tag[data-v]');
    tags.forEach(tag => tag.addEventListener('click', () => {
      figure.classList.add('is-manual');
      figure.dataset.show = tag.dataset.v;
      tags.forEach(t => t.setAttribute('aria-pressed', String(t === tag)));
    }));
  });


  // Table of contents: fixed in the right margin while the challenges are on screen. Challenges are the big rows; the
  // steps inside each (assumption, user testing, design decision…) are the small ones. The current one is dark.
  (() => {
    const heads = [
      ['nestify-strategy-1', 'A face for AI', true],
      ['nestify-strategy-2', 'AI adoption'],
      ['nestify-strategy-3', 'Everyone in sync'],
      ['nestify-tools', 'AI-native workflow'],
    ].map(([id, text, flat]) => [document.getElementById(id)?.closest('section'), text, flat]).filter(([el]) => el);
    if (!heads.length) return;
    const short = t => ({
      'What I learned from user testing': 'User testing',
      'Design and validate with limited time': 'Design constraints',
      'Design and validate with limited data': 'Design constraints',
    }[t] || t);
    const sections = [...root.querySelectorAll('section')];
    const items = [];
    heads.forEach(([el, text, flat], h) => {
      items.push({ el, text, level: 1 });
      if (flat) return;   // no sub-rows under this one
      const start = sections.indexOf(el);
      const end = h + 1 < heads.length ? sections.indexOf(heads[h + 1][0]) : sections.length;
      sections.slice(start + 1, end).forEach(sec => {
        if (!sec.classList.contains('nestify-step')) return;
        const label = sec.querySelector('.nestify-step__label, .case-section__label');
        const text = short(label?.firstChild.textContent.trim() || '');
        if (label && items[items.length - 1].text !== text) items.push({ el: sec, text, level: 2 });   // one row for steps that share a name   // the label's own words, not the principle tucked inside it
      });
    });
    const nav = document.createElement('nav');
    nav.className = 'nestify-toc';
    nav.setAttribute('aria-label', 'Challenges');
    items.forEach((item, i) => {
      if (!item.el.id) item.el.id = 'nf-toc-' + i;
      const a = document.createElement('a');
      a.href = '#' + item.el.id;
      a.textContent = item.text;
      a.className = 'nestify-toc__item nestify-toc__item--l' + item.level;
      a.addEventListener('click', e => { e.preventDefault(); item.el.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' }); });
      item.a = a;
      // each section and its steps share one group, so the current section can be framed as a whole
      if (item.level === 1) { item.group = document.createElement('div'); item.group.className = 'nestify-toc__group'; nav.append(item.group); }
      (item.level === 1 ? item.group : nav.lastElementChild).append(a);
    });
    // one mark on the rail that glides to wherever you are, instead of jumping
    const railMark = document.createElement('span');
    railMark.className = 'nestify-toc__rail-mark';
    railMark.setAttribute('aria-hidden', 'true');
    nav.append(railMark);
    document.body.append(nav);
    const first = heads[0][0];
    const last = document.querySelector('.case-pill--impact') || heads[heads.length - 1][0];
    let ticking = false;
    // Fits in the page's right margin (as wide as the left one), whatever the window or the preview's zoom: as wide as the margin allows,
    // hidden when there's less than 110px.
    function fit() {
      const header = heads[0][0].querySelector('.case-section__header') || heads[0][0];
      const room = header.offsetLeft - 32;
      nav.style.setProperty('--toc-room', room + 'px');
      nav.classList.toggle('is-fits', room >= 110);
    }
    function update() {
      ticking = false;
      const probe = window.innerHeight * 0.35;
      const on = first.getBoundingClientRect().top < window.innerHeight * 0.6 && last.getBoundingClientRect().top > probe;
      nav.classList.toggle('is-on', on);
      let current = items[0];
      items.forEach(item => { if (item.el.getBoundingClientRect().top <= probe) current = item; });
      const parent = current.level === 1 ? current : items.slice(0, items.indexOf(current)).reverse().find(i => i.level === 1);
      items.forEach(item => {
        item.a.classList.toggle('is-current', item === current);
        item.a.classList.toggle('is-open', item.level === 1 ? item === parent : items.slice(0, items.indexOf(item)).reverse().find(i => i.level === 1) === parent);
        if (item.group) item.group.classList.toggle('is-open', item === parent);
      });
      railMark.style.transform = `translateY(${current.a.offsetTop + 3}px)`;
      railMark.style.height = (current.a.offsetHeight - 6) + 'px';
    }
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', () => { fit(); update(); });
    fit();
    update();
  })();

  // Design principle dots: each opens on its own when it scrolls into the middle of the screen and closes when it
  // leaves; a tap toggles it, hover and focus open it too.
  const tips = [...root.querySelectorAll('.nestify-tip')];
  const placeTips = () => tips.forEach(tip => {
    const label = tip.closest('.case-section__label');
    if (!label) return;
    const x = tip.getBoundingClientRect().left - label.getBoundingClientRect().left;
    tip.style.setProperty('--tip-x', x + 'px');
    // the card may grow only as far as its own column, so it never covers the copy beside it
    const column = label.parentElement.getBoundingClientRect();
    tip.style.setProperty('--tip-max', Math.max(200, column.right - tip.getBoundingClientRect().left - 8) + 'px');
  });
  const setTip = (tip, open) => {
    if (tip.classList.contains('is-open') === open) return;
    clearTimeout(tip._nfClose);
    if (open) fitTip(tip);   // measured as it opens, with the real font in place
    tip.classList.toggle('is-open', open);
    tip.querySelector('.nestify-tip__mark').setAttribute('aria-expanded', String(open));
    tip.classList.toggle('is-closing', !open);
    if (!open) tip._nfClose = setTimeout(() => tip.classList.remove('is-closing'), 540);
  };
  // each tip stays open the whole time its blue design-decision band is on screen (wide windows only;
  // on a narrow one the dot just waits to be tapped)
  const tipAuto = window.matchMedia('(min-width: 769px)');
  tipAuto.addEventListener('change', () => { if (!tipAuto.matches) tips.forEach(tip => { clearTimeout(tip._nfTimer); setTip(tip, false); }); });
  const tipObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const tip = entry.target._nfTip;
      clearTimeout(tip._nfTimer);
      if (entry.isIntersecting) { if (!tip._nfDismissed && tipAuto.matches) tip._nfTimer = setTimeout(() => setTip(tip, true), 400); }
      else { tip._nfDismissed = false; setTip(tip, false); }   // leaving the band resets a dismissal
    });
  }, { rootMargin: '-25% 0px -25% 0px' });
  tips.forEach(tip => {
    const mark = tip.querySelector('.nestify-tip__mark');
    mark.addEventListener('click', e => { e.stopPropagation(); tip._nfDismissed = false; setTip(tip, !tip.classList.contains('is-open')); });
    // a tap on the open card, or anywhere else, closes it, and it stays closed until you scroll away and back
    tip.querySelector('.nestify-tip__pop').addEventListener('click', e => { e.stopPropagation(); tip._nfDismissed = true; setTip(tip, false); });
    document.addEventListener('click', e => { if (tip.classList.contains('is-open') && !tip.contains(e.target)) { tip._nfDismissed = true; setTip(tip, false); } });
    mark.addEventListener('focus', () => setTip(tip, true));
    const band = tip.closest('.nestify-band') || tip;
    band._nfTip = tip;
    tipObserver.observe(band);
  });
  // shrink each card to its longest line once the words have wrapped, so it is exactly as big as what it says
  // size each card to its words: first its natural lines (the set breaks, no wrapping); if that is wider than its
  // column allows, let it wrap at the limit and then shrink to the longest wrapped line
  const widestLine = pop => {
    let widest = 0;
    pop.querySelectorAll('.nestify-grad, .nestify-tip__label').forEach(el => {
      const range = document.createRange();
      range.selectNodeContents(el);
      [...range.getClientRects()].forEach(r => { widest = Math.max(widest, r.width); });
    });
    return widest;
  };
  const fitTip = tip => {
    const pop = tip.querySelector('.nestify-tip__pop');
    const cs = getComputedStyle(pop);
    const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 4;
    const limit = parseFloat(cs.maxWidth) || Infinity;
    pop.style.transition = 'none';
    pop.style.transform = 'none';   // measure at full size, not mid-grow
    pop.style.width = 'max-content';
    pop.style.maxWidth = 'none';
    pop.style.whiteSpace = 'nowrap';
    let width = widestLine(pop) + pad;
    pop.style.whiteSpace = '';
    pop.style.maxWidth = '';
    if (width > limit) { pop.style.width = limit + 'px'; width = widestLine(pop) + pad; }
    pop.style.width = Math.ceil(width) + 'px';
    pop.style.transform = '';
    pop.offsetWidth;   // settle before the transition comes back
    pop.style.transition = '';
  };
  const fitTips = () => tips.forEach(fitTip);
  placeTips();
  fitTips();
  window.addEventListener('resize', () => { placeTips(); fitTips(); });
  document.fonts?.ready.then(fitTips);

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      entry.target.querySelectorAll('[data-nf-count]').forEach(countUp);
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

  root.querySelectorAll('[data-nf-reveal]').forEach(element => revealObserver.observe(element));

  // Videos load on approach and only play while on screen.
  const videos = [...root.querySelectorAll('video[data-nf-video]')];
  const loadObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const video = entry.target;
      video.preload = 'auto';
      video.load();
      loadObserver.unobserve(video);
    });
  }, { rootMargin: '600px 0px' });

  const playObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting && !reducedMotion.matches) video.play().catch(() => {});
      else video.pause();
    });
  }, { threshold: 0.35 });

  videos.forEach(video => {
    loadObserver.observe(video);
    playObserver.observe(video);
  });
})();
