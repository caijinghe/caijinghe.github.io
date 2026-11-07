/**
 * Projects: keep scrolling up past the top → back to the Dashboard (the mirror of the dashboard's "scroll on past the
 * bottom → Projects", js/dashboard.js). Only a NEW gesture begun once you're already at the top goes back — the
 * momentum that merely carried you up there doesn't — so scrolling up through the projects never throws you off the
 * page. Touch: pull down from the top. index.html reads the flag and slides in from the left (Dashboard is the
 * dock's left tab). Nothing happens while the preloader, password box or showreel is up.
 */
(() => {
  const BACK = 'index.html', WHEEL_NEED = 140, SWIPE_NEED = 90;
  const se = document.scrollingElement;
  const atTop = () => se.scrollTop <= 2;
  const shown = el => { if (!el) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.01; };
  const busy = () => {
    const reel = document.getElementById('showreelOverlay');
    return (reel && !reel.classList.contains('hidden')) || shown(document.getElementById('site-preloader')) || shown(document.getElementById('password-overlay'));
  };

  let topSince = atTop() ? performance.now() : Infinity, gestureT = 0, lastT = 0, sum = 0, going = false;
  const track = () => {   // when did we arrive at the top?
    if (!atTop()) topSince = Infinity;
    else if (topSince === Infinity) topSince = performance.now();
  };
  const go = () => {
    if (going) return; going = true;
    try { sessionStorage.setItem('vt-from-proj', '1'); } catch {}
    location.href = BACK;
  };

  addEventListener('scroll', track, { passive: true });
  addEventListener('wheel', e => {
    if (e.ctrlKey) return;   // pinch zoom
    track();
    const now = performance.now();
    if (now - lastT > 200) { gestureT = now; sum = 0; }   // a pause starts a new gesture
    lastT = now;
    if (gestureT < topSince + 50 || busy()) return;      // this gesture began before we were at the top
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    sum = dy < 0 ? sum - dy : 0;
    if (sum > WHEEL_NEED) go();
  }, { passive: true });

  let y0 = null;
  addEventListener('touchstart', e => { y0 = e.touches.length === 1 && atTop() && !busy() ? e.touches[0].clientY : null; }, { passive: true });
  addEventListener('touchmove', e => { if (y0 !== null && e.touches[0].clientY - y0 > SWIPE_NEED) go(); }, { passive: true });

  addEventListener('pageshow', () => {   // back here from the dashboard (bfcache): ready again
    going = false; sum = 0; topSince = atTop() ? performance.now() : Infinity;
    try { sessionStorage.removeItem('vt-from-proj'); } catch {}
  });
})();
