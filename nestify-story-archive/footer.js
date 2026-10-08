/* ============================================================
   FOOTER behaviour — the text-splitting and entry
   reveals from lusion-replica (js/split.js + its scroll observer),
   trimmed to what the footer needs and rewritten as a plain script
   so it loads alongside the page's other non-module files.
   ============================================================ */
(function () {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const WORD = /(\s+)/;

  /* ---------- split ----------
     Author line breaks become .line > .line-mask, so each line clips
     its own words as they rise. mode 'char' additionally wraps every
     glyph, which is what the big display line animates on. */
  /* the authored line, flattened to [{text, cls}] runs — an inline span's
     class rides along so colour survives the rewrite (the footer's brand
     word is a <span> inside the headline) */
  function runs(raw) {
    const tmp = document.createElement('div');
    tmp.innerHTML = raw;
    const out = [];
    (function walk(node, cls) {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) out.push({ text: n.nodeValue, cls });
        else if (n.nodeType === 1) walk(n, [cls, n.className].filter(Boolean).join(' '));
      });
    })(tmp, '');
    return out;
  }

  function split(el, mode) {
    if (el.dataset.split === 'done') return;

    const rawLines = el.innerHTML.split(/<br\s*\/?>/i);
    el.textContent = '';

    const words = [], chars = [];

    for (const raw of rawLines) {
      const parts = runs(raw);
      if (!parts.some((p) => p.text.trim())) continue;

      const line = document.createElement('span');
      line.className = 'line';
      const mask = document.createElement('span');
      mask.className = 'line-mask';
      line.appendChild(mask);

      for (const part of parts) {
        for (const token of part.text.replace(/\s+/g, ' ').split(WORD)) {
          if (token === '') continue;
          if (/^\s+$/.test(token)) { mask.appendChild(document.createTextNode(' ')); continue; }

          const w = document.createElement('span');
          w.className = ['word', part.cls].filter(Boolean).join(' ');
          if (mode === 'char') {
            for (const ch of token) {
              const c = document.createElement('span');
              c.className = 'char';
              c.textContent = ch;
              w.appendChild(c);
              chars.push(c);
            }
          } else {
            w.textContent = token;
          }
          mask.appendChild(w);
          words.push(w);
        }
      }
      el.appendChild(line);
    }

    /* the original's cadence: ~30ms a word, ~18ms a char */
    words.forEach((w, i) => { w.style.transitionDelay = `${(i * 0.03).toFixed(3)}s`; });
    chars.forEach((c, i) => { c.style.transitionDelay = `${(i * 0.018).toFixed(3)}s`; });

    el.dataset.split = 'done';
  }

  document.querySelectorAll('[data-split]').forEach((el) => split(el, el.dataset.split));

  /* ---------- reveal on entry ---------- */
  const targets = document.querySelectorAll('[data-reveal], [data-inview]');

  if (REDUCED || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);          // one-way, like the original
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    targets.forEach((el) => io.observe(el));
  }
})();
