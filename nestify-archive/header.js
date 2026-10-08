/* ============================================================
   HEADER — the bar's own behaviour: condense on the scroll, and the
   light/dark flip ported from lusion-replica's `is-dark-bg`. The
   original ran on a virtual scroller; this one reads the real scroll
   position against the hero's dark stage.

   🔴 The menu is gone and so is its half of this file: the #menuBtn
   toggle, the Escape handler that closed it, and the .hd__link click
   handler that closed the sheet before letting the anchor scroll. The
   bar carries one button — Device — at every width now. The full note on
   what was removed and what it cost is at the foot of header.css.
   ============================================================ */
(function () {
  const html = document.documentElement;

  /* ---------- condense on the way down, hide, return condensed ----------
     zipline.com's bar. Two independent states: `is-hd-compact` is purely
     positional (are we past the first screenful), `is-hd-hidden` is
     directional. Coming back up clears only the second, which is why the
     bar reappears small and doesn't grow again until you reach the top. */
  const COMPACT_AT = 90;    // px of scroll before the bar condenses
  const HIDE_AFTER = 260;   // never pull it away inside the first screen
  const DELTA = 6;          // ignore trackpad jitter

  let last = window.scrollY;
  let barTicking = false;

  function bar() {
    if (barTicking) return;
    barTicking = true;
    requestAnimationFrame(() => {
      barTicking = false;
      const y = window.scrollY;
      const d = y - last;

      html.classList.toggle('is-hd-compact', y > COMPACT_AT);
      /* 🔴 the FIRST SCREEN, measured live rather than as a constant:
         the buttons wear no frame while the opener is still up (see
         .is-hd-top in header.css) and svh on a phone changes under you
         when the address bar collapses. .9 rather than 1 so the frame
         is already there as the seam arrives, not a beat after it. */
      html.classList.toggle('is-hd-top', y < innerHeight * 0.9);

      if (Math.abs(d) < DELTA) return;   // too small to read as a direction
      last = y;
      html.classList.toggle('is-hd-hidden', d > 0 && y > HIDE_AFTER);
    });
  }
  addEventListener('scroll', bar, { passive: true });

  /* ---------- the bar arrives at the size it left ----------
     The condensed bar is a per-document state, so a click on a condensed
     DEVICE pill lands on a header that paints full-size on its first frame
     and the button the reader was just looking at jumps ~15% with nothing in
     between. Neither page can transition that away on its own; the two sizes
     belong to two documents.

     So the size travels. The inline block in each page's <head> reads this
     back and puts `is-hd-compact` on <html> BEFORE the first style
     resolution — that is why it is inline and up there rather than here, at
     the foot of the body, where the header has already painted.

     🔴 pagehide, NOT beforeunload/unload. beforeunload is throttled and can
     be skipped outright, unload disqualifies the page from the back/forward
     cache, and neither fires reliably on iOS. pagehide is the one that does.
     It also covers the bfcache case, where the document is frozen rather
     than torn down. */
  const HANDOFF = 'hd-compact';
  addEventListener('pagehide', () => {
    try {
      sessionStorage.setItem(HANDOFF, html.classList.contains('is-hd-compact') ? '1' : '0');
    } catch (e) { /* storage disabled — the next page just cuts, as before */ }
  });

  /* 🔴 THE RELEASE IS NOT HERE, and it was, once. Letting this file take the
     class off looks like the obvious home for it and it measured badly: this
     script is at the foot of the body, behind every other script the page
     loads, so on device.html the inherited compact bar sat on screen for
     1704ms before it started growing — a small header held for most of two
     seconds, which reads worse than the cut it was meant to replace. The
     release belongs to the same inline block that sets the class, where it
     can fire as soon as the bar has had one frame. */
  bar();

  /* white type only while the bar sits over something actually dark.
     intro.js / hero.js keep data-tone on their own sections up to date;
     everything further down the page is light. */
  const BAR = 70;                                   // header's bottom edge
  let ticking = false;
  function theme() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const under = [...document.querySelectorAll('[data-tone]')].find((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= BAR && r.bottom > BAR;
      });
      html.classList.toggle('is-dark-bg', under?.dataset.tone === 'dark');
    });
  }
  addEventListener('scroll', theme, { passive: true });
  addEventListener('resize', theme);
  addEventListener('hero:tone', theme);
  theme();
})();
