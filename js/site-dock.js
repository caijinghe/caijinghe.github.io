/**
 * Site dock — the one place navigation is defined.
 * Any page: <nav class="site-dock" data-active="home|projects"></nav>
 *           + css/tokens.css + css/site-dock.css + this script.
 * Add / rename / relink a destination here and every page follows.
 */
(() => {
  const EMAIL = 'jinghe-cai@outlook.com';
  const RESUME = 'https://drive.google.com/file/d/1IsOUI2ZcsX_7XXkCw_bYc1aIiybE1FQT/view?usp=sharing';
  // Filled icons, 24 grid, currentColor
  const ICON = {
    mail: '<path fill-rule="evenodd" d="M4 4.5h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2zm.6 2.4 7.4 5.3 7.4-5.3a.75.75 0 0 0-.9-1.2L12 10.6 5.5 5.7a.75.75 0 0 0-.9 1.2z"/>',
    resume: '<path fill-rule="evenodd" d="M7 2h6.4c.6 0 1.1.2 1.5.6l4.5 4.5c.4.4.6.9.6 1.5V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm1.6 10.2a.8.8 0 0 0 0 1.6h6.8a.8.8 0 0 0 0-1.6zm0 3.6a.8.8 0 0 0 0 1.6h4.4a.8.8 0 0 0 0-1.6z"/>',
  };
  const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

  // Two segments: text tabs on the left, icon buttons on the right. `tag` lets the ink copy use plain spans.
  function markup(on, tag) {
    const cur = k => (k === on ? ' is-active" aria-current="page' : '');
    const a = (attrs, cls, inner) => tag === 'a' ? `<a ${attrs} class="${cls}">${inner}</a>` : `<span class="${cls.split('"')[0]}">${inner}</span>`;
    return `
      <div class="dock-seg">
        ${a('href="index.html"', `dock-tab${cur('home')}`, 'Dashboard')}
        ${a('href="projects.html"', `dock-tab${cur('projects')}`, 'Projects')}
      </div>
      <div class="dock-seg">
        ${a(`href="${RESUME}" aria-label="Résumé" data-label="Résumé" target="_blank" rel="noopener"`, 'dock-icon', svg('resume'))}
        ${a(`href="mailto:${EMAIL}" aria-label="Email" data-label="Email"`, 'dock-icon', svg('mail'))}
      </div>`;
  }

  function render(nav) {
    nav.setAttribute('aria-label', nav.getAttribute('aria-label') || 'Primary');
    nav.innerHTML = markup(nav.dataset.active || '', 'a');
    // The black pill under the active tab is its own element (not the tab's background), so that between Dashboard
    // and Projects it can glide from one tab to the other while the page slides (see holdDuringTransitions).
    const seg = nav.querySelector('.dock-seg'), pill = document.createElement('span');
    pill.className = 'dock-pill'; pill.setAttribute('aria-hidden', 'true'); seg.prepend(pill);
    const place = () => {
      const on = seg.querySelector('.dock-tab.is-active');
      pill.hidden = !on; if (!on) return;
      Object.assign(pill.style, { left: on.offsetLeft + 'px', top: on.offsetTop + 'px', width: on.offsetWidth + 'px', height: on.offsetHeight + 'px' });
    };
    place(); document.fonts?.ready.then(place); addEventListener('resize', place);
    // A tab click between the two slides the page the way the tabs sit: to Projects it moves left, back to
    // Dashboard it moves right (the same flags scrolling sets; each page's <head> plays the slide).
    const here = nav.dataset.active;
    nav.querySelectorAll('.dock-tab').forEach(tab => tab.addEventListener('click', () => {
      const to = tab.getAttribute('href');
      try {
        if (here === 'home' && to === 'projects.html') sessionStorage.setItem('vt-from-dash', '1');
        if (here === 'projects' && to === 'index.html') sessionStorage.setItem('vt-from-proj', '1');
      } catch {}
    }));
    return pill;
  }

  // Ink: the words and icons, drawn white on a twin layer right on top with mix-blend-mode: difference (the old
  // header's trick), so they invert against whatever is behind — dark on a light page, light on a dark photo.
  // It has to be a separate layer: inside the fixed dock the text could only blend with the dock's own pills.
  // The real dock underneath keeps the pills, clicks, focus and labels; its own text is transparent.
  function inkFor(nav) {
    const ink = document.createElement('div');
    ink.className = 'dock-ink';
    ink.setAttribute('aria-hidden', 'true');
    ink.innerHTML = markup(nav.dataset.active || '', 'span');
    nav.after(ink);
    // mirror hover / press onto the twin so it lifts and shrinks with the real button
    const twin = ink.querySelectorAll('.dock-tab, .dock-icon');
    nav.querySelectorAll('.dock-tab, .dock-icon').forEach((el, i) => {
      const t = twin[i];
      el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') t.classList.add('is-hover'); });
      el.addEventListener('pointerleave', () => t.classList.remove('is-hover', 'is-press'));
      el.addEventListener('pointerdown', () => t.classList.add('is-press'));
      ['pointerup', 'pointercancel'].forEach(k => el.addEventListener(k, () => t.classList.remove('is-press')));
    });
    return ink;
  }

  // Page-to-page slide (dashboard → projects): the dock and its ink are named so they stay put above the sliding page.
  // Only while a transition is capturing them, though: a view-transition-name makes the element a "backdrop root",
  // and the pills' backdrop blur would then see nothing behind them — the frosted glass turns plain see-through.
  function holdDuringTransitions(els) {
    const name = on => els.forEach(([el, n]) => { el.style.viewTransitionName = on ? n : ''; });
    addEventListener('pageswap', e => { if (e.viewTransition) name(true); });            // leaving: old snapshot
    addEventListener('pagereveal', e => {                                                 // arriving: new snapshot
      if (!e.viewTransition) return;
      name(true);
      e.viewTransition.finished.finally(() => name(false));
    });
    addEventListener('pageshow', e => { if (e.persisted) name(false); });                // back via bfcache
  }

  // Plain page underneath → solid gray. Imagery underneath → .is-over (frosted glass).
  // "Imagery" = img / video / canvas, a background image, or a background that isn't a light neutral.
  function busyAt(x, y, dock) {
    for (const hit of document.elementsFromPoint(x, y)) {
      if (dock.contains(hit)) continue;
      for (let el = hit; el && el !== document.documentElement; el = el.parentElement) {
        if (/^(IMG|VIDEO|CANVAS|IFRAME|PICTURE)$/.test(el.tagName)) return true;
        const cs = getComputedStyle(el);
        if (cs.backgroundImage !== 'none') return true;
        const c = cs.backgroundColor.match(/[\d.]+/g);
        if (c && (c[3] === undefined || +c[3] > 0.05)) {
          const [r, g, b] = c.map(Number);
          return Math.min(r, g, b) < 225 || Math.max(r, g, b) - Math.min(r, g, b) > 12;
        }
      }
      return false;
    }
    return false;
  }
  function watch(dock) {
    let raf = 0;
    const check = () => {
      raf = 0;
      const r = dock.getBoundingClientRect(), y = r.top + r.height / 2;
      const over = [0.08, 0.3, 0.5, 0.7, 0.92].some(k => busyAt(r.left + r.width * k, y, dock));
      dock.classList.toggle('is-over', over);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(check); };
    addEventListener('scroll', queue, { passive: true, capture: true });   // capture: also hears sideways scrollers
    addEventListener('resize', queue);
    addEventListener('load', queue);
    setInterval(queue, 700);   // media that loads or moves without a scroll
    queue();
  }

  window.SiteDock = { ICON, svg };   // design-system.html draws the icon set from here
  document.querySelectorAll('.site-dock').forEach(nav => {
    const pill = render(nav);
    if (getComputedStyle(nav).position === 'fixed') {
      const ink = inkFor(nav);
      holdDuringTransitions([[nav, 'site-dock'], [pill, 'dock-pill'], [ink, 'site-dock-ink']]);
      watch(nav);
    }
  });
})();
