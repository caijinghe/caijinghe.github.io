/**
 * Site dock — the one place navigation is defined.
 * Any page: <nav class="site-dock" data-active="design|research|info"></nav>
 *           + css/tokens.css + css/site-dock.css + this script (before info-popover.js).
 * Add / rename / relink a destination here and every page follows.
 */
(() => {
  // Site root, wherever this file is loaded from (it lives in experiments/navigation-bar/)
  const ROOT = new URL('../../', document.currentScript.src).href;
  const RESUME = 'https://drive.google.com/file/d/1IsOUI2ZcsX_7XXkCw_bYc1aIiybE1FQT/view?usp=sharing';
  // Filled icons, 24 grid, currentColor
  const ICON = {
    info: '<circle cx="12" cy="7.5" r="4.2"/><path d="M3.8 19.3c0-3.6 3.7-6.1 8.2-6.1s8.2 2.5 8.2 6.1a1.7 1.7 0 0 1-1.7 1.7H5.5a1.7 1.7 0 0 1-1.7-1.7z"/>',
    resume: '<path fill-rule="evenodd" d="M7 2h6.4c.6 0 1.1.2 1.5.6l4.5 4.5c.4.4.6.9.6 1.5V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm1.6 10.2a.8.8 0 0 0 0 1.6h6.8a.8.8 0 0 0 0-1.6zm0 3.6a.8.8 0 0 0 0 1.6h4.4a.8.8 0 0 0 0-1.6z"/>',
  };
  const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

  function render(nav) {
    const on = nav.dataset.active || '';
    const cur = k => (k === on ? ' is-active" aria-current="page' : '');
    nav.setAttribute('aria-label', nav.getAttribute('aria-label') || 'Primary');
    nav.innerHTML = `
      <div class="dock-seg">
        <a href="${ROOT}index.html" class="dock-tab${cur('design')}">Design</a>
        <a href="${ROOT}experiments/navigation-bar/research-with-dock.html" class="dock-tab${cur('research')}">Research</a>
      </div>
      <div class="dock-seg">
        <a href="${ROOT}about.html" class="dock-icon${cur('info')}" aria-label="Info" data-label="Info"${on === 'info' ? '' : ' data-popover'}>${svg('info')}</a>
        <a href="${RESUME}" class="dock-icon" aria-label="Résumé" data-label="Résumé" target="_blank" rel="noopener">${svg('resume')}</a>
      </div>`;
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
    render(nav);
    if (getComputedStyle(nav).position === 'fixed') watch(nav);
  });
})();
